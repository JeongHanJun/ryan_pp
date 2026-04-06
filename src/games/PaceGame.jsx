import { useState, useRef } from 'react';

const ROUNDS = 5;

// Average human visual reaction time: ~250ms
// Source: simple RT studies, choice RT is ~350ms
const RANKS = [
  { max: 180, label_kr: '번개 반사신경', label_en: 'Lightning Reflexes', emoji: '⚡', color: 'text-yellow-500', bg: 'bg-yellow-50' },
  { max: 230, label_kr: '매우 빠름',     label_en: 'Very Fast',           emoji: '🚀', color: 'text-blue-500',   bg: 'bg-blue-50'   },
  { max: 280, label_kr: '평균',           label_en: 'Average',             emoji: '👍', color: 'text-green-600', bg: 'bg-green-50'  },
  { max: 380, label_kr: '느린 편',        label_en: 'Slow',                emoji: '🐢', color: 'text-orange-500',bg: 'bg-orange-50' },
  { max: Infinity, label_kr: '매우 느림', label_en: 'Very Slow',           emoji: '🦥', color: 'text-red-400',   bg: 'bg-red-50'    },
];

function getRank(ms) {
  return RANKS.find(r => ms < r.max) || RANKS[RANKS.length - 1];
}

export default function PaceGame({ onGameEnd, lang = 'kr' }) {
  const [phase, setPhase]       = useState('idle');
  const [round, setRound]       = useState(0);
  const [times, setTimes]       = useState([]);
  const [startTime, setStart]   = useState(null);
  const [lastTime, setLastTime] = useState(null);
  const timerRef = useRef(null);
  const kr = lang === 'kr';

  const startRound = () => {
    setPhase('waiting');
    const delay = 1500 + Math.random() * 2500;
    timerRef.current = setTimeout(() => {
      setStart(performance.now());
      setPhase('active');
    }, delay);
  };

  const handle = () => {
    if (phase === 'idle') {
      startRound();
    } else if (phase === 'waiting') {
      clearTimeout(timerRef.current);
      setPhase('too_early');
    } else if (phase === 'active') {
      const ms = Math.round(performance.now() - startTime);
      setLastTime(ms);
      const next = [...times, ms];
      setTimes(next);
      if (round + 1 >= ROUNDS) {
        setPhase('finished');
        const avg = Math.round(next.reduce((a, b) => a + b, 0) / next.length);
        if (onGameEnd) onGameEnd(avg);
      } else {
        setRound(r => r + 1);
        setPhase('done');
      }
    } else if (phase === 'done' || phase === 'too_early') {
      startRound();
    }
  };

  const reset = () => {
    clearTimeout(timerRef.current);
    setPhase('idle');
    setRound(0);
    setTimes([]);
    setLastTime(null);
    setStart(null);
  };

  // Finished
  if (phase === 'finished') {
    const avg = Math.round(times.reduce((a, b) => a + b, 0) / times.length);
    const rank = getRank(avg);
    return (
      <div className="flex flex-col items-center gap-5 py-4">
        <div className={`${rank.bg} rounded-2xl p-6 w-full max-w-sm text-center`}>
          <div className="text-5xl mb-2">{rank.emoji}</div>
          <p className="text-gray-400 text-sm mb-1">{kr ? '평균 반응속도' : 'Average Reaction Time'}</p>
          <p className={`text-5xl font-bold ${rank.color}`}>
            {avg}<span className="text-xl text-gray-300 font-normal">ms</span>
          </p>
          <p className={`mt-2 text-lg font-semibold ${rank.color}`}>
            {kr ? rank.label_kr : rank.label_en}
          </p>
        </div>

        {/* Per-round */}
        <div className="w-full max-w-sm space-y-1">
          {times.map((t, i) => {
            const r = getRank(t);
            return (
              <div key={i} className="flex justify-between items-center bg-gray-50 rounded-lg px-4 py-2 text-sm">
                <span className="text-gray-400">Round {i + 1}</span>
                <span className="font-mono font-bold text-gray-700">{t}ms</span>
                <span className={`text-xs font-medium ${r.color}`}>{r.emoji} {kr ? r.label_kr : r.label_en}</span>
              </div>
            );
          })}
        </div>

        {/* Rank table */}
        <div className="w-full max-w-sm bg-gray-50 rounded-2xl p-4">
          <p className="text-xs font-semibold text-gray-400 mb-2">{kr ? '반응속도 기준' : 'Ranking Criteria'}</p>
          <div className="space-y-1">
            {RANKS.filter(r => r.max !== Infinity).map((r, i) => (
              <div key={i} className="flex justify-between text-xs text-gray-500">
                <span>{r.emoji} {kr ? r.label_kr : r.label_en}</span>
                <span className="text-gray-400">
                  {i === 0 ? `< ${r.max}ms` : `${RANKS[i - 1].max}–${r.max}ms`}
                </span>
              </div>
            ))}
            <div className="flex justify-between text-xs text-gray-500">
              <span>{RANKS[4].emoji} {kr ? RANKS[4].label_kr : RANKS[4].label_en}</span>
              <span className="text-gray-400">&gt; {RANKS[3].max}ms</span>
            </div>
          </div>
          <p className="text-xs text-gray-300 mt-2 border-t pt-2">
            {kr ? '인간 평균 시각 반응속도: 약 250ms' : 'Average human visual reaction time: ~250ms'}
          </p>
        </div>

        <button onClick={reset} className="px-8 py-3 bg-cyan-500 text-white rounded-xl font-bold hover:bg-cyan-600 transition-colors">
          {kr ? '다시 하기' : 'Play Again'}
        </button>
      </div>
    );
  }

  const cfg = {
    idle:      { bg: 'bg-gray-100 hover:bg-gray-200', title: kr ? '⏱ 반응속도 테스트' : '⏱ Reaction Test', sub: kr ? '초록색으로 변하면 최대한 빠르게 클릭!' : 'Click as fast as you can when it turns green!', hint: kr ? '클릭하여 시작' : 'Click to start' },
    waiting:   { bg: 'bg-red-100',   title: kr ? '준비...' : 'Wait...',  sub: kr ? '초록색이 될 때까지 기다리세요!' : 'Wait for green!', hint: '' },
    active:    { bg: 'bg-green-400', title: kr ? '지금!' : 'NOW!',        sub: kr ? '클릭하세요!' : 'Click!', hint: '' },
    too_early: { bg: 'bg-orange-100',title: kr ? '😅 너무 빨리!' : '😅 Too early!', sub: kr ? '초록색이 될 때까지 기다리세요' : 'Wait for green before clicking', hint: kr ? '클릭하여 재시도' : 'Click to retry' },
    done:      { bg: 'bg-blue-50',   title: `${lastTime}ms`, sub: (() => { const r = getRank(lastTime || 0); return `${r.emoji} ${kr ? r.label_kr : r.label_en}`; })(), hint: kr ? '클릭하여 계속' : 'Click to continue' },
  };
  const { bg, title, sub, hint } = cfg[phase] || cfg.idle;

  return (
    <div className="flex flex-col items-center gap-4 py-2">
      <div className="flex gap-4">
        <div className="bg-gray-50 rounded-xl px-4 py-2 text-center">
          <p className="text-xs text-gray-400">Round</p>
          <p className="text-xl font-bold text-gray-700">{Math.min(round + 1, ROUNDS)} / {ROUNDS}</p>
        </div>
        {times.length > 0 && (
          <div className="bg-gray-50 rounded-xl px-4 py-2 text-center">
            <p className="text-xs text-gray-400">{kr ? '현재 평균' : 'Avg so far'}</p>
            <p className="text-xl font-bold text-cyan-600">
              {Math.round(times.reduce((a, b) => a + b, 0) / times.length)}ms
            </p>
          </div>
        )}
      </div>

      <div
        onClick={handle}
        className={`w-full max-w-md h-60 ${bg} rounded-3xl flex flex-col items-center justify-center gap-2 cursor-pointer select-none transition-colors duration-100 shadow-inner`}
      >
        <p className="text-4xl font-bold text-gray-700">{title}</p>
        <p className="text-gray-500 text-sm text-center px-4">{sub}</p>
        {hint && <p className="text-gray-400 text-xs mt-1">{hint}</p>}
      </div>

      {times.length > 0 && (
        <div className="flex flex-wrap gap-2 justify-center">
          {times.map((t, i) => {
            const r = getRank(t);
            return (
              <span key={i} className={`text-xs ${r.bg} ${r.color} rounded-lg px-2 py-1 font-mono font-medium`}>
                {r.emoji} {t}ms
              </span>
            );
          })}
        </div>
      )}

      {/* Criteria hint during play */}
      {(phase === 'idle' || phase === 'waiting') && (
        <p className="text-xs text-gray-400 text-center">
          {kr ? '인간 평균 시각 반응속도: 약 250ms' : 'Avg human visual reaction time: ~250ms'}
        </p>
      )}
    </div>
  );
}
