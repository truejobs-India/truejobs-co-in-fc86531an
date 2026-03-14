import { CheckCircle, AlertTriangle, XCircle, Info, X, ChevronDown, ChevronUp, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { AdminMessage } from '@/hooks/useAdminMessages';

function formatTimestamp(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }) + ', ' + d.toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return iso;
  }
}

const typeConfig = {
  success: {
    icon: CheckCircle,
    border: 'border-l-emerald-500',
    bg: 'bg-emerald-50 dark:bg-emerald-950/30',
    iconColor: 'text-emerald-600',
    emoji: '✅',
  },
  error: {
    icon: XCircle,
    border: 'border-l-red-500',
    bg: 'bg-red-50 dark:bg-red-950/30',
    iconColor: 'text-red-600',
    emoji: '❌',
  },
  warning: {
    icon: AlertTriangle,
    border: 'border-l-amber-500',
    bg: 'bg-amber-50 dark:bg-amber-950/30',
    iconColor: 'text-amber-600',
    emoji: '⚠️',
  },
  info: {
    icon: Info,
    border: 'border-l-blue-500',
    bg: 'bg-blue-50 dark:bg-blue-950/30',
    iconColor: 'text-blue-600',
    emoji: 'ℹ️',
  },
} as const;

interface AdminMessageLogProps {
  messages: AdminMessage[];
  onDismiss: (id: string) => void;
  onClearAll: () => void;
  onToggleExpand: (id: string) => void;
}

export function AdminMessageLog({ messages, onDismiss, onClearAll, onToggleExpand }: AdminMessageLogProps) {
  if (messages.length === 0) return null;

  return (
    <div className="space-y-1.5 mb-4">
      {messages.length >= 3 && (
        <div className="flex justify-end">
          <Button
            variant="ghost"
            size="sm"
            className="text-xs text-muted-foreground hover:text-foreground h-7 gap-1"
            onClick={onClearAll}
          >
            <Trash2 className="h-3 w-3" />
            Clear All Messages
          </Button>
        </div>
      )}
      <div className="space-y-1.5 max-h-[320px] overflow-y-auto">
        {messages.map(msg => {
          const config = typeConfig[msg.type];
          const Icon = config.icon;
          const isLong = msg.description.length > 120;
          const displayDesc = isLong && !msg.expanded
            ? msg.description.slice(0, 120) + '…'
            : msg.description;

          return (
            <div
              key={msg.id}
              className={`flex items-start gap-2.5 p-2.5 rounded-md border border-l-4 ${config.border} ${config.bg} text-sm`}
            >
              <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${config.iconColor}`} />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-foreground leading-tight">{msg.title}</p>
                {msg.description && (
                  <p className="text-muted-foreground text-xs mt-0.5 leading-relaxed whitespace-pre-wrap">
                    {displayDesc}
                  </p>
                )}
                {isLong && (
                  <button
                    onClick={() => onToggleExpand(msg.id)}
                    className="text-xs text-primary hover:underline mt-0.5 inline-flex items-center gap-0.5"
                  >
                    {msg.expanded ? (
                      <>Show less <ChevronUp className="h-3 w-3" /></>
                    ) : (
                      <>Show more <ChevronDown className="h-3 w-3" /></>
                    )}
                  </button>
                )}
                <p className="text-muted-foreground/60 text-[11px] mt-1">{formatTimestamp(msg.timestamp)}</p>
              </div>
              <button
                onClick={() => onDismiss(msg.id)}
                className="text-muted-foreground hover:text-foreground shrink-0 mt-0.5"
                title="Dismiss"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
