import { test } from 'node:test';
import assert from 'node:assert/strict';

import { fillTimeLeft, frontMatterLines, percentDone, scrollLine, timeLeft } from '../src/progress.ts';
import { DEFAULT_OPTIONS } from '../src/reading.ts';

const opts = { ...DEFAULT_OPTIONS, wpm: 60 };
const para = (n: number, w = 'word') => Array.from({ length: n }, () => w).join(' ');
// 10 lines of 6 words: 60 words, 60 seconds at 60 wpm... 6 words = 6 s per line.
const body = Array.from({ length: 10 }, () => para(6)).join('\n');

test('frontMatterLines counts the block, 0 without one', () => {
  assert.equal(frontMatterLines('---\na: 1\n---\ntext'), 3);
  assert.equal(frontMatterLines('---\na: 1\n---'), 3);
  assert.equal(frontMatterLines('text\n---\na\n---'), 0);
  assert.equal(frontMatterLines(''), 0);
});

test('from the top, everything is left', () => {
  const t = timeLeft(body, 0, opts);
  assert.equal(t.remainingSeconds, 60);
  assert.equal(t.totalSeconds, 60);
  assert.equal(t.percent, 0);
});

test('halfway down, half is left', () => {
  const t = timeLeft(body, 5, opts);
  assert.equal(t.remainingSeconds, 30);
  assert.equal(t.percent, 50);
});

test('past the end, nothing is left and it is 100 percent', () => {
  const t = timeLeft(body, 500, opts);
  assert.equal(t.remainingSeconds, 0);
  assert.equal(t.percent, 100);
});

test('a fractional or bad line is tolerated', () => {
  assert.equal(timeLeft(body, 2.9, opts).remainingSeconds, 48);
  assert.equal(timeLeft(body, -3, opts).remainingSeconds, 60);
  assert.equal(timeLeft(body, NaN, opts).remainingSeconds, 60);
});

test('front matter is never counted, and a line inside it counts as its end', () => {
  const src = `---\ntitle: a b c d e f g\n---\n${body}`;
  assert.equal(timeLeft(src, 0, opts).totalSeconds, 60);
  assert.equal(timeLeft(src, 1, opts).remainingSeconds, 60);
  assert.equal(timeLeft(src, 3 + 5, opts).remainingSeconds, 30);
});

test('a code block that spans the line is skipped like in the total', () => {
  const src = `${para(6)}\n\`\`\`\n${para(100)}\n${para(100)}\n\`\`\`\n${para(6)}`;
  assert.equal(timeLeft(src, 0, opts).totalSeconds, 12);
  assert.equal(timeLeft(src, 3, opts).remainingSeconds, 6);
  const withCode = timeLeft(src, 3, { ...opts, includeCode: true });
  assert.equal(withCode.totalSeconds, 212);
  assert.equal(withCode.remainingSeconds, 106);
});

test('a comment that spans the line does not push the time below zero', () => {
  const src = `${para(6)}\n%%\n${para(50)}\n${para(50)}\n%%\n${para(6)}`;
  for (let line = 0; line < 8; line++) {
    const t = timeLeft(src, line, opts);
    assert.ok(t.remainingSeconds >= 0 && t.remainingSeconds <= t.totalSeconds);
    assert.ok(t.percent >= 0 && t.percent <= 100);
  }
});

test('time left never grows as the reader goes down', () => {
  const src = `# Title\n\n${para(30)}\n\n- ${para(4)}\n- ${para(4)}\n\n![[pic.png]]\n\n${para(40)}\n`;
  let last = Infinity;
  for (let line = 0; line < 14; line++) {
    const t = timeLeft(src, line, { ...opts, secondsPerImage: 5 });
    assert.ok(t.remainingSeconds <= last);
    last = t.remainingSeconds;
  }
});

test('images count in the remainder', () => {
  const src = `${para(6)}\n![[a.png]]\n![[b.png]]`;
  const t = timeLeft(src, 1, { ...opts, secondsPerImage: 10 });
  assert.equal(t.remaining.images, 2);
  assert.equal(t.remainingSeconds, 20);
});

test('Chinese text counts by characters', () => {
  const src = '你好世界你好世界\n你好世界你好世界';
  const t = timeLeft(src, 1, { ...opts, cjkPerMinute: 60 });
  assert.equal(t.remainingSeconds, 8);
  assert.equal(t.percent, 50);
});

test('an empty note is 100 percent', () => {
  assert.equal(timeLeft('', 0, opts).percent, 100);
  assert.equal(percentDone(0, 0), 100);
});

test('percentDone rounds and clamps', () => {
  assert.equal(percentDone(1, 3), 67);
  assert.equal(percentDone(5, 3), 0);
  assert.equal(percentDone(-1, 3), 100);
});

test('the supplied total is used instead of recounting', () => {
  const t = timeLeft(body, 5, opts, { words: 60, cjk: 0, images: 0 });
  assert.equal(t.remainingSeconds, 30);
});

test('fillTimeLeft fills both fields, any number of times', () => {
  assert.equal(fillTimeLeft('{time} left · {percent}%', '4 min', 62), '4 min left · 62%');
  assert.equal(fillTimeLeft('{percent}/{percent}', 'x', 5), '5/5');
  assert.equal(fillTimeLeft('{time}', '4 min', 62), '4 min');
  assert.equal(fillTimeLeft('plain', '4 min', 62), 'plain');
});

test('scrollLine prefers the reported line, falls back to the ratio', () => {
  assert.equal(scrollLine(12.5, 0, 0, 0), 12.5);
  assert.equal(scrollLine(undefined, 50, 100, 40), 20);
  assert.equal(scrollLine(NaN, 500, 100, 40), 40);
  assert.equal(scrollLine(undefined, 0, 0, 40), null);
  assert.equal(scrollLine(-1, 0, 0, 40), null);
});
