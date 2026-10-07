import { CONFIG, clamp } from "./config.js";

export class UIManager {
  constructor() {
    this.startScreen = document.querySelector("#start-screen");
    this.gameOverScreen = document.querySelector("#game-over-screen");
    this.hud = document.querySelector("#hud");
    this.scoreValue = document.querySelector("#score-value");
    this.levelValue = document.querySelector("#level-value");
    this.levelProgressText = document.querySelector("#level-progress-text");
    this.levelProgressFill = document.querySelector("#level-progress-fill");
    this.chargeWrap = document.querySelector("#charge-wrap");
    this.chargeFill = document.querySelector("#charge-fill");
    this.aimHint = document.querySelector("#aim-hint");
    this.feedbackLayer = document.querySelector("#feedback-layer");
    this.finalResult = document.querySelector("#final-result");
    this.bestScore = document.querySelector("#best-score");
    this.rankingForm = document.querySelector("#ranking-form");
    this.playerName = document.querySelector("#player-name");
    this.leaderboardList = document.querySelector("#leaderboard-list");
    this.startButton = document.querySelector("#start-button");
    this.restartButton = document.querySelector("#restart-button");
    this.portalStatus = document.querySelector("#portal-status");
    this.portalRetry = document.querySelector("#portal-retry");
    this.leaderboardTitle = document.querySelector("#leaderboard-title");
  }

  bindActions({ onStart, onRestart, onSubmitScore }) {
    this.startButton.addEventListener("click", onStart);
    this.restartButton.addEventListener("click", onRestart);
    this.rankingForm.addEventListener("submit", (event) => {
      event.preventDefault();
      const accepted = onSubmitScore(this.playerName.value.trim());
      if (accepted) {
        this.rankingForm.classList.add("is-submitted");
      }
    });
  }

  showStartScreen() {
    this.startScreen.classList.remove("is-hidden");
    this.gameOverScreen.classList.add("is-hidden");
    this.hud.classList.add("is-hidden");
    this.hideCharge();
    this.setAimHint(false);
  }

  beginGame() {
    this.startScreen.classList.add("is-hidden");
    this.gameOverScreen.classList.add("is-hidden");
    this.hud.classList.remove("is-hidden");
    this.rankingForm.classList.remove("is-submitted");
    this.rankingForm.reset();
  }

  updateHud(score, level, successfulJumps) {
    const progress = successfulJumps % CONFIG.progression.jumpsPerLevel;
    const ratio = progress / CONFIG.progression.jumpsPerLevel;
    this.scoreValue.textContent = String(score);
    this.levelValue.textContent = `LV.${level}`;
    this.levelProgressText.textContent = `${progress}/${CONFIG.progression.jumpsPerLevel}`;
    this.levelProgressFill.style.width = `${ratio * 100}%`;
  }

  showCharge(progress = 0) {
    this.chargeWrap.classList.remove("is-hidden");
    this.updateCharge(progress);
  }

  updateCharge(progress) {
    this.chargeFill.style.width = `${clamp(progress, 0, 1) * 100}%`;
  }

  hideCharge() {
    this.chargeWrap.classList.add("is-hidden");
    this.chargeFill.style.width = "0%";
  }

  setAimHint(visible) {
    this.aimHint.classList.toggle("is-hidden", !visible);
  }

  showLandingFeedback({ perfect, points, combo }) {
    const main = document.createElement("div");
    main.className = `floating-feedback${perfect ? " perfect" : ""}`;
    main.textContent = perfect ? `PERFECT +${points}` : `+${points}`;
    this.addTemporaryFeedback(main);

    if (perfect && combo > 1) {
      const comboElement = document.createElement("div");
      comboElement.className = "floating-feedback combo";
      comboElement.textContent = `${combo} COMBO`;
      this.addTemporaryFeedback(comboElement);
    }
  }

  showLevelUp(level) {
    const element = document.createElement("div");
    element.className = "level-up";
    element.textContent = `LEVEL UP!  LV.${level}`;
    this.addTemporaryFeedback(element);
  }

  addTemporaryFeedback(element) {
    this.feedbackLayer.appendChild(element);
    element.addEventListener("animationend", () => element.remove(), {
      once: true,
    });
    window.setTimeout(() => element.remove(), 1400);
  }

  clearFeedback() {
    this.feedbackLayer.replaceChildren();
  }

  showGameOver({ score, level, bestScore, rankings }) {
    this.hud.classList.add("is-hidden");
    this.hideCharge();
    this.setAimHint(false);
    this.finalResult.textContent = `Score: ${score} · Lv.${level}`;
    this.bestScore.textContent = String(bestScore);
    this.renderRankings(rankings);
    this.leaderboardTitle.textContent = "本机记录";
    this.setPortalStatus("", false);
    this.rankingForm.classList.remove("is-submitted");
    this.rankingForm.reset();
    this.gameOverScreen.classList.remove("is-hidden");
  }

  renderRankings(rankings) {
    this.leaderboardList.replaceChildren();
    if (rankings.length === 0) {
      const empty = document.createElement("li");
      empty.className = "empty-ranking";
      empty.textContent = "还没有上榜记录";
      this.leaderboardList.appendChild(empty);
      return;
    }

    for (const [index, entry] of rankings.entries()) {
      const item = document.createElement("li");
      item.className = "leaderboard-row";
      const rank = document.createElement("span");
      rank.className = "leaderboard-rank";
      rank.textContent = String(index + 1).padStart(2, "0");
      const name = document.createElement("span");
      name.className = "leaderboard-name";
      name.textContent = entry.name;
      const result = document.createElement("span");
      result.className = "leaderboard-result";
      result.textContent = `${entry.score} 分 · Lv.${entry.level}`;
      const date = document.createElement("span");
      date.className = "leaderboard-date";
      date.textContent = this.formatDate(entry.createdAt);
      item.append(rank, name, result, date);
      this.leaderboardList.appendChild(item);
    }
  }

  formatDate(value) {
    if (!Number.isFinite(value) || value <= 0) return "—";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "—";
    return `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}`;
  }

  setPortalStatus(message, retryable = false) {
    this.portalStatus.textContent = message;
    this.portalStatus.classList.toggle("is-hidden", !message);
    this.portalRetry.classList.toggle("is-hidden", !retryable);
  }

  renderPortalRankings(entries) {
    this.leaderboardTitle.textContent = "全站排行榜";
    this.renderRankings(entries.map((entry) => ({
      name: entry.nickname,
      score: entry.metrics.score,
      level: entry.metrics.level,
      createdAt: entry.acceptedAt,
    })));
  }
}
