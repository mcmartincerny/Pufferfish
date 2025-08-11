import { BoxGeometry, Color, CylinderGeometry, Euler, Mesh, MeshPhongMaterial, Quaternion } from "three";
import { BuoyantObject } from "./BuoyantObject";
import { clamp, Vector3 } from "../helpers";
import { ActiveHooks, ColliderDesc } from "@dimforge/rapier3d-compat";
import { RigidBodyDesc } from "@dimforge/rapier3d-compat";
import { world } from "../Globals";
import { createPrismWithColider } from "./Shapes";

export type ShipPartConstructor = typeof Helm | typeof WoodenBox | typeof WoodenRamp | typeof LeadBox | typeof Propeller;
export type ShipPartInstance = Helm | WoodenBox | WoodenRamp | LeadBox | Propeller;

export class ShipPart extends BuoyantObject {
  constructor({ size = 1 }: { size?: number }) {
    super({ size: size });
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
  constructor(rotation: Quaternion) {
    super({ size: 1 });
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
  thrustRotation = new Euler();
  thrustForce = 0;

  constructor({ size = 1 }: { size?: number }) {
    super({ size: size });
  }

  /*
    Force number between -1 and 1
  */
  thrust(force: number) {
    if (!this.rigidBody)
      throw new Error("ThrustingPart has no rigid body! It should not be instantiated directly, it be extended and rigid body should be set in the subclass");
    const totalThrustForce = this.thrustForce * force;
    const point = new Vector3(this.rigidBody.translation()).add(this.thrustPositionRelativeToPart);
    const impulse = new Vector3(this.thrustRotation).multiplyScalar(totalThrustForce);
    this.rigidBody.applyImpulseAtPoint(impulse, point, true);
  }
}

export class Propeller extends ThrustingPart {
  constructor() {
    super({ size: 0.5 });
    const geometry = new CylinderGeometry(0.2, 0.2, 0.5, 5, 5);
    const material = new MeshPhongMaterial({ color: 0x999999 });
    const propeller = new Mesh(geometry, material);
    const rigidBody = world.createRigidBody(RigidBodyDesc.dynamic().setTranslation(0, 0, 0));
    const collider = world.createCollider(ColliderDesc.cylinder(0.2, 0.5).setTranslation(0.0, 0.0, 0.0), rigidBody);
    collider.setActiveHooks(ActiveHooks.FILTER_CONTACT_PAIRS);
    collider.setRestitution(0.3);
    collider.setFriction(0.5);
    this.rigidBody = rigidBody;
    this.mainMesh = propeller;
    this.add(propeller);
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
