import {
  Curve,
  Euler,
  ExtrudeGeometry,
  Mesh,
  MeshPhongMaterial,
  MeshStandardMaterial,
  Quaternion,
  Shape,
  TubeGeometry,
  Vector2,
  Vector3,
  Vector3Like,
  Vector3Tuple,
} from "three";
import { world } from "../Globals";
import RAPIER, { RigidBody } from "@dimforge/rapier3d-compat";

interface PrismProps {
  length: number;
  width: number;
  height?: number;
  angle?: number;
}

export class PrismGeometry extends ExtrudeGeometry {
  constructor({ length, width, height, angle }: PrismProps) {
    if (angle) {
      // calculate the height of the prism
      height = Math.sin(angle * (Math.PI / 180)) * length;
    }

    const a = new Vector2(0, height);
    const b = new Vector2(0, 0);
    const c = new Vector2(length, 0);
    super(new Shape([a, b, c]), { depth: width, bevelEnabled: false });
    this.rotateX(Math.PI / 2);
  }
}

export const createPrismWithColider = (
  prismProps: PrismProps,
  position: Vector3Tuple = [0, 0, 0],
  rotation?: Quaternion,
  positionOnlyRigidBody?: Vector3Like
) => {
  const prismGeometry = new PrismGeometry(prismProps);
  const halfLength = prismProps.length / 2;
  const halfWidth = prismProps.width / 2;
  const halfHeight = (prismProps.height ?? Math.sin(prismProps.angle! * (Math.PI / 180)) * prismProps.length) / 2;
  prismGeometry.translate(-halfLength, halfWidth, -halfHeight);
  if (rotation) {
    prismGeometry.applyQuaternion(rotation);
  }
  const prismMaterial = new MeshPhongMaterial({ color: 0x44aa88 });
  const prism = new Mesh(prismGeometry, prismMaterial);
  // position should be in the center of the prism

  prism.position.set(...position);
  let rigidBody: RigidBody;
  if (positionOnlyRigidBody) {
    rigidBody = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(positionOnlyRigidBody.x, positionOnlyRigidBody.y, positionOnlyRigidBody.z));
  } else {
    rigidBody = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(...position));
  }
  const collider = world.createCollider(createConvexMeshColliderForMesh(prism), rigidBody);
  return {
    prism,
    rigidBody,
    collider,
  };
};

interface StairsProps {
  length: number;
  width: number;
  height: number;
  steps: number;
  solidBottom?: boolean;
}

export class StairsGeometry extends ExtrudeGeometry {
  constructor({ length, width, height, steps, solidBottom }: StairsProps) {
    const lengthIncrement = length / steps;
    const heightIncrement = height / steps;
    const positions: Vector2[] = [];
    positions.push(new Vector2(0, 0));
    for (let i = 0; i < steps; i++) {
      positions.push(new Vector2(i * lengthIncrement, (i + 1) * heightIncrement));
      positions.push(new Vector2((i + 1) * lengthIncrement, (i + 1) * heightIncrement));
    }
    if (solidBottom) {
      positions.push(new Vector2(length, 0));
    } else {
      positions.push(new Vector2(length, height * 0.8));
      positions.push(new Vector2(length * 0.2, 0));
    }
    super(new Shape(positions), { depth: width, bevelEnabled: false });
    this.rotateX(Math.PI / 2);
  }
}

export const createStairsWithColider = (stairsProps: StairsProps, position?: Vector3Tuple) => {
  const stairsGeometry = new StairsGeometry(stairsProps);
  const stairsMaterial = new MeshStandardMaterial({ color: 0x998888 });
  const stairs = new Mesh(stairsGeometry, stairsMaterial);
  stairs.position.set(...(position || [0, 0, 0]));
  const rigidBody = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(...(position || [0, 0, 0])));
  const collider = world.createCollider(createTrimeshColiderForMesh(stairs), rigidBody);
  return {
    stairs,
    rigidBody,
    collider,
  };
};

export const createConvexMeshColliderForMesh = (mesh: Mesh, shortenVertices = 4): RAPIER.ColliderDesc => {
  const geometry = mesh.geometry;
  let vertices = geometry.getAttribute("position").array as Float32Array;
  // for some reason the vertices are repeated a few times, we need to shorten them
  vertices = vertices.slice(0, vertices.length / shortenVertices);
  const indices = geometry.getIndex()?.array as Uint32Array;
  return RAPIER.ColliderDesc.convexMesh(vertices, indices)!;
};

export const createTrimeshColiderForMesh = (mesh: Mesh): RAPIER.ColliderDesc => {
  const geometry = mesh.geometry;
  if (!geometry.getIndex()) {
    geometry.setIndex([...Array(geometry.attributes.position.count).keys()]);
  }
  const vertices = geometry.getAttribute("position").array as Float32Array;
  const indices = geometry.getIndex()?.array as Uint32Array;
  return RAPIER.ColliderDesc.trimesh(vertices, indices)!;
};

interface PipeGeometryProps {
  radius: number;
  length: number;
  segments: number;
  closed: boolean;
}

export class PipeGeometry extends TubeGeometry {
  constructor({ radius, length, segments, closed }: PipeGeometryProps) {
    // const path = new Array(segments).fill(0).map((_, i) => [i * length, 0, 0]);
    const path = new PipeCurve(length);
    super(path, 50, radius, segments, closed);
  }
}

class PipeCurve extends Curve<Vector3> {
  constructor(public scale: number) {
    super();
  }
  getPoint(t: number, optionalTarget?: Vector3 | undefined): Vector3 {
    const tx = t * this.scale;
    const ty = 0;
    const tz = 0;
    if (optionalTarget) {
      return optionalTarget.set(tx, ty, tz);
    }
    return new Vector3(tx, ty, tz);
  }
}
