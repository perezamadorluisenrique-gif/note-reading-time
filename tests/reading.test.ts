import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DEFAULT_OPTIONS,
  countText,
  formatDuration,
  fillTemplate,
  fromLegacy,
  propertyMinutes,
  readingSeconds,
  readableText,
  stripFrontMatter,
} from '../src/reading.ts';

const words = (s: string, code = false) => countText(s, code).words;

test('counts plain words, hyphenated words and numbers as one each', () => {
  assert.equal(words('The quick brown fox'), 4);
  assert.equal(words('a well-known e.g. 3.14 fact, isn’t it'), 7);
  assert.equal(words(''), 0);
  assert.equal(words('   \n\n '), 0);
});

test('counts accented and non-Latin alphabets', () => {
  assert.equal(words('Ça va très bien, señor'), 5);
  assert.equal(words('Привет мир, как дела'), 4);
});

test('front matter is not read', () => {
  assert.equal(words('---\ntitle: A long title here\ntags: [a, b]\n---\nOne two'), 2);
  assert.equal(stripFrontMatter('no front matter\n---\nnot a block'), 'no front matter\n---\nnot a block');
  assert.equal(words('---\nunterminated: yes\nstill words'), 4);
});

test('link targets, url and markup do not count, link text does', () => {
  assert.equal(words('See [the docs](https://example.com/very/long/path) now'), 4);
  assert.equal(words('Go to [[Some Note|the alias]] and [[Other#Heading]]'), 6);
  assert.equal(words('**bold** _it_ ~~gone~~ ==hi== `code`'), 5);
  assert.equal(words('Visit https://example.com/a/b today'), 2);
  assert.equal(words('text[^1] more\n\n[^1]: footnote words'), 4);
});

test('list markers, callout headers, block ids and html do not count', () => {
  assert.equal(words('1. first\n2. second\n- third'), 3);
  assert.equal(words('> [!note] Title here\n> body'), 3);
  assert.equal(words('A paragraph. ^abc123'), 2);
  assert.equal(words('<div class="x">inside</div>'), 1);
});

test('comments and math are skipped', () => {
  assert.equal(words('keep %%hidden words%% this <!-- and this --> too'), 3);
  assert.equal(words('before\n%%\nmulti\nline\n%%\nafter'), 2);
  assert.equal(words('inline $x^2 + y$ math'), 2);
  assert.equal(words('block\n$$\nE = mc^2\n$$\nend'), 2);
  assert.equal(words('It costs $5 and then $6 more'), 7);
});

test('code blocks are skipped unless asked for', () => {
  const note = 'intro\n```js\nconst a = 1;\nreturn a;\n```\noutro';
  assert.equal(words(note), 2);
  assert.ok(words(note, true) > 2);
  assert.equal(words('before\n~~~\ncode\nnever closed'), 1);
  assert.equal(words('a\n````\n```\ninner\n```\n````\nb'), 2);
});

test('images are counted apart from words', () => {
  const c = countText('![[photo.png]] and ![alt text](pics/a.jpg) and ![[Other note]] and ![[diagram.SVG|300]]');
  assert.equal(c.images, 3);
  assert.equal(c.words, 3);
  assert.equal(readableText('![[Other note]]').images, 0);
});

test('Chinese, Japanese and Korean count by characters', () => {
  const c = countText('今日は天気がいいです。Hello world 한국어');
  assert.equal(c.words, 2);
  assert.ok(c.cjk >= 13);
  assert.equal(countText('你好，世界').cjk, 4);
});

test('reading time follows the settings', () => {
  const c = { words: 460, cjk: 0, images: 0 };
  assert.equal(readingSeconds(c, { ...DEFAULT_OPTIONS, wpm: 230 }), 120);
  assert.equal(readingSeconds(c, { ...DEFAULT_OPTIONS, wpm: 460 }), 60);
  assert.equal(readingSeconds({ words: 0, cjk: 800, images: 0 }, { ...DEFAULT_OPTIONS, cjkPerMinute: 400 }), 120);
  assert.equal(readingSeconds({ words: 0, cjk: 0, images: 3 }, { ...DEFAULT_OPTIONS, secondsPerImage: 10 }), 30);
  assert.equal(readingSeconds({ words: 100, cjk: 0, images: 3 }, DEFAULT_OPTIONS) > 0, true);
  assert.ok(Number.isFinite(readingSeconds(c, { ...DEFAULT_OPTIONS, wpm: 0 })));
});

test('short duration rounds to minutes and switches to hours', () => {
  assert.equal(formatDuration(0), '0 min');
  assert.equal(formatDuration(10), '< 1 min');
  assert.equal(formatDuration(29), '< 1 min');
  assert.equal(formatDuration(30), '1 min');
  assert.equal(formatDuration(150), '3 min');
  assert.equal(formatDuration(3600), '1 h');
  assert.equal(formatDuration(3900), '1 h 5 min');
});

test('precise and clock durations', () => {
  assert.equal(formatDuration(0, 'precise'), '0 min');
  assert.equal(formatDuration(45, 'precise'), '45 s');
  assert.equal(formatDuration(330, 'precise'), '5 min 30 s');
  assert.equal(formatDuration(3600, 'precise'), '1 h');
  assert.equal(formatDuration(3725, 'precise'), '1 h 2 min 5 s');
  assert.equal(formatDuration(330, 'clock'), '5:30');
  assert.equal(formatDuration(5, 'clock'), '0:05');
  assert.equal(formatDuration(3725, 'clock'), '1:02:05');
  assert.equal(formatDuration(0, 'clock'), '0:00');
});

test('property minutes are at least one for anything readable', () => {
  assert.equal(propertyMinutes(0), 0);
  assert.equal(propertyMinutes(5), 1);
  assert.equal(propertyMinutes(149), 2);
});

test('templates', () => {
  assert.equal(fillTemplate('{time} read', '5 min'), '5 min read');
  assert.equal(fillTemplate('~{time} / {time}', '5 min'), '~5 min / 5 min');
  assert.equal(fillTemplate('Reading', '5 min'), 'Reading');
});

test('imports the original plugin settings, ignoring nonsense', () => {
  assert.deepEqual(fromLegacy({ readingSpeed: 250, appendText: 'read' }), { wpm: 250, template: '{time} read' });
  assert.deepEqual(fromLegacy({ readingSpeed: 250, appendText: '' }), { wpm: 250, template: '{time}' });
  assert.deepEqual(fromLegacy({ readingSpeed: 'fast', appendText: 3 }), {});
  assert.deepEqual(fromLegacy({ readingSpeed: 99999 }), {});
});
