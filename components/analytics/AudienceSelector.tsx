'use client';

import { Label } from '@/components/ui/label';
import { Users, Code, GraduationCap, Settings } from 'lucide-react';
import type { AudienceType } from './types';
import { AUDIENCE_LABELS, AUDIENCE_DESCRIPTIONS } from './types';

export interface AudienceSelectorProps {
  selectedAudience: AudienceType;
  onChange: (audience: AudienceType) => void;
  disabled?: boolean;
}

export function AudienceSelector({
  selectedAudience,
  onChange,
  disabled = false,
}: AudienceSelectorProps) {
  console.log('[AudienceSelector] Rendered', { selectedAudience });

  const audiences: AudienceType[] = ['executive', 'engineering', 'onboarding', 'custom'];

  const getIcon = (audience: AudienceType) => {
    const className = "h-4 w-4";
    switch (audience) {
      case 'executive':
        return <Users className={className} />;
      case 'engineering':
        return <Code className={className} />;
      case 'onboarding':
        return <GraduationCap className={className} />;
      case 'custom':
        return <Settings className={className} />;
    }
  };

  return (
    <div className="space-y-2">
      <Label>Report Template</Label>
      <div className="grid gap-2">
        {audiences.map((audience) => (
          <button
            key={audience}
            type="button"
            onClick={() => onChange(audience)}
            disabled={disabled}
            className={`flex items-start gap-3 rounded-lg border p-3 text-left transition-colors ${
              selectedAudience === audience
                ? 'border-primary bg-primary/5'
                : 'border-border hover:border-primary/50'
            } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <div className="mt-0.5">{getIcon(audience)}</div>
            <div className="flex-1">
              <div className="font-medium">{AUDIENCE_LABELS[audience]}</div>
              <div className="text-sm text-muted-foreground">
                {AUDIENCE_DESCRIPTIONS[audience]}
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
