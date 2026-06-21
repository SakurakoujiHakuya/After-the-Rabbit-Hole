import { firstLevelId, levelById, levels } from './levels.js';

const STORAGE_KEY = 'after-the-rabbit-hole:progress:v3';
const LEGACY_STORAGE_KEY = 'after-the-rabbit-hole:progress:v2';

function createInitialProgress() {
  return {
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
}

export const initialProgress = createInitialProgress();

function validArray(value) {
  return Array.isArray(value) ? value : [];
}

function validRecord(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function knownLevelEntries(value) {
  return Object.entries(validRecord(value)).filter(([levelId]) => levelById[levelId]);
}

function sanitizeCompleted(value) {
  const cleaned = {};
  for (const [levelId, completed] of knownLevelEntries(value)) {
    if (completed === true) cleaned[levelId] = true;
  }
  return cleaned;
}

function sanitizeChoices(value) {
  const cleaned = {};
  for (const [levelId, choiceId] of knownLevelEntries(value)) {
    const level = levelById[levelId];
    if (level.choices?.some((choice) => choice.id === choiceId)) {
      cleaned[levelId] = choiceId;
    }
  }
  return cleaned;
}

function sanitizeBestTimes(value) {
  const cleaned = {};
  for (const [levelId, time] of knownLevelEntries(value)) {
    if (Number.isFinite(time) && time >= 0) cleaned[levelId] = time;
  }
  return cleaned;
}

function sanitizeDeaths(value) {
  const cleaned = {};
  for (const [levelId, deaths] of knownLevelEntries(value)) {
    if (Number.isFinite(deaths) && deaths >= 0) {
      cleaned[levelId] = Math.floor(deaths);
    }
  }
  return cleaned;
}

function sanitizeGrades(value) {
  const cleaned = {};
  for (const [levelId, grade] of knownLevelEntries(value)) {
    if (Number.isFinite(grade) && grade >= 1 && grade <= 3) {
      cleaned[levelId] = Math.floor(grade);
    }
  }
  return cleaned;
}

function getLevelCuriosityIds(level) {
  return new Set((level?.items || [])
    .filter((item) => item.type === 'curiosity')
    .map((item) => item.id));
}

function sanitizeCuriosities(value) {
  const cleaned = {};
  for (const [levelId, ids] of Object.entries(validRecord(value))) {
    const validIds = getLevelCuriosityIds(levelById[levelId]);
    const curiosityIds = [
      ...new Set(validArray(ids).filter((id) => validIds.has(id))),
    ];
    if (curiosityIds.length > 0) cleaned[levelId] = curiosityIds;
  }
  return cleaned;
}

function sanitizeProgress(value) {
  if (!value || ![2, 3].includes(value.version)) return createInitialProgress();
  const completed = sanitizeCompleted(value.completed);
  const choices = sanitizeChoices(value.choices);
  const bestTimes = sanitizeBestTimes(value.bestTimes);
  const deaths = sanitizeDeaths(value.deaths);
  const grades = sanitizeGrades(value.grades);
  const curiosities = sanitizeCuriosities(value.curiosities);
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
      ...validArray(value.unlocked).filter((id) => levelById[id]),
      ...derivedUnlocks.filter((id) => levelById[id]),
    ]),
  ];
  return {
    ...createInitialProgress(),
    ...value,
    version: 3,
    currentLevelId: levelById[value.currentLevelId] ? value.currentLevelId : firstLevelId,
    unlocked: unlocked.length ? unlocked : [firstLevelId],
    completed,
    choices,
    bestTimes,
    deaths,
    grades,
    curiosities,
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
  return createInitialProgress();
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
  return createInitialProgress();
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
  const validIds = getLevelCuriosityIds(levelById[levelId]);
  if (!validIds.has(curiosityId)) return saveProgress(progress);
  const collected = new Set(
    (progress.curiosities[levelId] || []).filter((id) => validIds.has(id)),
  );
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
  const validIds = getLevelCuriosityIds(level);
  const curiosityIds = [
    ...new Set([
      ...(progress.curiosities[level.id] || []),
      ...(attempt.curiosityIds || []),
    ].filter((id) => validIds.has(id))),
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

export function getBranchChoiceForLevel(levelId) {
  const targetLevel = levelById[levelId];
  if (!targetLevel?.branch) return null;
  for (const forkLevel of levels) {
    const choice = forkLevel.choices?.find((entry) => entry.next === levelId);
    if (choice) return { forkLevel, choice };
  }
  return null;
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

export function getRouteLevelIds(progress) {
  const choices = new Set(Object.values(progress.choices || {}));
  const completed = new Set(Object.keys(progress.completed || {}));
  return levels
    .filter((level) => (
      !level.branch ||
      choices.has(level.branch) ||
      completed.has(level.id)
    ))
    .map((level) => level.id);
}
