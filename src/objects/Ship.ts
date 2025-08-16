import { Euler } from "three";
import { BetterObject3D } from "./BetterObject3D";
import { Helm, LeadBox, ShipPartInstance, ShipPartConstructor, WoodenBox, WoodenRamp, Propeller, ThrustingPart, RudderPart, SmallRudder } from "./ShipParts";
import { degToRad, Quaternion, Vector3, wait } from "../helpers";
import { shipDesign } from "./shipDesigns";
import { shipHandleIds } from "../PhysicsHooks";
import { createFixedJoint, createPrismaticJoint } from "../JointUtils";
import { world } from "../Globals";

export class Ship extends BetterObject3D {
  parts: ShipPartInstance[] = [];
  helm!: Helm;
  thrustParts: ThrustingPart[] = [];
  rudderParts: RudderPart[] = [];
  constructor() {
    super();
    let hasHelm = false;
    const partsOnShip = shipDesignToPartsOnShip(shipDesign);
    const partsHandleIds: Set<number> = new Set();
    for (const part of partsOnShip) {
      const { part: Part, position, rotation } = part;
      const rotationQuaternion = new Quaternion().setFromEuler(rotation);
      const instance = new Part({ rotation: rotationQuaternion });
      partsHandleIds.add(instance.rigidBody!.handle);
      instance.rigidBody!.setTranslation(position, true);
      instance.rigidBody!.setRotation(rotationQuaternion, true);
      this.parts.push(instance);
      if (instance instanceof ThrustingPart) {
        this.thrustParts.push(instance);
      }
      if (instance instanceof RudderPart) {
        this.rudderParts.push(instance);
      }
      if (instance instanceof Helm) {
        if (hasHelm) {
          throw new Error("Ship has more than one helm");
        }
        this.helm = instance;
        hasHelm = true;
      }
      this.add(instance);
    }
    if (!hasHelm) {
      throw new Error("Ship has no helm");
    }
    shipHandleIds.push(partsHandleIds);
    this.createFixedJointsBetweenNearbyParts();
    this.createFixedJointsBetweenPartsAndHelm();
  }

  createFixedJointsBetweenNearbyParts() {
    for (const part of this.parts) {
      for (const otherPart of this.parts) {
        if (part === otherPart) continue;
        const nextVector = nextToEachOtherPositive(part, otherPart);
        if (nextVector) {
          createFixedJoint(part.rigidBody!, otherPart.rigidBody!);
        }
      }
    }
  }

  createFixedJointsBetweenPartsAndHelm() {
    for (const part of this.parts) {
      if (part instanceof Helm) continue;
      createFixedJoint(this.helm.rigidBody!, part.rigidBody!);
    }
  }
}

type PartOnShip = {
  part: ShipPartConstructor;
  position: Vector3;
  rotation: Euler;
  partName?: string;
};

const shipDesignToPartsOnShip = (design: string[][]): PartOnShip[] => {
  const partsOnShip: PartOnShip[] = [];

  const numLayers = design.length;
  if (numLayers === 0) return partsOnShip;

  const rowsPerLayer = design[0].length;
  const zCenterOffset = (numLayers - 1) / 2;
  const yCenterOffset = (rowsPerLayer - 1) / 2;

  for (let layerIndex = 0; layerIndex < numLayers; layerIndex++) {
    const layerRows = design[layerIndex];
    for (let rowIndex = 0; rowIndex < layerRows.length; rowIndex++) {
      const row = layerRows[rowIndex];
      const rowLength = row.length;
      const xCenterOffset = (rowLength - 1) / 2;

      for (let colIndex = 0; colIndex < rowLength; colIndex++) {
        const char = row[colIndex];
        if (char === " ") continue;
        const entry = shipLegend[char as keyof typeof shipLegend];
        if (!entry) continue;

        const position = new Vector3(colIndex - xCenterOffset, rowIndex - yCenterOffset, layerIndex - zCenterOffset);

        partsOnShip.push({ part: entry.part, position, rotation: entry.rotation, partName: entry.part.name });
      }
    }
  }
  // console.log(JSON.stringify(partsOnShip, null, 2));
  return partsOnShip;
};
export const shipLegend = {
  "■": {
    part: WoodenBox,
    rotation: new Euler(0, 0, 0),
  },
  "◢": {
    part: WoodenRamp,
    rotation: new Euler(0, degToRad(-90), degToRad(-90)),
  },
  "◣": {
    part: WoodenRamp,
    rotation: new Euler(0, degToRad(90), degToRad(-90)),
  },
  "◥": {
    part: WoodenRamp,
    rotation: new Euler(0, degToRad(-90), degToRad(90)),
  },
  "◤": {
    part: WoodenRamp,
    rotation: new Euler(0, degToRad(90), degToRad(90)),
  },
  "⬡": {
    part: Helm,
    rotation: new Euler(0, 0, 0),
  },
  "▒": {
    part: LeadBox,
    rotation: new Euler(0, 0, 0),
  },
  T: {
    part: Propeller,
    rotation: new Euler(0, 0, 0),
  },
  R: {
    part: SmallRudder,
    rotation: new Euler(degToRad(0), degToRad(90), degToRad(0)),
  },
  L: {
    part: SmallRudder,
    rotation: new Euler(degToRad(0), degToRad(0), degToRad(0)),
  },
};

// next to each other means equal any two of X, Y or Z and the third one is different exactly by 1
// this only works in the positive direction - used for only creating joints once
const nextToEachOtherPositive = (part1: ShipPartInstance, part2: ShipPartInstance) => {
  const pos1 = part1.rigidBody!.translation();
  const pos2 = part2.rigidBody!.translation();
  return (
    ((pos1.x === pos2.x && pos1.y === pos2.y && pos1.z - pos2.z === 1) ||
      (pos1.x === pos2.x && pos1.z === pos2.z && pos1.y - pos2.y === 1) ||
      (pos1.y === pos2.y && pos1.z === pos2.z && pos1.x - pos2.x === 1)) &&
    new Vector3(pos1).sub(pos2) // TODO: We do not need to return the vector, just the boolean
  );
};
