import { useEffect, useRef } from 'react';
import { assetUrl } from './assets';
import {
  WORLD,
  circleRectCollision,
  makeBall,
  overlapsItem,
  pointInRect,
  updateBall,
} from './gameEngine';

function roundedRect(ctx, x, y, w, h, radius) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, radius);
}

function drawPaper(ctx, time, gardenImage) {
  const gradient = ctx.createRadialGradient(180, 290, 20, 180, 320, 430);
  gradient.addColorStop(0, '#23312d');
  gradient.addColorStop(0.58, '#17231f');
  gradient.addColorStop(1, '#0d1413');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, WORLD.width, WORLD.height);

  if (gardenImage?.complete) {
    ctx.save();
    ctx.globalAlpha = 0.32;
    ctx.drawImage(gardenImage, 0, 0, WORLD.width, WORLD.height);
    ctx.restore();
    ctx.fillStyle = 'rgba(8, 15, 13, .28)';
    ctx.fillRect(0, 0, WORLD.width, WORLD.height);
  }

  ctx.globalAlpha = 0.08;
  ctx.strokeStyle = '#d9cba7';
  ctx.lineWidth = 0.7;
  for (let y = 12; y < WORLD.height; y += 19) {
    ctx.beginPath();
    for (let x = 0; x <= WORLD.width; x += 12) {
      const wave = Math.sin(x * 0.06 + y + time * 0.00015) * 1.5;
      if (x === 0) ctx.moveTo(x, y + wave);
      else ctx.lineTo(x, y + wave);
    }
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  const vignette = ctx.createRadialGradient(180, 320, 170, 180, 320, 390);
  vignette.addColorStop(0, 'transparent');
  vignette.addColorStop(1, 'rgba(0,0,0,.56)');
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, WORLD.width, WORLD.height);
}

function drawZone(ctx, zone, time) {
  const pulse = Math.sin(time / 600) * 0.04;
  const gradient = ctx.createLinearGradient(zone.x, zone.y, zone.x + zone.w, zone.y + zone.h);
  gradient.addColorStop(0, `rgba(117, 166, 168, ${0.13 + pulse})`);
  gradient.addColorStop(0.5, 'rgba(214, 226, 208, .08)');
  gradient.addColorStop(1, `rgba(98, 141, 151, ${0.16 + pulse})`);
  ctx.fillStyle = gradient;
  ctx.fillRect(zone.x, zone.y, zone.w, zone.h);
  ctx.save();
  ctx.globalAlpha = 0.25;
  ctx.strokeStyle = '#b7d6d2';
  for (let y = zone.y + 16; y < zone.y + zone.h; y += 25) {
    ctx.beginPath();
    ctx.moveTo(zone.x, y);
    ctx.bezierCurveTo(
      zone.x + zone.w * 0.3,
      y + Math.sin(time / 400 + y) * 5,
      zone.x + zone.w * 0.7,
      y - 5,
      zone.x + zone.w,
      y,
    );
    ctx.stroke();
  }
  ctx.restore();
}

function drawWall(ctx, wall, index) {
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,.45)';
  ctx.shadowBlur = 7;
  ctx.shadowOffsetY = 3;
  const gradient = ctx.createLinearGradient(wall.x, wall.y, wall.x, wall.y + wall.h);
  gradient.addColorStop(0, '#405044');
  gradient.addColorStop(0.45, '#222e28');
  gradient.addColorStop(1, '#111916');
  ctx.fillStyle = gradient;
  roundedRect(ctx, wall.x, wall.y, wall.w, wall.h, 5);
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.strokeStyle = 'rgba(185, 171, 127, .28)';
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.strokeStyle = 'rgba(11, 16, 14, .8)';
  ctx.lineWidth = 1.2;
  for (let x = wall.x + 8; x < wall.x + wall.w; x += 14) {
    ctx.beginPath();
    ctx.moveTo(x, wall.y + wall.h);
    ctx.quadraticCurveTo(
      x + (index % 2 ? -4 : 4),
      wall.y + wall.h * 0.4,
      x + 2,
      wall.y,
    );
    ctx.stroke();
  }
  ctx.restore();
}

function drawDoor(ctx, goal, open, time) {
  ctx.save();
  ctx.translate(goal.x, goal.y);
  ctx.shadowColor = open ? 'rgba(211, 178, 104, .62)' : 'rgba(0, 0, 0, .65)';
  ctx.shadowBlur = open ? 18 + Math.sin(time / 180) * 4 : 8;
  ctx.fillStyle = open ? '#80693c' : '#342e27';
  ctx.strokeStyle = open ? '#e0c180' : '#78654a';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(2, goal.h);
  ctx.lineTo(2, 18);
  ctx.quadraticCurveTo(goal.w / 2, -8, goal.w - 2, 18);
  ctx.lineTo(goal.w - 2, goal.h);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = open ? '#17211d' : '#171816';
  ctx.fillRect(9, 20, goal.w - 18, goal.h - 20);
  ctx.fillStyle = '#d4b56e';
  ctx.beginPath();
  ctx.arc(goal.w - 12, goal.h * 0.58, 2, 0, Math.PI * 2);
  ctx.fill();
  if (!open) {
    ctx.strokeStyle = '#b99a5f';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(goal.w / 2, goal.h * 0.55, 5, Math.PI, 0);
    ctx.lineTo(goal.w / 2 + 5, goal.h * 0.72);
    ctx.lineTo(goal.w / 2 - 5, goal.h * 0.72);
    ctx.closePath();
    ctx.stroke();
  }
  ctx.restore();
}

function drawKey(ctx, item, time) {
  ctx.save();
  ctx.translate(item.x, item.y);
  ctx.rotate(Math.sin(time / 450) * 0.18);
  ctx.shadowColor = '#e1b85b';
  ctx.shadowBlur = 14;
  ctx.strokeStyle = '#e1c174';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(-5, 0, 6, 0, Math.PI * 2);
  ctx.moveTo(1, 0);
  ctx.lineTo(13, 0);
  ctx.lineTo(13, 5);
  ctx.moveTo(8, 0);
  ctx.lineTo(8, 4);
  ctx.stroke();
  ctx.restore();
}

function drawPotion(ctx, item, time) {
  ctx.save();
  ctx.translate(item.x, item.y + Math.sin(time / 360) * 2);
  ctx.shadowColor = '#87bec5';
  ctx.shadowBlur = 13;
  ctx.fillStyle = '#9ecbd0';
  ctx.beginPath();
  ctx.moveTo(-5, -12);
  ctx.lineTo(5, -12);
  ctx.lineTo(5, -5);
  ctx.quadraticCurveTo(13, 3, 7, 12);
  ctx.quadraticCurveTo(0, 16, -7, 12);
  ctx.quadraticCurveTo(-13, 3, -5, -5);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#3b5554';
  ctx.fillRect(-6, -15, 12, 4);
  ctx.restore();
}

function drawFragment(ctx, item, time) {
  ctx.save();
  ctx.translate(item.x, item.y);
  ctx.rotate(Math.sin(time / 700 + item.x) * 0.12);
  ctx.shadowColor = '#e8d7a3';
  ctx.shadowBlur = 12;
  ctx.fillStyle = '#d9c89d';
  ctx.strokeStyle = '#6f6045';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(-13, -10);
  ctx.lineTo(11, -12);
  ctx.lineTo(13, 9);
  ctx.lineTo(-10, 12);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#2c2a22';
  ctx.font = '10px serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(item.word, 0, 0);
  ctx.restore();
}

function drawBall(ctx, ball, time, mirrored) {
  ball.trail.forEach((point, index) => {
    const alpha = (1 - index / ball.trail.length) * 0.16;
    ctx.fillStyle = mirrored
      ? `rgba(151, 205, 211, ${alpha})`
      : `rgba(237, 216, 158, ${alpha})`;
    ctx.beginPath();
    ctx.arc(point.x, point.y, Math.max(2, ball.radius - index * 0.45), 0, Math.PI * 2);
    ctx.fill();
  });

  ctx.save();
  ctx.translate(ball.x, ball.y);
  ctx.shadowColor = mirrored ? '#a7d8d8' : '#e8d29a';
  ctx.shadowBlur = 18 + Math.sin(time / 250) * 3;
  const gradient = ctx.createRadialGradient(-4, -5, 1, 0, 0, ball.radius);
  gradient.addColorStop(0, '#fff9dd');
  gradient.addColorStop(0.28, mirrored ? '#b9e0df' : '#ead59e');
  gradient.addColorStop(0.75, mirrored ? '#5e8e91' : '#9d7d48');
  gradient.addColorStop(1, 'rgba(24, 27, 24, .45)');
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(0, 0, ball.radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 250, 220, .55)';
  ctx.lineWidth = 0.8;
  ctx.stroke();
  ctx.restore();
}

export default function GameCanvas({
  level,
  gravityRef,
  paused,
  resetToken,
  onCollect,
  onLockedDoor,
  onComplete,
}) {
  const canvasRef = useRef(null);
  const stateRef = useRef(null);
  const gardenRef = useRef(null);
  const callbacksRef = useRef({ onCollect, onLockedDoor, onComplete });
  callbacksRef.current = { onCollect, onLockedDoor, onComplete };

  useEffect(() => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.src = assetUrl('assets/art/dream-garden.jpg');
    gardenRef.current = image;
  }, []);

  useEffect(() => {
    stateRef.current = {
      ball: makeBall(level.start),
      collected: new Set(),
      complete: false,
      lockedCooldown: 0,
      startedAt: performance.now(),
    };
  }, [level, resetToken]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    let animationFrame;
    let previous = performance.now();

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = WORLD.width * dpr;
      canvas.height = WORLD.height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);

    const frame = (time) => {
      const state = stateRef.current;
      const dt = time - previous;
      previous = time;

      if (state && !paused && !state.complete) {
        const mirrored = (level.zones || []).some(
          (zone) => zone.type === 'mirror' && pointInRect(state.ball, zone),
        );
        const gravity = gravityRef.current || { x: 0, y: 0 };
        updateBall(
          state.ball,
          { x: mirrored ? -gravity.x : gravity.x, y: gravity.y },
          level.walls,
          dt,
        );

        for (const item of level.items || []) {
          if (!state.collected.has(item.id) && overlapsItem(state.ball, item)) {
            state.collected.add(item.id);
            if (item.type === 'potion') state.ball.radius = 6;
            callbacksRef.current.onCollect(item);
          }
        }

        const collectedFragments = [...state.collected].filter((id) =>
          id.startsWith('fragment-'),
        ).length;
        const hasRequirement =
          !level.goal.requires ||
          (level.goal.requires === 'key' && state.collected.has('key')) ||
          (level.goal.requires === 'fragments' && collectedFragments === 3);

        if (circleRectCollision(state.ball, level.goal)) {
          if (hasRequirement) {
            state.complete = true;
            callbacksRef.current.onComplete(time - state.startedAt);
          } else if (time > state.lockedCooldown) {
            state.lockedCooldown = time + 1200;
            state.ball.vx *= -0.55;
            state.ball.vy *= -0.55;
            callbacksRef.current.onLockedDoor();
          }
        }
      }

      drawPaper(ctx, time, gardenRef.current);
      (level.zones || []).forEach((zone) => drawZone(ctx, zone, time));
      level.walls.forEach((wall, index) => drawWall(ctx, wall, index));

      if (state) {
        const fragmentCount = [...state.collected].filter((id) =>
          id.startsWith('fragment-'),
        ).length;
        const open =
          !level.goal.requires ||
          state.collected.has('key') ||
          (level.goal.requires === 'fragments' && fragmentCount === 3);
        drawDoor(ctx, level.goal, open, time);
        for (const item of level.items || []) {
          if (state.collected.has(item.id)) continue;
          if (item.type === 'key') drawKey(ctx, item, time);
          if (item.type === 'potion') drawPotion(ctx, item, time);
          if (item.type === 'fragment') drawFragment(ctx, item, time);
        }
        const mirrored = (level.zones || []).some(
          (zone) => zone.type === 'mirror' && pointInRect(state.ball, zone),
        );
        drawBall(ctx, state.ball, time, mirrored);
      }

      animationFrame = requestAnimationFrame(frame);
    };
    animationFrame = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(animationFrame);
      window.removeEventListener('resize', resize);
    };
  }, [gravityRef, level, paused, resetToken]);

  return <canvas ref={canvasRef} className="game-canvas" aria-label={`${level.name}迷宫`} />;
}
