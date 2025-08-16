import { JointData, RigidBody } from "@dimforge/rapier3d-compat";
import { Quaternion, Vector3 } from "./helpers";
import { world } from "./Globals";

export function createFixedJoint(rb1: RigidBody, rb2: RigidBody) {
  const pos1 = new Vector3(rb1.translation());
  const pos2 = new Vector3(rb2.translation());

  const rot1 = new Quaternion(rb1.rotation());
  const rot2 = new Quaternion(rb2.rotation());

  // Choose a world joint pose that matches what you have *right now*.
  // Use midpoint for the anchor, and use rb1’s current orientation for the joint frame.
  const midPoint = pos1.clone().add(pos2).multiplyScalar(0.5); // world anchor

  // --- convert world anchor -> local anchors ---
  const a1 = midPoint.clone().sub(pos1).applyQuaternion(rot1.clone().invert()); // local to rb1
  const a2 = midPoint.clone().sub(pos2).applyQuaternion(rot2.clone().invert()); // local to rb2

  // --- local joint frames (orientations) ---
  // We need Q1, Q2 such that: R1 * Q1 == R2 * Q2 == Rw
  // Pick Q1 = identity (since Rw == R1), Q2 = inv(R2) * Rw = inv(R2) * R1
  const Q1 = new Quaternion(0, 0, 0, 1); // identity
  const Q2 = rot2.clone().invert().multiply(rot1); // = inv(R2) * R1  (ORDER MATTERS)

  world.createImpulseJoint(JointData.fixed(a1, Q1, a2, Q2), rb1, rb2, true);
}

export function createPrismaticJoint(rb1: RigidBody, rb2: RigidBody, axis: Vector3, limits: [number, number]) {
  const p1 = new Vector3(rb1.translation().x, rb1.translation().y, rb1.translation().z);
  const p2 = new Vector3(rb2.translation().x, rb2.translation().y, rb2.translation().z);
  const posDiff = p2.clone().sub(p1);
  const posDiffHalf = posDiff.clone().multiplyScalar(0.5);
  const posDiffHalfInv = posDiffHalf.clone().multiplyScalar(-1);

  const jointData = JointData.prismatic(posDiffHalf, posDiffHalfInv, axis);
  jointData.limitsEnabled = true;
  jointData.limits = limits;
  world.createImpulseJoint(jointData, rb1, rb2, true);
}
