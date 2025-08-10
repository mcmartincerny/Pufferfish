import { PerspectiveCamera } from "three";
import { TopDownCamera } from "./TopDownCamera.ts";
import { BetterObject3D } from "../objects/BetterObject3D";
// @ts-ignore
import { OrbitControls } from "three/addons/controls/OrbitControls";
export enum CameraType {
  Free = "Free",
  TopDown = "TopDown",
  None = "None",
}

export class CameraSwitcher {
  canvasElement: HTMLCanvasElement;
  cameraTarget: BetterObject3D;
  type: CameraType;
  fov = 75;
  aspect = 2;
  near = 0.2;
  far = 200;
  camera: PerspectiveCamera = new PerspectiveCamera(this.fov, this.aspect, this.near, this.far);
  orbitControls?: OrbitControls;
  followingCamera?: TopDownCamera;

  constructor(canvasElement: HTMLCanvasElement, cameraTarget?: BetterObject3D, cameraType: CameraType = CameraType.Free) {
    this.canvasElement = canvasElement;
    this.type = cameraType;
    if (!cameraTarget) {
      cameraTarget = new BetterObject3D();
      cameraTarget.position.set(0, 0, 0);
      cameraTarget.init();
    }

    this.cameraTarget = cameraTarget;
    this.camera.up.set(0, 0, 1);
    this.camera.position.z = 4;
    this.camera.position.y = -5;
    this.switchCamera(this.type);
  }

  switchCamera(type: CameraType) {
    if (this.type === CameraType.Free) {
      this.unswitchFromFreeCamera();
    } else if (this.type === CameraType.TopDown) {
      this.unswitchFromFollowCamera();
    }

    this.type = type;

    if (this.type === CameraType.Free) {
      this.switchToFreeCamera();
    } else if (this.type === CameraType.TopDown) {
      this.switchToFollowCamera();
    }
  }

  switchToFreeCamera() {
    if (!this.orbitControls) {
      this.orbitControls = new OrbitControls(this.camera, this.canvasElement);
      this.orbitControls.enableDamping = true;
      this.orbitControls.dampingFactor = 0.25;
      this.orbitControls.target.set(0, 3, 2);
      this.orbitControls.update();
    } else {
      this.orbitControls.connect();
    }
  }

  unswitchFromFreeCamera() {
    if (this.orbitControls) {
      this.orbitControls.disconnect();
    }
  }

  switchToFollowCamera() {
    if (!this.followingCamera) {
      this.followingCamera = new TopDownCamera(this.camera, this.cameraTarget, this.canvasElement);
      this.followingCamera.init();
    }
  }

  unswitchFromFollowCamera() {}

  beforeStep() {
    if (this.type === CameraType.TopDown) {
      this.followingCamera?.beforeStep();
    }
  }

  afterStep() {
    if (this.type === CameraType.TopDown) {
      this.followingCamera?.afterStep();
    }
  }

  dispose() {
    this.unswitchFromFreeCamera();
    this.unswitchFromFollowCamera();
    this.orbitControls?.dispose();
    this.followingCamera?.dispose();
  }
}
