import test from 'node:test';
import assert from 'node:assert/strict';
import { circleRectCollision } from '../src/gameEngine.js';
import { levels, levelById } from '../src/levels.js';

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
