import { BoxGeometry, BufferGeometry, EdgesGeometry, Euler, LineBasicMaterial, LineSegments } from "three";
import { Quaternion, Vector3 } from "../helpers";
import { BetterObject3D } from "./BetterObject3D";
import { ShipPartConstructor } from "./ShipParts";
import { ShipProps } from "./Ship";
import { currentDeltaTime, outlinePass } from "../Globals";
import { LineMaterial, LineSegments2, LineSegmentsGeometry } from "three/examples/jsm/Addons.js";

export class BlueprintBuildable extends BetterObject3D {
  moveUpDistance = 10;
  moveUpTime = 1.5;
  moved = false;
  moveProgress = 0;
  constructor(public shipProps: ShipProps) {
    super();
    this.position.copy(shipProps.position);
    this.setRotationFromQuaternion(shipProps.rotation);
    this.assembleParts(shipProps.blueprint.parts);
  }

  assembleParts(parts: BlueprintPart[]) {
    for (const part of parts) {
      const { part: Part, position, rotation } = part;
      const rotationQuaternion = new Quaternion().setFromEuler(rotation);
      const instance = new Part({ rotation: rotationQuaternion, translation: position });
      this.add(instance);
      const placementBox = new PlacementBox(instance);
      this.add(placementBox);
    }
  }

  afterUpdate() {
    super.afterUpdate();
    if (this.moved) return;

    const deltaSeconds = currentDeltaTime / 1000;
    if (this.moveUpTime > 0) {
      this.moveProgress += deltaSeconds / this.moveUpTime;
    } else {
      this.moveProgress = 1;
    }
    if (this.moveProgress >= 1) {
      this.moveProgress = 1;
      this.moved = true;
    }

    // Smootherstep easing (quintic) for gentler start/stop: 6t^5 - 15t^4 + 10t^3
    const t = this.moveProgress;
    const eased = t * t * t * (t * (t * 6 - 15) + 10);
    this.position.z = this.shipProps.position.z + this.moveUpDistance * eased;
  }
}

// Simple object that will be position over some placed part to show it's edges
class PlacementBox extends BetterObject3D {
  constructor(public part: BetterObject3D) {
    super();
    this.position.copy(part.position);
    this.quaternion.copy(part.quaternion);
    // const geometry = new BoxGeometry(1, 1, 1);
    // const edges = new EdgesGeometry(geometry);
    // const lineMaterial = new LineBasicMaterial({
    //   color: 0xffffff,
    //   //   depthTest: false, // ensures it renders on top of everything
    //   transparent: false,
    // });
    // const wireframe = new LineSegments(edges, lineMaterial);
    // this.add(wireframe);
    const geometry = new LineSegmentsGeometry().setPositions(cubePoints.flat().flatMap((point) => [point.x, point.y, point.z]));
    const material = new LineMaterial({ color: 0xffffff, linewidth: 2 });
    const line = new LineSegments2(geometry, material);
    this.add(line);
  }
}

const cubePoints = [
  // bottom square
  [new Vector3(-0.5, -0.5, -0.5), new Vector3(0.5, -0.5, -0.5)],
  [new Vector3(0.5, -0.5, -0.5), new Vector3(0.5, -0.5, 0.5)],
  [new Vector3(0.5, -0.5, 0.5), new Vector3(-0.5, -0.5, 0.5)],
  [new Vector3(-0.5, -0.5, 0.5), new Vector3(-0.5, -0.5, -0.5)],

  // top square
  [new Vector3(-0.5, 0.5, -0.5), new Vector3(0.5, 0.5, -0.5)],
  [new Vector3(0.5, 0.5, -0.5), new Vector3(0.5, 0.5, 0.5)],
  [new Vector3(0.5, 0.5, 0.5), new Vector3(-0.5, 0.5, 0.5)],
  [new Vector3(-0.5, 0.5, 0.5), new Vector3(-0.5, 0.5, -0.5)],

  // vertical edges
  [new Vector3(-0.5, -0.5, -0.5), new Vector3(-0.5, 0.5, -0.5)],
  [new Vector3(0.5, -0.5, -0.5), new Vector3(0.5, 0.5, -0.5)],
  [new Vector3(0.5, -0.5, 0.5), new Vector3(0.5, 0.5, 0.5)],
  [new Vector3(-0.5, -0.5, 0.5), new Vector3(-0.5, 0.5, 0.5)],
];

export type Blueprint = {
  name: string;
  description: string;
  isShip: boolean;
  parts: BlueprintPart[];
};

export type BlueprintPart = {
  part: ShipPartConstructor;
  position: Vector3;
  rotation: Euler;
  partName?: string;
};
