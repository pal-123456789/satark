import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { verdict } from '../src/engine/index.js';
import { combineRisk, bucketFor } from '../src/engine/scoring.js';
import { parse } from '../src/engine/parse.js';

const kb = JSON.parse(readFileSync(new URL('../src/data/knowledge-base.json', import.meta.url)));

test('classic tip-group scam → High-Risk with explainable reasons', () => {
  const msg = 'SEBI registered advisor here! Guaranteed 300% returns. Join our VIP Telegram, pay 5000 to activate.';
  const r = verdict(msg, kb);
  assert.equal(r.bucket, 'high_risk');
  assert.ok(r.score >= 60, `score ${r.score} should be >= 60`);
  const ids = r.reasons.map((x) => x.id);
  assert.ok(ids.includes('guaranteed_returns'));
  assert.ok(ids.includes('tip_group_channel'));
  // top reason must be the most severe (highest weight) one
  assert.equal(r.reasons[0].id, 'guaranteed_returns');
});

test('genuine learning question → Safe, no false alarm', () => {
  const r = verdict('What does diversification mean? I want to understand mutual funds before investing.', kb);
  assert.equal(r.bucket, 'safe');
  assert.equal(r.signalCount, 0);
});

test('remote-access request alone → High-Risk', () => {
  const r = verdict('Sir please install AnyDesk so I can help you complete the KYC.', kb);
  assert.equal(r.bucket, 'high_risk');
});

test('verdict is deterministic (same input → identical output)', () => {
  const a = verdict('guaranteed returns, join telegram', kb);
  const b = verdict('guaranteed returns, join telegram', kb);
  assert.deepEqual(a, b);
});

test('noisy-OR scoring is monotonic and bounded [0,100]', () => {
  assert.equal(combineRisk([]), 0);
  assert.equal(combineRisk([{ weight: 100 }]), 100);
  const one = combineRisk([{ weight: 50 }]);
  const two = combineRisk([{ weight: 50 }, { weight: 40 }]);
  assert.ok(two >= one, 'adding a signal never lowers risk');
  assert.ok(two <= 100);
});

test('buckets are data-driven from the KB thresholds', () => {
  const b = kb.scoring.buckets;
  assert.equal(bucketFor(0, b), 'safe');
  assert.equal(bucketFor(b.caution[0], b), 'caution');
  assert.equal(bucketFor(b.high_risk[0], b), 'high_risk');
});

test('parser extracts SEBI reg numbers and invite links', () => {
  const e = parse('Verify INH000001234 and join https://t.me/stocktips now, pay to 9876543210@ybl');
  assert.ok(e.sebiRegNos.includes('INH000001234'));
  assert.ok(e.inviteLinks.length >= 1);
  assert.ok(e.upiHandles.includes('9876543210@ybl'));
});
