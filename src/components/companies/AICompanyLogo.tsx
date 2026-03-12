import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Building2, Sparkles } from 'lucide-react';

interface AICompanyLogoProps {
  companyName: string;
  existingLogoUrl?: string | null;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

// Generate a consistent color based on company name
function getCompanyColor(name: string): string {
  const colors = [
    'from-blue-500 to-blue-600',
    'from-green-500 to-green-600',
    'from-purple-500 to-purple-600',
    'from-orange-500 to-orange-600',
    'from-pink-500 to-pink-600',
    'from-teal-500 to-teal-600',
    'from-indigo-500 to-indigo-600',
    'from-red-500 to-red-600',
  ];
  
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  return colors[Math.abs(hash) % colors.length];
}

// Get initials from company name
function getInitials(name: string): string {
  const words = name.split(/\s+/).filter(w => w.length > 0);
  if (words.length === 1) {
    return words[0].substring(0, 2).toUpperCase();
  }
  return words.slice(0, 2).map(w => w[0]).join('').toUpperCase();
}

export function AICompanyLogo({ 
  companyName, 
  existingLogoUrl, 
  size = 'md',
  className = '' 
}: AICompanyLogoProps) {
  const [logoUrl, setLogoUrl] = useState<string | null>(existingLogoUrl || null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [hasError, setHasError] = useState(false);

  const sizeClasses = {
    sm: 'h-10 w-10 text-sm',
    md: 'h-16 w-16 text-lg',
    lg: 'h-20 w-20 text-xl',
  };

  // Check cache for generated logo
  useEffect(() => {
    if (existingLogoUrl) {
      setLogoUrl(existingLogoUrl);
      return;
    }

    // Check localStorage cache
    const cached = localStorage.getItem(`company-logo-${companyName}`);
    if (cached) {
      setLogoUrl(cached);
    }
  }, [companyName, existingLogoUrl]);

  // Handle image error
  const handleError = () => {
    setHasError(true);
    setLogoUrl(null);
  };

  // Show existing logo if available
  if (logoUrl && !hasError) {
    return (
      <div className={`${sizeClasses[size]} rounded-lg overflow-hidden shrink-0 ${className}`}>
        <img
          src={logoUrl}
          alt={`${companyName} logo`}
          className="h-full w-full object-contain"
          onError={handleError}
        />
      </div>
    );
  }

  // Generate stylized initials logo
  const initials = getInitials(companyName);
  const gradientColor = getCompanyColor(companyName);

  return (
    <div 
      className={`${sizeClasses[size]} rounded-lg bg-gradient-to-br ${gradientColor} flex items-center justify-center shrink-0 text-white font-bold shadow-sm ${className}`}
    >
      {isGenerating ? (
        <Sparkles className="h-1/2 w-1/2 animate-pulse" />
      ) : (
        <span>{initials}</span>
      )}
    </div>
  );
}
