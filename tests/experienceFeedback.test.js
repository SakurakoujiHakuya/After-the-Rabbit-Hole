import test from 'node:test';
import assert from 'node:assert/strict';
import { getCollectionMessage, getDeathMessage } from '../src/gameFeedback.js';
import {
  getDynamicHint,
  getStagedObjectives,
  getStealthAlertDuration,
} from '../src/objectives.js';
import { levelById } from '../src/levels.js';

test('uses theme-specific collision and checkpoint feedback', () => {
  assert.match(getDeathMessage('dodo', {}), /赛跑队伍/);
  assert.match(getDeathMessage('plate', {}), /飞来的盘子/);
  assert.equal(
    getCollectionMessage({
      type: 'checkpoint',
      collectMessage: '汤锅记住了你的位置。',
    }),
    '汤锅记住了你的位置。',
  );
  assert.equal(
    getCollectionMessage({ type: 'checkpoint' }),
    '检查点记住了你的位置。',
  );
});

test('builds the cheshire route as an explicit staged objective list', () => {
  const level = levelById['cheshire-wood'];
  const initial = getStagedObjectives(level, [], []);
  assert.deepEqual(initial.map((entry) => entry.label), [
    '月亮灯',
    '月光微笑',
    '太阳灯',
    '阳光微笑',
    '出口月灯',
    '出口',
  ]);
  assert.equal(initial[0].current, true);
  assert.equal(initial[1].next, true);

  const progressed = getStagedObjectives(
    level,
    ['moon-smile'],
    ['moon-lantern'],
  );
  assert.ok(progressed[0].done);
  assert.ok(progressed[1].done);
  assert.equal(progressed[2].current, true);
});

test('tightens cheshire alert timing as each escort advances', () => {
  const config = levelById['cheshire-wood'].stealthConfig;
  assert.equal(getStealthAlertDuration(config, new Set(['moon-lantern'])), 2000);
  assert.equal(
    getStealthAlertDuration(config, new Set(['moon-lantern', 'sun-lantern'])),
    1600,
  );
  assert.equal(
    getStealthAlertDuration(
      config,
      new Set(['moon-lantern', 'sun-lantern', 'exit-lantern']),
    ),
    1300,
  );
});

test('gives state-aware hints for the identity relay puzzle', () => {
  const level = levelById['caterpillar-crossroad'];
  assert.match(
    getDynamicHint(level, { collectedIds: [], activatedIds: [] }),
    /倒影.*过去/,
  );
  assert.match(
    getDynamicHint(level, {
      collectedIds: [],
      activatedIds: [],
      identityRemaining: 2.8,
    }),
    /倒计时.*现在/,
  );
  assert.match(
    getDynamicHint(level, {
      collectedIds: [],
      activatedIds: ['who-left', 'who-right'],
    }),
    /终点门/,
  );
});

test('guides the cheshire stealth route one step at a time', () => {
  const level = levelById['cheshire-wood'];
  assert.match(
    getDynamicHint(level, { collectedIds: [], activatedIds: [] }),
    /月亮灯/,
  );
  assert.match(
    getDynamicHint(level, {
      collectedIds: [],
      activatedIds: ['moon-lantern'],
    }),
    /月光微笑/,
  );
  assert.match(
    getDynamicHint(level, {
      collectedIds: ['moon-smile', 'sun-smile'],
      activatedIds: ['moon-lantern', 'sun-lantern', 'exit-lantern'],
    }),
    /最后一团猫雾/,
  );
});

test('explains missing prerequisite items before locked switches', () => {
  const level = levelById['cheshire-wood'];
  assert.match(
    getDynamicHint(level, {
      collectedIds: [],
      activatedIds: ['moon-lantern'],
    }),
    /月光微笑/,
  );
  assert.match(
    getDynamicHint(level, {
      collectedIds: ['moon-smile'],
      activatedIds: ['moon-lantern'],
    }),
    /太阳灯/,
  );
});
