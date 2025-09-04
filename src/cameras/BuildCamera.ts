import { Vector3, clamp, degToRad } from "../helpers";
import { BetterObject3D } from "../objects/BetterObject3D";
import { PerspectiveCamera } from "three";

export class BuildCamera extends BetterObject3D {
  camera: PerspectiveCamera;
  _target!: BetterObject3D;
  canvas: HTMLCanvasElement;

  // Camera configuration
  distance = 15;
  minDistance = 3;
  maxDistance = 50;
  scrollStep = 2;

  // Rotation controls (only when right mouse is held)
  yaw = 0;
  pitch = 0;
  minPitch = -89;
  maxPitch = 89;
  mouseSensitivity = 0.005;

  // Mouse state
  isRightMouseDown = false;
  lastMouseX = 0;
  lastMouseY = 0;

  constructor(camera: PerspectiveCamera, target: BetterObject3D, canvas: HTMLCanvasElement) {
    super();
    this.camera = camera;
    this.canvas = canvas;
    this.target = target;

    // Set initial rotation to look at target from a nice angle
    this.yaw = Math.PI / 4; // 45 degrees
    this.pitch = Math.PI / 6; // 30 degrees

    this.setupEventListeners();
  }

  get target() {
    return this._target;
  }

  set target(newTarget: BetterObject3D) {
    this._target = newTarget;
  }

  setActive(active: boolean) {
    if (active) {
      // Add event listeners
      this.setupEventListeners();
    } else {
      // Remove event listeners
      this.removeEventListeners();
    }
  }

  private setupEventListeners() {
    this.canvas.addEventListener("mousedown", this.mouseDownListener);
    this.canvas.addEventListener("mouseup", this.mouseUpListener);
    this.canvas.addEventListener("mousemove", this.mouseMoveListener);
    this.canvas.addEventListener("wheel", this.wheelListener, { passive: false });
    this.canvas.addEventListener("contextmenu", this.contextMenuListener);
  }

  private removeEventListeners() {
    this.canvas.removeEventListener("mousedown", this.mouseDownListener);
    this.canvas.removeEventListener("mouseup", this.mouseUpListener);
    this.canvas.removeEventListener("mousemove", this.mouseMoveListener);
    this.canvas.removeEventListener("wheel", this.wheelListener);
    this.canvas.removeEventListener("contextmenu", this.contextMenuListener);
  }

  afterUpdate() {
    this.updateCameraPosition();
  }

  private updateCameraPosition() {
    // Get target position
    const targetPos = this.getTargetPosition();

    // Convert spherical coordinates to cartesian
    const x = targetPos.x + this.distance * Math.cos(this.pitch) * Math.cos(this.yaw);
    const y = targetPos.y + this.distance * Math.cos(this.pitch) * Math.sin(this.yaw);
    const z = targetPos.z + this.distance * Math.sin(this.pitch);

    // Set camera position and look at target
    this.camera.position.set(x, y, z);
    this.camera.lookAt(targetPos.x, targetPos.y, targetPos.z);
  }

  private getTargetPosition(): Vector3 {
    if (this.target.rigidBody) {
      return new Vector3(this.target.rigidBody.translation());
    } else {
      return new Vector3(this.target.position);
    }
  }

  private mouseDownListener = (event: MouseEvent) => {
    if (event.button === 2) {
      // Right mouse button
      event.preventDefault();
      this.isRightMouseDown = true;
      this.lastMouseX = event.clientX;
      this.lastMouseY = event.clientY;
      this.canvas.style.cursor = "grabbing";
    }
  };

  private mouseUpListener = (event: MouseEvent) => {
    if (event.button === 2) {
      event.preventDefault();
      // Right mouse button
      this.isRightMouseDown = false;
      this.canvas.style.cursor = "default";
    }
  };

  private mouseMoveListener = (event: MouseEvent) => {
    if (this.isRightMouseDown) {
      const deltaX = event.clientX - this.lastMouseX;
      const deltaY = event.clientY - this.lastMouseY;

      // Update yaw and pitch based on mouse movement
      this.yaw -= deltaX * this.mouseSensitivity;
      this.pitch += deltaY * this.mouseSensitivity;

      // Clamp pitch to prevent flipping
      this.pitch = clamp(this.pitch, degToRad(this.minPitch), degToRad(this.maxPitch));

      this.lastMouseX = event.clientX;
      this.lastMouseY = event.clientY;
    }
  };

  private wheelListener = (event: WheelEvent) => {
    event.preventDefault();

    const direction = Math.sign(event.deltaY);
    this.distance += direction * this.scrollStep;
    this.distance = clamp(this.distance, this.minDistance, this.maxDistance);
  };

  private contextMenuListener = (event: MouseEvent) => {
    event.preventDefault();
  };

  dispose(): void {
    super.dispose();
    this.removeEventListeners();
    this.camera = null!;
    this.target = null!;
    this.canvas = null!;
  }
}
