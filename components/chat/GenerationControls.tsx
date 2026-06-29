"use client";

import React from 'react';
import { SlidersHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Slider } from '@/components/ui/slider';
import type { GenerationSettings } from './types';

interface GenerationControlsProps {
  settings: GenerationSettings;
  modelName?: string;
  contextLength?: number;
  disabled?: boolean;
  onChange: (settings: GenerationSettings) => void;
  onReset: () => void;
}

function clampNumber(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

export function GenerationControls({
  settings,
  modelName,
  contextLength,
  disabled,
  onChange,
  onReset,
}: GenerationControlsProps) {
  const maxTokenLimit = Math.max(512, Math.min(contextLength || 32768, 32768));

  const updateTemperature = (value: number) => {
    onChange({
      ...settings,
      temperature: Number(clampNumber(value, 0, 2).toFixed(2)),
    });
  };

  const updateMaxOutputTokens = (value: number) => {
    onChange({
      ...settings,
      maxOutputTokens: Math.round(clampNumber(value, 64, maxTokenLimit)),
    });
  };

  const updateTopP = (value: number) => {
    onChange({
      ...settings,
      topP: Number(clampNumber(value, 0.01, 1).toFixed(2)),
    });
  };

  const updateFrequencyPenalty = (value: number) => {
    onChange({
      ...settings,
      frequencyPenalty: Number(clampNumber(value, -2, 2).toFixed(2)),
    });
  };

  const updatePresencePenalty = (value: number) => {
    onChange({
      ...settings,
      presencePenalty: Number(clampNumber(value, -2, 2).toFixed(2)),
    });
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          disabled={disabled}
          title="Generation controls"
          aria-label="Generation controls"
        >
          <SlidersHorizontal className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80">
        <div className="space-y-4">
          <div className="space-y-1">
            <h3 className="text-sm font-medium">Generation Controls</h3>
            <p className="text-xs text-muted-foreground">
              {modelName || 'Selected model'}
            </p>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="chat-temperature" className="text-xs">
                Temperature
              </Label>
              <span className="text-xs text-muted-foreground">
                {settings.temperature.toFixed(2)}
              </span>
            </div>
            <Slider
              id="chat-temperature"
              min={0}
              max={2}
              step={0.05}
              value={[settings.temperature]}
              onValueChange={(value) => updateTemperature(value[0])}
            />
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="chat-top-p" className="text-xs">
                Top P
              </Label>
              <span className="text-xs text-muted-foreground">
                {settings.topP.toFixed(2)}
              </span>
            </div>
            <Slider
              id="chat-top-p"
              min={0.01}
              max={1}
              step={0.01}
              value={[settings.topP]}
              onValueChange={(value) => updateTopP(value[0])}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="chat-frequency-penalty" className="text-xs">
                Frequency penalty
              </Label>
              <Input
                id="chat-frequency-penalty"
                type="number"
                min={-2}
                max={2}
                step={0.1}
                value={settings.frequencyPenalty}
                onChange={(event) => updateFrequencyPenalty(Number(event.target.value))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="chat-presence-penalty" className="text-xs">
                Presence penalty
              </Label>
              <Input
                id="chat-presence-penalty"
                type="number"
                min={-2}
                max={2}
                step={0.1}
                value={settings.presencePenalty}
                onChange={(event) => updatePresencePenalty(Number(event.target.value))}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="chat-max-output" className="text-xs">
              Max output tokens
            </Label>
            <Input
              id="chat-max-output"
              type="number"
              min={64}
              max={maxTokenLimit}
              step={64}
              value={settings.maxOutputTokens}
              onChange={(event) => updateMaxOutputTokens(Number(event.target.value))}
            />
            <p className="text-xs text-muted-foreground">
              Input limit: {maxTokenLimit.toLocaleString()}. Final output may be lowered for the model cap and remaining context.
            </p>
          </div>

          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={onReset}>
              Reset
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
