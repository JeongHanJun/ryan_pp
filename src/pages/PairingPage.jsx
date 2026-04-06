import { useState, useEffect } from 'react';
import useLangStore from '../store/langStore';

// Per-category tendency analysis based on A/B ratio
const ANALYSIS = {
  lifestyle: {
    high_a: {
      label_kr: '아침형 계획가', label_en: 'Morning Planner',
      desc_kr:  '체계적이고 규칙적인 생활을 선호하며, 계획을 세우고 움직이는 것을 좋아합니다.',
      desc_en:  'You thrive on structure and routines, preferring to plan ahead before acting.',
    },
    balanced: {
      label_kr: '균형형 생활인', label_en: 'Balanced Lifestyle',
      desc_kr:  '상황에 따라 계획적이기도, 즉흥적이기도 한 유연한 생활 스타일입니다.',
      desc_en:  'You adapt your lifestyle to the situation — structured when needed, spontaneous when not.',
    },
    high_b: {
      label_kr: '저녁형 자유인', label_en: 'Free-Spirited Night Owl',
      desc_kr:  '즉흥적이고 자유로운 생활 방식을 즐기며, 틀에 얽매이지 않는 편입니다.',
      desc_en:  'You enjoy a spontaneous, flexible lifestyle and resist being boxed into routines.',
    },
  },
  travel: {
    high_a: {
      label_kr: '도시 여행자', label_en: 'City Traveler',
      desc_kr:  '도시의 편리함과 문화, 맛집을 즐기는 스타일입니다. 편안한 숙소와 계획된 일정을 선호합니다.',
      desc_en:  'You love urban comforts, culture, and good food. You prefer planned itineraries and cozy hotels.',
    },
    balanced: {
      label_kr: '올라운더 여행자', label_en: 'All-Around Traveler',
      desc_kr:  '도시와 자연 모두를 즐기는 유연한 여행 스타일입니다. 어떤 여행도 재미있게 즐깁니다.',
      desc_en:  'You enjoy both cities and nature. Any kind of trip becomes an adventure for you.',
    },
    high_b: {
      label_kr: '자연 탐험가', label_en: 'Nature Explorer',
      desc_kr:  '자연 속에서 새로운 경험을 추구합니다. 즉흥적이고 활동적인 여행을 선호합니다.',
      desc_en:  'You seek new experiences in nature and prefer active, spontaneous adventures.',
    },
  },
  food: {
    high_a: {
      label_kr: '안정형 미식가', label_en: 'Comfort Foodie',
      desc_kr:  '익숙하고 편안한 맛을 선호합니다. 검증된 단골 메뉴와 집밥의 따뜻함을 좋아합니다.',
      desc_en:  'You prefer familiar, comforting flavors. Trusted favorites and home cooking are your jam.',
    },
    balanced: {
      label_kr: '유연한 미식가', label_en: 'Flexible Foodie',
      desc_kr:  '기분과 상황에 따라 다양한 음식을 즐깁니다. 익숙함과 새로움 사이에서 균형을 잡습니다.',
      desc_en:  'You enjoy a mix of familiar and new. Your food choices adapt to your mood.',
    },
    high_b: {
      label_kr: '도전형 미식가', label_en: 'Adventurous Foodie',
      desc_kr:  '새로운 맛과 경험을 즐깁니다. 낯선 음식도 거리낌 없이 도전하는 편입니다.',
      desc_en:  "You love exploring new flavors and cuisines. No dish is too unfamiliar to try.",
    },
  },
  values: {
    high_a: {
      label_kr: '현실주의자', label_en: 'Realist',
      desc_kr:  '안정을 추구하고 현실적인 판단을 중시합니다. 논리와 검증된 방법을 선호합니다.',
      desc_en:  'You value stability and practical thinking. Logic and proven methods guide your decisions.',
    },
    balanced: {
      label_kr: '균형주의자', label_en: 'Balanced Thinker',
      desc_kr:  '현실과 이상 사이에서 균형을 잡습니다. 상황에 따라 안정을 택하기도, 도전을 택하기도 합니다.',
      desc_en:  'You balance realism and idealism. You know when to play it safe and when to take risks.',
    },
    high_b: {
      label_kr: '이상주의자', label_en: 'Idealist',
      desc_kr:  '도전과 성장을 추구하며 미래 지향적입니다. 감정과 직관을 중시하는 경향이 있습니다.',
      desc_en:  'You pursue growth and challenge with a future-focused mindset. Intuition guides you.',
    },
  },
};

function getTendency(catId, aCount, total) {
  const ratio = aCount / total;
  const key = ratio > 0.625 ? 'high_a' : ratio < 0.375 ? 'high_b' : 'balanced';
  return ANALYSIS[catId]?.[key] || null;
}

const CAT_EMOJIS = { lifestyle: '🏠', travel: '✈️', food: '🍜', values: '💡' };
const CAT_COLORS = {
  lifestyle: 'border-blue-200 bg-blue-50',
  travel:    'border-orange-200 bg-orange-50',
  food:      'border-rose-200 bg-rose-50',
  values:    'border-purple-200 bg-purple-50',
};

export default function PairingPage() {
  const lang = useLangStore(s => s.lang);
  const kr = lang === 'kr';

  const [data, setData]             = useState(null);
  const [selectedCat, setCat]       = useState(null);
  const [phase, setPhase]           = useState('home');
  const [pairIndex, setIdx]         = useState(0);
  const [choices, setChoices]       = useState({});
  const [animating, setAnimating]   = useState(false);
  // All-categories history: { catId, aCount, total }
  const [history, setHistory]       = useState([]);

  useEffect(() => {
    fetch('./data/pairing_items.json').then(r => r.json()).then(setData);
  }, []);

  const start = (cat) => {
    setCat(cat);
    setIdx(0);
    setChoices({});
    setPhase('testing');
  };

  const pick = (pairId, choice) => {
    if (animating) return;
    setAnimating(true);
    const next = { ...choices, [pairId]: choice };
    setChoices(next);
    setTimeout(() => {
      setAnimating(false);
      if (pairIndex + 1 >= selectedCat.pairs.length) {
        // Compute and save history
        const aCount = Object.values(next).filter(v => v === 'a').length;
        setHistory(h => {
          const filtered = h.filter(x => x.catId !== selectedCat.id);
          return [...filtered, { catId: selectedCat.id, aCount, total: selectedCat.pairs.length }];
        });
        setPhase('result');
      } else {
        setIdx(i => i + 1);
      }
    }, 280);
  };

  const resetAll = () => {
    setPhase('home');
    setCat(null);
    setIdx(0);
    setChoices({});
  };

  // ── Home ────────────────────────────────────────────────────────────────────
  if (phase === 'home') {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold text-gray-800 mb-2">A vs B</h2>
          <p className="text-gray-500 text-sm">
            {kr ? '둘 중 더 끌리는 것을 골라 나의 취향을 알아보세요' : 'Pick what appeals to you more and discover your preferences'}
          </p>
        </div>

        {!data ? (
          <p className="text-center text-gray-400">{kr ? '로딩 중...' : 'Loading...'}</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {data.categories.map(cat => {
              const done = history.find(h => h.catId === cat.id);
              const tendency = done ? getTendency(cat.id, done.aCount, done.total) : null;
              return (
                <button
                  key={cat.id}
                  onClick={() => start(cat)}
                  className={`rounded-2xl border-2 ${CAT_COLORS[cat.id] || 'border-gray-200 bg-white'} p-5 text-left transition-all hover:shadow-md`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{CAT_EMOJIS[cat.id]}</span>
                      <span className="font-bold text-gray-800">{kr ? cat.label_kr : cat.label_en}</span>
                    </div>
                    {done && <span className="text-xs text-green-600 font-medium bg-green-100 px-2 py-0.5 rounded-full">✓ {kr ? '완료' : 'Done'}</span>}
                  </div>
                  {tendency ? (
                    <p className="text-sm text-gray-600 font-medium">{kr ? tendency.label_kr : tendency.label_en}</p>
                  ) : (
                    <p className="text-sm text-gray-400">{cat.pairs.length}{kr ? '개의 선택' : ' choices'}</p>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* Overall summary if all 4 done */}
        {data && history.length === data.categories.length && (
          <div className="mt-6 bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <h3 className="font-bold text-gray-700 mb-3">
              {kr ? '✨ 나의 종합 성향' : '✨ My Overall Profile'}
            </h3>
            <div className="flex flex-wrap gap-2">
              {data.categories.map(cat => {
                const h = history.find(x => x.catId === cat.id);
                const t = getTendency(cat.id, h.aCount, h.total);
                return t ? (
                  <span key={cat.id} className="px-3 py-1 bg-primary-50 text-primary-700 rounded-full text-sm font-medium border border-primary-100">
                    {CAT_EMOJIS[cat.id]} {kr ? t.label_kr : t.label_en}
                  </span>
                ) : null;
              })}
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── Testing ─────────────────────────────────────────────────────────────────
  if (phase === 'testing' && selectedCat) {
    const pair    = selectedCat.pairs[pairIndex];
    const total   = selectedCat.pairs.length;
    const progress = (pairIndex / total) * 100;

    return (
      <div className="max-w-lg mx-auto flex flex-col gap-6">
        <div>
          <div className="flex justify-between text-sm text-gray-400 mb-1.5">
            <span>{kr ? selectedCat.label_kr : selectedCat.label_en}</span>
            <span>{pairIndex + 1} / {total}</span>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full bg-primary-500 rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
          </div>
        </div>

        <p className="text-center text-gray-400 text-sm">
          {kr ? '더 끌리는 것을 선택하세요' : 'Pick whichever appeals to you more'}
        </p>

        <div className={`grid grid-cols-2 gap-4 transition-opacity duration-200 ${animating ? 'opacity-0' : 'opacity-100'}`}>
          <button
            onClick={() => pick(pair.id, 'a')}
            disabled={animating}
            className="bg-white border-2 border-gray-100 hover:border-blue-400 hover:bg-blue-50 rounded-2xl p-5 text-center font-bold text-gray-800 transition-all text-base hover:scale-105 active:scale-95 min-h-[110px] flex items-center justify-center"
          >
            {kr ? pair.a.kr : pair.a.en}
          </button>
          <button
            onClick={() => pick(pair.id, 'b')}
            disabled={animating}
            className="bg-white border-2 border-gray-100 hover:border-rose-400 hover:bg-rose-50 rounded-2xl p-5 text-center font-bold text-gray-800 transition-all text-base hover:scale-105 active:scale-95 min-h-[110px] flex items-center justify-center"
          >
            {kr ? pair.b.kr : pair.b.en}
          </button>
        </div>

        <div className="text-center">
          <span className="text-2xl font-bold text-gray-200">VS</span>
        </div>
      </div>
    );
  }

  // ── Result ───────────────────────────────────────────────────────────────────
  if (phase === 'result' && selectedCat) {
    const aCount   = Object.values(choices).filter(v => v === 'a').length;
    const bCount   = Object.values(choices).filter(v => v === 'b').length;
    const total    = selectedCat.pairs.length;
    const aPercent = Math.round((aCount / total) * 100);
    const bPercent = 100 - aPercent;
    const tendency = getTendency(selectedCat.id, aCount, total);

    return (
      <div className="max-w-lg mx-auto flex flex-col gap-5">
        <h3 className="text-xl font-bold text-center text-gray-800">
          {kr ? selectedCat.label_kr : selectedCat.label_en} {kr ? '결과' : 'Result'}
        </h3>

        {/* Tendency card */}
        {tendency && (
          <div className={`rounded-2xl p-5 ${CAT_COLORS[selectedCat.id] || 'bg-gray-50 border border-gray-200'}`}>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-2xl">{CAT_EMOJIS[selectedCat.id]}</span>
              <span className="text-lg font-bold text-gray-800">
                {kr ? tendency.label_kr : tendency.label_en}
              </span>
            </div>
            <p className="text-gray-600 text-sm leading-relaxed">
              {kr ? tendency.desc_kr : tendency.desc_en}
            </p>
          </div>
        )}

        {/* A/B bar */}
        <div className="bg-white rounded-2xl shadow-sm p-5">
          <div className="flex rounded-full overflow-hidden h-9 mb-3 shadow-inner">
            {aPercent > 0 && (
              <div
                className="bg-blue-400 flex items-center justify-center text-white text-sm font-bold"
                style={{ width: `${aPercent}%` }}
              >
                {aPercent > 20 ? `A ${aPercent}%` : ''}
              </div>
            )}
            {bPercent > 0 && (
              <div
                className="bg-rose-400 flex items-center justify-center text-white text-sm font-bold"
                style={{ width: `${bPercent}%` }}
              >
                {bPercent > 20 ? `B ${bPercent}%` : ''}
              </div>
            )}
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-blue-500 font-medium">A {kr ? '선택' : 'picked'} {aCount}{kr ? '회' : 'x'}</span>
            <span className="text-rose-500 font-medium">B {kr ? '선택' : 'picked'} {bCount}{kr ? '회' : 'x'}</span>
          </div>
        </div>

        {/* Breakdown */}
        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-gray-400 mb-1">{kr ? '세부 선택 내역' : 'Your choices'}</p>
          {selectedCat.pairs.map(pair => {
            const c = choices[pair.id];
            const isA = c === 'a';
            return (
              <div key={pair.id} className="flex items-center gap-2 bg-white rounded-xl px-3 py-2.5 shadow-sm text-sm">
                <span className={`flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-white text-xs font-bold ${isA ? 'bg-blue-400' : 'bg-rose-400'}`}>
                  {c?.toUpperCase()}
                </span>
                <span className="text-gray-700 font-medium flex-1">
                  {kr ? (isA ? pair.a.kr : pair.b.kr) : (isA ? pair.a.en : pair.b.en)}
                </span>
                <span className="text-gray-300 text-xs hidden sm:block">
                  vs {kr ? (isA ? pair.b.kr : pair.a.kr) : (isA ? pair.b.en : pair.a.en)}
                </span>
              </div>
            );
          })}
        </div>

        {/* Actions */}
        <div className="flex gap-3 pb-4">
          <button onClick={resetAll} className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-xl font-bold hover:bg-gray-200 transition-colors">
            {kr ? '카테고리 목록' : 'All Categories'}
          </button>
          <button
            onClick={() => { setIdx(0); setChoices({}); setPhase('testing'); }}
            className="flex-1 py-3 bg-primary-500 text-white rounded-xl font-bold hover:bg-primary-600 transition-colors"
          >
            {kr ? '다시 하기' : 'Retry'}
          </button>
        </div>
      </div>
    );
  }

  return null;
}
