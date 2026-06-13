import test from 'node:test';
import assert from 'node:assert/strict';

const memory = new Map();
global.localStorage = {
  getItem: (key) => memory.get(key) ?? null,
  setItem: (key, value) => memory.set(key, value),
  removeItem: (key) => memory.delete(key),
};

const {
  chooseBranch,
  clearProgress,
  completeLevel,
  enterLevel,
  initialProgress,
  loadProgress,
  recordDeath,
} = await import('../src/progress.js');
const { getLevel } = await import('../src/levels.js');

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
  const first = completeLevel(initialProgress, level, 4200);
  const second = completeLevel(first, level, 6100);
  assert.equal(second.completed[level.id], true);
  assert.equal(second.bestTimes[level.id], 4200);
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
