import test from 'node:test';
import assert from 'node:assert/strict';
import { circleRectCollision, getRotatorWalls } from '../src/gameEngine.js';
import { levels, levelById } from '../src/levels.js';

function canReach(level, turns, target) {
  const step = 4;
  const columns = 90;
  const rows = 160;
  const dynamicWalls = (level.rotators || []).flatMap((rotator) => (
    getRotatorWalls(rotator, turns[rotator.id] || 0)
  ));
  const walls = [...level.walls, ...dynamicWalls];
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
  push(level.start.x, level.start.y);
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
