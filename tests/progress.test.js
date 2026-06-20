import test from 'node:test';
import assert from 'node:assert/strict';

const memory = new Map();
global.localStorage = {
  getItem: (key) => memory.get(key) ?? null,
  setItem: (key, value) => memory.set(key, value),
  removeItem: (key) => memory.delete(key),
};

const {
  calculateLevelGrade,
  chooseBranch,
  clearProgress,
  collectCuriosity,
  completeLevel,
  enterLevel,
  getBranchChoiceForLevel,
  getRouteLevelIds,
  initialProgress,
  loadProgress,
  recordDeath,
} = await import('../src/progress.js');
const { getLevel, getPlayableLevel } = await import('../src/levels.js');

test.beforeEach(() => {
  memory.clear();
});

test('persists the current level and unlocks it', () => {
  const next = enterLevel(initialProgress, 'hall-of-doors');
  assert.equal(loadProgress().currentLevelId, 'hall-of-doors');
  assert.ok(next.unlocked.includes('hall-of-doors'));
});

test('records completion and preserves the best time', () => {
  const level = getLevel('rabbit-fall');
  const collected = collectCuriosity(initialProgress, level.id, 'cameo-rabbit-fall');
  const first = completeLevel(collected, level, 4200, {
    deaths: 0,
    curiosityIds: ['cameo-rabbit-fall'],
  });
  const second = completeLevel(first, level, 6100);
  assert.equal(second.completed[level.id], true);
  assert.equal(second.bestTimes[level.id], 4200);
  assert.equal(second.grades[level.id], 3);
  assert.deepEqual(second.curiosities[level.id], ['cameo-rabbit-fall']);
  assert.ok(second.unlocked.includes('hall-of-doors'));
});

test('stores branch choice, deaths, and reset state', () => {
  const crossroad = getLevel('caterpillar-crossroad');
  const chosen = chooseBranch(initialProgress, crossroad, crossroad.choices[0]);
  const fallen = recordDeath(chosen, chosen.currentLevelId);
  assert.equal(loadProgress().choices[crossroad.id], crossroad.choices[0].id);
  assert.equal(fallen.deaths[chosen.currentLevelId], 1);
  assert.deepEqual(clearProgress(), initialProgress);
});

test('stores independent choices at multiple story forks', () => {
  const earlyFork = getLevel('caterpillar-crossroad');
  const lateFork = getLevel('queen-garden');
  const early = chooseBranch(initialProgress, earlyFork, earlyFork.choices[1]);
  const late = chooseBranch(early, lateFork, lateFork.choices[1]);
  assert.equal(late.choices[earlyFork.id], 'tea');
  assert.equal(late.choices[lateFork.id], 'croquet');
  assert.ok(late.unlocked.includes('mad-tea-party'));
  assert.ok(late.unlocked.includes('queen-croquet'));
});

test('maps branch chapter selection back to its fork choice', () => {
  const teaSelection = getBranchChoiceForLevel('mad-tea-party');
  assert.equal(teaSelection.forkLevel.id, 'caterpillar-crossroad');
  assert.equal(teaSelection.choice.id, 'tea');

  const croquetSelection = getBranchChoiceForLevel('queen-croquet');
  assert.equal(croquetSelection.forkLevel.id, 'queen-garden');
  assert.equal(croquetSelection.choice.id, 'croquet');
  assert.equal(getBranchChoiceForLevel('dormouse-teapot'), null);

  const teaProgress = chooseBranch(
    initialProgress,
    teaSelection.forkLevel,
    teaSelection.choice,
  );
  const kitchen = getPlayableLevel('duchess-kitchen', teaProgress.choices);
  assert.ok(kitchen.items.some((item) => item.id === 'kitchen-watch-gift'));
  assert.equal(kitchen.items.some((item) => item.id === 'kitchen-mushroom-gift'), false);
});

test('counts the current story route instead of every branch map', () => {
  const earlyFork = getLevel('caterpillar-crossroad');
  const lateFork = getLevel('queen-garden');
  const early = chooseBranch(initialProgress, earlyFork, earlyFork.choices[1]);
  const late = chooseBranch(early, lateFork, lateFork.choices[1]);
  const routeIds = getRouteLevelIds(late);
  assert.equal(routeIds.length, 16);
  assert.ok(routeIds.includes('white-rabbit-watch'));
  assert.ok(routeIds.includes('dormouse-teapot'));
  assert.ok(routeIds.includes('cheshire-shadow'));
  assert.ok(routeIds.includes('mad-tea-party'));
  assert.ok(routeIds.includes('queen-croquet'));
  assert.equal(routeIds.includes('mushroom-forest'), false);
  assert.equal(routeIds.includes('looking-glass'), false);

  const withBonusBranch = {
    ...late,
    completed: { ...late.completed, 'looking-glass': true },
  };
  assert.equal(getRouteLevelIds(withBonusBranch).includes('looking-glass'), true);
});

test('grades attempts using time, mistakes, and hidden curiosity', () => {
  const level = getLevel('rabbit-fall');
  assert.equal(calculateLevelGrade(level, level.parTime, 0, true), 3);
  assert.equal(calculateLevelGrade(level, level.parTime, 1, true), 2);
  assert.equal(calculateLevelGrade(level, level.parTime * 2, 0, true), 1);
});

test('migrates a version 2 save without losing chapter progress', () => {
  memory.set('after-the-rabbit-hole:progress:v2', JSON.stringify({
    version: 2,
    currentLevelId: 'pool-of-tears',
    unlocked: ['rabbit-fall', 'hall-of-doors', 'pool-of-tears'],
    completed: { 'rabbit-fall': true, 'hall-of-doors': true },
    choices: {},
    bestTimes: { 'rabbit-fall': 12000 },
    deaths: {},
  }));
  const migrated = loadProgress();
  assert.equal(migrated.version, 3);
  assert.equal(migrated.currentLevelId, 'pool-of-tears');
  assert.equal(migrated.completed['hall-of-doors'], true);
  assert.deepEqual(migrated.grades, {});
});

test('unlocks newly inserted chapters from completed legacy predecessors', () => {
  memory.set('after-the-rabbit-hole:progress:v3', JSON.stringify({
    version: 3,
    currentLevelId: 'trial-of-names',
    unlocked: ['rabbit-fall', 'hall-of-doors', 'mushroom-forest', 'looking-glass', 'trial-of-names'],
    completed: {
      'hall-of-doors': true,
      'mushroom-forest': true,
      'looking-glass': true,
    },
    choices: {
      'caterpillar-crossroad': 'mushroom',
      'queen-garden': 'mirror',
    },
  }));
  const migrated = loadProgress();
  assert.ok(migrated.unlocked.includes('white-rabbit-house'));
  assert.ok(migrated.unlocked.includes('duchess-kitchen'));
  assert.ok(migrated.unlocked.includes('cheshire-wood'));
  assert.ok(migrated.unlocked.includes('card-procession'));
});
