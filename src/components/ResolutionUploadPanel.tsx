import { useState, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface ResolutionUploadPanelProps {
  reportId: string;
}

export function ResolutionUploadPanel({ reportId }: ResolutionUploadPanelProps) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    setFile(selected);
    setPreview(URL.createObjectURL(selected));
  };

  const mutation = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error('No file selected');
      
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      const formData = new FormData();
      formData.append('resolution_image', file);
      formData.append('officer_notes', notes);

      const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "/api";
      const res = await fetch(`${API_BASE_URL}/municipal/reports/${reportId}/submit-resolution`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`
        },
        body: formData,
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      toast({ title: 'Resolution photo submitted', description: 'AI verification is running...' });
      queryClient.invalidateQueries({ queryKey: ['report', reportId] });
      queryClient.invalidateQueries({ queryKey: ["report-events", reportId] });
    },
    onError: (err: Error) => {
      toast({ title: 'Submission failed', description: err.message, variant: 'destructive' });
    },
  });

  return (
    <div className="rounded-lg border border-border p-4 space-y-3 bg-card">
      <p className="text-sm font-medium">Submit resolution proof</p>
      <p className="text-xs text-muted-foreground">
        Take a photo of the cleaned area. AI will compare it with the original complaint image.
      </p>

      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={() => inputRef.current?.click()}>
          Upload photo
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={handleFileChange}
        />
      </div>

      {preview && (
        <img src={preview} alt="Resolution preview" className="w-full max-h-48 object-cover rounded-md border" />
      )}

      <Textarea
        placeholder="Officer notes (optional)"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        rows={2}
      />

      <Button
        onClick={() => mutation.mutate()}
        disabled={!file || mutation.isPending}
        className="w-full"
      >
        {mutation.isPending ? 'Submitting...' : 'Submit resolution →'}
      </Button>
    </div>
  );
}
