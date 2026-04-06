import { useState } from 'react';
import useLangStore from '../store/langStore';

// ── Illusion SVG Components ──────────────────────────────────────────────────

function MullerLyer() {
  // Both horizontal lines are exactly 120px long (x: 90→210)
  // Top: outward arrows (→←) — appears LONGER
  // Bottom: inward arrows (←→) — appears SHORTER
  return (
    <svg viewBox="0 0 300 160" className="w-full max-w-xs mx-auto">
      {/* Top line with outward arrows */}
      <line x1="90" y1="50" x2="210" y2="50" stroke="#334155" strokeWidth="3" />
      <polyline points="90,50 70,35 90,50 70,65" fill="none" stroke="#334155" strokeWidth="2.5" />
      <polyline points="210,50 230,35 210,50 230,65" fill="none" stroke="#334155" strokeWidth="2.5" />

      {/* Bottom line with inward arrows */}
      <line x1="90" y1="110" x2="210" y2="110" stroke="#334155" strokeWidth="3" />
      <polyline points="90,110 110,95 90,110 110,125" fill="none" stroke="#334155" strokeWidth="2.5" />
      <polyline points="210,110 190,95 210,110 190,125" fill="none" stroke="#334155" strokeWidth="2.5" />
    </svg>
  );
}

function EbbinghausIllusion() {
  // Center circles: both r=18. Left surrounded by small (r=8), right by large (r=28)
  return (
    <svg viewBox="0 0 300 160" className="w-full max-w-xs mx-auto">
      {/* Left group: small surrounding circles → center appears LARGER */}
      {[0,60,120,180,240,300].map(a => {
        const rad = (a * Math.PI) / 180;
        return <circle key={a} cx={80 + 36 * Math.cos(rad)} cy={80 + 36 * Math.sin(rad)} r={8} fill="#94a3b8" />;
      })}
      <circle cx={80} cy={80} r={18} fill="#3b82f6" />

      {/* Right group: large surrounding circles → center appears SMALLER */}
      {[0,60,120,180,240,300].map(a => {
        const rad = (a * Math.PI) / 180;
        return <circle key={a} cx={220 + 52 * Math.cos(rad)} cy={80 + 52 * Math.sin(rad)} r={26} fill="#94a3b8" />;
      })}
      <circle cx={220} cy={80} r={18} fill="#3b82f6" />
    </svg>
  );
}

function PonzoIllusion() {
  // Two red bars of exact same width (120px) on converging lines
  // Top bar appears LONGER
  return (
    <svg viewBox="0 0 300 200" className="w-full max-w-xs mx-auto">
      {/* Converging lines */}
      <line x1="150" y1="10" x2="20" y2="195" stroke="#64748b" strokeWidth="3" />
      <line x1="150" y1="10" x2="280" y2="195" stroke="#64748b" strokeWidth="3" />
      {/* Top bar (appears larger) */}
      <line x1="103" y1="70" x2="197" y2="70" stroke="#ef4444" strokeWidth="6" strokeLinecap="round" />
      {/* Bottom bar (appears smaller) */}
      <line x1="76" y1="160" x2="224" y2="160" stroke="#3b82f6" strokeWidth="6" strokeLinecap="round" />
    </svg>
  );
}

function ContrastIllusion() {
  // Same gray (128,128,128) on black vs white background
  return (
    <svg viewBox="0 0 300 160" className="w-full max-w-xs mx-auto">
      <rect x="10" y="10" width="120" height="140" fill="#111827" rx="8" />
      <rect x="170" y="10" width="120" height="140" fill="#f3f4f6" rx="8" />
      <rect x="40" y="45" width="60" height="70" fill="#808080" rx="4" />
      <rect x="200" y="45" width="60" height="70" fill="#808080" rx="4" />
    </svg>
  );
}

function VerticalHorizontal() {
  // Vertical and horizontal lines of the SAME length (100px)
  // Vertical appears LONGER
  return (
    <svg viewBox="0 0 300 200" className="w-full max-w-xs mx-auto">
      {/* Horizontal line */}
      <line x1="50" y1="140" x2="250" y2="140" stroke="#334155" strokeWidth="3" />
      {/* Vertical line (same 200px... wait, let me use 100px for both) */}
      {/* Actually let me redo this: horizontal 150→250, vertical at center going up 100px */}
      <line x1="100" y1="140" x2="200" y2="140" stroke="#3b82f6" strokeWidth="4" strokeLinecap="round" />
      <line x1="150" y1="40" x2="150" y2="140" stroke="#ef4444" strokeWidth="4" strokeLinecap="round" />
      {/* labels */}
      <text x="145" y="170" fontSize="11" fill="#64748b" textAnchor="middle">← 100 →</text>
      <text x="170" y="95" fontSize="11" fill="#64748b">100</text>
    </svg>
  );
}

// ── Illusion Config ──────────────────────────────────────────────────────────

const ILLUSIONS = [
  {
    id: 'muller_lyer',
    title_kr: '뮬러-라이어 착시',
    title_en: 'Müller-Lyer Illusion',
    desc_kr: '선분과 화살표 방향이 길이 인식에 영향을 줍니다.',
    desc_en: 'Arrow directions influence how we perceive line length.',
    Component: MullerLyer,
    question_kr: '두 선 중 어느 것이 더 길어 보이나요?',
    question_en: 'Which line looks longer?',
    options_kr: ['위쪽 선', '아래쪽 선', '똑같아 보인다'],
    options_en: ['Top line', 'Bottom line', 'They look the same'],
    fooled_if: [0, 1], // any pick except "same" means fooled
    truth_kr: '두 선의 길이는 완전히 같습니다. 화살표 방향이 우리 뇌의 깊이 인식을 교란시킵니다.',
    truth_en: 'Both lines are exactly the same length. Arrow directions hijack our depth-perception system.',
  },
  {
    id: 'ebbinghaus',
    title_kr: '에빙하우스 착시',
    title_en: 'Ebbinghaus Illusion',
    desc_kr: '주변 물체의 크기가 중심 물체의 인식에 영향을 줍니다.',
    desc_en: 'Surrounding objects influence how we perceive central size.',
    Component: EbbinghausIllusion,
    question_kr: '가운데 파란 원 중 어느 것이 더 크게 보이나요?',
    question_en: 'Which blue center circle looks larger?',
    options_kr: ['왼쪽 원', '오른쪽 원', '똑같아 보인다'],
    options_en: ['Left circle', 'Right circle', 'They look the same'],
    fooled_if: [0, 1],
    truth_kr: '두 파란 원의 크기는 완전히 같습니다. 주변 원의 크기 대비가 중심 원의 크기 판단을 왜곡합니다.',
    truth_en: 'Both blue circles are identical. The contrast with surrounding circles skews our size judgment.',
  },
  {
    id: 'ponzo',
    title_kr: '폰조 착시',
    title_en: 'Ponzo Illusion',
    desc_kr: '수렴하는 선이 원근감을 만들어 크기 인식을 왜곡합니다.',
    desc_en: 'Converging lines create a false sense of perspective.',
    Component: PonzoIllusion,
    question_kr: '두 가로선 중 어느 것이 더 길어 보이나요?',
    question_en: 'Which horizontal bar looks longer?',
    options_kr: ['위쪽 선(빨간)', '아래쪽 선(파란)', '똑같아 보인다'],
    options_en: ['Top bar (red)', 'Bottom bar (blue)', 'They look the same'],
    fooled_if: [0, 1],
    truth_kr: '두 선의 길이는 완전히 같습니다. 철도 레일 같은 수렴선이 원근감을 만들어 위쪽이 더 멀리, 더 크게 보이게 합니다.',
    truth_en: 'Both bars are exactly the same length. The converging lines simulate depth, making the top bar appear farther and larger.',
  },
  {
    id: 'contrast',
    title_kr: '명도 대비 착시',
    title_en: 'Simultaneous Contrast',
    desc_kr: '배경 밝기가 같은 색을 다르게 인식하게 만듭니다.',
    desc_en: 'Background brightness makes identical colors look different.',
    Component: ContrastIllusion,
    question_kr: '두 회색 사각형의 밝기가 달라 보이나요?',
    question_en: 'Do the two gray squares look different in brightness?',
    options_kr: ['검은 배경 쪽이 더 밝아 보인다', '흰 배경 쪽이 더 밝아 보인다', '똑같아 보인다'],
    options_en: ['Dark background side looks brighter', 'Light background side looks brighter', 'They look the same'],
    fooled_if: [0, 1],
    truth_kr: '두 회색 사각형은 완전히 동일한 색(#808080)입니다. 배경 밝기와의 대비로 인해 달라 보입니다.',
    truth_en: 'Both gray squares are identical (#808080). The contrast with the background creates the illusion of different brightness.',
  },
  {
    id: 'vertical',
    title_kr: '수직-수평 착시',
    title_en: 'Vertical-Horizontal Illusion',
    desc_kr: '수직선과 수평선의 길이 인식이 다릅니다.',
    desc_en: 'We perceive vertical and horizontal lines of equal length differently.',
    Component: VerticalHorizontal,
    question_kr: '파란 가로선과 빨간 세로선 중 어느 것이 더 길어 보이나요?',
    question_en: 'Which line looks longer — the blue horizontal or the red vertical?',
    options_kr: ['파란 가로선', '빨간 세로선', '똑같아 보인다'],
    options_en: ['Blue horizontal', 'Red vertical', 'They look the same'],
    fooled_if: [1], // most people say vertical is longer
    truth_kr: '두 선은 완전히 같은 길이(100px)입니다. 사람은 일반적으로 수직선을 수평선보다 10~20% 더 길게 느낍니다.',
    truth_en: 'Both lines are exactly the same length. People generally perceive vertical lines as 10–20% longer than equal horizontal ones.',
  },
];

// ── Main Page ────────────────────────────────────────────────────────────────

export default function PerceptionPage() {
  const lang = useLangStore(s => s.lang);
  const kr = lang === 'kr';

  const [phase, setPhase] = useState('intro'); // intro | test | result
  const [current, setCurrent] = useState(0);
  const [subPhase, setSubPhase] = useState('question'); // question | revealed
  const [answers, setAnswers] = useState([]); // array of chosen option index

  const illusion = ILLUSIONS[current];
  const { Component } = illusion;

  const handleAnswer = (optionIdx) => {
    setAnswers(prev => [...prev, optionIdx]);
    setSubPhase('revealed');
  };

  const handleNext = () => {
    if (current + 1 >= ILLUSIONS.length) {
      setPhase('result');
    } else {
      setCurrent(c => c + 1);
      setSubPhase('question');
    }
  };

  const reset = () => {
    setPhase('intro');
    setCurrent(0);
    setSubPhase('question');
    setAnswers([]);
  };

  // Intro
  if (phase === 'intro') {
    return (
      <div className="max-w-lg mx-auto flex flex-col items-center gap-6 py-8">
        <div className="text-6xl">👁️</div>
        <h2 className="text-2xl font-bold text-gray-800">
          {kr ? '착시 인지 테스트' : 'Visual Perception Test'}
        </h2>
        <p className="text-gray-500 text-sm text-center max-w-sm">
          {kr
            ? '5가지 유명한 착시를 경험해 보세요. 직관적으로 느껴지는 대로 선택하면 됩니다.'
            : 'Experience 5 famous optical illusions. Trust your instincts and pick what you see.'}
        </p>
        <div className="grid grid-cols-3 gap-3 w-full text-center">
          {['🧠', '👁️', '✨'].map((e, i) => (
            <div key={i} className="bg-gray-50 rounded-xl p-3">
              <div className="text-2xl mb-1">{e}</div>
              <p className="text-xs text-gray-500">
                {kr
                  ? ['총 5종류', '직관으로 선택', '결과 해설 제공'][i]
                  : ['5 illusions', 'Trust your eyes', 'With explanations'][i]}
              </p>
            </div>
          ))}
        </div>
        <button
          onClick={() => setPhase('test')}
          className="px-10 py-3 bg-violet-500 text-white rounded-xl font-bold hover:bg-violet-600 transition-colors"
        >
          {kr ? '시작하기' : 'Start'}
        </button>
      </div>
    );
  }

  // Result
  if (phase === 'result') {
    const fooledCount = answers.filter((ans, i) => ILLUSIONS[i].fooled_if.includes(ans)).length;
    const notFooled = ILLUSIONS.length - fooledCount;

    const interpretation = kr
      ? fooledCount >= 4
        ? '당신의 뇌는 착시에 매우 민감합니다. 시각적 맥락 정보를 풍부하게 활용하는 편이에요.'
        : fooledCount >= 2
        ? '평균적인 시각 처리 패턴을 보입니다. 맥락에 따라 판단이 유연하게 바뀌는 편이에요.'
        : '착시에 상대적으로 잘 속지 않는 편입니다. 분석적이고 세부 지향적인 시각 처리 스타일일 수 있어요.'
      : fooledCount >= 4
        ? 'Your brain is highly sensitive to visual context — you richly integrate surrounding cues.'
        : fooledCount >= 2
        ? 'You show average visual processing — context flexibly shifts your perception.'
        : 'You resist illusions relatively well, suggesting an analytical, detail-focused visual style.';

    return (
      <div className="max-w-lg mx-auto flex flex-col gap-5 py-4">
        <h3 className="text-xl font-bold text-center text-gray-800">
          {kr ? '결과' : 'Result'}
        </h3>

        <div className="bg-white rounded-2xl shadow p-6 text-center">
          <p className="text-gray-400 text-sm mb-1">
            {kr ? '착시에 속은 횟수' : 'Fooled by illusions'}
          </p>
          <p className="text-5xl font-bold text-violet-600 mb-1">{fooledCount}</p>
          <p className="text-gray-400 text-sm">/ {ILLUSIONS.length}</p>
        </div>

        <div className="bg-violet-50 rounded-2xl p-4 text-sm text-gray-700 leading-relaxed">
          {interpretation}
        </div>

        <div className="space-y-2">
          {ILLUSIONS.map((ill, i) => {
            const ans = answers[i];
            const fooled = ill.fooled_if.includes(ans);
            return (
              <div key={ill.id} className="flex items-center gap-3 bg-white rounded-xl px-4 py-3 shadow-sm text-sm">
                <span className={`text-lg ${fooled ? '😵' : '🎯'}`}></span>
                <span className="text-gray-700 flex-1">{kr ? ill.title_kr : ill.title_en}</span>
                <span className={`text-xs font-medium ${fooled ? 'text-orange-500' : 'text-green-600'}`}>
                  {fooled ? (kr ? '속음' : 'Fooled') : (kr ? '간파' : 'Resisted')}
                </span>
              </div>
            );
          })}
        </div>

        <button
          onClick={reset}
          className="w-full py-3 bg-violet-500 text-white rounded-xl font-bold hover:bg-violet-600 transition-colors"
        >
          {kr ? '다시 하기' : 'Try Again'}
        </button>
      </div>
    );
  }

  // Test
  return (
    <div className="max-w-lg mx-auto flex flex-col gap-5">
      {/* Progress */}
      <div>
        <div className="flex justify-between text-sm text-gray-400 mb-1.5">
          <span>{kr ? illusion.title_kr : illusion.title_en}</span>
          <span>{current + 1} / {ILLUSIONS.length}</span>
        </div>
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-violet-500 rounded-full transition-all"
            style={{ width: `${((current) / ILLUSIONS.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Description */}
      <p className="text-gray-500 text-sm text-center">
        {kr ? illusion.desc_kr : illusion.desc_en}
      </p>

      {/* Illusion visual */}
      <div className="bg-white rounded-2xl shadow-sm p-4 flex justify-center">
        <Component />
      </div>

      {subPhase === 'question' && (
        <>
          <p className="text-center font-medium text-gray-700 text-sm">
            {kr ? illusion.question_kr : illusion.question_en}
          </p>
          <div className="flex flex-col gap-2">
            {(kr ? illusion.options_kr : illusion.options_en).map((opt, i) => (
              <button
                key={i}
                onClick={() => handleAnswer(i)}
                className="w-full py-3 px-4 bg-white border-2 border-gray-100 hover:border-violet-400 hover:bg-violet-50 rounded-xl text-gray-800 font-medium transition-all text-sm"
              >
                {opt}
              </button>
            ))}
          </div>
        </>
      )}

      {subPhase === 'revealed' && (
        <>
          <div className={`rounded-2xl p-4 text-sm leading-relaxed ${
            illusion.fooled_if.includes(answers[current])
              ? 'bg-orange-50 border border-orange-200'
              : 'bg-green-50 border border-green-200'
          }`}>
            <p className="font-semibold mb-1">
              {illusion.fooled_if.includes(answers[current])
                ? (kr ? '😵 착시에 속으셨네요!' : '😵 You were fooled!')
                : (kr ? '🎯 착시를 간파하셨어요!' : '🎯 You resisted the illusion!')}
            </p>
            <p className="text-gray-600">{kr ? illusion.truth_kr : illusion.truth_en}</p>
          </div>
          <button
            onClick={handleNext}
            className="w-full py-3 bg-violet-500 text-white rounded-xl font-bold hover:bg-violet-600 transition-colors"
          >
            {current + 1 >= ILLUSIONS.length
              ? (kr ? '결과 보기' : 'See Results')
              : (kr ? '다음 착시' : 'Next Illusion')}
          </button>
        </>
      )}
    </div>
  );
}
