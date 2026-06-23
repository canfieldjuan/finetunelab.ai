import { describe, it, expect } from 'vitest';
import {
  calculateCost,
  matchModelToPricing,
  inferProviderFromModel,
  MODEL_PRICING,
} from '../pricing-config';

describe('calculateCost cache-read accounting', () => {
  const gpt4o = MODEL_PRICING['gpt-4o'];

  it('does not double-charge OpenAI cached tokens (prompt_tokens includes cache)', () => {
    // OpenAI reports input_tokens INCLUDING the cached subset. 150 input of which 50 cached
    // => 100 charged at the full input rate, 50 charged at the cached rate.
    const cost = calculateCost('gpt-4o', 150, 0, undefined, 50, 'openai');
    const expected =
      (100 / 1_000_000) * gpt4o.inputPricePer1M +
      (50 / 1_000_000) * (gpt4o.cachedInputPricePer1M as number);
    expect(cost).toBeCloseTo(expected, 9);
  });

  it('uses the explicit per-model cached price when present', () => {
    // gpt-4o cached price is explicitly 1.25/1M (== 0.5x of the 2.50 input rate).
    const cost = calculateCost('gpt-4o', 0, 0, undefined, 1_000_000, 'openai');
    expect(cost).toBeCloseTo(gpt4o.cachedInputPricePer1M as number, 6);
  });

  it('does NOT subtract cache tokens for Anthropic (input_tokens already excludes cache)', () => {
    // Anthropic reports input_tokens EXCLUDING cache reads, so 100 input stays at full rate
    // and the 50 cache-read tokens are billed at the 0.1x discount on top.
    const sonnet = MODEL_PRICING['claude-3-5-sonnet-20241022'];
    const cost = calculateCost('claude-3-5-sonnet-20241022', 100, 0, undefined, 50, 'anthropic');
    const expected =
      (100 / 1_000_000) * sonnet.inputPricePer1M +
      (50 / 1_000_000) * sonnet.inputPricePer1M * 0.1;
    expect(cost).toBeCloseTo(expected, 9);
  });

  it('honors an explicit provider hint over the pricing key for the cache rate', () => {
    // _default has no explicit cached price; provider='openai' forces the 0.5x multiplier.
    const rate = MODEL_PRICING['_default'].inputPricePer1M;
    const cost = calculateCost('_default', 0, 0, undefined, 1_000_000, 'openai');
    expect(cost).toBeCloseTo(rate * 0.5, 6);
  });

  it('clamps full-rate input to zero when cached >= input (OpenAI)', () => {
    const cost = calculateCost('gpt-4o', 40, 0, undefined, 50, 'openai');
    // full-rate input clamps to 0; only the 50 cached tokens are charged.
    const expected = (50 / 1_000_000) * (gpt4o.cachedInputPricePer1M as number);
    expect(cost).toBeCloseTo(expected, 9);
  });
});

describe('matchModelToPricing', () => {
  it.each([
    ['gpt-4.1', 'gpt-4.1'],
    ['gpt-4.1-2025-04-14', 'gpt-4.1'],
    ['gpt-4.1-mini-2025-04-14', 'gpt-4.1-mini'],
    ['gpt-4.1-nano', 'gpt-4.1-nano'],
    ['gpt-4o', 'gpt-4o'],
    ['ft:gpt-4o-mini:org:custom:abc', 'gpt-4o-mini'],
    ['claude-3-5-sonnet-20241022', 'claude-3-5-sonnet-20241022'],
  ])('%s -> %s', (input, expectedKey) => {
    expect(matchModelToPricing(input)).toBe(expectedKey);
  });

  it.each(['gpt-5', 'gpt-5-mini', 'o3-mini', 'o1'])(
    'falls back to _default for not-yet-priced family %s (no silent gpt-4o aliasing)',
    input => {
      expect(matchModelToPricing(input)).toBe('_default');
    }
  );
});

describe('inferProviderFromModel', () => {
  it.each(['gpt-4o', 'gpt-5', 'gpt-4.1-mini', 'o3-mini', 'chatgpt-4o-latest', 'ft:gpt-4o-mini:o:c:1'])(
    'classifies %s as openai',
    id => {
      expect(inferProviderFromModel(id)).toBe('openai');
    }
  );

  it.each(['claude-3-5-sonnet-20241022', 'claude-3-haiku-20240307'])(
    'classifies %s as anthropic',
    id => {
      expect(inferProviderFromModel(id)).toBe('anthropic');
    }
  );

  it('returns undefined for unknown providers', () => {
    expect(inferProviderFromModel('llama-3-70b')).toBeUndefined();
  });
});
