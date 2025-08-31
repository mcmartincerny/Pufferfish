import RAPIER, { QueryFilterFlags, Ray } from "@dimforge/rapier3d-compat";
import { world } from "./Globals";
import { Quaternion as QuaternionClass, QuaternionLike, Vector2, Vector3 as Vector3Class, Vector3Like } from "three";
// import { Quaternion as QuaternionClass } from "three";

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

export const logMax = (name: string, value: number) => {
  if (maxValues[name] == null || value > maxValues[name]) {
    maxValues[name] = value;
    console.log(`${name} maxed out at ${value}`);
  }
};
const maxValues: Record<string, number> = {};

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

export class Quaternion extends QuaternionClass {
  constructor(xOrQuaternion?: QuaternionLike);
  constructor(xOrQuaternion?: number, y?: number, z?: number, w?: number);
  constructor(xOrQuaternion?: QuaternionLike | number | undefined, y?: number, z?: number, w?: number) {
    if (typeof xOrQuaternion === "object") {
      super(xOrQuaternion.x, xOrQuaternion.y, xOrQuaternion.z, xOrQuaternion.w);
    } else {
      super(xOrQuaternion, y, z, w);
    }
  }
}
export const log50 = (...values: any[]) => {
  if (Math.random() < 0.02) {
    console.log(...values);
  }
};

export const log10000 = (...values: any[]) => {
  if (Math.random() < 0.0001) {
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

export const castRay = (
  position: Vector3Like,
  direction: Vector3Like,
  filterFlags: QueryFilterFlags,
  filterPredicate: (collider: RAPIER.Collider) => boolean,
  maxDistance = 1
): number | false => {
  const ray = world.castRay(new Ray(position, direction), maxDistance, true, filterFlags, undefined, undefined, undefined, filterPredicate);
  if (ray) {
    return ray.timeOfImpact;
  }
  return false;
};

export const degToRad = (degrees: number) => {
  return degrees * (Math.PI / 180);
};

export const average = (array: number[]) => {
  let total = 0;
  for (const value of array) {
    total += value;
  }
  return total / array.length;
};

export const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const isVector2 = (value: any): value is Vector2 => {
  return value.isVector2;
};

export const createTimeStats = (name = "Average CPU time", logEverySeconds = 5) => {
  // returns 2 functions that will be called when start and end of the measurement
  // it will create variables to track time in the last 10 seconds and will add to them
  // after a few seconds it will console.log the average and reset the variables
  let startTime = 0;
  let time = 0;
  let count = 0;
  let measurementStart = 0;
  let longestTime = 0;
  return {
    start: () => {
      measurementStart = performance.now();
    },
    end: () => {
      count++;
      const currentTime = performance.now();
      time += currentTime - measurementStart;
      longestTime = Math.max(longestTime, currentTime - measurementStart);
      if (startTime === 0) {
        startTime = currentTime;
      }
      if (startTime + logEverySeconds * 1000 < currentTime) {
        console.log(`${name}: ${(time / count).toFixed(2)}ms, longest: ${longestTime.toFixed(2)}ms`);
        startTime = currentTime;
        time = 0;
        count = 0;
        longestTime = 0;
      }
    },
  };
};
