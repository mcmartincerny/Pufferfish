import RAPIER, { QueryFilterFlags, Ray, World } from "@dimforge/rapier3d-compat";
import { world } from "./Globals";
import { Euler, Mesh, Quaternion as QuaternionClass, QuaternionLike, Scene, Vector2, Vector3 as Vector3Class, Vector3Like } from "three";
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

export const radToDeg = (radians: number) => {
  return radians * (180 / Math.PI);
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

export function quantizeDirKey(direction: Vector3, rbQuat: Quaternion, stepDeg = 5) {
  // quantize yaw/pitch from direction, and body Euler from rbQuat (optional)
  const yaw = Math.round((Math.atan2(direction.y, direction.x) * 180) / Math.PI / stepDeg) * stepDeg;
  const pitch = Math.round((Math.asin(direction.z) * 180) / Math.PI / stepDeg) * stepDeg;
  const euler = new Euler().setFromQuaternion(rbQuat, "ZYX"); // choose order you use
  const rx = Math.round((euler.x * 180) / Math.PI / stepDeg) * stepDeg;
  const ry = Math.round((euler.y * 180) / Math.PI / stepDeg) * stepDeg;
  const rz = Math.round((euler.z * 180) / Math.PI / stepDeg) * stepDeg;
  return `${yaw}_${pitch}_${rx}_${ry}_${rz}`;
}

export class DragRayCache {
  cache = new Map<string, { localPoint: Vector3; localNormal: Vector3 }[]>();
  raysPerUnit: number;
  maxExtent: number; // how far from center the grid spans in world units
  constructor(raysPerUnit = 4, maxExtent = 3) {
    this.raysPerUnit = raysPerUnit;
    this.maxExtent = maxExtent;
  }

  // Build cache by casting rays in *world space* using 'direction' (velocity dir),
  // then converting hits into body-local coords and storing them.
  buildCacheForKey(
    key: string,
    rbTranslation: Vector3,
    rbQuat: Quaternion,
    direction: Vector3,
    world: World,
    collidersHandles: number[],
    maxLengthWorld: number
  ) {
    const hitsLocal: { localPoint: Vector3; localNormal: Vector3 }[] = [];

    const spacing = 1 / this.raysPerUnit;
    const worldUp = new Vector3(0, 0, 1);

    // RIGHT and UP for plane perpendicular to 'direction'
    const right = new Vector3().crossVectors(worldUp, direction);
    if (right.lengthSq() < 1e-6) right.set(1, 0, 0); // fallback when direction ~ parallel to up
    right.normalize();
    const up = new Vector3().crossVectors(direction, right).normalize();

    // anchor point in front of object
    const posInFront = new Vector3(rbTranslation).add(direction.clone().multiplyScalar(maxLengthWorld));

    // precompute inverse body rotation to map world hits into body-local
    const rbQuatInv = rbQuat.clone().invert();

    for (let x = -this.maxExtent; x <= this.maxExtent; x += spacing) {
      for (let y = -this.maxExtent; y <= this.maxExtent; y += spacing) {
        const worldOrigin = posInFront.clone().add(right.clone().multiplyScalar(x)).add(up.clone().multiplyScalar(y));
        const ray = new Ray(worldOrigin, direction.clone().negate()); // cast 'backwards' into the ship
        const hit = world.castRayAndGetNormal(ray, maxLengthWorld * 2, true, QueryFilterFlags.ONLY_DYNAMIC, undefined, undefined, undefined, (coll) =>
          collidersHandles.includes(coll.handle)
        );
        if (!hit) continue;

        const hitPointWorld = ray.pointAt(hit.timeOfImpact);
        debugRigidBody(hitPointWorld, `hitPointWorld - ${x} - ${y}`);
        const normalWorld = new Vector3(hit.normal);

        // Convert to body-local coordinates and store that in cache
        const localPoint = new Vector3(hitPointWorld).sub(rbTranslation).applyQuaternion(rbQuatInv);
        const localNormal = normalWorld.clone().applyQuaternion(rbQuatInv).normalize();

        hitsLocal.push({ localPoint, localNormal });
      }
    }

    this.cache.set(key, hitsLocal);
    return hitsLocal;
  }

  getCached(key: string) {
    return this.cache.get(key);
  }

  clear() {
    this.cache.clear();
  }
}

export function destroySceneObjects(scene: Scene) {
  scene.traverse((object) => {
    console.log("disposing", object);
    if (hasDispose(object)) {
      object.dispose(false);
    }

    if (!isMesh(object)) return;

    // Dispose of geometries
    if (object.geometry) {
      object.geometry.dispose();
    }

    // Dispose of materials
    if (object.material) {
      if (Array.isArray(object.material)) {
        object.material.forEach((material) => material.dispose());
      } else {
        object.material.dispose();
      }
    }
  });

  // Remove objects from the scene
  while (scene.children.length > 0) {
    scene.remove(scene.children[0]);
  }
}

function hasDispose(object: any): object is { dispose: (...args: any) => void } {
  return object && object.dispose;
}

function isMesh(object: any): object is Mesh {
  return object && object.isMesh;
}
