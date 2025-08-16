import RAPIER from "@dimforge/rapier3d-compat";
import { world } from "../Globals";
import { clamp, degToRad, Vector3 } from "../helpers";
import { BetterObject3D } from "../objects/BetterObject3D";
import { MathUtils, PerspectiveCamera } from "three";
import { Ship } from "../objects/Ship";

export class ThirdPersonCamera extends BetterObject3D {
  camera: PerspectiveCamera;
  _target!: BetterObject3D;
  canvas: HTMLCanvasElement;
  maxZBellowTarget = 0.8;
  velocityMultiplier = 0.3;
  moveKp = 0.015;
  linearDamping = 30;
  // Camera rotation
  mouseSensitivity = 0.004;
  minPitch = -70;
  maxPitch = 70;
  mouseMoveSinceLastFrameX = 0;
  mouseMoveSinceLastFrameY = 0;
  yaw = 0;
  pitch = 0;
  // Scroll configuration
  behindOffset = 10;
  minBehindOffset = 1;
  maxBehindOffset = 30;
  behindScrollStep = 1;
  zOffset = 2;
  minZOffset = -1;
  maxZOffset = 7;
  zScrollStep = 0.5;

  constructor(camera: PerspectiveCamera, target: BetterObject3D, canvas: HTMLCanvasElement) {
    super();
    this.camera = camera;
    this.canvas = canvas;
    this.target = target;
  }

  get target() {
    return this._target;
  }

  set target(newTarget: BetterObject3D) {
    this._target = newTarget;
  }

  setActive(active: boolean) {
    if (active) {
      (document.activeElement as HTMLElement)?.blur();
      document.addEventListener("pointerlockchange", this.pointerLockChangeListener);
      this.canvas.addEventListener("click", this.canvasClickListener);
      this.canvas.addEventListener("wheel", this.wheelListener, { passive: false });
    } else {
      document.exitPointerLock();
      document.removeEventListener("pointerlockchange", this.pointerLockChangeListener);
      this.canvas.removeEventListener("click", this.canvasClickListener);
      this.canvas.removeEventListener("mousemove", this.mouseMoveListener);
      this.canvas.removeEventListener("wheel", this.wheelListener);
    }
  }

  pointerLockChangeListener = () => {
    if (document.pointerLockElement === this.canvas) {
      this.canvas.addEventListener("mousemove", this.mouseMoveListener);
    } else {
      this.canvas.removeEventListener("mousemove", this.mouseMoveListener);
    }
  };

  canvasClickListener = () => {
    if (document.pointerLockElement !== this.canvas) {
      this.canvas.requestPointerLock({ unadjustedMovement: true });
    }
  };

  afterUpdate() {
    this.turnCameraBasedOnMouse();
    const targetPosition = this.getTargetPosition();
    const idealCameraPosition = targetPosition.clone().setZ(targetPosition.z + this.zOffset);
    // console.log(this.rigidBody.translation());
    const offsetVector = new Vector3(0, 0, this.behindOffset);
    offsetVector.applyQuaternion(this.camera.quaternion);
    idealCameraPosition.add(offsetVector);
    if (idealCameraPosition.z < targetPosition.z - this.maxZBellowTarget) {
      idealCameraPosition.setZ(targetPosition.z - this.maxZBellowTarget);
    }
    this.camera.position.copy(idealCameraPosition);
  }

  turnCameraBasedOnMouse(): void {
    this.yaw -= this.mouseMoveSinceLastFrameX * this.mouseSensitivity;
    this.pitch += this.mouseMoveSinceLastFrameY * this.mouseSensitivity;

    // Clamp pitch so you can’t go upside down
    this.pitch = Math.max(degToRad(this.minPitch), Math.min(degToRad(this.maxPitch), this.pitch));

    // Convert spherical coordinates → cartesian
    const target = this.target.position; // your player or object position
    const x = target.x + this.behindOffset * Math.cos(this.pitch) * Math.cos(this.yaw);
    const y = target.y + this.behindOffset * Math.cos(this.pitch) * Math.sin(this.yaw);
    const z = target.z + this.behindOffset * Math.sin(this.pitch);

    // Position and look at target
    this.camera.position.set(x, y, z);
    this.camera.lookAt(target);

    this.mouseMoveSinceLastFrameX = 0;
    this.mouseMoveSinceLastFrameY = 0;
  }

  getSomeTargetPosition(target: BetterObject3D): Vector3 {
    if (target.rigidBody) {
      return new Vector3(target.rigidBody.translation());
    } else if (target instanceof Ship) {
      return new Vector3(target.helm.rigidBody!.translation());
    } else {
      return new Vector3(target.position);
    }
  }

  getTargetPosition(): Vector3 {
    return this.getSomeTargetPosition(this.target);
  }

  getTargetVelocity(): Vector3 {
    if (this.target.rigidBody) {
      return new Vector3(this.target.rigidBody.linvel());
    } else {
      return new Vector3(0, 0, 0);
    }
  }

  dispose(): void {
    super.dispose();
    this.camera = null!;
    this.target = null!;
    this.canvas.removeEventListener("mousemove", this.mouseMoveListener);
    document.removeEventListener("pointerlockchange", this.pointerLockChangeListener);
    this.canvas.removeEventListener("click", this.canvasClickListener);
    this.canvas.removeEventListener("wheel", this.wheelListener);
  }

  wheelListener = (event: WheelEvent) => {
    // Prevent page from scrolling when adjusting camera
    event.preventDefault();

    const direction = Math.sign(event.deltaY) || 0; // 1: down, -1: up

    if (event.shiftKey) {
      // Adjust vertical offset while Shift is held
      this.zOffset -= direction * this.zScrollStep;
      this.zOffset = MathUtils.clamp(this.zOffset, this.minZOffset, this.maxZOffset);
    } else {
      // Adjust distance behind the target
      this.behindOffset += direction * this.behindScrollStep;
      this.behindOffset = MathUtils.clamp(this.behindOffset, this.minBehindOffset, this.maxBehindOffset);
    }
  };

  mouseMoveListener = (event: MouseEvent) => {
    this.mouseMoveSinceLastFrameX += event.movementX || 0;
    this.mouseMoveSinceLastFrameY += event.movementY || 0;
  };
}
