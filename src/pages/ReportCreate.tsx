import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useCreateReport } from "@/hooks/useReports";
import { supabase } from "@/integrations/supabase/client";
import { apiClient } from "@/services/api/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AnimatedPage, fadeInUp } from "@/components/AnimatedPage";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Upload, MapPin, Image, Info, Camera, LocateFixed } from "lucide-react";
import { Constants } from "@/integrations/supabase/types";

const SEVERITY_PILLS = [
  { value: "low", label: "Low", color: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  { value: "medium", label: "Medium", color: "bg-amber-100 text-amber-700 border-amber-200" },
  { value: "high", label: "High", color: "bg-orange-100 text-orange-700 border-orange-200" },
  { value: "critical", label: "Critical", color: "bg-red-100 text-red-700 border-red-200" },
];

const ReportCreate = () => {
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>("");
  const [address, setAddress] = useState("");
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [category, setCategory] = useState("other");
  const [severity, setSeverity] = useState("medium");
  const [description, setDescription] = useState("");
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [locLoading, setLocLoading] = useState(false);
  const [useCamera, setUseCamera] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    // Cleanup on unmount
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  useEffect(() => {
    // When we already have a stream and the video element mounts, attach it.
    if (useCamera && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      // Some browsers require an explicit play() call
      void videoRef.current.play?.();
    }
  }, [useCamera]);

  const createReport = useCreateReport();
  const navigate = useNavigate();
  const { toast } = useToast();

  const fetchLocation = () => {
    if (!navigator.geolocation) {
      toast({ title: "Geolocation not supported", variant: "destructive" });
      return;
    }
    setLocLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        setLat(latitude.toString());
        setLng(longitude.toString());
        try {
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`);
          const data = await res.json();
          if (data.display_name) setAddress(data.display_name);
        } catch {
          // silently fail reverse geocode
        }
        setLocLoading(false);
        toast({ title: "Location detected!" });
      },
      (err) => {
        setLocLoading(false);
        toast({ title: "Could not get location", description: err.message, variant: "destructive" });
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) { setImageFile(file); setImagePreview(URL.createObjectURL(file)); }
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      streamRef.current = stream;
      setCameraActive(true);
      setUseCamera(true);
    } catch (err: any) {
      toast({
        title: "Camera access denied",
        description: err.message ?? "Please allow camera permissions in your browser.",
        variant: "destructive",
      });
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  };

  const capturePhoto = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => {
      if (!blob) return;
      const file = new File([blob], `camera-${Date.now()}.jpg`, { type: "image/jpeg" });
      setImageFile(file);
      setImagePreview(canvas.toDataURL("image/jpeg"));
      stopCamera();
    }, "image/jpeg", 0.9);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith("image/")) { setImageFile(file); setImagePreview(URL.createObjectURL(file)); }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!address.trim()) { toast({ title: "Location address is required", variant: "destructive" }); return; }
    setUploading(true);
    try {
      let imageUrl: string | undefined;
      if (imageFile) {
        const ext = imageFile.name.split(".").pop();
        const path = `${crypto.randomUUID()}.${ext}`;
        const { error: uploadError } = await supabase.storage.from("report-images").upload(path, imageFile);
        if (uploadError) throw uploadError;
        const { data: urlData } = supabase.storage.from("report-images").getPublicUrl(path);
        imageUrl = urlData.publicUrl;
      }
      const report = await createReport.mutateAsync({
        image_url: imageUrl, location_address: address,
        latitude: lat ? parseFloat(lat) : undefined, longitude: lng ? parseFloat(lng) : undefined,
        category, severity, description,
      });

      // Kick off the AI agent pipeline
      try {
        await apiClient.post(`/reports/${report.id}/process`);
      } catch (pipelineErr: any) {
        console.error("Pipeline trigger failed:", pipelineErr?.message);
        toast({
          title: "Pipeline warning",
          description: `AI processing could not start: ${pipelineErr?.message ?? "unknown error"}. Check that the backend is running.`,
          variant: "destructive",
        });
      }

      toast({ title: "Report Created!", description: "AI agents are now processing your report." });
      navigate(`/reports/${report.id}`);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally { setUploading(false); }
  };

  return (
    <AnimatedPage className="mx-auto max-w-2xl">
      <Card className="glass overflow-hidden">
        <CardHeader>
          <CardTitle className="text-2xl">Report Waste</CardTitle>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-8">
            {/* Step 1: Image */}
            <motion.div variants={fadeInUp} initial="initial" animate="animate" className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Camera className="h-4 w-4" /> Step 1 — Photo Evidence
              </div>
              <div className="flex items-center justify-between gap-3">
                <Button
                  type="button"
                  variant={useCamera ? "default" : "outline"}
                  size="sm"
                  className="gap-1.5"
                  onClick={async () => {
                    if (!useCamera) {
                      await startCamera();
                    } else {
                      setUseCamera(false);
                      stopCamera();
                    }
                  }}
                >
                  <Camera className="h-4 w-4" />
                  {useCamera ? "Use file upload" : "Use camera"}
                </Button>
                <span className="text-xs text-muted-foreground">
                  {useCamera ? "Capture a photo with your camera" : "Or upload an existing image"}
                </span>
              </div>

              {useCamera ? (
                <div className="space-y-3">
                  <div className="relative overflow-hidden rounded-xl border bg-black/60">
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      className="h-40 w-full object-cover"
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={stopCamera}
                      disabled={!cameraActive}
                    >
                      Stop camera
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      onClick={capturePhoto}
                      disabled={!cameraActive}
                    >
                      Capture photo
                    </Button>
                  </div>
                </div>
              ) : (
                <label
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleDrop}
                  className={`flex h-40 cursor-pointer items-center justify-center rounded-xl border-2 border-dashed transition-all ${
                    dragOver ? "border-primary bg-primary/5 scale-[1.02]" : "border-input bg-muted/30 hover:bg-muted/50 hover:border-primary/50"
                  }`}
                >
                  <AnimatePresence mode="wait">
                    {imagePreview ? (
                      <motion.img key="preview" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} src={imagePreview} alt="Preview" className="h-full w-full rounded-xl object-cover" />
                    ) : (
                      <motion.div key="placeholder" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center gap-2 text-muted-foreground">
                        <Upload className="h-8 w-8" />
                        <span className="text-sm">Drag & drop or click to upload</span>
                      </motion.div>
                    )}
                  </AnimatePresence>
                  <input type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
                </label>
              )}
            </motion.div>

            {/* Step 2: Location */}
            <motion.div variants={fadeInUp} initial="initial" animate="animate" className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <MapPin className="h-4 w-4" /> Step 2 — Location
                </div>
                <Button type="button" variant="outline" size="sm" onClick={fetchLocation} disabled={locLoading} className="gap-1.5 text-xs">
                  {locLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <LocateFixed className="h-3.5 w-3.5" />}
                  Auto-detect
                </Button>
              </div>
              <div className="relative">
                <MapPin className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input className="pl-9 transition-shadow focus:shadow-md focus:shadow-primary/10" required value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Street address or landmark" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label htmlFor="lat" className="text-xs">Latitude</Label>
                  <Input id="lat" type="number" step="any" value={lat} onChange={(e) => setLat(e.target.value)} placeholder="e.g. 22.7196" className="transition-shadow focus:shadow-md focus:shadow-primary/10" />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="lng" className="text-xs">Longitude</Label>
                  <Input id="lng" type="number" step="any" value={lng} onChange={(e) => setLng(e.target.value)} placeholder="e.g. 75.8577" className="transition-shadow focus:shadow-md focus:shadow-primary/10" />
                </div>
              </div>
            </motion.div>

            {/* Step 3: Details */}
            <motion.div variants={fadeInUp} initial="initial" animate="animate" className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Info className="h-4 w-4" /> Step 3 — Details
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Category</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Constants.public.Enums.waste_category.map((c) => (
                      <SelectItem key={c} value={c}>{c.replace("_", " ")}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Severity</Label>
                <div className="flex flex-wrap gap-2">
                  {SEVERITY_PILLS.map((s) => (
                    <motion.button
                      key={s.value}
                      type="button"
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => setSeverity(s.value)}
                      className={`rounded-full border px-4 py-1.5 text-sm font-medium transition-all ${
                        severity === s.value ? `${s.color} shadow-sm` : "border-input bg-background text-muted-foreground hover:bg-muted"
                      }`}
                    >
                      {s.label}
                    </motion.button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Description</Label>
                <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Describe the waste issue..." rows={4} className="transition-shadow focus:shadow-md focus:shadow-primary/10" />
              </div>
            </motion.div>

            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <Button type="submit" className="w-full" disabled={uploading}>
                {uploading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Submit Report
              </Button>
            </motion.div>
          </CardContent>
        </form>
      </Card>
    </AnimatedPage>
  );
};

export default ReportCreate;
