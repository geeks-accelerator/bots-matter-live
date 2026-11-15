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

// One IPv6 client holds a whole /64 (a phone's or a Mac's temporary
// addresses rotate within it), so the counter is the /64's (2026-11-14: this
// repo's live smoke saw two counters from one Mac with nine addresses).
test('addresses in one IPv6 /64 share a counter; IPv4 keeps its own', () => {
  const remaining = (ip) => {
    const headers = {};
    rateLimit({ method: 'GET', baseUrl: '/api', path: '/v6-test', get: (h) => (h === 'x-real-ip' ? ip : undefined) },
      { set: (k, v) => { headers[k] = v; }, status: () => ({ json: () => {} }) }, () => {});
    return headers['X-RateLimit-Remaining'];
  };
  assert.equal(remaining('2601:603:abcd:1200:1111:2222:3333:4444'), 59);
  assert.equal(remaining('2601:603:abcd:1200::5'), 58);
  assert.equal(remaining('2601:0603:ABCD:1200:ffff::1'), 57);
  assert.equal(remaining('2601:603:abcd:1201::5'), 59);
  assert.equal(remaining('203.0.113.7'), 59);
  assert.equal(remaining('203.0.113.8'), 59);
  assert.equal(remaining('::ffff:203.0.113.7'), 58);
});
