/** MBTI 점수 계산 + 설명 (Python mbti_engine.py 이식) */

const MIN_V = 1;
const MAX_V = 5;

function reverseScore(v) {
  return MIN_V + MAX_V - v;
}

export const MBTI_DESCRIPTIONS = {
  INTJ: { name_en: 'The Architect',     name_kr: '건축가',    short_kr: '전략적, 독립적, 혁신적',      short_en: 'Strategic, independent, innovative' },
  INTP: { name_en: 'The Logician',      name_kr: '논리술사',   short_kr: '분석적, 호기심, 독립적',      short_en: 'Analytical, curious, independent' },
  ENTJ: { name_en: 'The Commander',     name_kr: '사령관',    short_kr: '전략적, 조직적, 야심찬',      short_en: 'Strategic, organized, ambitious' },
  ENTP: { name_en: 'The Debater',       name_kr: '변론가',    short_kr: '혁신적, 전략적, 회의적',      short_en: 'Inventive, strategic, skeptical' },
  INFJ: { name_en: 'The Advocate',      name_kr: '옹호자',    short_kr: '통찰력, 민감, 원칙적',       short_en: 'Insightful, sensitive, principled' },
  INFP: { name_en: 'The Mediator',      name_kr: '중재자',    short_kr: '이상적, 충실, 창의적',       short_en: 'Idealistic, loyal, creative' },
  ENFJ: { name_en: 'The Protagonist',   name_kr: '주인공',    short_kr: '카리스마, 영감, 공감적',      short_en: 'Charismatic, inspiring, empathetic' },
  ENFP: { name_en: 'The Campaigner',    name_kr: '캠페이너',   short_kr: '열정적, 창의적, 즉흥적',      short_en: 'Enthusiastic, creative, spontaneous' },
  ISTJ: { name_en: 'The Logistician',   name_kr: '논리주의자', short_kr: '실용적, 사실지향, 신뢰',      short_en: 'Practical, fact-oriented, reliable' },
  ISFJ: { name_en: 'The Defender',      name_kr: '수호자',    short_kr: '보호적, 따뜻, 성실',        short_en: 'Protective, warm, dutiful' },
  ESTJ: { name_en: 'The Executive',     name_kr: '경영자',    short_kr: '조직적, 실용적, 효율적',      short_en: 'Organized, practical, efficient' },
  ESFJ: { name_en: 'The Consul',        name_kr: '영사',      short_kr: '성실, 배려, 실용적',        short_en: 'Conscientious, caring, practical' },
  ISTP: { name_en: 'The Virtuoso',      name_kr: '장인',      short_kr: '실용적, 독립적, 현실적',      short_en: 'Practical, independent, realistic' },
  ISFP: { name_en: 'The Adventurer',    name_kr: '모험가',    short_kr: '예술적, 민감, 모험심',       short_en: 'Artistic, sensitive, adventurous' },
  ESTP: { name_en: 'The Entrepreneur',  name_kr: '사업가',    short_kr: '에너지, 모험적, 실용적',      short_en: 'Energetic, adventurous, pragmatic' },
  ESFP: { name_en: 'The Entertainer',   name_kr: '연예인',    short_kr: '외향적, 즉흥적, 재미',       short_en: 'Outgoing, spontaneous, fun-loving' },
};

export function getMbtiDescription(mbtiType) {
  return MBTI_DESCRIPTIONS[mbtiType] || { name_en: mbtiType, name_kr: mbtiType, short_kr: '', short_en: '' };
}

/** 항상 4글자 MBTI 반환 (kakao_friends 포함) */
export function computeMbtiScores(questions, answers) {
  const sums = {};
  const counts = {};
  const qmap = {};
  questions.forEach((q) => { qmap[String(q.id)] = q; });

  const VALID_AXES = new Set(['E', 'I', 'S', 'N', 'T', 'F', 'J', 'P']);

  for (const [qidStr, rawV] of Object.entries(answers)) {
    const q = qmap[qidStr];
    if (!q) continue;
    let v = Number(rawV);
    if (q.reverse) v = reverseScore(v);
    const axis = (q.axis || '').toUpperCase();
    if (!VALID_AXES.has(axis)) continue;
    sums[axis] = (sums[axis] || 0) + v;
    counts[axis] = (counts[axis] || 0) + 1;
  }

  const means_1_5 = {};
  const score_0_100 = {};
  for (const axis of Object.keys(counts)) {
    means_1_5[axis] = sums[axis] / counts[axis];
    score_0_100[axis] = parseFloat(((means_1_5[axis] - 1) / 4 * 100).toFixed(1));
  }

  const eType = (score_0_100['E'] ?? 50) >= (score_0_100['I'] ?? 50) ? 'E' : 'I';
  const sType = (score_0_100['S'] ?? 50) >= (score_0_100['N'] ?? 50) ? 'S' : 'N';
  const tType = (score_0_100['T'] ?? 50) >= (score_0_100['F'] ?? 50) ? 'T' : 'F';
  const jType = (score_0_100['J'] ?? 50) >= (score_0_100['P'] ?? 50) ? 'J' : 'P';
  const mbti_type = `${eType}${sType}${tType}${jType}`;

  return { means_1_5, score_0_100, mbti_type };
}
