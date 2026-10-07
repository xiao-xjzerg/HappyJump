import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.162.0/build/three.module.js";
import { CONFIG, clamp, lerp, randomBetween } from "./config.js";

export class SceneManager {
  constructor(canvas) {
    this.canvas = canvas;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(CONFIG.renderer.clearColor);
    this.scene.fog = new THREE.Fog(
      CONFIG.scene.fogColor,
      CONFIG.scene.fogNear,
      CONFIG.scene.fogFar,
    );

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: "high-performance",
    });
    this.renderer.setPixelRatio(
      Math.min(window.devicePixelRatio || 1, CONFIG.renderer.maxPixelRatio),
    );
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.camera = new THREE.OrthographicCamera(
      -1,
      1,
      1,
      -1,
      CONFIG.camera.near,
      CONFIG.camera.far,
    );
    this.cameraFocus = new THREE.Vector3();
    this.desiredFocus = new THREE.Vector3();
    this.cameraOffset = new THREE.Vector3(
      CONFIG.camera.offset.x,
      CONFIG.camera.offset.y,
      CONFIG.camera.offset.z,
    );
    const cameraForward = this.cameraOffset.clone().normalize().negate();
    this.cameraRight = new THREE.Vector3(
      this.cameraOffset.z,
      0,
      -this.cameraOffset.x,
    ).normalize();
    this.cameraUp = this.cameraRight.clone().cross(cameraForward).normalize();
    this.effects = [];

    this.setupLighting();
    this.resize();
  }

  setupLighting() {
    const ambient = new THREE.AmbientLight(
      CONFIG.scene.ambientColor,
      CONFIG.scene.ambientIntensity,
    );
    this.scene.add(ambient);

    this.sun = new THREE.DirectionalLight(
      CONFIG.scene.sunColor,
      CONFIG.scene.sunIntensity,
    );
    this.sun.position.set(
      CONFIG.scene.sunPosition.x,
      CONFIG.scene.sunPosition.y,
      CONFIG.scene.sunPosition.z,
    );
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(
      CONFIG.renderer.shadowMapSize,
      CONFIG.renderer.shadowMapSize,
    );
    this.sun.shadow.camera.left = -12;
    this.sun.shadow.camera.right = 12;
    this.sun.shadow.camera.top = 12;
    this.sun.shadow.camera.bottom = -12;
    this.sun.shadow.camera.near = 1;
    this.sun.shadow.camera.far = 35;
    this.sun.shadow.bias = -0.0007;
    this.sunTarget = new THREE.Object3D();
    this.scene.add(this.sun, this.sunTarget);
    this.sun.target = this.sunTarget;
  }

  resize() {
    const width = Math.max(1, window.innerWidth);
    const height = Math.max(1, window.innerHeight);
    const aspect = width / height;
    const viewSize =
      aspect < CONFIG.camera.portraitBreakpoint
        ? CONFIG.camera.viewSizePortrait
        : CONFIG.camera.viewSizeDesktop;

    this.camera.left = (-viewSize * aspect) / 2;
    this.camera.right = (viewSize * aspect) / 2;
    this.camera.top = viewSize / 2;
    this.camera.bottom = -viewSize / 2;
    this.camera.updateProjectionMatrix();

    this.renderer.setPixelRatio(
      Math.min(window.devicePixelRatio || 1, CONFIG.renderer.maxPixelRatio),
    );
    this.renderer.setSize(width, height, false);
  }

  setCameraFocusImmediate(playerPosition, targetPosition = playerPosition) {
    this.calculateDesiredFocus(playerPosition, targetPosition, 0);
    this.cameraFocus.copy(this.desiredFocus);
    this.positionCamera();
  }

  updateCamera(playerPosition, targetPosition, deltaSeconds, failureProgress = 0) {
    this.calculateDesiredFocus(playerPosition, targetPosition, failureProgress);
    const followAmount = 1 - Math.exp(-CONFIG.camera.followSpeed * deltaSeconds);
    this.cameraFocus.lerp(this.desiredFocus, followAmount);
    this.positionCamera();
  }

  calculateDesiredFocus(playerPosition, targetPosition, failureProgress) {
    this.desiredFocus
      .copy(playerPosition)
      .lerp(targetPosition ?? playerPosition, CONFIG.camera.leadTowardTarget);
    this.desiredFocus.addScaledVector(
      this.cameraRight,
      CONFIG.camera.screenBiasRight,
    );
    this.desiredFocus.addScaledVector(this.cameraUp, CONFIG.camera.screenBiasUp);
    this.desiredFocus.y -=
      clamp(failureProgress, 0, 1) * CONFIG.camera.failureDrop;
  }

  positionCamera() {
    this.camera.position.copy(this.cameraFocus).add(this.cameraOffset);
    this.camera.lookAt(this.cameraFocus);
    this.camera.updateMatrixWorld();
    this.sun.position.set(
      this.cameraFocus.x + CONFIG.scene.sunPosition.x,
      this.cameraFocus.y + CONFIG.scene.sunPosition.y,
      this.cameraFocus.z + CONFIG.scene.sunPosition.z,
    );
    this.sunTarget.position.copy(this.cameraFocus);
    this.sunTarget.updateMatrixWorld();
  }

  createPerfectEffect(position) {
    const ringGeometry = new THREE.RingGeometry(0.26, 0.34, 40);
    const ringMaterial = new THREE.MeshBasicMaterial({
      color: CONFIG.effects.ringColor,
      transparent: true,
      opacity: CONFIG.effects.ringOpacity,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const ring = new THREE.Mesh(ringGeometry, ringMaterial);
    ring.rotation.x = -Math.PI / 2;
    ring.position.copy(position);
    ring.position.y += 0.035;
    ring.scale.setScalar(CONFIG.effects.ringStartScale);
    this.scene.add(ring);
    this.effects.push({
      kind: "ring",
      object: ring,
      age: 0,
      life: CONFIG.effects.ringLife,
      geometry: ringGeometry,
      material: ringMaterial,
    });

    const particleGeometry = new THREE.SphereGeometry(
      CONFIG.effects.particleSize,
      7,
      5,
    );
    const particleMaterial = new THREE.MeshBasicMaterial({
      color: CONFIG.effects.ringColor,
      transparent: true,
      opacity: 1,
    });
    const group = new THREE.Group();
    const particles = [];

    for (let index = 0; index < CONFIG.effects.particleCount; index += 1) {
      const angle = (index / CONFIG.effects.particleCount) * Math.PI * 2;
      const speed = randomBetween(
        CONFIG.effects.particleSpeedMin,
        CONFIG.effects.particleSpeedMax,
      );
      const particle = new THREE.Mesh(particleGeometry, particleMaterial);
      particle.position.copy(position);
      particle.position.y += 0.08;
      group.add(particle);
      particles.push({
        mesh: particle,
        velocity: new THREE.Vector3(
          Math.cos(angle) * speed,
          randomBetween(speed * 0.35, speed * 0.72),
          Math.sin(angle) * speed,
        ),
      });
    }

    this.scene.add(group);
    this.effects.push({
      kind: "particles",
      object: group,
      particles,
      age: 0,
      life: CONFIG.effects.particleLife,
      geometry: particleGeometry,
      material: particleMaterial,
    });
  }

  updateEffects(deltaSeconds) {
    for (let index = this.effects.length - 1; index >= 0; index -= 1) {
      const effect = this.effects[index];
      effect.age += deltaSeconds;
      const progress = clamp(effect.age / effect.life, 0, 1);

      if (effect.kind === "ring") {
        const scale = lerp(
          CONFIG.effects.ringStartScale,
          CONFIG.effects.ringEndScale,
          progress,
        );
        effect.object.scale.setScalar(scale);
        effect.material.opacity = CONFIG.effects.ringOpacity * (1 - progress);
      } else {
        effect.material.opacity = 1 - progress;
        for (const particle of effect.particles) {
          particle.velocity.y -= CONFIG.effects.particleGravity * deltaSeconds;
          particle.mesh.position.addScaledVector(particle.velocity, deltaSeconds);
        }
      }

      if (progress >= 1) {
        this.disposeEffect(effect);
        this.effects.splice(index, 1);
      }
    }
  }

  clearEffects() {
    for (const effect of this.effects) {
      this.disposeEffect(effect);
    }
    this.effects.length = 0;
  }

  disposeEffect(effect) {
    this.scene.remove(effect.object);
    effect.geometry.dispose();
    effect.material.dispose();
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }
}
