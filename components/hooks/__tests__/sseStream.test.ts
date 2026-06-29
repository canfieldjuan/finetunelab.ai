import { describe, expect, it } from 'vitest';
import { getSseDataLine, splitSseLines } from '../sseStream';

describe('sseStream helpers', () => {
  it('carries a split SSE data line across chunks', () => {
    const first = splitSseLines('', 'data: {"type":"web_search');

    expect(first.lines).toEqual([]);
    expect(first.buffer).toBe('data: {"type":"web_search');

    const second = splitSseLines(first.buffer, '_results","results":[]}\n\n');

    expect(second.lines).toEqual(['data: {"type":"web_search_results","results":[]}', '']);
    expect(second.buffer).toBe('');
  });

  it('normalizes CRLF data lines before parsing', () => {
    const split = splitSseLines('', 'data: {"content":"hi"}\r\n');

    expect(split.lines).toEqual(['data: {"content":"hi"}']);
    expect(getSseDataLine(split.lines[0])).toBe('{"content":"hi"}');
  });

  it('ignores non-data SSE lines', () => {
    expect(getSseDataLine('event: message')).toBeNull();
    expect(getSseDataLine('')).toBeNull();
  });
});
