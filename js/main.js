import { CONFIG } from "./config.js";
import { Game } from "./game.js";
import { GameHubAdapter } from "./gamehub.js";
import { InputManager } from "./input.js";
import { PlatformManager } from "./platform.js";
import { Player } from "./player.js";
import { SceneManager } from "./scene.js";
import { UIManager } from "./ui.js";

const canvas = document.querySelector("#game-canvas");
const sceneManager = new SceneManager(canvas);
const platformManager = new PlatformManager(sceneManager.scene);
const player = new Player(sceneManager.scene);
const input = new InputManager(canvas);
const ui = new UIManager();
const gamehub = new GameHubAdapter(ui);
const game = new Game({
  sceneManager,
  player,
  platformManager,
  input,
  ui,
  callbacks: {
    onStart: () => gamehub.onStart(),
    onGameOver: (metrics) => gamehub.onGameOver(metrics),
  },
});
gamehub.activate(game);

input.setHandlers({
  onChargeStart: () => game.handleChargeStart(),
  onChargeEnd: () => game.handleChargeEnd(),
  onChargeCancel: () => game.handleChargeCancel(),
});

ui.bindActions({
  onStart: () => game.start(),
  onRestart: () => game.start(),
  onSubmitScore: (name) => {
    const accepted = game.submitScore(name);
    if (accepted) gamehub.onLocalScoreAccepted(name);
    return accepted;
  },
});

window.addEventListener("resize", () => sceneManager.resize());

let previousTime = performance.now();
function animate(now) {
  const deltaSeconds = Math.min(
    (now - previousTime) / 1000,
    CONFIG.timing.maxFrameDelta,
  );
  previousTime = now;

  game.update(now, deltaSeconds);
  sceneManager.updateEffects(deltaSeconds);
  sceneManager.updateCamera(
    player.root.position,
    game.getTargetFocus(),
    deltaSeconds,
    game.getFailureProgress(),
  );
  sceneManager.render();
  requestAnimationFrame(animate);
}

requestAnimationFrame(animate);

export { game };
