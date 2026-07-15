// Local high-score table
import type { ScoreEntry } from './types';

const KEY = 'slapdash_highscores_v1';
const MAX = 10;

export function loadScores(): ScoreEntry[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr.slice(0, MAX);
  } catch {
    return [];
  }
}

export function saveScores(scores: ScoreEntry[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(scores.slice(0, MAX)));
  } catch {
    // ignore
  }
}

export function addScore(entry: ScoreEntry): ScoreEntry[] {
  const scores = loadScores();
  scores.push(entry);
  scores.sort((a, b) => b.score - a.score);
  const top = scores.slice(0, MAX);
  saveScores(top);
  return top;
}

export function clearScores() {
  try { localStorage.removeItem(KEY); } catch {}
}
