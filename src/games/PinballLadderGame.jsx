import { useState, useEffect, useRef } from 'react';
import Matter from 'matter-js';
import { Trophy, Plus, X } from 'lucide-react';

// ── Scale & Constants ─────────────────────────────────────────────────────────
const SCALE        = 1.5;
const s            = v => Math.round(v * SCALE);

const CW           = s(480);   // 720
const CVH          = s(580);   // 870
const FUNNEL_TOP   = s(1800);  // 2700
const FUNNEL_BOT   = s(1890);  // 2835
// tubeH, tubeFloorY, tubeDetect, boardH are computed dynamically inside useEffect based on N and MR
const WALL_MARGIN  = 15;

const PALETTE = [
  '#EF4444','#3B82F6','#10B981','#F59E0B',
  '#8B5CF6','#EC4899','#06B6D4','#84CC16',
];

function nextColor(used) {
  return PALETTE.find(c => !used.includes(c)) ?? PALETTE[used.length % PALETTE.length];
}
function mR(n) {
  if (n <= 4)  return s(14);
  if (n <= 8)  return s(12);
  if (n <= 20) return s(10);
  if (n <= 40) return s(8);
  return s(6);
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function drawRoundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function spawnParticles(x, y, color, count = 14) {
  return Array.from({ length: count }, () => ({
    x, y,
    vx: (Math.random() - 0.5) * 7,
    vy: (Math.random() - 0.5) * 7 - 1,
    life: 30 + Math.random() * 20,
    maxLife: 50,
    r: 2 + Math.random() * 3,
    color,
  }));
}

function drawPolyBody(ctx, body, fill, stroke) {
  ctx.beginPath();
  body.vertices.forEach((v, i) => i === 0 ? ctx.moveTo(v.x, v.y) : ctx.lineTo(v.x, v.y));
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 2; ctx.stroke(); }
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function PinballLadderGame() {
  const [phase, setPhase]         = useState('setup');
  const [items, setItems]         = useState([{ name: '라이언', color: PALETTE[0] }]);
  const [newName, setNewName]     = useState('');
  const [winRank, setWinRank]     = useState(1);
  const [camTrack, setCamTrack]   = useState(1);
  const [exitOrder, setExitOrder] = useState([]);
  const [winner, setWinner]       = useState(null);
  const [showNotif, setShowNotif] = useState(false);

  const canvasRef       = useRef(null);
  const exitRef         = useRef([]);
  const winnerRef       = useRef(null);
  const loopStopRef     = useRef(false);
  const particlesRef    = useRef([]);
  const winRankRef      = useRef(winRank);
  const notifTimeoutRef  = useRef(null);
  const endTimerRef      = useRef(null);
  const notifDoneRef     = useRef(false);
  const camYRef          = useRef(0);
  const boardHRef        = useRef(0);
  const winCamTargetRef  = useRef(0);
  const winnerMarbleRef  = useRef(null);
  const camTrackRef      = useRef(1);
  const isDraggingRef    = useRef(false);
  const dragStartYRef    = useRef(0);
  const dragStartCamYRef = useRef(0);
  const lastManualRef    = useRef(0);

  useEffect(() => { winRankRef.current = winRank; }, [winRank]);
  useEffect(() => { if (winRank > items.length) setWinRank(items.length); }, [items.length]);
  useEffect(() => { camTrackRef.current = camTrack; }, [camTrack]);
  useEffect(() => { if (camTrack > items.length) setCamTrack(items.length); }, [items.length]);

  const addItem = () => {
    const n = newName.trim();
    if (!n || items.length >= 99) return;
    setItems(p => [...p, { name: n, color: nextColor(p.map(x => x.color)) }]);
    setNewName('');
  };
  const removeItem  = (i) => setItems(p => p.filter((_, j) => j !== i));
  const updateColor = (i, c) => setItems(p => p.map((it, j) => j === i ? { ...it, color: c } : it));

  const startGame = () => {
    if (items.length < 2) return;
    exitRef.current     = [];
    winnerRef.current   = null;
    loopStopRef.current = false;
    particlesRef.current = [];
    if (notifTimeoutRef.current) { clearTimeout(notifTimeoutRef.current); notifTimeoutRef.current = null; }
    if (endTimerRef.current)     { clearTimeout(endTimerRef.current);     endTimerRef.current = null; }
    notifDoneRef.current  = false;
    isDraggingRef.current = false;
    lastManualRef.current = 0;
    winnerMarbleRef.current = null;
    setExitOrder([]);
    setWinner(null);
    setShowNotif(false);
    setPhase('playing');
  };

  // ── Physics loop ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'playing') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const N  = items.length;
    const MR = mR(N);
    const PIN_R = s(7);

    // Dynamic tube geometry — 1.6× marble diameter: single-file but wide enough to prevent jams
    const tubeGap  = Math.round(MR * 3.2);
    const tubeLeft  = Math.round((CW - tubeGap) / 2);
    const tubeRight = Math.round((CW + tubeGap) / 2);

    // Dynamic tube height: proportional to marble count, reduced padding
    const tubeH      = Math.max(s(120), N * MR * 2 + s(8));
    const tubeFloorY = FUNNEL_BOT + tubeH;
    const tubeDetect = FUNNEL_BOT + s(30);
    const boardH     = tubeFloorY + s(60);
    boardHRef.current = boardH;

    const engine = Matter.Engine.create({ gravity: { y: 1.3 } });
    const world  = engine.world;

    // Outer walls + floor
    const wOpt = { isStatic: true, restitution: 0.3, friction: 0.4, label: 'wall' };
    Matter.World.add(world, [
      Matter.Bodies.rectangle(-10, boardH / 2, 20, boardH * 2, wOpt),
      Matter.Bodies.rectangle(CW + 10, boardH / 2, 20, boardH * 2, wOpt),
      Matter.Bodies.rectangle(CW / 2, boardH + 10, CW * 2, 20, wOpt),
    ]);

    // ════════════════════════════════════════════════════════════════════════
    // HALF 1 — Zones 1–8  (y ≈ 0–900)
    // ════════════════════════════════════════════════════════════════════════
    const pOpt   = { isStatic: true, restitution: 0.5, friction: 0.05, label: 'pin' };
    const pinIds = new Set();

    // Zone 1: Basic pins (4 rows)
    for (let r = 0; r < 4; r++) {
      const y    = s(145) + r * s(40);
      const even = r % 2 === 0;
      const cnt  = even ? 7 : 6;
      const sx   = even ? s(34) : s(68);
      for (let i = 0; i < cnt; i++) {
        const b = Matter.Bodies.circle(sx + i * s(68), y, PIN_R, pOpt);
        pinIds.add(b.id);
        Matter.World.add(world, b);
      }
    }

    // Zone 2: Spring bumpers
    const sbOpt = { isStatic: true, restitution: 0.7, friction: 0, label: 'spring_bumper' };
    const sbIds = new Set();
    [{ x: s(110), y: s(300), r: s(19) },
     { x: s(370), y: s(320), r: s(19) },
     { x: s(240), y: s(345), r: s(16) }]
      .forEach(({ x, y, r }) => {
        const b = Matter.Bodies.circle(x, y, r, sbOpt);
        sbIds.add(b.id);
        Matter.World.add(world, b);
      });

    // Zone 3: Triangle wedges
    const wdOpt = { isStatic: true, restitution: 0.15, friction: 0.15, label: 'wedge' };
    [{ x: s(155), y: s(410) }, { x: s(325), y: s(435) }].forEach(({ x, y }) =>
      Matter.World.add(world, Matter.Bodies.polygon(x, y, 3, s(30), wdOpt))
    );

    // Zone 3b: Angled bumper walls (channel deflectors)
    const bumpWallOpt = { isStatic: true, restitution: 0.15, friction: 0.12, label: 'bump_wall' };
    const bumpWallIds = new Set();
    [
      { x: s(98),  y: s(461), angle:  0.52 },
      { x: s(382), y: s(461), angle: -0.52 },
    ].forEach(({ x, y, angle }) => {
      const b = Matter.Bodies.rectangle(x, y, s(68), s(9), { ...bumpWallOpt, angle });
      bumpWallIds.add(b.id);
      Matter.World.add(world, b);
    });

    // Zone 4: Rotating bars
    const rotBars = [
      { body: Matter.Bodies.rectangle(s(145), s(488), s(115), s(8), { isStatic: true, restitution: 0.08, friction: 0.18, label: 'rotbar' }), spd:  0.026 },
      { body: Matter.Bodies.rectangle(s(335), s(528), s(105), s(8), { isStatic: true, restitution: 0.08, friction: 0.18, label: 'rotbar' }), spd: -0.031 },
    ];
    rotBars.forEach(rb => Matter.World.add(world, rb.body));

    // Zone 5: Flipper
    const flippers = [
      { body: Matter.Bodies.rectangle(s(240), s(588), s(92), s(8), { isStatic: true, restitution: 0.5, friction: 0.1, label: 'flipper' }),
        a: 0, dir: 1, spd: 0.038, amp: Math.PI / 3 },
    ];
    flippers.forEach(fl => Matter.World.add(world, fl.body));

    // Zone 5b: Oscillating bumpers
    const OB_W  = s(88);
    const OB_HW = OB_W / 2;
    const oscBumpers = [
      { bx: s(105), y: s(645), t0: 0,        spd: 0.042 },
      { bx: s(375), y: s(672), t0: Math.PI,   spd: 0.051 },
    ].map(({ bx, y, t0, spd }) => {
      const amp  = Math.min(s(68), bx - OB_HW - WALL_MARGIN, CW - bx - OB_HW - WALL_MARGIN);
      const body = Matter.Bodies.rectangle(bx, y, OB_W, s(10), {
        isStatic: true, restitution: 0.5, friction: 0.1, label: 'osc_bumper',
      });
      Matter.World.add(world, body);
      return { body, bx, amp, spd, t: t0 };
    });

    // Zone 5c: Wrecking ball (heavy chain pendulum)
    const wreckingBalls = [];
    {
      const px = s(378), py = s(682), len = s(72);
      const bob = Matter.Bodies.circle(px, py + len, s(17), {
        restitution: 0.66, friction: 0.02, density: 0.022, label: 'wrecking_ball',
      });
      const con = Matter.Constraint.create({ pointA: { x: px, y: py }, bodyB: bob, stiffness: 0.99, length: len });
      Matter.Body.setVelocity(bob, { x: -6.5, y: 0 });
      Matter.World.add(world, [bob, con]);
      wreckingBalls.push({ bob, px, py });
    }

    // Zone 6: Pendulums
    const pendulums = [
      { px: s(115), py: s(695), len: s(68), vx:  4.5 },
      { px: s(365), py: s(705), len: s(68), vx: -4.5 },
    ].map(({ px, py, len, vx }) => {
      const bob = Matter.Bodies.circle(px, py + len, s(14), {
        restitution: 0.5, friction: 0.04, label: 'pendulum', density: 0.012,
      });
      const con = Matter.Constraint.create({ pointA: { x: px, y: py }, bodyB: bob, stiffness: 1, length: len });
      Matter.Body.setVelocity(bob, { x: vx, y: 0 });
      Matter.World.add(world, [bob, con]);
      return { bob, px, py };
    });

    // Zone 7: Moving platform
    const MP_W  = s(115);
    const MP_BX = s(155);
    const MP_HW = MP_W / 2;
    const movPlatforms = [{
      body: Matter.Bodies.rectangle(MP_BX, s(808), MP_W, s(10), {
        isStatic: true, restitution: 0.3, friction: 0.5, label: 'mov_platform',
      }),
      bx: MP_BX,
      amp: Math.min(s(88), MP_BX - MP_HW - WALL_MARGIN, CW - MP_BX - MP_HW - WALL_MARGIN),
      spd: 0.036, t: 0,
    }];
    movPlatforms.forEach(mp => Matter.World.add(world, mp.body));

    // Zone 7b: Spinning wheel
    const spinWheels = [{
      body: Matter.Bodies.circle(s(360), s(820), s(28), {
        isStatic: true, restitution: 0.7, friction: 0.15, label: 'spin_wheel',
      }),
      angle: 0, spd: 0.06,
    }];
    spinWheels.forEach(sw => Matter.World.add(world, sw.body));

    // Zone 7c: 5-arm spinner fan (left side)
    const spinFans = [{
      body: Matter.Bodies.circle(s(108), s(774), s(32), {
        isStatic: true, restitution: 0.55, friction: 0, label: 'spin_fan',
      }),
      angle: 0, spd: 0.052, arms: 5,
    }];
    spinFans.forEach(sf => Matter.World.add(world, sf.body));

    // Zone 8: Dense pins before funnel (3 rows)
    const DENSE_PIN_R = s(6);
    for (let r = 0; r < 3; r++) {
      const y = s(848) + r * s(18);
      for (let i = 0; i < 6; i++) {
        const x = s(44) + i * s(78) + (r % 2 === 0 ? 0 : s(39));
        if (x > s(20) && x < s(460)) {
          const b = Matter.Bodies.circle(x, y, DENSE_PIN_R, pOpt);
          pinIds.add(b.id);
          Matter.World.add(world, b);
        }
      }
    }

    // ════════════════════════════════════════════════════════════════════════
    // HALF 2 — Zones 9–17  (y ≈ 900–1800)
    // ════════════════════════════════════════════════════════════════════════
    const OFF = s(900);

    // Zone 9: Basic pins (5 rows, tighter spacing)
    for (let r = 0; r < 5; r++) {
      const y    = OFF + s(145) + r * s(36);
      const even = r % 2 === 0;
      const cnt  = even ? 7 : 6;
      const sx   = even ? s(34) : s(68);
      for (let i = 0; i < cnt; i++) {
        const b = Matter.Bodies.circle(sx + i * s(68), y, PIN_R, pOpt);
        pinIds.add(b.id);
        Matter.World.add(world, b);
      }
    }

    // Zone 10: Spring bumpers (4 bumpers)
    [{ x: s(90),  y: OFF + s(310), r: s(18) },
     { x: s(390), y: OFF + s(310), r: s(18) },
     { x: s(190), y: OFF + s(348), r: s(16) },
     { x: s(290), y: OFF + s(348), r: s(16) }]
      .forEach(({ x, y, r }) => {
        const b = Matter.Bodies.circle(x, y, r, sbOpt);
        sbIds.add(b.id);
        Matter.World.add(world, b);
      });

    // Zone 11: Triangle wedges (3 wedges)
    [{ x: s(120), y: OFF + s(418) },
     { x: s(240), y: OFF + s(400) },
     { x: s(360), y: OFF + s(418) }].forEach(({ x, y }) =>
      Matter.World.add(world, Matter.Bodies.polygon(x, y, 3, s(30), wdOpt))
    );

    // Zone 11b: Angled bumper walls (HALF 2, mirrored angles)
    [
      { x: s(98),  y: OFF + s(461), angle: -0.52 },
      { x: s(382), y: OFF + s(461), angle:  0.52 },
    ].forEach(({ x, y, angle }) => {
      const b = Matter.Bodies.rectangle(x, y, s(68), s(9), { ...bumpWallOpt, angle });
      bumpWallIds.add(b.id);
      Matter.World.add(world, b);
    });

    // Zone 12: Rotating bars (reversed direction)
    const rotBars2 = [
      { body: Matter.Bodies.rectangle(s(145), OFF + s(488), s(115), s(8), { isStatic: true, restitution: 0.08, friction: 0.18, label: 'rotbar' }), spd: -0.028 },
      { body: Matter.Bodies.rectangle(s(335), OFF + s(528), s(105), s(8), { isStatic: true, restitution: 0.08, friction: 0.18, label: 'rotbar' }), spd:  0.033 },
    ];
    rotBars2.forEach(rb => { Matter.World.add(world, rb.body); rotBars.push(rb); });

    // Zone 13: Flipper (opposite phase)
    const flipper2 = {
      body: Matter.Bodies.rectangle(s(240), OFF + s(588), s(92), s(8), { isStatic: true, restitution: 0.5, friction: 0.1, label: 'flipper' }),
      a: Math.PI / 4, dir: -1, spd: 0.038, amp: Math.PI / 3,
    };
    Matter.World.add(world, flipper2.body);
    flippers.push(flipper2);

    // Zone 14: Oscillating bumpers
    [{ bx: s(105), y: OFF + s(645), t0: Math.PI / 2, spd: 0.038 },
     { bx: s(375), y: OFF + s(672), t0: Math.PI * 1.5, spd: 0.045 }]
      .forEach(({ bx, y, t0, spd }) => {
        const amp  = Math.min(s(68), bx - OB_HW - WALL_MARGIN, CW - bx - OB_HW - WALL_MARGIN);
        const body = Matter.Bodies.rectangle(bx, y, OB_W, s(10), {
          isStatic: true, restitution: 0.5, friction: 0.1, label: 'osc_bumper',
        });
        Matter.World.add(world, body);
        oscBumpers.push({ body, bx, amp, spd, t: t0 });
      });

    // Zone 14b: Wrecking ball (HALF 2, opposite side)
    {
      const px = s(122), py = OFF + s(682), len = s(72);
      const bob = Matter.Bodies.circle(px, py + len, s(17), {
        restitution: 0.66, friction: 0.02, density: 0.022, label: 'wrecking_ball',
      });
      const con = Matter.Constraint.create({ pointA: { x: px, y: py }, bodyB: bob, stiffness: 0.99, length: len });
      Matter.Body.setVelocity(bob, { x: 6.5, y: 0 });
      Matter.World.add(world, [bob, con]);
      wreckingBalls.push({ bob, px, py });
    }

    // Zone 15: Pendulums (swapped sides)
    [{ px: s(365), py: OFF + s(695), len: s(68), vx:  4.5 },
     { px: s(115), py: OFF + s(705), len: s(68), vx: -4.5 }]
      .forEach(({ px, py, len, vx }) => {
        const bob = Matter.Bodies.circle(px, py + len, s(14), {
          restitution: 0.5, friction: 0.04, label: 'pendulum', density: 0.012,
        });
        const con = Matter.Constraint.create({ pointA: { x: px, y: py }, bodyB: bob, stiffness: 1, length: len });
        Matter.Body.setVelocity(bob, { x: vx, y: 0 });
        Matter.World.add(world, [bob, con]);
        pendulums.push({ bob, px, py });
      });

    // Zone 16: Moving platform (right-of-center)
    const MP2_BX = CW - s(155);
    const mp2 = {
      body: Matter.Bodies.rectangle(MP2_BX, OFF + s(808), MP_W, s(10), {
        isStatic: true, restitution: 0.3, friction: 0.5, label: 'mov_platform',
      }),
      bx: MP2_BX,
      amp: Math.min(s(88), MP2_BX - MP_HW - WALL_MARGIN, CW - MP2_BX - MP_HW - WALL_MARGIN),
      spd: 0.042, t: Math.PI,
    };
    Matter.World.add(world, mp2.body);
    movPlatforms.push(mp2);

    // Zone 16b: Spinning wheel (left side, reverse spin) — moved up for funnel clearance
    const sw2 = {
      body: Matter.Bodies.circle(s(120), OFF + s(748), s(28), {
        isStatic: true, restitution: 0.5, friction: 0.15, label: 'spin_wheel',
      }),
      angle: 0, spd: -0.07,
    };
    Matter.World.add(world, sw2.body);
    spinWheels.push(sw2);

    // Zone 16c: 5-arm spinner fan (right side, HALF 2)
    {
      const sf = {
        body: Matter.Bodies.circle(s(392), OFF + s(774), s(32), {
          isStatic: true, restitution: 0.55, friction: 0, label: 'spin_fan',
        }),
        angle: 0, spd: -0.055, arms: 5,
      };
      Matter.World.add(world, sf.body);
      spinFans.push(sf);
    }

    // Zone 17: Sparse pins only in upper half (keep funnel approach clear)
    for (let r = 0; r < 2; r++) {
      const y = OFF + s(800) + r * s(20);
      for (let i = 0; i < 5; i++) {
        const x = s(58) + i * s(82) + (r % 2 === 0 ? 0 : s(41));
        if (x > s(20) && x < s(460)) {
          const b = Matter.Bodies.circle(x, y, DENSE_PIN_R, pOpt);
          pinIds.add(b.id);
          Matter.World.add(world, b);
        }
      }
    }

    // ════════════════════════════════════════════════════════════════════════
    // Special zones — both halves
    // ════════════════════════════════════════════════════════════════════════
    const gravWells = [
      { x: s(240), y: s(740),       r: s(120), str: 0.00016 },
      { x: s(240), y: OFF + s(740), r: s(120), str: 0.00016 },
    ];
    const speedZones = [
      { x: s(350), y: s(780),       w: s(90), h: s(55) },
      { x: s(350), y: OFF + s(780), w: s(90), h: s(55) },
    ];
    const stickyZones = [
      { x: s(90), y: s(780),       w: s(90), h: s(55) },
      { x: s(90), y: OFF + s(780), w: s(90), h: s(55) },
    ];
    // portals: pair A=[0,1] within half-1, pair B=[2,3] within half-2
    const portals = [
      { x: s(58),  y: s(545)       },
      { x: s(422), y: s(615)       },
      { x: s(58),  y: OFF + s(545) },
      { x: s(422), y: OFF + s(615) },
    ];
    const PORTAL_R    = s(18);
    const portalPairs = [[0, 1], [2, 3]];

    // ════════════════════════════════════════════════════════════════════════
    // Funnel
    // ════════════════════════════════════════════════════════════════════════
    const fOpt   = { isStatic: true, restitution: 0.3, friction: 0.25, label: 'funnel_wall' };
    const fH     = FUNNEL_BOT - FUNNEL_TOP;
    const fLen   = Math.hypot(tubeLeft, fH);
    const fAngle = Math.atan2(fH, tubeLeft);
    const fThick = s(20); // 30px — robust anti-tunneling, combined with funnel speed limiter
    const sinA   = fH / fLen;      // = sin(fAngle)
    const cosA   = tubeLeft / fLen; // = cos(fAngle)
    const midY   = (FUNNEL_TOP + FUNNEL_BOT) / 2;
    // Shift wall center OUTWARD by fThick/2 perpendicular to wall axis,
    // so inner face lies exactly on the funnel edge: (0,FUNNEL_TOP)→(tubeLeft,FUNNEL_BOT).
    // Without this, the inner face would intrude into tubeGap by fThick/2*sinA on each side.
    const offX   = fThick / 2 * sinA;   // horizontal outward shift
    const offY   = fThick / 2 * cosA;   // vertical downward shift

    Matter.World.add(world, [
      Matter.Bodies.rectangle(tubeLeft / 2 - offX, midY + offY, fLen, fThick,
        { ...fOpt, angle:  fAngle }),
      Matter.Bodies.rectangle(CW - tubeLeft / 2 + offX, midY + offY, fLen, fThick,
        { ...fOpt, angle: -fAngle }),
    ]);

    // Tube walls — narrow pipe from FUNNEL_BOT to TUBE_FLOOR_Y
    const tubeOpt = { isStatic: true, restitution: 0.05, friction: 0.2, label: 'tube_wall' };
    Matter.World.add(world, [
      Matter.Bodies.rectangle(tubeLeft - s(4), FUNNEL_BOT + tubeH / 2, s(8), tubeH, tubeOpt),
      Matter.Bodies.rectangle(tubeRight + s(4), FUNNEL_BOT + tubeH / 2, s(8), tubeH, tubeOpt),
    ]);

    // Tube floor
    Matter.World.add(world,
      Matter.Bodies.rectangle(CW / 2, tubeFloorY + s(4), tubeGap + s(8), s(8),
        { isStatic: true, restitution: 0.05, friction: 0.9, label: 'tube_floor' })
    );

    // Side barriers: full coverage from FUNNEL_BOT down to tubeFloorY
    const barrierH   = tubeH + s(30);
    const barrierOpt = { isStatic: true, restitution: 0, friction: 1, label: 'barrier' };
    Matter.World.add(world, [
      Matter.Bodies.rectangle(tubeLeft / 2, FUNNEL_BOT + barrierH / 2, tubeLeft, barrierH, barrierOpt),
      Matter.Bodies.rectangle(tubeRight + (CW - tubeRight) / 2, FUNNEL_BOT + barrierH / 2, CW - tubeRight, barrierH, barrierOpt),
    ]);

    // ════════════════════════════════════════════════════════════════════════
    // Marbles
    // ════════════════════════════════════════════════════════════════════════
    const marbles = items.map((it, i) => {
      const body = Matter.Bodies.circle(
        MR + 8 + Math.random() * (CW - MR * 2 - 16),
        -MR * 2 - i * (MR * 3 + 5),
        MR,
        { restitution: 0.45, friction: 0.04, frictionAir: 0.005, density: 0.003, label: 'marble' }
      );
      body._name = it.name; body._color = it.color;
      body._exited = false; body._pCool = 0; body._rank = 0;
      body._lastCheckY = -MR * 2 - i * (MR * 3 + 5);
      body._stuckCount = 0;
      Matter.World.add(world, body);
      return body;
    });

    const hitFrame = new Map();
    let frame = 0;
    let quakeTimer = 0;
    // Initial camera: focus on where the winning-rank marble will land in the tube
    const winInitY = tubeFloorY - MR * (2 * winRankRef.current - 1) - MR;
    const winCamY  = Math.max(0, Math.min(boardH - CVH, winInitY - CVH * 0.55));
    camYRef.current       = winCamY;
    winCamTargetRef.current = winCamY;
    let rafId;

    // Collision events
    Matter.Events.on(engine, 'collisionStart', ev => {
      ev.pairs.forEach(({ bodyA, bodyB }) => {
        const isMA = bodyA.label === 'marble', isMB = bodyB.label === 'marble';
        const marble = isMA ? bodyA : isMB ? bodyB : null;
        if (!marble) return;
        const other = marble === bodyA ? bodyB : bodyA;

        if (pinIds.has(other.id)) hitFrame.set(other.id, frame);
        if (sbIds.has(other.id)) {
          hitFrame.set(other.id, frame);
          particlesRef.current.push(...spawnParticles(marble.position.x, marble.position.y, marble._color));
        }
        if (other.label === 'spin_wheel' || other.label === 'spin_fan') {
          const dx = marble.position.x - other.position.x;
          const dy = marble.position.y - other.position.y;
          const len = Math.hypot(dx, dy) || 1;
          const kick = other.label === 'spin_fan' ? 0.012 : 0.009;
          Matter.Body.applyForce(marble, marble.position, {
            x: (-dy / len) * kick * marble.mass,
            y: ( dx / len) * kick * marble.mass,
          });
        }
      });
    });

    // ── RAF loop ─────────────────────────────────────────────────────────────
    const loop = () => {
      if (loopStopRef.current) return;
      rafId = requestAnimationFrame(loop);
      frame++;

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;

      Matter.Engine.update(engine, 1000 / 60);

      // NaN sanitization
      marbles.forEach(m => {
        if (!isFinite(m.position.x) || !isFinite(m.position.y) ||
            !isFinite(m.velocity.x) || !isFinite(m.velocity.y)) {
          Matter.Body.setPosition(m, { x: CW / 2 + (Math.random() - 0.5) * 60, y: 80 });
          Matter.Body.setVelocity(m, { x: 0, y: 3 });
        }
      });

      // Rotating bars (all)
      rotBars.forEach(rb => Matter.Body.setAngle(rb.body, rb.body.angle + rb.spd));

      // Flippers (all)
      flippers.forEach(fl => {
        fl.a += fl.spd * fl.dir;
        if (Math.abs(fl.a) >= fl.amp) fl.dir *= -1;
        Matter.Body.setAngle(fl.body, fl.a);
      });

      // Oscillating bumpers (all)
      oscBumpers.forEach(ob => {
        ob.t += ob.spd;
        const nx = ob.bx + Math.sin(ob.t) * ob.amp;
        Matter.Body.setPosition(ob.body, { x: nx, y: ob.body.position.y });
        Matter.Body.setVelocity(ob.body, { x: Math.cos(ob.t) * ob.amp * ob.spd, y: 0 });
      });

      // Moving platforms (all)
      movPlatforms.forEach(mp => {
        mp.t += mp.spd;
        const nx = mp.bx + Math.sin(mp.t) * mp.amp;
        Matter.Body.setPosition(mp.body, { x: nx, y: mp.body.position.y });
        Matter.Body.setVelocity(mp.body, { x: Math.cos(mp.t) * mp.amp * mp.spd, y: 0 });
      });

      // Spinning wheels (all)
      spinWheels.forEach(sw => {
        sw.angle += sw.spd;
        Matter.Body.setAngle(sw.body, sw.angle);
      });

      // Spinner fans (all)
      spinFans.forEach(sf => {
        sf.angle += sf.spd;
        Matter.Body.setAngle(sf.body, sf.angle);
      });

      // Per-marble effects (active only)
      const MAX_UP_SPEED  = 12;
      const MAX_SPEED     = 28;
      marbles.forEach(m => {
        if (m._exited) return;
        if (m._pCool > 0) m._pCool--;

        if (m.velocity.y < -MAX_UP_SPEED)
          Matter.Body.setVelocity(m, { x: m.velocity.x, y: -MAX_UP_SPEED });
        const spd = Math.hypot(m.velocity.x, m.velocity.y);
        if (spd > MAX_SPEED) {
          const ratio = MAX_SPEED / spd;
          Matter.Body.setVelocity(m, { x: m.velocity.x * ratio, y: m.velocity.y * ratio });
        }

        // Escaped marble recovery
        if (m.position.y < -200) {
          Matter.Body.setPosition(m, { x: MR + 20 + Math.random() * (CW - MR * 2 - 40), y: 50 });
          Matter.Body.setVelocity(m, { x: (Math.random() - 0.5) * 3, y: 2 });
          m._pCool = 60;
        }

        // Gravity wells (both halves)
        gravWells.forEach(gw => {
          const dx = gw.x - m.position.x;
          const dy = gw.y - m.position.y;
          const dist = Math.hypot(dx, dy);
          if (dist < gw.r && dist > 5) {
            Matter.Body.applyForce(m, m.position, {
              x: (dx / dist) * gw.str * m.mass,
              y: (dy / dist) * gw.str * m.mass,
            });
          }
        });

        // Speed boosters (both halves)
        speedZones.forEach(sz => {
          if (m.position.x > sz.x - sz.w / 2 && m.position.x < sz.x + sz.w / 2 &&
              m.position.y > sz.y - sz.h / 2 && m.position.y < sz.y + sz.h / 2) {
            Matter.Body.applyForce(m, m.position, { x: 0, y: 0.0007 * m.mass });
          }
        });

        // Sticky zones (both halves)
        stickyZones.forEach(sz => {
          if (m.position.x > sz.x - sz.w / 2 && m.position.x < sz.x + sz.w / 2 &&
              m.position.y > sz.y - sz.h / 2 && m.position.y < sz.y + sz.h / 2) {
            Matter.Body.setVelocity(m, { x: m.velocity.x * 0.89, y: m.velocity.y * 0.89 });
          }
        });

        // Portals
        if (m._pCool === 0) {
          portalPairs.forEach(([ai, bi]) => {
            const pA = portals[ai], pB = portals[bi];
            if (Math.hypot(m.position.x - pA.x, m.position.y - pA.y) < PORTAL_R) {
              Matter.Body.setPosition(m, { x: pB.x, y: pB.y + 12 });
              Matter.Body.setVelocity(m, { x: m.velocity.x * 0.5, y: Math.abs(m.velocity.y) + 1 });
              m._pCool = 90;
              particlesRef.current.push(...spawnParticles(pB.x, pB.y, m._color, 10));
            }
          });
        }
      });

      // Downward nudge every ~1s (강화)
      quakeTimer++;
      if (quakeTimer >= 60) {
        quakeTimer = 0;
        marbles.forEach(m => {
          if (!m._exited && m.position.y < FUNNEL_TOP) {
            Matter.Body.applyForce(m, m.position, {
              x: (Math.random() - 0.5) * 0.012 * m.mass,
              y: 0.010 * m.mass,
            });
          }
        });
      }

      // ── Anti-loop 진행 추적 (every 30 frames = 0.5s) ───────────────────────
      // 회전 바 등이 에너지를 능동적으로 주입해 무한루프를 유발하므로
      // Y 좌표 하향 진행이 없으면 단계별 개입으로 루프를 탈출시킴
      if (frame % 30 === 0) {
        marbles.forEach(m => {
          if (m._exited || m.position.y >= FUNNEL_TOP) return;

          if (m.position.y > m._lastCheckY + s(12)) {
            // 정상 하향 진행 → 리셋
            m._lastCheckY = m.position.y;
            m._stuckCount = 0;
          } else {
            m._stuckCount++;

            // 2s (4회): 속도 감쇠 + 하향 바이어스 — 루프 에너지 제거
            if (m._stuckCount >= 4) {
              Matter.Body.setVelocity(m, {
                x: m.velocity.x * 0.55,
                y: m.velocity.y * 0.55 + 1.5,
              });
            }
            // 5s (10회): 강한 하향 힘 + X 방향 랜덤화
            if (m._stuckCount >= 10) {
              Matter.Body.applyForce(m, m.position, {
                x: (Math.random() - 0.5) * 0.07 * m.mass,
                y: 0.055 * m.mass,
              });
              m._lastCheckY = m.position.y;
            }
            // 10s (20회): 위치 강제 이동 (충분히 시도했으나 실패한 경우)
            if (m._stuckCount >= 20) {
              const safeY = Math.min(m.position.y + s(80), FUNNEL_TOP - s(40));
              Matter.Body.setPosition(m, {
                x: MR + 30 + Math.random() * (CW - MR * 2 - 60),
                y: safeY,
              });
              Matter.Body.setVelocity(m, {
                x: (Math.random() - 0.5) * 2,
                y: 4,
              });
              m._stuckCount = 0;
              m._lastCheckY = safeY;
            }
          }
        });
      }

      // Force-exit timeout (3 min)
      if (frame === 10800) {
        const remaining = marbles.filter(m => !m._exited);
        remaining
          .sort((a, b) => b.position.y - a.position.y)
          .forEach((m, idx) => {
            setTimeout(() => {
              if (!m._exited) {
                Matter.Body.setPosition(m, { x: CW / 2 + (Math.random() - 0.5) * tubeGap * 0.4, y: FUNNEL_BOT + 40 });
                Matter.Body.setVelocity(m, { x: 0, y: 4 });
              }
            }, idx * 300);
          });
      }

      // Tube entry detection — mark exited, keep in physics for stacking
      marbles.forEach(m => {
        if (m._exited) return;
        if (m.position.y > tubeDetect &&
            m.position.x > tubeLeft - s(10) &&
            m.position.x < tubeRight + s(10)) {
          m._exited   = true;
          m.frictionAir = 0.05; // settle faster inside tube
          const rank  = exitRef.current.length + 1;
          const entry = { name: m._name, color: m._color, rank };
          exitRef.current = [...exitRef.current, entry];
          m._rank = rank;
          setExitOrder([...exitRef.current]);

          if (!winnerRef.current && rank === winRankRef.current) {
            winnerRef.current   = entry;
            winnerMarbleRef.current = m;  // track the actual body to follow with camera
            setWinner(entry);    // set winner state immediately for notification display
            setShowNotif(true);  // show React overlay notification for 2s
            particlesRef.current.push(...spawnParticles(CW / 2, CVH * 0.5, entry.color, 50));
            notifTimeoutRef.current = setTimeout(() => {
              setShowNotif(false);
              notifDoneRef.current = true;
              // If all marbles already arrived, start 1s countdown to result
              if (exitRef.current.length >= N) {
                endTimerRef.current = setTimeout(() => {
                  loopStopRef.current = true;
                  setPhase('result');
                }, 1000);
              }
            }, 2000);
          }
        }
      });

      // Exited marbles: kill horizontal velocity for clean single-file stacking
      marbles.forEach(m => {
        if (!m._exited || m.position.y <= tubeDetect) return;
        if (Math.abs(m.velocity.x) > 0.1)
          Matter.Body.setVelocity(m, { x: 0, y: m.velocity.y });
      });

      // After notif 2s done, wait for all marbles then go to result after 1s
      if (winnerRef.current && notifDoneRef.current && !endTimerRef.current &&
          exitRef.current.length >= N) {
        endTimerRef.current = setTimeout(() => {
          loopStopRef.current = true;
          setPhase('result');
        }, 1000);
      }

      // Particles
      particlesRef.current = particlesRef.current.filter(p => p.life > 0);
      particlesRef.current.forEach(p => {
        p.x += p.vx; p.y += p.vy; p.vy += 0.15; p.vx *= 0.97; p.life--;
      });

      // Camera: track camTrackRef.current-th most-advanced active marble
      // Paused while user is dragging/scrolling + 8s cooldown after last manual input
      if (!isDraggingRef.current && Date.now() - lastManualRef.current > 8000) {
        const activeSorted = marbles
          .filter(m => !m._exited && isFinite(m.position.y))
          .sort((a, b) => b.position.y - a.position.y);
        let tgtY = winCamTargetRef.current;
        const rank = camTrackRef.current;
        const tracked = activeSorted[rank - 1] ?? activeSorted[activeSorted.length - 1];
        if (tracked) {
          tgtY = Math.max(0, Math.min(boardH - CVH, tracked.position.y - CVH * 0.55));
        }
        camYRef.current += (tgtY - camYRef.current) * 0.07;
      }

      // ── Render ─────────────────────────────────────────────────────────────
      ctx.clearRect(0, 0, CW, CVH);
      ctx.save();
      ctx.translate(0, -camYRef.current);

      // Board background
      ctx.fillStyle = '#12082a';
      ctx.fillRect(0, 0, CW, boardH);

      // Zone 2 divider
      ctx.strokeStyle = 'rgba(99,102,241,0.18)';
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 12]);
      ctx.beginPath(); ctx.moveTo(0, OFF); ctx.lineTo(CW, OFF); ctx.stroke();
      ctx.setLineDash([]);

      // Gravity wells
      gravWells.forEach(gw => {
        const gwG = ctx.createRadialGradient(gw.x, gw.y, 0, gw.x, gw.y, gw.r);
        gwG.addColorStop(0, 'rgba(139,92,246,0.25)');
        gwG.addColorStop(1, 'rgba(139,92,246,0)');
        ctx.fillStyle = gwG;
        ctx.beginPath(); ctx.arc(gw.x, gw.y, gw.r, 0, Math.PI * 2); ctx.fill();
      });

      // Speed zones
      speedZones.forEach(sz => {
        ctx.fillStyle = 'rgba(251,191,36,0.15)';
        ctx.fillRect(sz.x - sz.w / 2, sz.y - sz.h / 2, sz.w, sz.h);
        ctx.strokeStyle = 'rgba(251,191,36,0.45)'; ctx.lineWidth = 1.5;
        ctx.strokeRect(sz.x - sz.w / 2, sz.y - sz.h / 2, sz.w, sz.h);
        ctx.fillStyle = 'rgba(255,220,60,0.9)'; ctx.font = `bold ${s(9)}px sans-serif`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('⚡BOOST', sz.x, sz.y);
      });

      // Sticky zones
      stickyZones.forEach(sz => {
        ctx.fillStyle = 'rgba(99,102,241,0.15)';
        ctx.fillRect(sz.x - sz.w / 2, sz.y - sz.h / 2, sz.w, sz.h);
        ctx.strokeStyle = 'rgba(99,102,241,0.45)'; ctx.lineWidth = 1.5;
        ctx.strokeRect(sz.x - sz.w / 2, sz.y - sz.h / 2, sz.w, sz.h);
        ctx.fillStyle = 'rgba(180,185,255,0.95)'; ctx.font = `bold ${s(9)}px sans-serif`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('🧲SLOW', sz.x, sz.y);
      });

      // Portals
      portalPairs.forEach(([ai, bi]) => {
        const pA = portals[ai], pB = portals[bi];
        [[pA, 'IN'], [pB, 'OUT']].forEach(([p, label], pi) => {
          const pulse = 0.65 + 0.35 * Math.sin(frame * 0.1 + pi * Math.PI);
          const pGrad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, PORTAL_R);
          pGrad.addColorStop(0, `rgba(167,139,250,${pulse * 0.7})`);
          pGrad.addColorStop(1, 'rgba(167,139,250,0)');
          ctx.fillStyle = pGrad; ctx.beginPath(); ctx.arc(p.x, p.y, PORTAL_R, 0, Math.PI * 2); ctx.fill();
          ctx.strokeStyle = `rgba(167,139,250,${pulse})`; ctx.lineWidth = 2.5; ctx.stroke();
          ctx.fillStyle = `rgba(240,235,255,${pulse})`; ctx.font = `bold ${s(8)}px sans-serif`;
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillText(label, p.x, p.y);
        });
        ctx.setLineDash([4, 5]);
        ctx.beginPath(); ctx.moveTo(pA.x, pA.y); ctx.lineTo(pB.x, pB.y);
        ctx.strokeStyle = 'rgba(167,139,250,0.2)'; ctx.lineWidth = 1; ctx.stroke();
        ctx.setLineDash([]);
      });

      // Physics bodies
      Matter.Composite.allBodies(world).forEach(b => {
        if (b.label === 'marble' || b.label === 'pendulum' || b.label === 'wrecking_ball') return;

        if (pinIds.has(b.id)) {
          const age = frame - (hitFrame.get(b.id) ?? -999);
          const g   = Math.max(0, 1 - age / 22);
          ctx.shadowColor = '#fff'; ctx.shadowBlur = 14 * g;
          ctx.beginPath(); ctx.arc(b.position.x, b.position.y, PIN_R + 1, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(129,140,248,${0.7 + g * 0.3})`; ctx.fill();
          ctx.strokeStyle = `rgba(224,231,255,${0.5 + g * 0.5})`; ctx.lineWidth = 2; ctx.stroke();
          ctx.shadowBlur = 0; return;
        }

        if (sbIds.has(b.id)) {
          const age = frame - (hitFrame.get(b.id) ?? -999);
          const g   = Math.max(0, 1 - age / 18);
          ctx.shadowColor = '#f59e0b'; ctx.shadowBlur = 20 * g;
          ctx.beginPath(); ctx.arc(b.position.x, b.position.y, b.circleRadius ?? s(18), 0, Math.PI * 2);
          ctx.fillStyle = `rgba(251,191,36,${0.45 + g * 0.55})`; ctx.fill();
          ctx.strokeStyle = '#fbbf24'; ctx.lineWidth = 2.5; ctx.stroke();
          ctx.shadowBlur = 0;
          ctx.font = `${s(13)}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillText('⭐', b.position.x, b.position.y); return;
        }

        if (b.label === 'wedge')        { drawPolyBody(ctx, b, '#4c1d95', '#7c3aed'); return; }
        if (b.label === 'rotbar')       { drawPolyBody(ctx, b, '#7c3aed', '#c4b5fd'); return; }
        if (b.label === 'flipper')      { drawPolyBody(ctx, b, '#065f46', '#34d399'); return; }
        if (b.label === 'osc_bumper')   { drawPolyBody(ctx, b, '#0e7490', '#22d3ee'); return; }
        if (b.label === 'mov_platform') { drawPolyBody(ctx, b, '#065f46', '#10b981'); return; }

        if (b.label === 'spin_wheel') {
          const sw = spinWheels.find(w => w.body.id === b.id);
          const cx = b.position.x, cy = b.position.y, r = b.circleRadius ?? s(28);
          ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
          ctx.fillStyle = '#831843'; ctx.fill();
          ctx.strokeStyle = '#f472b6'; ctx.lineWidth = 2.5; ctx.stroke();
          ctx.save(); ctx.translate(cx, cy); ctx.rotate(sw ? sw.angle : 0);
          ctx.strokeStyle = '#fb7185'; ctx.lineWidth = 2.5;
          for (let i = 0; i < 4; i++) {
            const a = (i / 4) * Math.PI * 2;
            ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); ctx.stroke();
          }
          ctx.restore(); return;
        }

        if (b.label === 'funnel_wall') { drawPolyBody(ctx, b, 'rgba(99,102,241,0.6)', '#818cf8'); return; }
        if (b.label === 'tube_wall')   { drawPolyBody(ctx, b, 'rgba(99,102,241,0.55)', '#818cf8'); return; }
        if (b.label === 'bump_wall')   { drawPolyBody(ctx, b, 'rgba(14,116,144,0.75)', '#22d3ee'); return; }

        if (b.label === 'spin_fan') {
          const sf = spinFans.find(f => f.body.id === b.id);
          const r  = b.circleRadius ?? s(32);
          const arms = sf ? sf.arms : 5;
          ctx.save();
          ctx.translate(b.position.x, b.position.y);
          ctx.rotate(sf ? sf.angle : 0);
          ctx.strokeStyle = '#2dd4bf'; ctx.lineWidth = 3;
          for (let i = 0; i < arms; i++) {
            const a = (i / arms) * Math.PI * 2;
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
            ctx.stroke();
            ctx.beginPath(); ctx.arc(Math.cos(a) * r, Math.sin(a) * r, 4, 0, Math.PI * 2);
            ctx.fillStyle = '#10b981'; ctx.fill();
          }
          ctx.restore();
          ctx.beginPath(); ctx.arc(b.position.x, b.position.y, 6, 0, Math.PI * 2);
          ctx.fillStyle = '#134e4a'; ctx.fill();
          ctx.strokeStyle = '#34d399'; ctx.lineWidth = 2; ctx.stroke();
          return;
        }
      });

      // Pendulums
      pendulums.forEach(({ bob, px, py }) => {
        ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(bob.position.x, bob.position.y);
        ctx.strokeStyle = 'rgba(167,139,250,0.65)'; ctx.lineWidth = 2.5; ctx.stroke();
        ctx.beginPath(); ctx.arc(bob.position.x, bob.position.y, s(14), 0, Math.PI * 2);
        ctx.fillStyle = '#7c3aed'; ctx.fill();
        ctx.strokeStyle = '#c4b5fd'; ctx.lineWidth = 2; ctx.stroke();
        ctx.beginPath(); ctx.arc(px, py, 5, 0, Math.PI * 2);
        ctx.fillStyle = '#a78bfa'; ctx.fill();
      });

      // Wrecking balls
      wreckingBalls.forEach(({ bob, px, py }) => {
        const wx = bob.position.x, wy = bob.position.y, wr = s(17);
        ctx.save();
        ctx.setLineDash([5, 4]);
        ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(wx, wy);
        ctx.strokeStyle = 'rgba(120,113,108,0.85)'; ctx.lineWidth = 3; ctx.stroke();
        ctx.restore();
        const wg = ctx.createRadialGradient(wx - wr * 0.3, wy - wr * 0.3, 1, wx, wy, wr);
        wg.addColorStop(0, '#57534e'); wg.addColorStop(1, '#1c1917');
        ctx.beginPath(); ctx.arc(wx, wy, wr, 0, Math.PI * 2);
        ctx.fillStyle = wg; ctx.fill();
        ctx.strokeStyle = '#78716c'; ctx.lineWidth = 3; ctx.stroke();
        ctx.strokeStyle = '#a8a29e'; ctx.lineWidth = 2;
        for (let i = 0; i < 8; i++) {
          const a = bob.angle + (i / 8) * Math.PI * 2;
          ctx.beginPath();
          ctx.moveTo(wx + Math.cos(a) * (wr - 3), wy + Math.sin(a) * (wr - 3));
          ctx.lineTo(wx + Math.cos(a) * (wr + 5), wy + Math.sin(a) * (wr + 5));
          ctx.stroke();
        }
        ctx.beginPath(); ctx.arc(px, py, 5, 0, Math.PI * 2);
        ctx.fillStyle = '#9ca3af'; ctx.fill();
      });

      // Funnel dark overlay (covers area outside tube)
      ctx.fillStyle = 'rgba(10,6,24,0.82)';
      ctx.beginPath();
      ctx.moveTo(0, FUNNEL_TOP); ctx.lineTo(tubeLeft, FUNNEL_BOT);
      ctx.lineTo(tubeLeft, boardH); ctx.lineTo(0, boardH);
      ctx.closePath(); ctx.fill();
      ctx.beginPath();
      ctx.moveTo(CW, FUNNEL_TOP); ctx.lineTo(tubeRight, FUNNEL_BOT);
      ctx.lineTo(tubeRight, boardH); ctx.lineTo(CW, boardH);
      ctx.closePath(); ctx.fill();

      // Funnel border lines
      ctx.strokeStyle = '#818cf8'; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.moveTo(0, FUNNEL_TOP); ctx.lineTo(tubeLeft, FUNNEL_BOT); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(CW, FUNNEL_TOP); ctx.lineTo(tubeRight, FUNNEL_BOT); ctx.stroke();

      // ── Tube visual ────────────────────────────────────────────────────────
      // Tube interior background
      ctx.fillStyle = 'rgba(6, 3, 18, 0.97)';
      ctx.fillRect(tubeLeft, FUNNEL_BOT, tubeGap, tubeH);

      // Tube rounded bottom cap
      ctx.beginPath();
      ctx.arc(CW / 2, tubeFloorY, tubeGap / 2, 0, Math.PI);
      ctx.fillStyle = 'rgba(6, 3, 18, 0.97)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(99,102,241,0.55)';
      ctx.lineWidth = 2; ctx.stroke();

      // Horizontal depth tick marks
      ctx.strokeStyle = 'rgba(99,102,241,0.18)';
      ctx.lineWidth = 1;
      for (let ty = FUNNEL_BOT + s(15); ty < tubeFloorY - s(5); ty += s(18)) {
        ctx.beginPath();
        ctx.moveTo(tubeLeft + s(3), ty);
        ctx.lineTo(tubeRight - s(3), ty);
        ctx.stroke();
      }

      // Rank stack indicators on tube side
      exitRef.current.forEach((e, i) => {
        const indicY = tubeFloorY - MR * 2 - i * (MR * 2 + s(3)) - s(5);
        if (indicY < FUNNEL_BOT + s(20)) return;
        // rank badge on the left wall exterior
        ctx.font = `bold ${s(8)}px sans-serif`;
        ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
        ctx.fillStyle = e.color;
        ctx.fillText(`#${e.rank}`, tubeLeft - s(6), indicY);
      });

      // ── Marbles ────────────────────────────────────────────────────────────
      marbles.forEach(m => {
        const x = m.position.x;
        const y = m.position.y;
        if (!isFinite(x) || !isFinite(y)) return;

        // Drop shadow
        ctx.beginPath(); ctx.arc(x + 2, y + 3, MR, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fill();

        // Radial gradient fill
        const g = ctx.createRadialGradient(x - MR * 0.3, y - MR * 0.35, MR * 0.05, x, y, MR);
        g.addColorStop(0, 'rgba(255,255,255,0.9)');
        g.addColorStop(0.35, m._color);
        g.addColorStop(1, m._color + 'cc');
        ctx.beginPath(); ctx.arc(x, y, MR, 0, Math.PI * 2);
        ctx.fillStyle = g; ctx.fill();

        // Ring for exited marbles (gold/silver/bronze/color)
        if (m._exited) {
          const ringColor = m._rank === 1 ? '#FFD700'
            : m._rank === 2 ? '#C0C0C0'
            : m._rank === 3 ? '#CD7F32'
            : m._color + '99';
          ctx.beginPath(); ctx.arc(x, y, MR + 3, 0, Math.PI * 2);
          ctx.strokeStyle = ringColor; ctx.lineWidth = 2.5; ctx.stroke();
        }

        // Text: name when active, rank when stacked in tube
        const fontSize = MR >= s(12) ? s(9) : s(8);
        ctx.font = `bold ${fontSize}px sans-serif`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.strokeStyle = 'rgba(0,0,0,0.75)'; ctx.lineWidth = 3;
        if (m._exited) {
          ctx.strokeText(`#${m._rank}`, x, y);
          ctx.fillStyle = 'white'; ctx.fillText(`#${m._rank}`, x, y);
        } else {
          const maxChars = MR >= s(12) ? 3 : 2;
          const label = m._name.slice(0, maxChars);
          ctx.strokeText(label, x, y);
          ctx.fillStyle = 'white'; ctx.fillText(label, x, y);
        }
      });

      // Particles
      particlesRef.current.forEach(p => {
        const a = p.life / p.maxLife;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r * a, 0, Math.PI * 2);
        ctx.fillStyle = p.color + Math.floor(a * 255).toString(16).padStart(2, '0');
        ctx.fill();
      });

      ctx.restore(); // end world-space

    };

    rafId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(rafId);
      if (notifTimeoutRef.current) { clearTimeout(notifTimeoutRef.current); notifTimeoutRef.current = null; }
      if (endTimerRef.current)     { clearTimeout(endTimerRef.current);     endTimerRef.current = null; }
      Matter.Events.off(engine);
      Matter.World.clear(world, false);
      Matter.Engine.clear(engine);
    };
  }, [phase]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── UI ────────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col items-center gap-4 w-full">

      {/* Setup */}
      {phase === 'setup' && (
        <div className="w-full max-w-md bg-white rounded-2xl shadow-md p-6 flex flex-col gap-4">
          <h2 className="text-xl font-bold text-gray-800 text-center">🎰 핀볼 사다리</h2>
          <p className="text-sm text-gray-500 text-center">참여자와 당첨 번호를 설정하세요 (최소 2명)</p>

          <ul className="flex flex-col gap-2">
            {items.map((it, i) => (
              <li key={i} className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2">
                <label
                  className="w-7 h-7 rounded-full cursor-pointer border-2 border-white shadow-sm shrink-0 hover:scale-110 transition-transform"
                  style={{ background: it.color }} title="색상 변경"
                >
                  <input type="color" className="sr-only" value={it.color} onChange={e => updateColor(i, e.target.value)} />
                </label>
                <span className="flex-1 text-sm font-medium text-gray-700">{it.name}</span>
                <button onClick={() => removeItem(i)} className="text-gray-300 hover:text-red-400 transition-colors">
                  <X size={14} />
                </button>
              </li>
            ))}
          </ul>

          {items.length < 99 && (
            <div className="flex gap-2">
              <input
                className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                placeholder="이름 입력 후 Enter"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addItem()}
              />
              <button onClick={addItem} className="bg-indigo-500 text-white px-3 py-2 rounded-lg hover:bg-indigo-600 transition-colors">
                <Plus size={16} />
              </button>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            {/* 당첨 번호 */}
            <div className="bg-indigo-50 rounded-xl p-3 flex flex-col gap-2">
              <p className="text-sm font-semibold text-indigo-700">🏆 당첨 번호</p>
              <p className="text-xs text-indigo-500">몇 번째 도착이 당첨?</p>
              {items.length <= 8 ? (
                <div className="flex gap-1.5 flex-wrap">
                  {items.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setWinRank(i + 1)}
                      className={`w-9 h-9 rounded-full font-bold text-sm transition-all ${
                        winRank === i + 1
                          ? 'bg-indigo-600 text-white shadow-md scale-110'
                          : 'bg-white text-gray-600 border border-gray-200 hover:border-indigo-400'
                      }`}
                    >
                      {i + 1}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <input
                    type="number" min={1} max={items.length}
                    value={winRank}
                    onChange={e => setWinRank(Math.max(1, Math.min(items.length, Number(e.target.value) || 1)))}
                    className="w-20 border border-indigo-300 rounded-lg px-2 py-1.5 text-center font-bold text-indigo-700 text-lg focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  />
                  <span className="text-xs text-indigo-400">/ {items.length}</span>
                </div>
              )}
              <p className="text-xs text-indigo-400">{winRank}번째 도착 → 당첨 🎉</p>
            </div>

            {/* 카메라 트래킹 */}
            <div className="bg-sky-50 rounded-xl p-3 flex flex-col gap-2">
              <p className="text-sm font-semibold text-sky-700">🎥 카메라 추적</p>
              <p className="text-xs text-sky-500">몇 번째 공을 추적할까요?</p>
              {items.length <= 8 ? (
                <div className="flex gap-1.5 flex-wrap">
                  {items.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setCamTrack(i + 1)}
                      className={`w-9 h-9 rounded-full font-bold text-sm transition-all ${
                        camTrack === i + 1
                          ? 'bg-sky-500 text-white shadow-md scale-110'
                          : 'bg-white text-gray-600 border border-gray-200 hover:border-sky-400'
                      }`}
                    >
                      {i + 1}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <input
                    type="number" min={1} max={items.length}
                    value={camTrack}
                    onChange={e => setCamTrack(Math.max(1, Math.min(items.length, Number(e.target.value) || 1)))}
                    className="w-20 border border-sky-300 rounded-lg px-2 py-1.5 text-center font-bold text-sky-700 text-lg focus:outline-none focus:ring-2 focus:ring-sky-400"
                  />
                  <span className="text-xs text-sky-400">/ {items.length}</span>
                </div>
              )}
              <p className="text-xs text-sky-400">{camTrack}번째 앞선 공 추적 📹</p>
            </div>
          </div>

          <button
            onClick={startGame}
            disabled={items.length < 2}
            className="w-full py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 disabled:opacity-40 transition-colors shadow"
          >
            🎮 게임 시작
          </button>
        </div>
      )}

      {/* Playing */}
      {phase === 'playing' && (
        <div className="flex flex-col items-center gap-3 w-full">
          <div className="flex items-center gap-3 text-sm text-gray-500">
            <span>🏆 <strong className="text-indigo-600">{winRank}번째</strong> 도착이 당첨</span>
            <span className="text-gray-300">|</span>
            <span>🎥 <strong className="text-sky-600">{camTrack}번째</strong> 공 추적 중</span>
            <span className="text-gray-300">|</span>
            <span>도착: {exitOrder.length}/{items.length}</span>
          </div>
          <canvas
            ref={canvasRef} width={CW} height={CVH}
            className="rounded-2xl shadow-lg border border-indigo-900"
            style={{ maxWidth: '100%', cursor: 'grab', userSelect: 'none' }}
            onMouseDown={e => {
              isDraggingRef.current = true;
              dragStartYRef.current = e.clientY;
              dragStartCamYRef.current = camYRef.current;
              lastManualRef.current = Date.now();
              e.currentTarget.style.cursor = 'grabbing';
            }}
            onMouseMove={e => {
              if (!isDraggingRef.current) return;
              const rect = e.currentTarget.getBoundingClientRect();
              const scale = CVH / rect.height;
              const dy = (e.clientY - dragStartYRef.current) * scale;
              camYRef.current = Math.max(0, Math.min(boardHRef.current - CVH,
                dragStartCamYRef.current - dy));
              lastManualRef.current = Date.now();
            }}
            onMouseUp={e => {
              isDraggingRef.current = false;
              lastManualRef.current = Date.now();
              e.currentTarget.style.cursor = 'grab';
            }}
            onMouseLeave={e => {
              isDraggingRef.current = false;
              lastManualRef.current = Date.now();
              e.currentTarget.style.cursor = 'grab';
            }}
            onWheel={e => {
              e.preventDefault();
              const rect = e.currentTarget.getBoundingClientRect();
              const scale = CVH / rect.height;
              camYRef.current = Math.max(0, Math.min(boardHRef.current - CVH,
                camYRef.current + e.deltaY * scale));
              lastManualRef.current = Date.now();
            }}
          />

          {/* 당첨 알림 오버레이 — 2초 표시 후 결과 화면으로 전환 */}
          {showNotif && winner && (
            <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none">
              <div
                className="rounded-3xl px-12 py-8 text-center shadow-2xl"
                style={{ background: 'rgba(0,0,0,0.78)', border: `3px solid ${winner.color}` }}
              >
                <div className="text-6xl">🎉</div>
                <div className="text-4xl font-black text-white mt-3">당첨!</div>
                <div className="text-2xl font-bold mt-2" style={{ color: winner.color }}>{winner.name}</div>
                <div className="text-sm text-white/70 mt-1">{winRank}번째 도착</div>
              </div>
            </div>
          )}
          {exitOrder.length > 0 && (
            <div className="w-full max-w-2xl flex flex-wrap gap-2">
              {exitOrder.map((r, i) => (
                <span
                  key={i}
                  className={`px-3 py-1 rounded-full text-white text-sm font-bold ${r.rank === winRank ? 'ring-2 ring-yellow-400 scale-105' : ''}`}
                  style={{ background: r.color }}
                >
                  {r.rank}번째: {r.name}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Result */}
      {phase === 'result' && (
        <div className="w-full max-w-md bg-white rounded-2xl shadow-md p-6 flex flex-col gap-4">
          {winner && (
            <div className="rounded-2xl p-5 text-center" style={{ background: winner.color + '22', border: `2px solid ${winner.color}` }}>
              <p className="text-4xl mb-1">🎉</p>
              <p className="text-2xl font-bold" style={{ color: winner.color }}>{winner.name}</p>
              <p className="text-sm text-gray-500 mt-1">{winRank}번째 도착 · 당첨!</p>
            </div>
          )}
          <h3 className="text-sm font-bold text-gray-600 flex items-center gap-2">
            <Trophy size={14} className="text-yellow-500" /> 전체 도착 순서
          </h3>
          <ul className="flex flex-col gap-1.5">
            {[...exitOrder].sort((a, b) => a.rank - b.rank).map(r => (
              <li
                key={r.rank}
                className={`flex items-center gap-3 px-3 py-2 rounded-xl ${r.rank === winRank ? 'ring-2 ring-yellow-400' : ''}`}
                style={{ background: r.color + '1a', borderLeft: `4px solid ${r.color}` }}
              >
                <span className="text-xl w-7 text-center">
                  {r.rank === winRank ? '🏆' : r.rank === 1 ? '🥇' : r.rank === 2 ? '🥈' : r.rank === 3 ? '🥉' : `${r.rank}.`}
                </span>
                <div>
                  <p className="font-bold text-gray-800 text-sm">{r.name}</p>
                  <p className="text-xs text-gray-400">{r.rank}번째 도착{r.rank === winRank ? ' · 🎉 당첨!' : ''}</p>
                </div>
              </li>
            ))}
          </ul>
          <button
            onClick={() => { setExitOrder([]); exitRef.current = []; setWinner(null); setPhase('setup'); }}
            className="w-full py-2.5 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-colors"
          >
            다시 하기
          </button>
        </div>
      )}
    </div>
  );
}
