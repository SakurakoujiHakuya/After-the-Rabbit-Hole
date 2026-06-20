import test from 'node:test';
import assert from 'node:assert/strict';
import {
  activateSwitch,
  applyFallDamage,
  applyBumperImpulse,
  canScoreLinkedHoop,
  canTriggerSwitch,
  circleRectCollision,
  constrainInputByContacts,
  generateFallCourse,
  getFallElapsed,
  getFallGoalY,
  getFallScrollDistance,
  getEchoReplayPosition,
  getIdentityCaptureRemaining,
  getIdentitySealSlowdown,
  getHunterTarget,
  getMoverRect,
  getMotionEnvironment,
  getMovingZoneRect,
  getActiveFallPlatforms,
  getActiveMirrorZones,
  getMirrorZoneEffects,
  getTargetAssistVector,
  getTimeZoneEffects,
  getPhaseWalls,
  getRotatorWalls,
  isBumperEnabled,
  isItemAvailable,
  isMirrorControlActive,
  isMoverActive,
  isPlayerObservedByMovers,
  isSimultaneousGroupOccupied,
  isTriggerOccupied,
  isZoneActive,
  makeBall,
  requirementsMet,
  resetBall,
  rotateRect,
  selectFallRespawnPlatform,
  segmentCrossesHoop,
  selectAssistTarget,
  transformControlInput,
  updateHunterCardPosition,
  updateMirrorZoneMembership,
  updateIdentityRelay,
  updateStealthAlert,
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

test('uses responsive target velocity without long gyro coasting', () => {
  const ball = makeBall({ x: 40, y: 40 });
  for (let index = 0; index < 30; index += 1) {
    updateBall(ball, { x: 1, y: 0 }, [], 16.667, {
      motionModel: 'targetVelocity',
      maxSpeed: 4.1,
    });
  }
  assert.ok(ball.vx > 3.9 && ball.vx <= 4.1);

  let stoppedAfter = null;
  for (let index = 0; index < 30; index += 1) {
    updateBall(ball, { x: 0, y: 0 }, [], 16.667, {
      motionModel: 'targetVelocity',
      maxSpeed: 4.1,
    });
    if (stoppedAfter === null && ball.vx === 0) stoppedAfter = index * 16.667;
  }
  assert.ok(stoppedAfter !== null && stoppedAfter < 300);
});

test('keeps target velocity response stable across common frame rates', () => {
  const results = [30, 60, 120].map((fps) => {
    const ball = makeBall({ x: 40, y: 40 });
    const dt = 1000 / fps;
    for (let elapsed = 0; elapsed < 500; elapsed += dt) {
      updateBall(ball, { x: 1, y: 0 }, [], dt, {
        motionModel: 'targetVelocity',
        maxSpeed: 4.1,
      });
    }
    for (let elapsed = 0; elapsed < 300; elapsed += dt) {
      updateBall(ball, { x: 0, y: 0 }, [], dt, {
        motionModel: 'targetVelocity',
        maxSpeed: 4.1,
      });
    }
    return ball.x;
  });
  assert.ok(Math.max(...results) - Math.min(...results) < 5);
});

test('auto-stops only when both input and speed are low', () => {
  const ball = makeBall({ x: 40, y: 40 });
  ball.vx = 0.13;
  updateBall(ball, { x: 0, y: 0 }, [], 16.667, {
    motionModel: 'targetVelocity',
  });
  assert.equal(ball.vx, 0);

  ball.vx = 0.13;
  updateBall(ball, { x: 0.2, y: 0 }, [], 16.667, {
    motionModel: 'targetVelocity',
  });
  assert.notEqual(ball.vx, 0);
});

test('keeps environmental currents active while gyro input is neutral', () => {
  const ball = makeBall({ x: 40, y: 40 });
  updateBall(ball, { x: 0, y: 0 }, [], 16.667, {
    motionModel: 'targetVelocity',
    externalForce: { x: 0.8, y: 0 },
  });
  assert.ok(ball.vx > 0);
});

test('lets collected story items disable environmental zones', () => {
  const zone = { disabledByItems: ['kitchen-fan'] };
  const state = {
    collected: new Set(),
    switches: new Set(),
  };
  assert.equal(isZoneActive(zone, state), true);
  state.collected.add('kitchen-fan');
  assert.equal(isZoneActive(zone, state), false);
});

test('suppresses only the input component that presses into a wall', () => {
  const constrained = constrainInputByContacts(
    { x: 0.8, y: 0.5 },
    [{ nx: -1, ny: 0, remaining: 100 }],
  );
  assert.ok(Math.abs(constrained.x) < Number.EPSILON);
  assert.equal(constrained.y, 0.5);
  assert.deepEqual(
    constrainInputByContacts(
      { x: -0.8, y: 0.5 },
      [{ nx: -1, ny: 0, remaining: 100 }],
    ),
    { x: -0.8, y: 0.5 },
  );
});

test('remembers a wall briefly and allows immediate reverse escape', () => {
  const ball = makeBall({ x: 46, y: 50 });
  const wall = { x: 60, y: 0, w: 18, h: 100 };
  for (let index = 0; index < 20; index += 1) {
    updateBall(ball, { x: 1, y: 0 }, [wall], 16.667, {
      motionModel: 'targetVelocity',
    });
  }
  assert.ok(ball.contacts.some((contact) => contact.nx === -1));
  const contactX = ball.x;
  updateBall(ball, { x: -1, y: 0 }, [wall], 16.667, {
    motionModel: 'targetVelocity',
  });
  assert.ok(ball.x < contactX);
});

test('clears remembered wall contacts when the player respawns', () => {
  const ball = makeBall({ x: 40, y: 40 });
  ball.contacts.push({ nx: -1, ny: 0, remaining: 120 });
  resetBall(ball, { x: 20, y: 20 });
  assert.deepEqual(ball.contacts, []);
});

test('selects only visible assist targets in the intended direction', () => {
  const player = { x: 40, y: 40, radius: 13 };
  const targets = [
    { id: 'ahead', x: 70, y: 40, r: 12 },
    { id: 'side', x: 40, y: 66, r: 12 },
  ];
  assert.equal(
    selectAssistTarget(player, { x: 1, y: 0 }, targets, []).target.id,
    'ahead',
  );
  assert.equal(
    selectAssistTarget(
      player,
      { x: 1, y: 0 },
      targets,
      [{ x: 53, y: 20, w: 5, h: 40 }],
    ),
    null,
  );
});

test('keeps target assistance subtle and disables it at decisive input', () => {
  const player = { x: 40, y: 40, radius: 13 };
  const targets = [{ id: 'key', x: 68, y: 40, r: 12 }];
  const assisted = getTargetAssistVector(
    player,
    { x: 0.1, y: 0 },
    0.5,
    targets,
    [],
  );
  assert.equal(assisted.target.id, 'key');
  assert.ok(assisted.x > 0 && assisted.x <= 0.14);
  assert.deepEqual(
    getTargetAssistVector(player, { x: 0.8, y: 0 }, 0.5, targets, []),
    { x: 0, y: 0, target: null },
  );
  assert.deepEqual(
    getTargetAssistVector(player, { x: 0, y: 0 }, 0, targets, []),
    { x: 0, y: 0, target: null },
  );
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

test('spends fall health before restarting the run', () => {
  assert.deepEqual(applyFallDamage(3), { lives: 2, restart: false });
  assert.deepEqual(applyFallDamage(2), { lives: 1, restart: false });
  assert.deepEqual(applyFallDamage(1), { lives: 3, restart: true });
});

test('drives fall distance from elapsed time instead of frame count', () => {
  const duration = 30000;
  const distance = 2400;
  assert.equal(getFallScrollDistance(0, duration, distance), 0);
  assert.equal(getFallScrollDistance(duration, duration, distance), distance);
  assert.equal(getFallScrollDistance(duration * 2, duration, distance), distance);
  assert.ok(getFallScrollDistance(15000, duration, distance) > distance * 0.38);
  assert.ok(getFallScrollDistance(25000, duration, distance) > distance * 0.76);
  assert.equal(
    getFallScrollDistance(17342, duration, distance),
    getFallScrollDistance(17342, duration, distance),
  );
});

test('raises the landing platform during the final five seconds', () => {
  assert.equal(getFallGoalY(24999, 30000), 720);
  assert.equal(getFallGoalY(25000, 30000), 650);
  assert.equal(getFallGoalY(27500, 30000), 575);
  assert.equal(getFallGoalY(30000, 30000), 500);
});

test('excludes completed and active pauses from fall elapsed time', () => {
  assert.equal(getFallElapsed(18000, 1000, 2000), 15000);
  assert.equal(getFallElapsed(18000, 1000, 2000, 15000), 12000);
});

test('selects the nearest safe platform above the player', () => {
  const player = { x: 180, y: 360, radius: 13 };
  const platforms = [
    { id: 'far', type: 'solid', route: true, x: 30, y: 190, w: 100 },
    { id: 'near', type: 'solid', route: true, x: 150, y: 260, w: 100 },
    { id: 'below', type: 'solid', route: true, x: 150, y: 430, w: 100 },
    { id: 'spikes', type: 'spikes', route: false, x: 160, y: 300, w: 80 },
    { id: 'fragile', type: 'fragile', route: false, x: 160, y: 290, w: 80 },
    { id: 'goal', type: 'goal', route: true, x: 140, y: 280, w: 120 },
  ];
  assert.equal(selectFallRespawnPlatform(platforms, player).id, 'near');
});

test('falls back to a central safe platform and excludes unsafe positions', () => {
  const player = { x: 180, y: 75, radius: 13 };
  const platforms = [
    { id: 'top', type: 'solid', route: true, x: 120, y: 90, w: 120 },
    { id: 'center', type: 'solid', route: true, x: 120, y: 300, w: 120 },
    { id: 'lower', type: 'solid', route: true, x: 120, y: 520, w: 120 },
  ];
  assert.equal(
    selectFallRespawnPlatform(platforms, player, {
      topDangerY: 70,
      excludedIds: new Set(['lower']),
    }).id,
    'center',
  );
});

test('generates a safe route before adding optional fall hazards', () => {
  for (let seed = 1; seed <= 200; seed += 1) {
    const course = generateFallCourse({ targetDistance: 2400 }, seed);
    const route = course.platforms.filter(
      (platform) => platform.route && platform.type !== 'goal',
    );
    assert.ok(route.length >= 16, `seed ${seed} needs enough route platforms`);
    for (let index = 0; index < route.length; index += 1) {
      assert.ok(
        route[index].type === 'solid',
        `seed ${seed} put ${route[index].type} on the mandatory route`,
      );
      if (index === 0) continue;
      const previousCenter = route[index - 1].x + route[index - 1].w / 2;
      const currentCenter = route[index].x + route[index].w / 2;
      assert.ok(
        Math.abs(currentCenter - previousCenter) <= 105,
        `seed ${seed} generated an unreachable horizontal jump`,
      );
      assert.ok(
        route[index].y - route[index - 1].y >= 112 &&
        route[index].y - route[index - 1].y <= 142,
        `seed ${seed} generated an invalid vertical gap`,
      );
    }
    assert.ok(course.platforms.some((platform) => platform.type === 'goal'));
    assert.ok(course.items.every((item) => (
      course.platforms.some((platform) => platform.id === item.platformId)
    )));
  }
});

test('keeps spike platforms off every generated safe route', () => {
  for (let seed = 201; seed <= 400; seed += 1) {
    const course = generateFallCourse({}, seed);
    for (const platform of course.platforms) {
      if (platform.type === 'spikes') assert.equal(platform.route, false);
    }
  }
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

test('interpolates a visible replay from two seconds of position history', () => {
  const history = [
    { time: 0, x: 20, y: 30 },
    { time: 500, x: 70, y: 80 },
    { time: 1000, x: 120, y: 130 },
  ];
  assert.deepEqual(
    getEchoReplayPosition(history, 2500, { delay: 2000 }),
    { x: 70, y: 80 },
  );
  assert.deepEqual(
    getEchoReplayPosition(history, 2250, { delay: 2000 }),
    { x: 45, y: 55 },
  );
  assert.equal(getEchoReplayPosition(history, 1500, { delay: 2000 }), null);
});

test('keeps player and replay Alice bound to their own identity seals', () => {
  const player = { x: 280, y: 320, radius: 13 };
  const echo = { x: 70, y: 320 };
  const triggers = [
    { id: 'past', triggerSource: 'echo', x: 70, y: 320, r: 20 },
    { id: 'present', triggerSource: 'player', x: 280, y: 320, r: 20 },
  ];
  assert.equal(isTriggerOccupied(triggers[0], player, echo), true);
  assert.equal(isTriggerOccupied(triggers[1], player, echo), true);
  assert.equal(isSimultaneousGroupOccupied(triggers, player, echo), true);
  assert.equal(
    isSimultaneousGroupOccupied(triggers, player, { x: 280, y: 320 }),
    false,
  );
});

test('tracks the identity capture window without moving either character', () => {
  assert.equal(getIdentityCaptureRemaining(5000, 1000), 4000);
  assert.equal(getIdentityCaptureRemaining(5000, 4999), 1);
  assert.equal(getIdentityCaptureRemaining(5000, 5000), 0);
  assert.equal(getIdentityCaptureRemaining(5000, 6000), 0);
});

test('completes the identity relay only while the captured past is active', () => {
  const captured = updateIdentityRelay(
    {},
    { time: 1000, pastEntered: true, captureDuration: 4000 },
  );
  assert.equal(captured.status, 'captured');
  assert.equal(captured.event, 'captured');
  assert.equal(captured.capturedUntil, 5000);

  const completed = updateIdentityRelay(
    captured,
    { time: 4800, presentOccupied: true, captureDuration: 4000 },
  );
  assert.equal(completed.status, 'completed');
  assert.equal(completed.event, 'complete');

  const expired = updateIdentityRelay(
    captured,
    { time: 5000, presentOccupied: true, captureDuration: 4000 },
  );
  assert.equal(expired.status, 'idle');
  assert.equal(expired.event, 'expired');
});

test('warns once, expires, and allows the past to be captured again', () => {
  const warning = updateIdentityRelay(
    { capturedUntil: 5000, expiringNotified: false },
    { time: 4200 },
  );
  assert.equal(warning.event, 'expiring');
  assert.equal(warning.expiringNotified, true);
  assert.equal(updateIdentityRelay(warning, { time: 4300 }).event, null);

  const expired = updateIdentityRelay(warning, { time: 5100 });
  assert.equal(expired.event, 'expired');
  const recaptured = updateIdentityRelay(
    expired,
    { time: 5200, pastEntered: true, captureDuration: 4000 },
  );
  assert.equal(recaptured.status, 'captured');
  assert.equal(recaptured.capturedUntil, 9200);
});

test('slows Alice smoothly only near the present identity seal', () => {
  const seal = { x: 100, y: 100 };
  assert.equal(getIdentitySealSlowdown({ x: 152, y: 100 }, seal, 52), 1);
  assert.ok(
    Math.abs(getIdentitySealSlowdown({ x: 100, y: 100 }, seal, 52) - 0.42) <
    Number.EPSILON,
  );
  const halfway = getIdentitySealSlowdown({ x: 126, y: 100 }, seal, 52);
  assert.ok(halfway > 0.42 && halfway < 1);
});

test('moves a ping-pong cat fog along configured waypoints and pauses at turns', () => {
  const zone = {
    w: 100,
    h: 80,
    speed: 100,
    pause: 700,
    pingPong: true,
    waypoints: [{ x: 50, y: 50 }, { x: 150, y: 50 }],
  };
  assert.equal(getMovingZoneRect(zone, 500).centerX, 100);
  assert.equal(getMovingZoneRect(zone, 1100).centerX, 150);
  assert.equal(getMovingZoneRect(zone, 1600).centerX, 150);
  assert.ok(getMovingZoneRect(zone, 2200).centerX < 150);
});

test('activates staged cards and recovers alert inside cat fog', () => {
  const mover = {
    requiresSwitches: ['moon'],
    disabledBySwitches: ['sun'],
  };
  assert.equal(isMoverActive(mover, new Set()), false);
  assert.equal(isMoverActive(mover, new Set(['moon'])), true);
  assert.equal(isMoverActive(mover, new Set(['moon', 'sun'])), false);
  assert.equal(updateStealthAlert(0, false, 600, { alertDuration: 1200 }), 0.5);
  assert.equal(
    updateStealthAlert(0.5, true, 300, {
      alertDuration: 1200,
      recoveryMultiplier: 2,
    }),
    0,
  );
  assert.equal(
    updateStealthAlert(0.5, false, 300, {
      alertDuration: 1200,
      recoveryMultiplier: 2,
      observed: false,
    }),
    0,
  );
});

test('combines time zones into mover timing and player damping effects', () => {
  const zones = [
    {
      effect: 'time',
      shape: 'ellipse',
      x: 10,
      y: 10,
      w: 100,
      h: 80,
      timeScale: 0.5,
      playerDamping: 0.72,
    },
    {
      effect: 'time',
      x: 40,
      y: 30,
      w: 100,
      h: 80,
      timeScale: 1.4,
    },
  ];
  const effects = getTimeZoneEffects(zones, { x: 60, y: 50 });
  assert.equal(effects.activeZones.length, 2);
  assert.equal(effects.timeScale, 0.7);
  assert.equal(effects.playerDamping, 0.72);
  assert.deepEqual(
    getTimeZoneEffects(zones, { x: 250, y: 250 }),
    { timeScale: 1, playerDamping: 1, activeZones: [] },
  );
});

test('combines level weather and zone motion inertia effects', () => {
  const zones = [
    {
      id: 'fog',
      shape: 'ellipse',
      x: 20,
      y: 20,
      w: 120,
      h: 80,
      motion: {
        maxSpeedMultiplier: 1.05,
        releaseResponseMultiplier: 1.8,
        sleepSpeedMultiplier: 0.4,
      },
    },
    {
      id: 'outside',
      x: 240,
      y: 240,
      w: 40,
      h: 40,
      motion: {
        releaseResponseMultiplier: 10,
      },
    },
  ];
  const effects = getMotionEnvironment(
    {
      weather: 'mist',
      releaseResponseMultiplier: 1.1,
      frictionMultiplier: 1.01,
    },
    zones,
    { x: 80, y: 60 },
  );

  assert.equal(effects.weather, 'mist');
  assert.equal(effects.activeZones.map((zone) => zone.id).join(','), 'fog');
  assert.equal(effects.maxSpeedMultiplier, 1.05);
  assert.ok(Math.abs(effects.releaseResponseMultiplier - 1.98) < 0.0001);
  assert.equal(effects.sleepSpeedMultiplier, 0.4);
  assert.equal(effects.frictionMultiplier, 1.01);
});

test('lets hunter cards lose Alice in fog and chase smile decoys first', () => {
  const player = { x: 120, y: 80 };
  const hiddenTarget = getHunterTarget(player, true, [], 1000);
  assert.equal(hiddenTarget, null);

  const decoyTarget = getHunterTarget(
    player,
    true,
    [{ x: 240, y: 300, until: 2000 }],
    1000,
  );
  assert.deepEqual(decoyTarget, { x: 240, y: 300, kind: 'decoy' });

  const playerTarget = getHunterTarget(
    player,
    false,
    [{ x: 240, y: 300, until: 900 }],
    1000,
  );
  assert.deepEqual(playerTarget, { x: 120, y: 80, kind: 'player' });

  const moved = updateHunterCardPosition(
    { x: 0, y: 0 },
    { x: 30, y: 0 },
    500,
    { maxSpeed: 20 },
  );
  assert.equal(moved.x, 0.64);
  assert.equal(moved.y, 0);
});

test('raises stealth alert only for an unobstructed nearby card', () => {
  const player = { x: 40, y: 40, radius: 13 };
  const mover = { x: 90, y: 30, w: 20, h: 20 };
  assert.equal(isPlayerObservedByMovers(player, [mover], [], 80), true);
  assert.equal(
    isPlayerObservedByMovers(
      player,
      [mover],
      [{ x: 64, y: 20, w: 8, h: 40 }],
      80,
    ),
    false,
  );
  assert.equal(
    isPlayerObservedByMovers(player, [{ ...mover, x: 180 }], [], 80),
    false,
  );
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
  assert.deepEqual(effects, { vanish: true, invertX: false });
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
