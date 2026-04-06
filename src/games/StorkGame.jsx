import { useEffect, useRef, useState, useCallback } from 'react';
import { saveGameScore, getGameBestScore } from '../api/game';

// 물리 상수
const MAX_ANGLE = 90;         // 배/등이 땅에 닿는 각도 (도) — 완전히 쓰러졌을 때 Game Over
const WOBBLE_STRENGTH = 0.55; // 자연 흔들림 세기 (높을수록 불안정)
const CORRECTION_FORCE = 0.20; // 키 보정 힘
const DAMPING = 0.83;         // 각속도 감쇠 (낮을수록 더 불안정)
const GRAVITY_STRENGTH = 0.09; // 기울수록 더 쏠리는 불안정 중력
const WALK_SPEED = 0.5;       // 거리/프레임
const DIFFICULTY_RAMP = 0.0010; // 거리에 따라 wobble 증가율
const DISTANCE_SCALE = 0.1;  // 표시/저장 거리 배율 (내부 거리의 10%)
// 주기적 충격 (갑작스러운 흔들림)
const GUST_INTERVAL = 70;     // 프레임마다 돌풍 체크
const GUST_CHANCE = 0.50;     // 돌풍 발생 확률
const GUST_FORCE = 0.90;      // 돌풍 강도

// 캐릭터 크기
const CHAR_W = 100;
const CHAR_H = 140;

// Canvas 크기
const W = 750;
const H = 420;

// 바닥 y
const GROUND_Y = H - 60;

// ── 시각 효과 헬퍼 ──
function makeRainDrops(count = 70) {
  return Array.from({ length: count }, () => ({
    x: Math.random() * W,
    y: Math.random() * (GROUND_Y + 10),
    speed: 4 + Math.random() * 4,
    len: 8 + Math.random() * 8,
  }));
}

function genLightningBolt(startX) {
  const pts = [{ x: startX, y: 0 }];
  let x = startX;
  const segs = 5 + Math.floor(Math.random() * 4);
  for (let i = 1; i <= segs; i++) {
    x += (Math.random() - 0.5) * 50;
    pts.push({ x: Math.max(10, Math.min(W - 10, x)), y: (GROUND_Y / segs) * i });
  }
  return pts;
}

function makeWindStreaks(dir) {
  return Array.from({ length: 12 }, () => ({
    x: Math.random() * W,
    y: 20 + Math.random() * (GROUND_Y - 30),
    len: 20 + Math.random() * 55,
    dir,
  }));
}

export default function StorkGame({ onGameEnd }) {
  const canvasRef = useRef(null);
  const animRef = useRef(null);
  const imgRef = useRef(null);
  const imgLoadedRef = useRef(false);

  // 게임 상태 (ref로 관리 → 렌더 루프 내에서 최신값 접근)
  const stateRef = useRef({
    angle: 0,
    angularVelocity: 0,
    distance: 0,
    gameOver: false,
    started: false,
    leftPressed: false,
    rightPressed: false,
    stepPhase: 0,
    groundOffset: 0,
    gustTimer: 0,
    // 시각 효과
    rainDrops: makeRainDrops(),
    lightningTimer: 0,
    lightningBolt: [],
    windTimer: 0,
    windStreaks: [],
  });

  const [uiState, setUiState] = useState({
    started: false,
    gameOver: false,
    distance: 0,
  });
  const [bestScore, setBestScore] = useState(0);
  const [saving, setSaving] = useState(false);

  // 최고 기록 불러오기
  useEffect(() => {
    getGameBestScore('stork').then(res => setBestScore(res.data.best_score)).catch(() => {});
  }, []);

  // 이미지 로드
  useEffect(() => {
    const img = new Image();
    img.src = '/ryan_full.png';
    img.onload = () => { imgLoadedRef.current = true; };
    imgRef.current = img;
  }, []);

  // 키보드 이벤트
  useEffect(() => {
    const onDown = (e) => {
      if (e.key === 'ArrowLeft') stateRef.current.leftPressed = true;
      if (e.key === 'ArrowRight') stateRef.current.rightPressed = true;
      if ((e.key === ' ' || e.key === 'Enter') && !stateRef.current.started && !stateRef.current.gameOver) {
        stateRef.current.started = true;
        setUiState(s => ({ ...s, started: true }));
      }
      if (['ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault();
    };
    const onUp = (e) => {
      if (e.key === 'ArrowLeft') stateRef.current.leftPressed = false;
      if (e.key === 'ArrowRight') stateRef.current.rightPressed = false;
    };
    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup', onUp);
    return () => {
      window.removeEventListener('keydown', onDown);
      window.removeEventListener('keyup', onUp);
    };
  }, []);

  // 게임 루프
  const gameLoop = useCallback(() => {
    const s = stateRef.current;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    // ── 물리 업데이트 ──
    if (s.started && !s.gameOver) {
      const wobbleScale = 1 + s.distance * DIFFICULTY_RAMP;

      // 자연 흔들림 (랜덤 드리프트)
      s.angularVelocity += (Math.random() - 0.5) * WOBBLE_STRENGTH * wobbleScale;

      // 주기적 돌풍 (갑작스러운 방향 충격)
      s.gustTimer = (s.gustTimer || 0) + 1;
      if (s.gustTimer >= GUST_INTERVAL) {
        s.gustTimer = 0;
        if (Math.random() < GUST_CHANCE) {
          const gustDir = Math.random() < 0.5 ? 1 : -1;
          s.angularVelocity += gustDir * GUST_FORCE * wobbleScale;
          // 번개 + 바람 시각 효과
          s.lightningTimer = 28;
          s.lightningBolt = genLightningBolt(W * 0.15 + Math.random() * W * 0.7);
          s.windTimer = 40;
          s.windStreaks = makeWindStreaks(gustDir);
        }
      }

      // 빗방울 업데이트 (50m 이후 활성)
      if (s.distance > 50) {
        const activeDrops = Math.min(70, Math.floor(20 + s.distance * 0.15));
        for (let i = 0; i < activeDrops; i++) {
          const d = s.rainDrops[i];
          const fallSpeed = d.speed * (1 + s.distance * 0.003);
          d.y += fallSpeed;
          d.x -= fallSpeed * 0.35;
          if (d.y > GROUND_Y + 10 || d.x < -10) {
            d.x = Math.random() * (W + 40);
            d.y = -15;
          }
        }
      }

      if (s.lightningTimer > 0) s.lightningTimer--;
      if (s.windTimer > 0) s.windTimer--;

      // 키 보정
      if (s.leftPressed) s.angularVelocity -= CORRECTION_FORCE;
      if (s.rightPressed) s.angularVelocity += CORRECTION_FORCE;

      // 불안정 중력: 기울수록 쓰러지는 방향으로 더 강하게 당김
      s.angularVelocity += Math.sin((s.angle * Math.PI) / 180) * GRAVITY_STRENGTH * wobbleScale;

      // 감쇠 적용
      s.angularVelocity *= DAMPING;

      // 각도 업데이트
      s.angle += s.angularVelocity;

      // 거리 증가
      s.distance += WALK_SPEED;

      // 걷기 애니메이션
      s.stepPhase += 0.08;

      // 배경 스크롤
      s.groundOffset = (s.groundOffset + WALK_SPEED) % 60;

      // Game Over 체크
      if (Math.abs(s.angle) > MAX_ANGLE) {
        s.gameOver = true;
        const dist = Math.floor(s.distance * DISTANCE_SCALE);
        setUiState({ started: true, gameOver: true, distance: dist });
        setSaving(true);
        saveGameScore('stork', dist)
          .then(() => getGameBestScore('stork'))
          .then(res => setBestScore(res.data.best_score))
          .catch(() => {})
          .finally(() => setSaving(false));
        onGameEnd?.(dist);
      }

      // UI 거리 업데이트 (매 프레임마다 하면 과함 → 5m 단위)
      if (Math.floor(s.distance) % 5 === 0) {
        setUiState(prev => ({ ...prev, distance: Math.floor(s.distance * DISTANCE_SCALE) }));
      }
    }

    // ── 렌더링 ──
    // 하늘 배경 — 비 올수록 흐려지고, 번개 시 더 어두워짐
    const rainIntensity = s.distance > 50 ? Math.min(1, (s.distance - 50) / 400) : 0;
    const lightningDark = s.lightningTimer > 0 ? Math.min(1, s.lightningTimer / 20) * 0.35 : 0;
    const overcast = Math.min(1, rainIntensity + lightningDark);

    // 맑은 하늘 (#87ceeb, #e0f4ff) → 흐린 하늘 (#5a7a90, #7898a8)
    function lerpC(a, b, t) { return Math.round(a + (b - a) * t); }
    const topR = lerpC(135, 60, overcast), topG = lerpC(206, 90, overcast), topB = lerpC(235, 118, overcast);
    const botR = lerpC(224, 100, overcast), botG = lerpC(244, 120, overcast), botB = lerpC(255, 145, overcast);

    const skyGrad = ctx.createLinearGradient(0, 0, 0, GROUND_Y);
    skyGrad.addColorStop(0, `rgb(${topR},${topG},${topB})`);
    skyGrad.addColorStop(1, `rgb(${botR},${botG},${botB})`);
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, W, H);

    // 비올 때 전체 어두운 오버레이
    if (rainIntensity > 0) {
      ctx.fillStyle = `rgba(20, 30, 50, ${rainIntensity * 0.22})`;
      ctx.fillRect(0, 0, W, H);
    }

    // 구름 — 비올수록 + 번개 시 먹구름으로 변색
    const cloudTint = Math.min(1, rainIntensity * 0.7 + (s.lightningTimer > 0 ? Math.min(1, s.lightningTimer / 10) * 0.5 : 0));
    drawCloud(ctx, 80, 50, 0.8, cloudTint);
    drawCloud(ctx, 320, 30, 1.1, cloudTint);
    drawCloud(ctx, 500, 65, 0.7, cloudTint);

    // ── 번개 플래시 (전체 화면) ──
    if (s.lightningTimer > 20) {
      const flashAlpha = ((s.lightningTimer - 20) / 8) * 0.45;
      ctx.fillStyle = `rgba(255,255,210,${flashAlpha})`;
      ctx.fillRect(0, 0, W, H);
    }

    // ── 번개 볼트 ──
    if (s.lightningTimer > 12 && s.lightningBolt.length > 1) {
      ctx.save();
      ctx.strokeStyle = '#fff9c4';
      ctx.lineWidth = 3;
      ctx.shadowColor = '#fffde7';
      ctx.shadowBlur = 14;
      ctx.beginPath();
      ctx.moveTo(s.lightningBolt[0].x, s.lightningBolt[0].y);
      for (let i = 1; i < s.lightningBolt.length; i++) {
        ctx.lineTo(s.lightningBolt[i].x, s.lightningBolt[i].y);
      }
      ctx.stroke();
      // 코어 (밝은 흰색)
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.shadowBlur = 0;
      ctx.stroke();
      ctx.restore();
    }

    // ── 바람 흔적 ──
    if (s.windTimer > 0 && s.windStreaks.length > 0) {
      const wAlpha = Math.min(1, s.windTimer / 12) * 0.55;
      ctx.save();
      ctx.strokeStyle = `rgba(255,255,255,${wAlpha})`;
      ctx.lineWidth = 1.5;
      for (const streak of s.windStreaks) {
        ctx.beginPath();
        ctx.moveTo(streak.x, streak.y);
        ctx.lineTo(streak.x + streak.dir * streak.len, streak.y);
        ctx.stroke();
      }
      ctx.restore();
    }

    // ── 비 ──
    if (s.distance > 50) {
      const activeDrops = Math.min(70, Math.floor(20 + s.distance * 0.15));
      const rainAlpha = Math.min(0.75, 0.3 + s.distance * 0.001);
      ctx.save();
      ctx.strokeStyle = `rgba(174,214,241,${rainAlpha})`;
      ctx.lineWidth = 1.5;
      for (let i = 0; i < activeDrops; i++) {
        const d = s.rainDrops[i];
        ctx.beginPath();
        ctx.moveTo(d.x, d.y);
        ctx.lineTo(d.x - d.len * 0.35, d.y + d.len);
        ctx.stroke();
      }
      ctx.restore();
    }

    // 바닥 (초록 잔디)
    ctx.fillStyle = '#68d391';
    ctx.fillRect(0, GROUND_Y, W, H - GROUND_Y);
    ctx.fillStyle = '#48bb78';
    ctx.fillRect(0, GROUND_Y, W, 8);

    // 바닥 타일 격자 (스크롤)
    ctx.strokeStyle = 'rgba(56,161,105,0.4)';
    ctx.lineWidth = 1;
    for (let x = -s.groundOffset; x < W; x += 60) {
      ctx.beginPath();
      ctx.moveTo(x, GROUND_Y + 8);
      ctx.lineTo(x, H);
      ctx.stroke();
    }

    // 거리 표시 말뚝
    const markerDist = 100;
    const markerCount = Math.floor(s.distance / markerDist);
    const markerX = W * 0.7 - (s.distance % markerDist) * (W / markerDist);
    if (markerX > 0 && markerX < W) {
      ctx.fillStyle = '#744210';
      ctx.fillRect(markerX - 4, GROUND_Y - 30, 8, 30);
      ctx.fillStyle = '#f6e05e';
      ctx.font = 'bold 10px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(`${Math.round(markerCount * 100 * DISTANCE_SCALE)}m`, markerX, GROUND_Y - 35);
    }

    // 캐릭터 렌더링
    const charX = W * 0.35;
    const charY = GROUND_Y - CHAR_H;

    // 걷기 시 살짝 위아래 bounce
    const bounce = s.started && !s.gameOver ? Math.sin(s.stepPhase * 2) * 3 : 0;

    ctx.save();
    ctx.translate(charX + CHAR_W / 2, charY + CHAR_H + bounce);
    ctx.rotate((s.angle * Math.PI) / 180);
    ctx.translate(-(CHAR_W / 2), -CHAR_H);

    if (imgLoadedRef.current) {
      ctx.drawImage(imgRef.current, 0, 0, CHAR_W, CHAR_H);
    } else {
      // 이미지 로드 전 fallback
      ctx.fillStyle = '#d69e2e';
      ctx.beginPath();
      ctx.ellipse(CHAR_W / 2, CHAR_H / 2, CHAR_W / 2, CHAR_H / 2, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // Game Over 시 충격 효과
    if (s.gameOver) {
      ctx.globalAlpha = 0.6;
      ctx.fillStyle = '#e53e3e';
      ctx.beginPath();
      ctx.ellipse(CHAR_W / 2, CHAR_H - 5, CHAR_W / 2 + 15, 6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    ctx.restore();

    // 기울기 인디케이터 (상단 바)
    drawAngleIndicator(ctx, s.angle);

    // 시작 전 안내
    if (!s.started && !s.gameOver) {
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 22px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('Space 또는 Enter를 눌러 시작', W / 2, H / 2 - 10);
      ctx.font = '14px Arial';
      ctx.fillStyle = '#e2e8f0';
      ctx.fillText('← → 방향키로 균형을 잡으세요', W / 2, H / 2 + 20);
    }

    animRef.current = requestAnimationFrame(gameLoop);
  }, []);

  useEffect(() => {
    animRef.current = requestAnimationFrame(gameLoop);
    return () => cancelAnimationFrame(animRef.current);
  }, [gameLoop]);

  const handleRestart = () => {
    stateRef.current = {
      angle: 0,
      angularVelocity: 0,
      distance: 0,
      gameOver: false,
      started: false,
      leftPressed: false,
      rightPressed: false,
      stepPhase: 0,
      groundOffset: 0,
      gustTimer: 0,
      rainDrops: makeRainDrops(),
      lightningTimer: 0,
      lightningBolt: [],
      windTimer: 0,
      windStreaks: [],
    };
    setUiState({ started: false, gameOver: false, distance: 0 });
  };

  // 모바일 터치 버튼
  const handleTouchLeft = (pressed) => { stateRef.current.leftPressed = pressed; };
  const handleTouchRight = (pressed) => { stateRef.current.rightPressed = pressed; };
  const handleTouchStart = () => {
    if (!stateRef.current.started && !stateRef.current.gameOver) {
      stateRef.current.started = true;
      setUiState(s => ({ ...s, started: true }));
    }
  };

  const distScore = Math.floor(uiState.distance);

  return (
    <div className="flex flex-col items-center gap-3">
      {/* 상단 상태바 */}
      <div className="flex items-center gap-6 w-full max-w-2xl justify-between px-2">
        <div className="flex gap-4">
          <div className="text-center">
            <div className="text-xs text-gray-400">이동 거리</div>
            <div className="text-2xl font-bold text-green-600 tabular-nums">{distScore}m</div>
          </div>
          <div className="text-center">
            <div className="text-xs text-gray-400">최고 기록</div>
            <div className="text-2xl font-bold text-yellow-500 tabular-nums">{bestScore}m</div>
          </div>
        </div>
        <div className="text-sm text-gray-500 hidden sm:block">
          ← → 방향키로 균형 · 돌풍 주의!
        </div>
      </div>

      {/* 게임 Canvas */}
      <div className="relative">
        <canvas
          ref={canvasRef}
          width={W}
          height={H}
          className="border-2 border-gray-300 rounded-xl shadow-lg"
          style={{ maxWidth: '100%' }}
          onClick={handleTouchStart}
        />

        {/* 게임 오버 오버레이 */}
        {uiState.gameOver && (
          <div className="absolute inset-0 bg-black/60 rounded-xl flex flex-col items-center justify-center gap-4">
            <div className="bg-white rounded-2xl px-10 py-8 text-center shadow-2xl">
              <div className="text-4xl mb-2">🦢</div>
              <h2 className="text-2xl font-bold text-gray-800 mb-1">쓰러졌어요!</h2>
              <p className="text-gray-500 mb-4">
                {saving ? '점수 저장 중...' : '균형을 잃었습니다 😵'}
              </p>
              <div className="flex gap-8 justify-center mb-6">
                <div>
                  <div className="text-xs text-gray-400">이동 거리</div>
                  <div className="text-3xl font-bold text-green-600">{distScore}m</div>
                </div>
                <div>
                  <div className="text-xs text-gray-400">최고 기록</div>
                  <div className="text-3xl font-bold text-yellow-500">{bestScore}m</div>
                </div>
              </div>
              {distScore >= bestScore && distScore > 0 && (
                <p className="text-orange-500 font-bold mb-4">🎉 새 최고 기록!</p>
              )}
              <button
                onClick={handleRestart}
                className="px-6 py-3 bg-green-500 text-white rounded-xl font-bold hover:bg-green-600 transition-colors"
              >
                다시 하기
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 모바일 방향키 */}
      <div className="flex gap-4 sm:hidden">
        <button
          className="w-16 h-16 bg-gray-200 rounded-xl text-2xl font-bold active:bg-gray-400 select-none"
          onTouchStart={() => handleTouchLeft(true)}
          onTouchEnd={() => handleTouchLeft(false)}
          onMouseDown={() => handleTouchLeft(true)}
          onMouseUp={() => handleTouchLeft(false)}
        >←</button>
        <button
          className="w-16 h-16 bg-gray-200 rounded-xl text-2xl font-bold active:bg-gray-400 select-none"
          onTouchStart={() => handleTouchRight(true)}
          onTouchEnd={() => handleTouchRight(false)}
          onMouseDown={() => handleTouchRight(true)}
          onMouseUp={() => handleTouchRight(false)}
        >→</button>
      </div>

      <p className="text-sm text-gray-400 text-center">
        멀리 걸을수록 점점 더 흔들립니다 · 돌풍을 조심하세요!
      </p>
    </div>
  );
}

// ── 헬퍼 함수 ──

function drawCloud(ctx, x, y, scale, darkTint = 0) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  // darkTint 0→흰구름, 1→먹구름
  const lightness = Math.round(255 * (1 - darkTint * 0.55));
  ctx.fillStyle = `rgba(${lightness},${lightness},${lightness},0.88)`;
  ctx.beginPath();
  ctx.arc(0, 0, 20, 0, Math.PI * 2);
  ctx.arc(22, -5, 26, 0, Math.PI * 2);
  ctx.arc(48, 0, 20, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawAngleIndicator(ctx, angle) {
  const barW = 200;
  const barH = 12;
  const bx = W / 2 - barW / 2;
  const by = 12;

  // 배경 바
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.beginPath();
  ctx.roundRect(bx, by, barW, barH, 6);
  ctx.fill();

  // 안전 구간 (초록)
  const safeW = barW * (20 / MAX_ANGLE / 2);
  ctx.fillStyle = 'rgba(72,187,120,0.5)';
  ctx.fillRect(W / 2 - safeW, by, safeW * 2, barH);

  // 인디케이터 점
  const ratio = Math.max(-1, Math.min(1, angle / MAX_ANGLE));
  const ix = W / 2 + ratio * (barW / 2 - 8);
  const danger = Math.abs(angle) > MAX_ANGLE * 0.7;
  ctx.fillStyle = danger ? '#e53e3e' : '#3182ce';
  ctx.beginPath();
  ctx.arc(ix, by + barH / 2, 8, 0, Math.PI * 2);
  ctx.fill();

  // 중심선
  ctx.strokeStyle = 'rgba(255,255,255,0.6)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(W / 2, by);
  ctx.lineTo(W / 2, by + barH);
  ctx.stroke();
}
