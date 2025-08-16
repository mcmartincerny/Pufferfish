import { DataTexture, DoubleSide, Mesh, MeshStandardMaterial, RedFormat } from "three";
import { ColliderDesc, HeightFieldFlags, RigidBodyDesc } from "@dimforge/rapier3d-compat";
import { world } from "../Globals";
import { BetterObject3D } from "../objects/BetterObject3D";
import { createNoise2D } from "../utils/simplexNoise";
import { clamp, Quaternion, Vector3 } from "../helpers";
import { Euler, MeshPhongMaterial, PlaneGeometry } from "three";
import { degToRad } from "three/src/math/MathUtils.js";

// TODO: Replace displacement map with a real geometry - displacement does not look as good (lighting, colors)
export class Terrain extends BetterObject3D {
  minHeight = -20;
  maxHeight = 20;
  xySize = 400; // 1000 is a sweet spot for performance
  segments = 50; // segments * segments = total points -- 50 is a sweet spot for performance
  xyScale = 200; // 0.005 / 200 is a sweet spot for performance
  heightMap: number[];
  constructor() {
    super();
    this.heightMap = generateHeightMap(this.xySize, this.xySize, this.segments, this.xyScale);
    this.rigidBody = world.createRigidBody(RigidBodyDesc.fixed().setTranslation(0, 0, this.minHeight));
    const colliderDesc = ColliderDesc.heightfield(
      this.segments - 1,
      this.segments - 1,
      new Float32Array(this.heightMap),
      new Vector3(this.xySize, this.maxHeight + Math.abs(this.minHeight), this.xySize),
      HeightFieldFlags.FIX_INTERNAL_EDGES
    ).setRotation(yToZUpQuat);
    const collider = world.createCollider(colliderDesc, this.rigidBody);
    collider.setFriction(0.2);
    collider.setRestitution(0.4);
    const dataTexture = new DataTexture(new Uint8Array(this.heightMap.map((h) => h * 255)), this.segments, this.segments, RedFormat);
    dataTexture.needsUpdate = true;
    const planeGeometry = new PlaneGeometry(this.xySize, this.xySize, this.segments - 1, this.segments - 1);
    const planeMaterial = new MeshPhongMaterial({
      color: 0x149823,
      displacementMap: dataTexture,
      displacementScale: this.maxHeight + Math.abs(this.minHeight),
      side: DoubleSide,
    });
    const plane = new Mesh(planeGeometry, planeMaterial);
    plane.rotateZ(degToRad(-90));
    this.mainMesh = plane;
    this.add(plane);
  }
}

const generateHeightMap = (width: number, depth: number, segments: number, scale: number) => {
  const simplex = createNoise2D();
  const heightMap = new Array(segments * segments).fill(0);
  for (let x = 0; x < segments; x++) {
    for (let y = 0; y < segments; y++) {
      const nx = x / (segments / width) / scale;
      const ny = y / (segments / depth) / scale;
      const height = 0.8 * simplex(nx, ny) + 0.2 * simplex(nx * 4, ny * 4) + 0.05 * simplex(nx * 16, ny * 16);
      heightMap[x + y * segments] = (clamp(height, -1, 1) + 1) / 2;
    }
  }
  return heightMap;
};

const yToZUpQuat = {
  w: 0.7071067811865476,
  x: 0.7071067811865476,
  y: 0,
  z: 0,
};
