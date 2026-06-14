import { useEffect, useRef } from 'react';
import { assetUrl } from './assets';
import {
  WORLD,
  activateSwitch,
  applyFallDamage,
  applyBumperImpulse,
  canTriggerSwitch,
  canScoreLinkedHoop,
  circleRectCollision,
  generateFallCourse,
  getFallElapsed,
  getFallGoalY,
  getFallScrollDistance,
  getEchoReplayPosition,
  getMoverRect,
  getMovingZoneRect,
  getActiveFallPlatforms,
  getActiveMirrorZones,
  getMirrorZoneEffects,
  getPhaseWalls,
  getRotatorWalls,
  isBumperEnabled,
  isItemAvailable,
  isMirrorControlActive,
  isMoverActive,
  isSimultaneousGroupOccupied,
  isTriggerOccupied,
  makeBall,
  overlapsItem,
  pointInRect,
  requirementsMet,
  resetBall,
  selectFallRespawnPlatform,
  segmentCrossesHoop,
  transformControlInput,
  updateMirrorZoneMembership,
  updateBall,
  updateFallPlayer,
  updateStealthAlert,
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
    const gradient = ctx.createLinearGradient(
      zone.x,
      zone.y,
      zone.x + zone.w,
      zone.y + zone.h,
    );
    if (zone.effect === 'echo') {
      gradient.addColorStop(0, 'rgba(116, 132, 184, .14)');
      gradient.addColorStop(0.5, 'rgba(225, 217, 239, .2)');
      gradient.addColorStop(1, 'rgba(126, 104, 170, .16)');
      ctx.fillStyle = gradient;
      ctx.fillRect(zone.x, zone.y, zone.w, zone.h);
      for (let index = 0; index < 4; index += 1) {
        const offset = 14 + index * 34 + Math.sin(time / 420 + index) * 5;
        ctx.strokeStyle = `rgba(221, 224, 245, ${0.28 - index * 0.04})`;
        ctx.strokeRect(zone.x + offset, zone.y + 10, zone.w - offset * 2, zone.h - 20);
      }
    } else if (zone.effect === 'vanish') {
      gradient.addColorStop(0, 'rgba(93, 70, 130, .1)');
      gradient.addColorStop(0.5, 'rgba(204, 189, 225, .2)');
      gradient.addColorStop(1, 'rgba(59, 91, 129, .1)');
      ctx.fillStyle = gradient;
      if (zone.shape === 'ellipse') {
        ctx.beginPath();
        ctx.ellipse(
          zone.x + zone.w / 2,
          zone.y + zone.h / 2,
          zone.w / 2,
          zone.h / 2,
          0,
          0,
          Math.PI * 2,
        );
        ctx.fill();
        ctx.strokeStyle = 'rgba(226, 215, 244, .38)';
        ctx.stroke();
      } else {
        ctx.fillRect(zone.x, zone.y, zone.w, zone.h);
      }
      ctx.strokeStyle = 'rgba(224, 215, 240, .58)';
      ctx.lineWidth = 1.6;
      const grinCount = zone.shape === 'ellipse' ? 2 : 4;
      for (let index = 0; index < grinCount; index += 1) {
        const spacing = zone.w / (grinCount + 1);
        const x = zone.x + spacing * (index + 1) + Math.sin(time / 600 + index) * 7;
        const y = zone.y + zone.h / 2 + Math.cos(time / 520 + index) * 8;
        ctx.beginPath();
        ctx.arc(x, y, 12, 0.15 * Math.PI, 0.85 * Math.PI);
        ctx.stroke();
      }
    } else if (zone.effect === 'invertX') {
      gradient.addColorStop(0, 'rgba(144, 187, 220, .22)');
      gradient.addColorStop(0.5, 'rgba(237, 226, 244, .12)');
      gradient.addColorStop(1, 'rgba(153, 107, 179, .24)');
      ctx.fillStyle = gradient;
      ctx.fillRect(zone.x, zone.y, zone.w, zone.h);
      ctx.strokeStyle = 'rgba(225, 232, 250, .52)';
      ctx.lineWidth = 1.4;
      ctx.strokeRect(zone.x + 2, zone.y + 2, zone.w - 4, zone.h - 4);
      ctx.font = '22px Georgia';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = 'rgba(235, 231, 249, .7)';
      ctx.fillText('‹', zone.x + 24, zone.y + zone.h / 2);
      ctx.fillText('›', zone.x + zone.w - 24, zone.y + zone.h / 2);
      ctx.strokeStyle = 'rgba(211, 220, 246, .35)';
      for (let y = zone.y + 18; y < zone.y + zone.h; y += 26) {
        ctx.beginPath();
        ctx.moveTo(zone.x, y);
        ctx.bezierCurveTo(
          zone.x + zone.w * 0.3,
          y + Math.sin(time / 350 + y) * 5,
          zone.x + zone.w * 0.7,
          y - 4,
          zone.x + zone.w,
          y,
        );
        ctx.stroke();
      }
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

function drawMirrorVeil(ctx, time) {
  ctx.save();
  const pulse = 0.12 + Math.sin(time / 260) * 0.025;
  const gradient = ctx.createLinearGradient(0, 0, WORLD.width, WORLD.height);
  gradient.addColorStop(0, `rgba(171, 206, 232, ${pulse})`);
  gradient.addColorStop(0.5, 'rgba(107, 82, 148, .035)');
  gradient.addColorStop(1, `rgba(223, 190, 235, ${pulse})`);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, WORLD.width, WORLD.height);
  ctx.strokeStyle = 'rgba(221, 229, 247, .28)';
  ctx.lineWidth = 1.2;
  for (let y = 54; y < WORLD.height; y += 72) {
    const wave = Math.sin(time / 420 + y) * 5;
    ctx.beginPath();
    ctx.moveTo(18, y);
    ctx.bezierCurveTo(105, y + wave, 255, y - wave, 342, y);
    ctx.stroke();
  }
  ctx.fillStyle = 'rgba(235, 226, 247, .6)';
  ctx.font = '18px Georgia';
  ctx.textAlign = 'center';
  ctx.fillText('‹', 28, 42);
  ctx.fillText('›', WORLD.width - 28, 42);
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

function drawItem(ctx, item, time, art) {
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
  } else if (item.type === 'paint') {
    ctx.shadowColor = '#cf4b5d';
    ctx.fillStyle = '#e9d8b1';
    ctx.strokeStyle = '#7c3343';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-9, -8);
    ctx.lineTo(9, -8);
    ctx.lineTo(7, 12);
    ctx.quadraticCurveTo(0, 16, -7, 12);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#b92843';
    ctx.fillRect(-9, -8, 18, 6);
    ctx.strokeStyle = '#d8b06d';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(5, -7);
    ctx.lineTo(13, -18);
    ctx.stroke();
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
  } else if (item.type === 'timepiece') {
    ctx.shadowColor = '#e6c772';
    ctx.strokeStyle = '#f0d486';
    ctx.fillStyle = '#695632';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, -7);
    ctx.moveTo(0, 0);
    ctx.lineTo(5, 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, -14, 3, Math.PI, 0);
    ctx.stroke();
  } else if (item.type === 'fan') {
    ctx.shadowColor = '#b9d9e8';
    ctx.fillStyle = '#d7e4e6';
    ctx.strokeStyle = '#7895a8';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, 12);
    ctx.quadraticCurveTo(-18, -3, -10, -12);
    ctx.quadraticCurveTo(0, -18, 10, -12);
    ctx.quadraticCurveTo(18, -3, 0, 12);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    for (const x of [-8, -4, 0, 4, 8]) {
      ctx.beginPath();
      ctx.moveTo(0, 11);
      ctx.lineTo(x, -11);
      ctx.stroke();
    }
  } else if (item.type === 'smile') {
    ctx.shadowColor = item.color || '#d7b5ef';
    ctx.shadowBlur = 18 + Math.sin(time / 220) * 3;
    ctx.strokeStyle = item.color || '#e6c5f4';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(0, -2, 13, 0.18 * Math.PI, 0.82 * Math.PI);
    ctx.stroke();
    ctx.fillStyle = '#f3e8cf';
    for (const x of [-6, 0, 6]) ctx.fillRect(x - 1.4, 7, 2.8, 4);
  } else if (item.type === 'mirrorShard') {
    ctx.shadowColor = item.color || '#b8dded';
    ctx.shadowBlur = 20 + Math.sin(time / 220) * 3;
    const gradient = ctx.createLinearGradient(-12, -14, 12, 14);
    gradient.addColorStop(0, '#f0f5f1');
    gradient.addColorStop(0.48, item.color || '#9fcce2');
    gradient.addColorStop(1, '#756b9c');
    ctx.fillStyle = gradient;
    ctx.strokeStyle = '#e9e3f0';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-5, -15);
    ctx.lineTo(11, -7);
    ctx.lineTo(7, 13);
    ctx.lineTo(-12, 7);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255, 255, 255, .66)';
    ctx.beginPath();
    ctx.moveTo(-4, -10);
    ctx.lineTo(5, 8);
    ctx.stroke();
  } else if (item.type === 'shield') {
    ctx.shadowColor = item.color || '#b9d8ed';
    ctx.fillStyle = 'rgba(180, 210, 232, .3)';
    ctx.strokeStyle = item.color || '#c7e3f1';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, -13);
    ctx.lineTo(11, -7);
    ctx.lineTo(8, 8);
    ctx.lineTo(0, 14);
    ctx.lineTo(-8, 8);
    ctx.lineTo(-11, -7);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else if (item.type === 'curiosity') {
    ctx.shadowColor = '#e7ca78';
    ctx.shadowBlur = 18 + Math.sin(time / 250) * 3;
    if (art.cameo?.complete) {
      const size = 36 + Math.sin(time / 420) * 1.5;
      ctx.drawImage(art.cameo, -size / 2, -size / 2, size, size);
    } else {
      ctx.fillStyle = '#e0c16f';
      ctx.beginPath();
      ctx.ellipse(0, 0, 8, 11, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

function drawPaintable(ctx, rose, painted, time) {
  ctx.save();
  ctx.translate(rose.x, rose.y);
  const pulse = 1 + Math.sin(time / 360 + rose.x) * 0.035;
  ctx.scale(pulse, pulse);
  ctx.shadowColor = painted ? '#d34a5e' : 'rgba(245, 235, 211, .55)';
  ctx.shadowBlur = painted ? 14 : 8;
  ctx.strokeStyle = painted ? '#7f263a' : '#b9ad9f';
  ctx.fillStyle = painted ? '#c83b53' : '#eee5d1';
  ctx.lineWidth = 1.5;
  for (let index = 0; index < 5; index += 1) {
    ctx.save();
    ctx.rotate((Math.PI * 2 * index) / 5);
    ctx.beginPath();
    ctx.ellipse(0, -rose.r * 0.48, rose.r * 0.36, rose.r * 0.55, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
  ctx.fillStyle = painted ? '#e7b05e' : '#c8b98f';
  ctx.beginPath();
  ctx.arc(0, 0, rose.r * 0.26, 0, Math.PI * 2);
  ctx.fill();
  if (!painted) {
    ctx.strokeStyle = 'rgba(201, 57, 78, .55)';
    ctx.setLineDash([2, 3]);
    ctx.beginPath();
    ctx.arc(0, 0, rose.r + 5, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

function drawSwitch(ctx, item, active, time, art) {
  ctx.save();
  ctx.translate(item.x, item.y);
  ctx.shadowColor = active ? '#f3cf80' : 'transparent';
  ctx.shadowBlur = 15;
  if (item.action === 'phase' && item.phaseStyle === 'chess' && art.chessPawn?.complete) {
    const bob = Math.sin(time / 340 + item.x) * 1.2;
    const size = item.r * 2.65;
    ctx.shadowColor = active ? '#edf0dd' : '#9aaad0';
    ctx.shadowBlur = active ? 18 : 10;
    ctx.globalAlpha = active ? 0.72 : 1;
    ctx.drawImage(art.chessPawn, -size / 2, -size / 2 + bob, size, size);
    ctx.globalAlpha = 1;
    ctx.fillStyle = active ? '#f6e3a7' : '#eef0fb';
    ctx.strokeStyle = 'rgba(27, 30, 49, .9)';
    ctx.lineWidth = 3;
    ctx.font = `bold ${Math.max(14, item.r * 0.95)}px Georgia`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.strokeText(item.glyph || '♟', 0, 2);
    ctx.fillText(item.glyph || '♟', 0, 2);
    ctx.restore();
    return;
  }
  if (item.action === 'hoop') {
    ctx.strokeStyle = active ? '#f2d68a' : '#d4c5a7';
    ctx.lineWidth = 4;
    ctx.shadowColor = active ? '#f0cf73' : 'rgba(231, 214, 179, .42)';
    ctx.shadowBlur = active ? 16 : 8;
    ctx.beginPath();
    ctx.moveTo(-item.r * 0.72, item.r * 0.75);
    ctx.lineTo(-item.r * 0.72, 0);
    ctx.quadraticCurveTo(0, -item.r * 1.12, item.r * 0.72, 0);
    ctx.lineTo(item.r * 0.72, item.r * 0.75);
    ctx.stroke();
    ctx.fillStyle = active ? '#d34d61' : '#8f4055';
    ctx.beginPath();
    ctx.moveTo(-item.r * 0.82, -item.r * 0.2);
    ctx.lineTo(item.r * 0.82, -item.r * 0.2);
    ctx.lineTo(item.r * 0.55, item.r * 0.12);
    ctx.lineTo(-item.r * 0.55, item.r * 0.12);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = active ? '#fff1c4' : '#f0dfbd';
    ctx.font = `bold ${Math.max(10, item.r * 0.62)}px Georgia`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(item.order || '', 0, -item.r * 0.02);
    ctx.restore();
    return;
  }
  if (item.triggerSource) {
    const correct = item.occupiedByCorrect;
    const wrong = item.occupiedByWrong;
    ctx.shadowColor = active
      ? '#f3cf80'
      : correct
        ? '#b9d9ef'
        : wrong
          ? '#d77b91'
          : 'rgba(161, 145, 190, .4)';
    ctx.shadowBlur = active || correct || wrong ? 15 : 7;
    ctx.fillStyle = active
      ? '#c9a85d'
      : item.triggerSource === 'echo'
        ? 'rgba(101, 126, 164, .72)'
        : 'rgba(87, 73, 105, .88)';
    ctx.strokeStyle = active
      ? '#fae1a1'
      : wrong
        ? '#e39aab'
        : item.triggerSource === 'echo'
          ? '#c5dded'
          : '#bcaed0';
    ctx.lineWidth = correct || wrong ? 3 : 2;
    if (item.triggerSource === 'echo' && !active) ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.arc(0, active ? 3 : 0, item.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = active ? '#fff2c6' : '#eee5f5';
    ctx.font = `bold ${Math.max(10, item.r * 0.52)}px serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(item.glyph || (item.triggerSource === 'echo' ? '过去' : '现在'), 0, active ? 4 : 1);
    ctx.restore();
    return;
  }
  if (item.activationMode === 'repeatable') {
    const stateCount = Math.max(2, item.stateCount || 2);
    const currentState = item.currentState || 0;
    ctx.shadowColor = '#ad9ad2';
    ctx.shadowBlur = 12;
    ctx.fillStyle = 'rgba(45, 38, 70, .92)';
    ctx.strokeStyle = '#c8b8e4';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, item.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = 'rgba(232, 219, 244, .48)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(0, 0, item.r * 0.72, 0, Math.PI * 2);
    ctx.stroke();
    for (let index = 0; index < stateCount; index += 1) {
      const angle = (index / stateCount) * Math.PI * 2 - Math.PI / 2;
      const inner = item.r * 0.8;
      const outer = item.r * 1.04;
      ctx.beginPath();
      ctx.moveTo(Math.cos(angle) * inner, Math.sin(angle) * inner);
      ctx.lineTo(Math.cos(angle) * outer, Math.sin(angle) * outer);
      ctx.stroke();
    }
    const indicatorAngle = (currentState / stateCount) * Math.PI * 2 - Math.PI / 2;
    ctx.fillStyle = '#f0d890';
    ctx.beginPath();
    ctx.arc(
      Math.cos(indicatorAngle) * item.r * 0.82,
      Math.sin(indicatorAngle) * item.r * 0.82,
      2.8,
      0,
      Math.PI * 2,
    );
    ctx.fill();
    ctx.fillStyle = '#eee4f5';
    ctx.font = `${Math.max(12, item.r * 0.9)}px serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const symbol = item.action === 'rotate'
      ? '↻'
      : item.phaseGlyphs?.[currentState] || item.glyph || '◐';
    ctx.fillText(symbol, 0, 1);
    ctx.restore();
    return;
  }
  if (active) {
    ctx.translate(0, 3);
    ctx.scale(1, 0.84);
  }
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
  const symbol = item.action === 'rotate'
    ? '↻'
    : item.action === 'phase'
      ? item.phaseGlyphs?.[item.currentPhase] || item.glyph || '♟'
    : item.minRadius ? '⚖' : active ? '✓' : item.symbol || '?';
  ctx.fillText(symbol, 0, 1 + Math.sin(time / 300));
  ctx.restore();
}

function drawCroquetLink(ctx, bumper, target, active, time) {
  if (!target) return;
  ctx.save();
  ctx.strokeStyle = active
    ? `rgba(241, 210, 139, ${0.42 + Math.sin(time / 220) * 0.12})`
    : 'rgba(177, 166, 177, .12)';
  ctx.lineWidth = active ? 2 : 1;
  ctx.setLineDash(active ? [7, 7] : [3, 9]);
  ctx.beginPath();
  ctx.moveTo(bumper.x, bumper.y);
  ctx.lineTo(target.x, target.y);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
}

function drawBumper(ctx, bumper, art, time, active) {
  ctx.save();
  ctx.translate(bumper.x, bumper.y);
  const angle = Math.atan2(bumper.impulseY, bumper.impulseX) + Math.PI / 2;
  ctx.rotate(angle + Math.sin(time / 420 + bumper.x) * 0.04);
  ctx.globalAlpha = active ? 1 : 0.3;
  if (art.flamingo?.complete) {
    const size = bumper.artSize || 58;
    const width = size * 0.67;
    ctx.shadowColor = active ? '#d36f8c' : 'transparent';
    ctx.shadowBlur = active ? 12 : 0;
    ctx.drawImage(art.flamingo, -width / 2, -size * 0.58, width, size);
  } else {
    ctx.strokeStyle = '#df8ca1';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(0, 18);
    ctx.quadraticCurveTo(-14, 2, 0, -18);
    ctx.stroke();
    ctx.fillStyle = '#e9a2b3';
    ctx.beginPath();
    ctx.arc(0, -20, 8, 0, Math.PI * 2);
    ctx.fill();
  }
  if (active) {
    ctx.rotate(-angle);
    ctx.strokeStyle = `rgba(244, 218, 158, ${0.35 + Math.sin(time / 180) * 0.16})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, bumper.r + 7 + Math.sin(time / 230) * 2, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

function drawPhaseWall(ctx, wall, time) {
  ctx.save();
  const gradient = ctx.createLinearGradient(wall.x, wall.y, wall.x + wall.w, wall.y + wall.h);
  gradient.addColorStop(0, 'rgba(211, 224, 239, .92)');
  gradient.addColorStop(0.5, 'rgba(102, 91, 132, .9)');
  gradient.addColorStop(1, 'rgba(28, 34, 55, .94)');
  ctx.fillStyle = gradient;
  ctx.strokeStyle = 'rgba(232, 224, 248, .76)';
  ctx.shadowColor = '#a8bad9';
  ctx.shadowBlur = 10 + Math.sin(time / 320) * 2;
  roundedRect(ctx, wall.x, wall.y, wall.w, wall.h, 4);
  ctx.fill();
  ctx.stroke();
  ctx.shadowColor = 'transparent';
  const tile = 16;
  for (let x = wall.x; x < wall.x + wall.w; x += tile) {
    ctx.fillStyle = ((x - wall.x) / tile) % 2
      ? 'rgba(21, 25, 42, .35)'
      : 'rgba(244, 237, 221, .22)';
    ctx.fillRect(x, wall.y, Math.min(tile, wall.x + wall.w - x), wall.h);
  }
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

function drawRotator(ctx, rotator, walls, turn, time, art) {
  ctx.save();
  ctx.translate(rotator.centerX, rotator.centerY);
  if (rotator.art === 'tea-table' && art.teaTable?.complete) {
    const size = rotator.artSize || 104;
    ctx.save();
    ctx.rotate(turn * Math.PI / 2);
    ctx.globalAlpha = 0.72;
    ctx.shadowColor = 'rgba(208, 173, 98, .38)';
    ctx.shadowBlur = 12;
    ctx.drawImage(art.teaTable, -size / 2, -size / 2, size, size);
    ctx.restore();
  }
  ctx.strokeStyle = 'rgba(231, 207, 145, .38)';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([4, 6]);
  ctx.beginPath();
  ctx.arc(0, 0, 31 + Math.sin(time / 420) * 1.5, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = 'rgba(211, 176, 101, .22)';
  ctx.beginPath();
  ctx.arc(0, 0, 18, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#e8d39c';
  ctx.font = '14px serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(turn % 2 ? '↕' : '↔', 0, 1);
  ctx.restore();
  walls.forEach((wall, index) => drawWall(ctx, wall, index + 20));
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

function drawPlayer(ctx, player, avatar, time, visualEffects) {
  const { mirrored, echo, vanish } = visualEffects;
  player.trail.forEach((point, index) => {
    const alpha = (1 - index / player.trail.length) * (vanish ? 0.08 : 0.14);
    ctx.fillStyle = mirrored ? `rgba(167, 201, 232, ${alpha})` : `rgba(243, 219, 164, ${alpha})`;
    ctx.beginPath();
    ctx.arc(point.x, point.y, Math.max(2, player.radius - index * 0.55), 0, Math.PI * 2);
    ctx.fill();
  });

  if (echo && avatar?.complete) {
    for (const [trailIndex, alpha] of [[5, 0.18], [10, 0.1]]) {
      const point = player.trail[trailIndex];
      if (!point) continue;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.arc(point.x, point.y, player.radius, 0, Math.PI * 2);
      ctx.clip();
      const avatarSize = player.radius * 2.18;
      ctx.drawImage(
        avatar,
        point.x - avatarSize / 2,
        point.y - avatarSize / 2,
        avatarSize,
        avatarSize,
      );
      ctx.restore();
    }
  }

  ctx.save();
  if (vanish) ctx.globalAlpha = 0.26;
  ctx.translate(player.x, player.y);
  const lean = Math.max(-0.18, Math.min(0.18, player.vx * 0.035));
  ctx.rotate(lean);
  ctx.shadowColor = mirrored ? '#a9d3ed' : '#f1d792';
  ctx.shadowBlur = 18 + Math.sin(time / 240) * 2;
  ctx.beginPath();
  ctx.arc(0, 0, player.radius, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = mirrored ? 'rgba(181, 219, 239, .3)' : 'rgba(250, 239, 205, .24)';
  ctx.fill();
  if (avatar?.complete) {
    const avatarSize = player.radius * 2.18;
    ctx.drawImage(avatar, -avatarSize / 2, -avatarSize / 2, avatarSize, avatarSize);
  } else {
    ctx.fillStyle = '#ecd79c';
    ctx.fill();
  }
  ctx.restore();

  ctx.save();
  ctx.translate(player.x, player.y);
  ctx.rotate(player.spin || 0);
  ctx.strokeStyle = mirrored ? '#c8e5f2' : '#f4dfad';
  ctx.lineWidth = 2;
  ctx.shadowColor = mirrored ? '#a9d3ed' : '#f1d792';
  ctx.shadowBlur = 12;
  ctx.beginPath();
  ctx.arc(0, 0, player.radius + 1, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255, 255, 255, .72)';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.arc(-player.radius * 0.18, -player.radius * 0.18, player.radius * 0.62, Math.PI * 1.05, Math.PI * 1.55);
  ctx.stroke();
  ctx.restore();

  if (vanish) {
    ctx.save();
    ctx.strokeStyle = 'rgba(239, 225, 248, .88)';
    ctx.shadowColor = '#bfa8dc';
    ctx.shadowBlur = 10;
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.arc(
      player.x,
      player.y + player.radius * 0.05,
      player.radius * 0.58,
      0.15 * Math.PI,
      0.85 * Math.PI,
    );
    ctx.stroke();
    ctx.restore();
  }
}

function drawEchoReplay(ctx, echo, avatar, time, delay) {
  if (!echo) return;
  ctx.save();
  ctx.globalAlpha = 0.34 + Math.sin(time / 220) * 0.04;
  ctx.strokeStyle = '#c8e4f2';
  ctx.fillStyle = 'rgba(144, 188, 220, .2)';
  ctx.shadowColor = '#9fcce5';
  ctx.shadowBlur = 16;
  ctx.setLineDash([3, 3]);
  ctx.beginPath();
  ctx.arc(echo.x, echo.y, 14, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.arc(echo.x, echo.y, 12.5, 0, Math.PI * 2);
  ctx.clip();
  if (avatar?.complete) {
    ctx.drawImage(avatar, echo.x - 14, echo.y - 14, 28, 28);
  }
  ctx.restore();

  ctx.save();
  ctx.fillStyle = 'rgba(224, 235, 248, .76)';
  ctx.font = '9px Georgia';
  ctx.textAlign = 'center';
  ctx.fillText(`−${(delay / 1000).toFixed(1)}s`, echo.x, echo.y - 20);
  ctx.restore();
}

function drawStealthHud(ctx, alert, hidden) {
  ctx.save();
  const centerX = 330;
  const centerY = 30;
  ctx.fillStyle = 'rgba(9, 14, 25, .72)';
  ctx.beginPath();
  ctx.arc(centerX, centerY, 21, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = hidden ? '#bfa8dc' : alert > 0.66 ? '#e07f91' : '#d8c696';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(centerX, centerY, 17, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * alert);
  ctx.stroke();
  ctx.fillStyle = hidden ? '#c7b5e4' : '#eadfbe';
  ctx.beginPath();
  ctx.ellipse(centerX, centerY, 10, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = hidden ? '#5d4776' : alert > 0.66 ? '#a52f47' : '#493b48';
  ctx.beginPath();
  ctx.arc(centerX, centerY, hidden ? 2 : 3.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawFallPlatform(ctx, platform, breakingAt, time) {
  ctx.save();
  const fragile = platform.type === 'fragile';
  const spikes = platform.type === 'spikes';
  const goal = platform.type === 'goal';
  const breaking = breakingAt !== undefined;
  if (breaking) {
    const progress = Math.min(1, (time - breakingAt) / (platform.breakDelay ?? 450));
    ctx.translate((Math.random() - 0.5) * progress * 3, 0);
    ctx.globalAlpha = 1 - progress * 0.55;
  }
  const gradient = ctx.createLinearGradient(
    platform.x,
    platform.y,
    platform.x,
    platform.y + platform.h,
  );
  gradient.addColorStop(0, goal ? '#ebd18b' : fragile ? '#b8a8c3' : '#718097');
  gradient.addColorStop(1, goal ? '#7d6538' : fragile ? '#4d425c' : '#273247');
  ctx.fillStyle = gradient;
  ctx.strokeStyle = goal ? '#f2d99a' : fragile ? '#ded0e7' : '#b2bdd0';
  ctx.lineWidth = goal ? 2 : 1;
  roundedRect(ctx, platform.x, platform.y, platform.w, platform.h, 4);
  ctx.fill();
  ctx.stroke();
  if (fragile) {
    ctx.strokeStyle = 'rgba(241, 226, 244, .68)';
    ctx.beginPath();
    ctx.moveTo(platform.x + platform.w * 0.28, platform.y + 2);
    ctx.lineTo(platform.x + platform.w * 0.42, platform.y + platform.h - 2);
    ctx.lineTo(platform.x + platform.w * 0.57, platform.y + 3);
    ctx.lineTo(platform.x + platform.w * 0.72, platform.y + platform.h - 2);
    ctx.stroke();
  }
  if (goal) {
    ctx.fillStyle = '#fff0bd';
    ctx.font = '13px Georgia';
    ctx.textAlign = 'center';
    ctx.fillText('兔子洞出口', platform.x + platform.w / 2, platform.y - 9);
  }
  if (spikes) drawFallHazard(ctx, platform);
  ctx.restore();
}

function drawFallHazard(ctx, hazard) {
  ctx.save();
  ctx.fillStyle = '#713748';
  ctx.strokeStyle = '#e0a1ad';
  ctx.shadowColor = '#a63c59';
  ctx.shadowBlur = 10;
  const spikeWidth = 12;
  for (let x = hazard.x; x < hazard.x + hazard.w; x += spikeWidth) {
    ctx.beginPath();
    ctx.moveTo(x, hazard.y + hazard.h);
    ctx.lineTo(Math.min(x + spikeWidth / 2, hazard.x + hazard.w), hazard.y);
    ctx.lineTo(Math.min(x + spikeWidth, hazard.x + hazard.w), hazard.y + hazard.h);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}

function drawFallCeiling(ctx, dangerY, time, urgency = 0) {
  ctx.save();
  const gradient = ctx.createLinearGradient(0, 0, 0, dangerY + 12);
  gradient.addColorStop(0, `rgba(120, 28, 51, ${0.96 + urgency * 0.04})`);
  gradient.addColorStop(1, 'rgba(98, 31, 54, 0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, WORLD.width, dangerY + 12);
  ctx.fillStyle = '#843a52';
  ctx.strokeStyle = '#ef9db0';
  ctx.shadowColor = '#bb4969';
  ctx.shadowBlur = 10 + urgency * 8 + Math.sin(time / 180) * (2 + urgency * 3);
  for (let x = 0; x < WORLD.width; x += 18) {
    ctx.beginPath();
    ctx.moveTo(x, dangerY - 18);
    ctx.lineTo(x + 9, dangerY);
    ctx.lineTo(x + 18, dangerY - 18);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}

function drawFallHud(ctx, lives, maxLives, remainingMs) {
  ctx.save();
  ctx.fillStyle = 'rgba(9, 14, 25, .76)';
  roundedRect(ctx, 12, 12, 112, 34, 17);
  ctx.fill();
  ctx.font = '17px serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  for (let index = 0; index < maxLives; index += 1) {
    ctx.fillStyle = index < lives ? '#d97b91' : 'rgba(225, 214, 218, .2)';
    ctx.fillText('♥', 25 + index * 27, 30);
  }
  const urgent = remainingMs <= 5000;
  const seconds = Math.max(0, Math.ceil(remainingMs / 1000));
  ctx.fillStyle = 'rgba(9, 14, 25, .76)';
  roundedRect(ctx, 260, 12, 88, 34, 17);
  ctx.fill();
  ctx.fillStyle = urgent ? '#f19aad' : '#dfd3b5';
  ctx.font = urgent ? 'bold 13px Georgia' : '12px Georgia';
  ctx.textAlign = 'center';
  ctx.fillText(`${seconds} 秒`, 304, 30);
  ctx.restore();
}

function FallGameCanvas({
  level,
  gravityRef,
  paused,
  resetToken,
  onCollect,
  onDamage,
  onDeath,
  onComplete,
}) {
  const canvasRef = useRef(null);
  const stateRef = useRef(null);
  const artRef = useRef({});
  const callbacksRef = useRef({ onCollect, onDamage, onDeath, onComplete });
  callbacksRef.current = { onCollect, onDamage, onDeath, onComplete };

  useEffect(() => {
    const garden = new Image();
    garden.crossOrigin = 'anonymous';
    garden.src = assetUrl('assets/art/dream-garden.jpg');
    const avatar = new Image();
    avatar.crossOrigin = 'anonymous';
    avatar.src = assetUrl('assets/art/alice-chibi-head.png');
    const cameo = new Image();
    cameo.crossOrigin = 'anonymous';
    cameo.src = assetUrl('assets/art/rabbit-cameo.png');
    artRef.current = { garden, avatar, cameo };
  }, []);

  useEffect(() => {
    const maxLives = level.fallConfig?.lives || 3;
    const seed = (Date.now() ^ (resetToken * 2654435761)) >>> 0;
    const course = generateFallCourse(level.fallConfig, seed);
    stateRef.current = {
      course,
      player: makeBall({
        x: course.start.x + course.start.w / 2,
        y: course.start.y - 13,
      }),
      collected: new Set(),
      lives: maxLives,
      maxLives,
      immunityUntil: 0,
      breakingPlatforms: new Map(),
      brokenPlatforms: new Set(),
      scrollDistance: 0,
      complete: false,
      particles: [],
      shakeUntil: 0,
      teleportUntil: 0,
      startedAt: performance.now(),
      pauseBeganAt: null,
      pausedDuration: 0,
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

    const screenPlatform = (platform, scrollDistance, elapsedMs) => {
      if (platform.type === 'goal') {
        const durationMs = level.fallConfig?.durationMs || 30000;
        return {
          ...platform,
          y: getFallGoalY(elapsedMs, durationMs),
        };
      }
      return {
        ...platform,
        y: platform.y - scrollDistance,
      };
    };

    const findRespawnPlatform = (state, time) => {
      const elapsedMs = getFallElapsed(
        time,
        state.startedAt,
        state.pausedDuration,
        state.pauseBeganAt,
      );
      const activePlatforms = getActiveFallPlatforms(
        state.course.platforms,
        state.breakingPlatforms,
        state.brokenPlatforms,
        time,
      ).map((platform) => screenPlatform(
        platform,
        state.scrollDistance,
        elapsedMs,
      ));
      return selectFallRespawnPlatform(activePlatforms, state.player, {
        topDangerY: level.fallConfig?.topDangerY || 70,
        excludedIds: state.brokenPlatforms,
      });
    };

    const resetRun = (state, time) => {
      const seed = ((Date.now() + Math.round(time)) ^ (resetToken * 2654435761)) >>> 0;
      state.course = generateFallCourse(level.fallConfig, seed);
      state.breakingPlatforms = new Map();
      state.brokenPlatforms = new Set();
      state.scrollDistance = 0;
      state.startedAt = time;
      state.pausedDuration = 0;
      state.pauseBeganAt = null;
      resetBall(state.player, {
        x: state.course.start.x + state.course.start.w / 2,
        y: state.course.start.y - state.player.radius,
      });
    };

    const takeDamage = (state, reason, time) => {
      if (time < state.immunityUntil) return;
      const result = applyFallDamage(state.lives, state.maxLives);
      state.lives = result.lives;
      state.shakeUntil = time + 280;
      spawnBurst(state, state.player.x, state.player.y, '#df8198', 18);
      if (result.restart) {
        resetRun(state, time);
        state.immunityUntil = time + 900;
        callbacksRef.current.onDeath(reason);
      } else {
        const respawn = findRespawnPlatform(state, time);
        if (!respawn) {
          resetRun(state, time);
          state.immunityUntil = time + (level.fallConfig?.respawnImmunity || 1200);
          callbacksRef.current.onDamage?.({
            reason,
            lives: state.lives,
            maxLives: state.maxLives,
          });
          return;
        }
        spawnBurst(state, state.player.x, state.player.y, '#d6c2ea', 12);
        resetBall(state.player, {
          x: respawn.x + respawn.w / 2,
          y: respawn.y - state.player.radius,
        });
        state.teleportUntil = time + 260;
        spawnBurst(state, state.player.x, state.player.y, '#f0dba0', 16);
        state.immunityUntil = time + (level.fallConfig?.respawnImmunity || 1200);
        callbacksRef.current.onDamage?.({
          reason,
          lives: state.lives,
          maxLives: state.maxLives,
        });
      }
    };

    const frame = (time) => {
      const state = stateRef.current;
      const dt = time - previous;
      previous = time;

      if (state && paused && state.pauseBeganAt === null) {
        state.pauseBeganAt = time;
      } else if (state && !paused && state.pauseBeganAt !== null) {
        state.pausedDuration += time - state.pauseBeganAt;
        state.pauseBeganAt = null;
      }

      if (state && !paused && !state.complete) {
        const elapsedMs = getFallElapsed(
          time,
          state.startedAt,
          state.pausedDuration,
          state.pauseBeganAt,
        );
        state.scrollDistance = getFallScrollDistance(
          elapsedMs,
          level.fallConfig?.durationMs || 30000,
          state.course.targetDistance,
        );
        for (const [id, breakingAt] of state.breakingPlatforms) {
          const platform = state.course.platforms.find((entry) => entry.id === id);
          if (platform && time - breakingAt >= (platform.breakDelay ?? 450)) {
            state.brokenPlatforms.add(id);
          }
        }
        const activeCoursePlatforms = getActiveFallPlatforms(
          state.course.platforms,
          state.breakingPlatforms,
          state.brokenPlatforms,
          time,
        );
        const activePlatforms = activeCoursePlatforms.map(
          (platform) => screenPlatform(platform, state.scrollDistance, elapsedMs),
        );
        if (state.player.groundedPlatformId) {
          const support = activePlatforms.find(
            (platform) => platform.id === state.player.groundedPlatformId,
          );
          if (support) state.player.y = support.y - state.player.radius;
        }
        const landed = updateFallPlayer(
          state.player,
          gravityRef.current?.x || 0,
          activePlatforms,
          dt,
          level.fallConfig,
        );
        if (landed?.type === 'fragile' && !state.breakingPlatforms.has(landed.id)) {
          state.breakingPlatforms.set(landed.id, time);
          spawnBurst(state, state.player.x, landed.y, '#c8b4d0', 8);
        }
        if (landed?.type === 'spikes') takeDamage(state, 'spikes', time);
        if (landed?.type === 'goal') {
          state.complete = true;
          callbacksRef.current.onComplete(
            time - state.startedAt - state.pausedDuration,
            [...state.collected],
          );
        }

        for (const item of state.course.items) {
          const screenItem = { ...item, y: item.y - state.scrollDistance };
          if (
            state.collected.has(item.id) ||
            !overlapsItem(state.player, screenItem)
          ) continue;
          state.collected.add(item.id);
          spawnBurst(state, screenItem.x, screenItem.y, '#f1d38e', 14);
          callbacksRef.current.onCollect(item);
        }

        if (
          state.player.y - state.player.radius <=
          (level.fallConfig?.topDangerY || 70)
        ) {
          takeDamage(state, 'top', time);
        } else if (state.player.y - state.player.radius > WORLD.height + 40) {
          takeDamage(state, 'fall', time);
        }
      }

      ctx.clearRect(0, 0, WORLD.width, WORLD.height);
      ctx.save();
      if (state && time < state.shakeUntil) {
        ctx.translate((Math.random() - 0.5) * 5, (Math.random() - 0.5) * 5);
      }
      drawPaper(ctx, artRef.current.garden);
      if (state) {
        const elapsedMs = getFallElapsed(
          time,
          state.startedAt,
          state.pausedDuration,
          state.pauseBeganAt,
        );
        const durationMs = level.fallConfig?.durationMs || 30000;
        const remainingMs = Math.max(0, durationMs - elapsedMs);
        const urgency = Math.max(0, Math.min(1, (5000 - remainingMs) / 5000));
        if (urgency > 0) {
          ctx.fillStyle = `rgba(126, 27, 50, ${
            (0.025 + Math.sin(time / 120) * 0.012) * urgency
          })`;
          ctx.fillRect(0, 0, WORLD.width, WORLD.height);
        }
        for (const coursePlatform of state.course.platforms) {
          const platform = screenPlatform(
            coursePlatform,
            state.scrollDistance,
            elapsedMs,
          );
          if (platform.y < -40 || platform.y > WORLD.height + 40) continue;
          if (state.brokenPlatforms.has(platform.id)) continue;
          drawFallPlatform(
            ctx,
            platform,
            state.breakingPlatforms.get(platform.id),
            time,
          );
        }
        for (const item of state.course.items) {
          if (!state.collected.has(item.id)) {
            drawItem(ctx, { ...item, y: item.y - state.scrollDistance }, time, artRef.current);
          }
        }
        drawPlayer(ctx, state.player, artRef.current.avatar, time, {
          mirrored: false,
          echo: false,
          vanish:
            time < state.teleportUntil ||
            (time < state.immunityUntil && Math.floor(time / 90) % 2 === 0),
        });
        state.particles = drawParticles(ctx, state.particles, dt);
        drawFallCeiling(
          ctx,
          level.fallConfig?.topDangerY || 70,
          time,
          urgency,
        );
        drawFallHud(
          ctx,
          state.lives,
          state.maxLives,
          remainingMs,
        );
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

  return <canvas ref={canvasRef} className="game-canvas" aria-label={`${level.name}下坠关卡`} />;
}

function getActiveGates(level, switches) {
  return (level.gates || []).filter((gate) => {
    const ids = gate.switchIds || [gate.switchId];
    return !ids.every((id) => switches.has(id));
  });
}

function MazeGameCanvas({
  level,
  gravityRef,
  paused,
  resetToken,
  controlMode,
  onCollect,
  onPaint,
  onBumper,
  onSwitch,
  onGiftUsed,
  onZoneEnter,
  onDeath,
  onLockedDoor,
  onComplete,
}) {
  const canvasRef = useRef(null);
  const stateRef = useRef(null);
  const artRef = useRef({});
  const callbacksRef = useRef({
    onCollect,
    onPaint,
    onBumper,
    onSwitch,
    onGiftUsed,
    onZoneEnter,
    onDeath,
    onLockedDoor,
    onComplete,
  });
  callbacksRef.current = {
    onCollect,
    onPaint,
    onBumper,
    onSwitch,
    onGiftUsed,
    onZoneEnter,
    onDeath,
    onLockedDoor,
    onComplete,
  };

  useEffect(() => {
    const garden = new Image();
    garden.crossOrigin = 'anonymous';
    garden.src = assetUrl('assets/art/dream-garden.jpg');
    const avatar = new Image();
    avatar.crossOrigin = 'anonymous';
    avatar.src = assetUrl('assets/art/alice-chibi-head.png');
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
    const cameo = new Image();
    cameo.crossOrigin = 'anonymous';
    cameo.src = assetUrl('assets/art/rabbit-cameo.png');
    const teaTable = new Image();
    teaTable.crossOrigin = 'anonymous';
    teaTable.src = assetUrl('assets/art/rotating-tea-table.png');
    const chessPawn = new Image();
    chessPawn.crossOrigin = 'anonymous';
    chessPawn.src = assetUrl('assets/art/mirror-chess-pawn.png');
    const flamingo = new Image();
    flamingo.crossOrigin = 'anonymous';
    flamingo.src = assetUrl('assets/art/flamingo-mallet.png');
    artRef.current = {
      garden,
      avatar,
      teacup,
      cardGuard,
      mushroom,
      watch,
      cameo,
      teaTable,
      chessPawn,
      flamingo,
    };
  }, []);

  useEffect(() => {
    stateRef.current = {
      player: makeBall(level.start),
      collected: new Set(),
      painted: new Set(),
      switches: new Set(),
      checkpoint: level.start,
      complete: false,
      lockedCooldown: 0,
      portalCooldown: 0,
      deathCooldown: 0,
      touchingSwitches: new Set(),
      sequenceIndex: 0,
      rotations: new Map((level.rotators || []).map((rotator) => [rotator.id, 0])),
      phases: new Map((level.phases || []).map((phase) => [phase.id, phase.initial || 0])),
      bumperCooldowns: new Map(),
      lastBumperId: null,
      bumperLinkUntil: 0,
      bumperFlightUntil: 0,
      moversFrozenUntil: 0,
      moversFrozenAt: 0,
      shields: 0,
      immunityUntil: 0,
      activeMirrorZoneIds: new Set(),
      seenMirrorZoneIds: new Set(),
      positionHistory: [],
      echoPosition: null,
      echoHoldStarted: null,
      zoneActivatedAt: new Map(),
      stealthAlert: 0,
      particles: [],
      shakeUntil: 0,
      startedAt: performance.now(),
      pauseBeganAt: null,
      pausedDuration: 0,
    };
  }, [level, resetToken]);

  useEffect(() => {
    if (stateRef.current) {
      stateRef.current.positionHistory = [];
      stateRef.current.echoPosition = null;
      stateRef.current.echoHoldStarted = null;
    }
  }, [controlMode]);

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
      state.positionHistory = [];
      state.echoPosition = null;
      state.echoHoldStarted = null;
      state.stealthAlert = 0;
      state.activeMirrorZoneIds = new Set();
      for (const zone of level.zones || []) {
        if (
          zone.activationSwitch &&
          state.switches.has(zone.activationSwitch) &&
          !(zone.disabledBySwitches || []).some((id) => state.switches.has(id))
        ) {
          state.zoneActivatedAt.set(zone.id, time);
        }
      }
      callbacksRef.current.onDeath(reason);
    };

    const frame = (time) => {
      const state = stateRef.current;
      const dt = time - previous;
      previous = time;
      const moverTime = state && time < state.moversFrozenUntil ? state.moversFrozenAt : time;
      const movers = state
        ? (level.movers || [])
            .filter((mover) => isMoverActive(mover, state.switches))
            .map((mover) => getMoverRect(mover, moverTime))
        : [];
      const resolvedZones = state
        ? (level.zones || [])
            .filter((zone) => (
              (!zone.activationSwitch || state.switches.has(zone.activationSwitch)) &&
              !(zone.disabledBySwitches || []).some((id) => state.switches.has(id))
            ))
            .map((zone) => (
              zone.waypoints
                ? getMovingZoneRect(zone, time - (state.zoneActivatedAt.get(zone.id) || time))
                : zone
            ))
        : [];
      const activeGates = state ? getActiveGates(level, state.switches) : [];
      const rotatorWalls = state
        ? (level.rotators || []).flatMap((rotator) => (
          getRotatorWalls(rotator, state.rotations.get(rotator.id) || 0)
        ))
        : [];
      const phaseWalls = state
        ? (level.phases || []).flatMap((phase) => (
          getPhaseWalls(phase, state.phases.get(phase.id) || 0)
        ))
        : [];

      if (state && paused && state.pauseBeganAt === null) {
        state.pauseBeganAt = time;
      } else if (state && !paused && state.pauseBeganAt !== null) {
        state.pausedDuration += time - state.pauseBeganAt;
        state.pauseBeganAt = null;
      }

      if (state && !paused && !state.complete) {
        const nextMirrorZoneIds = updateMirrorZoneMembership(
          state.player,
          resolvedZones,
          state.activeMirrorZoneIds,
        );
        const enteredMirrorZones = getActiveMirrorZones(resolvedZones, nextMirrorZoneIds)
          .filter((zone) => !state.activeMirrorZoneIds.has(zone.id));
        for (const zone of enteredMirrorZones) {
          const firstEntry = !state.seenMirrorZoneIds.has(zone.id);
          state.seenMirrorZoneIds.add(zone.id);
          callbacksRef.current.onZoneEnter?.({ ...zone, firstEntry });
        }
        state.activeMirrorZoneIds = nextMirrorZoneIds;
        const activeMirrorZones = getActiveMirrorZones(
          resolvedZones,
          state.activeMirrorZoneIds,
        );
        const mirrorZoneEffects = getMirrorZoneEffects(activeMirrorZones);
        const currentZones = (level.zones || []).filter((zone) => zone.type === 'current' && pointInRect(state.player, zone));
        const onIce = (level.zones || []).some((zone) => zone.type === 'ice' && pointInRect(state.player, zone));
        const input = gravityRef.current || { x: 0, y: 0 };
        const bumperFlight = time < state.bumperFlightUntil;
        const transformedInput = transformControlInput(
          input,
          level.mirrorControls,
          state,
          activeMirrorZones,
        );
        const gravity = {
          x: bumperFlight
            ? 0
            : transformedInput.x +
              currentZones.reduce((sum, zone) => sum + (zone.forceX || 0), 0),
          y: bumperFlight
            ? 0
            : transformedInput.y +
              currentZones.reduce((sum, zone) => sum + (zone.forceY || 0), 0),
        };
        const previousPosition = { x: state.player.x, y: state.player.y };
        const sizeGates = (level.sizeGates || []).filter(
          (gate) => state.player.radius > gate.maxRadius,
        );
        updateBall(state.player, gravity, [
          ...level.walls,
          ...activeGates,
          ...sizeGates,
          ...rotatorWalls,
          ...phaseWalls,
        ], dt, {
          friction: bumperFlight ? 0.998 : onIce ? 0.996 : 0.982,
          maxSpeed: bumperFlight ? 6.2 : onIce ? 5.8 : 4.8,
        });
        if (level.echoReplay) {
          state.positionHistory.push({
            time,
            x: state.player.x,
            y: state.player.y,
          });
          while (
            state.positionHistory[0]?.time <
            time - (level.echoReplay.historyDuration ?? 2500)
          ) {
            state.positionHistory.shift();
          }
          state.echoPosition = getEchoReplayPosition(
            state.positionHistory,
            time,
            level.echoReplay,
          );
        }

        if (state.lastBumperId && time > state.bumperLinkUntil) {
          state.lastBumperId = null;
          state.bumperFlightUntil = 0;
        }

        for (const bumper of level.bumpers || []) {
          if (!isBumperEnabled(bumper, state.switches)) continue;
          const cooldown = state.bumperCooldowns.get(bumper.id) || 0;
          if (time < cooldown || !overlapsItem(state.player, bumper)) continue;
          applyBumperImpulse(state.player, bumper);
          state.bumperCooldowns.set(bumper.id, time + (bumper.cooldown || 720));
          state.lastBumperId = bumper.id;
          state.bumperLinkUntil = time + (bumper.linkDuration || 3200);
          state.bumperFlightUntil = time + (bumper.flightDuration || 1500);
          state.shakeUntil = time + 90;
          spawnBurst(state, bumper.x, bumper.y, '#e597aa', 12);
          callbacksRef.current.onBumper?.(bumper);
        }

        for (const trigger of (level.switches || []).filter((entry) => entry.action === 'hoop')) {
          if (
            state.switches.has(trigger.id) ||
            !segmentCrossesHoop(previousPosition, state.player, trigger)
          ) continue;
          if (!canScoreLinkedHoop(trigger, state.lastBumperId, state.bumperLinkUntil, time)) {
            callbacksRef.current.onSwitch({
              ...trigger,
              sequenceStatus: 'needs-bumper',
              activeIds: [...state.switches],
            });
            continue;
          }
          const result = activateSwitch(
            level.switchSequence,
            state.switches,
            state.sequenceIndex,
            trigger.id,
          );
          state.switches = result.switches;
          state.sequenceIndex = result.sequenceIndex;
          state.lastBumperId = null;
          state.bumperLinkUntil = 0;
          state.bumperFlightUntil = 0;
          state.shakeUntil = time + 130;
          spawnBurst(state, trigger.x, trigger.y, '#f4dc9a', 16);
          callbacksRef.current.onSwitch({
            ...trigger,
            sequenceStatus: result.status,
            sequenceIndex: result.sequenceIndex,
            sequenceLength: level.switchSequence?.length,
            activeIds: [...state.switches],
          });
        }

        for (const item of level.items || []) {
          if (
            state.collected.has(item.id) ||
            !isItemAvailable(item, state) ||
            !overlapsItem(state.player, item)
          ) continue;
          state.collected.add(item.id);
          if (item.type === 'potion') state.player.radius = 7;
          if (item.type === 'cookie') state.player.radius = 17;
          if (item.type === 'checkpoint') state.checkpoint = { x: item.x, y: item.y };
          if (item.type === 'timepiece') {
            state.moversFrozenAt = time;
            state.moversFrozenUntil = time + (item.duration || 7000);
          }
          if (item.type === 'shield') state.shields += item.charges || 1;
          spawnBurst(state, item.x, item.y, item.type === 'potion' ? '#a9dced' : '#f1d38e', 12);
          callbacksRef.current.onCollect(item);
        }

        if (state.collected.has('red-paint')) {
          for (const rose of level.paintables || []) {
            if (state.painted.has(rose.id) || !overlapsItem(state.player, rose)) continue;
            state.painted.add(rose.id);
            if (rose.checkpoint) state.checkpoint = { x: rose.x, y: rose.y };
            state.shakeUntil = time + 90;
            spawnBurst(state, rose.x, rose.y, '#d44b60', 16);
            callbacksRef.current.onPaint({
              ...rose,
              paintedIds: [...state.painted],
            });
          }
        }

        const touchingSwitches = new Set(
          (level.switches || [])
            .filter((trigger) => (
              trigger.action !== 'hoop' &&
              !trigger.triggerSource &&
              overlapsItem(state.player, trigger)
            ))
            .map((trigger) => trigger.id),
        );
        for (const trigger of level.switches || []) {
          if (trigger.triggerSource) continue;
          if (!touchingSwitches.has(trigger.id) || state.touchingSwitches.has(trigger.id)) continue;
          if (trigger.minRadius && state.player.radius < trigger.minRadius) continue;
          if (trigger.maxRadius && state.player.radius > trigger.maxRadius) continue;
          if (
            (trigger.requiresItems || []).some((id) => !state.collected.has(id))
          ) {
            callbacksRef.current.onSwitch({
              ...trigger,
              sequenceStatus: 'missing-items',
              activeIds: [...state.switches],
            });
            continue;
          }
          if (trigger.action === 'stealthStage') {
            if (!canTriggerSwitch(trigger, state.switches)) continue;
            state.switches.add(trigger.id);
            state.stealthAlert = 0;
            if (trigger.checkpoint) {
              state.checkpoint = { x: trigger.x, y: trigger.y };
            }
            if (trigger.activatesZone) {
              state.zoneActivatedAt.set(trigger.activatesZone, time);
            }
            spawnBurst(state, trigger.x, trigger.y, '#c7b5e4', 16);
            callbacksRef.current.onSwitch({
              ...trigger,
              stealthStage: true,
              activeIds: [...state.switches],
            });
            continue;
          }
          if (trigger.action === 'rotate') {
            if (!canTriggerSwitch(trigger, state.switches)) continue;
            const rotator = (level.rotators || []).find((entry) => entry.id === trigger.target);
            if (rotator) {
              const currentTurn = state.rotations.get(rotator.id) || 0;
              const nextTurn = (currentTurn + 1) % (rotator.states || 4);
              state.rotations.set(rotator.id, nextTurn);
              state.switches.add(trigger.id);
              state.shakeUntil = time + 110;
              spawnBurst(state, rotator.centerX, rotator.centerY, '#e4c67e', 16);
              callbacksRef.current.onSwitch({
                ...trigger,
                rotationId: rotator.id,
                rotationTurn: nextTurn,
                rotations: Object.fromEntries(state.rotations),
                activeIds: [...state.switches],
              });
            }
            continue;
          }
          if (trigger.action === 'phase') {
            const phase = (level.phases || []).find((entry) => entry.id === trigger.target);
            const currentPhase = phase ? state.phases.get(phase.id) || 0 : 0;
            if (
              trigger.requiresPhase !== undefined &&
              currentPhase !== trigger.requiresPhase
            ) {
              callbacksRef.current.onSwitch({
                ...trigger,
                phaseId: phase?.id,
                phaseState: currentPhase,
                sequenceStatus: 'wrong-phase',
                activeIds: [...state.switches],
              });
              continue;
            }
            const repeatable = trigger.activationMode === 'repeatable';
            if (!canTriggerSwitch(
              trigger,
              state.switches,
              repeatable ? null : level.switchSequence,
              state.sequenceIndex,
            )) continue;
            const result = activateSwitch(
              repeatable ? null : level.switchSequence,
              state.switches,
              state.sequenceIndex,
              trigger.id,
            );
            state.switches = result.switches;
            state.sequenceIndex = result.sequenceIndex;
            if (result.status === 'reset') {
              state.shakeUntil = time + 120;
            } else {
              if (phase) {
                const nextPhase = trigger.phaseTo ?? (
                  (currentPhase + 1) % phase.wallsByState.length
                );
                state.phases.set(phase.id, nextPhase);
                state.shakeUntil = time + 140;
                spawnBurst(state, trigger.x, trigger.y, nextPhase ? '#d9e7f2' : '#8b789e', 15);
                callbacksRef.current.onSwitch({
                  ...trigger,
                  phaseId: phase.id,
                  phaseState: nextPhase,
                  phases: Object.fromEntries(state.phases),
                  sequenceStatus: result.status,
                  sequenceIndex: result.sequenceIndex,
                  sequenceLength: level.switchSequence?.length,
                  activeIds: [...state.switches],
                });
              }
            }
            continue;
          }
          if (!canTriggerSwitch(
            trigger,
            state.switches,
            level.switchSequence,
            state.sequenceIndex,
          )) continue;
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

        const identityGroups = new Map();
        for (const trigger of level.switches || []) {
          if (!trigger.simultaneousGroup) continue;
          const group = identityGroups.get(trigger.simultaneousGroup) || [];
          group.push(trigger);
          identityGroups.set(trigger.simultaneousGroup, group);
        }
        for (const triggers of identityGroups.values()) {
          if (triggers.every((trigger) => state.switches.has(trigger.id))) continue;
          const occupied = isSimultaneousGroupOccupied(
            triggers,
            state.player,
            state.echoPosition,
          );
          if (!occupied) {
            state.echoHoldStarted = null;
            continue;
          }
          if (state.echoHoldStarted === null) state.echoHoldStarted = time;
          if (time - state.echoHoldStarted < (level.echoReplay?.holdDuration ?? 250)) continue;
          for (const trigger of triggers) state.switches.add(trigger.id);
          state.echoHoldStarted = null;
          state.shakeUntil = time + 140;
          spawnBurst(state, state.player.x, state.player.y, '#c8e4f2', 18);
          callbacksRef.current.onSwitch({
            ...triggers[0],
            sequenceStatus: 'identity-complete',
            activeIds: [...state.switches],
          });
        }

        const movingFogActive = resolvedZones.some(
          (zone) => zone.waypoints && zone.effect === 'vanish',
        );
        if (level.stealthConfig && movingFogActive) {
          state.stealthAlert = updateStealthAlert(
            state.stealthAlert,
            mirrorZoneEffects.vanish,
            dt,
            level.stealthConfig,
          );
          if (state.stealthAlert >= 1) die(state, 'alert', time);
        } else {
          state.stealthAlert = 0;
        }

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
        const moverHit = mirrorZoneEffects.vanish
          ? null
          : movers.find((entry) => circleRectCollision(state.player, entry));
        if ((hazard || moverHit) && time > state.immunityUntil) {
          if (state.shields > 0) {
            state.shields -= 1;
            state.immunityUntil = time + 1500;
            state.player.vx *= -0.7;
            state.player.vy *= -0.7;
            state.shakeUntil = time + 120;
            spawnBurst(state, state.player.x, state.player.y, '#b9deed', 18);
            callbacksRef.current.onGiftUsed?.(hazard ? 'hazard' : moverHit.type);
          } else {
            die(state, hazard ? 'hazard' : moverHit.type, time);
          }
        }

        if (circleRectCollision(state.player, level.goal)) {
          if (requirementsMet(level.goal.requires, state)) {
            state.complete = true;
            callbacksRef.current.onComplete(
              time - state.startedAt - state.pausedDuration,
              [...state.collected],
            );
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
      if (state && isMirrorControlActive(level.mirrorControls, state)) {
        drawMirrorVeil(ctx, time);
      }
      resolvedZones.forEach((zone) => drawZone(ctx, zone, time));
      (level.decorations || []).forEach((decoration) => drawDecoration(ctx, decoration, artRef.current, time));
      level.walls.forEach((wall, index) => drawWall(ctx, wall, index));
      activeGates.forEach((gate) => drawGate(ctx, gate, false));
      if (state) {
        (level.sizeGates || [])
          .filter((gate) => state.player.radius > gate.maxRadius)
          .forEach((gate) => drawGate(ctx, gate, false));
      }
      phaseWalls.forEach((wall) => drawPhaseWall(ctx, wall, time));
      (level.rotators || []).forEach((rotator) => {
        const turn = state?.rotations.get(rotator.id) || 0;
        drawRotator(ctx, rotator, getRotatorWalls(rotator, turn), turn, time, artRef.current);
      });
      movers.forEach((mover) => drawMover(ctx, mover, artRef.current));
      (level.bumpers || []).forEach((bumper) => {
        const target = (level.switches || []).find((entry) => entry.id === bumper.targetHoopId);
        const active = state ? isBumperEnabled(bumper, state.switches) : false;
        drawCroquetLink(ctx, bumper, target, active, time);
      });
      (level.bumpers || []).forEach((bumper) => {
        const active = state ? isBumperEnabled(bumper, state.switches) : false;
        drawBumper(ctx, bumper, artRef.current, time, active);
      });
      (level.hazards || []).forEach((hazard) => drawHazard(ctx, hazard, time));
      (level.portals || []).forEach((portal) => drawPortal(ctx, portal, time, artRef.current.teacup));

      if (state) {
        drawDoor(ctx, level.goal, requirementsMet(level.goal.requires, state), time);
        (level.paintables || []).forEach((rose) => (
          drawPaintable(ctx, rose, state.painted.has(rose.id), time)
        ));
        (level.switches || []).forEach((item) => {
          const active = item.action === 'rotate'
            ? (state.rotations.get(item.target) || 0) > 0
            : item.activationMode === 'repeatable'
              ? false
              : state.switches.has(item.id);
          const phase = item.action === 'phase'
            ? (level.phases || []).find((entry) => entry.id === item.target)
            : null;
          const rotator = item.action === 'rotate'
            ? (level.rotators || []).find((entry) => entry.id === item.target)
            : null;
          const currentState = item.action === 'phase'
            ? state.phases.get(item.target) || 0
            : item.action === 'rotate'
              ? state.rotations.get(item.target) || 0
              : 0;
          drawSwitch(ctx, {
            ...item,
            currentPhase: item.action === 'phase' ? currentState : undefined,
            currentState,
            stateCount: phase?.wallsByState.length || rotator?.states || 2,
            occupiedByCorrect: item.triggerSource
              ? isTriggerOccupied(item, state.player, state.echoPosition)
              : false,
            occupiedByWrong: item.triggerSource === 'echo'
              ? overlapsItem(state.player, item)
              : item.triggerSource === 'player'
                ? Boolean(state.echoPosition && overlapsItem(
                    { ...state.echoPosition, radius: state.player.radius },
                    item,
                  ))
                : false,
          }, active, time, artRef.current);
        });
        for (const item of level.items || []) {
          if (!state.collected.has(item.id) && isItemAvailable(item, state)) {
            drawItem(ctx, item, time, artRef.current);
          }
        }
        const activeMirrorZones = getActiveMirrorZones(
          resolvedZones,
          state.activeMirrorZoneIds,
        );
        const effects = getMirrorZoneEffects(activeMirrorZones);
        drawEchoReplay(
          ctx,
          state.echoPosition,
          artRef.current.avatar,
          time,
          level.echoReplay?.delay ?? 2000,
        );
        drawPlayer(ctx, state.player, artRef.current.avatar, time, {
          mirrored: isMirrorControlActive(level.mirrorControls, state) !== effects.invertX,
          echo: false,
          vanish: effects.vanish,
        });
        state.particles = drawParticles(ctx, state.particles, dt);
        if (level.stealthConfig) {
          drawStealthHud(ctx, state.stealthAlert, effects.vanish);
        }
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

export default function GameCanvas(props) {
  if (props.level.mode === 'fall') return <FallGameCanvas {...props} />;
  return <MazeGameCanvas {...props} />;
}
