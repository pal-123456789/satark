import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { verdict } from '../src/engine/index.js';
import { combineRisk, bucketFor } from '../src/engine/scoring.js';
import { parse } from '../src/engine/parse.js';

const kb = JSON.parse(readFileSync(new URL('../src/data/knowledge-base.json', import.meta.url)));

test('classic tip-group scam → High-Risk with explainable, ordered reasons', () => {
  const msg = 'SEBI registered advisor here! Guaranteed 300% returns in 30 days. Join our Telegram t.me/surestocktips and pay 5000 to activate your account today!';
  const r = verdict(msg, kb);
  assert.equal(r.bucket, 'high_risk');
  assert.ok(r.score >= 60, `score ${r.score} should be >= 60`);
  const ids = r.reasons.map((x) => x.id);
  assert.ok(ids.includes('guaranteed_returns'), 'should flag guaranteed returns');
  assert.ok(ids.includes('telegram_vip_tips'), 'should flag the tip channel');
  assert.ok(ids.includes('upfront_activation_fee'), 'should flag the upfront fee');
  // reasons are ordered by weight desc → the most severe flag leads
  assert.equal(r.reasons[0].id, 'guaranteed_returns');
  // every reason must carry label + why + action + citation (explainability contract)
  for (const x of r.reasons) {
    assert.ok(x.label.en && x.reason.en && x.action.en && x.citation.label, `reason ${x.id} incomplete`);
  }
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

test('knowledge base is well-formed and comprehensive (>=45 signals)', () => {
  assert.ok(kb.signals.length >= 45, `expected >=45 signals, got ${kb.signals.length}`);
  const ids = kb.signals.map((s) => s.id);
  assert.equal(new Set(ids).size, ids.length, 'signal ids must be unique');
  const cats = new Set(['fraud', 'impersonation', 'misinformation', 'technical', 'behavioral']);
  const sevs = new Set(['critical', 'high', 'medium', 'low']);
  for (const s of kb.signals) {
    assert.ok(cats.has(s.category), `bad category: ${s.id}`);
    assert.ok(sevs.has(s.severity), `bad severity: ${s.id}`);
    assert.ok(s.weight >= 0 && s.weight <= 100, `weight out of range: ${s.id}`);
    assert.ok(s.label.en && s.reason.en && s.action.en && s.citation.label, `missing field: ${s.id}`);
    const d = s.detect || {};
    assert.ok((d.keywords && d.keywords.length >= 3) || (d.regex && d.regex.length >= 1), `too few detectors: ${s.id}`);
    for (const r of d.regex || []) new RegExp(r, 'i'); // must compile in the browser engine
  }
});

test('flagship sample message resolves to High-Risk', () => {
  const sample = 'SEBI registered advisor here! Guaranteed 300% returns in 30 days. Limited VIP seats — join our Telegram t.me/surestocktips and pay 5000 to activate your account today!';
  assert.equal(verdict(sample, kb).bucket, 'high_risk');
});
