import test from 'node:test';
import assert from 'node:assert/strict';
import {
  activateSwitch,
  applyFallDamage,
  applyBumperImpulse,
  canScoreLinkedHoop,
  canTriggerSwitch,
  circleRectCollision,
  getMoverRect,
  getActiveFallPlatforms,
  getActiveMirrorZones,
  getFallCameraY,
  getMirrorZoneEffects,
  getPhaseWalls,
  getRotatorWalls,
  isBumperEnabled,
  isItemAvailable,
  isMirrorControlActive,
  makeBall,
  requirementsMet,
  rotateRect,
  segmentCrossesHoop,
  transformControlInput,
  updateMirrorZoneMembership,
  updateBall,
  updateFallPlayer,
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

test('lands on fall platforms only while crossing their top edge', () => {
  const platform = { id: 'ledge', x: 80, y: 120, w: 120, h: 14 };
  const falling = makeBall({ x: 120, y: 100 });
  falling.vy = 8;
  updateFallPlayer(falling, 0, [platform], 16.667);
  assert.equal(falling.y, platform.y - falling.radius);
  assert.equal(falling.vy, 0);
  assert.equal(falling.groundedPlatformId, platform.id);

  const rising = makeBall({ x: 120, y: 140 });
  rising.vy = -5;
  updateFallPlayer(rising, 0, [platform], 16.667);
  assert.ok(rising.y < 140);
  assert.notEqual(rising.y, platform.y + rising.radius);
  assert.equal(rising.groundedPlatformId, null);
});

test('walks off a fall platform and ignores vertical control input', () => {
  const platform = { id: 'ledge', x: 80, y: 120, w: 60, h: 14 };
  const player = makeBall({ x: 132, y: platform.y - 13 });
  player.groundedPlatformId = platform.id;
  for (let index = 0; index < 30; index += 1) {
    updateFallPlayer(player, 1, [platform], 16.667);
  }
  assert.ok(player.x - player.radius >= platform.x + platform.w);
  assert.ok(player.y > platform.y - player.radius);
  assert.ok(player.vy > 0);
});

test('expires fragile platforms after their configured delay', () => {
  const fragile = { id: 'paper', type: 'fragile', breakDelay: 450 };
  const breaking = new Map([['paper', 1000]]);
  assert.deepEqual(
    getActiveFallPlatforms([fragile], breaking, new Set(), 1449),
    [fragile],
  );
  assert.deepEqual(
    getActiveFallPlatforms([fragile], breaking, new Set(), 1450),
    [],
  );
  assert.deepEqual(
    getActiveFallPlatforms([fragile], new Map(), new Set(['paper']), 0),
    [],
  );
});

test('keeps the fall camera inside the world and moving downward', () => {
  assert.equal(getFallCameraY(100, 0, 2400), 0);
  assert.equal(getFallCameraY(900, 0, 2400), 680);
  assert.equal(getFallCameraY(400, 680, 2400), 680);
  assert.equal(getFallCameraY(2600, 0, 2400), 1760);
});

test('spends fall health before restarting the run', () => {
  assert.deepEqual(applyFallDamage(3), { lives: 2, restart: false });
  assert.deepEqual(applyFallDamage(2), { lives: 1, restart: false });
  assert.deepEqual(applyFallDamage(1), { lives: 3, restart: true });
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

test('links flamingos to their matching hoop and unlock sequence', () => {
  const switches = new Set(['hoop-1']);
  assert.equal(isBumperEnabled({ requiresSwitches: ['hoop-1'] }, switches), true);
  assert.equal(isBumperEnabled({ requiresSwitches: ['hoop-2'] }, switches), false);

  const hoop = { requiresBumper: 'flamingo-2' };
  assert.equal(canScoreLinkedHoop(hoop, 'flamingo-2', 5000, 4500), true);
  assert.equal(canScoreLinkedHoop(hoop, 'flamingo-1', 5000, 4500), false);
  assert.equal(canScoreLinkedHoop(hoop, 'flamingo-2', 4000, 4500), false);
});

test('scores a hoop only when a launch crosses its opening in the required direction', () => {
  const hoop = {
    x: 100,
    y: 80,
    r: 20,
    aperture: 14,
    orientation: 'vertical',
    direction: 1,
  };
  assert.equal(segmentCrossesHoop({ x: 92, y: 82 }, { x: 108, y: 81 }, hoop), true);
  assert.equal(segmentCrossesHoop({ x: 108, y: 82 }, { x: 92, y: 81 }, hoop), false);
  assert.equal(segmentCrossesHoop({ x: 92, y: 110 }, { x: 108, y: 109 }, hoop), false);
});

test('reveals state-bound items only in their matching chess world', () => {
  const item = { requiresPhases: { mirror: 1 }, requiresSwitches: ['queen'] };
  const state = {
    phases: new Map([['mirror', 1]]),
    switches: new Set(['queen']),
  };
  assert.equal(isItemAvailable(item, state), true);
  state.phases.set('mirror', 0);
  assert.equal(isItemAvailable(item, state), false);
});

test('keeps global mirror controls active until the orientation lens is collected', () => {
  const config = { invertX: true, releaseItem: 'orientation-lens' };
  const state = { collected: new Set() };
  assert.equal(isMirrorControlActive(config, state), true);
  assert.deepEqual(
    transformControlInput({ x: 1, y: -0.5 }, config, state),
    { x: -1, y: -0.5 },
  );
  state.collected.add('orientation-lens');
  assert.equal(isMirrorControlActive(config, state), false);
  assert.deepEqual(
    transformControlInput({ x: 1, y: -0.5 }, config, state),
    { x: 1, y: -0.5 },
  );
  assert.equal(isMirrorControlActive(null, state), false);
});

test('combines global and local mirror inversion with xor semantics', () => {
  const state = { collected: new Set() };
  const localMirror = [{ effect: 'invertX' }];
  assert.deepEqual(
    transformControlInput(
      { x: 1, y: -0.5 },
      { invertX: true },
      state,
      localMirror,
    ),
    { x: 1, y: -0.5 },
  );
  assert.deepEqual(
    transformControlInput({ x: 1, y: -0.5 }, null, state, localMirror),
    { x: -1, y: -0.5 },
  );
});

test('adds a bounded delayed echo to control input', () => {
  const history = [
    { time: 100, x: 1, y: 0 },
    { time: 450, x: 0, y: 1 },
    { time: 500, x: 0, y: 1 },
  ];
  const echoZone = [{
    effect: 'echo',
    delay: 400,
    strength: 0.28,
    maxMagnitude: 1.75,
  }];
  assert.deepEqual(
    transformControlInput(
      { x: 0, y: 1 },
      null,
      { collected: new Set() },
      echoZone,
      history,
      500,
    ),
    { x: 0.28, y: 1 },
  );
  const bounded = transformControlInput(
    { x: 2, y: 2 },
    null,
    { collected: new Set() },
    echoZone,
    [{ time: 100, x: 2, y: 2 }],
    500,
  );
  assert.ok(Math.hypot(bounded.x, bounded.y) <= 1.75 + Number.EPSILON);
});

test('uses hysteresis at mirror-zone edges and exposes zone effects', () => {
  const zones = [{
    id: 'veil',
    type: 'mirror',
    effect: 'vanish',
    x: 100,
    y: 100,
    w: 100,
    h: 100,
  }];
  const outsideEdge = updateMirrorZoneMembership({ x: 102, y: 150 }, zones);
  assert.equal(outsideEdge.has('veil'), false);
  const entered = updateMirrorZoneMembership({ x: 105, y: 150 }, zones);
  assert.equal(entered.has('veil'), true);
  const retained = updateMirrorZoneMembership({ x: 98, y: 150 }, zones, entered);
  assert.equal(retained.has('veil'), true);
  const exited = updateMirrorZoneMembership({ x: 95, y: 150 }, zones, retained);
  assert.equal(exited.has('veil'), false);
  const effects = getMirrorZoneEffects(getActiveMirrorZones(zones, entered));
  assert.deepEqual(effects, { echo: false, vanish: true, invertX: false });
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

  const locked = activateSwitch(sequence, rose.switches, rose.sequenceIndex, 'moon');
  assert.equal(locked.status, 'complete');
  assert.equal(locked.sequenceIndex, sequence.length);
  assert.deepEqual([...locked.switches], sequence);
});

test('distinguishes one-time switches from repeatable controls', () => {
  const activated = new Set(['seal', 'dial']);
  assert.equal(
    canTriggerSwitch({ id: 'seal', activationMode: 'once' }, activated),
    false,
  );
  assert.equal(
    canTriggerSwitch({ id: 'dial', activationMode: 'repeatable' }, activated),
    true,
  );
  assert.equal(
    canTriggerSwitch(
      { id: 'heart', activationMode: 'once' },
      new Set(['heart']),
      ['heart', 'spade'],
      1,
    ),
    true,
  );
  assert.equal(
    canTriggerSwitch(
      { id: 'heart', activationMode: 'once' },
      new Set(['heart', 'spade']),
      ['heart', 'spade'],
      2,
    ),
    false,
  );
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
