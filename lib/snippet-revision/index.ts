export type SnippetRevisionMode = 'replace_text' | 'replace_range';

export type SnippetRevisionErrorCode =
  | 'empty_find'
  | 'target_not_found'
  | 'target_ambiguous'
  | 'target_mismatch'
  | 'range_invalid'
  | 'range_out_of_bounds';

export interface ReplaceTextRevision {
  mode: 'replace_text';
  find: string;
  replace: string;
}

export interface ReplaceRangeRevision {
  mode: 'replace_range';
  start: number;
  end: number;
  expectedText: string;
  replace: string;
}

export type SnippetRevision = ReplaceTextRevision | ReplaceRangeRevision;

export interface SnippetRevisionChange {
  mode: SnippetRevisionMode;
  start: number;
  end: number;
  original: string;
  replacement: string;
}

export interface SnippetRevisionSuccess {
  ok: true;
  applied: boolean;
  updatedText: string;
  change: SnippetRevisionChange;
  unchanged: boolean;
}

export interface SnippetRevisionFailure {
  ok: false;
  applied: false;
  code: SnippetRevisionErrorCode;
  message: string;
}

export type SnippetRevisionResult = SnippetRevisionSuccess | SnippetRevisionFailure;

export function previewSnippetRevision(sourceText: string, revision: SnippetRevision): SnippetRevisionResult {
  return applyRevision(sourceText, revision, false);
}

export function applySnippetRevision(sourceText: string, revision: SnippetRevision): SnippetRevisionResult {
  return applyRevision(sourceText, revision, true);
}

function applyRevision(
  sourceText: string,
  revision: SnippetRevision,
  applied: boolean,
): SnippetRevisionResult {
  if (revision.mode === 'replace_text') {
    return applyTextReplacement(sourceText, revision, applied);
  }

  return applyRangeReplacement(sourceText, revision, applied);
}

function applyTextReplacement(
  sourceText: string,
  revision: ReplaceTextRevision,
  applied: boolean,
): SnippetRevisionResult {
  if (revision.find.length === 0) {
    return failure('empty_find', 'Search text must not be empty.');
  }

  const matches = findAllOccurrences(sourceText, revision.find);
  if (matches.length === 0) {
    return failure('target_not_found', 'Search text was not found in the source text.');
  }

  if (matches.length > 1) {
    return failure('target_ambiguous', 'Search text appears more than once. Use a more specific snippet.');
  }

  const start = matches[0];
  const end = start + revision.find.length;

  return buildSuccess(sourceText, {
    mode: revision.mode,
    start,
    end,
    original: revision.find,
    replacement: revision.replace,
  }, applied);
}

function applyRangeReplacement(
  sourceText: string,
  revision: ReplaceRangeRevision,
  applied: boolean,
): SnippetRevisionResult {
  const { start, end } = revision;

  if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end < start) {
    return failure('range_invalid', 'Range must use zero-based integer offsets with end greater than or equal to start.');
  }

  if (end > sourceText.length) {
    return failure('range_out_of_bounds', 'Range extends beyond the source text length.');
  }

  const original = sourceText.slice(start, end);
  if (original !== revision.expectedText) {
    return failure('target_mismatch', 'Range text no longer matches the originally selected text.');
  }

  return buildSuccess(sourceText, {
    mode: revision.mode,
    start,
    end,
    original,
    replacement: revision.replace,
  }, applied);
}

function buildSuccess(
  sourceText: string,
  change: SnippetRevisionChange,
  applied: boolean,
): SnippetRevisionSuccess {
  const updatedText = [
    sourceText.slice(0, change.start),
    change.replacement,
    sourceText.slice(change.end),
  ].join('');

  return {
    ok: true,
    applied,
    updatedText,
    change,
    unchanged: updatedText === sourceText,
  };
}

function findAllOccurrences(sourceText: string, find: string): number[] {
  const matches: number[] = [];
  let index = sourceText.indexOf(find);

  while (index !== -1) {
    matches.push(index);
    index = sourceText.indexOf(find, index + 1);
  }

  return matches;
}

function failure(code: SnippetRevisionErrorCode, message: string): SnippetRevisionFailure {
  return {
    ok: false,
    applied: false,
    code,
    message,
  };
}
