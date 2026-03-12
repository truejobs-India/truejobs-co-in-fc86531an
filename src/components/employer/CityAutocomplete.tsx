import { useState, useRef, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { MapPin, X, Search } from 'lucide-react';
import { searchCities } from '@/data/indianCities';
import { cn } from '@/lib/utils';

interface CityAutocompleteProps {
  value: string;
  onChange: (city: string) => void;
  placeholder?: string;
  error?: string;
  multiple?: boolean;
  selectedCities?: string[];
  onMultiChange?: (cities: string[]) => void;
}

export function CityAutocomplete({
  value,
  onChange,
  placeholder = 'Type city name (min 3 chars)...',
  error,
  multiple = false,
  selectedCities = [],
  onMultiChange,
}: CityAutocompleteProps) {
  const [query, setQuery] = useState(value || '');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!multiple) setQuery(value || '');
  }, [value, multiple]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleInputChange = (val: string) => {
    setQuery(val);
    setHighlightIndex(-1);
    const results = searchCities(val, 3);
    setSuggestions(results);
    setIsOpen(results.length > 0);
    if (!multiple) onChange(val);
  };

  const selectCity = (city: string) => {
    if (multiple) {
      if (!selectedCities.includes(city)) {
        onMultiChange?.([...selectedCities, city]);
      }
      setQuery('');
    } else {
      setQuery(city);
      onChange(city);
    }
    setSuggestions([]);
    setIsOpen(false);
  };

  const removeCity = (city: string) => {
    onMultiChange?.(selectedCities.filter(c => c !== city));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightIndex(prev => Math.min(prev + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightIndex(prev => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter' && highlightIndex >= 0) {
      e.preventDefault();
      selectCity(suggestions[highlightIndex]);
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  return (
    <div ref={wrapperRef} className="relative">
      {/* Multi-select badges */}
      {multiple && selectedCities.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {selectedCities.map(city => (
            <Badge key={city} variant="secondary" className="gap-1 pr-1">
              <MapPin className="h-3 w-3" />
              {city}
              <button
                type="button"
                onClick={() => removeCity(city)}
                className="ml-1 hover:bg-muted rounded-full p-0.5"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          ref={inputRef}
          value={query}
          onChange={e => handleInputChange(e.target.value)}
          onFocus={() => {
            if (suggestions.length > 0) setIsOpen(true);
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className={cn('pl-10', error && 'border-destructive')}
        />
      </div>

      {query.length > 0 && query.length < 3 && (
        <p className="text-xs text-muted-foreground mt-1">Type at least 3 characters to search</p>
      )}

      {isOpen && suggestions.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-popover border rounded-lg shadow-lg max-h-60 overflow-y-auto">
          {suggestions.map((city, idx) => (
            <button
              key={city}
              type="button"
              onClick={() => selectCity(city)}
              className={cn(
                'w-full text-left px-3 py-2.5 text-sm flex items-center gap-2 hover:bg-accent transition-colors',
                highlightIndex === idx && 'bg-accent',
                selectedCities.includes(city) && 'opacity-50 pointer-events-none'
              )}
            >
              <MapPin className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
              {city}
            </button>
          ))}
        </div>
      )}

      {error && <p className="text-sm text-destructive mt-1">{error}</p>}
    </div>
  );
}
