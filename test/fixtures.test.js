// Data-driven regression suite for the registry + domain pseudo-signal modules.
// Every labeled case in src/data/registry-fixtures.json is run through the LIVE
// modules; signal IDs and note types are compared as sets. This is the harness
// the benchmark (precision/recall) will extend, and it pins the guardrail that
// a genuine educational question raises nothing.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parse } from '../src/engine/parse.js';
import { checkRegistry } from '../src/engine/registry.js';
import { checkDomains } from '../src/engine/domains.js';

const registry = JSON.parse(readFileSync(new URL('../src/data/sebi-registry.json', import.meta.url)));
const domains = JSON.parse(readFileSync(new URL('../src/data/domains.json', import.meta.url)));
const fixtures = JSON.parse(readFileSync(new URL('../src/data/registry-fixtures.json', import.meta.url)));

const setEq = (a, b) => {
  const A = [...new Set(a)].sort();
  const B = [...new Set(b)].sort();
  return A.length === B.length && A.every((x, i) => x === B[i]);
};

function runCase(c) {
  const ent = parse(c.text);
  const signals = [];
  const notes = [];
  if (c.module === 'registry' || c.module === 'both') {
    const r = checkRegistry(ent, registry);
    signals.push(...r.signals.map((s) => s.id));
    notes.push(...r.notes.map((n) => n.type));
  }
  if (c.module === 'domains' || c.module === 'both') {
    const d = checkDomains(ent, domains);
    signals.push(...d.signals.map((s) => s.id));
    notes.push(...d.notes.map((n) => n.type));
  }
  return { signals, notes };
}

test('fixtures file is well-formed', () => {
  assert.ok(Array.isArray(fixtures.cases) && fixtures.cases.length >= 40, 'need >=40 labeled cases');
  const ids = new Set();
  for (const c of fixtures.cases) {
    assert.ok(c.id && !ids.has(c.id), `duplicate/missing id: ${c.id}`);
    ids.add(c.id);
    assert.ok(['registry', 'domains', 'both'].includes(c.module), `bad module: ${c.id}`);
    assert.ok(typeof c.text === 'string' && c.text.length, `missing text: ${c.id}`);
    assert.ok(c.expect && Array.isArray(c.expect.signals) && Array.isArray(c.expect.notes), `bad expect: ${c.id}`);
  }
});

for (const c of fixtures.cases) {
  test(`fixture ${c.id} (${c.module})`, () => {
    const got = runCase(c);
    assert.ok(setEq(got.signals, c.expect.signals), `${c.id} signals: got [${got.signals}] expected [${c.expect.signals}]`);
    assert.ok(setEq(got.notes, c.expect.notes), `${c.id} notes: got [${got.notes}] expected [${c.expect.notes}]`);
  });
}

// Guardrail roll-up: no educational fixture may produce ANY signal or note.
test('guardrail: educational questions produce zero signals and zero notes', () => {
  const edu = fixtures.cases.filter((c) => c.id.startsWith('edu_'));
  assert.ok(edu.length >= 5, 'expect a batch of educational guardrail cases');
  for (const c of edu) {
    const got = runCase(c);
    assert.equal(got.signals.length, 0, `${c.id} must not raise a signal`);
    assert.equal(got.notes.length, 0, `${c.id} must not raise a note`);
  }
});
