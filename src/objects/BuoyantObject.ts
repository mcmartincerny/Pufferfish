import { QueryFilterFlags, Ray, RigidBody } from "@dimforge/rapier3d-compat";
import { clamp, debugRigidBody, log10000, log50, Vector3 } from "../helpers";
import { BetterObject3D } from "./BetterObject3D";
import { WATER_LINE_Z } from "./Water";
import { world } from "../Globals";

const BUOYANCY_FACTOR = 0.2;
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
        const velocity = new Vector3(this.rigidBody.linvel());

        const horizontalVelocity = new Vector3(velocity.x, velocity.y, 0);
        const verticalVelocity = new Vector3(0, 0, velocity.z);

        const horizontalDragForce = horizontalVelocity.multiplyScalar(-HORIZONTAL_DRAG_FACTOR * volume * percentageSubmerged);
        const verticalDragForce = verticalVelocity.multiplyScalar(-VERTICAL_DRAG_FACTOR * volume * percentageSubmerged);

        const totalDragForce = horizontalDragForce.add(verticalDragForce);

        const allForces = new Vector3(0, 0, 0).add(buoyantForce).add(totalDragForce);
        this.rigidBody.applyImpulseAtPoint(allForces, collider.translation(), true);

        // Angular damping
        const angularDampingForce = new Vector3(this.rigidBody.angvel()).multiplyScalar(-ANGULAR_DAMPING * volume * percentageSubmerged);
        this.rigidBody.applyTorqueImpulse(angularDampingForce, true);
      }
    }
    this.percentageSubmerged = percentageSubmergedPerCollider.reduce((a, b) => a + b, 0) / percentageSubmergedPerCollider.length;
    this.simulateDragInDirectionUsingRaycasting();
  }

  simulateDragInDirectionUsingRaycasting() {
    if (!this.rigidBody) return 0;
    const rg = this.rigidBody;
    const velocity = new Vector3(rg.linvel());
    const direction = velocity.normalize();
    const numColliders = rg.numColliders();
    const colliders = new Array(numColliders).fill(0).map((_, i) => rg.collider(i)!);
    const collidersHandles = colliders.map((c) => c.handle);
    let maxLengthFromCenter = 0;
    // calculate the furthest point from the center of the rigid body
    for (const collider of colliders) {
      let halfSize = new Vector3(collider.halfExtents() ?? collider.halfHeight() ?? collider.radius());
      if (halfSize == null || halfSize.length() == 0) {
        log10000("Collider has no size - probably a ramp part");
        halfSize = new Vector3(0.5, 0.5, 0.5);
      }
      const distanceFromCenter = new Vector3(collider.translation()).distanceTo(rg.translation()) + halfSize.length();
      if (distanceFromCenter > maxLengthFromCenter) {
        maxLengthFromCenter = distanceFromCenter;
      }
    }
    maxLengthFromCenter += 1; // safety margin
    const rayPosition = new Vector3(rg.translation()).add(new Vector3(direction).multiplyScalar(maxLengthFromCenter));
    const ray = new Ray(rayPosition, direction.clone().negate());
    const hit = world.castRayAndGetNormal(ray, maxLengthFromCenter, true, QueryFilterFlags.ONLY_DYNAMIC, undefined, undefined, undefined, (coll) =>
      collidersHandles.includes(coll.handle)
    );
    if (hit) {
      const hitPoint = ray.pointAt(hit.timeOfImpact);
      console.log("hitPoint", hitPoint);
      debugRigidBody(hitPoint, "hitPoint" + hit.collider.handle);

      // Continue here. Need to get the direction of the normal, visualize it and test if it works and then do it in a grid of 20 x 20 rays or more.
    }
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
