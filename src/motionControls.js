const DEFAULT_OPTIONS = {
  calibrationWindowMs: 280,
  calibrationMinDurationMs: 220,
  calibrationMinSamples: 5,
  calibrationMaxSpanDegrees: 1.4,
  calibrationMaxDeviationDegrees: 0.45,
  calibrationTimeoutMs: 1800,
  filterTimeConstantMs: 38,
  deadzoneDegrees: 1.75,
  activeRangeDegrees: 17,
  responseExponent: 1.3,
  staleAfterMs: 700,
};

function toRadians(degrees) {
  return degrees * Math.PI / 180;
}

function toDegrees(radians) {
  return radians * 180 / Math.PI;
}

function vectorLength(vector) {
  return Math.hypot(vector.x, vector.y, vector.z);
}

function normalizeVector(vector) {
  const length = vectorLength(vector);
  if (!length) return { x: 0, y: 0, z: 1 };
  return {
    x: vector.x / length,
    y: vector.y / length,
    z: vector.z / length,
  };
}

function averageVector(samples) {
  return normalizeVector(samples.reduce(
    (sum, sample) => ({
      x: sum.x + sample.vector.x,
      y: sum.y + sample.vector.y,
      z: sum.z + sample.vector.z,
    }),
    { x: 0, y: 0, z: 0 },
  ));
}

function sampleStats(values) {
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance = values.reduce(
    (sum, value) => sum + (value - mean) ** 2,
    0,
  ) / values.length;
  return {
    deviation: Math.sqrt(variance),
    span: Math.max(...values) - Math.min(...values),
  };
}

export function shortestAngleDifference(from, to) {
  return ((to - from + 540) % 360) - 180;
}

export function orientationToGravityVector(beta, gamma) {
  if (!Number.isFinite(beta) || !Number.isFinite(gamma)) return null;
  const betaRadians = toRadians(beta);
  const gammaRadians = toRadians(gamma);
  return normalizeVector({
    x: -Math.cos(betaRadians) * Math.sin(gammaRadians),
    y: Math.sin(betaRadians),
    z: Math.cos(betaRadians) * Math.cos(gammaRadians),
  });
}

export function gravityVectorToOrientation(vector) {
  const normalized = normalizeVector(vector);
  return {
    beta: toDegrees(Math.atan2(
      normalized.y,
      Math.hypot(normalized.x, normalized.z),
    )),
    gamma: toDegrees(Math.atan2(-normalized.x, normalized.z)),
  };
}

export function rotateInputToScreen(input, screenAngle = 0) {
  const angle = ((Math.round(screenAngle / 90) * 90) % 360 + 360) % 360;
  if (angle === 90) return { x: -input.y, y: input.x };
  if (angle === 180) return { x: -input.x, y: -input.y };
  if (angle === 270) return { x: input.y, y: -input.x };
  return { ...input };
}

export function applyRadialResponse(
  input,
  {
    deadzoneDegrees = DEFAULT_OPTIONS.deadzoneDegrees,
    activeRangeDegrees = DEFAULT_OPTIONS.activeRangeDegrees,
    responseExponent = DEFAULT_OPTIONS.responseExponent,
  } = {},
) {
  const magnitude = Math.hypot(input.x, input.y);
  if (magnitude <= deadzoneDegrees) return { x: 0, y: 0 };
  const usableRange = Math.max(0.001, activeRangeDegrees - deadzoneDegrees);
  const normalizedMagnitude = Math.min(
    1,
    (magnitude - deadzoneDegrees) / usableRange,
  ) ** responseExponent;
  return {
    x: input.x / magnitude * normalizedMagnitude,
    y: input.y / magnitude * normalizedMagnitude,
  };
}

export function createMotionControlState() {
  return {
    status: 'idle',
    startedAt: 0,
    samples: [],
    neutralVector: null,
    filteredDegrees: { x: 0, y: 0 },
    output: { x: 0, y: 0 },
    lastSampleAt: null,
    preserveNeutral: false,
  };
}

export function beginMotionCalibration(
  state = createMotionControlState(),
  time = 0,
  { preserveNeutral = false } = {},
) {
  return {
    ...state,
    status: 'calibrating',
    startedAt: time,
    samples: [],
    neutralVector: preserveNeutral ? state.neutralVector : null,
    filteredDegrees: { x: 0, y: 0 },
    output: { x: 0, y: 0 },
    lastSampleAt: null,
    preserveNeutral,
  };
}

export function timeoutMotionCalibration(state, time, options = {}) {
  const config = { ...DEFAULT_OPTIONS, ...options };
  if (
    state.status !== 'calibrating' ||
    time - state.startedAt < config.calibrationTimeoutMs
  ) {
    return state;
  }
  return {
    ...state,
    status: state.preserveNeutral && state.neutralVector ? 'ready' : 'timeout',
    samples: [],
    output: { x: 0, y: 0 },
    filteredDegrees: { x: 0, y: 0 },
    lastSampleAt: state.preserveNeutral && state.neutralVector ? time : null,
  };
}

function calibrationResult(samples, config) {
  if (samples.length < config.calibrationMinSamples) return null;
  if (
    samples[samples.length - 1].time - samples[0].time <
    config.calibrationMinDurationMs
  ) {
    return null;
  }

  const reference = gravityVectorToOrientation(samples[0].vector);
  const horizontal = samples.map((sample) => shortestAngleDifference(
    reference.gamma,
    gravityVectorToOrientation(sample.vector).gamma,
  ));
  const vertical = samples.map((sample) => shortestAngleDifference(
    reference.beta,
    gravityVectorToOrientation(sample.vector).beta,
  ));
  const horizontalStats = sampleStats(horizontal);
  const verticalStats = sampleStats(vertical);
  const stable = (
    horizontalStats.span <= config.calibrationMaxSpanDegrees &&
    verticalStats.span <= config.calibrationMaxSpanDegrees &&
    horizontalStats.deviation <= config.calibrationMaxDeviationDegrees &&
    verticalStats.deviation <= config.calibrationMaxDeviationDegrees
  );
  return stable ? averageVector(samples) : false;
}

function getTiltDelta(neutralVector, currentVector, screenAngle) {
  const neutral = gravityVectorToOrientation(neutralVector);
  const current = gravityVectorToOrientation(currentVector);
  return rotateInputToScreen({
    x: shortestAngleDifference(neutral.gamma, current.gamma),
    y: shortestAngleDifference(neutral.beta, current.beta),
  }, screenAngle);
}

export function updateMotionControl(
  state,
  sample,
  time,
  options = {},
) {
  const config = { ...DEFAULT_OPTIONS, ...options };
  const vector = orientationToGravityVector(sample?.beta, sample?.gamma);
  if (!vector) return timeoutMotionCalibration(state, time, config);

  let next = state;
  if (
    state.status === 'ready' &&
    state.lastSampleAt !== null &&
    time - state.lastSampleAt > config.staleAfterMs
  ) {
    next = beginMotionCalibration(state, time, { preserveNeutral: true });
  }

  if (next.status === 'idle' || next.status === 'timeout') return next;
  if (next.status === 'calibrating') {
    const samples = [
      ...next.samples.filter(
        (entry) => time - entry.time <= config.calibrationWindowMs,
      ),
      { time, vector },
    ];
    const neutralVector = calibrationResult(samples, config);
    if (neutralVector) {
      return {
        ...next,
        status: 'ready',
        samples: [],
        neutralVector,
        filteredDegrees: { x: 0, y: 0 },
        output: { x: 0, y: 0 },
        lastSampleAt: time,
      };
    }
    return timeoutMotionCalibration({
      ...next,
      samples,
      lastSampleAt: time,
    }, time, config);
  }

  const rawDegrees = getTiltDelta(
    next.neutralVector,
    vector,
    sample.screenAngle || 0,
  );
  const dt = next.lastSampleAt === null ? 0 : Math.max(0, time - next.lastSampleAt);
  const alpha = dt
    ? 1 - Math.exp(-dt / config.filterTimeConstantMs)
    : 1;
  const filteredDegrees = {
    x: next.filteredDegrees.x + (rawDegrees.x - next.filteredDegrees.x) * alpha,
    y: next.filteredDegrees.y + (rawDegrees.y - next.filteredDegrees.y) * alpha,
  };
  return {
    ...next,
    filteredDegrees,
    output: applyRadialResponse(filteredDegrees, config),
    lastSampleAt: time,
  };
}

export { DEFAULT_OPTIONS as MOTION_CONTROL_DEFAULTS };
