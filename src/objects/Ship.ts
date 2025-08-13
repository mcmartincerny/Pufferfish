import { Euler } from "three";
import { BetterObject3D } from "./BetterObject3D";
import { Helm, LeadBox, ShipPartInstance, ShipPartConstructor, WoodenBox, WoodenRamp, Propeller, ThrustingPart, RudderPart, SmallRudder } from "./ShipParts";
import { degToRad, Quaternion, Vector3 } from "../helpers";
import { shipDesign } from "./shipDesigns";
import { world } from "../Globals";
import { JointData } from "@dimforge/rapier3d-compat";
import { shipHandleIds } from "../PhysicsHooks";

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
      // instance.rigidBody!.setRotation(rotationQuaternion, true);
      this.parts.push(instance);
      if (instance instanceof ThrustingPart) {
        this.thrustParts.push(instance);
      }
      if (instance instanceof RudderPart) {
        this.rudderParts.push(instance);
      }
      if (instance instanceof Helm) {
        this.helm = instance;
        hasHelm = true;
      }
      this.add(instance);
    }
    if (!hasHelm) {
      throw new Error("Ship has no helm");
    }
    shipHandleIds.push(partsHandleIds);
    for (const part of this.parts) {
      for (const otherPart of this.parts) {
        if (part === otherPart) continue;
        const nextVector = nextToEachOther(part, otherPart);
        if (nextVector && nextVector.z === 1) {
          world.createImpulseJoint(
            JointData.fixed({ x: 0, y: 0, z: -0.5 }, new Quaternion(), { x: 0, y: 0, z: 0.5 }, new Quaternion()),
            part.rigidBody!,
            otherPart.rigidBody!,
            true
          );
        } else if (nextVector && nextVector.x === 1) {
          world.createImpulseJoint(
            JointData.fixed({ x: -0.5, y: 0, z: 0 }, new Quaternion(), { x: 0.5, y: 0, z: 0 }, new Quaternion()),
            part.rigidBody!,
            otherPart.rigidBody!,
            true
          );
        } else if (nextVector && nextVector.y === 1) {
          if (part instanceof RudderPart || otherPart instanceof RudderPart) {
            console.log("part", part.size, "otherPart", otherPart.size);
            // createFixedJoint(part, otherPart);
            // world.createImpulseJoint(
            //   JointData.fixed(
            //     { x: 0, y: -0.5, z: 0 },
            //     new Quaternion().setFromEuler(new Euler(0, degToRad(-90), 0)),
            //     { x: 0, y: 0.5, z: 0 },
            //     new Quaternion().setFromEuler(new Euler(0, 0, 0))
            //   ),
            //   part.rigidBody!,
            //   otherPart.rigidBody!,
            //   true
            // );
          } else {
            world.createImpulseJoint(
              JointData.fixed({ x: 0, y: -0.5, z: 0 }, new Quaternion(), { x: 0, y: 0.5, z: 0 }, new Quaternion()),
              part.rigidBody!,
              otherPart.rigidBody!,
              true
            );
          }
        }
      }
    }
  }
}

/**
 * Create a fixed joint between two parts no matter where they are and what their rotation is
 */
const createFixedJoint = (part1: ShipPartInstance, part2: ShipPartInstance) => {
  console.log("pos1", part1.rigidBody!.translation());
  console.log("pos2", part2.rigidBody!.translation());
  console.log("rot1", part1.rigidBody!.rotation());
  console.log("rot2", part2.rigidBody!.rotation());
  const pos1 = new Vector3(part1.rigidBody!.translation());
  const pos2 = new Vector3(part2.rigidBody!.translation());
  const rot1 = new Quaternion(part1.rigidBody!.rotation());
  const rot2 = new Quaternion(part2.rigidBody!.rotation());
  const posDiff = pos2.clone().sub(pos1);
  const posDiffHalf = posDiff.clone().multiplyScalar(0.5);
  const posDiffHalfInv = posDiffHalf.clone().multiplyScalar(-1);
  console.log("posDiff", posDiff);
  world.createImpulseJoint(JointData.fixed(posDiffHalf, new Quaternion(), posDiffHalfInv, new Quaternion()), part1.rigidBody!, part2.rigidBody!, true);
};

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
    rotation: new Euler(0, degToRad(-45), degToRad(45)),
  },
  L: {
    part: SmallRudder,
    rotation: new Euler(degToRad(30), degToRad(30), 0),
  },
};

// next to each other means equal any two of X, Y or Z and the third one is different exactly by 1
const nextToEachOther = (part1: ShipPartInstance, part2: ShipPartInstance) => {
  const pos1 = part1.rigidBody!.translation();
  const pos2 = part2.rigidBody!.translation();
  return (
    ((pos1.x === pos2.x && pos1.y === pos2.y && pos1.z - pos2.z === 1) ||
      (pos1.x === pos2.x && pos1.z === pos2.z && pos1.y - pos2.y === 1) ||
      (pos1.y === pos2.y && pos1.z === pos2.z && pos1.x - pos2.x === 1)) &&
    new Vector3(pos1).sub(pos2)
  );
};
