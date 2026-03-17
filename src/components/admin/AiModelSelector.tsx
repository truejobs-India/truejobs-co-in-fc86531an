/**
 * Shared AI Model Selector — reusable across all admin workflows.
 * Reads from the central model registry and supports capability filtering.
 * Persists last-used model per capability to localStorage.
 */
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { AI_MODELS, type AiModelCapability, type AiModelDef } from '@/lib/aiModels';

/** Get the last-used model for a capability, or return the fallback */
export function getLastUsedModel(capability: AiModelCapability, fallback: string): string {
  try {
    const stored = localStorage.getItem(`ai_model_last_${capability}`);
    if (stored && AI_MODELS.some(m => m.value === stored && m.capabilities.includes(capability))) {
      return stored;
    }
  } catch {}
  return fallback;
}

interface AiModelSelectorProps {
  value: string;
  onValueChange: (value: string) => void;
  /** Only show models with this capability. Defaults to showing text models. */
  capability?: AiModelCapability;
  /** Custom class for the trigger */
  triggerClassName?: string;
  /** Size variant */
  size?: 'sm' | 'default';
}

export function AiModelSelector({
  value,
  onValueChange,
  capability = 'text',
  triggerClassName,
  size = 'sm',
}: AiModelSelectorProps) {
  const storageKey = `ai_model_last_${capability}`;

  // On mount, if parent has no value or default, suggest last used
  const models = AI_MODELS.filter(m => m.capabilities.includes(capability));

  const handleChange = (v: string) => {
    try { localStorage.setItem(storageKey, v); } catch {}
    onValueChange(v);
  };

  // Group: built-in first, then external
  const builtIn = models.filter(m => m.source === 'built-in');
  const external = models.filter(m => m.source === 'external-api');

  const h = size === 'sm' ? 'h-8' : 'h-10';
  const textSize = size === 'sm' ? 'text-xs' : 'text-sm';

  return (
    <Select value={value} onValueChange={handleChange}>
      <SelectTrigger className={triggerClassName ?? `w-[220px] ${h} ${textSize}`}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {/* Built-in models */}
        {builtIn.map(m => (
          <ModelOption key={m.value} model={m} textSize={textSize} />
        ))}

        {/* External API models — visual separator */}
        {external.length > 0 && builtIn.length > 0 && (
          <div className="px-2 py-1.5 border-t mt-1">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Your API Models
            </span>
          </div>
        )}
        {external.map(m => (
          <ModelOption key={m.value} model={m} textSize={textSize} />
        ))}
      </SelectContent>
    </Select>
  );
}

function ModelOption({ model, textSize }: { model: AiModelDef; textSize: string }) {
  return (
    <SelectItem value={model.value} className={textSize}>
      <div className="flex items-center gap-2">
        <span>{model.label}</span>
        {model.source === 'external-api' && (
          <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 font-normal border-primary/40 text-primary">
            API
          </Badge>
        )}
      </div>
    </SelectItem>
  );
}
