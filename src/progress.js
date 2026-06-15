import { firstLevelId, levelById } from './levels.js';

const STORAGE_KEY = 'after-the-rabbit-hole:progress:v3';
const LEGACY_STORAGE_KEY = 'after-the-rabbit-hole:progress:v2';

export const initialProgress = {
  version: 3,
  currentLevelId: firstLevelId,
  unlocked: [firstLevelId],
  completed: {},
  choices: {},
  bestTimes: {},
  deaths: {},
  grades: {},
  curiosities: {},
};

function validRecord(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function sanitizeProgress(value) {
  if (!value || ![2, 3].includes(value.version)) return { ...initialProgress };
  const completed = validRecord(value.completed);
  const choices = validRecord(value.choices);
  const derivedUnlocks = Object.keys(completed).flatMap((id) => {
    const level = levelById[id];
    if (!level) return [];
    const choiceId = choices[id];
    const chosen = level.choices?.find((choice) => choice.id === choiceId);
    return chosen
      ? [chosen.next, ...(level.legacyNext || [])]
      : [...(level.next || []), ...(level.legacyNext || [])];
  });
  const unlocked = [
    ...new Set([
      ...(value.unlocked || []).filter((id) => levelById[id]),
      ...derivedUnlocks.filter((id) => levelById[id]),
    ]),
  ];
  return {
    ...initialProgress,
    ...value,
    version: 3,
    currentLevelId: levelById[value.currentLevelId] ? value.currentLevelId : firstLevelId,
    unlocked: unlocked.length ? unlocked : [firstLevelId],
    completed,
    choices,
    bestTimes: validRecord(value.bestTimes),
    deaths: validRecord(value.deaths),
    grades: validRecord(value.grades),
    curiosities: validRecord(value.curiosities),
  };
}

export function loadProgress() {
  try {
    const current = localStorage.getItem(STORAGE_KEY);
    if (current) return sanitizeProgress(JSON.parse(current));
    const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (legacy) return saveProgress(sanitizeProgress(JSON.parse(legacy)));
  } catch {
    // Fall through to an in-memory fresh save.
  }
  return { ...initialProgress };
}

export function saveProgress(progress) {
  const normalized = sanitizeProgress(progress);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
  } catch {
    // Storage can be unavailable in private or embedded browser contexts.
  }
  return normalized;
}

export function clearProgress() {
  try {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(LEGACY_STORAGE_KEY);
  } catch {
    // The game can still restart in memory when storage is unavailable.
  }
  return { ...initialProgress };
}

export function calculateLevelGrade(level, duration, deaths, foundCuriosity) {
  if (
    duration <= level.parTime &&
    deaths === 0 &&
    foundCuriosity
  ) return 3;
  if (duration <= level.parTime * 1.5 && deaths <= 2) return 2;
  return 1;
}

export function collectCuriosity(progress, levelId, curiosityId) {
  const collected = new Set(progress.curiosities[levelId] || []);
  collected.add(curiosityId);
  return saveProgress({
    ...progress,
    curiosities: {
      ...progress.curiosities,
      [levelId]: [...collected],
    },
  });
}

export function completeLevel(progress, level, duration, attempt = {}) {
  const previousBest = progress.bestTimes[level.id];
  const nextUnlocked = level.next || [];
  const curiosityIds = [
    ...new Set([
      ...(progress.curiosities[level.id] || []),
      ...(attempt.curiosityIds || []),
    ]),
  ];
  const grade = calculateLevelGrade(
    level,
    duration,
    attempt.deaths || 0,
    curiosityIds.length > 0,
  );
  return saveProgress({
    ...progress,
    completed: { ...progress.completed, [level.id]: true },
    unlocked: [...new Set([...progress.unlocked, ...nextUnlocked])],
    bestTimes: {
      ...progress.bestTimes,
      [level.id]: previousBest ? Math.min(previousBest, duration) : duration,
    },
    grades: {
      ...progress.grades,
      [level.id]: Math.max(progress.grades[level.id] || 0, grade),
    },
    curiosities: {
      ...progress.curiosities,
      [level.id]: curiosityIds,
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
