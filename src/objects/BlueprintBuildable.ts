import { Euler, Mesh, MeshBasicMaterial, MeshPhongMaterial, PlaneGeometry } from "three";
import { Quaternion, Vector3 } from "../helpers";
import { BetterObject3D } from "./BetterObject3D";
import { ShipPartConstructor } from "./ShipParts";
import { ShipProps } from "./Ship";
import { currentDeltaTime } from "../Globals";
import { LineMaterial, LineSegments2, LineSegmentsGeometry } from "three/examples/jsm/Addons.js";
import { ObjectMouseEventManager } from "./ObjectMouseEventManager";
import { GameStore } from "../ui/GameContext";

export class BlueprintBuildable extends BetterObject3D {
  moveUpDistance = 10;
  moveUpTime = 1.5;
  moved = false;
  moveProgress = 0;
  rotateXStart = 0; // radians
  rotateYStart = 0; // radians
  parts: BetterObject3D[] = [];
  gameStore: GameStore;
  unsubscribeFunctions: (() => void)[] = [];
  constructor(public shipProps: ShipProps) {
    super();
    this.position.copy(shipProps.position);
    this.setRotationFromQuaternion(shipProps.rotation);
    this.rotateXStart = this.rotation.x;
    this.rotateYStart = this.rotation.y;
    this.assembleParts(shipProps.blueprint.parts);
    this.gameStore = GameStore.getInstance();
    const unsubscribe = this.gameStore.subscribe("building.mouseNewPartPosition", (position) => {
      this.visualizeNewPart(position);
    });
    this.unsubscribeFunctions.push(unsubscribe);
  }

  assembleParts(parts: BlueprintPart[]) {
    for (const part of parts) {
      const instance = this.createAndAddPart(part);
      this.parts.push(instance);
    }
  }

  createAndAddPart(part: BlueprintPart, createPlacementBox = true) {
    const { part: Part, position, rotation } = part;
    const rotationQuaternion = new Quaternion().setFromEuler(rotation);
    const instance = new Part({ rotation: rotationQuaternion, translation: position });
    this.add(instance);
    if (createPlacementBox) {
      const placementBox = new PlacementBox(instance);
      this.add(placementBox);
    }
    return instance;
  }

  removePart(part: BetterObject3D) {
    this.remove(part);
    const placementBox = this.children.find((child) => child instanceof PlacementBox && child.part === part);
    if (placementBox) {
      this.remove(placementBox);
    }
  }

  visualizationPart: BetterObject3D | null = null;
  visualizationPartId: string | null = null;
  visualizeNewPart(position: Vector3 | null) {
    if (position == null) {
      if (this.visualizationPart) {
        this.removePart(this.visualizationPart);
        this.visualizationPart = null;
        this.visualizationPartId = null;
      }
      return;
    }
    const partInfo = this.gameStore.get("building.selectedItem");
    if (partInfo == null) return;
    if (this.visualizationPartId === partInfo.id && this.visualizationPart) {
      this.visualizationPart.position.copy(position);
      return;
    }
    const part = { part: partInfo.constructor, position, rotation: new Euler(0, 0, 0) };
    this.visualizationPart = this.createAndAddPart(part, false);
    this.visualizationPartId = partInfo.id;
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
      this.rotation.y = 0;
      this.rotation.x = 0;
      this.moved = true;
    }

    // Smoother step easing (quintic) for gentler start/stop: 6t^5 - 15t^4 + 10t^3
    const t = this.moveProgress;
    const eased = t * t * t * (t * (t * 6 - 15) + 10);
    this.position.z = this.shipProps.position.z + this.moveUpDistance * eased;

    // Apply the same easing to rotation X and Y, returning to 0 at the end
    const rotateFactor = 1 - eased; // 1 -> 0 over time
    this.rotation.x = this.rotateXStart * rotateFactor;
    this.rotation.y = this.rotateYStart * rotateFactor;
  }

  dispose(removeFromParent?: boolean): void {
    super.dispose(removeFromParent);
    this.visualizationPart = null;
    this.visualizationPartId = null;
    this.parts = [];
    this.unsubscribeFunctions.forEach((unsubscribe) => unsubscribe());
    this.unsubscribeFunctions = [];
  }
}

// Simple object that will be position over some placed part to show it's edges
class PlacementBox extends BetterObject3D {
  lines: LineSegments2;
  planes: Mesh[];
  unsubscribeFunctions: (() => void)[] = [];
  constructor(public part: BetterObject3D) {
    super();
    this.position.copy(part.position);
    this.quaternion.copy(part.quaternion);
    const geometry = new LineSegmentsGeometry().setPositions(cubePoints.flat().flatMap((point) => [point.x, point.y, point.z]));
    const material = new LineMaterial({ color: 0xffffff, linewidth: 2 });
    this.lines = new LineSegments2(geometry, material);
    this.add(this.lines);
    const planeGeometry = new PlaneGeometry(1, 1);
    this.planes = [];
    const mouseEventManager = ObjectMouseEventManager.getInstance();
    const gameStore = GameStore.getInstance();
    for (const planeData of cubePlanes) {
      const planeMaterial = new MeshPhongMaterial({ color: 0xffffff, transparent: true, visible: false, opacity: 0.4 });
      const plane = new Mesh(planeGeometry, planeMaterial);
      plane.position.copy(planeData.position);
      plane.setRotationFromEuler(new Euler(planeData.rotation.x, planeData.rotation.y, planeData.rotation.z));
      this.planes.push(plane);
      this.add(plane);
      mouseEventManager.addHoverEventListener(plane, (hovered) => {
        if (hovered) {
          plane.material.visible = true;
          gameStore.set("building.mouseNewPartPosition", plane.position.clone().normalize().add(part.position));
        } else {
          plane.material.visible = false;
          gameStore.set("building.mouseNewPartPosition", null);
        }
      });
      this.unsubscribeFunctions.push(() => {
        mouseEventManager.removeHoverEventListener(plane);
      });
    }
  }

  dispose(removeFromParent?: boolean): void {
    super.dispose(removeFromParent);
    this.unsubscribeFunctions.forEach((unsubscribe) => unsubscribe());
    this.unsubscribeFunctions = [];
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

const cubePlanes = [
  { position: { x: 0.501, y: 0, z: 0 }, rotation: { x: 0, y: Math.PI / 2, z: 0 } },
  { position: { x: -0.501, y: 0, z: 0 }, rotation: { x: 0, y: -Math.PI / 2, z: 0 } },
  { position: { x: 0, y: 0.501, z: 0 }, rotation: { x: -Math.PI / 2, y: 0, z: 0 } },
  { position: { x: 0, y: -0.501, z: 0 }, rotation: { x: Math.PI / 2, y: 0, z: 0 } },
  { position: { x: 0, y: 0, z: 0.501 }, rotation: { x: 0, y: 0, z: 0 } },
  { position: { x: 0, y: 0, z: -0.501 }, rotation: { x: 0, y: Math.PI, z: 0 } },
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
