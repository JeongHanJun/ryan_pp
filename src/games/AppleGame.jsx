import { useEffect, useRef, useState, useCallback } from 'react';
import { saveGameScore, getGameBestScore } from '../api/game';

const COLS = 17;
const ROWS = 10;
const CELL = 48;
const PAD = 2;
const TOTAL_TIME = 120; // 2분

const APPLE_RED = '#e53e3e';
const APPLE_DARK = '#c53030';
const APPLE_LIGHT = '#feb2b2';
const SELECT_BORDER = '#3182ce';
const MATCH_BORDER = '#e53e3e';
const MATCH_BG = 'rgba(229,62,62,0.18)';
const SELECT_BG = 'rgba(49,130,206,0.12)';
const CLEARED_BG = '#f0f4f8';

function makeGrid() {
  // 1~9 랜덤, 합이 10이 되는 쌍이 충분히 생기도록 단순 랜덤
  return Array.from({ length: ROWS }, () =>
    Array.from({ length: COLS }, () => Math.floor(Math.random() * 9) + 1)
  );
}

function drawApple(ctx, cx, cy, r, num, selected, matched, cleared) {
  if (cleared) {
    ctx.fillStyle = CLEARED_BG;
    ctx.beginPath();
    ctx.roundRect(cx - r, cy - r, r * 2, r * 2, 6);
    ctx.fill();
    return;
  }

  // 사과 원형 그라디언트
  const grad = ctx.createRadialGradient(cx - r * 0.2, cy - r * 0.25, r * 0.1, cx, cy, r * 0.95);
  grad.addColorStop(0, APPLE_LIGHT);
  grad.addColorStop(0.4, APPLE_RED);
  grad.addColorStop(1, APPLE_DARK);

  ctx.beginPath();
  ctx.arc(cx, cy, r - 1, 0, Math.PI * 2);
  ctx.fillStyle = grad;
  ctx.fill();

  // 꼭지 (stem)
  ctx.beginPath();
  ctx.moveTo(cx, cy - r + 2);
  ctx.quadraticCurveTo(cx + 5, cy - r - 5, cx + 8, cy - r - 3);
  ctx.strokeStyle = '#276749';
  ctx.lineWidth = 2;
  ctx.stroke();

  // 선택/매칭 테두리
  if (matched) {
    ctx.beginPath();
    ctx.arc(cx, cy, r - 1, 0, Math.PI * 2);
    ctx.strokeStyle = MATCH_BORDER;
    ctx.lineWidth = 3;
    ctx.stroke();
  } else if (selected) {
    ctx.beginPath();
    ctx.arc(cx, cy, r - 1, 0, Math.PI * 2);
    ctx.strokeStyle = SELECT_BORDER;
    ctx.lineWidth = 3;
    ctx.stroke();
  }

  // 숫자
  ctx.fillStyle = '#fff';
  ctx.font = `bold ${r * 0.85}px Arial`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(0,0,0,0.4)';
  ctx.shadowBlur = 3;
  ctx.fillText(String(num), cx, cy + 1);
  ctx.shadowBlur = 0;
}

function getCellFromPos(x, y) {
  const col = Math.floor(x / CELL);
  const row = Math.floor(y / CELL);
  if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return null;
  return { row, col };
}

function getRect(p1, p2) {
  return {
    r1: Math.min(p1.row, p2.row),
    c1: Math.min(p1.col, p2.col),
    r2: Math.max(p1.row, p2.row),
    c2: Math.max(p1.col, p2.col),
  };
}

function getCellsInRect(rect, grid) {
  const cells = [];
  for (let r = rect.r1; r <= rect.r2; r++) {
    for (let c = rect.c1; c <= rect.c2; c++) {
      if (grid[r][c] !== null) cells.push({ row: r, col: c });
    }
  }
  return cells;
}

function sumCells(cells, grid) {
  return cells.reduce((s, { row, col }) => s + (grid[row][col] ?? 0), 0);
}

export default function AppleGame({ onGameEnd }) {
  const canvasRef = useRef(null);
  const gridRef = useRef(makeGrid());
  const dragRef = useRef(null); // { startCell, currentCell }
  const animRef = useRef(null);
  const flashRef = useRef(null); // 매칭 시 flash 효과

  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(TOTAL_TIME);
  const [gameOver, setGameOver] = useState(false);
  const [bestScore, setBestScore] = useState(0);
  const [saving, setSaving] = useState(false);
  const scoreRef = useRef(0);

  // 최고 기록 불러오기
  useEffect(() => {
    getGameBestScore('apple').then(res => setBestScore(res.data.best_score)).catch(() => {});
  }, []);

  // 타이머
  useEffect(() => {
    if (gameOver) return;
    const id = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) {
          clearInterval(id);
          setGameOver(true);
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [gameOver]);

  // 게임 종료 시 점수 저장
  useEffect(() => {
    if (!gameOver) return;
    setSaving(true);
    saveGameScore('apple', scoreRef.current)
      .then(() => getGameBestScore('apple'))
      .then(res => setBestScore(res.data.best_score))
      .catch(() => {})
      .finally(() => setSaving(false));
    onGameEnd?.(scoreRef.current);
  }, [gameOver]);

  // Canvas 드로우
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const grid = gridRef.current;
    const drag = dragRef.current;
    const flash = flashRef.current; // { cells, until }

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 배경
    ctx.fillStyle = '#f7fafc';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    let selectedCells = new Set();
    let matchedCells = new Set();
    let rect = null;

    if (drag && drag.startCell && drag.currentCell) {
      rect = getRect(drag.startCell, drag.currentCell);
      const cells = getCellsInRect(rect, grid);
      const s = sumCells(cells, grid);
      const key = c => `${c.row},${c.col}`;
      if (s === 10) {
        cells.forEach(c => matchedCells.add(key(c)));
      } else {
        cells.forEach(c => selectedCells.add(key(c)));
      }
    }

    // flash (방금 제거된 셀들)
    let flashSet = new Set();
    if (flash && Date.now() < flash.until) {
      flash.cells.forEach(c => flashSet.add(`${c.row},${c.col}`));
    }

    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const cx = c * CELL + CELL / 2;
        const cy = r * CELL + CELL / 2;
        const cellR = CELL / 2 - PAD;
        const key = `${r},${c}`;
        const cleared = grid[r][c] === null;
        const isFlash = flashSet.has(key);

        if (isFlash) {
          // 반짝이는 효과
          ctx.beginPath();
          ctx.arc(cx, cy, cellR - 1, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(255,215,0,0.7)';
          ctx.fill();
        } else {
          drawApple(
            ctx, cx, cy, cellR,
            grid[r][c],
            selectedCells.has(key),
            matchedCells.has(key),
            cleared
          );
        }
      }
    }

    // 드래그 사각형 오버레이
    if (rect) {
      const cells = getCellsInRect(rect, grid);
      const s = sumCells(cells, grid);
      const px = rect.c1 * CELL + 2;
      const py = rect.r1 * CELL + 2;
      const pw = (rect.c2 - rect.c1 + 1) * CELL - 4;
      const ph = (rect.r2 - rect.r1 + 1) * CELL - 4;

      ctx.strokeStyle = s === 10 ? MATCH_BORDER : SELECT_BORDER;
      ctx.fillStyle = s === 10 ? MATCH_BG : SELECT_BG;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(px, py, pw, ph, 6);
      ctx.fill();
      ctx.stroke();

      // 합계 표시
      ctx.fillStyle = s === 10 ? MATCH_BORDER : SELECT_BORDER;
      ctx.font = 'bold 14px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`합계: ${s}${s === 10 ? ' ✓' : ''}`, px + pw / 2, py - 10);
    }
  }, []);

  // 애니메이션 루프
  useEffect(() => {
    const loop = () => {
      draw();
      animRef.current = requestAnimationFrame(loop);
    };
    animRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animRef.current);
  }, [draw]);

  const getCanvasPos = (e, canvas) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    };
  };

  const handleMouseDown = useCallback((e) => {
    if (gameOver) return;
    const canvas = canvasRef.current;
    const { x, y } = getCanvasPos(e, canvas);
    const cell = getCellFromPos(x, y);
    if (!cell) return;
    dragRef.current = { startCell: cell, currentCell: cell };
  }, [gameOver]);

  const handleMouseMove = useCallback((e) => {
    if (!dragRef.current) return;
    const canvas = canvasRef.current;
    const { x, y } = getCanvasPos(e, canvas);
    const cell = getCellFromPos(x, y);
    if (cell) dragRef.current.currentCell = cell;
  }, []);

  const handleMouseUp = useCallback(() => {
    if (!dragRef.current) return;
    const grid = gridRef.current;
    const { startCell, currentCell } = dragRef.current;
    dragRef.current = null;

    if (!startCell || !currentCell) return;
    const rect = getRect(startCell, currentCell);
    const cells = getCellsInRect(rect, grid);
    const s = sumCells(cells, grid);

    if (s === 10 && cells.length > 0) {
      // flash 효과
      flashRef.current = { cells, until: Date.now() + 200 };

      setTimeout(() => {
        // 셀 제거
        cells.forEach(({ row, col }) => {
          gridRef.current[row][col] = null;
        });
        const cleared = cells.length;
        scoreRef.current += cleared;
        setScore(prev => prev + cleared);
      }, 200);
    }
  }, []);

  const handleRestart = () => {
    gridRef.current = makeGrid();
    dragRef.current = null;
    flashRef.current = null;
    scoreRef.current = 0;
    setScore(0);
    setTimeLeft(TOTAL_TIME);
    setGameOver(false);
  };

  const timerColor = timeLeft <= 30 ? 'text-red-600' : timeLeft <= 60 ? 'text-orange-500' : 'text-gray-700';
  const timerBg = timeLeft <= 30 ? 'bg-red-50 border-red-300' : 'bg-white border-gray-200';

  return (
    <div className="flex flex-col items-center gap-3">
      {/* 상단 상태바 */}
      <div className="flex items-center gap-4 w-full max-w-3xl justify-between px-2">
        <div className={`flex items-center gap-2 px-4 py-2 rounded-lg border ${timerBg}`}>
          <span className="text-sm text-gray-500">남은 시간</span>
          <span className={`text-2xl font-bold tabular-nums ${timerColor}`}>
            {String(Math.floor(timeLeft / 60)).padStart(2, '0')}:
            {String(timeLeft % 60).padStart(2, '0')}
          </span>
        </div>

        <div className="flex gap-4">
          <div className="text-center">
            <div className="text-xs text-gray-400">현재 점수</div>
            <div className="text-2xl font-bold text-blue-600 tabular-nums">{score}</div>
          </div>
          <div className="text-center">
            <div className="text-xs text-gray-400">최고 기록</div>
            <div className="text-2xl font-bold text-yellow-500 tabular-nums">{bestScore}</div>
          </div>
        </div>
      </div>

      {/* 사과 게임판 */}
      <div className="relative">
        <canvas
          ref={canvasRef}
          width={COLS * CELL}
          height={ROWS * CELL}
          className="border-2 border-gray-300 rounded-xl shadow-lg cursor-crosshair"
          style={{ maxWidth: '100%', touchAction: 'none' }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onTouchStart={handleMouseDown}
          onTouchMove={handleMouseMove}
          onTouchEnd={handleMouseUp}
        />

        {/* 게임 오버 오버레이 */}
        {gameOver && (
          <div className="absolute inset-0 bg-black/60 rounded-xl flex flex-col items-center justify-center gap-4">
            <div className="bg-white rounded-2xl px-10 py-8 text-center shadow-2xl">
              <div className="text-4xl mb-2">🍎</div>
              <h2 className="text-2xl font-bold text-gray-800 mb-1">게임 종료!</h2>
              <p className="text-gray-500 mb-4">
                {saving ? '점수 저장 중...' : '수고하셨습니다!'}
              </p>
              <div className="flex gap-8 justify-center mb-6">
                <div>
                  <div className="text-xs text-gray-400">최종 점수</div>
                  <div className="text-3xl font-bold text-blue-600">{score}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-400">최고 기록</div>
                  <div className="text-3xl font-bold text-yellow-500">{bestScore}</div>
                </div>
              </div>
              {score >= bestScore && score > 0 && (
                <p className="text-orange-500 font-bold mb-4">🎉 새 최고 기록!</p>
              )}
              <button
                onClick={handleRestart}
                className="px-6 py-3 bg-red-500 text-white rounded-xl font-bold hover:bg-red-600 transition-colors"
              >
                다시 하기
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 도움말 */}
      <p className="text-sm text-gray-400 text-center">
        합이 <strong>10</strong>이 되는 사과들을 드래그하여 선택하세요 · 제한시간 2분 · 최대 170점
      </p>
    </div>
  );
}
