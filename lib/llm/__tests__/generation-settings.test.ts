import { describe, expect, it } from 'vitest';
import { normalizeGenerationSettings } from '../generation-settings';

describe('normalizeGenerationSettings', () => {
  it('clamps chat route generation settings to provider-safe ranges', () => {
    expect(normalizeGenerationSettings({
      temperature: 3,
      maxOutputTokens: 100000,
      topP: -1,
      frequencyPenalty: -9,
      presencePenalty: 9,
    })).toEqual({
      temperature: 2,
      maxOutputTokens: 32768,
      topP: 0.01,
      frequencyPenalty: -2,
      presencePenalty: 2,
    });
  });

  it('floors token counts and ignores non-finite or non-number settings', () => {
    expect(normalizeGenerationSettings({
      temperature: Number.NaN,
      maxOutputTokens: 123.9,
      topP: '0.5',
      frequencyPenalty: Number.POSITIVE_INFINITY,
      presencePenalty: null,
    })).toEqual({
      temperature: undefined,
      maxOutputTokens: 123,
      topP: undefined,
      frequencyPenalty: undefined,
      presencePenalty: undefined,
    });
  });
});
