import { PerspectiveCamera } from "three";
import { BetterObject3D } from "../objects/BetterObject3D";
// @ts-ignore
import { OrbitControls } from "three/addons/controls/OrbitControls";
import { ThirdPersonCamera } from "./ThirdPersonCamera";
import { BuildCamera } from "./BuildCamera";
import { GameStore } from "../ui/GameContext.tsx";
import { setMainCamera } from "../Globals.ts";
export enum CameraType {
  Free = "Free",
  ThirdPerson = "ThirdPerson",
  BuildCamera = "BuildCamera",
  None = "None",
}

// TODO: CameraSwitcher has too much camera manager specific code that should be refactored into the camera managers
// There should be some camera manager interface that all camera managers implement

export class CameraSwitcher {
  canvasElement: HTMLCanvasElement;
  type: CameraType;
  fov = 75;
  aspect = 2;
  near = 0.2;
  far = 950; // should be little more than sky
  camera: PerspectiveCamera = new PerspectiveCamera(this.fov, this.aspect, this.near, this.far);
  orbitControls?: OrbitControls;
  thirdPersonCamera?: ThirdPersonCamera;
  buildCamera?: BuildCamera;
  currentCameraManager?: OrbitControls | ThirdPersonCamera | BuildCamera;
  disposeFunctions: (() => void)[] = [];

  constructor(canvasElement: HTMLCanvasElement, cameraType: CameraType = CameraType.ThirdPerson) {
    setMainCamera(this.camera);
    this.canvasElement = canvasElement;
    this.type = cameraType;
    this.camera.up.set(0, 0, 1);
    this.camera.position.z = 4;
    this.camera.position.y = -10;
    this.camera.position.x = 0;
    this.switchCamera(this.type);

    const store = GameStore.getInstance();
    const unsubscribeMode = store.subscribe("mode", (mode) => {
      switch (mode) {
        case "third_person":
          this.switchCamera(CameraType.ThirdPerson);
          this.canvasElement.requestPointerLock({ unadjustedMovement: true });
          break;
        case "build":
          this.switchCamera(CameraType.BuildCamera);
      }
    });
    this.disposeFunctions.push(unsubscribeMode);
  }

  switchCamera(type: CameraType) {
    if (this.type === CameraType.Free) {
      this.unswitchFromFreeCamera();
    } else if (this.type === CameraType.ThirdPerson) {
      this.unswitchFromThirdPersonCamera();
    } else if (this.type === CameraType.BuildCamera) {
      this.unswitchFromBuildCamera();
    }

    this.type = type;

    if (this.type === CameraType.Free) {
      this.switchToFreeCamera();
      this.currentCameraManager = this.orbitControls;
    } else if (this.type === CameraType.ThirdPerson) {
      this.switchToThirdPersonCamera();
      this.currentCameraManager = this.thirdPersonCamera;
    } else if (this.type === CameraType.BuildCamera) {
      this.switchToBuildCamera();
      this.currentCameraManager = this.buildCamera;
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

  switchToThirdPersonCamera() {
    if (!this.thirdPersonCamera) {
      this.thirdPersonCamera = new ThirdPersonCamera(this.camera, this.canvasElement);
    }
    this.thirdPersonCamera.setActive(true);
  }

  unswitchFromThirdPersonCamera() {
    this.thirdPersonCamera?.setActive(false);
  }

  switchToBuildCamera() {
    if (!this.buildCamera) {
      this.buildCamera = new BuildCamera(this.camera, this.canvasElement);
    }
    this.buildCamera.setActive(true);
  }

  unswitchFromBuildCamera() {
    this.buildCamera?.setActive(false);
  }

  beforeStep() {
    this.currentCameraManager?.beforeStep?.();
  }

  afterStep() {
    this.currentCameraManager?.afterStep?.();
  }

  dispose() {
    this.unswitchFromFreeCamera();
    this.unswitchFromThirdPersonCamera();
    this.unswitchFromBuildCamera();
    this.orbitControls?.dispose();
    this.thirdPersonCamera?.dispose();
    this.buildCamera?.dispose();
    this.disposeFunctions.forEach((fn) => fn());
  }
}
