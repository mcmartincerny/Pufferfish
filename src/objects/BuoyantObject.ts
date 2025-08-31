import { Collider, QueryFilterFlags, Ray, RigidBody } from "@dimforge/rapier3d-compat";
import { clamp, createTimeStats, debugRigidBody, degToRad, log10000, log50, Vector3 } from "../helpers";
import { BetterObject3D } from "./BetterObject3D";
import { WATER_LINE_Z } from "./Water";
import { currentDeltaTime, world } from "../Globals";
import { Ship } from "./Ship";
import { Euler, Vector3Like } from "three";

const BUOYANCY_FACTOR = 33;
const HORIZONTAL_DRAG_FACTOR = 0.01; // Reduced for ships to move fast horizontally
const VERTICAL_DRAG_FACTOR = 0.04; // Higher to reduce bouncing
const OBJECT_SIZE = 1;
const ANGULAR_DAMPING = 0.8; // TODO: Delete this when propper damping is implemented

/**
 * BuoyantObject is a class that represents an object that is buoyant.
 * This should be used for ships and other objects that are floating on the water.
 */
export class BuoyantObject extends BetterObject3D {
  size: number;
  percentageSubmerged = 0;
  constructor({ size = OBJECT_SIZE }: { size?: number } = {}) {
    super();
    this.size = size;
  }

  beforeUpdate(): void {
    const numColliders = this.rigidBody?.numColliders();
    if (!this.rigidBody || !numColliders || numColliders === 0) return;

    const velocity = new Vector3(this.rigidBody.linvel());

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
        const angularDampingForce = new Vector3(this.rigidBody.angvel()).multiplyScalar(-ANGULAR_DAMPING * volume * percentageSubmerged);
        this.rigidBody.applyTorqueImpulse(angularDampingForce, true);
      }
    }
    this.percentageSubmerged = percentageSubmergedPerCollider.reduce((a, b) => a + b, 0) / percentageSubmergedPerCollider.length;

    if (velocity.length() > 0.5) {
      if (this instanceof Ship) {
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

  DENSITY_OF_WATER = 1025; // kg/m^3 (sea water)
  DENSITY_OF_AIR_REAL = 1.225; // kg/m^3 (air)
  ARTIFICAL_AIR_DENSITY_MULTIPLIER = 10;
  DENSITY_OF_AIR = this.DENSITY_OF_AIR_REAL * this.ARTIFICAL_AIR_DENSITY_MULTIPLIER;
  CN = 0.004; // normal pressure coefficient (tune)
  raysPerUnit = 1;

  simulateDragInDirectionUsingRaycasting() {
    if (!this.rigidBody) return;
    const rb = this.rigidBody;
    const velocity = new Vector3(rb.linvel());
    const angularVelocity = new Vector3(rb.angvel());
    const numColliders = rb.numColliders();
    const colliders = new Array(numColliders).fill(0).map((_, i) => rb.collider(i)!);
    const rbTranslation = new Vector3(rb.translation());

    const impulsesAndPoints = this.simulateDragInDirectionUsingRaycastingPure({
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

  simulateDragInDirectionUsingRaycastingPure({
    velocity,
    angularVelocity,
    colliders,
    rbTranslation,
    deltaTime = currentDeltaTime,
  }: {
    velocity: Vector3;
    angularVelocity: Vector3;
    colliders: Collider[];
    rbTranslation: Vector3;
    deltaTime: number;
  }): { impulse: Vector3; point: Vector3Like }[] {
    const direction = velocity.clone().normalize();
    const collidersHandles = colliders.map((c) => c.handle);
    let maxLengthFromCenter = 0;

    // calculate the furthest point from the center of the rigid body
    for (const collider of colliders) {
      let halfSize = new Vector3(collider.halfExtents() ?? collider.halfHeight() ?? collider.radius());
      if (halfSize == null || halfSize.length() == 0) {
        log10000("Collider has no size - probably a ramp part");
        halfSize = new Vector3(0.5, 0.5, 0.5);
      }
      const distanceFromCenter = new Vector3(collider.translation()).distanceTo(rbTranslation) + halfSize.length();
      if (distanceFromCenter > maxLengthFromCenter) {
        maxLengthFromCenter = distanceFromCenter;
      }
    }
    maxLengthFromCenter = Math.round(maxLengthFromCenter + 1); // safety margin

    const worldUp = new Vector3(0, 0, 1);
    let right = new Vector3().crossVectors(worldUp, direction);
    if (right.lengthSq() < 1e-6) {
      // Forward is parallel to worldUp, pick arbitrary right
      right = new Vector3(1, 0, 0);
    }
    right.normalize();

    const up = new Vector3().crossVectors(direction, right).normalize();

    const spacing = 1 / this.raysPerUnit;
    const areaSize = spacing * spacing;
    const impulsesAndPoints: { impulse: Vector3; point: Vector3Like }[] = [];

    for (let xOffset = -maxLengthFromCenter; xOffset <= maxLengthFromCenter; xOffset += spacing) {
      for (let yOffset = -maxLengthFromCenter; yOffset <= maxLengthFromCenter; yOffset += spacing) {
        const posInFrontOfObject = new Vector3(rbTranslation).add(direction.clone().multiplyScalar(maxLengthFromCenter));
        const rayPosition = new Vector3(posInFrontOfObject).add(right.clone().multiplyScalar(xOffset)).add(up.clone().multiplyScalar(yOffset));

        debugRigidBody(rayPosition, `rayPosition - ${xOffset} - ${yOffset}`);
        const ray = new Ray(rayPosition, direction.clone().negate());
        const hit = world.castRayAndGetNormal(ray, maxLengthFromCenter * 2, true, QueryFilterFlags.ONLY_DYNAMIC, undefined, undefined, undefined, (coll) =>
          collidersHandles.includes(coll.handle)
        );
        if (hit) {
          const hitPoint = ray.pointAt(hit.timeOfImpact);
          debugRigidBody(hitPoint, `hitPoint - ${xOffset} - ${yOffset}`, undefined, 0.3);
          const normal = new Vector3(hit.normal);

          // Velocity of the body at the world point with angular contribution
          const hitPointOffsetFromCenter = new Vector3(hitPoint).sub(rbTranslation);
          // Add angular contribution: ω × r
          const pointVel = velocity.clone().add(angularVelocity.clone().cross(hitPointOffsetFromCenter));

          // Pick the normal that faces the incoming flow
          const nImp = pointVel.dot(normal) < 0 ? normal.clone() : normal.clone().negate();

          // Normal component of relative speed (positive when flowing into the surface)
          const vRelN = -pointVel.dot(nImp);
          const vRelNPos = Math.max(0, vRelN);

          const isHitPointInAir = hitPoint.z > WATER_LINE_Z;
          const density = isHitPointInAir ? this.DENSITY_OF_AIR : this.DENSITY_OF_WATER;
          // Simple quadratic "pressure" term along the normal
          const pressureMag = 0.5 * density * this.CN * areaSize * vRelNPos * vRelNPos;
          const force = nImp.clone().multiplyScalar(pressureMag);

          // Convert to impulse for this step
          const impulse = force.clone().multiplyScalar(deltaTime * 0.001);
          impulsesAndPoints.push({ impulse, point: hitPoint });
        }
      }
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
