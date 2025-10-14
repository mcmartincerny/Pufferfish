import { BoxGeometry, Color, CylinderGeometry, Euler, Mesh, MeshPhongMaterial, Vector3 as ThreeVector3, Object3D, Box3 } from "three";
import { clamp, degToRad, log10000, log50, Quaternion, Vector3 } from "../helpers";
import { ActiveHooks, ColliderDesc } from "@dimforge/rapier3d-compat";
import { world, currentDeltaTime } from "../Globals";
import { createConvexMeshColliderForMesh, PrismGeometry } from "./Shapes";
import RAPIER from "@dimforge/rapier3d-compat";
import { Ship } from "./Ship";
import { BetterObject3D } from "./BetterObject3D";
import { WATER_LINE_Z } from "./Water";

export type BuildablePartConstructor =
  | typeof Helm
  | typeof WoodenBox
  | typeof WoodenBox2x1x1
  | typeof WoodenBox2x2x1
  | typeof WoodenBox2x2x2
  | typeof WoodenBox3x3x3
  | typeof WoodenRamp
  | typeof LeadBox
  | typeof Propeller
  | typeof SmallRudder;
export type BuildablePartInstance = InstanceType<BuildablePartConstructor>;

export type ShipPartProps = {
  rotation: Quaternion;
  translation: Vector3;
};

// TODO: Rename all ship... things in this file to buildable... and make sure it works with fixed structures
export class ShipPart extends BetterObject3D {
  buildRotation: Quaternion;
  localTranslation: Vector3 = new Vector3(0, 0, 0);
  ship?: Ship;

  // Static properties that subclasses must define
  static getPartInfo(): ShipPartInfo {
    throw new Error("Subclasses must implement getPartInfo()");
  }
  constructor({ rotation, translation }: ShipPartProps) {
    super();
    this.buildRotation = rotation;
    this.localTranslation = translation;
    // Set the part's local transform so visuals match
    this.position.copy(this.localTranslation);
    this.quaternion.copy(this.buildRotation);
  }

  // Called by Ship after construction to attach physics shape(s)
  attachToShip(ship: Ship) {
    this.ship = ship;
  }

  // Calculate how much of this part is submerged based on its mesh geometry
  getPercentageSubmerged(): number {
    if (!this.ship || !this.mainMesh) return 0;

    // Get the mesh's bounding box in world space
    const boundingBox = new Box3().setFromObject(this.mainMesh);
    const size = new Vector3();
    boundingBox.getSize(size);

    const partCenterWorld = new Vector3();
    this.mainMesh.getWorldPosition(partCenterWorld);

    // Calculate the top and bottom Z coordinates of the part in world space
    const halfHeight = Math.max(size.x, size.y, size.z) / 2;
    const topZ = partCenterWorld.z + halfHeight;
    const bottomZ = partCenterWorld.z - halfHeight;

    // Calculate submergence percentage based on how much of the part is below water
    if (topZ <= WATER_LINE_Z) {
      // Entirely submerged
      return 1.0;
    } else if (bottomZ >= WATER_LINE_Z) {
      // Entirely above water
      return 0.0;
    } else {
      // Partially submerged
      const submergedHeight = WATER_LINE_Z - bottomZ;
      return clamp(submergedHeight / size.z, 0, 1);
    }
  }
}

export class Helm extends ShipPart {
  static getPartInfo(): ShipPartInfo {
    return {
      id: "helm",
      name: "Helm",
      category: "Controls",
      description: "Ship steering wheel is the main part of your ship. You can place only one helm on your ship.",
      price: 45,
      weight: 8.5,
      constructor: Helm,
    };
  }

  constructor(props: ShipPartProps) {
    super({ rotation: props.rotation, translation: props.translation });
    const geometry = new BoxGeometry(0.8, 0.2, 0.9);
    geometry.translate(0, -0.3, 0);
    const material = new MeshPhongMaterial({ color: randomizeColor(0xaa5555, 0.1) });
    const cube = new Mesh(geometry, material);
    this.mainMesh = cube;
    this.add(cube);
  }

  attachToShip(ship: Ship) {
    this.ship = ship;
    const rb = ship.rigidBody;
    // Offset -0.3 along the part's local Y must be rotated into ship space
    const offset = new Vector3(0, -0.3, 0).applyQuaternion(this.buildRotation);
    const localPos = new Vector3(this.localTranslation).add(offset);
    const collider = world.createCollider(
      ColliderDesc.cuboid(0.4, 0.1, 0.45)
        .setTranslation(localPos.x, localPos.y, localPos.z)
        .setRotation(new RAPIER.Quaternion(this.buildRotation.x, this.buildRotation.y, this.buildRotation.z, this.buildRotation.w)),
      rb
    );
    collider.setActiveHooks(ActiveHooks.FILTER_CONTACT_PAIRS); // TODO remove this and add collider restitution and friction to the ship part code
    collider.setRestitution(0.3);
    collider.setFriction(0.5);
  }
}

export class WoodenBox extends ShipPart {
  size = [1, 1, 1];
  static getPartInfo(): ShipPartInfo {
    return {
      id: "wooden-box",
      name: "Wooden Box",
      category: "Structural",
      description: "Basic wooden structural component. Provides buoyancy and structural integrity.",
      price: 15,
      weight: 12.0,
      constructor: WoodenBox,
    };
  }

  constructor(props: ShipPartProps, size?: [number, number, number]) {
    super({ rotation: props.rotation, translation: props.translation });
    if (size) {
      this.size = size;
    }
    const geometry = new BoxGeometry(this.size[0], this.size[1], this.size[2]);
    const material = new MeshPhongMaterial({ color: randomizeColor(0x735928, 0.05) });
    const cube = new Mesh(geometry, material);
    this.mainMesh = cube;
    this.add(cube);
  }

  attachToShip(ship: Ship) {
    this.ship = ship;
    const rb = ship.rigidBody;
    const collider = world.createCollider(
      ColliderDesc.cuboid(this.size[0] / 2, this.size[1] / 2, this.size[2] / 2)
        .setTranslation(this.localTranslation.x, this.localTranslation.y, this.localTranslation.z)
        .setRotation(new RAPIER.Quaternion(this.buildRotation.x, this.buildRotation.y, this.buildRotation.z, this.buildRotation.w)),
      rb
    );
    collider.setActiveHooks(ActiveHooks.FILTER_CONTACT_PAIRS);
    collider.setRestitution(0.3);
    collider.setFriction(0.5);
  }
}

export class WoodenBox2x1x1 extends WoodenBox {
  constructor(props: ShipPartProps) {
    super(props, [2, 1, 1]);
  }
  static getPartInfo(): ShipPartInfo {
    return {
      ...super.getPartInfo(),
      id: "wooden-box-2x1x1",
      name: "Wooden Box 2x1x1",
      constructor: WoodenBox2x1x1,
    };
  }
}

export class WoodenBox2x2x1 extends WoodenBox {
  constructor(props: ShipPartProps) {
    super(props, [2, 2, 1]);
  }
  static getPartInfo(): ShipPartInfo {
    return {
      ...super.getPartInfo(),
      id: "wooden-box-2x2x1",
      name: "Wooden Box 2x2x1",
      constructor: WoodenBox2x2x1,
    };
  }
}

export class WoodenBox2x2x2 extends WoodenBox {
  constructor(props: ShipPartProps) {
    super(props, [2, 2, 2]);
  }
  static getPartInfo(): ShipPartInfo {
    return {
      ...super.getPartInfo(),
      id: "wooden-box-2x2x2",
      name: "Wooden Box 2x2x2",
      constructor: WoodenBox2x2x2,
    };
  }
}

export class WoodenBox3x3x3 extends WoodenBox {
  constructor(props: ShipPartProps) {
    super(props, [3, 3, 3]);
  }
  static getPartInfo(): ShipPartInfo {
    return {
      ...super.getPartInfo(),
      id: "wooden-box-3x3x3",
      name: "Wooden Box 3x3x3",
      constructor: WoodenBox3x3x3,
    };
  }
}

export class WoodenRamp extends ShipPart {
  static getPartInfo(): ShipPartInfo {
    return {
      id: "wooden-ramp",
      name: "Wooden Ramp",
      category: "Structural",
      description: "Sloped wooden ramp for creating inclines or vehicle access. Great for building docks.",
      price: 22,
      weight: 18.0,
      constructor: WoodenRamp,
    };
  }

  constructor({ rotation, translation }: ShipPartProps) {
    super({ rotation: rotation, translation: translation });
    // Build visual prism geometry in local space, rotated accordingly
    const prismGeometry = new PrismGeometry({ length: 1, width: 1, height: 1 });
    // Align pivot similarly to Shapes.createPrismWithColider
    const halfLength = 1 / 2;
    const halfWidth = 1 / 2;
    const halfHeight = 1 / 2;
    prismGeometry.translate(-halfLength, halfWidth, -halfHeight);
    const prismMaterial = new MeshPhongMaterial({ color: randomizeColor(0x735928, 0.05) });
    const prism = new Mesh(prismGeometry, prismMaterial);
    this.mainMesh = prism;
    this.add(prism);
  }

  attachToShip(ship: Ship) {
    this.ship = ship;
    const rb = ship.rigidBody;
    const desc = createConvexMeshColliderForMesh(this.mainMesh!);
    desc.setTranslation(this.localTranslation.x, this.localTranslation.y, this.localTranslation.z);
    desc.setRotation(this.buildRotation);
    const collider = world.createCollider(desc, rb);
    collider.setActiveHooks(ActiveHooks.FILTER_CONTACT_PAIRS);
    collider.setRestitution(0.3);
    collider.setFriction(0.5);
  }
}

export class LeadBox extends WoodenBox {
  static getPartInfo(): ShipPartInfo {
    return {
      id: "lead-box",
      name: "Lead Box",
      category: "Structural",
      description: "Heavy lead-weighted box for ballast. Increases stability but adds significant weight.",
      price: 35,
      weight: 85.0,
      constructor: LeadBox,
    };
  }

  constructor(props: ShipPartProps) {
    super(props, [1, 1, 1]);
    const material = new MeshPhongMaterial({ color: 0x999999 });
    this.mainMesh!.material = material;
  }

  attachToShip(ship: Ship) {
    super.attachToShip(ship);
    // Increase density on the last added collider (this part's collider)
    const rb = ship.rigidBody;
    const lastIndex = rb.numColliders() - 1;
    if (lastIndex >= 0) {
      rb.collider(lastIndex).setDensity(10); // TODO: Add colliders array to ship part itself to have all the colliders for the part
    }
  }
}

export class ThrustingPart extends ShipPart {
  thrustPositionRelativeToPart = new Vector3(0, 0, 0);
  thrustRotation = new Quaternion().setFromEuler(new Euler(0, 0, degToRad(0)));
  thrustForce = 0;
  needsWater = true;

  constructor({ rotation, translation }: ShipPartProps) {
    super({ rotation: rotation, translation: translation });
  }

  /*
    Force number between -1 and 1
  */
  thrust(force: number) {
    if (!this.ship) throw new Error("ThrustingPart must be attached to a ship before use");
    const totalThrustForce = this.thrustForce * force;
    const shipBody = this.ship.rigidBody;
    const shipPos = new Vector3(shipBody.translation());
    const shipRot = new Quaternion(shipBody.rotation());
    // World point: ship position + rotated local part position + rotated thrust position relative to part
    const partWorldRot = new Quaternion(shipRot).multiply(this.buildRotation);
    const point = new Vector3(this.localTranslation).add(this.thrustPositionRelativeToPart).applyQuaternion(partWorldRot).add(shipPos);
    let impulseLength = totalThrustForce;
    const submerged = this.getPercentageSubmerged();
    if (this.needsWater && submerged < 1) {
      impulseLength = totalThrustForce * submerged;
    }
    const partRotationAndThrustRotation = new Quaternion(partWorldRot).multiply(this.thrustRotation);
    const localForward = new Vector3(0, -1, 0);
    const worldDirection = new Vector3(localForward).applyQuaternion(partRotationAndThrustRotation).normalize();
    const impulse = worldDirection.multiplyScalar(impulseLength);
    shipBody.applyImpulseAtPoint(impulse, point, true);
  }
}

export class Propeller extends ThrustingPart {
  thrustForce = 2;
  density = 3;

  static getPartInfo(): ShipPartInfo {
    return {
      id: "propeller",
      name: "Propeller",
      category: "Propulsion",
      description: "Water propulsion system for ship movement. Requires submersion to function effectively.",
      price: 65,
      weight: 15.0,
      constructor: Propeller,
    };
  }

  constructor({ rotation, translation }: ShipPartProps) {
    super({ rotation: rotation, translation: translation });
    const geometry = new CylinderGeometry(0.2, 0.2, 1, 10, 1);
    const material = new MeshPhongMaterial({ color: 0x999999 });
    const propeller = new Mesh(geometry, material);
    this.mainMesh = propeller;
    this.add(propeller);
  }

  attachToShip(ship: Ship) {
    this.ship = ship;
    const rb = ship.rigidBody;
    const collider = world.createCollider(
      ColliderDesc.cylinder(0.5, 0.2)
        .setTranslation(this.localTranslation.x, this.localTranslation.y, this.localTranslation.z)
        .setRotation(new RAPIER.Quaternion(this.buildRotation.x, this.buildRotation.y, this.buildRotation.z, this.buildRotation.w)),
      rb
    );
    collider.setActiveHooks(ActiveHooks.FILTER_CONTACT_PAIRS);
    collider.setRestitution(0.3);
    collider.setFriction(0.5);
    collider.setDensity(this.density);
  }
}

export class RudderPart extends ShipPart {
  currentAngleRad = 0;
  maxAngleRad = degToRad(45);
  // Rotation speed per frame in radians (no dt available in current pipeline)
  rotationSpeedRadPerSec = 0;
  // Target angle set by input [-maxAngleRad, maxAngleRad]
  private desiredAngleRad = 0;
  // Base turning strength scaling factor
  turningStrength = 0;
  // Where to apply the hydrodynamic force relative to the part
  forcePositionRelativeToPart = new Vector3(0, 0, 0);
  // Fraction of turning force applied as longitudinal drag
  dragFraction = 1;

  constructor({ rotation, translation }: ShipPartProps) {
    super({ rotation, translation });
  }

  setInput(input: number) {
    const clamped = clamp(input, -1, 1);
    this.desiredAngleRad = clamped * this.maxAngleRad;
  }

  stepRudder() {
    const delta = this.desiredAngleRad - this.currentAngleRad;
    const rotationSpeedRadPerFrame = (this.rotationSpeedRadPerSec * currentDeltaTime) / 1000;
    if (Math.abs(delta) <= rotationSpeedRadPerFrame) {
      this.currentAngleRad = this.desiredAngleRad;
    } else {
      this.currentAngleRad += Math.sign(delta) * rotationSpeedRadPerFrame;
    }

    this.mainMesh!.setRotationFromAxisAngle(new ThreeVector3(0, 0, 1), this.currentAngleRad);
  }

  applyHydrodynamicForces() {
    if (!this.ship) return;

    const rb = this.ship.rigidBody;
    const vel = new Vector3(rb.linvel());
    if (vel.length() < 0.01 || Math.abs(this.currentAngleRad) < 0.01) {
      return;
    }

    // Part orientation
    const shipRot = new Quaternion(rb.rotation());
    const partRotation = new Quaternion(shipRot).multiply(this.buildRotation);
    const localForward = new Vector3(0, 1, 0);
    const localRight = new Vector3(-1, 0, 0);
    const forwardWorld = new Vector3(localForward).applyQuaternion(partRotation).normalize();
    const rightWorld = new Vector3(localRight).applyQuaternion(partRotation).normalize();

    // Use only speed along part's actual forward direction (3D)
    const speedForwardSigned = vel.dot(forwardWorld);
    const speedAlongForward = Math.abs(speedForwardSigned);
    if (speedAlongForward < 0.001) return;

    const movingForward = speedForwardSigned >= 0;

    // Use full 3D right direction so roll produces some vertical component (realistic rudder lift)
    const rightLen = rightWorld.length();
    if (rightLen < 0.00001) return;
    const rightDir = rightWorld.clone().multiplyScalar(1 / rightLen);

    const lateralDir = this.currentAngleRad >= 0 ? rightDir : rightDir.multiplyScalar(-1);
    if (!movingForward) {
      lateralDir.multiplyScalar(-1);
    }

    // Magnitude scales with submerged %, turning strength, forward speed component, and rudder deflection
    const magnitude = this.getPercentageSubmerged() * this.turningStrength * speedAlongForward * Math.abs(Math.sin(this.currentAngleRad));
    if (magnitude <= 0) return;

    // Get center of mass and rudder application point
    const com = new Vector3(rb.worldCom());
    const rudderPoint = new Vector3(this.localTranslation)
      .add(this.forcePositionRelativeToPart)
      .applyQuaternion(partRotation)
      .add(new Vector3(rb.translation()));

    // Calculate lever arm (vector from COM to rudder point)
    const leverArm = rudderPoint.clone().sub(com);

    // Turning torque: τ = r × F where r is lever arm, F is turning force
    const turningForce = lateralDir.clone().multiplyScalar(magnitude);
    const turningTorque = new Vector3().crossVectors(leverArm, turningForce);
    rb.applyTorqueImpulse(turningTorque, true);
  }
}

export class SmallRudder extends RudderPart {
  rotationSpeedRadPerSec = degToRad(80);
  turningStrength = 0.25;
  forcePositionRelativeToPart = new Vector3(0, 0, 0);

  static getPartInfo(): ShipPartInfo {
    return {
      id: "small-rudder",
      name: "Small Rudder",
      category: "Controls",
      description: "Steering rudder for ship maneuverability. Essential for changing direction.",
      price: 30,
      weight: 6.0,
      constructor: SmallRudder,
    };
  }

  constructor(props: ShipPartProps) {
    super({ rotation: props.rotation, translation: props.translation });
    // Simple visual: thin vertical plate
    const geometry = new BoxGeometry(0.1, 1, 0.8);
    // Shift pivot to the front (leading edge) so rotation keeps the front in place
    geometry.translate(0, 0.5, 0);
    const material = new MeshPhongMaterial({ color: randomizeColor(0x334455, 0.05) });
    const rudderMesh = new Mesh(geometry, material);
    // Place hinge at the cell boundary toward the ship (Y - 0.5)
    rudderMesh.position.y = -0.5;
    this.mainMesh = rudderMesh;
    this.add(rudderMesh);
  }

  attachToShip(ship: Ship) {
    this.ship = ship;
    const rb = ship.rigidBody;
    const localOffset = new Vector3(0, 0, 0).applyQuaternion(this.buildRotation);
    const localPos = new Vector3(this.localTranslation).add(localOffset);
    const collider = world.createCollider(
      ColliderDesc.cuboid(0.05, 0.5, 0.4)
        .setTranslation(localPos.x, localPos.y, localPos.z)
        .setRotation(new RAPIER.Quaternion(this.buildRotation.x, this.buildRotation.y, this.buildRotation.z, this.buildRotation.w)),
      rb
    );
    collider.setActiveHooks(ActiveHooks.FILTER_CONTACT_PAIRS);
    collider.setRestitution(0.2);
    collider.setFriction(0.6);
  }
}

const randomizeColor = (color: string | number | Color, randomness = 0.1) => {
  if (!(color instanceof Color)) {
    color = new Color(color);
  }
  const r = clamp(color.r + Math.random() * randomness, 0, 1);
  const g = clamp(color.g + Math.random() * randomness, 0, 1);
  const b = clamp(color.b + Math.random() * randomness, 0, 1);
  return new Color(r, g, b);
};

export interface ShipPartInfo {
  id: string;
  name: string;
  category: string;
  description: string;
  price: number;
  weight: number;
  constructor: BuildablePartConstructor;
}

const allShipParts = [Helm, WoodenBox, WoodenBox2x1x1, WoodenBox2x2x1, WoodenBox2x2x2, WoodenBox3x3x3, WoodenRamp, LeadBox, Propeller, SmallRudder];

// Function to get all available ship parts
export function getAllShipParts(): ShipPartInfo[] {
  return allShipParts.map((part) => part.getPartInfo());
}

// Function to get unique categories
export function getShipPartCategories(): string[] {
  const categories = getAllShipParts().map((part) => part.category);
  return [...new Set(categories)];
}
