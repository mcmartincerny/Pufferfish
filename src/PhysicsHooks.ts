import { PhysicsHooks as IPhysicsHooks, SolverFlags } from "@dimforge/rapier3d-compat";

// With ships using a single rigid body, special same-ship contact filtering is no longer needed.
export const PhysicsHooks: IPhysicsHooks = {
  filterIntersectionPair: () => true,
  filterContactPair: () => SolverFlags.COMPUTE_IMPULSE,
};
