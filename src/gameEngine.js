export const WORLD = { width: 360, height: 640 };

export function circleRectCollision(ball, rect) {
  const nearestX = Math.max(rect.x, Math.min(ball.x, rect.x + rect.w));
  const nearestY = Math.max(rect.y, Math.min(ball.y, rect.y + rect.h));
  const dx = ball.x - nearestX;
  const dy = ball.y - nearestY;
  return dx * dx + dy * dy < ball.radius * ball.radius;
}

export function pointInRect(point, rect) {
  return (
    point.x >= rect.x &&
    point.x <= rect.x + rect.w &&
    point.y >= rect.y &&
    point.y <= rect.y + rect.h
  );
}

export function overlapsItem(ball, item) {
  const dx = ball.x - item.x;
  const dy = ball.y - item.y;
  return dx * dx + dy * dy < (ball.radius + item.r) ** 2;
}

export function segmentCrossesHoop(from, to, hoop) {
  const halfSpan = hoop.aperture ?? hoop.r * 0.72;
  if (hoop.orientation === 'horizontal') {
    const delta = to.y - from.y;
    if (!delta || (from.y - hoop.y) * (to.y - hoop.y) > 0) return false;
    if (hoop.direction && Math.sign(delta) !== hoop.direction) return false;
    const ratio = (hoop.y - from.y) / delta;
    const crossingX = from.x + (to.x - from.x) * ratio;
    return Math.abs(crossingX - hoop.x) <= halfSpan;
  }
  const delta = to.x - from.x;
  if (!delta || (from.x - hoop.x) * (to.x - hoop.x) > 0) return false;
  if (hoop.direction && Math.sign(delta) !== hoop.direction) return false;
  const ratio = (hoop.x - from.x) / delta;
  const crossingY = from.y + (to.y - from.y) * ratio;
  return Math.abs(crossingY - hoop.y) <= halfSpan;
}

export function isItemAvailable(item, state) {
  const phaseReady = Object.entries(item.requiresPhases || {}).every(
    ([id, phase]) => (state.phases?.get(id) || 0) === phase,
  );
  const switchReady = (item.requiresSwitches || []).every((id) => state.switches.has(id));
  return phaseReady && switchReady;
}

export function isMirrorControlActive(config, state) {
  if (!config?.invertX) return false;
  return !config.releaseItem || !state.collected?.has(config.releaseItem);
}

export function transformControlInput(input, mirrorConfig, state) {
  return {
    ...input,
    x: input.x * (isMirrorControlActive(mirrorConfig, state) ? -1 : 1),
  };
}

export function makeBall(start) {
  return {
    x: start.x,
    y: start.y,
    vx: 0,
    vy: 0,
    radius: 13,
    baseRadius: 13,
    trail: [],
    spin: 0,
  };
}

export function updateBall(ball, gravity, walls, dt, options = {}) {
  const frame = Math.min(dt, 32) / 16.667;
  const accel = options.accel ?? 0.17;
  const friction = (options.friction ?? 0.985) ** frame;
  const maxSpeed = options.maxSpeed ?? 4.8;

  ball.vx = (ball.vx + gravity.x * accel * frame) * friction;
  ball.vy = (ball.vy + gravity.y * accel * frame) * friction;

  const speed = Math.hypot(ball.vx, ball.vy);
  if (speed > maxSpeed) {
    ball.vx = (ball.vx / speed) * maxSpeed;
    ball.vy = (ball.vy / speed) * maxSpeed;
  }

  const steps = Math.max(1, Math.ceil(speed / 2.4));
  const startX = ball.x;
  const startY = ball.y;
  for (let i = 0; i < steps; i += 1) {
    const nextX = ball.x + (ball.vx * frame) / steps;
    const testX = { ...ball, x: nextX };
    if (walls.some((wall) => circleRectCollision(testX, wall))) {
      ball.vx *= -0.28;
    } else {
      ball.x = nextX;
    }

    const nextY = ball.y + (ball.vy * frame) / steps;
    const testY = { ...ball, y: nextY };
    if (walls.some((wall) => circleRectCollision(testY, wall))) {
      ball.vy *= -0.28;
    } else {
      ball.y = nextY;
    }
  }

  const distance = Math.hypot(ball.x - startX, ball.y - startY);
  const spinDirection = Math.abs(ball.vx) > Math.abs(ball.vy)
    ? Math.sign(ball.vx)
    : Math.sign(ball.vy);
  ball.spin += (distance / Math.max(1, ball.radius)) * spinDirection;
  ball.trail.unshift({ x: ball.x, y: ball.y });
  if (ball.trail.length > 14) ball.trail.pop();
}

export function resetBall(ball, point) {
  ball.x = point.x;
  ball.y = point.y;
  ball.vx = 0;
  ball.vy = 0;
  ball.trail = [];
  ball.spin = 0;
}

export function applyBumperImpulse(ball, bumper) {
  ball.vx = bumper.impulseX;
  ball.vy = bumper.impulseY;
  return Math.hypot(ball.vx, ball.vy);
}

export function isBumperEnabled(bumper, switches) {
  return (bumper.requiresSwitches || []).every((id) => switches.has(id));
}

export function canScoreLinkedHoop(trigger, lastBumperId, linkUntil, time) {
  if (!trigger.requiresBumper) return true;
  return trigger.requiresBumper === lastBumperId && time <= linkUntil;
}

export function getMoverRect(mover, time) {
  if (mover.path === 'orbit') {
    const angle = time * mover.speed + (mover.phase || 0);
    return {
      ...mover,
      angle,
      x: mover.centerX + Math.cos(angle) * mover.radiusX - mover.w / 2,
      y: mover.centerY + Math.sin(angle) * mover.radiusY - mover.h / 2,
    };
  }
  const offset = Math.sin(time * mover.speed + (mover.phase || 0)) * mover.range;
  return {
    ...mover,
    x: mover.x + (mover.axis === 'x' ? offset : 0),
    y: mover.y + (mover.axis === 'y' ? offset : 0),
  };
}

export function rotateRect(rect, centerX, centerY, quarterTurns) {
  const turns = ((quarterTurns % 4) + 4) % 4;
  let result = { ...rect };
  for (let turn = 0; turn < turns; turn += 1) {
    const rectCenterX = result.x + result.w / 2;
    const rectCenterY = result.y + result.h / 2;
    const rotatedCenterX = centerX - (rectCenterY - centerY);
    const rotatedCenterY = centerY + (rectCenterX - centerX);
    result = {
      ...result,
      x: rotatedCenterX - result.h / 2,
      y: rotatedCenterY - result.w / 2,
      w: result.h,
      h: result.w,
    };
  }
  return result;
}

export function getRotatorWalls(rotator, quarterTurns = 0) {
  return rotator.walls.map((wall, index) => ({
    ...rotateRect(wall, rotator.centerX, rotator.centerY, quarterTurns),
    id: `${rotator.id}-wall-${index}`,
    rotatorId: rotator.id,
  }));
}

export function getPhaseWalls(phase, state = 0) {
  return (phase.wallsByState[state] || []).map((wall, index) => ({
    ...wall,
    id: `${phase.id}-wall-${state}-${index}`,
    phaseId: phase.id,
    phaseState: state,
  }));
}

export function requirementsMet(requirements, state) {
  if (!requirements) return true;
  const itemReady = (requirements.items || []).every((id) => state.collected.has(id));
  const switchReady = (requirements.switches || []).every((id) => state.switches.has(id));
  const rotationReady = Object.entries(requirements.rotations || {}).every(
    ([id, turn]) => (state.rotations?.get(id) || 0) === turn,
  );
  const phaseReady = Object.entries(requirements.phases || {}).every(
    ([id, phase]) => (state.phases?.get(id) || 0) === phase,
  );
  const paintedReady = (requirements.painted || []).every(
    (id) => state.painted?.has(id),
  );
  const fragmentReady =
    !requirements.fragments ||
    [...state.collected].filter((id) => id.startsWith('name-')).length >= requirements.fragments;
  return itemReady && switchReady && rotationReady && phaseReady && paintedReady && fragmentReady;
}

export function activateSwitch(sequence, switches, sequenceIndex, triggerId) {
  const nextSwitches = new Set(switches);
  if (!sequence?.length) {
    nextSwitches.add(triggerId);
    return { switches: nextSwitches, sequenceIndex, status: 'activated' };
  }

  if (triggerId !== sequence[sequenceIndex]) {
    sequence.forEach((id) => nextSwitches.delete(id));
    return { switches: nextSwitches, sequenceIndex: 0, status: 'reset' };
  }

  nextSwitches.add(triggerId);
  const nextIndex = sequenceIndex + 1;
  return {
    switches: nextSwitches,
    sequenceIndex: nextIndex,
    status: nextIndex === sequence.length ? 'complete' : 'correct',
  };
}
