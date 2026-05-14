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
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { AnimatedPage, fadeInUp } from "@/components/AnimatedPage";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Upload, MapPin, Image, Info, Camera, LocateFixed, Trash2, X } from "lucide-react";
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

  const handleVideoRef = (node: HTMLVideoElement | null) => {
    videoRef.current = node;
    if (node && streamRef.current) {
      node.srcObject = streamRef.current;
      node.play?.().catch(console.error);
    }
  };

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
      setUseCamera(false);
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
    if (!imageFile) { toast({ title: "Photo evidence is required", variant: "destructive" }); return; }

    setUploading(true);
    try {
      let imageUrl: string | undefined;
      let storagePath: string | undefined;

      if (imageFile) {
        const ext = imageFile.name.split(".").pop();
        storagePath = `${crypto.randomUUID()}.${ext}`;
        const { error: uploadError } = await supabase.storage.from("report-images").upload(storagePath, imageFile);
        if (uploadError) throw uploadError;
        const { data: urlData } = supabase.storage.from("report-images").getPublicUrl(storagePath);
        imageUrl = urlData.publicUrl;
      }

      // 0th Layer Verification
      if (imageUrl) {
        toast({ title: "Analyzing image...", description: "Verifying photo validity." });
        const verifyResult = await apiClient.post<{ is_waste: boolean; reason?: string }>("/reports/verify-image", { imageUrl });

        if (!verifyResult.is_waste) {
          // Reject and cleanup
          if (storagePath) {
            await supabase.storage.from("report-images").remove([storagePath]);
          }
          toast({
            title: "Photo Rejected",
            description: verifyResult.reason || "The uploaded image does not appear to contain valid waste.",
            variant: "destructive",
            duration: Infinity
          });
          setUploading(false);
          return; // Stop submission
        }
      }

      const report = await createReport.mutateAsync({
        image_url: imageUrl, location_address: address,
        latitude: lat ? parseFloat(lat) : undefined, longitude: lng ? parseFloat(lng) : undefined,
        category, severity, description,
      });

      // Kick off the AI agent pipeline
      try {
        await apiClient.post(`/reports/${report.id}/process`);

        // Poll once for the ward assignment from geo_intelligence stage
        try {
          const { data: events } = await supabase
            .from("report_events")
            .select("message,metadata")
            .eq("report_id", report.id)
            .eq("agent_type", "geo_intelligence")
            .order("created_at", { ascending: false });

          const wardEvent = events?.find(
            (e) => (e.metadata as any)?.ward_name
          );
          if (wardEvent) {
            const wardName = (wardEvent.metadata as any).ward_name as string;
            const wardNo = (wardEvent.metadata as any).ward_no as string;
            toast({
              title: `📍 Ward Assigned`,
              description: `Your report is in ${wardName} (Ward No. ${wardNo}).`,
            });
          }
        } catch {
          // Ward toast is best-effort — don't block navigation
        }
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
    <AnimatedPage className="mx-auto max-w-4xl space-y-6">
      <Card className="glass overflow-hidden border-white/40 dark:border-white/10 shadow-lg">
        <CardHeader className="bg-muted/10 border-b pb-6 mb-6">
          <CardTitle className="text-3xl font-bold tracking-tight">Report Waste</CardTitle>
          <p className="text-muted-foreground">Help keep the community clean by reporting issues.</p>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-8">
            {/* Step 1: Image */}
            <motion.div variants={fadeInUp} initial="initial" animate="animate" className="space-y-4">
              <div className="flex items-center gap-2 text-lg font-semibold tracking-tight">
                <div className="bg-primary/10 p-2 rounded-full"><Camera className="h-5 w-5 text-primary" /></div>
                Step 1 — Photo Evidence
              </div>

              <div className="flex flex-col sm:flex-row gap-4 items-stretch">
                {imagePreview ? (
                  <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="w-full relative rounded-2xl overflow-hidden border bg-black/5 dark:bg-white/5 shadow-sm flex items-center justify-center min-h-[300px] group">
                    <img src={imagePreview} alt="Preview" className="w-full h-auto max-h-[500px] object-contain rounded-2xl" />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-all duration-300 flex items-center justify-center backdrop-blur-sm">
                      <Button type="button" variant="destructive" size="lg" className="gap-2 shadow-2xl scale-95 group-hover:scale-100 transition-transform duration-300 rounded-xl h-14 px-6 text-lg font-medium" onClick={() => { setImageFile(null); setImagePreview(""); }}>
                        <Trash2 className="h-5 w-5" /> Remove Photo
                      </Button>
                    </div>
                  </motion.div>
                ) : (
                  <>
                    <label
                      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                      onDragLeave={() => setDragOver(false)}
                      onDrop={handleDrop}
                      className={`flex-1 relative flex min-h-[220px] cursor-pointer items-center justify-center rounded-2xl border-2 border-dashed transition-all ${dragOver ? "border-primary bg-primary/5 scale-[1.01]" : "border-muted-foreground/30 bg-muted/20 hover:bg-muted/40 hover:border-primary/50"
                        }`}
                    >
                      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center gap-4 text-muted-foreground p-6">
                        <div className="p-5 bg-background rounded-full shadow-sm border border-muted"><Image className="h-10 w-10 text-primary/70" /></div>
                        <div className="text-center">
                          <span className="text-base font-medium text-foreground block">Click or drag & drop</span>
                          <p className="text-sm text-muted-foreground mt-1">SVG, PNG, JPG or GIF</p>
                        </div>
                      </motion.div>
                      <input type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
                    </label>

                    <div className="flex flex-col gap-3 justify-center sm:w-48 shrink-0 relative">
                      <div className="hidden sm:flex absolute left-0 -ml-[23px] top-1/2 -translate-y-1/2 bg-background p-1 text-xs text-muted-foreground uppercase font-semibold tracking-wider z-10 rounded-full">Or</div>
                      <div className="sm:hidden text-xs text-center text-muted-foreground uppercase font-semibold tracking-wider my-1">Or</div>

                      <Button
                        type="button"
                        variant="outline"
                        className="gap-2 h-16 rounded-xl shadow-sm border-primary/20 bg-primary/5 hover:bg-primary/10 hover:text-primary transition-colors text-base"
                        onClick={async () => {
                          await startCamera();
                        }}
                      >
                        <Camera className="h-6 w-6" />
                        Open Camera
                      </Button>
                    </div>
                  </>
                )}
              </div>

              {/* Camera Dialog */}
              <Dialog open={useCamera} onOpenChange={(open) => {
                if (!open) { setUseCamera(false); stopCamera(); }
              }}>
                <DialogContent className="sm:max-w-4xl w-screen h-screen sm:h-[80vh] max-w-none m-0 sm:m-auto rounded-none sm:rounded-2xl p-0 overflow-hidden bg-black border-none flex flex-col shadow-2xl [&>button]:hidden">
                  <div className="absolute top-6 right-6 z-50">
                    <Button variant="outline" size="icon" className="rounded-full bg-black/40 text-white hover:bg-black/60 border-none backdrop-blur-md shadow-lg" onClick={() => { setUseCamera(false); stopCamera(); }}>
                      <X className="w-6 h-6" />
                    </Button>
                  </div>
                  <div className="flex-1 relative bg-black flex items-center justify-center">
                    <video
                      ref={handleVideoRef}
                      autoPlay
                      playsInline
                      className="w-full h-full object-cover max-h-full"
                    />
                    {!cameraActive && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/80 text-white">
                        <Loader2 className="w-8 h-8 animate-spin" />
                      </div>
                    )}
                  </div>
                  <div className="absolute bottom-0 left-0 right-0 p-8 flex justify-center bg-gradient-to-t from-black/80 to-transparent">
                    <Button
                      type="button"
                      size="lg"
                      className="rounded-full h-20 w-20 bg-white hover:bg-gray-200 hover:scale-105 active:scale-95 transition-all duration-200 border-4 border-gray-400 p-0 shadow-2xl focus:ring-4 focus:ring-primary/50"
                      onClick={capturePhoto}
                      disabled={!cameraActive}
                    >
                      <span className="sr-only">Capture photo</span>
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </motion.div>

            {/* Step 2: Location */}
            <motion.div variants={fadeInUp} initial="initial" animate="animate" className="space-y-4 pt-4 border-t border-border/50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-lg font-semibold tracking-tight">
                  <div className="bg-primary/10 p-2 rounded-full"><MapPin className="h-5 w-5 text-primary" /></div>
                  Step 2 — Location
                </div>
                <Button type="button" variant="outline" size="sm" onClick={fetchLocation} disabled={locLoading} className="gap-2 h-9 rounded-full px-4 hover:bg-primary/5 hover:text-primary transition-colors border-primary/20">
                  {locLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <LocateFixed className="h-4 w-4" />}
                  Auto-detect
                </Button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-muted/20 p-5 rounded-2xl border border-border/50">
                <div className="space-y-2 md:col-span-2">
                  <Label className="text-sm font-medium">Street Address</Label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-3.5 h-5 w-5 text-muted-foreground/70" />
                    <Input className="pl-10 h-12 text-base bg-background transition-shadow focus:shadow-md focus:shadow-primary/10 border-muted-foreground/20 rounded-xl" required value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Enter street address or landmark" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lat" className="text-sm font-medium">Latitude</Label>
                  <Input id="lat" type="number" step="any" value={lat} onChange={(e) => setLat(e.target.value)} placeholder="e.g. 22.7196" className="h-11 bg-background transition-shadow focus:shadow-md focus:shadow-primary/10 border-muted-foreground/20 rounded-xl" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lng" className="text-sm font-medium">Longitude</Label>
                  <Input id="lng" type="number" step="any" value={lng} onChange={(e) => setLng(e.target.value)} placeholder="e.g. 75.8577" className="h-11 bg-background transition-shadow focus:shadow-md focus:shadow-primary/10 border-muted-foreground/20 rounded-xl" />
                </div>
              </div>
            </motion.div>

            {/* Step 3: Details */}
            <motion.div variants={fadeInUp} initial="initial" animate="animate" className="space-y-5 pt-4 border-t border-border/50">
              <div className="flex items-center gap-2 text-lg font-semibold tracking-tight">
                <div className="bg-primary/10 p-2 rounded-full"><Info className="h-5 w-5 text-primary" /></div>
                Step 3 — Details
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-muted/20 p-5 rounded-2xl border border-border/50">
                <div className="space-y-3">
                  <Label className="text-sm font-medium">Category</Label>
                  <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger className="h-11 bg-background border-muted-foreground/20 rounded-xl"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Constants.public.Enums.waste_category.map((c) => (
                        <SelectItem key={c} value={c} className="capitalize">{c.replace("_", " ")}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* <div className="space-y-3">
                  <Label className="text-sm font-medium">Severity Level</Label>
                  <div className="flex flex-wrap gap-2 pt-1">
                    {SEVERITY_PILLS.map((s) => (
                      <motion.button
                        key={s.value}
                        type="button"
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => setSeverity(s.value)}
                        className={`rounded-xl border px-4 py-2 text-sm font-medium transition-all ${severity === s.value ? `${s.color} shadow-md border-transparent` : "border-muted-foreground/20 bg-background text-muted-foreground hover:bg-muted/80"
                          }`}
                      >
                        {s.label}
                      </motion.button>
                    ))}
                  </div>
                </div> */}

                <div className="space-y-3 md:col-span-2">
                  <Label className="text-sm font-medium">Description</Label>
                  <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Please provide any additional details about the waste issue..." rows={4} className="bg-background transition-shadow focus:shadow-md focus:shadow-primary/10 border-muted-foreground/20 rounded-xl resize-none p-3" />
                </div>
              </div>
            </motion.div>

            <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }} className="pt-6">
              <Button type="submit" size="lg" className="w-full text-lg h-14 rounded-2xl shadow-lg hover:shadow-xl transition-all" disabled={uploading}>
                {uploading ? <Loader2 className="mr-2 h-6 w-6 animate-spin" /> : <Upload className="mr-2 h-5 w-5" />}
                {uploading ? "Submitting Report..." : "Submit Report"}
              </Button>
            </motion.div>
          </CardContent>
        </form>
      </Card>
    </AnimatedPage>
  );
};

export default ReportCreate;
