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

export function makeBall(start) {
  return {
    x: start.x,
    y: start.y,
    vx: 0,
    vy: 0,
    radius: 11,
    trail: [],
  };
}

export function updateBall(ball, gravity, walls, dt) {
  const frame = Math.min(dt, 32) / 16.667;
  const accel = 0.17;
  const friction = 0.985 ** frame;
  const maxSpeed = 4.6;

  ball.vx = (ball.vx + gravity.x * accel * frame) * friction;
  ball.vy = (ball.vy + gravity.y * accel * frame) * friction;

  const speed = Math.hypot(ball.vx, ball.vy);
  if (speed > maxSpeed) {
    ball.vx = (ball.vx / speed) * maxSpeed;
    ball.vy = (ball.vy / speed) * maxSpeed;
  }

  const steps = Math.max(1, Math.ceil(speed / 2.4));
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

  ball.trail.unshift({ x: ball.x, y: ball.y });
  if (ball.trail.length > 14) ball.trail.pop();
}
