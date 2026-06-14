import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyBumperImpulse,
  circleRectCollision,
  getPhaseWalls,
  getRotatorWalls,
  makeBall,
  segmentCrossesHoop,
  updateBall,
} from '../src/gameEngine.js';
import { getPlayableLevel, levels, levelById } from '../src/levels.js';

function canReach(level, turns, target, phaseStates = {}, start = level.start) {
  const step = 4;
  const columns = 90;
  const rows = 160;
  const dynamicWalls = (level.rotators || []).flatMap((rotator) => (
    getRotatorWalls(rotator, turns[rotator.id] || 0)
  ));
  const phaseWalls = (level.phases || []).flatMap((phase) => (
    getPhaseWalls(phase, phaseStates[phase.id] ?? phase.initial ?? 0)
  ));
  const walls = [...level.walls, ...dynamicWalls, ...phaseWalls];
  const seen = new Uint8Array(columns * rows);
  const queue = [];
  const push = (x, y) => {
    const column = Math.round(x / step);
    const row = Math.round(y / step);
    if (column < 0 || column >= columns || row < 0 || row >= rows) return;
    const index = row * columns + column;
    if (seen[index]) return;
    const player = { x: column * step, y: row * step, radius: 13 };
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
    Math.hypot(column * step - target.x, row * step - target.y) <= 13 + (target.r || 12)
  ));
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
      if (target.action === 'phase') state = target.phaseTo ?? state;
    }
  }
});

test('keeps starts, goals, items, switches, and portals outside walls', () => {
  for (const level of levels) {
    const points = [
      ['start', level.start],
      ['goal', { x: level.goal.x + level.goal.w / 2, y: level.goal.y + level.goal.h / 2 }],
      ...(level.items || []).map((item) => [`item:${item.id}`, item]),
      ...(level.switches || []).map((item) => [`switch:${item.id}`, item]),
      ...(level.portals || []).map((item) => [`portal:${item.id}`, item]),
      ...(level.paintables || []).map((item) => [`paintable:${item.id}`, item]),
      ...(level.bumpers || []).map((item) => [`bumper:${item.id}`, item]),
    ];
    for (const [name, point] of points) {
      const player = { ...point, radius: 1 };
      assert.equal(
        level.walls.some((wall) => circleRectCollision(player, wall)),
        false,
        `${level.id} ${name} overlaps a wall`,
      );
    }
  }
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
    for (const id of level.switchSequence || []) {
      assert.ok(switchIds.has(id), `${level.id} sequence references ${id}`);
    }
    for (const mover of level.movers || []) {
      if (mover.path !== 'orbit') continue;
      for (const key of ['centerX', 'centerY', 'radiusX', 'radiusY', 'speed']) {
        assert.equal(Number.isFinite(mover[key]), true, `${level.id} ${mover.id} has invalid ${key}`);
      }
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
