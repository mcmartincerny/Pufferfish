import { Euler, Mesh, MeshPhongMaterial, PlaneGeometry } from "three";
import { animatePositionTo, animateRotationTo, debounceOnlyLastCall, Quaternion, Vector3 } from "../helpers";
import { BetterObject3D } from "./BetterObject3D";
import { Helm, BuildablePartConstructor } from "./ShipParts";
import { currentDeltaTime } from "../Globals";
import { LineMaterial, LineSegments2, LineSegmentsGeometry } from "three/examples/jsm/Addons.js";
import { ObjectMouseEventManager } from "./ObjectMouseEventManager";
import { BuildError, GameStore } from "../ui/GameContext";

export type BuildableData = {
  blueprint: Blueprint;
  position: Vector3;
  rotation: Quaternion;
};

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
  isShipBlueprint: boolean;
  private _buildableData: BuildableData;
  constructor(buildableData: BuildableData) {
    super();
    this.gameStore = GameStore.getInstance();
    this._buildableData = buildableData;
    this.isShipBlueprint = buildableData.blueprint.isShip;
    this.position.copy(buildableData.position);
    this.setRotationFromQuaternion(buildableData.rotation);
    this.rotateXStart = this.rotation.x;
    this.rotateYStart = this.rotation.y;
    this.assembleParts(buildableData.blueprint.parts);
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
      this.createPlacementBoxesForPart(instance);
    }
    this.debouncedValidateParts();
    return instance;
  }

  private createPlacementBoxesForPart(instance: BetterObject3D) {
    // Compute how many grid cells the part occupies along each axis (local space)
    instance.mainMesh?.geometry.computeBoundingBox();
    const bb = instance.mainMesh?.geometry.boundingBox;
    if (!bb) return;
    const sx = Math.max(1, Math.ceil(bb.max.x - bb.min.x));
    const sy = Math.max(1, Math.ceil(bb.max.y - bb.min.y));
    const sz = Math.max(1, Math.ceil(bb.max.z - bb.min.z));
    const rotQuat = new Quaternion().setFromEuler(instance.rotation);
    // One outline per whole part
    const outline = new PlacementOutline(instance, new Vector3(0, 0, 0), new Vector3(sx, sy, sz));
    this.add(outline);
    for (let ix = 0; ix < sx; ix++) {
      for (let iy = 0; iy < sy; iy++) {
        for (let iz = 0; iz < sz; iz++) {
          const localOffset = new Vector3(-sx / 2 + 0.5 + ix, -sy / 2 + 0.5 + iy, -sz / 2 + 0.5 + iz);
          const worldOffset = localOffset.applyQuaternion(rotQuat);
          const panels = new PlacementPlanes(instance, worldOffset);
          this.add(panels);
        }
      }
    }
  }

  removePart(part: BetterObject3D) {
    // Remove and dispose the part
    const index = this.parts.indexOf(part);
    if (index !== -1) this.parts.splice(index, 1);
    part.dispose?.(true);
    this.remove(part);
    // Remove and dispose any associated placement panels and outline
    const placementVisuals = this.children.filter(
      (child) => (child instanceof PlacementPlanes || child instanceof PlacementOutline) && (child as PlacementPlanes | PlacementOutline).part === part
    );
    placementVisuals.forEach((v) => {
      (v as PlacementPlanes | PlacementOutline).dispose(true);
      this.remove(v);
    });
    this.debouncedValidateParts();
  }

  visualizationPart: BetterObject3D | null = null;
  visualizationPartId: string | null = null;
  private visualizationTargetPosition: Vector3 | null = null;
  private visualizationTargetRotation: Euler | null = null;
  private visualizationAnchorPosition: Vector3 | null = null;
  visualizeNewPart = (position: Vector3 | null) => {
    if (position == null) {
      if (this.visualizationPart) {
        this.removePart(this.visualizationPart);
        this.visualizationPart = null;
        this.visualizationPartId = null;
      }
      this.visualizationTargetPosition = null;
      this.visualizationTargetRotation = null;
      this.visualizationAnchorPosition = null;
      return;
    }

    const partInfo = this.gameStore.get("building.selectedItem");
    if (partInfo == null) return;
    if (this.visualizationPartId === partInfo.id && this.visualizationPart) {
      // Update anchor and recompute rotated offset so the anchor cell stays locked while moving
      this.visualizationAnchorPosition = position.clone();
      const rotatedOffset = getOffsetForBiggerObjects(this.visualizationPart, this.visualizationTargetRotation ?? this.visualizationPart.rotation);
      this.visualizationTargetPosition = position.clone().sub(rotatedOffset);
      animatePositionTo(this.visualizationPart, this.visualizationTargetPosition, 100);
      return;
    }
    const part = { part: partInfo.constructor, position, rotation: new Euler(0, 0, 0) };
    this.visualizationPart = this.createAndAddPart(part, false);
    // Initialize anchor lock and place the part so the anchor cell is correct for current rotation
    this.visualizationAnchorPosition = position.clone();
    const rotatedOffset = getOffsetForBiggerObjects(this.visualizationPart, this.visualizationPart.rotation);
    this.visualizationPart.position.copy(position.clone().sub(rotatedOffset));
    this.visualizationPartId = partInfo.id;
    this.visualizationTargetPosition = this.visualizationPart.position.clone();
    this.visualizationTargetRotation = this.visualizationPart.rotation.clone();
  };

  debouncedVisualizeNewPart = debounceOnlyLastCall(this.visualizeNewPart, 0);

  private onKeyDown(event: KeyboardEvent) {
    if (!this.visualizationPart) return;
    const step = Math.PI / 2; // 90 degrees
    // Snap helper to avoid drift
    const snap = (angle: number) => Math.round(angle / step) * step;
    const key = event.key.toLowerCase();
    const current = this.visualizationPart.rotation;
    let rx = snap(current.x);
    let ry = snap(current.y);
    let rz = snap(current.z);
    if (key === "w") rx = snap(current.x + step);
    else if (key === "s") rx = snap(current.x - step);
    else if (key === "a") ry = snap(current.y + step);
    else if (key === "d") ry = snap(current.y - step);
    else if (key === "q") rz = snap(current.z + step);
    else if (key === "e") rz = snap(current.z - step);
    else return;
    const targetEuler = new Euler(rx, ry, rz);
    this.visualizationTargetRotation = targetEuler.clone();
    animateRotationTo(this.visualizationPart, targetEuler, 100);
    // Recompute position so the anchor cell stays locked during rotation
    if (this.visualizationAnchorPosition) {
      const rotatedOffset = getOffsetForBiggerObjects(this.visualizationPart, targetEuler);
      const targetPos = this.visualizationAnchorPosition.clone().sub(rotatedOffset);
      this.visualizationTargetPosition = targetPos;
      animatePositionTo(this.visualizationPart, targetPos, 100);
    }
  }

  private placeVisualizationPart() {
    const selected = this.gameStore.get("building.selectedItem");
    if (!selected || !this.visualizationPart) return;
    // Ensure final position respects anchor + rotation
    let finalPosition = this.visualizationTargetPosition ?? this.visualizationPart.position;
    if (this.visualizationAnchorPosition) {
      const rotatedOffset = getOffsetForBiggerObjects(this.visualizationPart, this.visualizationTargetRotation ?? this.visualizationPart.rotation);
      finalPosition = this.visualizationAnchorPosition.clone().sub(rotatedOffset);
    }
    const finalRotationEuler = this.visualizationTargetRotation ?? this.visualizationPart.rotation;
    const part: BlueprintPart = {
      part: selected.constructor,
      position: finalPosition,
      rotation: new Euler(finalRotationEuler.x, finalRotationEuler.y, finalRotationEuler.z),
    };
    const instance = this.createAndAddPart(part, true);
    this.parts.push(instance);
  }

  afterUpdate() {
    super.afterUpdate();
    if (!this.isShipBlueprint || this.moved) return;

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
    this.position.z = this._buildableData.position.z + this.moveUpDistance * eased;

    // Apply the same easing to rotation X and Y, returning to 0 at the end
    const rotateFactor = 1 - eased; // 1 -> 0 over time
    this.rotation.x = this.rotateXStart * rotateFactor;
    this.rotation.y = this.rotateYStart * rotateFactor;
  }

  validateParts() {
    const errors: BuildError[] = [];
    const helmParts = this.parts.filter((part) => part instanceof Helm);
    const numberOfHelms = helmParts.length;
    if (this.isShipBlueprint) {
      // Ship specific validation
      if (numberOfHelms === 0) {
        errors.push({
          message: "Ship needs to have helm",
          details: "All ships need to have a helm. It is the main control for the ship. What kind of dumb ass would build a ship without a helm?",
          errorParts: [],
        });
      }
      if (numberOfHelms > 1) {
        errors.push({
          message: "Ship can have only one helm",
          details: `Ship currently has ${numberOfHelms} helms. It can only have one.`,
          errorParts: helmParts,
        });
      }
    } else {
      // Fixed structure specific validation
      if (numberOfHelms > 0) {
        errors.push({
          message: "Fixed structure can't have helms",
          details: "Fixed structures are not ships. They can't have helms. You can't control fixed structures similar to ships.",
          errorParts: helmParts,
        });
      }
    }
    this.gameStore.set("building.errors", errors);
    return errors;
  }

  debouncedValidateParts = debounceOnlyLastCall(() => this.validateParts(), 0);

  get buildableData(): BuildableData {
    const buildableDataCopy: BuildableData = {
      rotation: new Quaternion().setFromEuler(this.rotation),
      position: this.position.clone(),
      blueprint: { ...this._buildableData.blueprint },
    };
    buildableDataCopy.blueprint.parts = [];
    this.parts.forEach((part) => {
      if (part === this.visualizationPart) return;
      buildableDataCopy.blueprint.parts.push({
        part: part.constructor as BuildablePartConstructor,
        position: part.position.clone(),
        rotation: new Euler(part.rotation.x, part.rotation.y, part.rotation.z),
      });
    });
    return buildableDataCopy;
  }

  set buildableData(_buildableData: BuildableData) {
    throw new Error("Cannot set buildableData on BlueprintBuildable. It can be only set in the constructor.");
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
class PlacementPlanes extends BetterObject3D {
  planes: Mesh[];
  unsubscribeFunctions: (() => void)[] = [];
  constructor(public part: BetterObject3D, private worldOffset: Vector3 = new Vector3(0, 0, 0)) {
    super();
    this.position.copy(new Vector3(part.position).add(this.worldOffset));
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
        const deleteMode = gameStore.get("building.deleteMode");
        const allPlanesOfThisPart = this.parent?.children
          .filter((p) => p instanceof PlacementPlanes && (p as PlacementPlanes).part === this.part)
          .flatMap((p) => (p as PlacementPlanes).planes);
        if (!allPlanesOfThisPart) throw new Error("allPlanesOfThisPart is undefined, this should not happen.");
        if (hovered) {
          if (deleteMode) {
            // Deletion mode: show ALL panels in red
            allPlanesOfThisPart.forEach((p) => {
              const mat = p.material as MeshPhongMaterial;
              mat.color.set(0xff0000);
              mat.visible = true;
            });
            gameStore.set("building.mouseNewPartPosition", null);
          } else {
            // Placement mode: show only hovered panel in white
            allPlanesOfThisPart.forEach((p) => ((p.material as MeshPhongMaterial).visible = false));
            (plane.material as MeshPhongMaterial).color.set(0xffffff);
            (plane.material as MeshPhongMaterial).visible = true;
            gameStore.set("building.mouseNewPartPosition", plane.position.clone().normalize().add(this.position));
          }
        } else {
          if (deleteMode) {
            // Deletion mode: hide all panels immediately
            allPlanesOfThisPart.forEach((p) => ((p.material as MeshPhongMaterial).visible = false));
            gameStore.set("building.mouseNewPartPosition", null);
          } else {
            // Placement mode: hide this panel
            (plane.material as MeshPhongMaterial).visible = false;
            gameStore.set("building.mouseNewPartPosition", null);
          }
        }
      });
      mouseEventManager.addClickEventListener(plane, () => {
        const { selectedItem, deleteMode } = gameStore.get("building");
        if (deleteMode) {
          const parent = this.parent;
          if (parent && parent instanceof BlueprintBuildable) {
            parent.removePart(this.part);
          }
        } else if (selectedItem != null) {
          // Placement mode: ensure latest position and request placement
          gameStore.set("building.mouseNewPartPosition", plane.position.clone().normalize().add(this.position));
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

class PlacementOutline extends BetterObject3D {
  lines: LineSegments2;
  unsubscribeFunctions: (() => void)[] = [];
  constructor(public part: BetterObject3D, worldOffset: Vector3, scaleXYZ: Vector3) {
    super();
    this.position.copy(new Vector3(part.position).add(worldOffset));
    const geometry = new LineSegmentsGeometry().setPositions(cubePoints.flat().flatMap((point) => [point.x, point.y, point.z]));
    const material = new LineMaterial({ color: 0xffffff, linewidth: 2 });
    this.lines = new LineSegments2(geometry, material);
    this.lines.scale.set(scaleXYZ.x, scaleXYZ.y, scaleXYZ.z);
    this.add(this.lines);
    const gameStore = GameStore.getInstance();
    gameStore.subscribe("building.errors", (errors) => {
      if (errors.some((error) => error.errorParts?.includes(this.part))) {
        this.lines.material.color.set(0xff0000);
      } else {
        this.lines.material.color.set(0xffffff);
      }
    });
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
  part: BuildablePartConstructor;
  position: Vector3;
  rotation: Euler;
  partName?: string;
};

const getOffsetForBiggerObjects = (instance: BetterObject3D, rotation: Euler | Quaternion) => {
  instance.mainMesh?.geometry.computeBoundingBox();
  const boundingBox = instance.mainMesh?.geometry.boundingBox;
  if (!boundingBox) {
    throw new Error("Bounding box not found");
  }
  const x = -Math.ceil(boundingBox.max.x - boundingBox.min.x) / 2 + 0.5;
  const y = -Math.ceil(boundingBox.max.y - boundingBox.min.y) / 2 + 0.5;
  const z = -Math.ceil(boundingBox.max.z - boundingBox.min.z) / 2 + 0.5;
  const local = new Vector3(x, y, z);
  const quat = rotation instanceof Quaternion ? rotation : new Quaternion().setFromEuler(rotation);
  return local.applyQuaternion(quat);
};
