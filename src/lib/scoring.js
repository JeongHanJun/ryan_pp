/** Big5 점수 계산 (Python test_engine.py 이식) */

const MIN_V = 1;
const MAX_V = 5;

function reverseScore(v) {
  return MIN_V + MAX_V - v;
}

export function computeBig5Scores(questions, answers) {
  const sums = {};
  const counts = {};
  const qmap = {};
  questions.forEach((q) => { qmap[String(q.id)] = q; });

  for (const [qidStr, rawV] of Object.entries(answers)) {
    const q = qmap[qidStr];
    if (!q) continue;
    let v = Number(rawV);
    if (q.reverse) v = reverseScore(v);
    const trait = q.trait;
    sums[trait] = (sums[trait] || 0) + v;
    counts[trait] = (counts[trait] || 0) + 1;
  }

  const means_1_5 = {};
  const score_0_100 = {};
  for (const t of Object.keys(counts)) {
    means_1_5[t] = sums[t] / counts[t];
    score_0_100[t] = parseFloat(((means_1_5[t] - 1) / 4 * 100).toFixed(1));
  }

  return { means_1_5, score_0_100 };
}
