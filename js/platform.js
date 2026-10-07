import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.162.0/build/three.module.js";
import {
  CONFIG,
  getDifficultyParams,
  randomBetween,
} from "./config.js";

export class Platform {
  constructor({ position, size, shape, color, routeHeading = 0 }) {
    this.size = size;
    this.shape = shape;
    this.routeHeading = routeHeading;
    this.group = new THREE.Group();
    this.group.position.copy(position);

    const geometry =
      shape === "circle"
        ? new THREE.CylinderGeometry(size / 2, size / 2, CONFIG.platform.height, 32)
        : new THREE.BoxGeometry(size, CONFIG.platform.height, size);
    const material = new THREE.MeshToonMaterial({ color });
    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    this.group.add(this.mesh);
  }

  get position() {
    return this.group.position;
  }

  get topY() {
    return (
      this.group.position.y +
      this.mesh.position.y +
      (CONFIG.platform.height * this.mesh.scale.y) / 2
    );
  }

  setChargeCompression(progress) {
    this.mesh.position.y = -CONFIG.platform.chargePressDepth * progress;
  }

  resetCompression() {
    this.mesh.position.y = 0;
    this.mesh.scale.y = 1;
  }

  containsPoint(point) {
    const dx = point.x - this.position.x;
    const dz = point.z - this.position.z;
    const halfSize = this.size / 2 - CONFIG.platform.edgeSafetyMargin;

    if (this.shape === "circle") {
      return dx * dx + dz * dz <= halfSize * halfSize;
    }
    return Math.abs(dx) <= halfSize && Math.abs(dz) <= halfSize;
  }

  distanceFromCenter(point) {
    return Math.hypot(point.x - this.position.x, point.z - this.position.z);
  }

  dispose() {
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
  }
}

export class PlatformManager {
  constructor(scene) {
    this.scene = scene;
    this.platforms = [];
  }

  reset() {
    for (const platform of this.platforms) {
      this.scene.remove(platform.group);
      platform.dispose();
    }
    this.platforms.length = 0;
  }

  createInitialPlatform() {
    const platform = new Platform({
      position: new THREE.Vector3(0, 0, 0),
      size: CONFIG.platform.initialSize,
      shape: "square",
      color: CONFIG.platform.colors[0],
      routeHeading: 0,
    });
    this.add(platform);
    return platform;
  }

  generateNext(currentPlatform, level) {
    const difficulty = getDifficultyParams(level);
    const turnMagnitude = randomBetween(
      CONFIG.progression.minTurnDegrees,
      Math.max(CONFIG.progression.minTurnDegrees, difficulty.maxTurnAngle),
    );
    const turnDirection = Math.random() < 0.5 ? -1 : 1;
    const routeHeading =
      currentPlatform.routeHeading +
      THREE.MathUtils.degToRad(turnMagnitude * turnDirection);
    const distance = randomBetween(
      difficulty.minDistance,
      difficulty.maxDistance,
    );
    const minimumSize = Math.max(
      CONFIG.platform.absoluteMinSize,
      CONFIG.platform.minSize * difficulty.platformScale,
    );
    const maximumSize = Math.max(
      minimumSize,
      CONFIG.platform.maxSize * difficulty.platformScale,
    );
    const size = randomBetween(minimumSize, maximumSize);
    const position = currentPlatform.position
      .clone()
      .add(
        new THREE.Vector3(
          Math.sin(routeHeading) * distance,
          0,
          Math.cos(routeHeading) * distance,
        ),
      );
    const shape = Math.random() < 0.5 ? "square" : "circle";
    const color =
      CONFIG.platform.colors[
        Math.floor(Math.random() * CONFIG.platform.colors.length)
      ];

    const platform = new Platform({
      position,
      size,
      shape,
      color,
      routeHeading,
    });
    this.add(platform);
    return platform;
  }

  add(platform) {
    this.platforms.push(platform);
    this.scene.add(platform.group);
  }

  recycleOldPlatforms() {
    while (this.platforms.length > CONFIG.platform.retentionCount + 1) {
      const platform = this.platforms.shift();
      this.scene.remove(platform.group);
      platform.dispose();
    }
  }
}
