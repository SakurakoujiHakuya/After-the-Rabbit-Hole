import test from 'node:test';
import assert from 'node:assert/strict';
import { getCollectionMessage, getDeathMessage } from '../src/gameFeedback.js';
import {
  getDynamicHint,
  getGuidanceObjectives,
  getGuidanceTarget,
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
    /猫雾.*月光微笑/,
  );
  assert.match(
    getDynamicHint(level, {
      collectedIds: ['moon-smile', 'sun-smile'],
      activatedIds: ['moon-lantern', 'sun-lantern', 'exit-lantern'],
    }),
    /最后一团猫雾/,
  );
});

test('does not override core teaching hints when a level has no locks', () => {
  assert.equal(
    getDynamicHint(levelById['rabbit-fall'], { collectedIds: [], activatedIds: [] }),
    '',
  );
});

test('keeps tutorial and race guidance on the next reachable action', () => {
  assert.match(
    getDynamicHint(levelById['white-rabbit-house'], {
      collectedIds: [],
      activatedIds: [],
    }),
    /蓝药水/,
  );
  assert.match(
    getDynamicHint(levelById['white-rabbit-house'], {
      collectedIds: ['house-potion'],
      activatedIds: [],
    }),
    /白兔遗落的折扇/,
  );
  assert.match(
    getDynamicHint(levelById['caucus-race'], {
      collectedIds: [],
      activatedIds: [],
    }),
    /一号赛点/,
  );
  assert.match(
    getDynamicHint(levelById['caucus-race'], {
      collectedIds: [],
      activatedIds: ['caucus-one', 'caucus-two', 'caucus-three', 'caucus-finish'],
    }),
    /银顶针/,
  );
});

test('orders guidance objectives by the playable route instead of the goal lock list', () => {
  assert.deepEqual(
    getGuidanceObjectives(levelById['caucus-race'], {
      collectedIds: [],
      activatedIds: [],
    }).map((entry) => entry.label),
    ['一号赛点', '二号赛点', '三号赛点', '终点赛点', '银顶针'],
  );
  const trial = getGuidanceObjectives(levelById['trial-of-names'], {
    collectedIds: [],
    activatedIds: [],
    fragmentCount: 0,
    rotations: { 'court-room': 0 },
  });
  assert.deepEqual(trial.map((entry) => entry.label), ['0/3 名字', '法庭', '证词印章']);
  assert.equal(trial[0].current, true);
});

test('includes non-goal tutorial steps in guidance objectives', () => {
  const route = getGuidanceObjectives(levelById['white-rabbit-house'], {
    collectedIds: [],
    activatedIds: [],
  });
  assert.deepEqual(route.map((entry) => entry.label), ['蓝药水', '白兔折扇', '低门闩']);
  assert.equal(route[0].current, true);
});

test('points the dream compass at the current actionable target', () => {
  assert.equal(
    getGuidanceTarget(levelById['white-rabbit-house'], {
      collectedIds: [],
      activatedIds: [],
    }).id,
    'house-potion',
  );
  assert.equal(
    getGuidanceTarget(levelById['caterpillar-crossroad'], {
      collectedIds: [],
      activatedIds: [],
      identityRemaining: 2.4,
    }).id,
    'who-right',
  );
  assert.equal(
    getGuidanceTarget(levelById['cheshire-wood'], {
      collectedIds: ['moon-smile'],
      activatedIds: ['moon-lantern'],
    }).id,
    'sun-lantern',
  );
});

test('points phase-map guidance at the layer control before hidden targets', () => {
  const level = levelById['eraser-map'];
  assert.match(
    getDynamicHint(level, {
      collectedIds: ['erased-sign-1'],
      activatedIds: ['map-dial'],
      phases: { 'erased-ink': 1 },
    }),
    /切换地图层/,
  );
  assert.equal(
    getGuidanceTarget(level, {
      collectedIds: ['erased-sign-1'],
      activatedIds: ['map-dial'],
      phases: { 'erased-ink': 1 },
    }).id,
    'map-dial',
  );
  assert.equal(
    getGuidanceTarget(level, {
      collectedIds: ['erased-sign-1'],
      activatedIds: ['map-dial'],
      phases: { 'erased-ink': 2 },
    }).id,
    'erased-sign-2',
  );
});

test('guides looking-glass phases instead of pointing at hidden shards', () => {
  const level = levelById['looking-glass'];
  assert.match(
    getDynamicHint(level, {
      collectedIds: ['orientation-lens'],
      activatedIds: [],
      phases: { 'mirror-depth': 0 },
    }),
    /镜盘.*左影层/,
  );
  assert.match(
    getDynamicHint(level, {
      collectedIds: ['orientation-lens'],
      activatedIds: [],
      phases: { 'mirror-depth': 1 },
    }),
    /左影碎片/,
  );
  assert.match(
    getDynamicHint(level, {
      collectedIds: ['orientation-lens', 'left-reflection', 'right-reflection'],
      activatedIds: [],
      phases: { 'mirror-depth': 2 },
    }),
    /切回原层/,
  );
});

test('puts final trial identity before verdict mechanics', () => {
  const level = levelById['trial-of-names'];
  assert.match(
    getDynamicHint(level, { collectedIds: [], activatedIds: [], fragmentCount: 0 }),
    /三个名字词/,
  );
  assert.match(
    getDynamicHint(level, {
      collectedIds: ['name-1', 'name-2', 'name-3'],
      activatedIds: [],
      fragmentCount: 3,
      rotations: { 'court-room': 0 },
    }),
    /转动法庭/,
  );
  assert.match(
    getDynamicHint(level, {
      collectedIds: ['name-1', 'name-2', 'name-3'],
      activatedIds: [],
      fragmentCount: 3,
      rotations: { 'court-room': 1 },
    }),
    /证词印章/,
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
