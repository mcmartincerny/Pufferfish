import { PerspectiveCamera } from "three";
import { TopDownCamera } from "./TopDownCamera.ts";
import { BetterObject3D } from "../objects/BetterObject3D";
// @ts-ignore
import { OrbitControls } from "three/addons/controls/OrbitControls";
import { ThirdPersonCamera } from "./ThirdPersonCamera";
import { BuildCamera } from "./BuildCamera";
import { GameStore } from "../ui/GameContext.tsx";
export enum CameraType {
  Free = "Free",
  TopDown = "TopDown",
  ThirdPerson = "ThirdPerson",
  BuildCamera = "BuildCamera",
  None = "None",
}

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
  disposeFunctions: (() => void)[] = [];

  constructor(canvasElement: HTMLCanvasElement, cameraTarget?: BetterObject3D, cameraType: CameraType = CameraType.ThirdPerson) {
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
      console.log("setting third person camera target");
      console.log(this.thirdPersonCamera.target.rigidBody?.translation());
      this.thirdPersonCamera.target = target;
    } else if (this.followingCamera) {
      this.followingCamera.target = target;
    } else if (this.buildCamera) {
      this.buildCamera.target = target;
    }
  }

  switchCamera(type: CameraType) {
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
    } else if (this.type === CameraType.TopDown) {
      this.switchToFollowCamera();
    } else if (this.type === CameraType.ThirdPerson) {
      this.switchToThirdPersonCamera();
    } else if (this.type === CameraType.BuildCamera) {
      this.switchToBuildCamera();
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

  switchToThirdPersonCamera() {
    if (!this.thirdPersonCamera) {
      this.thirdPersonCamera = new ThirdPersonCamera(this.camera, this.cameraTarget, this.canvasElement);
      this.thirdPersonCamera.init();
    }
    this.thirdPersonCamera.setActive(true);
  }

  unswitchFromThirdPersonCamera() {
    this.thirdPersonCamera?.setActive(false);
  }

  switchToBuildCamera() {
    if (!this.buildCamera) {
      this.buildCamera = new BuildCamera(this.camera, this.cameraTarget, this.canvasElement);
      this.buildCamera.init();
    }
    this.buildCamera.setActive(true);
  }

  unswitchFromBuildCamera() {
    this.buildCamera?.setActive(false);
  }

  beforeStep() {
    if (this.type === CameraType.TopDown) {
      this.followingCamera?.beforeStep();
    } else if (this.type === CameraType.ThirdPerson) {
      this.thirdPersonCamera?.beforeStep();
    } else if (this.type === CameraType.BuildCamera) {
      this.buildCamera?.beforeStep();
    }
  }

  afterStep() {
    if (this.type === CameraType.TopDown) {
      this.followingCamera?.afterStep();
    } else if (this.type === CameraType.ThirdPerson) {
      this.thirdPersonCamera?.afterStep();
    } else if (this.type === CameraType.BuildCamera) {
      this.buildCamera?.afterStep();
    }
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
