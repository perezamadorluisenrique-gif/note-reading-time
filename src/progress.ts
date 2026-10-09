// Pure logic for "time left": no `obsidian` import, so tests/ can run it under plain Node.

import { countText, readingSeconds, stripFrontMatter } from './reading.ts';
import type { Counts, ReadingOptions } from './reading.ts';

export interface TimeLeft {
  /** The text from the start line to the end, counted. */
  remaining: Counts;
  remainingSeconds: number;
  totalSeconds: number;
  /** Whole percent of the reading time already behind the reader, 0 to 100. */
  percent: number;
}

/** How many lines the front matter block takes, 0 if the note has none. */
export function frontMatterLines(source: string): number {
  const rest = stripFrontMatter(source);
  if (rest.length === source.length) return 0;
  const removed = source.slice(0, source.length - rest.length);
  return removed.split('\n').length - (removed.endsWith('\n') ? 1 : 0);
}

/** Lines of `source` before `line` (0-based), as text. */
function linesBefore(source: string, line: number): string {
  let index = 0;
  for (let i = 0; i < line; i++) {
    const next = source.indexOf('\n', index);
    if (next === -1) return source;
    index = next + 1;
  }
  return source.slice(0, index);
}

/** Whole percent of the time already read, clamped, 100 for nothing to read. */
export function percentDone(remainingSeconds: number, totalSeconds: number): number {
  if (!(totalSeconds > 0)) return 100;
  const done = 1 - remainingSeconds / totalSeconds;
  return Math.min(100, Math.max(0, Math.round(done * 100)));
}

/**
 * The reading time from `startLine` (0-based, the first visible line) to the
 * end. It is the total minus what lies above the line, counted in context, so
 * a code block, comment or the front matter that spans the line is skipped
 * like it is in the total. A line inside the front matter counts as its end.
 */
export function timeLeft(source: string, startLine: number, options: ReadingOptions, total?: Counts): TimeLeft {
  const full = total ?? countText(source, options.includeCode);
  const line = Number.isFinite(startLine) ? Math.max(0, Math.floor(startLine)) : 0;
  const front = frontMatterLines(source);
  const from = line < front ? front : line;
  const above = from > 0 ? countText(linesBefore(source, from), options.includeCode) : { words: 0, cjk: 0, images: 0 };
  const remaining: Counts = {
    words: Math.max(0, full.words - above.words),
    cjk: Math.max(0, full.cjk - above.cjk),
    images: Math.max(0, full.images - above.images),
  };
  const totalSeconds = readingSeconds(full, options);
  const remainingSeconds = Math.min(totalSeconds, readingSeconds(remaining, options));
  return { remaining, remainingSeconds, totalSeconds, percent: percentDone(remainingSeconds, totalSeconds) };
}

/**
 * The line to measure from, given where the view reports its scroll. A view
 * that gives no line falls back to the scroll position as a share of the
 * note's lines. Returns null when nothing usable is known.
 */
export function scrollLine(reported: unknown, scrollTop: number, scrollRange: number, lineCount: number): number | null {
  if (typeof reported === 'number' && Number.isFinite(reported) && reported >= 0) return reported;
  if (scrollRange > 0 && Number.isFinite(scrollTop) && lineCount > 0) return Math.min(1, Math.max(0, scrollTop / scrollRange)) * lineCount;
  return null;
}

/** Put the time and the percent into a template such as "{time} left · {percent}%". */
export function fillTimeLeft(template: string, time: string, percent: number): string {
  return template.split('{time}').join(time).split('{percent}').join(String(percent));
}
