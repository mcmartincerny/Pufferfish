import RAPIER, { QueryFilterFlags, Ray } from "@dimforge/rapier3d-compat";
import { world } from "./Globals";
import { Vector3 as Vector3Class, Vector3Like } from "three";

export function clamp(num: number, min: number, max: number) {
  return Math.min(Math.max(num, min), max);
}

export function toRange(num: number, from: { min: number; max: number }, to: { min: number; max: number }) {
  const clampedNum = clamp(num, from.min, from.max);
  return ((clampedNum - from.min) * (to.max - to.min)) / (from.max - from.min) + to.min;
}

export const throttle = <R, A extends any[]>(fn: (...args: A) => R, delay: number): ((...args: A) => R | undefined) => {
  let wait = false;

  return (...args: A) => {
    if (wait) return undefined;

    const val = fn(...args);

    wait = true;

    window.setTimeout(() => {
      wait = false;
    }, delay);

    return val;
  };
};

export const log = throttle((...values: any[]) => {
  console.log(...values);
}, 500);

export class Vector3 extends Vector3Class {
  constructor(xOrVector: Vector3Like);
  constructor(xOrVector?: number, y?: number, z?: number);
  constructor(xOrVector?: Vector3Like | number, y?: number, z?: number) {
    if (typeof xOrVector === "object") {
      super(xOrVector.x, xOrVector.y, xOrVector.z);
    } else {
      super(xOrVector, y, z);
    }
  }
}

export const log50 = (...values: any[]) => {
  if (Math.random() < 0.02) {
    console.log(...values);
  }
};

/**
 * debug rigid body used only for visualizing some position
 * if there isn't one already created, it creates it and sets the position
 * if there is one already created, it sets the position
 */
export const debugRigidBody = (position: Vector3Like, name: string, zOffset = 0, radius = 0.1) => {
  let debugRigidBody = debugRigidBodies.get(name);
  if (debugRigidBody == null) {
    debugRigidBody = world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(position.x, position.y, position.z + zOffset));
    const coliderData = RAPIER.ColliderDesc.ball(radius).setCollisionGroups(Math.round(Math.random() * 1000));
    world.createCollider(coliderData, debugRigidBody);
    debugRigidBodies.set(name, debugRigidBody);
  } else {
    debugRigidBody.setTranslation(new RAPIER.Vector3(position.x, position.y, position.z + zOffset), true);
    debugRigidBody.collider(0)!.setRadius(radius);
  }
  return debugRigidBody;
};

const debugRigidBodies: Map<string, RAPIER.RigidBody> = new Map();

export const resetDebugRigidBodies = () => {
  debugRigidBodies.forEach((body) => {
    world.removeRigidBody(body);
  });
  debugRigidBodies.clear();
};

export const castRay = (position: Vector3Like, direction: Vector3Like, maxDistance = 0.3): number | false => {
  const ray = world.castRay(new Ray(position, direction), maxDistance, true, QueryFilterFlags.ONLY_FIXED);
  if (ray) {
    return ray.timeOfImpact;
  }
  return false;
};

export const degToRad = (degrees: number) => {
  return degrees * (Math.PI / 180);
};
