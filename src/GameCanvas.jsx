import { useEffect, useRef } from 'react';
import { assetUrl } from './assets';
import {
  WORLD,
  activateSwitch,
  applyBumperImpulse,
  canScoreLinkedHoop,
  circleRectCollision,
  getMoverRect,
  getPhaseWalls,
  getRotatorWalls,
  isBumperEnabled,
  isItemAvailable,
  makeBall,
  overlapsItem,
  pointInRect,
  requirementsMet,
  resetBall,
  segmentCrossesHoop,
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
  if (item.action === 'phase' && art.chessPawn?.complete) {
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
    : item.action === 'phase' ? '♟'
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
  onPaint,
  onBumper,
  onSwitch,
  onGiftUsed,
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
      particles: [],
      shakeUntil: 0,
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
      const moverTime = state && time < state.moversFrozenUntil ? state.moversFrozenAt : time;
      const movers = (level.movers || []).map((mover) => getMoverRect(mover, moverTime));
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
        const currentZones = (level.zones || []).filter((zone) => zone.type === 'current' && pointInRect(state.player, zone));
        const onIce = (level.zones || []).some((zone) => zone.type === 'ice' && pointInRect(state.player, zone));
        const input = gravityRef.current || { x: 0, y: 0 };
        const bumperFlight = time < state.bumperFlightUntil;
        const gravity = {
          x: bumperFlight ? 0 : input.x + currentZones.reduce((sum, zone) => sum + (zone.forceX || 0), 0),
          y: bumperFlight ? 0 : input.y + currentZones.reduce((sum, zone) => sum + (zone.forceY || 0), 0),
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
            .filter((trigger) => trigger.action !== 'hoop' && overlapsItem(state.player, trigger))
            .map((trigger) => trigger.id),
        );
        for (const trigger of level.switches || []) {
          if (!touchingSwitches.has(trigger.id) || state.touchingSwitches.has(trigger.id)) continue;
          if (trigger.minRadius && state.player.radius < trigger.minRadius) continue;
          if (trigger.action === 'rotate') {
            const rotator = (level.rotators || []).find((entry) => entry.id === trigger.target);
            if (rotator) {
              const currentTurn = state.rotations.get(rotator.id) || 0;
              const nextTurn = (currentTurn + 1) % (rotator.states || 4);
              state.rotations.set(rotator.id, nextTurn);
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
            if (state.switches.has(trigger.id) && !trigger.repeatable) continue;
            const result = activateSwitch(
              trigger.repeatable ? null : level.switchSequence,
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
      (level.zones || []).forEach((zone) => drawZone(ctx, zone, time));
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
            : state.switches.has(item.id);
          drawSwitch(ctx, item, active, time, artRef.current);
        });
        for (const item of level.items || []) {
          if (!state.collected.has(item.id) && isItemAvailable(item, state)) {
            drawItem(ctx, item, time, artRef.current);
          }
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
