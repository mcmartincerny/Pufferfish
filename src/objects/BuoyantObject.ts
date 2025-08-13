import { clamp, Vector3 } from "../helpers";
import { BetterObject3D } from "./BetterObject3D";
import { WATER_LINE_Z } from "./Water";

const BUOYANCY_FACTOR = 0.2;
const HORIZONTAL_DRAG_FACTOR = 0.01; // Reduced for ships to move fast horizontally
const VERTICAL_DRAG_FACTOR = 0.04; // Higher to reduce bouncing
const OBJECT_SIZE = 1;
const ANGULAR_DAMPING = 0.005;

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

  beforeStep(): void {
    const numColliders = this.rigidBody?.numColliders();
    if (!this.rigidBody || !numColliders || numColliders === 0) return;

    const percentageSubmergedPerCollider = [];
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
  }
}
