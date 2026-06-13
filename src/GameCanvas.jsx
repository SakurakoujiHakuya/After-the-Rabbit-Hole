import { useEffect, useRef } from 'react';
import { assetUrl } from './assets';
import {
  WORLD,
  activateSwitch,
  circleRectCollision,
  getMoverRect,
  makeBall,
  overlapsItem,
  pointInRect,
  requirementsMet,
  resetBall,
  updateBall,
} from './gameEngine';

function roundedRect(ctx, x, y, w, h, radius) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, radius);
}

function drawPaper(ctx, gardenImage) {
  const gradient = ctx.createRadialGradient(180, 290, 20, 180, 320, 430);
  gradient.addColorStop(0, '#586a82');
  gradient.addColorStop(0.55, '#33455c');
  gradient.addColorStop(1, '#182338');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, WORLD.width, WORLD.height);

  if (gardenImage?.complete) {
    ctx.save();
    ctx.globalAlpha = 0.36;
    ctx.filter = 'hue-rotate(20deg) saturate(.82) brightness(1.28)';
    ctx.drawImage(gardenImage, 0, 0, WORLD.width, WORLD.height);
    ctx.restore();
  }

  const wash = ctx.createLinearGradient(0, 0, WORLD.width, WORLD.height);
  wash.addColorStop(0, 'rgba(139, 151, 204, .16)');
  wash.addColorStop(0.5, 'rgba(241, 220, 178, .03)');
  wash.addColorStop(1, 'rgba(86, 48, 98, .2)');
  ctx.fillStyle = wash;
  ctx.fillRect(0, 0, WORLD.width, WORLD.height);

  const vignette = ctx.createRadialGradient(180, 320, 170, 180, 320, 390);
  vignette.addColorStop(0, 'transparent');
  vignette.addColorStop(1, 'rgba(4, 7, 14, .38)');
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, WORLD.width, WORLD.height);
}

function drawZone(ctx, zone, time) {
  ctx.save();
  if (zone.type === 'mirror') {
    const gradient = ctx.createLinearGradient(zone.x, zone.y, zone.x + zone.w, zone.y + zone.h);
    gradient.addColorStop(0, 'rgba(160, 187, 222, .2)');
    gradient.addColorStop(0.5, 'rgba(237, 226, 244, .1)');
    gradient.addColorStop(1, 'rgba(126, 104, 170, .22)');
    ctx.fillStyle = gradient;
    ctx.fillRect(zone.x, zone.y, zone.w, zone.h);
    ctx.strokeStyle = 'rgba(211, 220, 246, .33)';
    for (let y = zone.y + 14; y < zone.y + zone.h; y += 26) {
      ctx.beginPath();
      ctx.moveTo(zone.x, y);
      ctx.bezierCurveTo(zone.x + zone.w * 0.3, y + Math.sin(time / 350 + y) * 5, zone.x + zone.w * 0.7, y - 4, zone.x + zone.w, y);
      ctx.stroke();
    }
  } else if (zone.type === 'current') {
    ctx.fillStyle = 'rgba(73, 139, 181, .17)';
    ctx.fillRect(zone.x, zone.y, zone.w, zone.h);
    ctx.strokeStyle = 'rgba(151, 211, 232, .35)';
    ctx.lineWidth = 1.5;
    const direction = Math.sign(Math.abs(zone.forceX) > Math.abs(zone.forceY) ? zone.forceX : zone.forceY);
    for (let i = 0; i < 5; i += 1) {
      const y = zone.y + 12 + i * 14;
      const shift = ((time * 0.04 * direction + i * 38) % zone.w + zone.w) % zone.w;
      ctx.beginPath();
      ctx.moveTo(zone.x + shift, y);
      ctx.lineTo(zone.x + shift + 18 * direction, y);
      ctx.stroke();
    }
  } else if (zone.type === 'ice') {
    ctx.fillStyle = 'rgba(192, 218, 234, .16)';
    ctx.fillRect(zone.x, zone.y, zone.w, zone.h);
    ctx.strokeStyle = 'rgba(224, 238, 245, .28)';
    ctx.beginPath();
    ctx.moveTo(zone.x + 12, zone.y + zone.h - 8);
    ctx.lineTo(zone.x + zone.w * 0.42, zone.y + 8);
    ctx.lineTo(zone.x + zone.w * 0.64, zone.y + zone.h - 10);
    ctx.lineTo(zone.x + zone.w - 12, zone.y + 12);
    ctx.stroke();
  }
  ctx.restore();
}

function drawWall(ctx, wall, index) {
  ctx.save();
  ctx.shadowColor = 'rgba(3, 6, 15, .52)';
  ctx.shadowBlur = 8;
  ctx.shadowOffsetY = 3;
  const gradient = ctx.createLinearGradient(wall.x, wall.y, wall.x, wall.y + wall.h);
  gradient.addColorStop(0, '#65728a');
  gradient.addColorStop(0.25, '#3c485e');
  gradient.addColorStop(1, '#192233');
  ctx.fillStyle = gradient;
  roundedRect(ctx, wall.x, wall.y, wall.w, wall.h, 5);
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.strokeStyle = 'rgba(230, 216, 178, .34)';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.strokeStyle = 'rgba(17, 24, 39, .75)';
  for (let x = wall.x + 8; x < wall.x + wall.w; x += 14) {
    ctx.beginPath();
    ctx.moveTo(x, wall.y + wall.h);
    ctx.quadraticCurveTo(x + (index % 2 ? -4 : 4), wall.y + wall.h * 0.4, x + 2, wall.y);
    ctx.stroke();
  }
  ctx.restore();
}

function drawDoor(ctx, goal, open, time) {
  ctx.save();
  ctx.translate(goal.x, goal.y);
  ctx.shadowColor = open ? 'rgba(246, 211, 130, .72)' : 'rgba(0, 0, 0, .65)';
  ctx.shadowBlur = open ? 18 + Math.sin(time / 180) * 4 : 8;
  ctx.fillStyle = open ? '#a58955' : '#433b45';
  ctx.strokeStyle = open ? '#f2d99a' : '#8c7890';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(2, goal.h);
  ctx.lineTo(2, 18);
  ctx.quadraticCurveTo(goal.w / 2, -8, goal.w - 2, 18);
  ctx.lineTo(goal.w - 2, goal.h);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = open ? '#202b3b' : '#191923';
  ctx.fillRect(9, 20, goal.w - 18, goal.h - 20);
  ctx.fillStyle = '#f1cf80';
  ctx.beginPath();
  ctx.arc(goal.w - 12, goal.h * 0.58, 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawItem(ctx, item, time) {
  ctx.save();
  ctx.translate(item.x, item.y + Math.sin(time / 420 + item.x) * 1.5);
  ctx.shadowBlur = 14;
  if (item.type === 'key') {
    ctx.shadowColor = '#f0ca6f';
    ctx.strokeStyle = '#f0ce7c';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(-5, 0, 6, 0, Math.PI * 2);
    ctx.moveTo(1, 0);
    ctx.lineTo(13, 0);
    ctx.lineTo(13, 5);
    ctx.moveTo(8, 0);
    ctx.lineTo(8, 4);
    ctx.stroke();
  } else if (item.type === 'potion' || item.type === 'cookie') {
    ctx.shadowColor = item.type === 'potion' ? '#8ed3e4' : '#e8b87d';
    ctx.fillStyle = item.type === 'potion' ? '#91cfe0' : '#d5a46b';
    if (item.type === 'potion') {
      ctx.beginPath();
      ctx.moveTo(-5, -12);
      ctx.lineTo(5, -12);
      ctx.lineTo(5, -5);
      ctx.quadraticCurveTo(13, 3, 7, 12);
      ctx.quadraticCurveTo(0, 16, -7, 12);
      ctx.quadraticCurveTo(-13, 3, -5, -5);
      ctx.closePath();
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.arc(0, 0, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#704d3b';
      for (const [x, y] of [[-4, -3], [4, 3], [2, -6]]) {
        ctx.beginPath();
        ctx.arc(x, y, 1.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  } else if (item.type === 'fragment') {
    ctx.shadowColor = '#f3dfad';
    ctx.fillStyle = '#ead9aa';
    ctx.strokeStyle = '#7c6745';
    ctx.beginPath();
    ctx.moveTo(-13, -10);
    ctx.lineTo(11, -12);
    ctx.lineTo(13, 9);
    ctx.lineTo(-10, 12);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#342b2d';
    ctx.font = '10px serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(item.word, 0, 0);
  } else if (item.type === 'checkpoint') {
    ctx.shadowColor = '#e86872';
    ctx.fillStyle = '#c94153';
    ctx.beginPath();
    ctx.arc(0, 0, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#f0adb1';
    for (let i = 0; i < 5; i += 1) {
      ctx.rotate((Math.PI * 2) / 5);
      ctx.beginPath();
      ctx.ellipse(0, -11, 5, 8, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
  ctx.restore();
}

function drawSwitch(ctx, item, active, time) {
  ctx.save();
  ctx.translate(item.x, item.y);
  ctx.shadowColor = active ? '#f3cf80' : 'transparent';
  ctx.shadowBlur = 15;
  ctx.fillStyle = active ? '#c9a85d' : '#5e5570';
  ctx.strokeStyle = active ? '#fae1a1' : '#a89cbf';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 0, item.r, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = active ? '#fff2c6' : '#d1c6e0';
  ctx.font = `${Math.max(12, item.r)}px serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(item.minRadius ? '⚖' : active ? '✓' : item.symbol || '?', 0, 1 + Math.sin(time / 300));
  ctx.restore();
}

function drawGate(ctx, gate, open) {
  if (open) return;
  ctx.save();
  ctx.fillStyle = 'rgba(119, 85, 130, .82)';
  ctx.strokeStyle = '#dcc5df';
  ctx.shadowColor = '#a675b0';
  ctx.shadowBlur = 10;
  ctx.fillRect(gate.x, gate.y, gate.w, gate.h);
  ctx.strokeRect(gate.x, gate.y, gate.w, gate.h);
  ctx.restore();
}

function drawPortal(ctx, portal, time, image) {
  ctx.save();
  ctx.translate(portal.x, portal.y);
  if (image?.complete) {
    const pulse = 1 + Math.sin(time / 330) * 0.035;
    ctx.scale(pulse, pulse);
    ctx.shadowColor = portal.color;
    ctx.shadowBlur = 14;
    ctx.drawImage(image, -portal.r * 1.6, -portal.r * 1.6, portal.r * 3.2, portal.r * 3.2);
    ctx.restore();
    return;
  }
  ctx.strokeStyle = portal.color;
  ctx.lineWidth = 3;
  ctx.shadowColor = portal.color;
  ctx.shadowBlur = 12;
  ctx.beginPath();
  ctx.ellipse(0, 2, portal.r, portal.r * 0.62, Math.sin(time / 800) * 0.15, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(portal.r * 0.65, -2, 5, -Math.PI / 2, Math.PI / 2);
  ctx.stroke();
  ctx.restore();
}

function drawHazard(ctx, hazard, time) {
  ctx.save();
  ctx.translate(hazard.x, hazard.y);
  ctx.rotate(time / 900);
  ctx.strokeStyle = 'rgba(74, 40, 101, .8)';
  ctx.shadowColor = '#5c3378';
  ctx.shadowBlur = 14;
  for (let i = 0; i < 4; i += 1) {
    ctx.beginPath();
    ctx.arc(0, 0, hazard.r - i * 4, i * 0.7, Math.PI * 1.6 + i * 0.7);
    ctx.stroke();
  }
  ctx.restore();
}

function drawMover(ctx, mover, art) {
  ctx.save();
  ctx.translate(mover.x + mover.w / 2, mover.y + mover.h / 2);
  if (mover.type === 'watch' && art.watch?.complete) {
    const size = Math.max(38, mover.w * 1.8);
    ctx.rotate((mover.angle || 0) + Math.PI / 2);
    ctx.shadowColor = 'rgba(224, 183, 91, .65)';
    ctx.shadowBlur = 13;
    ctx.drawImage(art.watch, -size / 2, -size / 2, size, size);
    ctx.restore();
    return;
  }
  if (art.cardGuard?.complete) {
    const height = Math.max(42, mover.h * 2.7);
    const width = height;
    ctx.shadowColor = 'rgba(80, 26, 43, .58)';
    ctx.shadowBlur = 9;
    ctx.drawImage(art.cardGuard, -width / 2, -height * 0.62, width, height);
    ctx.restore();
    return;
  }
  ctx.fillStyle = '#efe2c2';
  ctx.strokeStyle = '#8d3042';
  ctx.lineWidth = 2;
  roundedRect(ctx, -mover.w / 2, -mover.h / 2, mover.w, mover.h, 3);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#9f3247';
  ctx.font = '12px serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('♥', 0, 1);
  ctx.restore();
}

function drawDecoration(ctx, decoration, art, time) {
  const image = decoration.type === 'mushroom' ? art.mushroom : art.watch;
  if (!image?.complete) return;
  ctx.save();
  ctx.globalAlpha = decoration.alpha ?? 0.5;
  ctx.translate(decoration.x, decoration.y + Math.sin(time / 900 + decoration.x) * 2);
  ctx.scale(decoration.flip ? -1 : 1, 1);
  ctx.drawImage(
    image,
    -decoration.size / 2,
    -decoration.size / 2,
    decoration.size,
    decoration.size,
  );
  ctx.restore();
}

function spawnBurst(state, x, y, color, count = 10) {
  for (let index = 0; index < count; index += 1) {
    const angle = (Math.PI * 2 * index) / count + Math.random() * 0.3;
    const speed = 0.35 + Math.random() * 0.75;
    state.particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 1,
      color,
    });
  }
}

function drawParticles(ctx, particles, dt) {
  const frame = Math.min(dt, 32) / 16.667;
  for (const particle of particles) {
    particle.x += particle.vx * frame;
    particle.y += particle.vy * frame;
    particle.vy += 0.015 * frame;
    particle.life -= 0.025 * frame;
    ctx.globalAlpha = Math.max(0, particle.life);
    ctx.fillStyle = particle.color;
    ctx.beginPath();
    ctx.arc(particle.x, particle.y, 1.2 + particle.life * 1.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  return particles.filter((particle) => particle.life > 0);
}

function drawPlayer(ctx, player, avatar, time, mirrored) {
  player.trail.forEach((point, index) => {
    const alpha = (1 - index / player.trail.length) * 0.14;
    ctx.fillStyle = mirrored ? `rgba(167, 201, 232, ${alpha})` : `rgba(243, 219, 164, ${alpha})`;
    ctx.beginPath();
    ctx.arc(point.x, point.y, Math.max(2, player.radius - index * 0.55), 0, Math.PI * 2);
    ctx.fill();
  });

  ctx.save();
  ctx.translate(player.x, player.y);
  const lean = Math.max(-0.18, Math.min(0.18, player.vx * 0.035));
  ctx.rotate(lean);
  ctx.shadowColor = mirrored ? '#a9d3ed' : '#f1d792';
  ctx.shadowBlur = 18 + Math.sin(time / 240) * 2;
  ctx.beginPath();
  ctx.arc(0, 0, player.radius, 0, Math.PI * 2);
  ctx.clip();
  if (avatar?.complete) {
    ctx.drawImage(avatar, -player.radius, -player.radius, player.radius * 2, player.radius * 2);
  } else {
    ctx.fillStyle = '#ecd79c';
    ctx.fill();
  }
  ctx.restore();

  ctx.save();
  ctx.translate(player.x, player.y);
  ctx.strokeStyle = mirrored ? '#c8e5f2' : '#f4dfad';
  ctx.lineWidth = 2;
  ctx.shadowColor = mirrored ? '#a9d3ed' : '#f1d792';
  ctx.shadowBlur = 12;
  ctx.beginPath();
  ctx.arc(0, 0, player.radius + 1, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function getActiveGates(level, switches) {
  return (level.gates || []).filter((gate) => {
    const ids = gate.switchIds || [gate.switchId];
    return !ids.every((id) => switches.has(id));
  });
}

export default function GameCanvas({
  level,
  gravityRef,
  paused,
  resetToken,
  onCollect,
  onSwitch,
  onDeath,
  onLockedDoor,
  onComplete,
}) {
  const canvasRef = useRef(null);
  const stateRef = useRef(null);
  const artRef = useRef({});
  const callbacksRef = useRef({ onCollect, onSwitch, onDeath, onLockedDoor, onComplete });
  callbacksRef.current = { onCollect, onSwitch, onDeath, onLockedDoor, onComplete };

  useEffect(() => {
    const garden = new Image();
    garden.crossOrigin = 'anonymous';
    garden.src = assetUrl('assets/art/dream-garden.jpg');
    const avatar = new Image();
    avatar.crossOrigin = 'anonymous';
    avatar.src = assetUrl('assets/art/alice-avatar.png');
    const teacup = new Image();
    teacup.crossOrigin = 'anonymous';
    teacup.src = assetUrl('assets/art/teacup-portal.png');
    const cardGuard = new Image();
    cardGuard.crossOrigin = 'anonymous';
    cardGuard.src = assetUrl('assets/art/card-guard.png');
    const mushroom = new Image();
    mushroom.crossOrigin = 'anonymous';
    mushroom.src = assetUrl('assets/art/mushroom-cluster.png');
    const watch = new Image();
    watch.crossOrigin = 'anonymous';
    watch.src = assetUrl('assets/art/pocket-watch.png');
    artRef.current = { garden, avatar, teacup, cardGuard, mushroom, watch };
  }, []);

  useEffect(() => {
    stateRef.current = {
      player: makeBall(level.start),
      collected: new Set(),
      switches: new Set(),
      checkpoint: level.start,
      complete: false,
      lockedCooldown: 0,
      portalCooldown: 0,
      deathCooldown: 0,
      touchingSwitches: new Set(),
      sequenceIndex: 0,
      particles: [],
      shakeUntil: 0,
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

    const die = (state, reason, time) => {
      if (time < state.deathCooldown) return;
      state.deathCooldown = time + 700;
      state.shakeUntil = time + 260;
      spawnBurst(state, state.player.x, state.player.y, '#d989a6', 16);
      resetBall(state.player, state.checkpoint);
      callbacksRef.current.onDeath(reason);
    };

    const frame = (time) => {
      const state = stateRef.current;
      const dt = time - previous;
      previous = time;
      const movers = (level.movers || []).map((mover) => getMoverRect(mover, time));
      const activeGates = state ? getActiveGates(level, state.switches) : [];

      if (state && !paused && !state.complete) {
        const mirrorZone = (level.zones || []).find((zone) => zone.type === 'mirror' && pointInRect(state.player, zone));
        const currentZones = (level.zones || []).filter((zone) => zone.type === 'current' && pointInRect(state.player, zone));
        const onIce = (level.zones || []).some((zone) => zone.type === 'ice' && pointInRect(state.player, zone));
        const input = gravityRef.current || { x: 0, y: 0 };
        const gravity = {
          x: (mirrorZone ? -input.x : input.x) + currentZones.reduce((sum, zone) => sum + (zone.forceX || 0), 0),
          y: input.y + currentZones.reduce((sum, zone) => sum + (zone.forceY || 0), 0),
        };
        updateBall(state.player, gravity, [...level.walls, ...activeGates], dt, {
          friction: onIce ? 0.996 : 0.982,
          maxSpeed: onIce ? 5.8 : 4.8,
        });

        for (const item of level.items || []) {
          if (state.collected.has(item.id) || !overlapsItem(state.player, item)) continue;
          state.collected.add(item.id);
          if (item.type === 'potion') state.player.radius = 7;
          if (item.type === 'cookie') state.player.radius = 17;
          if (item.type === 'checkpoint') state.checkpoint = { x: item.x, y: item.y };
          spawnBurst(state, item.x, item.y, item.type === 'potion' ? '#a9dced' : '#f1d38e', 12);
          callbacksRef.current.onCollect(item);
        }

        const touchingSwitches = new Set(
          (level.switches || [])
            .filter((trigger) => overlapsItem(state.player, trigger))
            .map((trigger) => trigger.id),
        );
        for (const trigger of level.switches || []) {
          if (!touchingSwitches.has(trigger.id) || state.touchingSwitches.has(trigger.id)) continue;
          if (trigger.minRadius && state.player.radius < trigger.minRadius) continue;
          if (!level.switchSequence && state.switches.has(trigger.id)) continue;
          const result = activateSwitch(
            level.switchSequence,
            state.switches,
            state.sequenceIndex,
            trigger.id,
          );
          state.switches = result.switches;
          state.sequenceIndex = result.sequenceIndex;
          if (result.status === 'reset') {
            state.shakeUntil = time + 120;
          } else {
            spawnBurst(state, trigger.x, trigger.y, '#f4dc9a', 12);
          }
          callbacksRef.current.onSwitch({
            ...trigger,
            sequenceStatus: result.status,
            sequenceIndex: result.sequenceIndex,
            sequenceLength: level.switchSequence?.length,
            activeIds: [...state.switches],
          });
        }
        state.touchingSwitches = touchingSwitches;

        if (time > state.portalCooldown) {
          const portal = (level.portals || []).find((entry) => overlapsItem(state.player, entry));
          if (portal) {
            const target = level.portals.find((entry) => entry.id === portal.pairId);
            if (target) {
              spawnBurst(state, state.player.x, state.player.y, portal.color, 11);
              resetBall(state.player, target);
              spawnBurst(state, target.x, target.y, target.color, 11);
              state.portalCooldown = time + 650;
            }
          }
        }

        const hazard = (level.hazards || []).find((entry) => overlapsItem(state.player, entry));
        const moverHit = movers.find((entry) => circleRectCollision(state.player, entry));
        if (hazard || moverHit) die(state, hazard ? 'hazard' : moverHit.type, time);

        if (circleRectCollision(state.player, level.goal)) {
          if (requirementsMet(level.goal.requires, state)) {
            state.complete = true;
            callbacksRef.current.onComplete(time - state.startedAt);
          } else if (time > state.lockedCooldown) {
            state.lockedCooldown = time + 1200;
            state.player.vx *= -0.55;
            state.player.vy *= -0.55;
            callbacksRef.current.onLockedDoor();
          }
        }
      }

      ctx.clearRect(0, 0, WORLD.width, WORLD.height);
      ctx.save();
      if (state && time < state.shakeUntil) {
        ctx.translate((Math.random() - 0.5) * 4, (Math.random() - 0.5) * 4);
      }
      drawPaper(ctx, artRef.current.garden);
      (level.zones || []).forEach((zone) => drawZone(ctx, zone, time));
      (level.decorations || []).forEach((decoration) => drawDecoration(ctx, decoration, artRef.current, time));
      level.walls.forEach((wall, index) => drawWall(ctx, wall, index));
      activeGates.forEach((gate) => drawGate(ctx, gate, false));
      movers.forEach((mover) => drawMover(ctx, mover, artRef.current));
      (level.hazards || []).forEach((hazard) => drawHazard(ctx, hazard, time));
      (level.portals || []).forEach((portal) => drawPortal(ctx, portal, time, artRef.current.teacup));

      if (state) {
        drawDoor(ctx, level.goal, requirementsMet(level.goal.requires, state), time);
        (level.switches || []).forEach((item) => drawSwitch(ctx, item, state.switches.has(item.id), time));
        for (const item of level.items || []) {
          if (!state.collected.has(item.id)) drawItem(ctx, item, time);
        }
        const mirrored = (level.zones || []).some((zone) => zone.type === 'mirror' && pointInRect(state.player, zone));
        drawPlayer(ctx, state.player, artRef.current.avatar, time, mirrored);
        state.particles = drawParticles(ctx, state.particles, dt);
      }
      ctx.restore();

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
