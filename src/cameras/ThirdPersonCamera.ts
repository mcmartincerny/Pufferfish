import RAPIER from "@dimforge/rapier3d-compat";
import { world } from "../Globals";
import { degToRad, Vector3 } from "../helpers";
import { BetterObject3D } from "../objects/BetterObject3D";
import { Euler, MathUtils, PerspectiveCamera, Quaternion } from "three";

export class ThirdPersonCamera extends BetterObject3D {
  camera: PerspectiveCamera;
  target: BetterObject3D;
  canvas: HTMLCanvasElement;
  maxZBellowTarget = 0.8;
  velocityMultiplier = 0.3;
  moveKp = 0.0015; // was 0.015
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
    this.target = target;
    this.camera = camera;
    this.canvas = canvas;
    this.rigidBody = world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic().setTranslation(target.position.x, target.position.y, target.position.z + this.zOffset)
    );
    this.rigidBody.setGravityScale(0, true);
    this.rigidBody.setLinearDamping(this.linearDamping);
    this.rigidBody.setAdditionalMass(0.01, true);
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
    const idealCameraPosition = this.getTargetPosition().setZ(this.getTargetPosition().z + this.zOffset);
    const offsetVector = new Vector3(0, 0, this.behindOffset);
    offsetVector.applyQuaternion(this.camera.quaternion);
    idealCameraPosition.add(offsetVector);
    if (idealCameraPosition.z < this.getTargetPosition().z - this.maxZBellowTarget) {
      idealCameraPosition.setZ(this.getTargetPosition().z - this.maxZBellowTarget);
    }
    if (isNaN(this.rigidBody!.translation().x)) {
      console.warn("Rigid body translation is NaN, setting to ideal camera position");
      this.rigidBody!.setTranslation(idealCameraPosition, true);
    }
    const cameraPosition = new Vector3(this.rigidBody!.translation());
    const error = idealCameraPosition.sub(cameraPosition);
    const force = error.multiplyScalar(this.moveKp * error.length());
    this.rigidBody!.applyImpulse(force, true);
  }

  updatePhysics(): void {
    this.camera.position.copy(this.rigidBody!.translation());
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

  getTargetPosition(): Vector3 {
    if (this.target.rigidBody) {
      return new Vector3(this.target.rigidBody.translation());
    } else {
      return new Vector3(this.target.position);
    }
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
