import { firstLevelId, levelById } from './levels.js';

const STORAGE_KEY = 'after-the-rabbit-hole:progress:v2';

export const initialProgress = {
  version: 2,
  currentLevelId: firstLevelId,
  unlocked: [firstLevelId],
  completed: {},
  choices: {},
  bestTimes: {},
  deaths: {},
};

function sanitizeProgress(value) {
  if (!value || value.version !== 2) return { ...initialProgress };
  const unlocked = [...new Set((value.unlocked || []).filter((id) => levelById[id]))];
  return {
    ...initialProgress,
    ...value,
    currentLevelId: levelById[value.currentLevelId] ? value.currentLevelId : firstLevelId,
    unlocked: unlocked.length ? unlocked : [firstLevelId],
    completed: value.completed || {},
    choices: value.choices || {},
    bestTimes: value.bestTimes || {},
    deaths: value.deaths || {},
  };
}

export function loadProgress() {
  try {
    return sanitizeProgress(JSON.parse(localStorage.getItem(STORAGE_KEY)));
  } catch {
    return { ...initialProgress };
  }
}

export function saveProgress(progress) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  } catch {
    // Storage can be unavailable in private or embedded browser contexts.
  }
  return progress;
}

export function clearProgress() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // The game can still restart in memory when storage is unavailable.
  }
  return { ...initialProgress };
}

export function completeLevel(progress, level, duration) {
  const previousBest = progress.bestTimes[level.id];
  const nextUnlocked = level.next || [];
  return saveProgress({
    ...progress,
    completed: { ...progress.completed, [level.id]: true },
    unlocked: [...new Set([...progress.unlocked, ...nextUnlocked])],
    bestTimes: {
      ...progress.bestTimes,
      [level.id]: previousBest ? Math.min(previousBest, duration) : duration,
    },
  });
}

export function chooseBranch(progress, level, choice) {
  return saveProgress({
    ...progress,
    currentLevelId: choice.next,
    choices: { ...progress.choices, [level.id]: choice.id },
    unlocked: [...new Set([...progress.unlocked, choice.next])],
  });
}

export function enterLevel(progress, levelId) {
  return saveProgress({
    ...progress,
    currentLevelId: levelId,
    unlocked: [...new Set([...progress.unlocked, levelId])],
  });
}

export function recordDeath(progress, levelId) {
  return saveProgress({
    ...progress,
    deaths: {
      ...progress.deaths,
      [levelId]: (progress.deaths[levelId] || 0) + 1,
    },
  });
}
