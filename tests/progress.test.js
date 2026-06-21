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
  getValidCuriosityIds,
  hasFoundCuriosity,
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

test('stores only declared curiosities and ignores spoofed cameo ids', () => {
  const level = getLevel('rabbit-fall');
  assert.deepEqual(
    getValidCuriosityIds(level, ['cameo-fake', 'cameo-rabbit-fall', 'cameo-rabbit-fall']),
    ['cameo-rabbit-fall'],
  );
  assert.equal(hasFoundCuriosity(initialProgress, level, ['cameo-fake']), false);
  assert.equal(hasFoundCuriosity({
    ...initialProgress,
    curiosities: { [level.id]: ['cameo-rabbit-fall'] },
  }, level), true);

  const invalidCollect = collectCuriosity(initialProgress, level.id, 'cameo-fake');
  assert.deepEqual(invalidCollect.curiosities, {});

  const fakeOnly = completeLevel(initialProgress, level, level.parTime, {
    deaths: 0,
    curiosityIds: ['cameo-fake'],
  });
  assert.equal(fakeOnly.grades[level.id], 2);
  assert.equal(fakeOnly.curiosities[level.id], undefined);

  const mixed = completeLevel({
    ...initialProgress,
    curiosities: {
      [level.id]: ['cameo-fake', 'cameo-rabbit-fall', 'cameo-rabbit-fall'],
      'missing-level': ['cameo-ghost'],
    },
  }, level, level.parTime, {
    deaths: 0,
    curiosityIds: ['cameo-fake'],
  });
  assert.equal(mixed.grades[level.id], 3);
  assert.deepEqual(mixed.curiosities[level.id], ['cameo-rabbit-fall']);
  assert.equal(mixed.curiosities['missing-level'], undefined);
});

test('stores branch choice, deaths, and reset state', () => {
  const crossroad = getLevel('caterpillar-crossroad');
  const chosen = chooseBranch(initialProgress, crossroad, crossroad.choices[0]);
  const fallen = recordDeath(chosen, chosen.currentLevelId);
  assert.equal(loadProgress().choices[crossroad.id], crossroad.choices[0].id);
  assert.equal(fallen.deaths[chosen.currentLevelId], 1);
  assert.deepEqual(clearProgress(), initialProgress);
});

test('returns isolated fresh progress objects after load and clear', () => {
  const loaded = loadProgress();
  loaded.unlocked.push('hall-of-doors');
  loaded.completed['rabbit-fall'] = true;
  loaded.curiosities['rabbit-fall'] = ['cameo-rabbit-fall'];

  const reloaded = loadProgress();
  assert.deepEqual(reloaded, initialProgress);
  assert.deepEqual(initialProgress.unlocked, ['rabbit-fall']);
  assert.deepEqual(initialProgress.completed, {});
  assert.deepEqual(initialProgress.curiosities, {});

  const cleared = clearProgress();
  cleared.unlocked.push('hall-of-doors');
  cleared.deaths['rabbit-fall'] = 1;
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
  assert.equal(routeIds.length, 20);
  assert.ok(routeIds.includes('no-number-corridor'));
  assert.ok(routeIds.includes('backward-bank'));
  assert.ok(routeIds.includes('white-rabbit-watch'));
  assert.ok(routeIds.includes('dormouse-teapot'));
  assert.ok(routeIds.includes('eraser-map'));
  assert.ok(routeIds.includes('cheshire-shadow'));
  assert.ok(routeIds.includes('mad-tea-party'));
  assert.ok(routeIds.includes('queen-croquet'));
  assert.ok(routeIds.includes('leaking-rules'));
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

test('recovers unlocks from completed chapters when a save has malformed fields', () => {
  memory.set('after-the-rabbit-hole:progress:v3', JSON.stringify({
    version: 3,
    currentLevelId: 'pool-of-tears',
    unlocked: 'rabbit-fall',
    completed: {
      'rabbit-fall': true,
      'hall-of-doors': true,
    },
    choices: null,
    bestTimes: [],
    deaths: 'none',
    grades: null,
    curiosities: {
      'rabbit-fall': ['cameo-rabbit-fall', 'cameo-fake', 'cameo-rabbit-fall'],
      'missing-level': ['cameo-ghost'],
    },
  }));
  const recovered = loadProgress();
  assert.equal(recovered.currentLevelId, 'pool-of-tears');
  assert.deepEqual(recovered.completed, {
    'rabbit-fall': true,
    'hall-of-doors': true,
  });
  assert.ok(recovered.unlocked.includes('hall-of-doors'));
  assert.ok(recovered.unlocked.includes('no-number-corridor'));
  assert.deepEqual(recovered.bestTimes, {});
  assert.deepEqual(recovered.deaths, {});
  assert.deepEqual(recovered.curiosities, {
    'rabbit-fall': ['cameo-rabbit-fall'],
  });
});

test('cleans malformed progress stats and branch choices', () => {
  memory.set('after-the-rabbit-hole:progress:v3', JSON.stringify({
    version: 3,
    currentLevelId: 'not-a-level',
    unlocked: ['rabbit-fall', 'not-a-level'],
    completed: {
      'rabbit-fall': true,
      'hall-of-doors': 'yes',
      'not-a-level': true,
    },
    choices: {
      'caterpillar-crossroad': 'tea',
      'queen-garden': 'not-a-choice',
      'rabbit-fall': 'tea',
      'not-a-level': 'tea',
    },
    bestTimes: {
      'rabbit-fall': 30000,
      'hall-of-doors': -1,
      'pool-of-tears': 'fast',
      'not-a-level': 12000,
    },
    deaths: {
      'rabbit-fall': 2.8,
      'hall-of-doors': -1,
      'pool-of-tears': '3',
      'not-a-level': 1,
    },
    grades: {
      'rabbit-fall': 3,
      'hall-of-doors': 4,
      'pool-of-tears': 0,
      'no-number-corridor': 2.9,
      'not-a-level': 3,
    },
  }));
  const cleaned = loadProgress();
  assert.equal(cleaned.currentLevelId, 'rabbit-fall');
  assert.deepEqual(cleaned.completed, { 'rabbit-fall': true });
  assert.deepEqual(cleaned.choices, { 'caterpillar-crossroad': 'tea' });
  assert.deepEqual(cleaned.bestTimes, { 'rabbit-fall': 30000 });
  assert.deepEqual(cleaned.deaths, { 'rabbit-fall': 2 });
  assert.deepEqual(cleaned.grades, {
    'rabbit-fall': 3,
    'no-number-corridor': 2,
  });
  assert.deepEqual(cleaned.unlocked, ['rabbit-fall', 'hall-of-doors']);
});

test('restores first, completed, and successor chapters to unlocked saves', () => {
  memory.set('after-the-rabbit-hole:progress:v3', JSON.stringify({
    version: 3,
    currentLevelId: 'hall-of-doors',
    unlocked: ['not-a-level'],
    completed: {
      'hall-of-doors': true,
    },
  }));
  const recovered = loadProgress();
  assert.deepEqual(recovered.unlocked, [
    'rabbit-fall',
    'hall-of-doors',
    'no-number-corridor',
    'white-rabbit-house',
  ]);
});

test('unlocks newly inserted chapters from completed legacy predecessors', () => {
  memory.set('after-the-rabbit-hole:progress:v3', JSON.stringify({
    version: 3,
    currentLevelId: 'trial-of-names',
    unlocked: ['rabbit-fall', 'hall-of-doors', 'mushroom-forest', 'looking-glass', 'trial-of-names'],
    completed: {
      'hall-of-doors': true,
      'pool-of-tears': true,
      'mushroom-forest': true,
      'dormouse-teapot': true,
      'looking-glass': true,
      'card-procession': true,
    },
    choices: {
      'caterpillar-crossroad': 'mushroom',
      'queen-garden': 'mirror',
    },
  }));
  const migrated = loadProgress();
  assert.ok(migrated.unlocked.includes('no-number-corridor'));
  assert.ok(migrated.unlocked.includes('white-rabbit-house'));
  assert.ok(migrated.unlocked.includes('backward-bank'));
  assert.ok(migrated.unlocked.includes('caucus-race'));
  assert.ok(migrated.unlocked.includes('duchess-kitchen'));
  assert.ok(migrated.unlocked.includes('eraser-map'));
  assert.ok(migrated.unlocked.includes('cheshire-wood'));
  assert.ok(migrated.unlocked.includes('card-procession'));
  assert.ok(migrated.unlocked.includes('leaking-rules'));
  assert.ok(migrated.unlocked.includes('trial-of-names'));
});
