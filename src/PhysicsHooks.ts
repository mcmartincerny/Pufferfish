import { PhysicsHooks as IPhysicsHooks, SolverFlags } from "@dimforge/rapier3d-compat";

export const shipHandleIds: Set<number>[] = [];

export const PhysicsHooks: IPhysicsHooks = {
  filterIntersectionPair: (collider1, collider2, body1, body2) => {
    return true;
  },
  filterContactPair: (collider1, collider2, body1, body2) => {
    for (const shipPartIds of shipHandleIds) {
      if (shipPartIds.has(body1) && shipPartIds.has(body2)) {
        return SolverFlags.EMPTY;
      }
    }
    return SolverFlags.COMPUTE_IMPULSE;
  },
};
