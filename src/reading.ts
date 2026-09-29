// Pure logic: no `obsidian` import, so tests/ can run it under plain Node.

export interface ReadingOptions {
  /** Words per minute for alphabetic scripts. */
  wpm: number;
  /** Characters per minute for Chinese, Japanese and Korean text. */
  cjkPerMinute: number;
  /** Flat time added for every image. 0 leaves images out. */
  secondsPerImage: number;
  /** Count the words inside code blocks. */
  includeCode: boolean;
}

export const DEFAULT_OPTIONS: ReadingOptions = {
  wpm: 230,
  cjkPerMinute: 400,
  secondsPerImage: 0,
  includeCode: false,
};

export interface Counts {
  /** Words in alphabetic scripts. */
  words: number;
  /** Chinese, Japanese and Korean characters. */
  cjk: number;
  images: number;
}

export type DurationStyle = 'short' | 'precise' | 'clock';

const CJK = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/gu;
const WORD = /[\p{L}\p{N}\p{M}]+(?:['’.\-–][\p{L}\p{N}\p{M}]+)*/gu;
const IMAGE_EXT = /\.(png|jpe?g|gif|bmp|svg|webp|avif|heic|tiff?)$/i;

/** Drop the front matter block, if the note starts with one. */
export function stripFrontMatter(text: string): string {
  return text.replace(/^---[ \t]*\r?\n[\s\S]*?\r?\n(?:---|\.\.\.)[ \t]*(?:\r?\n|$)/, '');
}

/**
 * Take the readable text out of a Markdown note: no front matter, comments,
 * math, embedded images (they are counted apart), link targets or markup.
 */
export function readableText(source: string, includeCode = false): { text: string; images: number } {
  let text = stripFrontMatter(source);
  text = text.replace(/%%[\s\S]*?(?:%%|$)/g, ' ').replace(/<!--[\s\S]*?(?:-->|$)/g, ' ');

  // Fenced code, line by line, so an unclosed fence swallows the rest like Obsidian does.
  const kept: string[] = [];
  let fence: string | null = null;
  let fenceLength = 0;
  for (const line of text.split(/\r?\n/)) {
    const m = /^\s{0,3}(`{3,}|~{3,})(.*)$/.exec(line);
    if (fence === null && m) {
      fence = m[1][0];
      fenceLength = m[1].length;
      continue;
    }
    if (fence !== null) {
      if (m && m[1][0] === fence && m[1].length >= fenceLength && m[2].trim() === '') fence = null;
      else if (includeCode) kept.push(line);
      continue;
    }
    kept.push(line);
  }
  text = kept.join('\n');

  text = text.replace(/\$\$[\s\S]*?\$\$/g, ' ').replace(/\$(?!\s)[^$\n]*?(?<!\s)\$/g, ' ');

  let images = 0;
  text = text.replace(/!\[\[([^\]|#]+)[^\]]*\]\]/g, (_m, target: string) => {
    if (IMAGE_EXT.test(target.trim())) images++;
    return ' ';
  });
  text = text.replace(/!\[[^\]]*\]\([^)]*\)/g, () => {
    images++;
    return ' ';
  });

  return {
    text: text
      .replace(/\[\[([^\]|]*)\|([^\]]*)\]\]/g, '$2')
      .replace(/\[\[([^\]#|]*)[^\]]*\]\]/g, '$1')
      .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
      .replace(/\[\^[^\]]*\]/g, ' ')
      .replace(/\[![\w-]+\][+-]?/g, ' ')
      .replace(/<[^>\n]+>/g, ' ')
      .replace(/\bhttps?:\/\/\S+/g, ' ')
      .replace(/^\s*\d+[.)]\s/gm, ' ')
      .replace(/\s\^[\w-]+$/gm, ' '),
    images,
  };
}

export function countText(source: string, includeCode = false): Counts {
  const { text, images } = readableText(source, includeCode);
  const cjk = text.match(CJK)?.length ?? 0;
  const words = text.replace(CJK, ' ').match(WORD)?.length ?? 0;
  return { words, cjk, images };
}

export function readingSeconds(counts: Counts, options: ReadingOptions): number {
  const wpm = Math.max(1, options.wpm);
  const cpm = Math.max(1, options.cjkPerMinute);
  return (counts.words / wpm) * 60 + (counts.cjk / cpm) * 60 + counts.images * Math.max(0, options.secondsPerImage);
}

export function formatDuration(seconds: number, style: DurationStyle = 'short'): string {
  if (!(seconds > 0)) return style === 'clock' ? '0:00' : '0 min';
  if (style === 'clock') {
    const s = Math.round(seconds);
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = String(s % 60).padStart(2, '0');
    return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`;
  }
  if (style === 'precise') {
    const s = Math.round(seconds);
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const parts: string[] = [];
    if (h > 0) parts.push(`${h} h`);
    if (m > 0) parts.push(`${m} min`);
    if (s % 60 > 0 || parts.length === 0) parts.push(`${s % 60} s`);
    return parts.join(' ');
  }
  if (seconds < 30) return '< 1 min';
  const total = Math.round(seconds / 60);
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

/** Whole minutes for a note property: at least 1 for anything readable, 0 for nothing. */
export function propertyMinutes(seconds: number): number {
  if (!(seconds > 0)) return 0;
  return Math.max(1, Math.round(seconds / 60));
}

/** Put a duration into a template such as "{time} read". A template without {time} is used as it is. */
export function fillTemplate(template: string, time: string): string {
  return template.includes('{time}') ? template.split('{time}').join(time) : template;
}

/** Group digits with the reader's separator, for the details. */
export function formatNumber(n: number): string {
  return n.toLocaleString('en-US');
}

/** What Reading Time (`obsidian-reading-time`) keeps in its data.json. */
export interface LegacySettings {
  readingSpeed?: unknown;
  appendText?: unknown;
}

/** The settings of the original, in ours. Anything missing or off is left out. */
export function fromLegacy(legacy: LegacySettings): { wpm?: number; template?: string } {
  const out: { wpm?: number; template?: string } = {};
  if (typeof legacy.readingSpeed === 'number' && legacy.readingSpeed >= 50 && legacy.readingSpeed <= 1500) out.wpm = Math.round(legacy.readingSpeed);
  if (typeof legacy.appendText === 'string') out.template = legacy.appendText.trim() ? `{time} ${legacy.appendText.trim()}` : '{time}';
  return out;
}
