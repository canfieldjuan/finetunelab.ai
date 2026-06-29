import { describe, expect, it } from 'vitest';
import { applySnippetRevision, previewSnippetRevision } from '../index';

describe('snippet revision engine', () => {
  it('applies an exact text replacement when the snippet is unique', () => {
    const result = applySnippetRevision(
      'This intro is stiff. This ending stays.',
      {
        mode: 'replace_text',
        find: 'This intro is stiff.',
        replace: 'This intro is plain.',
      },
    );

    expect(result).toEqual({
      ok: true,
      applied: true,
      updatedText: 'This intro is plain. This ending stays.',
      unchanged: false,
      change: {
        mode: 'replace_text',
        start: 0,
        end: 20,
        original: 'This intro is stiff.',
        replacement: 'This intro is plain.',
      },
    });
  });

  it('previews the same replacement without marking it applied', () => {
    const result = previewSnippetRevision(
      'Keep the point. Cut the polish.',
      {
        mode: 'replace_text',
        find: 'Cut the polish.',
        replace: 'Lose the polish.',
      },
    );

    expect(result).toMatchObject({
      ok: true,
      applied: false,
      updatedText: 'Keep the point. Lose the polish.',
      change: {
        start: 16,
        end: 31,
        original: 'Cut the polish.',
        replacement: 'Lose the polish.',
      },
    });
  });

  it('rejects missing text replacement targets', () => {
    const result = applySnippetRevision('Only the current draft is here.', {
      mode: 'replace_text',
      find: 'old stale snippet',
      replace: 'new snippet',
    });

    expect(result).toEqual({
      ok: false,
      applied: false,
      code: 'target_not_found',
      message: 'Search text was not found in the source text.',
    });
  });

  it('rejects ambiguous text replacement targets', () => {
    const result = applySnippetRevision('Repeat this. Repeat this.', {
      mode: 'replace_text',
      find: 'Repeat this.',
      replace: 'Replace this.',
    });

    expect(result).toMatchObject({
      ok: false,
      code: 'target_ambiguous',
    });
  });

  it('treats overlapping text replacement targets as ambiguous', () => {
    const result = applySnippetRevision('aaa', {
      mode: 'replace_text',
      find: 'aa',
      replace: 'b',
    });

    expect(result).toMatchObject({
      ok: false,
      code: 'target_ambiguous',
    });
  });

  it('rejects empty search text', () => {
    const result = applySnippetRevision('Anything', {
      mode: 'replace_text',
      find: '',
      replace: 'Nope',
    });

    expect(result).toMatchObject({
      ok: false,
      code: 'empty_find',
    });
  });

  it('applies a range replacement for UI-selected text', () => {
    const result = applySnippetRevision('Before [selected text] after', {
      mode: 'replace_range',
      start: 7,
      end: 22,
      expectedText: '[selected text]',
      replace: 'replacement',
    });

    expect(result).toEqual({
      ok: true,
      applied: true,
      updatedText: 'Before replacement after',
      unchanged: false,
      change: {
        mode: 'replace_range',
        start: 7,
        end: 22,
        original: '[selected text]',
        replacement: 'replacement',
      },
    });
  });

  it('allows insertion with a zero-length range', () => {
    const result = applySnippetRevision('Before after', {
      mode: 'replace_range',
      start: 7,
      end: 7,
      expectedText: '',
      replace: 'small ',
    });

    expect(result).toMatchObject({
      ok: true,
      updatedText: 'Before small after',
      change: {
        original: '',
        replacement: 'small ',
      },
    });
  });

  it('rejects invalid ranges', () => {
    const result = applySnippetRevision('Short text', {
      mode: 'replace_range',
      start: 8,
      end: 2,
      expectedText: '',
      replace: 'Nope',
    });

    expect(result).toMatchObject({
      ok: false,
      code: 'range_invalid',
    });
  });

  it('rejects out-of-bounds ranges', () => {
    const result = applySnippetRevision('Short text', {
      mode: 'replace_range',
      start: 0,
      end: 99,
      expectedText: 'Short text',
      replace: 'Nope',
    });

    expect(result).toMatchObject({
      ok: false,
      code: 'range_out_of_bounds',
    });
  });

  it('rejects stale range targets when selected text has changed', () => {
    const result = applySnippetRevision('The dog sat.', {
      mode: 'replace_range',
      start: 4,
      end: 7,
      expectedText: 'cat',
      replace: 'fox',
    });

    expect(result).toEqual({
      ok: false,
      applied: false,
      code: 'target_mismatch',
      message: 'Range text no longer matches the originally selected text.',
    });
  });
});
