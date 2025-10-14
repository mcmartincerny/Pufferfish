import { Euler } from "three";
import { BuoyantObject } from "./BuoyantObject";
import {
  Helm,
  LeadBox,
  BuildablePartInstance,
  BuildablePartConstructor,
  WoodenBox,
  WoodenRamp,
  Propeller,
  ThrustingPart,
  RudderPart,
  SmallRudder,
} from "./ShipParts";
import { degToRad, Quaternion, Vector3 } from "../helpers";
import { shipDesign } from "./shipDesigns";
import { world } from "../Globals";
import { RigidBody, RigidBodyDesc } from "@dimforge/rapier3d-compat";
import { Blueprint, BlueprintPart, BuildableData } from "./BlueprintBuildable";

export type ShipProps = BuildableData;

export class Ship extends BuoyantObject {
  rigidBody: RigidBody;
  parts: BuildablePartInstance[] = [];
  helm!: Helm;
  thrustParts: ThrustingPart[] = [];
  rudderParts: RudderPart[] = [];
  isShip = true;
  blueprint: Blueprint;
  shipProps: ShipProps;
  constructor(shipProps: ShipProps) {
    super({ size: 1 });
    this.shipProps = shipProps;
    const { position, rotation, blueprint } = shipProps;
    this.blueprint = blueprint;
    if (!this.blueprint.isShip) {
      throw new Error("Blueprint is not a ship");
    }
    // Single rigid body for the entire ship
    this.rigidBody = world.createRigidBody(RigidBodyDesc.dynamic().setTranslation(position.x, position.y, position.z));
    if (rotation) {
      this.rigidBody.setRotation(rotation, true);
    }
    let hasHelm = false;
    const partsOnShip = this.blueprint.parts;
    for (const part of partsOnShip) {
      const { part: Part, position: partPosition, rotation } = part;
      const rotationQuaternion = new Quaternion().setFromEuler(rotation);
      // Create part with LOCAL transform relative to the ship's origin
      const instance = new Part({ rotation: rotationQuaternion, translation: partPosition });
      // Attach colliders to the ship's single rigid body
      instance.attachToShip(this);
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
  }
}

const shipDesignToPartsOnShip = (design: string[][]): BlueprintPart[] => {
  const partsOnShip: BlueprintPart[] = [];

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
  V: {
    part: WoodenRamp,
    rotation: new Euler(degToRad(180), 0, degToRad(90)),
  },
  H: {
    part: Helm,
    rotation: new Euler(0, 0, 0),
  },
  L: {
    part: LeadBox,
    rotation: new Euler(0, 0, 0),
  },
  T: {
    part: Propeller,
    rotation: new Euler(0, 0, 0),
  },
  R: {
    part: SmallRudder,
    rotation: new Euler(degToRad(0), degToRad(0), degToRad(0)),
  },
  Q: {
    part: SmallRudder,
    rotation: new Euler(degToRad(0), degToRad(90), degToRad(0)),
  },
};

export const defaultShipBlueprint: Blueprint = {
  name: "Default",
  description: "Default ship blueprint",
  isShip: true,
  parts: shipDesignToPartsOnShip(shipDesign),
};
