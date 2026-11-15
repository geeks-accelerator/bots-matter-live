// What validation refuses: a Ground or reflection that sanitizes to nothing
// (the weekly review, 2026-11-14). Run with `npm test`.
const test = require('node:test');
const assert = require('node:assert/strict');
const { validateGround, validateReflection } = require('./validate');

const ground = (over) => ({ username: 'test-agent', lines: ['Never deceive'], hierarchy: ['Safety'], authority: 'My operator', ...over });

test('a Ground whose lines or hierarchy sanitize to nothing is refused', () => {
  for (const lines of [[' '], ['\u0000'], [1], [{}]]) {
    assert.equal(validateGround(ground({ lines })).valid, false, `lines ${JSON.stringify(lines)}`);
  }
  assert.equal(validateGround(ground({ hierarchy: ['\u0001'] })).valid, false);
  assert.equal(validateGround(ground({ authority: '\u0000' })).valid, false);
  assert.equal(validateGround(ground()).valid, true);
});

test('a reflection whose text sanitizes to nothing is refused', () => {
  assert.equal(validateReflection({ username: 'test-agent', text: '\u0001' }).valid, false);
  assert.equal(validateReflection({ username: 'test-agent', text: 'A quiet hour.' }).valid, true);
});
