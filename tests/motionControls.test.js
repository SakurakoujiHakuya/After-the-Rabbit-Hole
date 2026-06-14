import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyRadialResponse,
  beginMotionCalibration,
  createMotionControlState,
  gravityVectorToOrientation,
  orientationToGravityVector,
  rotateInputToScreen,
  shortestAngleDifference,
  timeoutMotionCalibration,
  updateMotionControl,
} from '../src/motionControls.js';

function calibrate(beta = 35, gamma = 0, interval = 16.667) {
  let state = beginMotionCalibration(createMotionControlState(), 0);
  for (let time = 0; time <= 300; time += interval) {
    state = updateMotionControl(state, { beta, gamma, screenAngle: 0 }, time);
  }
  return state;
}

test('normalizes equivalent Euler representations through gravity vectors', () => {
  const first = gravityVectorToOrientation(orientationToGravityVector(89, 1));
  const second = gravityVectorToOrientation(orientationToGravityVector(91, 179));
  assert.ok(Math.abs(first.beta - second.beta) < 0.001);
  assert.ok(Math.abs(shortestAngleDifference(first.gamma, second.gamma)) < 2.01);
});

test('maps screen orientation in quarter turns', () => {
  assert.deepEqual(rotateInputToScreen({ x: 1, y: 2 }, 0), { x: 1, y: 2 });
  assert.deepEqual(rotateInputToScreen({ x: 1, y: 2 }, 90), { x: -2, y: 1 });
  assert.deepEqual(rotateInputToScreen({ x: 1, y: 2 }, 180), { x: -1, y: -2 });
  assert.deepEqual(rotateInputToScreen({ x: 1, y: 2 }, 270), { x: 2, y: -1 });
});

test('uses an exact radial deadzone and a bounded nonlinear response', () => {
  assert.deepEqual(applyRadialResponse({ x: 1, y: 1 }), { x: 0, y: 0 });
  const medium = applyRadialResponse({ x: 6, y: 0 });
  assert.ok(medium.x > 0.15 && medium.x < 0.3);
  assert.deepEqual(applyRadialResponse({ x: 30, y: 0 }), { x: 1, y: 0 });
});

test('calibrates only after a stable time window', () => {
  let state = beginMotionCalibration(createMotionControlState(), 0);
  for (let time = 0; time < 220; time += 16.667) {
    state = updateMotionControl(state, { beta: 35, gamma: 0 }, time);
  }
  assert.equal(state.status, 'calibrating');
  state = updateMotionControl(state, { beta: 35, gamma: 0 }, 234);
  assert.equal(state.status, 'ready');
  assert.ok(state.neutralVector);
});

test('waits for a moving device to settle before calibration', () => {
  let state = beginMotionCalibration(createMotionControlState(), 0);
  for (let time = 0; time <= 850; time += 16.667) {
    const gamma = time < 500 ? time / 80 : 6.25;
    state = updateMotionControl(state, { beta: 35, gamma }, time);
  }
  assert.equal(state.status, 'ready');
  const neutral = gravityVectorToOrientation(state.neutralVector);
  assert.ok(Math.abs(neutral.gamma - 6.25) < 0.3);
});

test('produces consistent tilt input across natural holding angles', () => {
  for (const beta of [25, 35, 45, 60]) {
    let state = calibrate(beta);
    for (let time = 320; time <= 600; time += 16.667) {
      state = updateMotionControl(state, {
        beta,
        gamma: 6,
        screenAngle: 0,
      }, time);
    }
    assert.ok(state.output.x > 0.18 && state.output.x < 0.2);
    assert.ok(Math.abs(state.output.y) < 0.001);
  }
});

test('uses time-based filtering across different sensor event rates', () => {
  const outputs = [20, 60, 120].map((frequency) => {
    const interval = 1000 / frequency;
    let state = beginMotionCalibration(createMotionControlState(), 0);
    let calibratedAt = 0;
    for (let time = 0; time <= 800; time += interval) {
      state = updateMotionControl(state, {
        beta: 35,
        gamma: 0,
        screenAngle: 0,
      }, time);
      if (state.status === 'ready') {
        calibratedAt = time;
        break;
      }
    }
    assert.equal(state.status, 'ready');
    for (
      let time = calibratedAt + interval;
      time <= calibratedAt + 300;
      time += interval
    ) {
      state = updateMotionControl(state, {
        beta: 35,
        gamma: 10,
        screenAngle: 0,
      }, time);
    }
    return state.output.x;
  });
  assert.ok(Math.max(...outputs) - Math.min(...outputs) < 0.03);
});

test('soft-recalibrates after a long sensor event gap', () => {
  const ready = calibrate();
  const next = updateMotionControl(
    ready,
    { beta: 35, gamma: 0, screenAngle: 0 },
    ready.lastSampleAt + 701,
  );
  assert.equal(next.status, 'calibrating');
  assert.equal(next.neutralVector, ready.neutralVector);
  assert.deepEqual(next.output, { x: 0, y: 0 });
});

test('ignores invalid samples instead of treating them as neutral', () => {
  const ready = calibrate();
  const next = updateMotionControl(ready, { beta: null, gamma: null }, 400);
  assert.equal(next, ready);
});

test('soft recalibration keeps the previous neutral point on timeout', () => {
  const ready = calibrate();
  const calibrating = beginMotionCalibration(ready, 1000, { preserveNeutral: true });
  const timedOut = timeoutMotionCalibration(calibrating, 2800);
  assert.equal(timedOut.status, 'ready');
  assert.equal(timedOut.neutralVector, ready.neutralVector);
  assert.equal(timedOut.lastSampleAt, 2800);
});

test('initial calibration times out without inventing a neutral point', () => {
  const calibrating = beginMotionCalibration(createMotionControlState(), 0);
  const timedOut = timeoutMotionCalibration(calibrating, 1800);
  assert.equal(timedOut.status, 'timeout');
  assert.equal(timedOut.neutralVector, null);
});
