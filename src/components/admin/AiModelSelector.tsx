/**
 * Shared AI Model Selector — reusable across all admin workflows.
 * Reads from the central model registry and supports capability filtering.
 * Persists last-used model per capability to localStorage.
 * Shows non-blocking warnings when target exceeds model's reliable range.
 */
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Info } from 'lucide-react';
import {
  AI_MODELS,
  type AiModelCapability,
  type AiModelDef,
  getModelDef,
  checkModelSuitability,
  getRecommendedModelsForTarget,
  normalizeAiModelValue,
} from '@/lib/aiModels';

/** Get the last-used model for a capability, or return the fallback */
export function getLastUsedModel(
  capability: AiModelCapability,
  fallback: string,
  allowedValues?: readonly string[],
): string {
  const normalizedFallback = normalizeAiModelValue(fallback, fallback);

  try {
    const stored = normalizeAiModelValue(localStorage.getItem(`ai_model_last_${capability}`), normalizedFallback);
    const isAllowed = !allowedValues || allowedValues.includes(stored);
    const isCapable = AI_MODELS.some(m => m.value === stored && m.capabilities.includes(capability));
    if (stored && isAllowed && isCapable) {
      return stored;
    }
  } catch {}

  return normalizedFallback;
}

interface AiModelSelectorProps {
  value: string;
  onValueChange: (value: string) => void;
  /** Only show models with this capability. Defaults to showing text models. */
  capability?: AiModelCapability;
  /** Current word target — shows suitability warnings when set */
  wordTarget?: number;
  /** Custom class for the trigger */
  triggerClassName?: string;
  /** Size variant */
  size?: 'sm' | 'default';
  /** Optional allow-list for flows that support only a subset of models */
  allowedValues?: readonly string[];
}

export function AiModelSelector({
  value,
  onValueChange,
  capability = 'text',
  wordTarget,
  triggerClassName,
  size = 'sm',
  allowedValues,
}: AiModelSelectorProps) {
  const storageKey = `ai_model_last_${capability}`;
  const models = AI_MODELS.filter(
    m => m.capabilities.includes(capability) && (!allowedValues || allowedValues.includes(m.value)),
  );
  const normalizedValue = models.some(m => m.value === value)
    ? value
    : getLastUsedModel(capability, models[0]?.value ?? 'gemini-flash', allowedValues);

  const handleChange = (v: string) => {
    try { localStorage.setItem(storageKey, v); } catch {}
    onValueChange(v);
  };

  const builtIn = models.filter(m => m.source === 'built-in');
  const external = models.filter(m => m.source === 'external-api');

  const h = size === 'sm' ? 'h-8' : 'h-10';
  const textSize = size === 'sm' ? 'text-xs' : 'text-sm';

  const suitability = wordTarget ? checkModelSuitability(normalizedValue, wordTarget) : 'ok';
  const selectedModel = getModelDef(normalizedValue);

  return (
    <div className="space-y-1.5">
      <Select value={normalizedValue} onValueChange={handleChange}>
        <SelectTrigger className={triggerClassName ?? `w-[220px] ${h} ${textSize}`}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {builtIn.map(m => (
            <ModelOption key={m.value} model={m} textSize={textSize} wordTarget={wordTarget} />
          ))}

          {external.length > 0 && builtIn.length > 0 && (
            <div className="px-2 py-1.5 border-t mt-1">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Your API Models
              </span>
            </div>
          )}
          {external.map(m => (
            <ModelOption key={m.value} model={m} textSize={textSize} wordTarget={wordTarget} />
          ))}
        </SelectContent>
      </Select>

      {wordTarget && suitability === 'warn' && selectedModel && (
        <div className="flex items-start gap-1.5 text-[11px] text-amber-600 dark:text-amber-400">
          <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <span>
            {selectedModel.label} may under-generate at {wordTarget} words (reliable up to ~{selectedModel.recommendedMaxWords}).
          </span>
        </div>
      )}

      {wordTarget && suitability === 'avoid' && selectedModel && (
        <div className="flex items-start gap-1.5 text-[11px] text-destructive">
          <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <span>
            {selectedModel.label} is not recommended for {wordTarget}+ words (reliable up to ~{selectedModel.recommendedMaxWords}).
            {(() => {
              const better = getRecommendedModelsForTarget(wordTarget, capability).filter(m => !allowedValues || allowedValues.includes(m.value));
              if (better.length > 0) {
                return ` Try ${better.slice(0, 2).map(m => m.label).join(' or ')}.`;
              }
              return '';
            })()}
          </span>
        </div>
      )}
    </div>
  );
}

function ModelOption({ model, textSize, wordTarget }: { model: AiModelDef; textSize: string; wordTarget?: number }) {
  const suitability = wordTarget ? checkModelSuitability(model.value, wordTarget) : 'ok';

  return (
    <SelectItem value={model.value} className={textSize}>
      <div className="flex items-center gap-2">
        <span className={suitability === 'avoid' ? 'text-muted-foreground' : ''}>
          {model.label}
        </span>
        {model.source === 'external-api' && (
          <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 font-normal border-primary/40 text-primary">
            API
          </Badge>
        )}
        {suitability === 'avoid' && wordTarget && (
          <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 font-normal border-destructive/40 text-destructive">
            ≤{model.recommendedMaxWords}w
          </Badge>
        )}
        {suitability === 'warn' && wordTarget && (
          <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 font-normal border-amber-500/40 text-amber-600">
            ~{model.recommendedMaxWords}w
          </Badge>
        )}
      </div>
    </SelectItem>
  );
}
