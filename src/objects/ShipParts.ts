import { BoxGeometry, Color, CylinderGeometry, Euler, Mesh, MeshPhongMaterial, Vector3 as ThreeVector3, Object3D } from "three";
import { clamp, degToRad, Quaternion, Vector3 } from "../helpers";
import { ActiveHooks, ColliderDesc } from "@dimforge/rapier3d-compat";
import { world, currentDeltaTime } from "../Globals";
import { createConvexMeshColliderForMesh, PrismGeometry } from "./Shapes";
import RAPIER from "@dimforge/rapier3d-compat";
import { Ship } from "./Ship";
import { BetterObject3D } from "./BetterObject3D";

export type ShipPartConstructor = typeof Helm | typeof WoodenBox | typeof WoodenRamp | typeof LeadBox | typeof Propeller | typeof SmallRudder;
export type ShipPartInstance = Helm | WoodenBox | WoodenRamp | LeadBox | Propeller | SmallRudder;

export type ShipPartProps = {
  rotation: Quaternion;
  translation: Vector3;
};
export class ShipPart extends BetterObject3D {
  buildRotation: Quaternion;
  localTranslation: Vector3 = new Vector3(0, 0, 0);
  ship?: Ship;
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
}

export class Helm extends ShipPart {
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
  constructor(props: ShipPartProps) {
    super({ rotation: props.rotation, translation: props.translation });
    const geometry = new BoxGeometry(1, 1, 1);
    const material = new MeshPhongMaterial({ color: randomizeColor(0x735928, 0.1) });
    const cube = new Mesh(geometry, material);
    this.mainMesh = cube;
    this.add(cube);
  }

  attachToShip(ship: Ship) {
    this.ship = ship;
    const rb = ship.rigidBody;
    const collider = world.createCollider(
      ColliderDesc.cuboid(0.5, 0.5, 0.5)
        .setTranslation(this.localTranslation.x, this.localTranslation.y, this.localTranslation.z)
        .setRotation(new RAPIER.Quaternion(this.buildRotation.x, this.buildRotation.y, this.buildRotation.z, this.buildRotation.w)),
      rb
    );
    collider.setActiveHooks(ActiveHooks.FILTER_CONTACT_PAIRS);
    collider.setRestitution(0.3);
    collider.setFriction(0.5);
  }
}

export class WoodenRamp extends ShipPart {
  constructor({ rotation, translation }: ShipPartProps) {
    super({ rotation: rotation, translation: translation });
    // Build visual prism geometry in local space, rotated accordingly
    const prismGeometry = new PrismGeometry({ length: 1, width: 1, height: 1 });
    // Align pivot similarly to Shapes.createPrismWithColider
    const halfLength = 1 / 2;
    const halfWidth = 1 / 2;
    const halfHeight = 1 / 2;
    prismGeometry.translate(-halfLength, halfWidth, -halfHeight);
    const prismMaterial = new MeshPhongMaterial({ color: 0x44aa88 });
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
  constructor(props: ShipPartProps) {
    super(props);
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
    const submerged = this.ship.percentageSubmerged;
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
  thrustForce = 3;
  density = 3;

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
  dragFraction = 0.3;

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
    const magnitude = (this.ship?.percentageSubmerged ?? 0) * this.turningStrength * speedAlongForward * Math.abs(Math.sin(this.currentAngleRad));
    if (magnitude <= 0) return;

    // Application point (approximate; consistent with thrust implementation)
    const point = new Vector3(this.localTranslation).add(this.forcePositionRelativeToPart).applyQuaternion(partRotation).add(new Vector3(rb.translation()));

    // Turning impulse
    const turningImpulse = lateralDir.clone().multiplyScalar(magnitude);
    rb.applyImpulseAtPoint(turningImpulse, point, true);

    // Optional drag could be added here if needed
  }
}

export class SmallRudder extends RudderPart {
  rotationSpeedRadPerSec = degToRad(80);
  turningStrength = 0.5;
  forcePositionRelativeToPart = new Vector3(0, 0, 0);

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
