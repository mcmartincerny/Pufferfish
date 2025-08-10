import RAPIER from "@dimforge/rapier3d-compat";
import { world } from "../Globals";
import { Vector3 } from "../helpers";
import { BetterObject3D } from "../objects/BetterObject3D";
import { PerspectiveCamera } from "three";

export class TopDownCamera extends BetterObject3D {
  camera: PerspectiveCamera;
  target: BetterObject3D;
  canvas: HTMLCanvasElement;
  zOffset = 50;
  velocityMultiplier = 1;
  lookAtMouseMultiplier = 1;
  moveKp = 0.003;
  linearDamping = 3;
  mouseX = 50;
  mouseY = 50;
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
    this.rigidBody.setAdditionalMass(0.1, true);
    canvas.addEventListener("mousemove", this.mouseMoveListener);
  }

  afterUpdate() {
    const idealCameraPosition = this.getTargetPosition()
      .add(new Vector3(0, 0, this.zOffset))
      .add(this.getTargetVelocity().multiplyScalar(this.velocityMultiplier));
    const cameraPosition = new Vector3(this.rigidBody!.translation());
    const error = idealCameraPosition.sub(cameraPosition);
    const force = error.multiplyScalar(this.moveKp);
    this.rigidBody!.applyImpulse(force, true);
  }

  updatePhysics(): void {
    this.camera.position.copy(this.rigidBody!.translation());
    const rotationX = -((this.mouseX - 50) / 100) * this.lookAtMouseMultiplier;
    const rotationY = -((this.mouseY - 50) / 100) * this.lookAtMouseMultiplier;
    this.camera.setRotationFromAxisAngle(new Vector3(rotationY, rotationX, 0), 1);
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
  }

  mouseMoveListener = (event: MouseEvent) => {
    const rect = this.canvas.getBoundingClientRect();

    // Get mouse position relative to the element
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    // Calculate percentage (0 to 100)
    this.mouseX = (x / rect.width) * 100;
    this.mouseY = (y / rect.height) * 100;
  };
}
