import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface ManualVerifyPanelProps {
  reportId: string;
  beforeImageUrl: string;
  afterImageUrl: string;
  aiReasoning?: string | null;
  aiConfidence?: number | null;
}

export function ManualVerifyPanel({ reportId, beforeImageUrl, afterImageUrl, aiReasoning, aiConfidence }: ManualVerifyPanelProps) {
  const [notes, setNotes] = useState('');
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (decision: 'confirmed' | 'failed') => {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      
      const res = await fetch(`/api/admin/reports/${reportId}/manual-verify`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ decision, admin_notes: notes }),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['report', reportId] });
      queryClient.invalidateQueries({ queryKey: ['report-events', reportId] });
    }
  });

  const handleMutate = (decision: 'confirmed' | 'failed') => () => mutation.mutate(decision);

  return (
    <div className="rounded-lg border-2 border-amber-400 p-4 space-y-3 bg-amber-50 dark:bg-amber-950/20">
      <p className="text-sm font-medium">Manual verification required</p>
      {aiConfidence !== undefined && aiConfidence !== null && (
        <p className="text-xs text-muted-foreground">
          AI confidence was too low ({Math.round(aiConfidence * 100)}%) to auto-decide.
          {aiReasoning && ` AI reasoning: "${aiReasoning}"`}
        </p>
      )}
      <div className="grid grid-cols-2 gap-2">
        <img src={beforeImageUrl} alt="Before" className="rounded border aspect-video object-cover" />
        <img src={afterImageUrl} alt="After" className="rounded border aspect-video object-cover" />
      </div>
      <Textarea
        placeholder="Admin notes (required)"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        rows={2}
      />
      <div className="flex gap-2">
        <Button
          variant="default"
          onClick={handleMutate('confirmed')}
          disabled={!notes || mutation.isPending}
          className="flex-1"
        >
          Approve — mint token
        </Button>
        <Button
          variant="destructive"
          onClick={handleMutate('failed')}
          disabled={!notes || mutation.isPending}
          className="flex-1"
        >
          Reject — re-open
        </Button>
      </div>
    </div>
  );
}
