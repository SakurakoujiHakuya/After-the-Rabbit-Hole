import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildEndingSharePayload,
  formatShareMessage,
  getEndingShareStats,
} from '../src/share.js';

test('builds a story-facing ending share payload from route progress', () => {
  const progress = {
    choices: {
      'caterpillar-crossroad': 'tea',
      'queen-garden': 'croquet',
    },
    curiosities: {
      'rabbit-fall': ['cameo-rabbit-fall'],
      'mad-tea-party': ['cameo-mad-tea-party'],
      'looking-glass-chess': [],
    },
    grades: {
      'rabbit-fall': 3,
      'mad-tea-party': 2,
      'looking-glass-chess': 3,
    },
    completed: {},
  };

  const stats = getEndingShareStats(progress);
  const payload = buildEndingSharePayload(progress, 'https://example.test/After-the-Rabbit-Hole/');

  assert.equal(payload.title, '兔子洞尽头');
  assert.equal(stats.curiosityCount, 2);
  assert.equal(stats.crownCount, 5);
  assert.match(payload.text, /帮爱丽丝找回了名字/);
  assert.match(payload.text, /你是谁？：追随钟声/);
  assert.match(payload.text, /接受女王的比赛/);
  assert.match(payload.text, /怀表/);
  assert.match(payload.text, /火烈鸟羽毛/);
  assert.match(payload.text, new RegExp(`兔子浮雕 2/${stats.maxCuriosities}`));
  assert.equal(payload.url, 'https://example.test/After-the-Rabbit-Hole/');
});

test('formats native share payload into a clipboard fallback message', () => {
  const payload = {
    title: '兔子洞尽头',
    text: '我把白兔的怀表带出了梦。',
    url: 'https://example.test/game/',
  };

  assert.equal(
    formatShareMessage(payload),
    '兔子洞尽头\n我把白兔的怀表带出了梦。\nhttps://example.test/game/',
  );
});
