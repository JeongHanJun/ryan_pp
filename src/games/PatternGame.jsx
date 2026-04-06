import { useState, useRef } from 'react';

const GRID = 4; // 4×4 = 16 cells
const INITIAL_LEN = 3;
const TOTAL = GRID * GRID;

export default function PatternGame({ onGameEnd, lang = 'kr' }) {
  const [sequence, setSequence]   = useState([]);
  const [userInput, setUserInput] = useState([]);
  const [phase, setPhase]         = useState('idle');
  const [flashCell, setFlashCell] = useState(null);
  const [seqLen, setSeqLen]       = useState(INITIAL_LEN);
  const [score, setScore]         = useState(0);
  const [best, setBest]           = useState(0);
  const timerRef = useRef(null);
  const kr = lang === 'kr';

  const clear = () => clearTimeout(timerRef.current);

  const makeSeq = (len) => Array.from({ length: len }, () => Math.floor(Math.random() * TOTAL));

  const flash = (seq, currentScore = 0) => {
    setPhase('showing');
    setUserInput([]);
    const on  = Math.max(350, 650 - currentScore * 15);
    const off = Math.max(150, 300 - currentScore * 8);
    let i = 0;
    const next = () => {
      if (i >= seq.length) {
        timerRef.current = setTimeout(() => setPhase('input'), on);
        return;
      }
      setFlashCell(seq[i]);
      timerRef.current = setTimeout(() => {
        setFlashCell(null);
        i++;
        timerRef.current = setTimeout(next, off);
      }, on);
    };
    timerRef.current = setTimeout(next, 600);
  };

  const start = () => {
    clear();
    const seq = makeSeq(INITIAL_LEN);
    setSequence(seq);
    setSeqLen(INITIAL_LEN);
    setScore(0);
    flash(seq, 0);
  };

  const click = (idx) => {
    if (phase !== 'input') return;
    const pos = userInput.length;
    if (idx !== sequence[pos]) {
      clear();
      setBest(b => Math.max(b, score));
      setPhase('failed');
      if (onGameEnd) onGameEnd(score);
      return;
    }
    const next = [...userInput, idx];
    if (next.length === sequence.length) {
      const ns = score + 1;
      const nl = seqLen + 1;
      setScore(ns);
      setSeqLen(nl);
      setPhase('success');
      timerRef.current = setTimeout(() => {
        const seq = makeSeq(nl);
        setSequence(seq);
        flash(seq, ns);
      }, 700);
    } else {
      setUserInput(next);
    }
  };

  const reset = () => {
    clear();
    setPhase('idle');
    setSequence([]);
    setUserInput([]);
    setFlashCell(null);
    setScore(0);
    setSeqLen(INITIAL_LEN);
  };

  const statusText = {
    idle:    kr ? '순서대로 켜지는 칸을 기억하고 클릭하세요' : 'Memorize the flashing cells and click in order',
    showing: kr ? `패턴을 기억하세요... (${sequence.length}칸)` : `Memorize the pattern... (${sequence.length} cells)`,
    input:   kr ? `기억한 순서대로 클릭! (${userInput.length}/${sequence.length})` : `Click in order! (${userInput.length}/${sequence.length})`,
    success: kr ? '✅ 완벽해요! 다음 라운드...' : '✅ Perfect! Next round...',
    failed:  kr ? `❌ 틀렸습니다. 최종 레벨: ${seqLen - 1}칸` : `❌ Wrong! Final: ${seqLen - 1} cells`,
  };

  return (
    <div className="flex flex-col items-center gap-4 py-2">
      {/* Score */}
      <div className="flex gap-4">
        <div className="text-center bg-gray-50 rounded-xl px-5 py-2">
          <p className="text-xs text-gray-400">{kr ? '레벨 (칸 수)' : 'Level (cells)'}</p>
          <p className="text-2xl font-bold text-purple-600">{sequence.length}</p>
        </div>
        <div className="text-center bg-gray-50 rounded-xl px-5 py-2">
          <p className="text-xs text-gray-400">{kr ? '최고 레벨' : 'Best'}</p>
          <p className="text-2xl font-bold text-gray-700">{best}</p>
        </div>
      </div>

      {/* Status */}
      <p className={`text-sm font-medium min-h-5 text-center px-4 ${
        phase === 'failed'  ? 'text-red-500' :
        phase === 'success' ? 'text-green-600' :
        phase === 'input'   ? 'text-blue-600' : 'text-gray-500'
      }`}>
        {statusText[phase] || ''}
      </p>

      {/* 4×4 Grid */}
      <div
        className="grid gap-2"
        style={{ gridTemplateColumns: `repeat(${GRID}, 1fr)` }}
      >
        {Array.from({ length: TOTAL }, (_, i) => {
          const isFlashing = flashCell === i;
          const clickPos   = userInput.indexOf(i);
          const isClicked  = clickPos !== -1;
          return (
            <button
              key={i}
              onClick={() => click(i)}
              disabled={phase !== 'input'}
              className={`w-14 h-14 sm:w-16 sm:h-16 rounded-xl transition-all duration-100 font-bold text-base select-none
                ${isFlashing
                  ? 'bg-yellow-300 scale-90 shadow-inner text-yellow-800'
                  : isClicked
                  ? 'bg-blue-400 text-white scale-95'
                  : phase === 'input'
                  ? 'bg-gray-200 hover:bg-purple-200 cursor-pointer text-transparent'
                  : 'bg-gray-200 cursor-default text-transparent'
                }`}
            >
              {isClicked ? clickPos + 1 : isFlashing ? '●' : ''}
            </button>
          );
        })}
      </div>

      {/* Sequence progress dots */}
      {sequence.length > 0 && (
        <div className="flex gap-1.5 flex-wrap justify-center max-w-xs">
          {sequence.map((_, i) => (
            <span
              key={i}
              className={`w-2.5 h-2.5 rounded-full transition-colors ${
                i < userInput.length ? 'bg-blue-400' : 'bg-gray-200'
              }`}
            />
          ))}
        </div>
      )}

      {/* Buttons */}
      {phase === 'idle' && (
        <button onClick={start} className="px-8 py-3 bg-purple-500 text-white rounded-xl font-bold hover:bg-purple-600 transition-colors">
          {kr ? '시작하기' : 'Start'}
        </button>
      )}
      {phase === 'failed' && (
        <button onClick={reset} className="px-8 py-3 bg-purple-500 text-white rounded-xl font-bold hover:bg-purple-600 transition-colors">
          {kr ? '다시 하기' : 'Play Again'}
        </button>
      )}

      {/* Difficulty note */}
      {phase === 'idle' && (
        <p className="text-xs text-gray-400 text-center max-w-xs">
          {kr
            ? '레벨이 올라갈수록 기억해야 할 칸 수가 늘어나고, 속도도 빨라집니다'
            : 'Each level adds one more cell and increases speed'}
        </p>
      )}
    </div>
  );
}
