import { describe, it, expect } from 'vitest';
import { calculateCost, matchModelToPricing, MODEL_PRICING } from '../pricing-config';

describe('pricing-config cache-read discounting', () => {
  const gptInputRate = MODEL_PRICING['gpt-4o'].inputPricePer1M;

  it('applies the OpenAI 0.5x cache-read discount for gpt* keys', () => {
    const cacheReadTokens = 1_000_000;
    const cost = calculateCost('gpt-4o', 0, 0, undefined, cacheReadTokens);
    expect(cost).toBeCloseTo(gptInputRate * 0.5, 6);
  });

  it('applies the Anthropic 0.1x cache-read discount for claude keys', () => {
    const cacheReadTokens = 1_000_000;
    const rate = MODEL_PRICING['claude-3-5-sonnet-20241022'].inputPricePer1M;
    const cost = calculateCost('claude-3-5-sonnet-20241022', 0, 0, undefined, cacheReadTokens);
    expect(cost).toBeCloseTo(rate * 0.1, 6);
  });

  it('honors an explicit provider hint over the pricing key', () => {
    // _default key would otherwise be treated as non-OpenAI (0.1x); provider='openai' forces 0.5x.
    const cost = calculateCost('_default', 0, 0, undefined, 1_000_000, 'openai');
    const rate = MODEL_PRICING['_default'].inputPricePer1M;
    expect(cost).toBeCloseTo(rate * 0.5, 6);
  });

  it('does not double-charge: input + cache-read are separate buckets', () => {
    // 100 non-cached input tokens + 50 cache-read tokens
    const cost = calculateCost('gpt-4o', 100, 0, undefined, 50);
    const expected = (100 / 1_000_000) * gptInputRate + (50 / 1_000_000) * gptInputRate * 0.5;
    expect(cost).toBeCloseTo(expected, 9);
  });
});

describe('matchModelToPricing maps newer OpenAI families to OpenAI keys', () => {
  it.each([
    ['gpt-5', 'gpt-4o'],
    ['gpt-5-mini', 'gpt-4o-mini'],
    ['gpt-4.1-mini-2025-04-14', 'gpt-4o-mini'],
    ['gpt-4.1', 'gpt-4o'],
    ['o3-mini', 'gpt-4o-mini'],
    ['ft:gpt-4o-mini:org:custom:abc', 'gpt-4o-mini'],
  ])('%s -> %s (an OpenAI key, so 0.5x discount applies)', (input, expectedKey) => {
    const key = matchModelToPricing(input);
    expect(key).toBe(expectedKey);
    expect(key.startsWith('gpt')).toBe(true);
  });

  it('still maps Claude models to Claude keys', () => {
    expect(matchModelToPricing('claude-3-5-sonnet-20241022')).toBe('claude-3-5-sonnet-20241022');
  });
});
