import { useState, useEffect, useCallback, useMemo } from 'react';
import { saveGameScore, getGameBestScore } from '../api/game';

// ── 타일 이미지 12종 ──
const TILE_IMAGES = [
  '/face_images/Neo.png',
  '/face_images/apeach.png',
  '/face_images/apeach_2.png',
  '/face_images/choonsik.png',
  '/face_images/frodo.png',
  '/face_images/jay_g.png',
  '/face_images/muzi.png',
  '/face_images/muzi_and_con.png',
  '/face_images/neo_2.png',
  '/face_images/ryan.png',
  '/face_images/tube.png',
  '/face_images/tube_2.png',
];

const TILE_SIZE = 76;    // px
const LAYER_OFFSET = 10; // px per layer
const SLOT_MAX = 7;
const GRID_COLS = 7;
const GRID_ROWS = 5;

// 레이어 수별 최대 위치 수 (GRID_COLS=7, GRID_ROWS=5 기준)
// 짝수 레이어: 7×5=35, 홀수 레이어: 6×4=24
const MAX_POSITIONS = { 2: 59, 3: 94, 4: 118, 5: 153 };

// ── 유틸 ──
function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ── 스테이지 설정 (난이도 급격히 상승) ──
// Stage | Types | Layers | Sets | Tiles
//   1   |   3   |   2    |   2  |  18
//   2   |   4   |   3    |   2  |  24
//   3   |   5   |   3    |   3  |  45
//   4   |   6   |   4    |   3  |  54
//   5   |   7   |   4    |   4  |  84
//   6   |   8   |   5    |   4  |  96
//   7   |   9   |   5    |   5  | 135
//   8   |  10   |   5    |   5  | 150
//   9   |  11   |   5    |   4  | 132 (cap)
//  10   |  12   |   5    |   4  | 144 (cap)
function getStageConfig(stage) {
  const typeCount = Math.min(12, 2 + stage);
  const layers = Math.min(5, 2 + Math.floor(stage / 2));
  const desiredSets = 2 + Math.floor((stage - 1) / 2);
  const maxPos = MAX_POSITIONS[layers] ?? 153;
  const setsPerType = Math.max(2, Math.min(desiredSets, Math.floor(maxPos / (typeCount * 3))));
  return { typeCount, layers, setsPerType };
}

// ── 보드 생성 ──
// 홀수 레이어: 0.5 오프셋 → 아래 레이어 타일 위에 걸쳐서 가림
function generateBoard(stage) {
  const { typeCount, layers, setsPerType } = getStageConfig(stage);
  const totalTiles = typeCount * 3 * setsPerType;

  const allPositions = [];
  for (let layer = 0; layer < layers; layer++) {
    const half = layer % 2 === 1 ? 0.5 : 0;
    const maxC = half ? GRID_COLS - 2 : GRID_COLS - 1;
    const maxR = half ? GRID_ROWS - 2 : GRID_ROWS - 1;
    for (let c = 0; c <= maxC; c++) {
      for (let r = 0; r <= maxR; r++) {
        allPositions.push({ x: c + half, y: r + half, layer });
      }
    }
  }

  const selected = shuffleArray(allPositions).slice(0, totalTiles);

  const typeArray = [];
  for (let s = 0; s < setsPerType; s++) {
    for (let t = 0; t < typeCount; t++) {
      typeArray.push(t, t, t);
    }
  }
  const shuffledTypes = shuffleArray(typeArray);

  return selected.map((pos, idx) => ({
    id: idx,
    x: pos.x,
    y: pos.y,
    layer: pos.layer,
    type: shuffledTypes[idx],
    removed: false,
  }));
}

// ── 타일 차단 여부 ──
// 더 높은 레이어 타일이 1칸 미만 거리로 겹치면 가려진 것으로 판정
function isTileBlocked(tile, tiles) {
  return tiles.some(other => {
    if (other.id === tile.id || other.removed || other.layer <= tile.layer) return false;
    return Math.abs(other.x - tile.x) < 1 && Math.abs(other.y - tile.y) < 1;
  });
}

export default function TileMatchGame({ onGameEnd }) {
  const [stage, setStage] = useState(1);
  const [tiles, setTiles] = useState([]);
  const [slot, setSlot] = useState([]);
  const [gameState, setGameState] = useState('playing'); // 'playing' | 'clear' | 'over'
  const [shuffleLeft, setShuffleLeft] = useState(2);
  const [undoStack, setUndoStack] = useState([]);
  const [bestStage, setBestStage] = useState(0);
  const [saving, setSaving] = useState(false);
  const [matchFlash, setMatchFlash] = useState(false);

  // 최고 스테이지 로드
  useEffect(() => {
    getGameBestScore('tile_match')
      .then(res => setBestStage(res.data.best_score))
      .catch(() => {});
  }, []);

  // 스테이지 초기화
  useEffect(() => {
    setTiles(generateBoard(stage));
    setSlot([]);
    setGameState('playing');
    setShuffleLeft(2);
    setUndoStack([]);
  }, [stage]);

  // 차단 타일 목록 (매 렌더마다 O(n²) 반복 방지)
  const blockedIds = useMemo(() => {
    const s = new Set();
    tiles.forEach(tile => {
      if (!tile.removed && isTileBlocked(tile, tiles)) s.add(tile.id);
    });
    return s;
  }, [tiles]);

  // ── 타일 클릭 ──
  const handleTileClick = useCallback((tile) => {
    if (gameState !== 'playing') return;
    if (tile.removed) return;
    if (blockedIds.has(tile.id)) return;
    if (slot.length >= SLOT_MAX) return;

    // 언두 스냅샷
    setUndoStack(prev => [...prev, {
      tiles: tiles.map(t => ({ ...t })),
      slot: slot.map(t => ({ ...t })),
    }]);

    const newTiles = tiles.map(t => t.id === tile.id ? { ...t, removed: true } : t);
    const uid = `${tile.id}_${Date.now()}`;
    const newSlot = [...slot, { ...tile, uid }];

    // 3-매치 체크
    const counts = {};
    newSlot.forEach(t => { counts[t.type] = (counts[t.type] || 0) + 1; });
    const matchTypeStr = Object.keys(counts).find(k => counts[k] >= 3);

    let finalSlot = newSlot;
    let newGameState = 'playing';

    if (matchTypeStr) {
      const mType = parseInt(matchTypeStr);
      let removed = 0;
      finalSlot = newSlot.filter(t => {
        if (t.type === mType && removed < 3) { removed++; return false; }
        return true;
      });
      setMatchFlash(true);
      setTimeout(() => setMatchFlash(false), 350);

      if (newTiles.every(t => t.removed) && finalSlot.length === 0) {
        newGameState = 'clear';
      }
    } else if (newSlot.length >= SLOT_MAX) {
      newGameState = 'over';
    }

    setTiles(newTiles);
    setSlot(finalSlot);
    setGameState(newGameState);

    if (newGameState === 'clear') {
      setSaving(true);
      saveGameScore('tile_match', stage)
        .then(() => getGameBestScore('tile_match'))
        .then(res => setBestStage(res.data.best_score))
        .catch(() => {})
        .finally(() => setSaving(false));
      onGameEnd?.(stage);
    } else if (newGameState === 'over') {
      onGameEnd?.(stage - 1);
    }
  }, [tiles, slot, blockedIds, gameState, stage, onGameEnd]);

  // ── 셔플 ──
  const handleShuffle = () => {
    if (shuffleLeft <= 0 || gameState !== 'playing') return;
    const activeTypes = shuffleArray(tiles.filter(t => !t.removed).map(t => t.type));
    let idx = 0;
    setTiles(prev => prev.map(t => t.removed ? t : { ...t, type: activeTypes[idx++] }));
    setShuffleLeft(prev => prev - 1);
  };

  // ── 되돌리기 ──
  const handleUndo = () => {
    if (undoStack.length === 0 || gameState !== 'playing') return;
    const last = undoStack[undoStack.length - 1];
    setTiles(last.tiles);
    setSlot(last.slot);
    setUndoStack(prev => prev.slice(0, -1));
  };

  const handleNextStage = () => setStage(s => s + 1);
  const handleRetry = () => {
    setTiles(generateBoard(stage));
    setSlot([]);
    setGameState('playing');
    setShuffleLeft(2);
    setUndoStack([]);
  };

  // ── 렌더 계산 ──
  const { layers: maxLayers, typeCount, setsPerType } = getStageConfig(stage);
  const padTop = (maxLayers - 1) * LAYER_OFFSET;
  const containerW = GRID_COLS * TILE_SIZE + (maxLayers - 1) * LAYER_OFFSET;
  const containerH = GRID_ROWS * TILE_SIZE + padTop;

  const activeTileCount = tiles.filter(t => !t.removed).length;
  const displaySlot = [...slot].sort((a, b) => a.type - b.type);

  // 낮은 레이어 먼저 렌더 (높은 레이어가 위에 표시)
  const sortedTiles = [...tiles]
    .filter(t => !t.removed)
    .sort((a, b) => a.layer !== b.layer ? a.layer - b.layer : (a.y + a.x) - (b.y + b.x));

  return (
    <div className="flex flex-col items-center gap-4 select-none">

      {/* ─── 헤더 ─── */}
      <div className="flex items-center justify-between w-full max-w-xl px-1">
        <div className="flex gap-4">
          <div className="text-center">
            <div className="text-xs text-gray-400">스테이지</div>
            <div className="text-2xl font-bold text-purple-600">{stage}</div>
          </div>
          <div className="text-center">
            <div className="text-xs text-gray-400">남은 타일</div>
            <div className="text-2xl font-bold text-blue-600">{activeTileCount}</div>
          </div>
          <div className="text-center">
            <div className="text-xs text-gray-400">최고</div>
            <div className="text-2xl font-bold text-yellow-500">{bestStage}</div>
          </div>
          <div className="text-center hidden sm:block">
            <div className="text-xs text-gray-400">레이어</div>
            <div className="text-2xl font-bold text-slate-500">{maxLayers}</div>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleShuffle}
            disabled={shuffleLeft <= 0}
            className="px-3 py-1.5 bg-blue-500 text-white rounded-lg text-sm font-bold hover:bg-blue-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            🔀 셔플({shuffleLeft})
          </button>
          <button
            onClick={handleUndo}
            disabled={undoStack.length === 0}
            className="px-3 py-1.5 bg-orange-500 text-white rounded-lg text-sm font-bold hover:bg-orange-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            ↩ 되돌리기
          </button>
        </div>
      </div>

      {/* ─── 게임 보드 ─── */}
      <div
        className="relative bg-amber-50 border-2 border-amber-200 rounded-2xl overflow-x-auto"
        style={{ maxWidth: '100%' }}
      >
        <div style={{ width: containerW + 16, height: containerH + 16, padding: 8 }}>
          <div className="relative" style={{ width: containerW, height: containerH }}>
            {sortedTiles.map(tile => {
              const blocked = blockedIds.has(tile.id);
              const left = tile.x * TILE_SIZE + tile.layer * LAYER_OFFSET;
              const top = tile.y * TILE_SIZE - tile.layer * LAYER_OFFSET + padTop;
              const zIdx = tile.layer * 1000 + Math.floor(tile.y) * 10 + Math.floor(tile.x);

              return (
                <div
                  key={tile.id}
                  onClick={() => !blocked && handleTileClick(tile)}
                  style={{
                    position: 'absolute',
                    left,
                    top,
                    width: TILE_SIZE,
                    height: TILE_SIZE,
                    zIndex: zIdx,
                    cursor: blocked ? 'default' : 'pointer',
                    transition: 'transform 0.1s',
                  }}
                  className={`rounded-xl border-2 overflow-hidden
                    ${blocked
                      ? 'border-slate-500/60'
                      : 'border-yellow-300 shadow-md hover:shadow-xl hover:-translate-y-0.5 active:scale-95'
                    }`}
                >
                  {blocked ? (
                    /* 가려진 타일: 이미지를 희미하게 표시 */
                    <div className="relative w-full h-full">
                      <img
                        src={TILE_IMAGES[tile.type]}
                        alt=""
                        className="w-full h-full object-cover"
                        draggable={false}
                        style={{ opacity: 0.35 }}
                      />
                      <div
                        className="absolute inset-0"
                        style={{
                          background: `rgba(15, 10, 40, ${0.42 + tile.layer * 0.06})`,
                        }}
                      />
                    </div>
                  ) : (
                    /* 클릭 가능한 타일: 이미지 표시 */
                    <img
                      src={TILE_IMAGES[tile.type]}
                      alt=""
                      className="w-full h-full object-cover"
                      draggable={false}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ─── 슬롯 ─── */}
      <div
        className={`flex items-center gap-1.5 rounded-2xl p-3 border-2 transition-all
          ${slot.length >= SLOT_MAX ? 'bg-red-50 border-red-300' : 'bg-gray-100 border-gray-200'}
          ${matchFlash ? 'ring-4 ring-green-400' : ''}
        `}
      >
        {Array.from({ length: SLOT_MAX }).map((_, i) => {
          const tile = displaySlot[i];
          return (
            <div
              key={i}
              className={`rounded-lg border-2 overflow-hidden flex items-center justify-center transition-all
                ${tile
                  ? 'border-purple-400 bg-white shadow'
                  : 'border-dashed border-gray-300 bg-gray-50'
                }`}
              style={{ width: TILE_SIZE - 4, height: TILE_SIZE - 4 }}
            >
              {tile && (
                <img
                  src={TILE_IMAGES[tile.type]}
                  alt=""
                  className="w-full h-full object-cover"
                  draggable={false}
                />
              )}
            </div>
          );
        })}
      </div>

      {slot.length >= SLOT_MAX - 1 && gameState === 'playing' && (
        <p className="text-red-500 text-sm font-bold animate-pulse">⚠️ 슬롯이 거의 가득 찼습니다!</p>
      )}

      {/* ─── 스테이지 클리어 ─── */}
      {gameState === 'clear' && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-white rounded-3xl p-8 text-center shadow-2xl max-w-xs mx-4">
            <div className="text-5xl mb-3">🎉</div>
            <h2 className="text-2xl font-bold text-purple-700 mb-1">Stage {stage} Clear!</h2>
            <p className="text-gray-500 mb-1">모든 타일을 제거했습니다!</p>
            <p className="text-sm text-yellow-600 font-bold mb-5">
              {saving ? '저장 중...' : `🏆 최고 스테이지: ${bestStage}`}
            </p>
            <button
              onClick={handleNextStage}
              className="w-full py-3 bg-purple-600 text-white rounded-xl font-bold text-lg hover:bg-purple-700 transition-colors"
            >
              다음 스테이지 ({stage + 1}) →
            </button>
          </div>
        </div>
      )}

      {/* ─── 게임 오버 ─── */}
      {gameState === 'over' && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-white rounded-3xl p-8 text-center shadow-2xl max-w-xs mx-4">
            <div className="text-5xl mb-3">😵</div>
            <h2 className="text-2xl font-bold text-red-600 mb-1">Game Over</h2>
            <p className="text-gray-500 mb-1">슬롯이 가득 찼습니다!</p>
            <p className="text-gray-600 mb-5">
              클리어: <span className="font-bold text-purple-600">{stage - 1}</span> 스테이지
              &nbsp;·&nbsp; 최고: <span className="font-bold text-yellow-500">{bestStage}</span>
            </p>
            <div className="flex gap-3">
              <button
                onClick={handleRetry}
                className="flex-1 py-3 bg-blue-500 text-white rounded-xl font-bold hover:bg-blue-600 transition-colors"
              >
                재시도
              </button>
              <button
                onClick={() => setStage(1)}
                className="flex-1 py-3 bg-gray-200 text-gray-700 rounded-xl font-bold hover:bg-gray-300 transition-colors"
              >
                처음부터
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
