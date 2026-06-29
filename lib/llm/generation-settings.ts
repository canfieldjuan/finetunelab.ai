export type RawGenerationSettings = {
  temperature?: unknown;
  maxOutputTokens?: unknown;
  topP?: unknown;
  frequencyPenalty?: unknown;
  presencePenalty?: unknown;
};

export type NormalizedGenerationSettings = {
  temperature?: number;
  maxOutputTokens?: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
};

function clampNumber(value: unknown, min: number, max: number): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return undefined;
  }

  return Math.min(max, Math.max(min, value));
}

export function normalizeGenerationSettings(
  settings: RawGenerationSettings | undefined
): NormalizedGenerationSettings {
  const maxOutputTokens = clampNumber(settings?.maxOutputTokens, 64, 32768);

  return {
    temperature: clampNumber(settings?.temperature, 0, 2),
    maxOutputTokens: maxOutputTokens === undefined
      ? undefined
      : Math.floor(maxOutputTokens),
    topP: clampNumber(settings?.topP, 0.01, 1),
    frequencyPenalty: clampNumber(settings?.frequencyPenalty, -2, 2),
    presencePenalty: clampNumber(settings?.presencePenalty, -2, 2),
  };
}
