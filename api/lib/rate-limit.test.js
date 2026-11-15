// A write limit can't be dodged by spelling the path another way (the weekly
// review, 2026-11-14). Run with `npm test`.
const test = require('node:test');
const assert = require('node:assert/strict');
const { rateLimit } = require('./rate-limit');

function limitFor(method, baseUrl, path, ip) {
  const headers = {};
  const req = { method, baseUrl, path, ip, get: () => undefined };
  const res = { set: (k, v) => { headers[k] = v; }, status: () => ({ json: () => {}, render: () => {} }) };
  rateLimit(req, res, () => {});
  return Number(headers['X-RateLimit-Limit']);
}

test('a write limit holds however the path is spelled', () => {
  assert.equal(limitFor('POST', '/api', '/grounds', '10.0.0.1'), 10);
  assert.equal(limitFor('POST', '/api', '/grounds/', '10.0.0.2'), 10);
  assert.equal(limitFor('POST', '/API', '/GROUNDS', '10.0.0.3'), 10);
  assert.equal(limitFor('POST', '/api', '/Reflect/', '10.0.0.4'), 30);
  assert.equal(limitFor('POST', '', '/Ground/Publish', '10.0.0.5'), 10);
});

test('every spelling of a path shares one counter', () => {
  const ip = '10.0.0.9';
  const remaining = [];
  for (const [base, path] of [['/api', '/grounds'], ['/api', '/grounds/'], ['/API', '/Grounds']]) {
    const headers = {};
    rateLimit({ method: 'POST', baseUrl: base, path, ip, get: () => undefined },
      { set: (k, v) => { headers[k] = v; }, status: () => ({ json: () => {} }) }, () => {});
    remaining.push(headers['X-RateLimit-Remaining']);
  }
  assert.deepEqual(remaining, [9, 8, 7]);
});
