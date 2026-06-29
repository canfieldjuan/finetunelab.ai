export function splitSseLines(buffer: string, chunk: string): { lines: string[]; buffer: string } {
  const combined = buffer + chunk;
  const parts = combined.split('\n');
  const nextBuffer = parts.pop() ?? '';

  return {
    lines: parts.map((line) => line.endsWith('\r') ? line.slice(0, -1) : line),
    buffer: nextBuffer,
  };
}

export function getSseDataLine(line: string): string | null {
  if (line.startsWith('data: ')) {
    return line.slice(6);
  }

  if (line.startsWith('data:')) {
    return line.slice(5);
  }

  return null;
}
