// Deterministic risk combination.
//
// We combine independent red-flag signals with a "noisy-OR" rule:
//   risk = 1 - Π (1 - w_i)         where w_i = signal weight in [0,1]
// Properties that make this the right choice for an auditable fraud score:
//   - Monotonic: adding a signal never lowers risk.
//   - Bounded: result always stays in [0,100], no clamping hacks.
//   - Diminishing returns: ten weak signals don't falsely dominate one critical one.
//   - A single critical signal (e.g. weight 0.9) alone pushes into High-Risk.
// It is fully deterministic and explainable — no model, no randomness.

export function combineRisk(matched) {
  let survive = 1; // probability that NO signal fires = "looks safe"
  for (const m of matched) {
    const w = Math.min(Math.max(Number(m.weight) || 0, 0), 100) / 100;
    survive *= (1 - w);
  }
  return Math.round((1 - survive) * 100);
}

// Buckets come from the knowledge base so thresholds stay data-driven/tunable.
export function bucketFor(score, buckets) {
  if (score <= buckets.safe[1]) return 'safe';
  if (score <= buckets.caution[1]) return 'caution';
  return 'high_risk';
}
