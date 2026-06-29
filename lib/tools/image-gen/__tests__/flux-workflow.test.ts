import { describe, it, expect } from 'vitest';
import { buildFluxWorkflow, FLUX_DEFAULTS } from '../flux-workflow';

describe('buildFluxWorkflow', () => {
  it('wires the verified local model filenames by default', () => {
    const wf = buildFluxWorkflow({ prompt: 'a red barn at dawn' });
    expect(wf.unet).toEqual({
      class_type: 'UnetLoaderGGUF',
      inputs: { unet_name: FLUX_DEFAULTS.unetName },
    });
    expect(wf.clip.class_type).toBe('DualCLIPLoader');
    expect(wf.clip.inputs).toMatchObject({
      clip_name1: FLUX_DEFAULTS.clipNameT5,
      clip_name2: FLUX_DEFAULTS.clipNameL,
      type: 'flux',
    });
    expect(wf.vae.inputs).toEqual({ vae_name: FLUX_DEFAULTS.vaeName });
  });

  it('puts the prompt in the positive encode and leaves the negative empty', () => {
    const wf = buildFluxWorkflow({ prompt: 'mountain lake' });
    expect(wf.positive.class_type).toBe('CLIPTextEncode');
    expect(wf.positive.inputs.text).toBe('mountain lake');
    expect(wf.negative.inputs.text).toBe('');
  });

  it('applies seed, steps, dimensions and guidance', () => {
    const wf = buildFluxWorkflow({
      prompt: 'x',
      seed: 42,
      steps: 8,
      width: 768,
      height: 512,
      guidance: 2.5,
    });
    expect(wf.sampler.inputs).toMatchObject({ seed: 42, steps: 8, cfg: 1.0 });
    expect(wf.latent.inputs).toMatchObject({ width: 768, height: 512, batch_size: 1 });
    expect(wf.guidance.inputs.guidance).toBe(2.5);
  });

  it('falls back to defaults for unspecified params', () => {
    const wf = buildFluxWorkflow({ prompt: 'x' });
    expect(wf.sampler.inputs).toMatchObject({ seed: 0, steps: FLUX_DEFAULTS.steps });
    expect(wf.latent.inputs).toMatchObject({
      width: FLUX_DEFAULTS.width,
      height: FLUX_DEFAULTS.height,
    });
  });

  it('connects the graph: sampler -> decode -> save, guidance from positive', () => {
    const wf = buildFluxWorkflow({ prompt: 'x' });
    expect(wf.guidance.inputs.conditioning).toEqual(['positive', 0]);
    expect(wf.sampler.inputs.positive).toEqual(['guidance', 0]);
    expect(wf.sampler.inputs.model).toEqual(['unet', 0]);
    expect(wf.decode.inputs.samples).toEqual(['sampler', 0]);
    expect(wf.decode.inputs.vae).toEqual(['vae', 0]);
    expect(wf.save.inputs.images).toEqual(['decode', 0]);
  });

  it('throws on an empty prompt', () => {
    expect(() => buildFluxWorkflow({ prompt: '   ' })).toThrow(/prompt is required/);
  });
});
