import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.162.0/build/three.module.js";
import {
  CONFIG,
  clamp,
  getDifficultyParams,
  lerp,
  randomBetween,
} from "./config.js";

export const GameState = Object.freeze({
  START_SCREEN: "START_SCREEN",
  IDLE: "IDLE",
  AIMING: "AIMING",
  CHARGING: "CHARGING",
  JUMPING: "JUMPING",
  LANDED: "LANDED",
  FAILED: "FAILED",
  GAME_OVER: "GAME_OVER",
});

export class Game {
  constructor({ sceneManager, player, platformManager, input, ui, callbacks = {} }) {
    this.sceneManager = sceneManager;
    this.player = player;
    this.platformManager = platformManager;
    this.input = input;
    this.ui = ui;
    this.callbacks = callbacks;

    this.state = GameState.START_SCREEN;
    this.score = 0;
    this.level = 1;
    this.successfulJumps = 0;
    this.perfectCombo = 0;
    const savedRecords = this.loadRecords();
    this.bestScore = savedRecords.bestScore;
    this.rankings = savedRecords.rankings;
    this.scoreSubmitted = false;

    this.currentPlatform = null;
    this.targetPlatform = null;
    this.chargeStartedAt = 0;
    this.chargeProgress = 0;
    this.jumpElapsed = 0;
    this.jumpDuration = 0;
    this.jumpApex = 0;
    this.jumpStart = new THREE.Vector3();
    this.jumpEnd = new THREE.Vector3();
    this.jumpDirection = new THREE.Vector3();
    this.landedElapsed = 0;
    this.failureElapsed = 0;

    this.preparePreview();
  }

  preparePreview() {
    this.resetWorld();
    this.state = GameState.START_SCREEN;
    this.ui.showStartScreen();
  }

  start() {
    this.score = 0;
    this.level = 1;
    this.successfulJumps = 0;
    this.perfectCombo = 0;
    this.scoreSubmitted = false;
    this.chargeProgress = 0;
    this.failureElapsed = 0;
    this.sceneManager.clearEffects();
    this.ui.clearFeedback();
    this.resetWorld();
    this.state = GameState.IDLE;
    this.ui.beginGame();
    this.ui.updateHud(this.score, this.level, this.successfulJumps);
    this.callbacks.onStart?.();
  }

  resetWorld() {
    this.platformManager.reset();
    this.currentPlatform = this.platformManager.createInitialPlatform();
    this.targetPlatform = this.platformManager.generateNext(
      this.currentPlatform,
      1,
    );
    this.player.reset(
      new THREE.Vector3(
        this.currentPlatform.position.x,
        this.currentPlatform.topY,
        this.currentPlatform.position.z,
      ),
    );
    this.aimAtTarget(false);
    this.sceneManager.setCameraFocusImmediate(
      this.player.root.position,
      this.getTargetFocus(),
    );
  }

  handleChargeStart() {
    if (this.state !== GameState.IDLE && this.state !== GameState.AIMING) {
      return;
    }
    this.state = GameState.CHARGING;
    this.chargeStartedAt = performance.now();
    this.chargeProgress = 0;
    this.ui.showCharge(0);
  }

  handleChargeEnd() {
    if (this.state !== GameState.CHARGING) {
      return;
    }
    this.updateChargeProgress(performance.now());
    this.beginJump();
  }

  handleChargeCancel() {
    if (this.state !== GameState.CHARGING) {
      return;
    }
    this.player.cancelCharge();
    this.currentPlatform.resetCompression();
    this.ui.hideCharge();
    this.state = this.isManualAimLevel() ? GameState.AIMING : GameState.IDLE;
  }

  update(nowMilliseconds, deltaSeconds) {
    if (
      this.isManualAimLevel() &&
      (this.state === GameState.AIMING || this.state === GameState.CHARGING)
    ) {
      const turnAxis = this.input.getTurnAxis();
      if (turnAxis !== 0) {
        this.player.turn(
          THREE.MathUtils.degToRad(CONFIG.input.turnSpeedDegrees) *
            turnAxis *
            deltaSeconds,
        );
      }
    }

    switch (this.state) {
      case GameState.CHARGING:
        this.updateChargeProgress(nowMilliseconds);
        break;
      case GameState.JUMPING:
        this.updateJump(deltaSeconds);
        break;
      case GameState.LANDED:
        this.updateLanded(deltaSeconds);
        break;
      case GameState.FAILED:
        this.updateFailure(deltaSeconds);
        break;
      default:
        break;
    }
  }

  updateChargeProgress(nowMilliseconds) {
    this.chargeProgress = clamp(
      (nowMilliseconds - this.chargeStartedAt) / CONFIG.jump.maxChargeMs,
      0,
      1,
    );
    this.player.setCharge(this.chargeProgress);
    this.currentPlatform.setChargeCompression(this.chargeProgress);
    this.ui.updateCharge(this.chargeProgress);
  }

  beginJump() {
    const easedCharge = Math.sqrt(this.chargeProgress);
    const distance = lerp(
      CONFIG.jump.minDistance,
      CONFIG.jump.maxDistance,
      easedCharge,
    );
    this.jumpDuration = lerp(
      CONFIG.jump.durationMin,
      CONFIG.jump.durationMax,
      easedCharge,
    );
    this.jumpApex = lerp(CONFIG.jump.apexMin, CONFIG.jump.apexMax, easedCharge);
    this.jumpElapsed = 0;
    this.jumpStart.copy(this.player.root.position);
    this.player.getDirection(this.jumpDirection);
    this.jumpEnd
      .copy(this.jumpStart)
      .addScaledVector(this.jumpDirection, distance);
    this.jumpEnd.y = this.targetPlatform.topY;

    this.currentPlatform.resetCompression();
    this.player.beginJump();
    this.ui.hideCharge();
    this.ui.setAimHint(false);
    this.state = GameState.JUMPING;
  }

  updateJump(deltaSeconds) {
    this.jumpElapsed += deltaSeconds;
    const progress = clamp(this.jumpElapsed / this.jumpDuration, 0, 1);
    const position = this.jumpStart.clone().lerp(this.jumpEnd, progress);
    position.y += Math.sin(progress * Math.PI) * this.jumpApex;
    this.player.setPosition(position);
    this.player.updateJump(progress);

    if (progress >= 1) {
      this.resolveLanding();
    }
  }

  resolveLanding() {
    if (!this.targetPlatform.containsPoint(this.jumpEnd)) {
      this.failJump();
      return;
    }

    const perfectThreshold =
      (this.targetPlatform.size / 2) * CONFIG.scoring.perfectRadiusRatio;
    const isPerfect =
      this.targetPlatform.distanceFromCenter(this.jumpEnd) < perfectThreshold;
    const previousLevel = this.level;
    let points = CONFIG.scoring.normalPoints;

    if (isPerfect) {
      this.perfectCombo += 1;
      const bonus = Math.min(
        CONFIG.scoring.perfectMaxBonus,
        CONFIG.scoring.perfectBaseBonus * 2 ** (this.perfectCombo - 1),
      );
      points += bonus;
    } else {
      this.perfectCombo = 0;
    }

    this.score += points;
    this.successfulJumps += 1;
    this.level =
      Math.floor(this.successfulJumps / CONFIG.progression.jumpsPerLevel) + 1;
    this.currentPlatform = this.targetPlatform;
    this.targetPlatform = this.platformManager.generateNext(
      this.currentPlatform,
      this.level,
    );
    this.platformManager.recycleOldPlatforms();

    this.player.setPosition(
      new THREE.Vector3(this.jumpEnd.x, this.currentPlatform.topY, this.jumpEnd.z),
    );
    this.player.beginLanding();
    this.aimAtTarget(false);
    this.landedElapsed = 0;
    this.state = GameState.LANDED;

    this.ui.updateHud(this.score, this.level, this.successfulJumps);
    this.ui.showLandingFeedback({
      perfect: isPerfect,
      points,
      combo: this.perfectCombo,
    });

    if (isPerfect) {
      const effectPosition = this.player.root.position.clone();
      effectPosition.y = this.currentPlatform.topY;
      this.sceneManager.createPerfectEffect(effectPosition);
    }
    if (this.level > previousLevel) {
      this.ui.showLevelUp(this.level);
    }
  }

  updateLanded(deltaSeconds) {
    this.landedElapsed += deltaSeconds;
    this.player.updateLanding(deltaSeconds);
    if (this.landedElapsed >= CONFIG.timing.landedPause) {
      const manualAim = this.isManualAimLevel();
      this.state = manualAim ? GameState.AIMING : GameState.IDLE;
      this.player.setArrowVisible(manualAim);
      this.ui.setAimHint(manualAim);
    }
  }

  failJump() {
    this.perfectCombo = 0;
    this.failureElapsed = 0;
    this.state = GameState.FAILED;
    this.player.beginFailure(this.jumpDirection);
    this.ui.hideCharge();
    this.ui.setAimHint(false);
  }

  updateFailure(deltaSeconds) {
    this.failureElapsed += deltaSeconds;
    this.player.updateFailure(deltaSeconds);
    if (this.failureElapsed >= CONFIG.timing.failureDuration) {
      this.state = GameState.GAME_OVER;
      this.bestScore = Math.max(this.bestScore, this.score);
      this.saveRecords();
      this.ui.showGameOver({
        score: this.score,
        level: this.level,
        bestScore: this.bestScore,
        rankings: this.rankings,
      });
      this.callbacks.onGameOver?.({ score: this.score, level: this.level });
    }
  }

  aimAtTarget(showArrow = true) {
    const dx = this.targetPlatform.position.x - this.player.root.position.x;
    const dz = this.targetPlatform.position.z - this.player.root.position.z;
    let heading = Math.atan2(dx, dz);
    const difficulty = getDifficultyParams(this.level);

    if (difficulty.aimDeviation > 0) {
      const magnitude = randomBetween(
        difficulty.aimDeviation * CONFIG.progression.aimDeviationMinRatio,
        difficulty.aimDeviation,
      );
      const sign = Math.random() < 0.5 ? -1 : 1;
      heading += THREE.MathUtils.degToRad(magnitude * sign);
    }

    this.player.setHeading(heading);
    const arrowVisible = showArrow && this.isManualAimLevel();
    this.player.setArrowVisible(arrowVisible);
    this.ui.setAimHint(arrowVisible);
  }

  isManualAimLevel() {
    return this.level >= CONFIG.progression.directionUnlockLevel;
  }

  submitScore(name) {
    if (this.state !== GameState.GAME_OVER || this.scoreSubmitted) {
      return false;
    }
    this.scoreSubmitted = true;
    this.rankings.push({
      name: (name || "Player").slice(0, CONFIG.storage.maxPlayerNameLength),
      score: this.score,
      level: this.level,
      createdAt: Date.now(),
    });
    this.rankings.sort((a, b) => b.score - a.score || b.level - a.level);
    this.rankings = this.rankings.slice(0, CONFIG.storage.maxRankings);
    this.saveRecords();
    this.ui.renderRankings(this.rankings);
    return true;
  }

  loadRecords() {
    try {
      const rawRecords = window.localStorage.getItem(CONFIG.storage.recordsKey);
      if (!rawRecords) {
        return { bestScore: 0, rankings: [] };
      }

      const parsedRecords = JSON.parse(rawRecords);
      const rankings = Array.isArray(parsedRecords.rankings)
        ? parsedRecords.rankings
            .filter(
              (entry) =>
                entry &&
                typeof entry.name === "string" &&
                Number.isFinite(entry.score) &&
                Number.isFinite(entry.level),
            )
            .map((entry) => ({
              name:
                entry.name.trim().slice(0, CONFIG.storage.maxPlayerNameLength) ||
                "Player",
              score: Math.max(0, Math.floor(entry.score)),
              level: Math.max(1, Math.floor(entry.level)),
              createdAt: Number.isFinite(entry.createdAt) && entry.createdAt > 0 ? entry.createdAt : null,
            }))
            .sort((a, b) => b.score - a.score || b.level - a.level)
            .slice(0, CONFIG.storage.maxRankings)
        : [];
      const savedBest = Number.isFinite(parsedRecords.bestScore)
        ? Math.max(0, Math.floor(parsedRecords.bestScore))
        : 0;
      const rankingBest = rankings.reduce(
        (highest, entry) => Math.max(highest, entry.score),
        0,
      );

      return {
        bestScore: Math.max(savedBest, rankingBest),
        rankings,
      };
    } catch {
      return { bestScore: 0, rankings: [] };
    }
  }

  saveRecords() {
    try {
      window.localStorage.setItem(
        CONFIG.storage.recordsKey,
        JSON.stringify({
          bestScore: this.bestScore,
          rankings: this.rankings,
        }),
      );
    } catch {
      // 隐私模式或存储空间不可用时，继续使用当前页面内存数据。
    }
  }

  getTargetFocus() {
    if (!this.targetPlatform) {
      return this.player.root.position;
    }
    return new THREE.Vector3(
      this.targetPlatform.position.x,
      this.targetPlatform.topY,
      this.targetPlatform.position.z,
    );
  }

  getFailureProgress() {
    if (this.state !== GameState.FAILED) {
      return 0;
    }
    return clamp(this.failureElapsed / CONFIG.timing.failureDuration, 0, 1);
  }
}
