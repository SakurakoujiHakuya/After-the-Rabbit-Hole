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

export function pointInEllipse(point, ellipse, margin = 0) {
  const centerX = ellipse.centerX ?? ellipse.x + ellipse.w / 2;
  const centerY = ellipse.centerY ?? ellipse.y + ellipse.h / 2;
  const radiusX = Math.max(1, ellipse.w / 2 + margin);
  const radiusY = Math.max(1, ellipse.h / 2 + margin);
  return (
    ((point.x - centerX) / radiusX) ** 2 +
    ((point.y - centerY) / radiusY) ** 2
  ) <= 1;
}

export function overlapsItem(ball, item) {
  const dx = ball.x - item.x;
  const dy = ball.y - item.y;
  return dx * dx + dy * dy < (ball.radius + item.r) ** 2;
}

export function isTriggerOccupied(trigger, player, echoPosition) {
  if (trigger.triggerSource === 'echo') {
    return Boolean(
      echoPosition &&
      overlapsItem({ ...echoPosition, radius: player.radius }, trigger),
    );
  }
  return overlapsItem(player, trigger);
}

export function isSimultaneousGroupOccupied(triggers, player, echoPosition) {
  return triggers.every((trigger) => (
    isTriggerOccupied(trigger, player, echoPosition)
  ));
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

export function updateMirrorZoneMembership(
  point,
  zones,
  activeIds = new Set(),
  margin = 4,
) {
  const nextIds = new Set();
  for (const zone of zones || []) {
    if (zone.type !== 'mirror') continue;
    const wasActive = activeIds.has(zone.id);
    if (zone.shape === 'ellipse') {
      if (pointInEllipse(point, zone, wasActive ? margin : -margin)) {
        nextIds.add(zone.id);
      }
      continue;
    }
    const boundary = wasActive
      ? {
          x: zone.x - margin,
          y: zone.y - margin,
          w: zone.w + margin * 2,
          h: zone.h + margin * 2,
        }
      : {
          x: zone.x + margin,
          y: zone.y + margin,
          w: Math.max(0, zone.w - margin * 2),
          h: Math.max(0, zone.h - margin * 2),
        };
    if (pointInRect(point, boundary)) nextIds.add(zone.id);
  }
  return nextIds;
}

export function getActiveMirrorZones(zones, activeIds) {
  return (zones || []).filter(
    (zone) => zone.type === 'mirror' && activeIds.has(zone.id),
  );
}

export function getMirrorZoneEffects(activeZones) {
  return {
    vanish: activeZones.some((zone) => zone.effect === 'vanish'),
    invertX: activeZones.filter((zone) => zone.effect === 'invertX').length % 2 === 1,
  };
}

export function interpolatePositionHistory(history, targetTime) {
  if (!history?.length || targetTime < history[0].time) return null;
  for (let index = 1; index < history.length; index += 1) {
    const next = history[index];
    if (next.time < targetTime) continue;
    const previous = history[index - 1];
    const duration = Math.max(1, next.time - previous.time);
    const progress = Math.max(0, Math.min(1, (targetTime - previous.time) / duration));
    return {
      x: previous.x + (next.x - previous.x) * progress,
      y: previous.y + (next.y - previous.y) * progress,
    };
  }
  const last = history[history.length - 1];
  return { x: last.x, y: last.y };
}

export function getEchoReplayPosition(history, time, config) {
  if (!config) return null;
  return interpolatePositionHistory(history, time - (config.delay ?? 2000));
}

export function getMovingZoneRect(zone, elapsed = 0) {
  const points = zone.waypoints || [];
  if (points.length === 0) return { ...zone };
  if (points.length === 1) {
    return {
      ...zone,
      centerX: points[0].x,
      centerY: points[0].y,
      x: points[0].x - zone.w / 2,
      y: points[0].y - zone.h / 2,
    };
  }
  const route = zone.pingPong
    ? [...points, ...points.slice(1, -1).reverse()]
    : points;
  const speed = zone.speed ?? 42;
  const pause = zone.pause ?? 700;
  const legs = route.map((from, index) => {
    const to = route[(index + 1) % route.length];
    const moveDuration = (Math.hypot(to.x - from.x, to.y - from.y) / speed) * 1000;
    return { from, to, moveDuration, duration: moveDuration + pause };
  });
  const cycleDuration = legs.reduce((sum, leg) => sum + leg.duration, 0);
  let cursor = cycleDuration ? ((elapsed % cycleDuration) + cycleDuration) % cycleDuration : 0;
  let center = route[0];
  for (const leg of legs) {
    if (cursor <= leg.duration) {
      const progress = Math.min(1, cursor / Math.max(1, leg.moveDuration));
      center = {
        x: leg.from.x + (leg.to.x - leg.from.x) * progress,
        y: leg.from.y + (leg.to.y - leg.from.y) * progress,
      };
      break;
    }
    cursor -= leg.duration;
  }
  return {
    ...zone,
    centerX: center.x,
    centerY: center.y,
    x: center.x - zone.w / 2,
    y: center.y - zone.h / 2,
  };
}

export function isMoverActive(mover, switches) {
  const hasRequired = (mover.requiresSwitches || []).every((id) => switches.has(id));
  const hasDisabled = (mover.disabledBySwitches || []).some((id) => switches.has(id));
  return hasRequired && !hasDisabled;
}

export function updateStealthAlert(current, hidden, dt, config = {}) {
  const duration = config.alertDuration ?? 1200;
  const recoveryMultiplier = config.recoveryMultiplier ?? 2;
  const delta = dt / duration;
  return Math.max(
    0,
    Math.min(1, current + (hidden ? -delta * recoveryMultiplier : delta)),
  );
}

export function transformControlInput(
  input,
  mirrorConfig,
  state,
  activeZones = [],
) {
  const effects = getMirrorZoneEffects(activeZones);
  const invertX = isMirrorControlActive(mirrorConfig, state) !== effects.invertX;
  return {
    ...input,
    x: input.x * (invertX ? -1 : 1),
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

export function getActiveFallPlatforms(
  platforms,
  breakingPlatforms = new Map(),
  brokenPlatforms = new Set(),
  time = 0,
) {
  return (platforms || []).filter((platform) => {
    if (brokenPlatforms.has(platform.id)) return false;
    const breakingAt = breakingPlatforms.get(platform.id);
    if (breakingAt === undefined) return true;
    return time - breakingAt < (platform.breakDelay ?? 450);
  });
}

export function updateFallPlayer(player, inputX, platforms, dt, options = {}) {
  const frame = Math.min(dt, 32) / 16.667;
  const horizontalAccel = options.horizontalAccel ?? 0.28;
  const horizontalDrag = (options.horizontalDrag ?? 0.9) ** frame;
  const maxHorizontalSpeed = options.maxHorizontalSpeed ?? 4.5;
  const gravity = options.gravity ?? 0.34;
  const maxFallSpeed = options.maxFallSpeed ?? 8.5;
  const worldWidth = options.worldWidth ?? WORLD.width;
  const previous = { x: player.x, y: player.y };

  player.vx = (player.vx + inputX * horizontalAccel * frame) * horizontalDrag;
  player.vx = Math.max(-maxHorizontalSpeed, Math.min(maxHorizontalSpeed, player.vx));
  player.vy = Math.min(maxFallSpeed, player.vy + gravity * frame);

  player.x += player.vx * frame;
  if (player.x < player.radius) {
    player.x = player.radius;
    player.vx = Math.max(0, player.vx) * 0.25;
  } else if (player.x > worldWidth - player.radius) {
    player.x = worldWidth - player.radius;
    player.vx = Math.min(0, player.vx) * 0.25;
  }

  const nextY = player.y + player.vy * frame;
  let landedPlatform = null;
  if (player.vy >= 0) {
    const previousBottom = previous.y + player.radius;
    const nextBottom = nextY + player.radius;
    landedPlatform = (platforms || [])
      .filter((platform) => (
        previousBottom <= platform.y + 0.5 &&
        nextBottom >= platform.y &&
        player.x + player.radius > platform.x &&
        player.x - player.radius < platform.x + platform.w
      ))
      .sort((left, right) => left.y - right.y)[0] || null;
  }

  if (landedPlatform) {
    player.y = landedPlatform.y - player.radius;
    player.vy = 0;
    player.groundedPlatformId = landedPlatform.id;
  } else {
    player.y = nextY;
    player.groundedPlatformId = null;
  }

  const distance = Math.hypot(player.x - previous.x, player.y - previous.y);
  player.spin += (distance / Math.max(1, player.radius)) * Math.sign(player.vx || 1);
  player.trail.unshift({ x: player.x, y: player.y });
  if (player.trail.length > 14) player.trail.pop();
  return landedPlatform;
}

export function makeSeededRandom(seed = 1) {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let result = value;
    result = Math.imul(result ^ (result >>> 15), result | 1);
    result ^= result + Math.imul(result ^ (result >>> 7), result | 61);
    return ((result ^ (result >>> 14)) >>> 0) / 4294967296;
  };
}

export function getFallScrollDistance(
  elapsedMs,
  durationMs,
  targetDistance,
) {
  const progress = Math.max(0, Math.min(1, elapsedMs / durationMs));
  const easedProgress = progress * 0.55 + progress * progress * 0.45;
  return targetDistance * easedProgress;
}

export function getFallGoalY(
  elapsedMs,
  durationMs,
  viewportHeight = WORLD.height,
) {
  const leadMs = 5000;
  if (elapsedMs < durationMs - leadMs) return viewportHeight + 80;
  const progress = Math.max(
    0,
    Math.min(1, (elapsedMs - (durationMs - leadMs)) / leadMs),
  );
  return viewportHeight + 10 - progress * 150;
}

export function getFallElapsed(
  time,
  startedAt,
  pausedDuration = 0,
  pauseBeganAt = null,
) {
  const activePause = pauseBeganAt === null ? 0 : time - pauseBeganAt;
  return Math.max(0, time - startedAt - pausedDuration - activePause);
}

export function selectFallRespawnPlatform(
  platforms,
  player,
  options = {},
) {
  const topDangerY = options.topDangerY ?? 70;
  const viewportHeight = options.viewportHeight ?? WORLD.height;
  const centerY = options.centerY ?? viewportHeight * 0.46;
  const excludedIds = options.excludedIds ?? new Set();
  const safe = (platforms || []).filter((platform) => (
    platform.type === 'solid' &&
    platform.route &&
    !excludedIds.has(platform.id) &&
    platform.y > topDangerY + player.radius + 22 &&
    platform.y < viewportHeight - 44
  ));
  const distanceToPlayer = (platform) => Math.hypot(
    platform.x + platform.w / 2 - player.x,
    platform.y - player.y,
  );
  const above = safe
    .filter((platform) => platform.y < player.y - player.radius)
    .sort((left, right) => distanceToPlayer(left) - distanceToPlayer(right));
  if (above.length) return above[0];
  return safe.sort((left, right) => (
    Math.abs(left.y - centerY) - Math.abs(right.y - centerY)
  ))[0] || null;
}

export function generateFallCourse(config = {}, seed = 1) {
  const random = makeSeededRandom(seed);
  const targetDistance = config.targetDistance ?? 2400;
  const rowGapMin = config.rowGapMin ?? 112;
  const rowGapMax = config.rowGapMax ?? 142;
  const routeWidthMin = config.routeWidthMin ?? 112;
  const routeWidthMax = config.routeWidthMax ?? 152;
  const maxRouteShift = config.maxRouteShift ?? 104;
  const sideMargin = config.sideMargin ?? 18;
  const platforms = [];
  let courseY = config.startY ?? 220;
  let routeCenter = WORLD.width / 2;
  let row = 0;

  const randomBetween = (minimum, maximum) => (
    minimum + random() * (maximum - minimum)
  );
  const addRoutePlatform = (type = 'solid') => {
    const width = Math.round(randomBetween(routeWidthMin, routeWidthMax));
    const minimumCenter = sideMargin + width / 2;
    const maximumCenter = WORLD.width - sideMargin - width / 2;
    routeCenter = Math.max(
      minimumCenter,
      Math.min(
        maximumCenter,
        routeCenter + randomBetween(-maxRouteShift, maxRouteShift),
      ),
    );
    const platform = {
      id: `fall-route-${row}`,
      type,
      route: true,
      x: Math.round(routeCenter - width / 2),
      y: Math.round(courseY),
      w: width,
      h: 14,
    };
    platforms.push(platform);
    return platform;
  };

  const start = addRoutePlatform('solid');
  while (courseY < targetDistance) {
    row += 1;
    courseY += randomBetween(rowGapMin, rowGapMax);
    const route = addRoutePlatform('solid');

    if (random() < 0.72) {
      const bonusWidth = Math.round(randomBetween(72, 102));
      const leftSpace = route.x - sideMargin - 20;
      const rightSpace = WORLD.width - sideMargin - (route.x + route.w) - 20;
      const useLeft = leftSpace >= bonusWidth && (rightSpace < bonusWidth || random() < 0.5);
      const available = useLeft ? leftSpace : rightSpace;
      if (available >= bonusWidth) {
        const x = useLeft
          ? sideMargin + randomBetween(0, available - bonusWidth)
          : route.x + route.w + 20 + randomBetween(0, available - bonusWidth);
        const hazard = random() < 0.32;
        platforms.push({
          id: `fall-bonus-${row}`,
          type: hazard ? 'spikes' : 'fragile',
          route: false,
          x: Math.round(x),
          y: Math.round(courseY + randomBetween(-18, 18)),
          w: bonusWidth,
          h: 14,
          breakDelay: hazard ? undefined : 520,
        });
      }
    }
  }

  row += 1;
  courseY = targetDistance + 180;
  const goal = addRoutePlatform('goal');
  goal.w = Math.max(goal.w, 190);
  goal.x = Math.round(Math.max(sideMargin, Math.min(
    WORLD.width - sideMargin - goal.w,
    routeCenter - goal.w / 2,
  )));

  const bonusPlatforms = platforms.filter((platform) => platform.type === 'fragile');
  const cameoPlatform = bonusPlatforms.reduce((closest, platform) => (
    !closest ||
    Math.abs(platform.y - targetDistance * 0.58) <
    Math.abs(closest.y - targetDistance * 0.58)
      ? platform
      : closest
  ), null) || platforms[Math.floor(platforms.length * 0.58)];
  const items = [{
    id: 'cameo-rabbit-fall',
    type: 'curiosity',
    x: Math.round(cameoPlatform.x + cameoPlatform.w / 2),
    y: cameoPlatform.y - 22,
    r: 11,
    platformId: cameoPlatform.id,
  }];

  return { seed, start, platforms, items, goal, targetDistance };
}

export function applyFallDamage(lives, maxLives = 3) {
  if (lives > 1) {
    return { lives: lives - 1, restart: false };
  }
  return { lives: maxLives, restart: true };
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

export function canTriggerSwitch(trigger, switches, sequence, sequenceIndex = 0) {
  if (trigger.activationMode === 'repeatable') return true;
  if (sequence?.length) return sequenceIndex < sequence.length;
  return !switches.has(trigger.id);
}

export function activateSwitch(sequence, switches, sequenceIndex, triggerId) {
  const nextSwitches = new Set(switches);
  if (!sequence?.length) {
    nextSwitches.add(triggerId);
    return { switches: nextSwitches, sequenceIndex, status: 'activated' };
  }

  if (sequenceIndex >= sequence.length) {
    return { switches: nextSwitches, sequenceIndex, status: 'complete' };
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
