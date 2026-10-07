export const CONFIG = Object.freeze({
  renderer: {
    maxPixelRatio: 2,
    clearColor: 0xc5dfe4,
    shadowMapSize: 2048,
  },
  camera: {
    viewSizeDesktop: 10.5,
    viewSizePortrait: 13.2,
    portraitBreakpoint: 0.82,
    near: 0.1,
    far: 100,
    offset: { x: 8.5, y: 10.5, z: 9.5 },
    followSpeed: 3.2,
    leadTowardTarget: 0.08,
    screenBiasRight: 0.8,
    screenBiasUp: 0.8,
    failureDrop: 0.75,
  },
  scene: {
    fogColor: 0xc5dfe4,
    fogNear: 13,
    fogFar: 30,
    ambientColor: 0xffffff,
    ambientIntensity: 2.1,
    sunColor: 0xfff4dc,
    sunIntensity: 4.2,
    sunPosition: { x: -7, y: 13, z: -4 },
  },
  player: {
    bodyColor: 0xff674d,
    accentColor: 0xffd451,
    faceColor: 0x3b4652,
    bodyRadius: 0.25,
    bodyHeight: 0.72,
    headRadius: 0.29,
    footRadius: 0.2,
    squashScaleY: 0.56,
    squashScaleXZ: 1.13,
    stretchScaleY: 1.18,
    stretchScaleXZ: 0.9,
    landingDuration: 0.28,
    arrowColor: 0xff7a52,
    arrowLength: 1.15,
    arrowHeight: 0.08,
    shadowRadius: 0.36,
  },
  platform: {
    height: 0.48,
    initialSize: 1.65,
    minSize: 1.05,
    maxSize: 1.65,
    absoluteMinScale: 0.35,
    absoluteMinSize: 0.58,
    retentionCount: 4,
    chargePressDepth: 0.1,
    edgeSafetyMargin: 0.04,
    colors: [0x35c6a5, 0x3aa9e8, 0xf4c83e, 0x9b75dd, 0xee8064, 0x58c95a],
  },
  jump: {
    maxChargeMs: 1800,
    minDistance: 0.22,
    maxDistance: 4.65,
    durationMin: 0.58,
    durationMax: 0.86,
    apexMin: 1.35,
    apexMax: 2.15,
    flipTurns: 1,
  },
  input: {
    turnSpeedDegrees: 82,
  },
  scoring: {
    normalPoints: 1,
    perfectBaseBonus: 2,
    perfectMaxBonus: 32,
    perfectRadiusRatio: 0.2,
  },
  storage: {
    recordsKey: "happyjump.records.v1",
    maxRankings: 10,
    maxPlayerNameLength: 12,
  },
  progression: {
    jumpsPerLevel: 20,
    scalePerLevel: 0.9,
    minDistanceStart: 1.65,
    minDistancePerLevel: 0.09,
    minDistanceCap: 2.65,
    maxDistanceStart: 2.55,
    maxDistancePerLevel: 0.14,
    maxDistanceCap: 4.15,
    maxTurnStartDegrees: 28,
    maxTurnPerLevelDegrees: 4,
    maxTurnCapDegrees: 70,
    minTurnDegrees: 12,
    directionUnlockLevel: 5,
    aimDeviationStartDegrees: 10,
    aimDeviationPerLevelDegrees: 2,
    aimDeviationCapDegrees: 20,
    aimDeviationMinRatio: 0.55,
  },
  timing: {
    landedPause: 0.22,
    failureDuration: 1.15,
    maxFrameDelta: 0.05,
  },
  effects: {
    ringColor: 0xffcf3f,
    ringLife: 0.72,
    ringStartScale: 0.4,
    ringEndScale: 2.7,
    ringOpacity: 0.85,
    particleCount: 12,
    particleLife: 0.8,
    particleSize: 0.055,
    particleSpeedMin: 0.75,
    particleSpeedMax: 1.55,
    particleGravity: 2.6,
  },
});

export function getDifficultyParams(level) {
  const { progression, platform, jump } = CONFIG;
  const levelIndex = Math.max(0, level - 1);
  const platformScale = Math.max(
    platform.absoluteMinScale,
    Math.pow(progression.scalePerLevel, levelIndex),
  );
  const minDistance = Math.min(
    progression.minDistanceCap,
    progression.minDistanceStart + levelIndex * progression.minDistancePerLevel,
  );
  const maxDistance = Math.min(
    progression.maxDistanceCap,
    progression.maxDistanceStart + levelIndex * progression.maxDistancePerLevel,
    jump.maxDistance - platform.edgeSafetyMargin,
  );
  const maxTurnAngle = Math.min(
    progression.maxTurnCapDegrees,
    progression.maxTurnStartDegrees + levelIndex * progression.maxTurnPerLevelDegrees,
  );
  const aimDeviation =
    level >= progression.directionUnlockLevel
      ? Math.min(
          progression.aimDeviationCapDegrees,
          progression.aimDeviationStartDegrees +
            (level - progression.directionUnlockLevel) *
              progression.aimDeviationPerLevelDegrees,
        )
      : 0;

  return {
    platformScale,
    minDistance,
    maxDistance,
    maxTurnAngle,
    aimDeviation,
  };
}

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function lerp(from, to, amount) {
  return from + (to - from) * amount;
}

export function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}
