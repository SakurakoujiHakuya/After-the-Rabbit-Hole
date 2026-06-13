import test from 'node:test';
import assert from 'node:assert/strict';
import {
  activateSwitch,
  applyBumperImpulse,
  circleRectCollision,
  getMoverRect,
  getPhaseWalls,
  getRotatorWalls,
  makeBall,
  requirementsMet,
  rotateRect,
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

test('applies a configured flamingo bumper impulse', () => {
  const ball = makeBall({ x: 10, y: 10 });
  const speed = applyBumperImpulse(ball, { impulseX: 3, impulseY: -4 });
  assert.equal(ball.vx, 3);
  assert.equal(ball.vy, -4);
  assert.equal(speed, 5);
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

test('rotates axis-aligned room walls in ninety-degree steps', () => {
  const horizontal = { x: 60, y: 95, w: 80, h: 10 };
  const vertical = rotateRect(horizontal, 100, 100, 1);
  assert.deepEqual(
    { x: vertical.x, y: vertical.y, w: vertical.w, h: vertical.h },
    { x: 95, y: 60, w: 10, h: 80 },
  );

  const walls = getRotatorWalls({
    id: 'room',
    centerX: 100,
    centerY: 100,
    walls: [horizontal],
  }, 1);
  assert.equal(walls[0].rotatorId, 'room');
  assert.equal(walls[0].w, 10);
});

test('checks the required dynamic room orientation', () => {
  const state = {
    collected: new Set(),
    switches: new Set(),
    rotations: new Map([['tea-table', 1]]),
  };
  assert.equal(requirementsMet({ rotations: { 'tea-table': 1 } }, state), true);
  assert.equal(requirementsMet({ rotations: { 'tea-table': 0 } }, state), false);
});

test('checks required painted roses', () => {
  const state = {
    collected: new Set(),
    switches: new Set(),
    painted: new Set(['rose-a', 'rose-b']),
  };
  assert.equal(requirementsMet({ painted: ['rose-a', 'rose-b'] }, state), true);
  assert.equal(requirementsMet({ painted: ['rose-a', 'rose-c'] }, state), false);
});

test('selects walls for a world phase and checks the required phase', () => {
  const phase = {
    id: 'mirror',
    wallsByState: [
      [{ x: 10, y: 20, w: 30, h: 8 }],
      [{ x: 40, y: 50, w: 8, h: 30 }],
    ],
  };
  assert.equal(getPhaseWalls(phase, 1)[0].x, 40);
  assert.equal(getPhaseWalls(phase, 1)[0].phaseId, 'mirror');
  const state = {
    collected: new Set(),
    switches: new Set(),
    phases: new Map([['mirror', 1]]),
  };
  assert.equal(requirementsMet({ phases: { mirror: 1 } }, state), true);
  assert.equal(requirementsMet({ phases: { mirror: 0 } }, state), false);
});
