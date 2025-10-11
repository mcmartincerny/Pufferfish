import { Euler, Mesh, MeshPhongMaterial, PlaneGeometry } from "three";
import { animatePositionTo, animateRotationTo, debounceOnlyLastCall, Quaternion, Vector3 } from "../helpers";
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
  private _shipProps: ShipProps;
  constructor(shipProps: ShipProps) {
    super();
    this._shipProps = shipProps;
    this.position.copy(shipProps.position);
    this.setRotationFromQuaternion(shipProps.rotation);
    this.rotateXStart = this.rotation.x;
    this.rotateYStart = this.rotation.y;
    this.assembleParts(shipProps.blueprint.parts);
    this.gameStore = GameStore.getInstance();
    const unsubscribe = this.gameStore.subscribe("building.mouseNewPartPosition", (position) => {
      // Debounce the call to only call it with the last params - in this case position
      this.debouncedVisualizeNewPart(position);
    });
    this.unsubscribeFunctions.push(unsubscribe);

    const unsubscribePlace = this.gameStore.subscribe("building.placeRequestedAt", () => {
      this.placeVisualizationPart();
    });
    this.unsubscribeFunctions.push(unsubscribePlace);

    const onKeyDown = (e: KeyboardEvent) => this.onKeyDown(e);
    window.addEventListener("keydown", onKeyDown);
    this.unsubscribeFunctions.push(() => window.removeEventListener("keydown", onKeyDown));
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
    // Remove and dispose the part
    const index = this.parts.indexOf(part);
    if (index !== -1) this.parts.splice(index, 1);
    part.dispose?.(true);
    this.remove(part);
    // Remove and dispose the associated placement box
    const placementBox = this.children.find((child) => child instanceof PlacementBox && child.part === part);
    if (placementBox) {
      (placementBox as PlacementBox).dispose(true);
      this.remove(placementBox);
    }
  }

  visualizationPart: BetterObject3D | null = null;
  visualizationPartId: string | null = null;
  visualizeNewPart = (position: Vector3 | null) => {
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
      // this.visualizationPart.position.copy(position);
      animatePositionTo(this.visualizationPart, position, 100);
      return;
    }
    const part = { part: partInfo.constructor, position, rotation: new Euler(0, 0, 0) };
    this.visualizationPart = this.createAndAddPart(part, false);
    this.visualizationPartId = partInfo.id;
  };

  debouncedVisualizeNewPart = debounceOnlyLastCall(this.visualizeNewPart, 0);

  private onKeyDown(event: KeyboardEvent) {
    console.log("onKeyDown", event.key);
    if (!this.visualizationPart) return;
    const step = Math.PI / 2; // 90 degrees
    // Snap helper to avoid drift
    const snap = (angle: number) => Math.round(angle / step) * step;
    const key = event.key.toLowerCase();
    const current = this.visualizationPart.rotation;
    let rx = snap(current.x);
    let ry = snap(current.y);
    let rz = snap(current.z);
    console.log(`current x:%s, y:%s, z:%s`, current.x, current.y, current.z);
    if (key === "w") rx = snap(current.x + step);
    else if (key === "s") rx = snap(current.x - step);
    else if (key === "a") ry = snap(current.y + step);
    else if (key === "d") ry = snap(current.y - step);
    else if (key === "q") rz = snap(current.z + step);
    else if (key === "e") rz = snap(current.z - step);
    else return;
    console.log(`new x:%s, y:%s, z:%s`, rx, ry, rz);

    animateRotationTo(this.visualizationPart, new Euler(rx, ry, rz), 100);
  }

  private placeVisualizationPart() {
    const selected = this.gameStore.get("building.selectedItem");
    if (!selected || !this.visualizationPart) return;
    const part: BlueprintPart = {
      part: selected.constructor,
      position: this.visualizationPart.position.clone(),
      rotation: new Euler(this.visualizationPart.rotation.x, this.visualizationPart.rotation.y, this.visualizationPart.rotation.z),
    };
    const instance = this.createAndAddPart(part, true);
    this.parts.push(instance);
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
    this.position.z = this._shipProps.position.z + this.moveUpDistance * eased;

    // Apply the same easing to rotation X and Y, returning to 0 at the end
    const rotateFactor = 1 - eased; // 1 -> 0 over time
    this.rotation.x = this.rotateXStart * rotateFactor;
    this.rotation.y = this.rotateYStart * rotateFactor;
  }

  get shipProps(): ShipProps {
    const shipPropsCopy: ShipProps = {
      rotation: new Quaternion().setFromEuler(this.rotation),
      position: this.position.clone(),
      blueprint: { ...this._shipProps.blueprint },
    };
    shipPropsCopy.blueprint.parts = [];
    this.parts.forEach((part) => {
      if (part === this.visualizationPart) return;
      shipPropsCopy.blueprint.parts.push({
        part: part.constructor as ShipPartConstructor,
        position: part.position.clone(),
        rotation: new Euler(part.rotation.x, part.rotation.y, part.rotation.z),
      });
    });
    return shipPropsCopy;
  }

  set shipProps(shipProps: ShipProps) {
    throw new Error("Cannot set shipProps on BlueprintBuildable");
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
    // this.quaternion.copy(part.quaternion);
    const geometry = new LineSegmentsGeometry().setPositions(cubePoints.flat().flatMap((point) => [point.x, point.y, point.z]));
    const material = new LineMaterial({ color: 0xffffff, linewidth: 2 });
    this.lines = new LineSegments2(geometry, material);
    this.add(this.lines);
    const planeGeometry = new PlaneGeometry(1, 1);
    this.planes = [];
    const mouseEventManager = ObjectMouseEventManager.getInstance();
    const gameStore = GameStore.getInstance();
    for (const planeData of cubePlanes) {
      const planeMaterial = new MeshPhongMaterial({ color: 0xffffff, transparent: true, visible: false, opacity: 0.6 });
      const plane = new Mesh(planeGeometry, planeMaterial);
      plane.position.copy(planeData.position);
      plane.setRotationFromEuler(new Euler(planeData.rotation.x, planeData.rotation.y, planeData.rotation.z));
      this.planes.push(plane);
      this.add(plane);
      mouseEventManager.addHoverEventListener(plane, (hovered) => {
        const selected = gameStore.get("building.selectedItem");
        if (hovered) {
          if (selected == null) {
            // Deletion mode: show ALL panels in red
            this.planes.forEach((p) => {
              const mat = p.material as MeshPhongMaterial;
              mat.color.set(0xff0000);
              mat.visible = true;
            });
            gameStore.set("building.mouseNewPartPosition", null);
          } else {
            // Placement mode: show only hovered panel in white
            this.planes.forEach((p) => ((p.material as MeshPhongMaterial).visible = false));
            (plane.material as MeshPhongMaterial).color.set(0xffffff);
            (plane.material as MeshPhongMaterial).visible = true;
            gameStore.set("building.mouseNewPartPosition", plane.position.clone().normalize().add(part.position));
          }
        } else {
          if (selected == null) {
            // Deletion mode: hide all panels immediately
            this.planes.forEach((p) => ((p.material as MeshPhongMaterial).visible = false));
            gameStore.set("building.mouseNewPartPosition", null);
          } else {
            // Placement mode: hide this panel
            (plane.material as MeshPhongMaterial).visible = false;
            gameStore.set("building.mouseNewPartPosition", null);
          }
        }
      });
      mouseEventManager.addClickEventListener(plane, () => {
        const selected = gameStore.get("building.selectedItem");
        if (selected == null) {
          // Deletion mode: remove this part
          const parent = this.parent;
          if (parent && parent instanceof BlueprintBuildable) {
            parent.removePart(this.part);
          }
        } else {
          // Placement mode: ensure latest position and request placement
          gameStore.set("building.mouseNewPartPosition", plane.position.clone().normalize().add(part.position));
          gameStore.update("building.placeRequestedAt", (prev) => prev + 1);
        }
      });
      this.unsubscribeFunctions.push(() => {
        mouseEventManager.removeHoverEventListener(plane);
        mouseEventManager.removeClickEventListener(plane);
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
