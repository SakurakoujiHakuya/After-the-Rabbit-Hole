import test from 'node:test';
import assert from 'node:assert/strict';

import {
  getActiveCarrySummary,
  getBranchGiftSummary,
  getRouteCarrySummary,
  getRouteChoiceSummary,
  inheritedGiftName,
} from '../src/routeSummary.js';
import { getLevel } from '../src/levels.js';

test('names inherited branch gifts with story-facing labels', () => {
  assert.equal(inheritedGiftName({ type: 'potion' }), '蓝药水');
  assert.equal(inheritedGiftName({ id: 'final-mirror-ribbon' }), '镜面缎带');
  assert.equal(inheritedGiftName({ id: 'croquet-feather-gift' }), '火烈鸟羽毛');
  assert.equal(inheritedGiftName({ id: 'small-shortcut-gate' }), '变小捷径');
});

test('summarizes what a branch will carry into later chapters', () => {
  const crossroad = getLevel('caterpillar-crossroad');
  const tea = crossroad.choices.find((choice) => choice.id === 'tea');
  const mushroom = crossroad.choices.find((choice) => choice.id === 'mushroom');

  assert.match(getBranchGiftSummary(crossroad, tea), /怀表/);
  assert.match(getBranchGiftSummary(crossroad, mushroom), /蓝药水|变小捷径/);
});

test('summarizes active carries for the current playable route', () => {
  const kitchen = getLevel('duchess-kitchen');

  assert.match(
    getActiveCarrySummary(kitchen, { 'caterpillar-crossroad': 'tea' }),
    /怀表/,
  );
  assert.equal(
    getActiveCarrySummary(kitchen, { 'caterpillar-crossroad': 'mushroom' }).includes('怀表'),
    false,
  );
});

test('builds a readable route ledger from saved choices', () => {
  const progress = {
    choices: {
      'caterpillar-crossroad': 'tea',
      'queen-garden': 'croquet',
    },
  };

  assert.match(getRouteChoiceSummary(progress), /你是谁？：追随钟声/);
  assert.match(getRouteChoiceSummary(progress), /把白玫瑰涂成红色：接受女王的比赛/);
  assert.match(getRouteCarrySummary(progress.choices), /怀表/);
  assert.match(getRouteCarrySummary(progress.choices), /火烈鸟羽毛/);
});
