import test from 'node:test';
import assert from 'node:assert/strict';
import {
  activateSwitch,
  applyBumperImpulse,
  canTriggerSwitch,
  circleRectCollision,
  getPhaseWalls,
  getRotatorWalls,
  generateFallCourse,
  isItemAvailable,
  makeBall,
  requirementsMet,
  segmentCrossesHoop,
  updateBall,
} from '../src/gameEngine.js';
import { getPlayableLevel, levels, levelById } from '../src/levels.js';

function canReach(level, turns, target, phaseStates = {}, start = level.start, radius = 13) {
  const step = 4;
  const columns = 90;
  const rows = 160;
  const dynamicWalls = (level.rotators || []).flatMap((rotator) => (
    getRotatorWalls(rotator, turns[rotator.id] || 0)
  ));
  const phaseWalls = (level.phases || []).flatMap((phase) => (
    getPhaseWalls(phase, phaseStates[phase.id] ?? phase.initial ?? 0)
  ));
  const sizeGates = (level.sizeGates || []).filter((gate) => radius > gate.maxRadius);
  const walls = [...level.walls, ...dynamicWalls, ...phaseWalls, ...sizeGates];
  const seen = new Uint8Array(columns * rows);
  const queue = [];
  const push = (x, y) => {
    const column = Math.round(x / step);
    const row = Math.round(y / step);
    if (column < 0 || column >= columns || row < 0 || row >= rows) return;
    const index = row * columns + column;
    if (seen[index]) return;
    const player = { x: column * step, y: row * step, radius };
    if (walls.some((wall) => circleRectCollision(player, wall))) return;
    seen[index] = 1;
    queue.push([column, row]);
  };
  push(start.x, start.y);
  for (let index = 0; index < queue.length; index += 1) {
    const [column, row] = queue[index];
    const x = column * step;
    const y = row * step;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      push(x + dx * step, y + dy * step);
    }
    for (const portal of level.portals || []) {
      if (Math.hypot(x - portal.x, y - portal.y) > 13 + portal.r) continue;
      const pair = level.portals.find((entry) => entry.id === portal.pairId);
      if (pair) push(pair.x, pair.y);
    }
  }
  return queue.some(([column, row]) => (
    Math.hypot(column * step - target.x, row * step - target.y) <= radius + (target.r || 12)
  ));
}

const branchVariants = [
  {
    label: 'mushroom/mirror',
    choices: {
      'caterpillar-crossroad': 'mushroom',
      'queen-garden': 'mirror',
    },
  },
  {
    label: 'mushroom/croquet',
    choices: {
      'caterpillar-crossroad': 'mushroom',
      'queen-garden': 'croquet',
    },
  },
  {
    label: 'tea/mirror',
    choices: {
      'caterpillar-crossroad': 'tea',
      'queen-garden': 'mirror',
    },
  },
  {
    label: 'tea/croquet',
    choices: {
      'caterpillar-crossroad': 'tea',
      'queen-garden': 'croquet',
    },
  },
];

function levelVariants(level) {
  if (!level.inheritances?.length) return [{ label: 'base', level }];
  const variants = branchVariants.map(({ label, choices }) => ({
    label,
    level: getPlayableLevel(level.id, choices),
  }));
  const unique = new Map();
  for (const variant of variants) {
    const signature = [
      ...(variant.level.items || []).map((item) => item.id),
      ...(variant.level.sizeGates || []).map((gate) => gate.id),
    ].sort().join('|');
    if (!unique.has(signature)) unique.set(signature, variant);
  }
  return [...unique.values()];
}

function visualRadius(entity, kind) {
  if (kind === 'portal') return entity.r * 1.6;
  if (kind === 'bumper') return (entity.artSize || entity.r * 2) / 2;
  if (kind === 'paintable') return entity.r + 5;
  if (kind === 'switch') return entity.r * 1.05;
  if (kind !== 'item') return entity.r || 12;
  return {
    curiosity: 18,
    checkpoint: 19,
    paint: 22,
    fan: 18,
    fragment: 16,
    mirrorShard: 16,
    timepiece: 17,
    potion: 16,
    cookie: 13,
    smile: 16,
    shield: 15,
    key: 15,
    thimble: 15,
  }[entity.type] || entity.r || 12;
}

function makeSolverState(level) {
  return {
    x: level.start.x,
    y: level.start.y,
    radius: 13,
    collected: new Set(),
    painted: new Set(),
    switches: new Set(),
    sequenceIndex: 0,
    rotations: new Map((level.rotators || []).map((rotator) => [rotator.id, 0])),
    phases: new Map((level.phases || []).map((phase) => [phase.id, phase.initial || 0])),
  };
}

function cloneSolverState(state) {
  return {
    ...state,
    collected: new Set(state.collected),
    painted: new Set(state.painted),
    switches: new Set(state.switches),
    rotations: new Map(state.rotations),
    phases: new Map(state.phases),
  };
}

function solverStateKey(state) {
  const setKey = (values) => [...values].sort().join(',');
  const mapKey = (values) => [...values].sort(([left], [right]) => left.localeCompare(right))
    .map(([id, value]) => `${id}:${value}`)
    .join(',');
  return [
    Math.round(state.x),
    Math.round(state.y),
    state.radius,
    state.sequenceIndex,
    setKey(state.collected),
    setKey(state.painted),
    setKey(state.switches),
    mapKey(state.rotations),
    mapKey(state.phases),
  ].join('|');
}

function floodState(level, state, cache) {
  const setKey = (values) => [...values].sort().join(',');
  const mapKey = (values) => [...values].sort(([left], [right]) => left.localeCompare(right))
    .map(([id, value]) => `${id}:${value}`)
    .join(',');
  const geometryKey = [
    Math.round(state.x),
    Math.round(state.y),
    state.radius,
    setKey(state.switches),
    mapKey(state.rotations),
    mapKey(state.phases),
  ].join('|');
  if (cache.has(geometryKey)) return cache.get(geometryKey);

  const step = 6;
  const columns = 60;
  const rows = 107;
  const activeGates = (level.gates || []).filter((gate) => {
    const ids = gate.switchIds || [gate.switchId];
    return !ids.every((id) => state.switches.has(id));
  });
  const walls = [
    ...level.walls,
    ...activeGates,
    ...(level.sizeGates || []).filter((gate) => state.radius > gate.maxRadius),
    ...(level.rotators || []).flatMap((rotator) => (
      getRotatorWalls(rotator, state.rotations.get(rotator.id) || 0)
    )),
    ...(level.phases || []).flatMap((phase) => (
      getPhaseWalls(phase, state.phases.get(phase.id) || 0)
    )),
  ];
  const seen = new Uint8Array(columns * rows);
  const queue = [];
  const push = (x, y) => {
    const column = Math.round(x / step);
    const row = Math.round(y / step);
    if (column < 0 || column >= columns || row < 0 || row >= rows) return;
    const index = row * columns + column;
    if (seen[index]) return;
    const player = { x: column * step, y: row * step, radius: state.radius };
    if (walls.some((wall) => circleRectCollision(player, wall))) return;
    seen[index] = 1;
    queue.push([column, row]);
  };
  push(state.x, state.y);
  for (let index = 0; index < queue.length; index += 1) {
    const [column, row] = queue[index];
    const x = column * step;
    const y = row * step;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      push(x + dx * step, y + dy * step);
    }
    for (const portal of level.portals || []) {
      if (Math.hypot(x - portal.x, y - portal.y) > state.radius + portal.r) continue;
      const pair = level.portals.find((entry) => entry.id === portal.pairId);
      if (pair) push(pair.x, pair.y);
    }
  }
  const result = (target) => queue.some(([column, row]) => (
    Math.hypot(column * step - target.x, row * step - target.y) <=
    state.radius + (target.r || 12)
  ));
  cache.set(geometryKey, result);
  return result;
}

function solveLevel(level) {
  const allItemIds = new Set((level.items || []).map((item) => item.id));
  const queue = [makeSolverState(level)];
  const seen = new Set();
  const reachableItems = new Set();
  const floodCache = new Map();
  let reachedGoal = false;
  let reachedGoalWithAllItems = false;

  for (let queueIndex = 0; queueIndex < queue.length && seen.size < 20000; queueIndex += 1) {
    const state = queue[queueIndex];
    const key = solverStateKey(state);
    if (seen.has(key)) continue;
    seen.add(key);
    const isReachable = floodState(level, state, floodCache);

    for (const item of level.items || []) {
      if (
        state.collected.has(item.id) ||
        !isItemAvailable(item, state) ||
        !isReachable(item)
      ) continue;
      reachableItems.add(item.id);
      const next = cloneSolverState(state);
      next.x = item.x;
      next.y = item.y;
      next.collected.add(item.id);
      if (item.type === 'potion') next.radius = 7;
      if (item.type === 'cookie') next.radius = 17;
      queue.push(next);
    }

    if (state.collected.has('red-paint')) {
      for (const paintable of level.paintables || []) {
        if (state.painted.has(paintable.id) || !isReachable(paintable)) continue;
        const next = cloneSolverState(state);
        next.x = paintable.x;
        next.y = paintable.y;
        next.painted.add(paintable.id);
        queue.push(next);
      }
    }

    for (const trigger of level.switches || []) {
      if (!isReachable(trigger)) continue;
      if (trigger.minRadius && state.radius < trigger.minRadius) continue;
      if (trigger.maxRadius && state.radius > trigger.maxRadius) continue;
      if ((trigger.requiresItems || []).some((id) => !state.collected.has(id))) continue;
      if (
        level.switchSequence?.length &&
        state.sequenceIndex < level.switchSequence.length &&
        trigger.id !== level.switchSequence[state.sequenceIndex]
      ) continue;
      if (!canTriggerSwitch(
        trigger,
        state.switches,
        level.switchSequence,
        state.sequenceIndex,
      )) continue;

      const next = cloneSolverState(state);
      next.x = trigger.x;
      next.y = trigger.y;
      if (trigger.action === 'rotate') {
        const rotator = (level.rotators || []).find((entry) => entry.id === trigger.target);
        const current = next.rotations.get(trigger.target) || 0;
        next.rotations.set(trigger.target, (current + 1) % rotator.states);
        next.switches.add(trigger.id);
      } else if (trigger.action === 'phase') {
        const phase = (level.phases || []).find((entry) => entry.id === trigger.target);
        const current = next.phases.get(trigger.target) || 0;
        if (trigger.requiresPhase !== undefined && current !== trigger.requiresPhase) continue;
        next.phases.set(
          trigger.target,
          trigger.phaseTo ?? ((current + 1) % phase.wallsByState.length),
        );
        next.switches.add(trigger.id);
      } else {
        const result = activateSwitch(
          level.switchSequence,
          next.switches,
          next.sequenceIndex,
          trigger.id,
        );
        next.switches = result.switches;
        next.sequenceIndex = result.sequenceIndex;
      }
      queue.push(next);
    }

    const goal = {
      x: level.goal.x + level.goal.w / 2,
      y: level.goal.y + level.goal.h / 2,
      r: 14,
    };
    if (requirementsMet(level.goal.requires, state) && isReachable(goal)) {
      reachedGoal = true;
      if ([...allItemIds].every((id) => state.collected.has(id))) {
        reachedGoalWithAllItems = true;
        break;
      }
    }
  }

  return {
    reachedGoal,
    reachedGoalWithAllItems,
    reachableItems,
    visitedStates: seen.size,
  };
}

test('uses valid references throughout the chapter graph', () => {
  for (const level of levels) {
    for (const next of level.next || []) assert.ok(levelById[next], `${level.id} -> ${next}`);
    for (const choice of level.choices || []) {
      assert.ok(levelById[choice.next], `${level.id} choice -> ${choice.next}`);
      assert.equal(
        levelById[choice.next].branch,
        choice.id,
        `${level.id} choice ${choice.id} must match target branch`,
      );
    }
  }
});

test('builds sixteen-chapter playthroughs for every branch combination', () => {
  for (const earlyChoice of ['mushroom', 'tea']) {
    for (const lateChoice of ['mirror', 'croquet']) {
      const choices = {
        'caterpillar-crossroad': earlyChoice,
        'queen-garden': lateChoice,
      };
      const route = [];
      let level = levelById['rabbit-fall'];
      while (level) {
        route.push(level.id);
        if (level.ending) break;
        const choice = level.choices?.find((entry) => entry.id === choices[level.id]);
        level = levelById[choice?.next || level.next?.[0]];
      }
      assert.equal(route.length, 16, `${earlyChoice}/${lateChoice} route has the wrong length`);
      assert.ok(route.includes('white-rabbit-house'));
      assert.ok(route.includes('caucus-race'));
      assert.ok(route.includes('white-rabbit-watch'));
      assert.ok(route.includes('duchess-kitchen'));
      assert.ok(route.includes('dormouse-teapot'));
      assert.ok(route.includes('cheshire-wood'));
      assert.ok(route.includes('cheshire-shadow'));
      assert.ok(route.includes('card-procession'));
      assert.equal(route.at(-1), 'trial-of-names');
    }
  }
});

test('keeps the white rabbit size tutorial solvable at each body size', () => {
  const level = levelById['white-rabbit-house'];
  const potion = level.items.find((item) => item.id === 'house-potion');
  const fan = level.items.find((item) => item.id === 'rabbit-fan');
  const latch = level.switches.find((item) => item.id === 'tiny-latch');
  const goal = {
    x: level.goal.x + level.goal.w / 2,
    y: level.goal.y + level.goal.h / 2,
    r: 14,
  };
  assert.equal(canReach(level, {}, potion), true);
  assert.equal(canReach(level, {}, fan, {}, potion, 7), true);
  assert.equal(canReach(level, {}, latch, {}, fan, 7), true);
  assert.equal(canReach(level, {}, goal, {}, latch, 7), true);
});

test('adds Alice-themed common chapters by recombining existing mechanics', () => {
  const race = levelById['caucus-race'];
  assert.deepEqual(race.switchSequence, [
    'caucus-one',
    'caucus-two',
    'caucus-three',
    'caucus-finish',
  ]);
  assert.equal(race.zones.filter((zone) => zone.type === 'current').length, 4);
  assert.ok(race.movers.every((mover) => mover.type === 'dodo' && mover.path === 'orbit'));
  assert.ok(race.sequenceResetMessage.includes('赛点'));
  assert.ok(race.items.find((item) => item.id === 'caucus-thimble').label);
  assert.deepEqual(
    race.switches.map((trigger) => trigger.label),
    ['一号赛点', '二号赛点', '三号赛点', '终点赛点'],
  );
  assert.deepEqual(race.next, ['white-rabbit-watch']);

  const watch = levelById['white-rabbit-watch'];
  assert.equal(watch.zones.filter((zone) => zone.effect === 'time').length, 2);
  assert.deepEqual(watch.goal.requires.switches, ['clock-left', 'clock-right']);
  assert.deepEqual(watch.next, ['caterpillar-crossroad']);

  const kitchen = levelById['duchess-kitchen'];
  assert.ok(kitchen.zones.every((zone) => zone.palette === 'pepper'));
  assert.ok(kitchen.zones.every((zone) => (
    zone.disabledByItems?.includes('kitchen-fan')
  )));
  assert.equal(
    kitchen.items.find((item) => item.id === 'kitchen-fan').label,
    '厨房折扇',
  );
  assert.ok(kitchen.movers.every((mover) => mover.type === 'plate'));
  assert.deepEqual(kitchen.next, ['dormouse-teapot']);
  assert.ok(
    levelById['mushroom-forest'].next.includes(kitchen.id) &&
    levelById['mad-tea-party'].next.includes(kitchen.id),
  );

  const dormouse = levelById['dormouse-teapot'];
  assert.ok(dormouse.zones.every((zone) => zone.effect === 'time' && zone.playerDamping < 1));
  assert.deepEqual(dormouse.next, ['cheshire-wood']);

  const shadow = levelById['cheshire-shadow'];
  assert.ok(shadow.movers.some((mover) => mover.type === 'hunterCard'));
  assert.ok(shadow.items.some((item) => item.type === 'smileDecoy'));
  assert.ok(shadow.switches.some((trigger) => trigger.action === 'placeDecoy'));
  assert.deepEqual(levelById['cheshire-wood'].next, ['cheshire-shadow']);
});

test('keeps the paper-card suit sequence reachable in its required order', () => {
  const level = levelById['card-procession'];
  let start = level.start;
  for (const id of level.switchSequence) {
    const target = level.switches.find((item) => item.id === id);
    assert.equal(canReach(level, {}, target, {}, start), true, `cannot reach ${id}`);
    start = target;
  }
  const pass = level.items.find((item) => item.id === 'parade-pass');
  const goal = {
    x: level.goal.x + level.goal.w / 2,
    y: level.goal.y + level.goal.h / 2,
    r: 14,
  };
  assert.equal(canReach(level, {}, pass, {}, start), true);
  assert.equal(canReach(level, {}, goal, {}, pass), true);
});

test('builds solvable staged routes through phase-changing maps', () => {
  for (const level of levels.filter((entry) => entry.phases?.length)) {
    const phaseIds = new Set(level.phases.map((entry) => entry.id));
    for (const [id, state] of Object.entries(level.goal.requires?.phases || {})) {
      assert.ok(phaseIds.has(id), `${level.id} requires missing phase ${id}`);
      const phase = level.phases.find((entry) => entry.id === id);
      assert.ok(state >= 0 && state < phase.wallsByState.length);
    }
    let start = level.start;
    let state = level.phases[0].initial || 0;
    for (const step of level.phaseRoute || []) {
      const target = step.target === 'goal'
        ? {
            x: level.goal.x + level.goal.w / 2,
            y: level.goal.y + level.goal.h / 2,
            r: 14,
          }
        : level.switches.find((entry) => entry.id === step.target)
          || level.items.find((entry) => entry.id === step.target);
      assert.ok(target, `${level.id} phase route references ${step.target}`);
      assert.equal(state, step.phase, `${level.id} reaches ${step.target} in the wrong phase`);
      assert.equal(
        canReach(level, {}, target, { [level.phases[0].id]: state }, start),
        true,
        `${level.id} cannot reach ${step.target} in phase ${state}`,
      );
      start = target;
      if (target.action === 'phase') {
        const phase = level.phases.find((entry) => entry.id === target.target);
        state = target.phaseTo ?? ((state + 1) % phase.wallsByState.length);
      }
    }
  }
});

test('turns the looking-glass chapter into a reversible global mirror puzzle', () => {
  const level = levelById['looking-glass'];
  assert.deepEqual(level.mirrorControls, {
    invertX: true,
    releaseItem: 'orientation-lens',
  });
  assert.equal(level.zones?.some((zone) => zone.type === 'mirror') || false, false);
  const lens = level.items.find((item) => item.id === level.mirrorControls.releaseItem);
  assert.ok(lens?.releasesMirror);
  assert.ok(level.goal.requires.items.includes(lens.id));
  assert.equal(canReach(level, {}, lens), true);
  assert.deepEqual(level.goal.requires.phases, { 'mirror-depth': 0 });
  assert.equal(level.phases[0].wallsByState.length, 3);
});

test('gives every local mirror zone a playable effect', () => {
  const validEffects = new Set(['vanish', 'invertX']);
  const mirrorZones = levels.flatMap((level) => (
    (level.zones || [])
      .filter((zone) => zone.type === 'mirror')
      .map((zone) => ({ level, zone }))
  ));
  const ids = new Set();
  assert.equal(mirrorZones.length, 6);
  for (const { level, zone } of mirrorZones) {
    assert.ok(zone.id, `${level.id} has an unnamed mirror zone`);
    assert.equal(ids.has(zone.id), false, `${zone.id} is reused`);
    ids.add(zone.id);
    assert.ok(
      validEffects.has(zone.effect),
      `${level.id} ${zone.id} has no playable mirror effect`,
    );
    assert.ok(zone.enterMessage, `${level.id} ${zone.id} needs an enter message`);
    assert.ok(zone.reenterMessage, `${level.id} ${zone.id} needs a re-entry message`);
  }
  assert.equal(levelById['caterpillar-crossroad'].zones?.length || 0, 0);
  assert.deepEqual(levelById['caterpillar-crossroad'].echoReplay, {
    delay: 2000,
    historyDuration: 2500,
    captureDuration: 4000,
    assistRadius: 52,
  });
  assert.ok(
    levelById['cheshire-wood'].zones.every((zone) => zone.effect === 'vanish'),
  );
  assert.equal(levelById['trial-of-names'].zones[0].effect, 'invertX');
});

test('defines playable time zones and hunter cards for the expansion chapters', () => {
  const timeZones = levels.flatMap((level) => (
    (level.zones || [])
      .filter((zone) => zone.effect === 'time')
      .map((zone) => ({ level, zone }))
  ));
  assert.ok(timeZones.length >= 5);
  for (const { level, zone } of timeZones) {
    assert.ok(zone.id, `${level.id} has an unnamed time zone`);
    assert.equal(Number.isFinite(zone.timeScale), true, `${level.id} ${zone.id} needs a timeScale`);
    assert.notEqual(zone.timeScale, 1, `${level.id} ${zone.id} must change time`);
    assert.ok(zone.enterMessage, `${level.id} ${zone.id} needs an enter message`);
    assert.ok(zone.reenterMessage, `${level.id} ${zone.id} needs a re-entry message`);
  }

  const hunters = levels.flatMap((level) => (
    (level.movers || [])
      .filter((mover) => mover.type === 'hunterCard')
      .map((mover) => ({ level, mover }))
  ));
  assert.equal(hunters.length, 1);
  for (const { level, mover } of hunters) {
    assert.equal(Number.isFinite(mover.maxSpeed), true, `${level.id} ${mover.id} needs maxSpeed`);
    assert.ok(mover.maxSpeed > 0 && mover.maxSpeed <= 60);
  }
});

test('builds the caterpillar identity puzzle around two source-specific seals', () => {
  const level = levelById['caterpillar-crossroad'];
  const identitySwitches = level.switches.filter((trigger) => trigger.simultaneousGroup);
  assert.deepEqual(
    identitySwitches.map((trigger) => trigger.triggerSource).sort(),
    ['echo', 'player'],
  );
  assert.ok(identitySwitches.every((trigger) => trigger.simultaneousGroup === 'identity-pair'));
  assert.ok(identitySwitches.every((trigger) => trigger.r === 26));
  assert.ok(level.goal.requires.switches.every(
    (id) => identitySwitches.some((trigger) => trigger.id === id),
  ));
  for (const trigger of identitySwitches) {
    assert.equal(canReach(level, {}, trigger), true);
  }
});

test('builds three ordered cheshire fog escorts with staged card groups', () => {
  const level = levelById['cheshire-wood'];
  assert.deepEqual(level.stealthRoute, [
    'moon-lantern',
    'moon-smile',
    'sun-lantern',
    'sun-smile',
    'exit-lantern',
    'goal',
  ]);
  assert.equal(level.zones.length, 3);
  assert.equal(level.movers.length, 9);
  assert.deepEqual(level.stealthConfig.stageDurations, {
    moon: 2000,
    sun: 1600,
    exit: 1300,
  });
  assert.ok(level.stealthConfig.sightRange >= 100);
  assert.ok(
    level.items
      .filter((item) => item.type === 'smile')
      .every((item) => item.label),
  );
  assert.ok(level.zones.every((zone) => (
    zone.effect === 'vanish' &&
    zone.shape === 'ellipse' &&
    zone.pingPong &&
    zone.waypoints.length >= 3 &&
    zone.motion?.releaseResponseMultiplier > 1.8 &&
    zone.motion?.sleepSpeedMultiplier < 0.5
  )));
  const moon = level.switches.find((trigger) => trigger.id === 'moon-lantern');
  const sun = level.switches.find((trigger) => trigger.id === 'sun-lantern');
  const exit = level.switches.find((trigger) => trigger.id === 'exit-lantern');
  assert.deepEqual(sun.requiresItems, ['moon-smile']);
  assert.deepEqual(exit.requiresItems, ['sun-smile']);
  assert.ok([moon, sun, exit].every((trigger) => trigger.checkpoint));
  assert.equal(level.movers.filter((mover) => (
    mover.requiresSwitches.includes('moon-lantern')
  )).length, 3);
  assert.equal(level.movers.filter((mover) => (
    mover.requiresSwitches.includes('sun-lantern')
  )).length, 3);
  assert.equal(level.movers.filter((mover) => (
    mover.requiresSwitches.includes('exit-lantern')
  )).length, 3);
});

test('uses environment inertia as part of themed chapter design', () => {
  const sleepFog = levelById['dormouse-teapot'].zones.filter((zone) => zone.effect === 'time');
  assert.ok(sleepFog.every((zone) => (
    zone.motion?.releaseResponseMultiplier < 0.7 &&
    zone.motion?.sleepSpeedMultiplier > 1.4
  )));

  const watchZones = Object.fromEntries(
    levelById['white-rabbit-watch'].zones.map((zone) => [zone.id, zone]),
  );
  assert.ok(watchZones['slow-watch-fog'].motion.releaseResponseMultiplier < 1);
  assert.ok(watchZones['hurry-watch-fog'].motion.releaseResponseMultiplier > 1.4);

  assert.ok(levelById['cheshire-shadow'].zones.every((zone) => (
    zone.effect === 'vanish' &&
    zone.motion?.releaseResponseMultiplier > 1.8
  )));
});

test('explains noticeable motion environments with short HUD cues', () => {
  const configured = levels.flatMap((level) => [
    level.motion ? { level, source: level.motion, id: `${level.id}:weather` } : null,
    ...(level.zones || []).map((zone) => (
      zone.motion ? { level, source: zone, id: `${level.id}:${zone.id}` } : null
    )),
  ].filter(Boolean));

  assert.ok(configured.length >= 10);
  for (const { id, source } of configured) {
    assert.ok(source.motionCue, `${id} needs a player-facing motion cue`);
    assert.ok(source.motionCue.length <= 18, `${id} cue is too long for HUD`);
  }
});

test('assigns distinct visual map themes to story chapters', () => {
  const themed = [
    'white-rabbit-watch',
    'mad-tea-party',
    'duchess-kitchen',
    'dormouse-teapot',
    'cheshire-wood',
    'queen-garden',
    'looking-glass',
    'queen-croquet',
    'card-procession',
    'trial-of-names',
  ].map((id) => levelById[id].mapTheme);

  assert.ok(themed.every(Boolean));
  assert.ok(new Set(themed).size >= 7);
});

test('keeps full interaction radii outside static and dynamic walls', () => {
  for (const level of levels) {
    const points = [
      ['start', { ...level.start, r: 13 }],
      ['goal', {
        x: level.goal.x + level.goal.w / 2,
        y: level.goal.y + level.goal.h / 2,
        r: 14,
      }],
      ...(level.items || []).map((item) => [`item:${item.id}`, item]),
      ...(level.switches || []).map((item) => [`switch:${item.id}`, item]),
      ...(level.portals || []).map((item) => [`portal:${item.id}`, item]),
      ...(level.paintables || []).map((item) => [`paintable:${item.id}`, item]),
      ...(level.bumpers || []).map((item) => [`bumper:${item.id}`, item]),
    ];
    for (const [name, point] of points) {
      const player = { ...point, radius: point.r || 12 };
      assert.equal(
        level.walls.some((wall) => circleRectCollision(player, wall)),
        false,
        `${level.id} ${name} overlaps a wall`,
      );
      for (const phase of level.phases || []) {
        for (let state = 0; state < phase.wallsByState.length; state += 1) {
          assert.equal(
            getPhaseWalls(phase, state).some((wall) => circleRectCollision(player, wall)),
            false,
            `${level.id} ${name} overlaps ${phase.id} state ${state}`,
          );
        }
      }
      for (const rotator of level.rotators || []) {
        for (let turn = 0; turn < rotator.states; turn += 1) {
          assert.equal(
            getRotatorWalls(rotator, turn).some((wall) => circleRectCollision(player, wall)),
            false,
            `${level.id} ${name} overlaps ${rotator.id} turn ${turn}`,
          );
        }
      }
    }
  }
});

test('keeps static interaction targets visually separated in every branch variant', () => {
  for (const base of levels) {
    for (const { label, level } of levelVariants(base)) {
      const entities = [
        ...(level.items || []).map((item) => [`item:${item.id}`, item, 'item']),
        ...(level.switches || []).map((item) => [`switch:${item.id}`, item, 'switch']),
        ...(level.portals || []).map((item) => [`portal:${item.id}`, item, 'portal']),
        ...(level.paintables || []).map((item) => [`paintable:${item.id}`, item, 'paintable']),
        ...(level.bumpers || []).map((item) => [`bumper:${item.id}`, item, 'bumper']),
        ...(level.hazards || []).map((item) => [`hazard:${item.id}`, item, 'hazard']),
        ['start', { ...level.start, r: 13 }, 'start'],
        ['goal', {
          x: level.goal.x + level.goal.w / 2,
          y: level.goal.y + level.goal.h / 2,
          r: 14,
        }, 'goal'],
      ];
      for (let left = 0; left < entities.length; left += 1) {
        for (let right = left + 1; right < entities.length; right += 1) {
          const [leftName, leftEntity, leftKind] = entities[left];
          const [rightName, rightEntity, rightKind] = entities[right];
          const gap =
            Math.hypot(leftEntity.x - rightEntity.x, leftEntity.y - rightEntity.y) -
            visualRadius(leftEntity, leftKind) -
            visualRadius(rightEntity, rightKind);
          assert.ok(
            gap >= 8,
            `${level.id} ${label} ${leftName} overlaps ${rightName} by ${(-gap).toFixed(1)}px`,
          );
        }
      }
    }
  }
});

test('solves every chapter variant while collecting every configured item', () => {
  for (const base of levels) {
    if (base.mode === 'fall') continue;
    for (const { label, level } of levelVariants(base)) {
      const result = solveLevel(level);
      const missing = (level.items || [])
        .map((item) => item.id)
        .filter((id) => !result.reachableItems.has(id));
      assert.deepEqual(
        missing,
        [],
        `${level.id} ${label} has unreachable items after ${result.visitedStates} states`,
      );
      assert.equal(
        result.reachedGoal,
        true,
        `${level.id} ${label} cannot open its goal`,
      );
      assert.equal(
        result.reachedGoalWithAllItems,
        true,
        `${level.id} ${label} cannot collect every item and then open its goal`,
      );
    }
  }
});

test('defines a complete vertical fall route for the opening chapter', () => {
  const level = levelById['rabbit-fall'];
  assert.equal(level.mode, 'fall');
  assert.ok(level.worldHeight >= 2200);
  assert.equal(level.fallConfig.lives, 3);
  assert.equal(level.fallConfig.targetDistance, level.worldHeight);
  assert.equal(level.fallConfig.durationMs, 30000);
  assert.equal(level.parTime, level.fallConfig.durationMs);
  assert.ok(level.fallConfig.topDangerY > 0);

  const course = generateFallCourse(level.fallConfig, 42);
  assert.ok(course.platforms.length >= 16);
  assert.ok(course.platforms.some((platform) => platform.type === 'fragile'));
  assert.ok(course.platforms.some((platform) => platform.type === 'spikes'));
  assert.equal(course.platforms.some((platform) => platform.type === 'checkpoint'), false);
  assert.ok(
    course.platforms
      .filter((platform) => platform.route && platform.type !== 'goal')
      .every((platform) => platform.type === 'solid'),
  );
  assert.equal(course.items[0].id, 'cameo-rabbit-fall');
});

test('defines reachable croquet routes with valid flamingo impulses', () => {
  for (const level of levels.filter((entry) => entry.bumpers?.length)) {
    const hoops = level.switches.filter((entry) => entry.action === 'hoop');
    const bumperIds = new Set(level.bumpers.map((entry) => entry.id));
    assert.ok(hoops.length >= 3, `${level.id} needs a staged hoop route`);
    assert.equal(level.gates?.length, hoops.length, `${level.id} needs one lane gate per hoop`);
    for (const [index, bumper] of level.bumpers.entries()) {
      const target = hoops.find((entry) => entry.id === bumper.targetHoopId);
      assert.ok(target, `${level.id} ${bumper.id} needs a target hoop`);
      assert.equal(Number.isInteger(bumper.order), true, `${level.id} ${bumper.id} needs a player-facing order`);
      assert.equal(target.requiresBumper, bumper.id);
      if (index > 0) assert.deepEqual(bumper.requiresSwitches, [hoops[index - 1].id]);
      assert.ok(Number.isFinite(bumper.impulseX));
      assert.ok(Number.isFinite(bumper.impulseY));
      assert.ok(Math.hypot(bumper.impulseX, bumper.impulseY) <= 6);
      const targetDx = target.x - bumper.x;
      const targetDy = target.y - bumper.y;
      const alignment = (
        targetDx * bumper.impulseX + targetDy * bumper.impulseY
      ) / (
        Math.hypot(targetDx, targetDy) *
        Math.hypot(bumper.impulseX, bumper.impulseY)
      );
      assert.ok(alignment > 0.98, `${level.id} ${bumper.id} does not aim at its hoop`);
      const launchedBall = makeBall(bumper);
      applyBumperImpulse(launchedBall, bumper);
      let scoredWithoutSteering = false;
      for (let frame = 0; frame < 180 && !scoredWithoutSteering; frame += 1) {
        const previous = { x: launchedBall.x, y: launchedBall.y };
        updateBall(launchedBall, { x: 0, y: 0 }, level.walls, 16.667);
        scoredWithoutSteering = segmentCrossesHoop(previous, launchedBall, target);
      }
      assert.equal(
        scoredWithoutSteering,
        true,
        `${level.id} ${bumper.id} cannot score its hoop without steering`,
      );
      assert.equal(canReach(level, {}, bumper), true, `${level.id} cannot reach ${bumper.id}`);
    }
    for (const hoop of hoops) {
      assert.ok(bumperIds.has(hoop.requiresBumper));
      assert.equal(canReach(level, {}, hoop), true, `${level.id} cannot reach ${hoop.id}`);
    }
  }
});

test('carries branch-specific gifts into the shared finale', () => {
  const mushroomMirror = getPlayableLevel('trial-of-names', {
    'caterpillar-crossroad': 'mushroom',
    'queen-garden': 'mirror',
  });
  assert.ok(mushroomMirror.items.some((item) => item.id === 'caterpillar-gift'));
  assert.ok(mushroomMirror.items.some((item) => item.id === 'mirror-ribbon'));
  assert.ok(mushroomMirror.sizeGates.some((gate) => gate.id === 'mushroom-shortcut'));
  assert.equal(mushroomMirror.items.some((item) => item.id === 'tea-watch-gift'), false);

  const teaCroquet = getPlayableLevel('trial-of-names', {
    'caterpillar-crossroad': 'tea',
    'queen-garden': 'croquet',
  });
  assert.ok(teaCroquet.items.some((item) => item.id === 'tea-watch-gift'));
  assert.ok(teaCroquet.items.some((item) => item.id === 'flamingo-feather'));
  assert.equal(teaCroquet.sizeGates.length, 0);
});

test('reuses branch gifts in the new common chapters', () => {
  const kitchenMushroom = getPlayableLevel('duchess-kitchen', {
    'caterpillar-crossroad': 'mushroom',
  });
  const kitchenTea = getPlayableLevel('duchess-kitchen', {
    'caterpillar-crossroad': 'tea',
  });
  assert.ok(kitchenMushroom.items.some((item) => item.id === 'kitchen-mushroom-gift'));
  assert.ok(kitchenTea.items.some((item) => item.id === 'kitchen-watch-gift'));

  const forestMushroom = getPlayableLevel('cheshire-wood', {
    'caterpillar-crossroad': 'mushroom',
  });
  const forestTea = getPlayableLevel('cheshire-wood', {
    'caterpillar-crossroad': 'tea',
  });
  assert.ok(forestMushroom.items.some((item) => item.id === 'forest-mushroom-gift'));
  assert.ok(forestTea.items.some((item) => item.id === 'forest-watch-gift'));

  const procession = getPlayableLevel('card-procession', {
    'caterpillar-crossroad': 'tea',
    'queen-garden': 'mirror',
  });
  assert.ok(procession.items.some((item) => item.id === 'procession-watch'));
  assert.ok(procession.items.some((item) => item.id === 'procession-ribbon'));
  assert.equal(procession.items.some((item) => item.id === 'procession-feather'), false);
});

test('adds recovery checkpoints to the late challenge chapters', () => {
  for (const id of ['looking-glass', 'queen-croquet', 'trial-of-names']) {
    const level = levelById[id];
    assert.ok(
      level.items.some((item) => item.type === 'checkpoint'),
      `${id} needs a recovery checkpoint`,
    );
  }
});

test('defines reachable Alice-themed paint puzzles', () => {
  for (const level of levels.filter((entry) => entry.paintables?.length)) {
    const paintIds = new Set(level.paintables.map((entry) => entry.id));
    const required = level.goal.requires?.painted || [];
    assert.ok(
      (level.items || []).some((item) => item.type === 'paint'),
      `${level.id} needs a paint item`,
    );
    for (const id of required) {
      assert.ok(paintIds.has(id), `${level.id} requires missing paintable ${id}`);
    }
    for (const rose of level.paintables) {
      assert.equal(canReach(level, {}, rose), true, `${level.id} cannot reach ${rose.id}`);
    }
  }
});

test('defines valid ordered switches and orbit hazards', () => {
  for (const level of levels) {
    const switchIds = new Set((level.switches || []).map((entry) => entry.id));
    const itemIds = new Set((level.items || []).map((entry) => entry.id));
    for (const id of level.switchSequence || []) {
      assert.ok(switchIds.has(id), `${level.id} sequence references ${id}`);
    }
    for (const id of level.goal.requires?.switches || []) {
      assert.ok(switchIds.has(id), `${level.id} goal references missing switch ${id}`);
    }
    for (const id of level.goal.requires?.items || []) {
      assert.ok(itemIds.has(id), `${level.id} goal references missing item ${id}`);
    }
    for (const mover of level.movers || []) {
      if (mover.path !== 'orbit') continue;
      for (const key of ['centerX', 'centerY', 'radiusX', 'radiusY', 'speed']) {
        assert.equal(Number.isFinite(mover[key]), true, `${level.id} ${mover.id} has invalid ${key}`);
      }
    }
  }
});

test('gives every required item and switch a specific objective label', () => {
  for (const level of levels) {
    for (const id of level.goal.requires?.items || []) {
      const item = level.items?.find((entry) => entry.id === id);
      assert.ok(item?.label, `${level.id} ${id} needs an objective label`);
      assert.notEqual(item.label, '道具');
    }
    for (const id of level.goal.requires?.switches || []) {
      const trigger = level.switches?.find((entry) => entry.id === id);
      assert.ok(trigger?.label, `${level.id} ${id} needs an objective label`);
      assert.notEqual(trigger.label, '印章');
    }
  }
});

test('declares one-time and repeatable switches explicitly', () => {
  for (const level of levels) {
    for (const trigger of level.switches || []) {
      assert.ok(
        ['once', 'repeatable'].includes(trigger.activationMode),
        `${level.id} ${trigger.id} needs an activationMode`,
      );
      if (trigger.action === 'rotate') {
        assert.equal(
          trigger.activationMode,
          'repeatable',
          `${level.id} ${trigger.id} must remain reversible`,
        );
      }
    }
  }
  assert.equal(levelById['looking-glass'].switches[0].activationMode, 'repeatable');
  assert.ok(
    levelById['cheshire-wood'].switches.every(
      (trigger) => trigger.activationMode === 'once',
    ),
  );
});

test('allows only reviewed mover overlaps with interaction targets', () => {
  const moverRect = (mover, angle) => {
    if (mover.type === 'hunterCard') {
      return {
        x: mover.x,
        y: mover.y,
        w: mover.w,
        h: mover.h,
      };
    }
    if (mover.path === 'orbit') {
      return {
        x: mover.centerX + Math.cos(angle) * mover.radiusX - mover.w / 2,
        y: mover.centerY + Math.sin(angle) * mover.radiusY - mover.h / 2,
        w: mover.w,
        h: mover.h,
      };
    }
    const offset = Math.sin(angle) * mover.range;
    return {
      x: mover.x + (mover.axis === 'x' ? offset : 0),
      y: mover.y + (mover.axis === 'y' ? offset : 0),
      w: mover.w,
      h: mover.h,
    };
  };
  const overlapsAtAnyPoint = (mover, target) => {
    for (let index = 0; index < 720; index += 1) {
      const rect = moverRect(mover, (index / 720) * Math.PI * 2);
      if (circleRectCollision(
        { x: target.x, y: target.y, radius: target.r || 12 },
        rect,
      )) return true;
    }
    return false;
  };

  for (const base of levels) {
    for (const { label, level } of levelVariants(base)) {
      const targets = [
        ...(level.items || []),
        ...(level.switches || []),
        ...(level.portals || []),
        ...(level.paintables || []),
        ...(level.bumpers || []),
      ];
      const targetIds = new Set(targets.map((target) => target.id));
      const expected = new Set(
        (level.allowedMoverOverlaps || [])
          .filter(([, targetId]) => targetIds.has(targetId))
          .map(([moverId, targetId]) => `${moverId}:${targetId}`),
      );
      const actual = new Set();
      for (const mover of level.movers || []) {
        for (const target of targets) {
          if (overlapsAtAnyPoint(mover, target)) {
            actual.add(`${mover.id}:${target.id}`);
          }
        }
      }
      assert.deepEqual(
        [...actual].sort(),
        [...expected].sort(),
        `${level.id} ${label} has unreviewed mover overlaps`,
      );
    }
  }
});

test('gives every chapter one hidden curiosity and a target time', () => {
  for (const level of levels) {
    assert.equal(
      (level.items || []).filter((item) => item.type === 'curiosity').length,
      1,
      `${level.id} must contain exactly one curiosity`,
    );
    assert.equal(Number.isFinite(level.parTime), true, `${level.id} needs a par time`);
    assert.ok(level.parTime > 0, `${level.id} par time must be positive`);
    assert.ok(level.story?.length >= 2, `${level.id} needs a visible story introduction`);
    for (const scene of level.story) {
      assert.ok(scene.speaker && scene.text && scene.portrait, `${level.id} has an incomplete story scene`);
    }
  }
});

test('defines valid dynamic rooms with reachable controls', () => {
  for (const level of levels) {
    const rotatorIds = new Set((level.rotators || []).map((entry) => entry.id));
    for (const [id, turn] of Object.entries(level.goal.requires?.rotations || {})) {
      assert.ok(rotatorIds.has(id), `${level.id} requires missing rotator ${id}`);
      const rotator = level.rotators.find((entry) => entry.id === id);
      assert.ok(turn >= 0 && turn < rotator.states, `${level.id} requires invalid turn`);
    }
    for (const rotator of level.rotators || []) {
      const control = (level.switches || []).find(
        (entry) => entry.action === 'rotate' && entry.target === rotator.id,
      );
      assert.ok(control, `${level.id} ${rotator.id} needs a control`);
      assert.ok(rotator.states >= 2 && rotator.states <= 4);
      for (let turn = 0; turn < rotator.states; turn += 1) {
        for (const wall of getRotatorWalls(rotator, turn)) {
          assert.ok(wall.x >= 0 && wall.y >= 0);
          assert.ok(wall.x + wall.w <= 360 && wall.y + wall.h <= 640);
          assert.equal(
            circleRectCollision({ ...control, radius: control.r }, wall),
            false,
            `${level.id} ${rotator.id} traps its control at turn ${turn}`,
          );
        }
      }
    }
  }
});

test('keeps dynamic-room controls and required objectives reachable', () => {
  for (const level of levels.filter((entry) => entry.rotators?.length)) {
    for (const control of level.switches.filter((entry) => entry.action === 'rotate')) {
      assert.equal(canReach(level, {}, control), true, `${level.id} cannot reach ${control.id}`);
    }
    const requiredTurns = level.goal.requires.rotations || {};
    const objectives = [
      ...(level.items || []),
      ...level.switches.filter((entry) => entry.action !== 'rotate'),
      {
        id: 'goal',
        x: level.goal.x + level.goal.w / 2,
        y: level.goal.y + level.goal.h / 2,
        r: 14,
      },
    ];
    for (const objective of objectives) {
      assert.equal(
        canReach(level, requiredTurns, objective),
        true,
        `${level.id} cannot reach ${objective.id} in required orientation`,
      );
    }
  }
});
