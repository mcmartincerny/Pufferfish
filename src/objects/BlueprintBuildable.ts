import { Euler } from "three";
import { Vector3 } from "../helpers";
import { BetterObject3D } from "./BetterObject3D";
import { ShipPartConstructor } from "./ShipParts";
import { ShipProps } from "./Ship";

export class BlueprintBuildable extends BetterObject3D {
  constructor(public shipProps: ShipProps) {
    super();
    this.position.copy(shipProps.position);
    this.setRotationFromQuaternion(shipProps.rotation);
  }
}

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
