import { Badge } from '@/components/ui/badge';

interface BeforeAfterPanelProps {
  beforeImageUrl: string;
  afterImageUrl: string;
  reportedAt: string;
  resolvedAt?: string | null;
  verificationStatus?: string | null;
  verificationScore?: number | null;
  verificationReasoning?: string | null;
  tokenAmount?: number | null;
}

const statusConfig = {
  confirmed: { label: 'AI verified — area is clean', variant: 'default' as const, icon: '✓' },
  failed: { label: 'Verification failed — re-opened', variant: 'destructive' as const, icon: '✗' },
  manual_review: { label: 'Flagged for manual review', variant: 'secondary' as const, icon: '👁' },
  pending: { label: 'AI verification in progress...', variant: 'outline' as const, icon: '⏳' },
};

export function BeforeAfterPanel({
  beforeImageUrl,
  afterImageUrl,
  reportedAt,
  resolvedAt,
  verificationStatus,
  verificationScore,
  verificationReasoning,
  tokenAmount,
}: BeforeAfterPanelProps) {
  const config = verificationStatus ? statusConfig[verificationStatus as keyof typeof statusConfig] : null;

  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <div className="grid grid-cols-2 divide-x divide-border">
        <div className="p-3 space-y-1">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Before</p>
          <img src={beforeImageUrl} alt="Waste complaint" className="w-full aspect-video object-cover rounded" />
          <p className="text-xs text-muted-foreground">Reported: {new Date(reportedAt).toLocaleString()}</p>
        </div>
        <div className="p-3 space-y-1">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">After</p>
          <img src={afterImageUrl} alt="Resolution proof" className="w-full aspect-video object-cover rounded" />
          {resolvedAt && (
            <p className="text-xs text-muted-foreground">Submitted: {new Date(resolvedAt).toLocaleString()}</p>
          )}
        </div>
      </div>

      {config && (
        <div className="border-t border-border p-3 space-y-1 bg-muted/30">
          <div className="flex items-center gap-2">
            <span className="text-sm">{config.icon}</span>
            <Badge variant={config.variant}>{config.label}</Badge>
            {verificationScore !== undefined && verificationScore !== null && (
              <span className="text-xs text-muted-foreground ml-auto">
                {Math.round(verificationScore * 100)}% confidence
              </span>
            )}
          </div>
          {verificationReasoning && (
            <p className="text-xs text-muted-foreground">{verificationReasoning}</p>
          )}
          {verificationStatus === 'confirmed' && tokenAmount != null && (
            <p className="text-xs font-medium text-green-600 dark:text-green-400">
              🪙 {tokenAmount} Green Tokens credited to your account
            </p>
          )}
        </div>
      )}
    </div>
  );
}
