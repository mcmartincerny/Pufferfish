import { Collider, QueryFilterFlags, Ray, RigidBody } from "@dimforge/rapier3d-compat";
import { clamp, createTimeStats, debugRigidBody, degToRad, DragRayCache, log10000, log50, quantizeDirKey, Quaternion, toRange, Vector3 } from "../helpers";
import { BetterObject3D } from "./BetterObject3D";
import { WATER_LINE_Z } from "./Water";
import { currentDeltaTime, world } from "../Globals";
import { Euler, Vector3Like } from "three";

const BUOYANCY_FACTOR = 33;
const OBJECT_SIZE = 1;
const ANGULAR_DAMPING = 0.02; // TODO: Delete this when propper damping is implemented
const FAKE_DRAG_AT_LOW_SPEEDS = 0.001;

/**
 * BuoyantObject is a class that represents an object that is buoyant.
 * This should be used for ships and other objects that are floating on the water.
 */
export class BuoyantObject extends BetterObject3D {
  size: number;
  percentageSubmerged = 0;
  maxLengthFromCenter = 0; // furthest part from the center of the object
  dragCache: DragRayCache | null = null;
  isShip = false;
  constructor({ size = OBJECT_SIZE }: { size?: number } = {}) {
    super();
    this.size = size;
  }

  beforeUpdate(): void {
    const numColliders = this.rigidBody?.numColliders();
    if (!this.rigidBody || !numColliders || numColliders === 0) return;
    this.maxLengthFromCenter = this.getMaxLengthFromCenter();
    if (!this.dragCache) {
      this.dragCache = new DragRayCache(this.raysPerUnit, this.maxLengthFromCenter);
    }

    const velocity = new Vector3(this.rigidBody.linvel());
    const speed = velocity.length();
    const fakeBreakingForce = toRange(speed, { min: 0, max: 3 }, { min: FAKE_DRAG_AT_LOW_SPEEDS, max: 0 });
    if (fakeBreakingForce > 0) {
      const fakeBreakingForceVector = velocity.clone().multiplyScalar(-fakeBreakingForce);
      this.rigidBody.applyImpulse(fakeBreakingForceVector, true);
    }

    const percentageSubmergedPerCollider = []; // TODO: calculate submerged volume using raycasting from the bottom of the object
    for (let i = 0; i < numColliders; i++) {
      const collider = this.rigidBody.collider(i);
      const z = collider.translation().z;
      const topZ = z + this.size / 2;
      const percentageSubmerged = clamp((WATER_LINE_Z - (topZ - this.size)) / this.size, 0, 1);
      percentageSubmergedPerCollider.push(percentageSubmerged);

      if (percentageSubmerged > 0) {
        // Buoyancy
        const volume = collider.volume();
        const buoyancyForce = volume * percentageSubmerged * BUOYANCY_FACTOR;
        const buoyantForce = new Vector3(0, 0, buoyancyForce);

        // Drag
        // TODO: Calculate drag based on cross section of the object moving through the water
        // TODO: Maybe casting a bunch of rays from the direction of the velocity and getting the average of the submerged amount

        const buoyantForceWithDelta = buoyantForce.clone().multiplyScalar(currentDeltaTime * 0.001);

        this.rigidBody.applyImpulseAtPoint(buoyantForceWithDelta, collider.translation(), true);

        // Angular damping
        const angularDampingForce = new Vector3(this.rigidBody.angvel()).multiplyScalar(-ANGULAR_DAMPING * volume * percentageSubmerged * currentDeltaTime);
        this.rigidBody.applyTorqueImpulse(angularDampingForce, true);

        // Fake drag
        const fakeDragForce = new Vector3(this.rigidBody.linvel()).multiplyScalar(-FAKE_DRAG_AT_LOW_SPEEDS * volume * percentageSubmerged * currentDeltaTime);
        this.rigidBody.applyImpulse(fakeDragForce, true);
      }
    }
    this.percentageSubmerged = percentageSubmergedPerCollider.reduce((a, b) => a + b, 0) / percentageSubmergedPerCollider.length;

    if (velocity.length() > 0.5) {
      if (this.isShip) {
        // TODO: Remove this in the future
        this.stats.start();
        this.simulateDragInDirectionUsingRaycasting();
        this.stats.end();
      } else {
        this.rigidBody.setLinearDamping(1);
      }
    }
  }
  stats = createTimeStats("Raycasting drag time", 1);

  getMaxLengthFromCenter() {
    if (!this.rigidBody) return 0;
    const rb = this.rigidBody;
    const numColliders = rb.numColliders();
    const colliders = new Array(numColliders).fill(0).map((_, i) => rb.collider(i)!);
    let maxLengthFromCenter = 0;
    for (const collider of colliders) {
      let halfSize = new Vector3(collider.halfExtents() ?? collider.halfHeight() ?? collider.radius());
      if (halfSize == null || halfSize.length() == 0) {
        log10000("Collider has no size - probably a ramp part");
        halfSize = new Vector3(0.5, 0.5, 0.5);
      }
      const distanceFromCenter = new Vector3(collider.translation()).distanceTo(new Vector3(rb.translation())) + halfSize.length();
      if (distanceFromCenter > maxLengthFromCenter) {
        maxLengthFromCenter = distanceFromCenter;
      }
    }
    return Math.round(maxLengthFromCenter + 1); // safety margin
  }

  DENSITY_OF_WATER = 1025; // kg/m^3 (sea water)
  DENSITY_OF_AIR_REAL = 1.225; // kg/m^3 (air)
  ARTIFICAL_AIR_DENSITY_MULTIPLIER = 10;
  DENSITY_OF_AIR = this.DENSITY_OF_AIR_REAL * this.ARTIFICAL_AIR_DENSITY_MULTIPLIER;
  CN = 0.004; // normal pressure coefficient (tune)
  raysPerUnit = 2;

  simulateDragInDirectionUsingRaycasting() {
    if (!this.rigidBody) return;
    const rb = this.rigidBody;
    const velocity = new Vector3(rb.linvel());
    const angularVelocity = new Vector3(rb.angvel());
    const numColliders = rb.numColliders();
    const colliders = new Array(numColliders).fill(0).map((_, i) => rb.collider(i)!);
    const rbTranslation = new Vector3(rb.translation());

    const impulsesAndPoints = this.simulateDragInDirectionUsingRaycastingWeird({
      rb,
      velocity,
      angularVelocity,
      colliders,
      rbTranslation,
      deltaTime: currentDeltaTime,
    });

    // Apply all impulses
    for (const { impulse, point } of impulsesAndPoints) {
      rb.applyImpulseAtPoint(impulse, point, true);
    }
  }

  simulateDragInDirectionUsingRaycastingWeird({
    rb,
    velocity,
    angularVelocity,
    colliders,
    rbTranslation,
    deltaTime = currentDeltaTime,
  }: {
    rb: RigidBody;
    velocity: Vector3;
    angularVelocity: Vector3;
    colliders: Collider[];
    rbTranslation: Vector3;
    deltaTime: number;
  }): { impulse: Vector3; point: Vector3Like }[] {
    const direction = velocity.clone().normalize();
    const rbQuat = new Quaternion(rb.rotation());

    // quantize and form key
    const key = quantizeDirKey(direction, rbQuat, 5); // Tune this in the future with some physics precision settings

    // try cache
    let cachedLocalHits = this.dragCache!.getCached(key);
    if (!cachedLocalHits) {
      // Build the cache entry by doing raycasts once
      const collidersHandles = colliders.map((c) => c.handle);
      cachedLocalHits = this.dragCache!.buildCacheForKey(key, rbTranslation, rbQuat, direction, world, collidersHandles, this.maxLengthFromCenter);
    }

    // Now compute impulses from cachedLocalHits
    const impulsesAndPoints = [];
    const areaSize = (1 / this.raysPerUnit) ** 2;
    for (const { localPoint, localNormal } of cachedLocalHits) {
      // transform local back to world:
      const hitPointWorld = localPoint.clone().applyQuaternion(rbQuat).add(rbTranslation);
      const normalWorld = localNormal.clone().applyQuaternion(rbQuat).normalize();

      // r world:
      const rWorld = localPoint.clone().applyQuaternion(rbQuat);

      // point velocity:
      const pointVel = velocity.clone().add(angularVelocity.clone().cross(rWorld));

      const nImp = pointVel.dot(normalWorld) < 0 ? normalWorld.clone() : normalWorld.clone().negate();
      const vRelNPos = Math.max(0, -pointVel.dot(nImp));
      const isHitPointInAir = hitPointWorld.z > WATER_LINE_Z;
      const density = isHitPointInAir ? this.DENSITY_OF_AIR : this.DENSITY_OF_WATER;
      const pressureMag = 0.5 * density * this.CN * areaSize * vRelNPos * vRelNPos;
      const force = nImp.clone().multiplyScalar(pressureMag);
      const impulse = force.clone().multiplyScalar(deltaTime * 0.001);
      impulsesAndPoints.push({ impulse, point: hitPointWorld });
    }
    return impulsesAndPoints;
  }
}

/**
 * This function is not used and might not work correctly
 * probably coz rigidBody.translation() is not the center of mass
 */
function sumForcesAndTorques(rigidBody: RigidBody, forces: { force: Vector3; position: Vector3 }[]): { impulse: Vector3; torqueImpulse: Vector3 } {
  const impulse = new Vector3(0, 0, 0);
  const torqueImpulse = new Vector3(0, 0, 0);

  const com = new Vector3(rigidBody.translation()); // center of mass in world coords

  for (const f of forces) {
    // Add to net force (impulse)
    impulse.add(f.force);

    // r = point of application relative to COM
    const r = f.position.clone().sub(com);

    // torque = r × F
    const torque = new Vector3(r.y * f.force.z - r.z * f.force.y, r.z * f.force.x - r.x * f.force.z, r.x * f.force.y - r.y * f.force.x);
    torqueImpulse.add(torque);
  }

  return { impulse, torqueImpulse };
}
