import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.162.0/build/three.module.js";
import { CONFIG, clamp, lerp } from "./config.js";

export class Player {
  constructor(scene) {
    this.root = new THREE.Group();
    this.model = new THREE.Group();
    this.root.add(this.model);
    this.scene = scene;
    this.scene.add(this.root);

    this.heading = 0;
    this.landingAge = CONFIG.player.landingDuration;
    this.failureVelocity = new THREE.Vector3();
    this.failureSpin = 0;
    this.flipDirection = 1;

    this.buildModel();
    this.buildDirectionArrow();
    this.setArrowVisible(false);
  }

  buildModel() {
    const bodyMaterial = new THREE.MeshToonMaterial({
      color: CONFIG.player.bodyColor,
    });
    const accentMaterial = new THREE.MeshToonMaterial({
      color: CONFIG.player.accentColor,
    });
    const faceMaterial = new THREE.MeshBasicMaterial({
      color: CONFIG.player.faceColor,
    });

    const body = new THREE.Mesh(
      new THREE.CylinderGeometry(
        CONFIG.player.bodyRadius * 0.86,
        CONFIG.player.bodyRadius,
        CONFIG.player.bodyHeight,
        20,
      ),
      bodyMaterial,
    );
    body.position.y = CONFIG.player.bodyHeight / 2 + 0.12;
    body.castShadow = true;
    body.receiveShadow = true;
    this.model.add(body);

    const headCenterY =
      CONFIG.player.bodyHeight + CONFIG.player.headRadius * 0.98 + 0.09;
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(CONFIG.player.headRadius, 24, 18),
      bodyMaterial,
    );
    head.position.y = headCenterY;
    head.castShadow = true;
    this.model.add(head);

    const cap = new THREE.Mesh(
      new THREE.SphereGeometry(
        CONFIG.player.headRadius * 0.76,
        20,
        12,
        0,
        Math.PI * 2,
        0,
        Math.PI / 2,
      ),
      accentMaterial,
    );
    cap.position.y = headCenterY + CONFIG.player.headRadius * 0.11;
    cap.castShadow = true;
    this.model.add(cap);

    const eyeGeometry = new THREE.SphereGeometry(
      CONFIG.player.headRadius * 0.075,
      8,
      6,
    );
    for (const xDirection of [-1, 1]) {
      const eye = new THREE.Mesh(eyeGeometry, faceMaterial);
      eye.position.set(
        xDirection * CONFIG.player.headRadius * 0.34,
        headCenterY + CONFIG.player.headRadius * 0.08,
        CONFIG.player.headRadius * 0.91,
      );
      this.model.add(eye);
    }

    const footGeometry = new THREE.SphereGeometry(
      CONFIG.player.footRadius,
      16,
      10,
    );
    for (const xDirection of [-1, 1]) {
      const foot = new THREE.Mesh(footGeometry, accentMaterial);
      foot.scale.set(0.7, 0.35, 1);
      foot.position.set(
        xDirection * CONFIG.player.bodyRadius * 0.52,
        0.08,
        CONFIG.player.footRadius * 0.24,
      );
      foot.castShadow = true;
      this.model.add(foot);
    }
  }

  buildDirectionArrow() {
    this.arrow = new THREE.Group();
    const material = new THREE.MeshBasicMaterial({
      color: CONFIG.player.arrowColor,
      transparent: true,
      opacity: 0.76,
      depthWrite: false,
    });
    const length = CONFIG.player.arrowLength;
    const shaft = new THREE.Mesh(
      new THREE.BoxGeometry(0.07, 0.035, length * 0.72),
      material,
    );
    shaft.position.set(0, CONFIG.player.arrowHeight, length * 0.46);
    this.arrow.add(shaft);

    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.17, 0.38, 18), material);
    tip.rotation.x = Math.PI / 2;
    tip.position.set(0, CONFIG.player.arrowHeight, length * 0.93);
    this.arrow.add(tip);
    this.root.add(this.arrow);
  }

  reset(position) {
    this.root.position.copy(position);
    this.root.rotation.set(0, 0, 0);
    this.model.rotation.set(0, 0, 0);
    this.model.position.set(0, 0, 0);
    this.model.scale.set(1, 1, 1);
    this.heading = 0;
    this.landingAge = CONFIG.player.landingDuration;
    this.failureVelocity.set(0, 0, 0);
    this.failureSpin = 0;
    this.setArrowVisible(false);
  }

  setPosition(position) {
    this.root.position.copy(position);
  }

  setHeading(heading) {
    this.heading = heading;
    this.root.rotation.y = heading;
  }

  turn(deltaRadians) {
    this.setHeading(this.heading + deltaRadians);
  }

  getDirection(target = new THREE.Vector3()) {
    return target.set(Math.sin(this.heading), 0, Math.cos(this.heading)).normalize();
  }

  setArrowVisible(isVisible) {
    this.arrow.visible = isVisible;
  }

  setCharge(progress) {
    const amount = clamp(progress, 0, 1);
    const scaleY = lerp(1, CONFIG.player.squashScaleY, amount);
    const scaleXZ = lerp(1, CONFIG.player.squashScaleXZ, amount);
    this.model.scale.set(scaleXZ, scaleY, scaleXZ);
  }

  cancelCharge() {
    this.model.scale.set(1, 1, 1);
  }

  beginJump() {
    this.flipDirection = Math.random() < 0.5 ? -1 : 1;
    this.model.scale.set(
      CONFIG.player.stretchScaleXZ,
      CONFIG.player.stretchScaleY,
      CONFIG.player.stretchScaleXZ,
    );
    this.setArrowVisible(false);
  }

  updateJump(progress) {
    const amount = clamp(progress, 0, 1);
    const stretchRecovery = clamp(amount / 0.2, 0, 1);
    this.model.scale.set(
      lerp(CONFIG.player.stretchScaleXZ, 1, stretchRecovery),
      lerp(CONFIG.player.stretchScaleY, 1, stretchRecovery),
      lerp(CONFIG.player.stretchScaleXZ, 1, stretchRecovery),
    );
    this.model.rotation.x =
      this.flipDirection * Math.PI * 2 * CONFIG.jump.flipTurns * amount;
  }

  beginLanding() {
    this.model.rotation.set(0, 0, 0);
    this.model.scale.set(1, 1, 1);
    this.landingAge = 0;
  }

  updateLanding(deltaSeconds) {
    this.landingAge = Math.min(
      CONFIG.player.landingDuration,
      this.landingAge + deltaSeconds,
    );
    const progress = this.landingAge / CONFIG.player.landingDuration;
    const pulse = Math.sin(progress * Math.PI) * (1 - progress);
    this.model.scale.set(1 + pulse * 0.11, 1 - pulse * 0.28, 1 + pulse * 0.11);
    if (progress >= 1) {
      this.model.scale.set(1, 1, 1);
    }
  }

  beginFailure(direction) {
    this.model.rotation.set(0, 0, 0);
    this.model.scale.set(1, 1, 1);
    this.failureVelocity.copy(direction).multiplyScalar(0.38);
    this.failureVelocity.y = 0.15;
    this.failureSpin = direction.x >= 0 ? -1 : 1;
    this.setArrowVisible(false);
  }

  updateFailure(deltaSeconds) {
    this.failureVelocity.y -= 4.8 * deltaSeconds;
    this.root.position.addScaledVector(this.failureVelocity, deltaSeconds);
    this.model.rotation.z += this.failureSpin * 2.4 * deltaSeconds;
    this.model.rotation.x += 1.1 * deltaSeconds;
  }
}
