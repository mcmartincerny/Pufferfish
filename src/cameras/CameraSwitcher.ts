import { PerspectiveCamera } from "three";
import { TopDownCamera } from "./TopDownCamera.ts";
import { BetterObject3D } from "../objects/BetterObject3D";
// @ts-ignore
import { OrbitControls } from "three/addons/controls/OrbitControls";
import { ThirdPersonCamera } from "./ThirdPersonCamera";
import { BuildCamera } from "./BuildCamera";
import { GameStore } from "../ui/GameContext.tsx";
import { clamp, degToRad } from "../helpers.ts";
export enum CameraType {
  Free = "Free",
  TopDown = "TopDown",
  ThirdPerson = "ThirdPerson",
  BuildCamera = "BuildCamera",
  None = "None",
}

// TODO: CameraSwitcher has too much camera manager specific code that should be refactored into the camera managers
// There should be some camera manager interface that all camera managers implement

export class CameraSwitcher {
  canvasElement: HTMLCanvasElement;
  cameraTarget: BetterObject3D;
  type: CameraType;
  fov = 75;
  aspect = 2;
  near = 0.2;
  far = 950; // should be little more than sky
  camera: PerspectiveCamera = new PerspectiveCamera(this.fov, this.aspect, this.near, this.far);
  orbitControls?: OrbitControls;
  followingCamera?: TopDownCamera;
  thirdPersonCamera?: ThirdPersonCamera;
  buildCamera?: BuildCamera;
  currentCameraManager?: OrbitControls | TopDownCamera | ThirdPersonCamera | BuildCamera;
  disposeFunctions: (() => void)[] = [];

  // Store pitch, yaw, and offset for camera switching
  private lastPitch = 0;
  private lastYaw = 0;
  private lastDistance = 10;

  // Helper methods to get/set pitch and yaw from cameras
  private getCurrentCameraRotationAndOffset() {
    if (this.currentCameraManager?.pitch && this.currentCameraManager?.yaw && this.currentCameraManager?.distance) {
      return { pitch: this.currentCameraManager.pitch, yaw: this.currentCameraManager.yaw, distance: this.currentCameraManager.distance };
    }
    return null;
  }

  private setCameraRotationAndOffset(pitch: number, yaw: number, distance: number) {
    if (this.currentCameraManager?.pitch && this.currentCameraManager?.yaw && this.currentCameraManager?.minPitch && this.currentCameraManager?.maxPitch) {
      const clampedPitch = clamp(pitch, degToRad(this.currentCameraManager.minPitch), degToRad(this.currentCameraManager.maxPitch));
      this.currentCameraManager.pitch = clampedPitch;
      this.currentCameraManager.yaw = yaw;
    }
    if (this.currentCameraManager?.distance && this.currentCameraManager?.minDistance && this.currentCameraManager?.maxDistance) {
      const clampedDistance = clamp(distance, this.currentCameraManager.minDistance, this.currentCameraManager.maxDistance);
      this.currentCameraManager.distance = clampedDistance;
    }
  }

  constructor(canvasElement: HTMLCanvasElement, cameraTarget?: BetterObject3D, cameraType: CameraType = CameraType.ThirdPerson) {
    this.canvasElement = canvasElement;
    this.type = cameraType;
    if (!cameraTarget) {
      cameraTarget = new BetterObject3D();
      cameraTarget.position.set(0, 0, 0);
    }

    this.cameraTarget = cameraTarget;
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

  setTarget(target: BetterObject3D) {
    this.cameraTarget = target;
    if (this.thirdPersonCamera) {
      this.thirdPersonCamera.target = target;
    }
    if (this.followingCamera) {
      this.followingCamera.target = target;
    }
    if (this.buildCamera) {
      this.buildCamera.target = target;
    }
  }

  switchCamera(type: CameraType) {
    // Store current rotation and offset before switching away from ThirdPerson or BuildCamera
    const currentRotationAndOffset = this.getCurrentCameraRotationAndOffset();
    if (currentRotationAndOffset) {
      this.lastPitch = currentRotationAndOffset.pitch;
      this.lastYaw = currentRotationAndOffset.yaw;
      this.lastDistance = currentRotationAndOffset.distance;
    }

    if (this.type === CameraType.Free) {
      this.unswitchFromFreeCamera();
    } else if (this.type === CameraType.TopDown) {
      this.unswitchFromFollowCamera();
    } else if (this.type === CameraType.ThirdPerson) {
      this.unswitchFromThirdPersonCamera();
    } else if (this.type === CameraType.BuildCamera) {
      this.unswitchFromBuildCamera();
    }

    this.type = type;

    if (this.type === CameraType.Free) {
      this.switchToFreeCamera();
      this.currentCameraManager = this.orbitControls;
    } else if (this.type === CameraType.TopDown) {
      this.switchToFollowCamera();
      this.currentCameraManager = this.followingCamera;
    } else if (this.type === CameraType.ThirdPerson) {
      this.switchToThirdPersonCamera();
      this.currentCameraManager = this.thirdPersonCamera;
    } else if (this.type === CameraType.BuildCamera) {
      this.switchToBuildCamera();
      this.currentCameraManager = this.buildCamera;
    }

    this.setCameraRotationAndOffset(this.lastPitch, this.lastYaw, this.lastDistance);
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
    }
  }

  unswitchFromFollowCamera() {}

  switchToThirdPersonCamera() {
    if (!this.thirdPersonCamera) {
      this.thirdPersonCamera = new ThirdPersonCamera(this.camera, this.cameraTarget, this.canvasElement);
    }
    this.thirdPersonCamera.setActive(true);
  }

  unswitchFromThirdPersonCamera() {
    this.thirdPersonCamera?.setActive(false);
  }

  switchToBuildCamera() {
    if (!this.buildCamera) {
      this.buildCamera = new BuildCamera(this.camera, this.cameraTarget, this.canvasElement, this);
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
    this.unswitchFromFollowCamera();
    this.unswitchFromThirdPersonCamera();
    this.unswitchFromBuildCamera();
    this.orbitControls?.dispose();
    this.followingCamera?.dispose();
    this.thirdPersonCamera?.dispose();
    this.buildCamera?.dispose();
    this.disposeFunctions.forEach((fn) => fn());
  }
}
