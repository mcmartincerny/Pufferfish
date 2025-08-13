import { BoxGeometry, Color, CylinderGeometry, Euler, Mesh, MeshPhongMaterial, Vector3 as ThreeVector3 } from "three";
import { BuoyantObject } from "./BuoyantObject";
import { clamp, degToRad, log, logMax, Quaternion, Vector3 } from "../helpers";
import { ActiveHooks, ColliderDesc } from "@dimforge/rapier3d-compat";
import { RigidBodyDesc } from "@dimforge/rapier3d-compat";
import { world, currentDeltaTime } from "../Globals";
import { createPrismWithColider } from "./Shapes";

export type ShipPartConstructor = typeof Helm | typeof WoodenBox | typeof WoodenRamp | typeof LeadBox | typeof Propeller | typeof SmallRudder;
export type ShipPartInstance = Helm | WoodenBox | WoodenRamp | LeadBox | Propeller | SmallRudder;

export type ShipPartProps = {
  size?: number;
  rotation?: Quaternion;
};
export class ShipPart extends BuoyantObject {
  constructRotation?: Quaternion;
  constructor({ size = 1, rotation }: ShipPartProps) {
    super({ size: size });
    this.constructRotation = rotation;
  }
}

export class Helm extends ShipPart {
  constructor() {
    super({ size: 0.3 });
    const geometry = new BoxGeometry(0.8, 0.2, 0.9);
    geometry.translate(0, -0.3, 0);
    const material = new MeshPhongMaterial({ color: randomizeColor(0xaa5555, 0.1) });
    const cube = new Mesh(geometry, material);
    const rigidBody = world.createRigidBody(RigidBodyDesc.dynamic().setTranslation(0, 0, 0));
    const collider = world.createCollider(ColliderDesc.cuboid(0.4, 0.1, 0.45).setTranslation(0.0, -0.3, 0.0), rigidBody);
    collider.setActiveHooks(ActiveHooks.FILTER_CONTACT_PAIRS);
    collider.setRestitution(0.3);
    collider.setFriction(0.5);
    this.rigidBody = rigidBody;
    this.mainMesh = cube;
    this.add(cube);
  }
}

export class WoodenBox extends ShipPart {
  constructor() {
    super({ size: 1 });
    const geometry = new BoxGeometry(1, 1, 1);
    const material = new MeshPhongMaterial({ color: randomizeColor(0x735928, 0.1) });
    const cube = new Mesh(geometry, material);
    const rigidBody = world.createRigidBody(RigidBodyDesc.dynamic().setTranslation(0, 0, 0));
    const collider = world.createCollider(ColliderDesc.cuboid(0.5, 0.5, 0.5).setTranslation(0.0, 0.0, 0.0), rigidBody);
    collider.setActiveHooks(ActiveHooks.FILTER_CONTACT_PAIRS);
    collider.setRestitution(0.3); // TODO: maybe restitution and friction are not needed at all
    collider.setFriction(0.5);
    this.rigidBody = rigidBody;
    this.mainMesh = cube;
    this.add(cube);
  }
}

export class WoodenRamp extends ShipPart {
  constructor({ rotation }: ShipPartProps) {
    super({ size: 1, rotation: rotation });
    const { prism, rigidBody, collider } = createPrismWithColider({ length: 1, width: 1, height: 1 }, undefined, rotation);
    collider.setActiveHooks(ActiveHooks.FILTER_CONTACT_PAIRS);
    collider.setRestitution(0.3);
    collider.setFriction(0.5);
    this.rigidBody = rigidBody;
    this.mainMesh = prism;
    this.add(prism);
  }
}

export class LeadBox extends WoodenBox {
  constructor() {
    super();
    const material = new MeshPhongMaterial({ color: 0x999999 });
    this.mainMesh!.material = material;
    this.rigidBody!.collider(0).setDensity(10);
  }
}

export class ThrustingPart extends ShipPart {
  thrustPositionRelativeToPart = new Vector3(0, 0, 0);
  thrustRotation = new Quaternion().setFromEuler(new Euler(0, 0, degToRad(0)));
  thrustForce = 0;
  needsWater = true;

  constructor({ size = 1, rotation }: ShipPartProps) {
    super({ size: size, rotation: rotation });
  }

  /*
    Force number between -1 and 1
  */
  thrust(force: number) {
    if (!this.rigidBody)
      throw new Error("ThrustingPart has no rigid body! It should not be instantiated directly, it be extended and rigid body should be set in the subclass");
    const totalThrustForce = this.thrustForce * force;
    const point = new Vector3(this.rigidBody.translation()).add(this.thrustPositionRelativeToPart);
    let impulseLength = totalThrustForce;
    if (this.needsWater && this.percentageSubmerged < 1) {
      impulseLength = totalThrustForce * this.percentageSubmerged;
    }
    const partRotation = new Quaternion(this.rigidBody.rotation());
    const partRotationAndThrustRotation = partRotation.multiply(this.thrustRotation);
    const localForward = new Vector3(0, -1, 0);
    const worldDirection = new Vector3(localForward).applyQuaternion(partRotationAndThrustRotation).normalize();
    const impulse = worldDirection.multiplyScalar(impulseLength);
    this.rigidBody.applyImpulseAtPoint(impulse, point, true);
  }
}

export class Propeller extends ThrustingPart {
  thrustForce = 3;

  constructor({ rotation }: ShipPartProps) {
    super({ size: 0.5, rotation: rotation });
    const geometry = new CylinderGeometry(0.2, 0.2, 1, 10, 1);
    const material = new MeshPhongMaterial({ color: 0x999999 });
    const propeller = new Mesh(geometry, material);
    const rigidBody = world.createRigidBody(RigidBodyDesc.dynamic().setTranslation(0, 0, 0));
    const collider = world.createCollider(ColliderDesc.cylinder(0.5, 0.2).setTranslation(0.0, 0.0, 0.0), rigidBody);
    collider.setActiveHooks(ActiveHooks.FILTER_CONTACT_PAIRS);
    collider.setRestitution(0.3);
    collider.setFriction(0.5);
    this.rigidBody = rigidBody;
    this.mainMesh = propeller;
    this.add(propeller);
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
  dragFraction = 0.3;

  constructor({ size = 0.5 }: { size?: number } = {}) {
    super({ size });
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
    if (!this.rigidBody) return;

    const vel = new Vector3(this.rigidBody.linvel());
    if (vel.length() < 0.01 || Math.abs(this.currentAngleRad) < 0.01) {
      return;
    }

    // Part orientation
    const partRotation = new Quaternion(this.rigidBody.rotation());
    const localForward = new Vector3(0, 1, 0);
    const localRight = new Vector3(-1, 0, 0);
    const forwardWorld = new Vector3(localForward).applyQuaternion(partRotation).normalize();
    const rightWorld = new Vector3(localRight).applyQuaternion(partRotation);

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
    const magnitude = this.percentageSubmerged * this.turningStrength * speedAlongForward * Math.abs(Math.sin(this.currentAngleRad));
    if (magnitude <= 0) return;

    // Application point (approximate; consistent with thrust implementation)
    const point = new Vector3(this.rigidBody.translation()).add(this.forcePositionRelativeToPart);

    // Turning impulse
    const turningImpulse = lateralDir.clone().multiplyScalar(magnitude);
    this.rigidBody.applyImpulseAtPoint(turningImpulse, point, true);

    // Optional drag could be added here if needed
  }
}

export class SmallRudder extends RudderPart {
  rotationSpeedRadPerSec = degToRad(80);
  turningStrength = 0.1;
  forcePositionRelativeToPart = new Vector3(0, 0, 0);

  constructor() {
    super({ size: 0.5 });
    // Simple visual: thin vertical plate
    const geometry = new BoxGeometry(0.1, 1, 0.8);
    // Shift pivot to the front (leading edge) so rotation keeps the front in place
    geometry.translate(0, 0.5, 0);
    const material = new MeshPhongMaterial({ color: randomizeColor(0x334455, 0.05) });
    const rudderMesh = new Mesh(geometry, material);
    // Place hinge at the cell boundary toward the ship (Y - 0.5)
    rudderMesh.position.y = -0.5;

    const rigidBody = world.createRigidBody(RigidBodyDesc.dynamic().setTranslation(0, 0, 0));
    const collider = world.createCollider(ColliderDesc.cuboid(0.05, 0.5, 0.4).setTranslation(0.0, 0.0, 0.0), rigidBody);
    collider.setActiveHooks(ActiveHooks.FILTER_CONTACT_PAIRS);
    collider.setRestitution(0.2);
    collider.setFriction(0.6);

    this.rigidBody = rigidBody;
    this.mainMesh = rudderMesh;
    this.add(rudderMesh);
  }
}

const randomColor = () => {
  return new Color(Math.random(), Math.random(), Math.random());
};

const randomizeColor = (color: string | number | Color, randomness = 0.1) => {
  if (!(color instanceof Color)) {
    color = new Color(color);
  }
  const r = clamp(color.r + Math.random() * randomness, 0, 1);
  const g = clamp(color.g + Math.random() * randomness, 0, 1);
  const b = clamp(color.b + Math.random() * randomness, 0, 1);
  return new Color(r, g, b);
};
