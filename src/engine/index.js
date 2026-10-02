// Verdict orchestrator — the single public entry point of the Satark engine.
//
// Design guarantee (guardrail-critical): the VERDICT is produced only by the
// deterministic signal engine below. No language model ever decides risk; an
// LLM may later *rephrase* `reasons` into friendlier prose, but it cannot
// change `score` or `bucket`. This keeps the safety call auditable and
// hallucination-free.

import { parse } from './parse.js';
import { evaluate } from './signals.js';
import { combineRisk, bucketFor } from './scoring.js';

/**
 * @param {string|{text:string}} input  raw pasted/forwarded artifact
 * @param {object} kb                    loaded knowledge-base.json
 * @param {object} [checks]              optional {registry, domains} results merged as pseudo-signals
 * @returns verdict object (JSON-serialisable, deterministic)
 */
export function verdict(input, kb, checks = {}) {
  const text = typeof input === 'string' ? input : (input && input.text) || '';
  const entities = parse(text);

  const matched = evaluate(text, kb);

  // Registry / domain modules (added in the engine task) contribute explainable
  // pseudo-signals through the same structure, so scoring stays uniform.
  if (Array.isArray(checks.extraSignals)) {
    for (const s of checks.extraSignals) matched.push(s);
  }

  const score = combineRisk(matched);
  const bucket = bucketFor(score, kb.scoring.buckets);
  const reasons = [...matched].sort((a, b) => (b.weight || 0) - (a.weight || 0));

  return {
    score,
    bucket, // 'safe' | 'caution' | 'high_risk'
    reasons, // ordered, each carries label/reason/citation/action
    entities, // what we extracted (transparency)
    signalCount: matched.length,
    engine: { version: kb.version, method: kb.scoring.method }
  };
}
