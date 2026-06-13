import test from 'node:test';
import assert from 'node:assert/strict';
import {
  activateSwitch,
  circleRectCollision,
  getMoverRect,
  makeBall,
  requirementsMet,
  updateBall,
} from '../src/gameEngine.js';

test('moves the player without crossing a wall', () => {
  const ball = makeBall({ x: 40, y: 40 });
  const wall = { x: 60, y: 0, w: 20, h: 100 };
  for (let index = 0; index < 30; index += 1) {
    updateBall(ball, { x: 1, y: 0 }, [wall], 16.667);
  }
  assert.equal(circleRectCollision(ball, wall), false);
  assert.ok(ball.x <= wall.x - ball.radius);
});

test('moves hazards along their configured axis', () => {
  const mover = { x: 20, y: 30, w: 10, h: 10, axis: 'x', range: 40, speed: 0.01 };
  const position = getMoverRect(mover, 100);
  assert.notEqual(position.x, mover.x);
  assert.equal(position.y, mover.y);
});

test('moves orbit hazards around their configured center', () => {
  const mover = {
    path: 'orbit',
    centerX: 100,
    centerY: 80,
    radiusX: 40,
    radiusY: 20,
    w: 10,
    h: 10,
    speed: 0.01,
  };
  const position = getMoverRect(mover, 0);
  assert.equal(position.x, 135);
  assert.equal(position.y, 75);
  assert.equal(position.angle, 0);
});

test('checks collected items, switches, and name fragments', () => {
  const state = {
    collected: new Set(['gold-key', 'name-1', 'name-2', 'name-3']),
    switches: new Set(['rose-seal']),
  };
  assert.equal(requirementsMet({
    items: ['gold-key'],
    switches: ['rose-seal'],
    fragments: 3,
  }, state), true);
});

test('advances and resets an ordered switch puzzle', () => {
  const sequence = ['moon', 'key', 'rose'];
  const first = activateSwitch(sequence, new Set(), 0, 'moon');
  assert.equal(first.status, 'correct');
  assert.deepEqual([...first.switches], ['moon']);

  const reset = activateSwitch(sequence, first.switches, first.sequenceIndex, 'rose');
  assert.equal(reset.status, 'reset');
  assert.deepEqual([...reset.switches], []);

  const moon = activateSwitch(sequence, new Set(), 0, 'moon');
  const key = activateSwitch(sequence, moon.switches, moon.sequenceIndex, 'key');
  const rose = activateSwitch(sequence, key.switches, key.sequenceIndex, 'rose');
  assert.equal(rose.status, 'complete');
  assert.deepEqual([...rose.switches], sequence);
});
