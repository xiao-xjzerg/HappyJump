export class InputManager {
  constructor(canvas) {
    this.canvas = canvas;
    this.handlers = {};
    this.turnKeys = { left: false, right: false };
    this.pointerCharging = false;
    this.spaceCharging = false;

    this.onKeyDown = this.onKeyDown.bind(this);
    this.onKeyUp = this.onKeyUp.bind(this);
    this.onPointerDown = this.onPointerDown.bind(this);
    this.onPointerUp = this.onPointerUp.bind(this);
    this.onPointerCancel = this.onPointerCancel.bind(this);
    this.onWindowBlur = this.onWindowBlur.bind(this);

    window.addEventListener("keydown", this.onKeyDown, { passive: false });
    window.addEventListener("keyup", this.onKeyUp, { passive: false });
    window.addEventListener("blur", this.onWindowBlur);
    canvas.addEventListener("pointerdown", this.onPointerDown, { passive: false });
    canvas.addEventListener("pointerup", this.onPointerUp, { passive: false });
    canvas.addEventListener("pointercancel", this.onPointerCancel, {
      passive: false,
    });
  }

  setHandlers(handlers) {
    this.handlers = handlers;
  }

  getTurnAxis() {
    return Number(this.turnKeys.right) - Number(this.turnKeys.left);
  }

  onKeyDown(event) {
    if (this.isTextInput(event.target)) {
      return;
    }

    if (event.code === "ArrowLeft" || event.code === "ArrowRight") {
      event.preventDefault();
      this.turnKeys[event.code === "ArrowLeft" ? "left" : "right"] = true;
      return;
    }

    if (event.code === "Space") {
      event.preventDefault();
      if (!event.repeat && !this.spaceCharging && !this.pointerCharging) {
        this.spaceCharging = true;
        this.handlers.onChargeStart?.();
      }
    }
  }

  onKeyUp(event) {
    if (event.code === "ArrowLeft" || event.code === "ArrowRight") {
      event.preventDefault();
      this.turnKeys[event.code === "ArrowLeft" ? "left" : "right"] = false;
      return;
    }

    if (event.code === "Space" && this.spaceCharging) {
      event.preventDefault();
      this.spaceCharging = false;
      this.handlers.onChargeEnd?.();
    }
  }

  onPointerDown(event) {
    if (event.button !== 0 || this.spaceCharging || this.pointerCharging) {
      return;
    }
    event.preventDefault();
    this.pointerCharging = true;
    this.canvas.setPointerCapture?.(event.pointerId);
    this.handlers.onChargeStart?.();
  }

  onPointerUp(event) {
    if (!this.pointerCharging) {
      return;
    }
    event.preventDefault();
    this.pointerCharging = false;
    this.handlers.onChargeEnd?.();
  }

  onPointerCancel(event) {
    if (!this.pointerCharging) {
      return;
    }
    event.preventDefault();
    this.pointerCharging = false;
    this.handlers.onChargeCancel?.();
  }

  onWindowBlur() {
    this.turnKeys.left = false;
    this.turnKeys.right = false;
    if (this.spaceCharging || this.pointerCharging) {
      this.spaceCharging = false;
      this.pointerCharging = false;
      this.handlers.onChargeCancel?.();
    }
  }

  isTextInput(target) {
    return (
      target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement ||
      target?.isContentEditable
    );
  }
}
