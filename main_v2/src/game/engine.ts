// Core game engine for Slap Dash!
import type { Player, Vec2, Particle, FloatingText, GamePhase, Obstacle } from './types';
import { getHideCooldown } from './types';
import { drawBoy, drawGirl } from './sprites';

export type Input = {
  move: Vec2; // unit vector
  action: boolean; // slap
  pause: boolean;
  hide?: boolean; // hide in bush
};

export type GameMode = 'cpu' | 'local' | 'online';

export type NetStateSnapshot = {
  p1: {
    pos: Vec2; vel: Vec2; facing: Vec2; slapAnim: number; hitFlash: number;
    isMoving: boolean; isChaser: boolean; character: 'boy' | 'girl';
    name: string; hidden: boolean; score: number;
  };
  p2: {
    pos: Vec2; vel: Vec2; facing: Vec2; slapAnim: number; hitFlash: number;
    isMoving: boolean; isChaser: boolean; character: 'boy' | 'girl';
    name: string; hidden: boolean; score: number;
  };
  timeLeft: number; currentTurn: 1 | 2;
  phase: 'countdown' | 'turn1' | 'turn2' | 'result' | 'paused';
  countdown: number;
  result?: { winner: 'p1' | 'p2' | 'tie'; diff: number; p1Score: number; p2Score: number } | null;
};

export type NetMessage =
  | { type: 'hello'; name: string; character: 'boy' | 'girl'; password?: string }
  | { type: 'input'; move: Vec2; action: boolean; hide: boolean }
  | { type: 'state'; p1: NetStateSnapshot['p1']; p2: NetStateSnapshot['p2']; timeLeft: number; currentTurn: 1 | 2; phase: NetStateSnapshot['phase']; countdown: number; result?: NetStateSnapshot['result'] }
  | { type: 'chat'; text: string };

export type GameState = {
  phase: GamePhase;
  prevPhase: GamePhase;
  p1: Player;
  p2: Player;
  p1Score: number;
  p2Score: number;
  timeLeft: number;
  turnTimeLimit: number;
  currentTurn: 1 | 2; // 1 = p1 chases, 2 = p2 chases
  turnIndex: number; // 0 or 1, which turn we're on (for ending after both have chased)
  particles: Particle[];
  floats: FloatingText[];
  // arena
  arenaRadius: number;
  arenaCenter: Vec2;
  obstacles: Obstacle[];
  // camera shake
  shake: number;
  shakeTime: number;
  // flash overlay
  flashIntensity: number;
  // hit cooldown
  hitCooldown: number;
  // input
  input1: Input;
  input2: Input;
  // canvas size
  width: number;
  height: number;
  // countdown
  countdown: number;
  // ai
  aiTarget: Vec2;
  aiChangeTimer: number;
  aiWindup: number;
  aiDifficulty: number; // 0..1
  // result
  turnResult: { winner: 'p1' | 'p2' | 'tie'; diff: number } | null;
  resultTimer: number;
  // adaptive hide system
  hideCooldownBase: number; // base cooldown (e.g. 6-11s depending on game length)
  hideRefillRate: number; // how fast hide time refills (1.0 = full refill in 1s)
  // AI stuck detection
  aiStuckTimer: number;
  // touch joystick (player 1)
  joystick1: { active: boolean; x: number; y: number; dx: number; dy: number; touchId: number | null };
  // touch slap (player 1) and joystick (player 2 in local mode)
  slap1TouchId: number | null;
  joystick2: { active: boolean; x: number; y: number; dx: number; dy: number; touchId: number | null };
  slap2TouchId: number | null;
  // Mobile UI Buttons State
  mobileButtons: {
    p1Attack: boolean;
    p1Hide: boolean;
    p2Attack: boolean;
    p2Hide: boolean;
  };
  // pause toggle edge
  pauseToggleEdge: boolean;
  // mode
  mode: GameMode;
  // online
  isOnlineHost: boolean;
  netReady: boolean;
  remoteName: string;
  remoteCharacter: 'boy' | 'girl' | null;
  // chat
  chat: { from: string; text: string; time: number }[];
  // local multiplayer second player
  p2Local: boolean;
};

export function createGameState(w: number, h: number): GameState {
  const arenaRadius = Math.min(w, h) * 0.42;
  const arenaCenter = { x: w / 2, y: h / 2 };
  const radius = 22;
  const obstacles = generateObstacles(arenaCenter, arenaRadius);

  return {
    phase: 'menu',
    prevPhase: 'menu',
    p1: {
      id: 'p1',
      pos: { x: arenaCenter.x - 80, y: arenaCenter.y },
      vel: { x: 0, y: 0 },
      radius,
      facing: { x: 1, y: 0 },
      slapAnim: 0,
      hitFlash: 0,
      bob: Math.random() * Math.PI * 2,
      isMoving: false,
      character: 'boy',
      isChaser: false,
      isHuman: true,
      isLocal: true,
      score: 0,
      name: 'Player 1',
      hidden: false,
      hideTimer: 0,
      hideTimeLeft: 5,
      hideCooldown: 0,
      safe: false,
      safeTime: 0,
      safeTimeLeft: 5,
      safeCooldown: 0,
    },
    p2: {
      id: 'p2',
      pos: { x: arenaCenter.x + 80, y: arenaCenter.y },
      vel: { x: 0, y: 0 },
      radius,
      facing: { x: -1, y: 0 },
      slapAnim: 0,
      hitFlash: 0,
      bob: Math.random() * Math.PI * 2,
      isMoving: false,
      character: 'girl',
      isChaser: true,
      isHuman: false,
      isLocal: false,
      score: 0,
      name: 'Player 2',
      hidden: false,
      hideTimer: 0,
      hideTimeLeft: 5,
      hideCooldown: 0,
      safe: false,
      safeTime: 0,
      safeTimeLeft: 5,
      safeCooldown: 0,
    },
    p1Score: 0,
    p2Score: 0,
    timeLeft: 15,
    turnTimeLimit: 15,
    currentTurn: 1,
    turnIndex: 0,
    particles: [],
    floats: [],
    arenaRadius,
    arenaCenter,
    obstacles,
    shake: 0,
    shakeTime: 0,
    flashIntensity: 0,
    hitCooldown: 0,
    input1: { move: { x: 0, y: 0 }, action: false, pause: false, hide: false },
    input2: { move: { x: 0, y: 0 }, action: false, pause: false, hide: false },
    width: w,
    height: h,
    countdown: 2.4,
    aiTarget: { x: 0, y: 0 },
    aiChangeTimer: 0,
    aiWindup: 0,
    aiDifficulty: 0.6,
    turnResult: null,
    resultTimer: 0,
    joystick1: { active: false, x: 0, y: 0, dx: 0, dy: 0, touchId: null },
    slap1TouchId: null,
    joystick2: { active: false, x: 0, y: 0, dx: 0, dy: 0, touchId: null },
    slap2TouchId: null,
    mobileButtons: {
      p1Attack: false,
      p1Hide: false,
      p2Attack: false,
      p2Hide: false,
    },
    pauseToggleEdge: false,
    mode: 'cpu',
    isOnlineHost: false,
    netReady: false,
    remoteName: '',
    remoteCharacter: null,
    chat: [],
    p2Local: false,
    hideCooldownBase: 10,
    hideRefillRate: 1,
    aiStuckTimer: 0,
  };
}

let _obsId = 0;
function generateObstacles(center: Vec2, radius: number): Obstacle[] {
  const list: Obstacle[] = [];
  const safeR = radius - 40;
  // Trees - circular cover, can't pass through
  const treePositions: Vec2[] = [
    { x: center.x - radius * 0.5, y: center.y - radius * 0.45 },
    { x: center.x + radius * 0.55, y: center.y - radius * 0.4 },
    { x: center.x - radius * 0.6, y: center.y + radius * 0.3 },
    { x: center.x + radius * 0.45, y: center.y + radius * 0.55 },
    { x: center.x, y: center.y + radius * 0.7 },
    { x: center.x, y: center.y - radius * 0.7 },
    { x: center.x - radius * 0.25, y: center.y - radius * 0.2 },
    { x: center.x + radius * 0.2, y: center.y + radius * 0.15 },
  ];
  for (const p of treePositions) {
    const dx = p.x - center.x;
    const dy = p.y - center.y;
    const d = Math.hypot(dx, dy);
    if (d < safeR - 30) {
      list.push({
        id: ++_obsId,
        kind: 'tree',
        pos: { x: p.x, y: p.y },
        radius: 22 + Math.random() * 8,
        variant: Math.floor(Math.random() * 3),
      });
    }
  }
  // Walls - rectangular barriers
  const wallConfigs: { pos: Vec2; w: number; h: number; angle: number }[] = [
    { pos: { x: center.x - radius * 0.35, y: center.y - radius * 0.05 }, w: 60, h: 16, angle: 0.4 },
    { pos: { x: center.x + radius * 0.3, y: center.y + radius * 0.15 }, w: 70, h: 16, angle: -0.5 },
    { pos: { x: center.x + radius * 0.05, y: center.y + radius * 0.55 }, w: 50, h: 14, angle: 0.1 },
    { pos: { x: center.x - radius * 0.1, y: center.y - radius * 0.55 }, w: 55, h: 14, angle: -0.2 },
  ];
  for (const w of wallConfigs) {
    const dx = w.pos.x - center.x;
    const dy = w.pos.y - center.y;
    const d = Math.hypot(dx, dy);
    if (d < safeR - 30) {
      list.push({
        id: ++_obsId,
        kind: 'wall',
        pos: { x: w.pos.x, y: w.pos.y },
        w: w.w,
        h: w.h,
        angle: w.angle,
        variant: Math.floor(Math.random() * 2),
      });
    }
  }
  // Bushes - small cover, can pass over but hides
  const bushPositions: Vec2[] = [
    { x: center.x - radius * 0.45, y: center.y - radius * 0.2 },
    { x: center.x + radius * 0.4, y: center.y + radius * 0.1 },
    { x: center.x + radius * 0.1, y: center.y - radius * 0.3 },
    { x: center.x - radius * 0.15, y: center.y + radius * 0.4 },
  ];
  for (const p of bushPositions) {
    const dx = p.x - center.x;
    const dy = p.y - center.y;
    const d = Math.hypot(dx, dy);
    if (d < safeR - 25) {
      list.push({
        id: ++_obsId,
        kind: 'bush',
        pos: { x: p.x, y: p.y },
        radius: 18 + Math.random() * 4,
        variant: Math.floor(Math.random() * 2),
      });
    }
  }
  return list;
}

export function resizeGame(state: GameState, w: number, h: number) {
  const cx = w / 2;
  const cy = h / 2;
  const oldCenter = state.arenaCenter;
  const oldR = state.arenaRadius;
  state.width = w;
  state.height = h;
  state.arenaCenter = { x: cx, y: cy };
  state.arenaRadius = Math.min(w, h) * 0.42;
  const scale = state.arenaRadius / oldR;
  [state.p1, state.p2].forEach(p => {
    const dx = p.pos.x - oldCenter.x;
    const dy = p.pos.y - oldCenter.y;
    p.pos.x = cx + dx * scale;
    p.pos.y = cy + dy * scale;
  });
  // regenerate obstacles relative to new center
  state.obstacles = generateObstacles(state.arenaCenter, state.arenaRadius);
}

function dist(a: Vec2, b: Vec2) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function clampToArena(state: GameState, p: Player) {
  const d = dist(p.pos, state.arenaCenter);
  const maxR = state.arenaRadius - p.radius;
  if (d > maxR) {
    const dx = (p.pos.x - state.arenaCenter.x) / d;
    const dy = (p.pos.y - state.arenaCenter.y) / d;
    p.pos.x = state.arenaCenter.x + dx * maxR;
    p.pos.y = state.arenaCenter.y + dy * maxR;
    const dot = p.vel.x * dx + p.vel.y * dy;
    p.vel.x -= 2 * dot * dx * 0.5;
    p.vel.y -= 2 * dot * dy * 0.5;
  }
}

// Resolve collision between a circle (player) and a tree (circle) or wall (rotated rect)
function resolveObstacleCollision(state: GameState, p: Player, o: Obstacle) {
  if (o.kind === 'tree') {
    // trees are solid - push player out
    const dx = p.pos.x - o.pos.x;
    const dy = p.pos.y - o.pos.y;
    const d = Math.hypot(dx, dy) || 0.001;
    const minDist = p.radius + (o.radius || 0);
    if (d < minDist) {
      const overlap = minDist - d;
      const nx = dx / d;
      const ny = dy / d;
      p.pos.x += nx * overlap;
      p.pos.y += ny * overlap;
      const dot = p.vel.x * nx + p.vel.y * ny;
      if (dot < 0) {
        p.vel.x -= dot * nx;
        p.vel.y -= dot * ny;
      }
    }
  } else if (o.kind === 'bush') {
    // bushes are passable but spawn leaf particles when player walks through
    if (Math.random() < 0.2) spawnLeafParticles(state, p.pos);
  } else if (o.kind === 'wall') {
    // wall: rotated rectangle; transform player into wall local space
    const cos = Math.cos(-(o.angle || 0));
    const sin = Math.sin(-(o.angle || 0));
    const lx = (p.pos.x - o.pos.x) * cos - (p.pos.y - o.pos.y) * sin;
    const ly = (p.pos.x - o.pos.x) * sin + (p.pos.y - o.pos.y) * cos;
    const halfW = (o.w || 0) / 2;
    const halfH = (o.h || 0) / 2;
    // closest point on rect
    const cx = Math.max(-halfW, Math.min(halfW, lx));
    const cy = Math.max(-halfH, Math.min(halfH, ly));
    const dx = lx - cx;
    const dy = ly - cy;
    const d = Math.hypot(dx, dy);
    if (d < p.radius) {
      // push player out
      // normal in local space
      let nlx: number, nly: number;
      if (d > 0.001) {
        nlx = dx / d;
        nly = dy / d;
      } else {
        // inside rect, push out along nearest edge
        const dxLeft = lx + halfW;
        const dxRight = halfW - lx;
        const dyTop = ly + halfH;
        const dyBot = halfH - ly;
        const m = Math.min(dxLeft, dxRight, dyTop, dyBot);
        if (m === dxLeft) { nlx = -1; nly = 0; }
        else if (m === dxRight) { nlx = 1; nly = 0; }
        else if (m === dyTop) { nlx = 0; nly = -1; }
        else { nlx = 0; nly = 1; }
      }
      const overlap = p.radius - d;
      // apply in local space
      const newLx = lx + nlx * overlap;
      const newLy = ly + nly * overlap;
      // transform back
      const a = o.angle || 0;
      const cos2 = Math.cos(a);
      const sin2 = Math.sin(a);
      p.pos.x = o.pos.x + newLx * cos2 - newLy * sin2;
      p.pos.y = o.pos.y + newLx * sin2 + newLy * cos2;
      // bounce vel
      const cosA = Math.cos(a);
      const sinA = Math.sin(a);
      // transform vel into local
      const vlx = p.vel.x * cosA - p.vel.y * sinA;
      const vly = p.vel.x * sinA + p.vel.y * cosA;
      const dot = vlx * nlx + vly * nly;
      if (dot < 0) {
        const nvlx = vlx - dot * nlx;
        const nvly = vly - dot * nly;
        p.vel.x = nvlx * cosA + nvly * sinA;
        p.vel.y = -nvlx * sinA + nvly * cosA;
      }
    }
  }
}

function spawnHitParticles(state: GameState, at: Vec2, color: string) {
  const palette = [color, color, '#fbbf24', '#fff', '#fff'];
  for (let i = 0; i < 24; i++) {
    const a = Math.random() * Math.PI * 2;
    const sp = 80 + Math.random() * 220;
    state.particles.push({
      pos: { ...at },
      vel: { x: Math.cos(a) * sp, y: Math.sin(a) * sp },
      life: 0.4 + Math.random() * 0.4,
      maxLife: 0.8,
      color: palette[Math.floor(Math.random() * palette.length)],
      size: 2 + Math.random() * 4,
      shape: Math.random() < 0.4 ? 'star' : 'circle',
      rotation: Math.random() * Math.PI * 2,
    });
  }
  for (let i = 0; i < 2; i++) {
    state.particles.push({
      pos: { ...at },
      vel: { x: 0, y: 0 },
      life: 0.5,
      maxLife: 0.5,
      color,
      size: 10,
      shape: 'ring',
    });
  }
}

function spawnLeafParticles(state: GameState, at: Vec2) {
  for (let i = 0; i < 8; i++) {
    const a = Math.random() * Math.PI * 2;
    const sp = 40 + Math.random() * 100;
    state.particles.push({
      pos: { ...at },
      vel: { x: Math.cos(a) * sp, y: Math.sin(a) * sp - 30 },
      life: 0.6 + Math.random() * 0.4,
      maxLife: 1.0,
      color: Math.random() < 0.5 ? '#16a34a' : '#65a30d',
      size: 3 + Math.random() * 3,
      shape: 'leaf',
      rotation: Math.random() * Math.PI * 2,
    });
  }
}

function spawnSlapTrail(state: GameState, p: Player) {
  if (p.slapAnim > 0.3 && p.slapAnim < 0.7) {
    const tx = p.pos.x + p.facing.x * (p.radius + 10);
    const ty = p.pos.y + p.facing.y * (p.radius + 10);
    state.particles.push({
      pos: { x: tx, y: ty },
      vel: { x: -p.facing.x * 30, y: -p.facing.y * 30 },
      life: 0.3,
      maxLife: 0.3,
      color: '#fbbf24',
      size: 3,
      shape: 'spark',
    });
  }
}

function addFloatText(state: GameState, pos: Vec2, text: string, color: string) {
  state.floats.push({ pos: { ...pos }, text, color, life: 1.0, maxLife: 1.0 });
}

// Pathfinding for AI: try a few waypoints around obstacles using simple steering
function aiPathToward(state: GameState, from: Vec2, to: Vec2): Vec2 {
  // Direct direction
  let dx = to.x - from.x;
  let dy = to.y - from.y;
  const d = Math.hypot(dx, dy) || 1;
  dx /= d; dy /= d;

  // Check if direct path is blocked by any obstacle - simple detour logic
  for (const o of state.obstacles) {
    if (o.kind === 'bush') continue;
    if (o.kind === 'tree') {
      // project onto line from->to
      const px = to.x - from.x;
      const py = to.y - from.y;
      const fx = o.pos.x - from.x;
      const fy = o.pos.y - from.y;
      const t = Math.max(0, Math.min(1, (fx * px + fy * py) / (px * px + py * py)));
      const cx = from.x + px * t;
      const cy = from.y + py * t;
      const distToObs = Math.hypot(cx - o.pos.x, cy - o.pos.y);
      if (distToObs < (o.radius || 0) + 12) {
        // detour perpendicular to direction
        const perpX = -dy;
        const perpY = dx;
        const side = ((o.pos.x - from.x) * dx + (o.pos.y - from.y) * dy) > 0 ? 1 : -1;
        return { x: dx * 0.2 + perpX * side * 0.95, y: dy * 0.2 + perpY * side * 0.95 };
      }
    } else if (o.kind === 'wall') {
      // check distance to wall's center, detour if close to wall's path
      const distToWall = Math.hypot(o.pos.x - from.x, o.pos.y - from.y);
      if (distToWall < Math.max(o.w || 50, o.h || 20) + 15) {
        const perpX = -dy;
        const perpY = dx;
        const side = ((o.pos.x - from.x) * dx + (o.pos.y - from.y) * dy) > 0 ? 1 : -1;
        return { x: dx * 0.3 + perpX * side * 0.85, y: dy * 0.3 + perpY * side * 0.85 };
      }
    }
  }
  return { x: dx, y: dy };
}

const AI_MAX_SPEED = 300; // match human speed for fair play

function aiRunFrom(state: GameState, runner: Player, chaser: Player, dt: number) {
  state.aiChangeTimer -= dt;
  // track how long the AI has been stuck (low velocity)
  const speedNow = Math.hypot(runner.vel.x, runner.vel.y);
  if (speedNow < 30) {
    state.aiStuckTimer = (state.aiStuckTimer || 0) + dt;
  } else {
    state.aiStuckTimer = 0;
  }
  // if stuck for more than 0.8s, force a teleport-like recovery
  if (state.aiStuckTimer > 0.8) {
    // teleport AI to a safe spot far from chaser
    let best: Vec2 = runner.pos;
    let bestScore = -Infinity;
    for (let i = 0; i < 30; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = state.arenaRadius * 0.5;
      const cand = {
        x: state.arenaCenter.x + Math.cos(a) * r,
        y: state.arenaCenter.y + Math.sin(a) * r,
      };
      const cd = Math.hypot(cand.x - chaser.pos.x, cand.y - chaser.pos.y);
      let obsPenalty = 0;
      for (const o of state.obstacles) {
        const od = Math.hypot(cand.x - o.pos.x, cand.y - o.pos.y);
        if (o.kind === 'tree' && od < (o.radius || 0) + 30) obsPenalty += 500;
        if (o.kind === 'wall' && od < Math.max(o.w || 50, o.h || 20) + 20) obsPenalty += 500;
      }
      const score = cd - obsPenalty;
      if (score > bestScore) {
        bestScore = score;
        best = cand;
      }
    }
    runner.pos = best;
    runner.vel.x = 0;
    runner.vel.y = 0;
    state.aiStuckTimer = 0;
    state.aiChangeTimer = 0.5;
  }
  if (state.aiChangeTimer <= 0 || speedNow < 30) {
    // pick a point that's far from chaser and not on an obstacle
    let best: Vec2 = runner.pos;
    let bestScore = -Infinity;
    for (let i = 0; i < 20; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = state.arenaRadius * (0.4 + Math.random() * 0.55);
      const cand = {
        x: state.arenaCenter.x + Math.cos(a) * r,
        y: state.arenaCenter.y + Math.sin(a) * r,
      };
      const cd = Math.hypot(cand.x - chaser.pos.x, cand.y - chaser.pos.y);
      // heavy penalty for being on/near obstacles
      let obsPenalty = 0;
      for (const o of state.obstacles) {
        const od = Math.hypot(cand.x - o.pos.x, cand.y - o.pos.y);
        if (o.kind === 'tree' && od < (o.radius || 0) + 50) obsPenalty += 500;
        if (o.kind === 'wall' && od < Math.max(o.w || 50, o.h || 20) + 30) obsPenalty += 500;
      }
      const score = cd - obsPenalty;
      if (score > bestScore) {
        bestScore = score;
        best = cand;
      }
    }
    state.aiTarget = best;
    state.aiChangeTimer = 0.5 + Math.random() * 0.5;
  }
  // sometimes try to hide in a bush (only if not on cooldown)
  let hideTarget: Obstacle | null = null;
  let hideDist = Infinity;
  if (!runner.hidden && runner.hideCooldown <= 0 && runner.hideTimeLeft > 0.5) {
    for (const o of state.obstacles) {
      if (o.kind === 'bush') {
        const d = Math.hypot(runner.pos.x - o.pos.x, runner.pos.y - o.pos.y);
        const cd = Math.hypot(chaser.pos.x - o.pos.x, chaser.pos.y - o.pos.y);
        if (cd > 130 && d < hideDist && d < 100) {
          hideDist = d;
          hideTarget = o;
        }
      }
    }
  }
  if (hideTarget && Math.hypot(chaser.pos.x - runner.pos.x, chaser.pos.y - runner.pos.y) > 100) {
    // try to hide - move directly toward the bush
    const target = hideTarget.pos;
    let dx = target.x - runner.pos.x;
    let dy = target.y - runner.pos.y;
    const d = Math.hypot(dx, dy) || 1;
    dx /= d; dy /= d;
    runner.vel.x = dx * AI_MAX_SPEED;
    runner.vel.y = dy * AI_MAX_SPEED;
    runner.facing.x = dx; runner.facing.y = dy;
    runner.isMoving = true;
    if (d < 18) {
      runner.hidden = true;
      runner.hideTimer = 0.1;
    }
    return;
  } else if (runner.hidden) {
    // stay hidden, tick down hide time
    runner.hideTimeLeft -= dt;
    runner.hideTimer -= dt;
    if (runner.hideTimeLeft <= 0) {
      runner.hidden = false;
      runner.hideTimeLeft = 0;
      runner.hideCooldown = state.hideCooldownBase;
    }
    runner.vel.x *= 0.3; runner.vel.y *= 0.3;
    runner.isMoving = false;
    return;
  }

  // SAFE HIDE: if not hidden, try to go to nearest tree or wall to be "safe" for 5s
  if (!runner.safe && runner.safeCooldown <= 0 && runner.safeTimeLeft > 0.5 &&
      Math.hypot(chaser.pos.x - runner.pos.x, chaser.pos.y - runner.pos.y) < 150) {
    // find nearest tree or wall
    let bestCover: Vec2 | null = null;
    let bestDist = Infinity;
    for (const o of state.obstacles) {
      if (o.kind === 'bush') continue;
      const coverDist = Math.hypot(o.pos.x - runner.pos.x, o.pos.y - runner.pos.y);
      // only consider obstacles that are between us and chaser (on chaser side)
      if (coverDist < bestDist && coverDist < 130) {
        // prefer cover that's also on the chaser's side (between us)
        const distToChaser = Math.hypot(o.pos.x - chaser.pos.x, o.pos.y - chaser.pos.y);
        const distRunnerToChaser = Math.hypot(chaser.pos.x - runner.pos.x, chaser.pos.y - runner.pos.y);
        // only count if obstacle is between us (closer to chaser than us)
        if (distToChaser < distRunnerToChaser + 10) {
          bestDist = coverDist;
          bestCover = o.pos;
        }
      }
    }
    if (bestCover) {
      const dx = bestCover.x - runner.pos.x;
      const dy = bestCover.y - runner.pos.y;
      const d = Math.hypot(dx, dy) || 1;
      runner.vel.x = (dx / d) * AI_MAX_SPEED;
      runner.vel.y = (dy / d) * AI_MAX_SPEED;
      runner.facing.x = dx / d; runner.facing.y = dy / d;
      runner.isMoving = true;
      // when close enough to obstacle, become safe
      if (d < 22) {
        runner.safe = true;
        runner.safeTime = 0.1;
      }
      return;
    }
  } else if (runner.safe) {
    // stay safe, tick down
    runner.safeTimeLeft -= dt;
    runner.safeTime -= dt;
    // end safe if AI walks out of cover
    if (runner.safeTimeLeft <= 0 || !playerIsInsideCover(state, runner)) {
      runner.safe = false;
      runner.safeTimeLeft = 0;
      runner.safeCooldown = state.hideCooldownBase;
    }
    runner.vel.x *= 0.3; runner.vel.y *= 0.3;
    runner.isMoving = false;
    return;
  }

  // pick movement direction: blend target + flee from chaser
  const dir = aiPathToward(state, runner.pos, state.aiTarget);
  // add flee from chaser
  const cdx = runner.pos.x - chaser.pos.x;
  const cdy = runner.pos.y - chaser.pos.y;
  const cd = Math.hypot(cdx, cdy) || 1;
  const fleeWeight = Math.max(0, 1 - cd / 220);
  let mx = dir.x * (1 - fleeWeight * 0.7) + (cdx / cd) * fleeWeight;
  let my = dir.y * (1 - fleeWeight * 0.7) + (cdy / cd) * fleeWeight;
  // sidestep when chaser is close
  if (cd < 100) {
    const side = Math.random() < 0.5 ? 1 : -1;
    mx += (-cdy / cd) * side * 0.5;
    my += (cdx / cd) * side * 0.5;
  }
  const m = Math.hypot(mx, my) || 1;
  const nx = mx / m;
  const ny = my / m;
  // SET velocity directly (not accumulate) so we always move
  runner.vel.x = nx * AI_MAX_SPEED;
  runner.vel.y = ny * AI_MAX_SPEED;
  runner.facing.x = nx;
  runner.facing.y = ny;
  runner.isMoving = true;
}

function aiChasePlayer(state: GameState, chaser: Player, runner: Player, dt: number) {
  // stuck detection: if chaser hasn't moved much recently, pick a new approach
  state.aiChangeTimer -= dt;
  const cSpeed = Math.hypot(chaser.vel.x, chaser.vel.y);
  if (cSpeed < 30) {
    state.aiStuckTimer = (state.aiStuckTimer || 0) + dt;
  } else {
    state.aiStuckTimer = 0;
  }
  // if stuck for too long, teleport to a better position
  if (state.aiStuckTimer > 0.8) {
    // teleport chaser to a position that is on the OTHER SIDE of the runner
    // (so we can attack from a different angle)
    const rdx = runner.pos.x - chaser.pos.x;
    const rdy = runner.pos.y - chaser.pos.y;
    const rd = Math.hypot(rdx, rdy) || 1;
    const targetDist = 80;
    chaser.pos.x = runner.pos.x - (rdx / rd) * targetDist;
    chaser.pos.y = runner.pos.y - (rdy / rd) * targetDist;
    chaser.vel.x = 0;
    chaser.vel.y = 0;
    state.aiStuckTimer = 0;
    state.aiChangeTimer = 0.5;
  }
  const dx = runner.pos.x - chaser.pos.x;
  const dy = runner.pos.y - chaser.pos.y;
  let d = Math.hypot(dx, dy) || 1;
  // if runner is hidden, head to last known position
  let target = runner.pos;
  if (runner.hidden) {
    // pick a nearby bush to investigate
    let best: Obstacle | null = null;
    let bestD = Infinity;
    for (const o of state.obstacles) {
      if (o.kind === 'bush') {
        const od = Math.hypot(chaser.pos.x - o.pos.x, chaser.pos.y - o.pos.y);
        if (od < bestD) {
          bestD = od;
          best = o;
        }
      }
    }
    if (best) target = best.pos;
  }
  const tdx = target.x - chaser.pos.x;
  const tdy = target.y - chaser.pos.y;
  d = Math.hypot(tdx, tdy) || 1;
  chaser.facing.x = tdx / d;
  chaser.facing.y = tdy / d;
  // Move using pathfinding
  let dir = aiPathToward(state, chaser.pos, target);
  const wob = Math.sin(performance.now() * 0.003) * 0.15;
  const wx = -dir.y * wob;
  const wy = dir.x * wob;
  // if stuck, try sidestepping around the obstacle
  const speedNow = Math.hypot(chaser.vel.x, chaser.vel.y);
  if (speedNow < 30) {
    state.aiChangeTimer = 0;
  }
  if (state.aiChangeTimer <= 0) {
    // pick a different target (offset) to break out
    const perpAngle = (Math.random() - 0.5) * 1.5;
    const ca = Math.cos(perpAngle);
    const sa = Math.sin(perpAngle);
    const rdx = dir.x * ca - dir.y * sa;
    const rdy = dir.x * sa + dir.y * ca;
    dir = { x: rdx, y: rdy };
    state.aiChangeTimer = 0.6;
  }
  const nx = dir.x + wx;
  const ny = dir.y + wy;
  const nm = Math.hypot(nx, ny) || 1;
  chaser.vel.x = (nx / nm) * AI_MAX_SPEED;
  chaser.vel.y = (ny / nm) * AI_MAX_SPEED;
  chaser.isMoving = true;
  // try slap when close
  const distToRunner = Math.hypot(runner.pos.x - chaser.pos.x, runner.pos.y - chaser.pos.y);
  if (state.aiWindup <= 0 && distToRunner < chaser.radius + runner.radius + 6 && chaser.slapAnim <= 0) {
    chaser.slapAnim = 0.001;
  }
}

// Integrate AI position from already-set velocity. Handles arena clamp + obstacle collision + anim timers.
function integratePlayer(state: GameState, p: Player, dt: number) {
  p.pos.x += p.vel.x * dt;
  p.pos.y += p.vel.y * dt;
  // clamp to arena
  clampToArena(state, p);
  // collide with obstacles
  for (const o of state.obstacles) {
    resolveObstacleCollision(state, p, o);
  }
  // anim timers
  if (p.slapAnim > 0) {
    p.slapAnim += dt * 3.5;
    if (p.slapAnim >= 1) p.slapAnim = 0;
  }
  if (p.hitFlash > 0) {
    p.hitFlash -= dt * 3;
    if (p.hitFlash < 0) p.hitFlash = 0;
  }
  spawnSlapTrail(state, p);
}

function updatePlayer(state: GameState, p: Player, input: Input | null, dt: number) {
  const speed = 280;
  if (input) {
    const m = Math.hypot(input.move.x, input.move.y);
    if (m > 0.1) {
      const nx = input.move.x / m;
      const ny = input.move.y / m;
      p.vel.x = nx * speed;
      p.vel.y = ny * speed;
      p.facing.x = nx;
      p.facing.y = ny;
      p.isMoving = true;
      p.bob += dt * 8;
      // exit hide if moving
      if (p.hidden) {
        p.hidden = false;
        p.hideTimer = 0;
      }
    } else {
      p.vel.x *= 0.6;
      p.vel.y *= 0.6;
      if (Math.hypot(p.vel.x, p.vel.y) < 5) {
        p.vel.x = 0; p.vel.y = 0;
        p.isMoving = false;
      }
    }
    // hide in bush when pressing H (need to be near a bush)
    // Allow slight movement so the player can walk into a bush while holding H
    // --- NEW TELEPORT HIDE LOGIC (Role Restricted) ---
    // Rule: ONLY the runner can hide. The slapper (isChaser) cannot.
    if (input.hide && !p.isChaser && p.hideCooldown <= 0 && p.safeCooldown <= 0) {
      const spots = state.obstacles.filter(o => o.kind === 'bush' || o.kind === 'tree' || o.kind === 'wall');
      if (spots.length > 0) {
        let filtered = spots;
        if (p.hidden || p.safe) {
          filtered = spots.filter(o => Math.hypot(o.pos.x - p.pos.x, o.pos.y - p.pos.y) > 40);
        }
        if (filtered.length === 0) filtered = spots;
        const target = filtered[Math.floor(Math.random() * filtered.length)];
        
        spawnHitParticles(state, { ...p.pos }, '#a78bfa');
        p.pos = { ...target.pos };
        p.vel = { x: 0, y: 0 };
        
        if (target.kind === 'bush') {
          p.hidden = true; p.safe = false;
        } else {
          p.safe = true; p.hidden = false;
        }
        
        p.hideTimeLeft = 5.0;
        p.safeTimeLeft = 5.0;
        p.hideCooldown = 0;
        p.safeCooldown = 0;
        spawnHitParticles(state, { ...p.pos }, '#22d3ee');
        input.hide = false; 
      }
    }

    // Tick down state
    if (p.hidden) {
      p.hideTimeLeft -= dt;
      if (p.hideTimeLeft <= 0) {
        p.hidden = false;
        p.hideCooldown = 10.0;
      }
    } else if (p.hideCooldown > 0) {
      p.hideCooldown -= dt;
    }

    if (p.safe) {
      p.safeTimeLeft -= dt;
      if (p.safeTimeLeft <= 0) {
        p.safe = false;
        p.safeCooldown = 10.0;
      }
    } else if (p.safeCooldown > 0) {
      p.safeCooldown -= dt;
    }
    if (input.action && p.slapAnim <= 0) {
      p.slapAnim = 0.001;
    }
  }
  p.pos.x += p.vel.x * dt;
  p.pos.y += p.vel.y * dt;
  // clamp to arena
  clampToArena(state, p);
  // collide with obstacles
  for (const o of state.obstacles) {
    resolveObstacleCollision(state, p, o);
  }
  if (p.slapAnim > 0) {
    p.slapAnim += dt * 3.5;
    if (p.slapAnim >= 1) p.slapAnim = 0;
  }
  if (p.hitFlash > 0) {
    p.hitFlash -= dt * 3;
    if (p.hitFlash < 0) p.hitFlash = 0;
  }
  spawnSlapTrail(state, p);
}

// Check if a player is currently inside (overlapping) a tree or wall
function playerIsInsideCover(state: GameState, p: Player): boolean {
  for (const o of state.obstacles) {
    if (o.kind === 'bush') continue;
    if (o.kind === 'tree') {
      const d = Math.hypot(p.pos.x - o.pos.x, p.pos.y - o.pos.y);
      if (d < (o.radius || 20) + p.radius - 2) return true;
    } else if (o.kind === 'wall') {
      const cos = Math.cos(-(o.angle || 0));
      const sin = Math.sin(-(o.angle || 0));
      const lx = (p.pos.x - o.pos.x) * cos - (p.pos.y - o.pos.y) * sin;
      const ly = (p.pos.x - o.pos.x) * sin + (p.pos.y - o.pos.y) * cos;
      const halfW = (o.w || 0) / 2;
      const halfH = (o.h || 0) / 2;
      if (Math.abs(lx) < halfW + 2 && Math.abs(ly) < halfH + 2) return true;
    }
  }
  return false;
}

// Check if a line from `from` to `to` is blocked by any obstacle (tree or wall)
function isLineBlockedByObstacles(state: GameState, from: Vec2, to: Vec2): boolean {
  for (const o of state.obstacles) {
    if (o.kind === 'bush') continue;
    if (o.kind === 'tree') {
      // project tree center onto segment
      const px = to.x - from.x;
      const py = to.y - from.y;
      const fx = o.pos.x - from.x;
      const fy = o.pos.y - from.y;
      const len2 = px * px + py * py;
      if (len2 === 0) continue;
      const t = Math.max(0, Math.min(1, (fx * px + fy * py) / len2));
      const cx = from.x + px * t;
      const cy = from.y + py * t;
      const distToLine = Math.hypot(cx - o.pos.x, cy - o.pos.y);
      if (distToLine < (o.radius || 0)) return true;
    } else if (o.kind === 'wall') {
      // treat wall as line segment
      const cos = Math.cos(o.angle || 0);
      const sin = Math.sin(o.angle || 0);
      const halfW = (o.w || 0) / 2;
      const halfH = (o.h || 0) / 2;
      // wall corners in world space
      const corners = [
        { x: o.pos.x + (-halfW) * cos - (-halfH) * sin, y: o.pos.y + (-halfW) * sin + (-halfH) * cos },
        { x: o.pos.x + ( halfW) * cos - (-halfH) * sin, y: o.pos.y + ( halfW) * sin + (-halfH) * cos },
        { x: o.pos.x + ( halfW) * cos - ( halfH) * sin, y: o.pos.y + ( halfW) * sin + ( halfH) * cos },
        { x: o.pos.x + (-halfW) * cos - ( halfH) * sin, y: o.pos.y + (-halfW) * sin + ( halfH) * cos },
      ];
      // check if line from->to crosses any of the 4 edges of the wall
      const seg = [from, to];
      for (let i = 0; i < 4; i++) {
        const a = corners[i];
        const b = corners[(i + 1) % 4];
        if (segmentsIntersect(seg[0], seg[1], a, b)) return true;
      }
    }
  }
  return false;
}

// Check if two line segments intersect
function segmentsIntersect(p1: Vec2, p2: Vec2, p3: Vec2, p4: Vec2): boolean {
  const d1x = p2.x - p1.x;
  const d1y = p2.y - p1.y;
  const d2x = p4.x - p3.x;
  const d2y = p4.y - p3.y;
  const denom = d1x * d2y - d1y * d2x;
  if (Math.abs(denom) < 1e-9) return false; // parallel
  const t = ((p3.x - p1.x) * d2y - (p3.y - p1.y) * d2x) / denom;
  const u = ((p3.x - p1.x) * d1y - (p3.y - p1.y) * d1x) / denom;
  return t >= 0 && t <= 1 && u >= 0 && u <= 1;
}

function checkSlap(state: GameState, chaser: Player, runner: Player) {
  if (chaser.slapAnim < 0.4 || chaser.slapAnim > 0.65) return;
  if (state.hitCooldown > 0) return;
  if (runner.hidden) return; // can't slap a hidden player
    if (runner.safe) {
      addFloatText(state, { x: runner.pos.x, y: runner.pos.y - 20 }, '🛡️ BLOCKED', '#fbbf24');
      return; 
    }
    // LOS check: if any tree or wall is between chaser and runner, can't slap
    if (isLineBlockedByObstacles(state, chaser.pos, runner.pos)) {
    if (!state.floats.some(f => f.text === '🛡️')) {
      addFloatText(state, { x: chaser.pos.x, y: chaser.pos.y - 30 }, '🛡️', '#fbbf24');
    }
    return;
  }
  const d = dist(chaser.pos, runner.pos);
  const reach = chaser.radius + runner.radius + 14;
  if (d < reach) {
    state.hitCooldown = 0.25;
    runner.hitFlash = 1;
    chaser.slapAnim = 0.7;
    const chaserColor = chaser.character === 'girl' ? '#ec4899' : '#3b82f6';
    spawnHitParticles(state, { x: (chaser.pos.x + runner.pos.x) / 2, y: (chaser.pos.y + runner.pos.y) / 2 }, chaserColor);
    const dx = runner.pos.x - chaser.pos.x;
    const dy = runner.pos.y - chaser.pos.y;
    const dd = Math.hypot(dx, dy) || 1;
    runner.vel.x += (dx / dd) * 400;
    runner.vel.y += (dy / dd) * 400;
    chaser.vel.x -= (dx / dd) * 100;
    chaser.vel.y -= (dy / dd) * 100;
    state.shake = 12;
    state.shakeTime = 0.3;
    state.flashIntensity = 0.6;
    if (chaser.id === 'p1') {
      state.p1Score += 1;
      addFloatText(state, { x: runner.pos.x, y: runner.pos.y - 20 }, '+1', '#ec4899');
    } else {
      state.p2Score += 1;
      addFloatText(state, { x: runner.pos.x, y: runner.pos.y - 20 }, '+1', '#3b82f6');
    }
  }
}

export function step(state: GameState, dt: number) {
  if (dt > 0.05) dt = 0.05;

  if (state.input1.pause && !state.pauseToggleEdge) {
    state.pauseToggleEdge = true;
    if (state.phase === 'turn1' || state.phase === 'turn2') {
      state.prevPhase = state.phase;
      state.phase = 'paused';
    } else if (state.phase === 'paused') {
      state.phase = state.prevPhase;
    }
  }
  if (!state.input1.pause) state.pauseToggleEdge = false;

  if (state.shakeTime > 0) {
    state.shakeTime -= dt;
    if (state.shakeTime <= 0) state.shake = 0;
  }
  if (state.flashIntensity > 0) state.flashIntensity = Math.max(0, state.flashIntensity - dt * 2);
  if (state.hitCooldown > 0) state.hitCooldown -= dt;

  // particles
  for (let i = state.particles.length - 1; i >= 0; i--) {
    const p = state.particles[i];
    p.life -= dt;
    p.pos.x += p.vel.x * dt;
    p.pos.y += p.vel.y * dt;
    p.vel.x *= 0.95;
    p.vel.y *= 0.95;
    if (p.shape === 'leaf') {
      p.vel.y += 60 * dt; // gravity for leaves
    }
    if (p.life <= 0) state.particles.splice(i, 1);
  }
  for (let i = state.floats.length - 1; i >= 0; i--) {
    const f = state.floats[i];
    f.life -= dt;
    f.pos.y -= 30 * dt;
    if (f.life <= 0) state.floats.splice(i, 1);
  }
  // chat timer
  for (let i = state.chat.length - 1; i >= 0; i--) {
    state.chat[i].time -= dt;
    if (state.chat[i].time <= 0) state.chat.splice(i, 1);
  }

  if (state.phase === 'countdown') {
    state.countdown -= dt;
    if (state.countdown <= 0) {
      state.phase = state.currentTurn === 1 ? 'turn1' : 'turn2';
      state.timeLeft = state.turnTimeLimit;
    } else {
      // preview: chaser faces runner
      const chaser = state.currentTurn === 1 ? state.p1 : state.p2;
      const runner = state.currentTurn === 1 ? state.p2 : state.p1;
      const dx = runner.pos.x - chaser.pos.x;
      const dy = runner.pos.y - chaser.pos.y;
      const d = Math.hypot(dx, dy) || 1;
      chaser.facing.x = dx / d;
      chaser.facing.y = dy / d;
    }
    return;
  }

  if (state.phase === 'turn1' || state.phase === 'turn2') {
    if (state.aiWindup > 0) state.aiWindup -= dt;
    const chaser = state.currentTurn === 1 ? state.p1 : state.p2;
    const runner = state.currentTurn === 1 ? state.p2 : state.p1;

    // In online mode, the host is authoritative. Guest just sends input and receives state.
    if (state.mode === 'online' && !state.isOnlineHost) {
      return;
    }

    // determine AI for chaser
    // AI only plays in 'cpu' mode for P2.
    // In 'local' and 'online' modes, both players are human-controlled.
    const chaserIsAI = state.mode === 'cpu' && chaser.id === 'p2';
    const runnerIsAI = state.mode === 'cpu' && runner.id === 'p2';

    // Helper to merge hardware input with mobile button states
    const getCombinedInput = (playerId: 'p1' | 'p2'): Input => {
      const hw = playerId === 'p1' ? state.input1 : state.input2;
      const isP1 = playerId === 'p1';
      return {
        ...hw,
        action: hw.action || (isP1 ? state.mobileButtons.p1Attack : state.mobileButtons.p2Attack),
        hide: hw.hide || (isP1 ? state.mobileButtons.p1Hide : state.mobileButtons.p2Hide)
      };
    };

    // 1. CHASER UPDATE
    if (chaserIsAI) {
      aiChasePlayer(state, chaser, runner, dt);
      integratePlayer(state, chaser, dt);
    } else {
      const isLocalHuman = (state.mode === 'local') || (state.mode === 'online' && chaser.isLocal) || (state.mode === 'cpu' && chaser.id === 'p1');
      if (isLocalHuman) {
        updatePlayer(state, chaser, getCombinedInput(chaser.id), dt);
      } else if (state.mode !== 'online') {
        integratePlayer(state, chaser, dt);
      }
    }

    // 2. RUNNER UPDATE
    if (runnerIsAI) {
      aiRunFrom(state, runner, chaser, dt);
      integratePlayer(state, runner, dt);
    } else {
      const isLocalHuman = (state.mode === 'local') || (state.mode === 'online' && runner.isLocal) || (state.mode === 'cpu' && runner.id === 'p1');
      if (isLocalHuman) {
        updatePlayer(state, runner, getCombinedInput(runner.id), dt);
      } else if (state.mode !== 'online') {
        integratePlayer(state, runner, dt);
      }
    }
    checkSlap(state, chaser, runner);
    state.timeLeft -= dt;
    if (state.timeLeft <= 0) {
      state.timeLeft = 0;
      // Advance turn index. Both players get one turn to chase.
      state.turnIndex = (state.turnIndex || 0) + 1;
      if (state.turnIndex >= 2) {
        // game over after both players had their turn
        state.phase = 'result';
        const diff = state.p1Score - state.p2Score;
        state.turnResult = { winner: diff > 0 ? 'p1' : diff < 0 ? 'p2' : 'tie', diff };
        state.resultTimer = 0;
      } else {
        // swap chaser: the runner becomes the chaser
        if (state.currentTurn === 1) {
          state.currentTurn = 2;
          state.p1.isChaser = false;
          state.p2.isChaser = true;
        } else {
          state.currentTurn = 1;
          state.p1.isChaser = true;
          state.p2.isChaser = false;
        }
        state.phase = 'countdown';
        state.countdown = 1.6;
        state.aiWindup = 1.2;
        // determine the new chaser name
        const newChaser = state.currentTurn === 1 ? state.p1 : state.p2;
        addFloatText(state, { x: state.arenaCenter.x, y: state.arenaCenter.y }, state.mode === 'online' ? `${newChaser.name}'s TURN!` : `${newChaser.name.toUpperCase()}'S TURN!`, '#22d3ee');
      }
    }
    return;
  }

  if (state.phase === 'result') {
    state.resultTimer += dt;
    state.p1.bob += dt * 2;
    state.p2.bob += dt * 2;
    return;
  }
}

export function startGame(state: GameState) {
  state.p1Score = 0;
  state.p2Score = 0;
  state.p1.pos = { x: state.arenaCenter.x - 80, y: state.arenaCenter.y };
  state.p2.pos = { x: state.arenaCenter.x + 80, y: state.arenaCenter.y };
  state.p1.vel = { x: 0, y: 0 };
  state.p2.vel = { x: 0, y: 0 };
  state.p1.facing = { x: 1, y: 0 };
  state.p2.facing = { x: -1, y: 0 };
  state.p1.slapAnim = 0;
  state.p2.slapAnim = 0;
  state.p1.hitFlash = 0;
  state.p2.hitFlash = 0;
  state.p1.hidden = false;
  state.p2.hidden = false;
  state.p1.hideTimer = 0;
  state.p2.hideTimer = 0;
  state.p1.hideTimeLeft = 5;
  state.p2.hideTimeLeft = 5;
  state.p1.hideCooldown = 0;
  state.p2.hideCooldown = 0;
  state.p1.safe = false;
  state.p2.safe = false;
  state.p1.safeTime = 0;
  state.p2.safeTime = 0;
  state.p1.safeTimeLeft = 5;
  state.p2.safeTimeLeft = 5;
  state.p1.safeCooldown = 0;
  state.p2.safeCooldown = 0;
  state.p1.score = 0;
  state.p2.score = 0;
  // currentTurn represents WHO is currently chasing:
  //   currentTurn === 1 means p1 is chaser (p2 is runner)
  //   currentTurn === 2 means p2 is chaser (p1 is runner)
  if (state.mode === 'cpu' || state.mode === 'local') {
    // p2 (computer or P2) chases first
    state.p1.isChaser = false;
    state.p2.isChaser = true;
    state.currentTurn = 2;
  } else {
    // online: host is p1
    state.p1.isChaser = state.isOnlineHost;
    state.p2.isChaser = !state.isOnlineHost;
    state.currentTurn = state.isOnlineHost ? 1 : 2;
  }
  state.particles = [];
  state.floats = [];
  state.shake = 0;
  state.shakeTime = 0;
  state.flashIntensity = 0;
  state.hitCooldown = 0;
  state.timeLeft = state.turnTimeLimit;
  state.turnResult = null;
  state.aiChangeTimer = 0;
  state.countdown = 2.4;
  state.aiWindup = 1.2;
  state.turnIndex = 0;
  state.aiStuckTimer = 0;
  // Set adaptive hide cooldown based on turn duration
  state.hideCooldownBase = getHideCooldown(state.turnTimeLimit);
  // Refill rate: takes ~3s to fully refill a 5s hide time
  // Slightly faster for short games, slightly slower for long
  if (state.turnTimeLimit <= 10) state.hideRefillRate = 2.0;
  else if (state.turnTimeLimit <= 20) state.hideRefillRate = 1.7;
  else if (state.turnTimeLimit <= 30) state.hideRefillRate = 1.5;
  else if (state.turnTimeLimit <= 60) state.hideRefillRate = 1.3;
  else if (state.turnTimeLimit <= 300) state.hideRefillRate = 1.0;
  else state.hideRefillRate = 0.8;
  state.phase = 'countdown';
  addFloatText(state, { x: state.arenaCenter.x, y: state.arenaCenter.y - 60 }, 'GO!', '#fbbf24');
  for (let i = 0; i < 30; i++) {
    const a = Math.random() * Math.PI * 2;
    const sp = 100 + Math.random() * 200;
    const colors = ['#fbbf24', '#ec4899', '#3b82f6', '#22d3ee', '#a78bfa'];
    state.particles.push({
      pos: { ...state.arenaCenter },
      vel: { x: Math.cos(a) * sp, y: Math.sin(a) * sp },
      life: 0.7 + Math.random() * 0.5,
      maxLife: 1.2,
      color: colors[Math.floor(Math.random() * colors.length)],
      size: 3 + Math.random() * 3,
      shape: 'star',
      rotation: Math.random() * Math.PI * 2,
    });
  }
}

// ---------- Rendering ----------

function drawArena(ctx: CanvasRenderingContext2D, state: GameState, time: number) {
  const { arenaCenter, arenaRadius } = state;
  const grd = ctx.createRadialGradient(arenaCenter.x, arenaCenter.y, arenaRadius * 0.3, arenaCenter.x, arenaCenter.y, arenaRadius * 1.3);
  grd.addColorStop(0, 'rgba(99, 102, 241, 0.0)');
  grd.addColorStop(0.7, 'rgba(99, 102, 241, 0.05)');
  grd.addColorStop(1, 'rgba(99, 102, 241, 0.0)');
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, state.width, state.height);

  ctx.save();
  ctx.translate(arenaCenter.x, arenaCenter.y);
  const r = arenaRadius;
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  roundRect(ctx, -r - 4, -r - 4, (r + 4) * 2, (r + 4) * 2, 30);
  ctx.fill();
  const grd2 = ctx.createLinearGradient(0, -r, 0, r);
  grd2.addColorStop(0, '#1e1b4b');
  grd2.addColorStop(1, '#0f172a');
  ctx.fillStyle = grd2;
  roundRect(ctx, -r, -r, r * 2, r * 2, 30);
  ctx.fill();

  // grass texture: small light dots
  ctx.fillStyle = 'rgba(99, 102, 241, 0.12)';
  for (let i = 0; i < 80; i++) {
    const a = (i * 137) % 360;
    const rad = (i * 31) % 100 / 100;
    const x = Math.cos(a) * r * rad * 0.95;
    const y = Math.sin(a) * r * rad * 0.95;
    ctx.fillRect(x, y, 2, 2);
  }

  // grid
  ctx.strokeStyle = 'rgba(99, 102, 241, 0.10)';
  ctx.lineWidth = 1;
  const grid = 50;
  for (let x = -r; x <= r; x += grid) {
    ctx.beginPath();
    ctx.moveTo(x, -r);
    ctx.lineTo(x, r);
    ctx.stroke();
  }
  for (let y = -r; y <= r; y += grid) {
    ctx.beginPath();
    ctx.moveTo(-r, y);
    ctx.lineTo(r, y);
    ctx.stroke();
  }

  // center ring
  ctx.strokeStyle = 'rgba(244, 114, 182, 0.25)';
  ctx.lineWidth = 2;
  ctx.setLineDash([8, 8]);
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.25, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);

  // border
  ctx.strokeStyle = 'rgba(168, 85, 247, 0.7)';
  ctx.lineWidth = 4;
  roundRect(ctx, -r, -r, r * 2, r * 2, 30);
  ctx.stroke();
  const pulse = (Math.sin(time * 0.004) + 1) / 2;
  ctx.strokeStyle = `rgba(236, 72, 153, ${0.2 + pulse * 0.4})`;
  ctx.lineWidth = 2;
  roundRect(ctx, -r - 6, -r - 6, (r + 6) * 2, (r + 6) * 2, 34);
  ctx.stroke();
  ctx.restore();
}

function drawObstacles(ctx: CanvasRenderingContext2D, state: GameState) {
  for (const o of state.obstacles) {
    ctx.save();
    ctx.translate(o.pos.x, o.pos.y);
    if (o.kind === 'tree') {
      // shadow
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.beginPath();
      ctx.ellipse(2, o.radius! - 2, o.radius! * 0.9, o.radius! * 0.3, 0, 0, Math.PI * 2);
      ctx.fill();
      // trunk
      ctx.fillStyle = '#5b3a1f';
      ctx.beginPath();
      ctx.ellipse(0, 4, 6, 10, 0, 0, Math.PI * 2);
      ctx.fill();
      // canopy
      const colors = ['#16a34a', '#15803d', '#166534'];
      for (let i = 0; i < 3; i++) {
        ctx.fillStyle = colors[i];
        ctx.beginPath();
        const a = (i / 3) * Math.PI * 2;
        ctx.arc(Math.cos(a) * 4, Math.sin(a) * 4 - 4, o.radius! * 0.7, 0, Math.PI * 2);
        ctx.fill();
      }
      // highlight
      ctx.fillStyle = 'rgba(255,255,255,0.2)';
      ctx.beginPath();
      ctx.arc(-4, -8, o.radius! * 0.3, 0, Math.PI * 2);
      ctx.fill();
    } else if (o.kind === 'wall') {
      // shadow
      ctx.save();
      ctx.translate(2, 2);
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.rotate(o.angle || 0);
      ctx.fillRect(-(o.w! / 2), -(o.h! / 2), o.w!, o.h!);
      ctx.restore();
      // wall body
      ctx.rotate(o.angle || 0);
      const wg = ctx.createLinearGradient(0, -o.h! / 2, 0, o.h! / 2);
      wg.addColorStop(0, '#a78bfa');
      wg.addColorStop(1, '#7c3aed');
      ctx.fillStyle = wg;
      ctx.fillRect(-(o.w! / 2), -(o.h! / 2), o.w!, o.h!);
      // top highlight
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      ctx.fillRect(-(o.w! / 2), -(o.h! / 2), o.w!, 2);
      // bottom shadow
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.fillRect(-(o.w! / 2), o.h! / 2 - 2, o.w!, 2);
    } else if (o.kind === 'bush') {
      // shadow
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.beginPath();
      ctx.ellipse(1, 2, o.radius!, o.radius! * 0.4, 0, 0, Math.PI * 2);
      ctx.fill();
      // leaves
      const colors = ['#22c55e', '#16a34a', '#15803d'];
      for (let i = 0; i < 5; i++) {
        ctx.fillStyle = colors[i % 3];
        const a = (i / 5) * Math.PI * 2;
        ctx.beginPath();
        ctx.arc(Math.cos(a) * 6, Math.sin(a) * 4, o.radius! * 0.65, 0, Math.PI * 2);
        ctx.fill();
      }
      // center
      ctx.fillStyle = '#22c55e';
      ctx.beginPath();
      ctx.arc(0, 0, o.radius! * 0.5, 0, Math.PI * 2);
      ctx.fill();
      // sparkle
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      ctx.beginPath();
      ctx.arc(-4, -4, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawParticles(ctx: CanvasRenderingContext2D, state: GameState) {
  for (const p of state.particles) {
    const alpha = Math.max(0, p.life / p.maxLife);
    ctx.save();
    ctx.translate(p.pos.x, p.pos.y);
    ctx.globalAlpha = alpha;
    if (p.shape === 'ring') {
      const grow = (1 - alpha) * 60;
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, 10 + grow, 0, Math.PI * 2);
      ctx.stroke();
    } else if (p.shape === 'star') {
      ctx.fillStyle = p.color;
      ctx.rotate((p.rotation || 0) + (1 - alpha) * 4);
      const s = p.size;
      ctx.beginPath();
      for (let i = 0; i < 5; i++) {
        const a = (i * 2 * Math.PI) / 5 - Math.PI / 2;
        const x = Math.cos(a) * s;
        const y = Math.sin(a) * s;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        const a2 = a + Math.PI / 5;
        ctx.lineTo(Math.cos(a2) * s * 0.4, Math.sin(a2) * s * 0.4);
      }
      ctx.closePath();
      ctx.fill();
    } else if (p.shape === 'leaf') {
      ctx.fillStyle = p.color;
      ctx.rotate(p.rotation || 0);
      ctx.beginPath();
      ctx.ellipse(0, 0, p.size, p.size * 0.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.2)';
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(-p.size, 0);
      ctx.lineTo(p.size, 0);
      ctx.stroke();
    } else if (p.shape === 'spark') {
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(0, 0, p.size * alpha, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(0, 0, p.size * alpha, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}

function drawFloats(ctx: CanvasRenderingContext2D, state: GameState) {
  for (const f of state.floats) {
    const alpha = Math.max(0, f.life / f.maxLife);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.font = 'bold 32px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = f.color;
    ctx.strokeStyle = 'rgba(0,0,0,0.6)';
    ctx.lineWidth = 4;
    ctx.strokeText(f.text, f.pos.x, f.pos.y);
    ctx.fillText(f.text, f.pos.x, f.pos.y);
    ctx.restore();
  }
}

function drawChaserLabel(ctx: CanvasRenderingContext2D, state: GameState, time: number) {
  const chaser = state.currentTurn === 1 ? state.p1 : state.p2;
  const isGirl = chaser.character === 'girl';
  ctx.save();
  ctx.font = 'bold 12px Inter, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = isGirl ? '#ec4899' : '#3b82f6';
  ctx.strokeStyle = 'rgba(0,0,0,0.6)';
  ctx.lineWidth = 3;
  const labelY = chaser.pos.y - chaser.radius - 18 + Math.sin(time * 0.01) * 1;
  ctx.strokeText('😤 SLAPPER', chaser.pos.x, labelY);
  ctx.fillText('😤 SLAPPER', chaser.pos.x, labelY);
  if (chaser.slapAnim > 0.3 && chaser.slapAnim < 0.6) {
    const target = chaser.id === 'p1' ? state.p2 : state.p1;
    const dx = target.pos.x - chaser.pos.x;
    const dy = target.pos.y - chaser.pos.y;
    const d = Math.hypot(dx, dy) || 1;
    const ax = chaser.pos.x + (dx / d) * (chaser.radius + 16);
    const ay = chaser.pos.y + (dy / d) * (chaser.radius + 16);
    ctx.fillStyle = isGirl ? '#ec4899' : '#3b82f6';
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(ax - (dx / d) * 8 + (-dy / d) * 5, ay - (dy / d) * 8 + (dx / d) * 5);
    ctx.lineTo(ax - (dx / d) * 8 - (-dy / d) * 5, ay - (dy / d) * 8 - (dx / d) * 5);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

function drawPlayers(ctx: CanvasRenderingContext2D, state: GameState, time: number) {
  // draw both players
  for (const p of [state.p1, state.p2]) {
    if (p.hidden) {
      // render as a small leafy blob in the bush
      ctx.save();
      ctx.translate(p.pos.x, p.pos.y);
      ctx.globalAlpha = 0.4;
      ctx.fillStyle = '#16a34a';
      ctx.beginPath();
      ctx.arc(0, 0, p.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#22c55e';
      ctx.beginPath();
      ctx.arc(-4, -4, p.radius * 0.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      continue;
    }
    // draw normal character
    if (p.character === 'boy') {
      drawBoy(ctx, p, time, p.isLocal);
    } else {
      drawGirl(ctx, p, time, p.isLocal);
    }
    // safe state overlay - shield effect
    if (p.safe) {
      ctx.save();
      ctx.translate(p.pos.x, p.pos.y);
      // shield bubble
      ctx.strokeStyle = `rgba(34, 197, 94, ${0.5 + Math.sin(time * 0.01) * 0.2})`;
      ctx.lineWidth = 3;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.arc(0, 0, p.radius + 6, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      // shield icon
      ctx.fillStyle = '#22c55e';
      ctx.font = 'bold 12px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('🛡️', 0, -p.radius - 8);
      ctx.restore();
    }
  }
}

function drawHideHints(ctx: CanvasRenderingContext2D, state: GameState) {
  // BUSH hints
  for (const o of state.obstacles) {
    if (o.kind !== 'bush') continue;
    for (const p of [state.p1, state.p2]) {
      if (p.hidden) continue;
      if (p.hideCooldown > 0 || p.hideTimeLeft <= 0) continue;
      const d = Math.hypot(p.pos.x - o.pos.x, p.pos.y - o.pos.y);
      if (d < (o.radius || 0) + 25) {
        ctx.save();
        ctx.globalAlpha = 0.5 + Math.sin(performance.now() * 0.005) * 0.3;
        ctx.fillStyle = '#22c55e';
        ctx.font = 'bold 9px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('HIDE [H]', o.pos.x, o.pos.y - (o.radius || 0) - 6);
        ctx.restore();
      }
    }
  }
  // COVER hints: trees and walls
  for (const o of state.obstacles) {
    if (o.kind === 'bush') continue;
    for (const p of [state.p1, state.p2]) {
      if (p.hidden || p.safe) continue;
      if (p.safeCooldown > 0 || p.safeTimeLeft <= 0) continue;
      // check if player is overlapping this obstacle
      let near = false;
      if (o.kind === 'tree') {
        const d = Math.hypot(p.pos.x - o.pos.x, p.pos.y - o.pos.y);
        if (d < (o.radius || 20) + p.radius - 2) near = true;
      } else if (o.kind === 'wall') {
        const cos = Math.cos(-(o.angle || 0));
        const sin = Math.sin(-(o.angle || 0));
        const lx = (p.pos.x - o.pos.x) * cos - (p.pos.y - o.pos.y) * sin;
        const ly = (p.pos.x - o.pos.x) * sin + (p.pos.y - o.pos.y) * cos;
        const halfW = (o.w || 0) / 2;
        const halfH = (o.h || 0) / 2;
        if (Math.abs(lx) < halfW + 2 && Math.abs(ly) < halfH + 2) near = true;
      }
      if (near) {
        ctx.save();
        ctx.globalAlpha = 0.5 + Math.sin(performance.now() * 0.005) * 0.3;
        ctx.fillStyle = '#22c55e';
        ctx.font = 'bold 9px Inter, sans-serif';
        ctx.textAlign = 'center';
        const labelY = p.pos.y - p.radius - 14;
        ctx.fillText('TAKE COVER [H]', p.pos.x, labelY);
        ctx.restore();
      }
    }
  }
}

function drawHideStatus(ctx: CanvasRenderingContext2D, state: GameState) {
  // Draw small status bar above each player showing hide state
  for (const p of [state.p1, state.p2]) {
    if (p.hidden) {
      // show countdown bar (BUSH)
      const w = 44;
      const h = 5;
      const x = p.pos.x - w / 2;
      const y = p.pos.y + p.radius + 10;
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
      ctx.fillStyle = '#22c55e';
      ctx.fillRect(x, y, w * (p.hideTimeLeft / 5), h);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 8px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('🫥 BUSH', p.pos.x, y + h + 8);
    } else if (p.safe) {
      // show countdown bar (COVER)
      const w = 44;
      const h = 5;
      const x = p.pos.x - w / 2;
      const y = p.pos.y + p.radius + 10;
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
      ctx.fillStyle = '#22c55e';
      ctx.fillRect(x, y, w * (p.safeTimeLeft / 5), h);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 8px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('🛡️ COVER', p.pos.x, y + h + 8);
    } else if (p.hideCooldown > 0 || p.safeCooldown > 0) {
      // show cooldown (max of both), scaled by game-specific base
      const cd = Math.max(p.hideCooldown, p.safeCooldown);
      const cdMax = state.hideCooldownBase;
      const w = 44;
      const h = 4;
      const x = p.pos.x - w / 2;
      const y = p.pos.y + p.radius + 10;
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(x, y, w * (cd / cdMax), h);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 8px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`CD ${cd.toFixed(1)}s`, p.pos.x, y + h + 8);
    } else if (p.hideTimeLeft < 5 || p.safeTimeLeft < 5) {
      // show partial fill
      const w = 44;
      const h = 4;
      const x = p.pos.x - w / 2;
      const y = p.pos.y + p.radius + 10;
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
      ctx.fillStyle = '#fbbf24';
      const fill = Math.max(p.hideTimeLeft, p.safeTimeLeft) / 5;
      ctx.fillRect(x, y, w * fill, h);
    }
  }
}

export function render(ctx: CanvasRenderingContext2D, state: GameState, time: number) {
  ctx.fillStyle = '#020617';
  ctx.fillRect(0, 0, state.width, state.height);

  ctx.save();
  if (state.shake > 0) {
    const sx = (Math.random() - 0.5) * state.shake;
    const sy = (Math.random() - 0.5) * state.shake;
    ctx.translate(sx, sy);
  }

  drawArena(ctx, state, time);
  drawObstacles(ctx, state);
  drawParticles(ctx, state);
  drawPlayers(ctx, state, time);
  drawHideHints(ctx, state);
  drawHideStatus(ctx, state);
  drawFloats(ctx, state);

  if (state.phase === 'turn1' || state.phase === 'turn2') {
    drawChaserLabel(ctx, state, time);
  }

  if (state.flashIntensity > 0) {
    ctx.fillStyle = `rgba(244, 63, 94, ${state.flashIntensity * 0.3})`;
    ctx.fillRect(0, 0, state.width, state.height);
  }

  ctx.restore();
}
