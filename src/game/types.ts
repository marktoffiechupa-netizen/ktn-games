// Game types
export type Vec2 = { x: number; y: number };

export type Obstacle = {
  id: number;
  // type: tree (circular), wall (rect), bush (small)
  kind: 'tree' | 'wall' | 'bush';
  pos: Vec2;
  // for circle
  radius?: number;
  // for rect
  w?: number;
  h?: number;
  // rotation for walls
  angle?: number;
  // visual variation
  variant: number;
};

export type Player = {
  id: 'p1' | 'p2';
  pos: Vec2;
  vel: Vec2;
  radius: number;
  // visual
  facing: Vec2;
  slapAnim: number;
  hitFlash: number;
  bob: number;
  isMoving: boolean;
  // character
  character: 'boy' | 'girl';
  // turn state
  isChaser: boolean;
  isHuman: boolean;
  // player-controlled (in online)
  isLocal: boolean;
  // stats
  score: number;
  name: string;
  // for hiding under bushes
  hidden: boolean;
  hideTimer: number;
  // max hide duration remaining (counts down only while hidden)
  hideTimeLeft: number;
  // cooldown before can hide again
  hideCooldown: number;
  // safe from slaps: true when hiding behind a tree/wall (LOS blocked from chaser)
  safe: boolean;
  // time remaining for safe status
  safeTime: number;
  // max safe time
  safeTimeLeft: number;
  // cooldown for safe
  safeCooldown: number;
};

export const HIDE_MAX_DURATION = 5.0; // seconds of hide time
export const HIDE_COOLDOWN_BASE = 10.0; // base cooldown in seconds

// Calculate the hide cooldown based on the round duration.
// Short games -> faster refill. Long games -> slightly slower.
// Tuned so:
  //  10s game -> 6.0s cooldown
  //  20s game -> 7.0s cooldown
  //  30s game -> 8.0s cooldown
  //  60s game -> 9.0s cooldown
  // 300s game -> 10.0s cooldown
  // 600s game -> 11.0s cooldown
export function getHideCooldown(turnDuration: number): number {
  if (turnDuration <= 10) return 6.0;
  if (turnDuration <= 20) return 7.0;
  if (turnDuration <= 30) return 8.0;
  if (turnDuration <= 60) return 9.0;
  if (turnDuration <= 300) return 10.0;
  return 11.0;
}

export type Particle = {
  pos: Vec2;
  vel: Vec2;
  life: number;
  maxLife: number;
  color: string;
  size: number;
  shape: 'star' | 'circle' | 'ring' | 'spark' | 'leaf';
  rotation?: number;
};

export type FloatingText = {
  pos: Vec2;
  text: string;
  color: string;
  life: number;
  maxLife: number;
};

export type GamePhase = 'menu' | 'countdown' | 'turn1' | 'turn2' | 'result' | 'paused' | 'modeSelect' | 'charSelect' | 'lobby' | 'connecting';

export type ScoreEntry = { name: string; score: number; date: string; mode: string };
