import { DataTexture, DoubleSide, Mesh, MeshStandardMaterial, RedFormat, RGBAFormat, Vector2 } from "three";
import { ColliderDesc, HeightFieldFlags, RigidBodyDesc } from "@dimforge/rapier3d-compat";
import { world } from "../Globals";
import { BetterObject3D } from "../objects/BetterObject3D";
import { createNoise2D, NoiseFunction2D } from "../utils/simplexNoise";
import { clamp, Quaternion, toRange, Vector3 } from "../helpers";
import { Euler, MeshPhongMaterial, PlaneGeometry } from "three";
import { degToRad } from "three/src/math/MathUtils.js";
import { CHUNK_SIZE } from "./chunkGenerator";
import { MapGenerationData } from "../ui/NewMap";

export const heights: number[] = [];

export const NOISE_SCALE = 200;

type TerrainOptions = {
  position: Vector2;
  lod: number;
  noiseFunc: NoiseFunction2D;
  mapGenerationData: MapGenerationData;
};

// TODO: Replace displacement map with a real geometry - displacement does not look as good (lighting, colors)
export class Terrain extends BetterObject3D {
  minHeight = -20;
  maxHeight = 20;
  segmentsAt1Lod = 100; // segments * segments = total points - segments per chunk of size 64 - bigger chunks = more points
  heightMap: number[];
  constructor({ position, lod, noiseFunc, mapGenerationData }: TerrainOptions) {
    super();
    const segments = clamp(Math.round(((this.segmentsAt1Lod / lod) * CHUNK_SIZE) / 64), 2, 2000);
    this.heightMap = generateHeightMap(noiseFunc, CHUNK_SIZE, CHUNK_SIZE, segments, -position.y, position.x, mapGenerationData.mapSize);
    this.rigidBody = world.createRigidBody(RigidBodyDesc.fixed().setTranslation(position.x, position.y, this.minHeight));
    const colliderDesc = ColliderDesc.heightfield(
      segments - 1,
      segments - 1,
      new Float32Array(this.heightMap),
      new Vector3(CHUNK_SIZE, this.maxHeight + Math.abs(this.minHeight), CHUNK_SIZE)
      // HeightFieldFlags.FIX_INTERNAL_EDGES
    ).setRotation(yToZUpQuat);
    const collider = world.createCollider(colliderDesc, this.rigidBody);
    collider.setFriction(0);
    collider.setRestitution(0);
    const displacementMap = new DataTexture(new Uint8Array(this.heightMap.map((h) => h * 255)), segments, segments, RedFormat);
    displacementMap.needsUpdate = true;
    const textureMap = new DataTexture(hightMapToRGBA(this.heightMap), segments, segments, RGBAFormat);
    textureMap.needsUpdate = true;
    const planeGeometry = new PlaneGeometry(CHUNK_SIZE, CHUNK_SIZE, segments - 1, segments - 1);
    const planeMaterial = new MeshPhongMaterial({
      map: textureMap,
      displacementMap: displacementMap,
      displacementScale: this.maxHeight + Math.abs(this.minHeight),
      side: DoubleSide,
      // wireframe: true,
    });
    const plane = new Mesh(planeGeometry, planeMaterial);
    plane.rotateZ(degToRad(-90));
    this.mainMesh = plane;
    this.add(plane);
  }
}

// const debug = new Map<number, number>();
export const hightMapToRGBA = (heightMap: number[]) => {
  // debug should contain key that is rounded to 0.1 digit and value is count of that height
  const rgba = new Uint8ClampedArray(heightMap.length * 4);
  for (let i = 0; i < heightMap.length; i++) {
    const height = heightMap[i];
    // const roundedHeight = Math.round(height * 10) / 10;
    // debug.set(roundedHeight, (debug.get(roundedHeight) ?? 0) + 1);
    if (height > 0.8) {
      // white
      rgba[i * 4] = 255;
      rgba[i * 4 + 1] = 255;
      rgba[i * 4 + 2] = 255;
      rgba[i * 4 + 3] = 255;
    } else if (height > 0.7) {
      // gray
      rgba[i * 4] = 50;
      rgba[i * 4 + 1] = 60;
      rgba[i * 4 + 2] = 80;
      rgba[i * 4 + 3] = 255;
    } else if (height > 0.55) {
      // light green
      rgba[i * 4] = 0;
      rgba[i * 4 + 1] = 150;
      rgba[i * 4 + 2] = 0;
      rgba[i * 4 + 3] = 255;
    } else if (height > 0.4) {
      // yellow
      rgba[i * 4] = 180;
      rgba[i * 4 + 1] = 180;
      rgba[i * 4 + 2] = 0;
      rgba[i * 4 + 3] = 255;
    } else {
      // blue
      rgba[i * 4] = 0;
      rgba[i * 4 + 1] = 0;
      rgba[i * 4 + 2] = 255;
      rgba[i * 4 + 3] = 255;
    }
  }
  return rgba;
};

export const generateHeightMap = (
  noiseFunc: NoiseFunction2D,
  width: number,
  depth: number,
  segments: number,
  xOffset: number,
  yOffset: number,
  wholeMapSize?: number,
  rightToLeft?: boolean
) => {
  generationCount++;
  const heightMap = new Array(segments * segments).fill(0);
  for (let x = 0; x < segments; x++) {
    for (let y = 0; y < segments; y++) {
      const worldX = (x / (segments - 1)) * width + xOffset;
      const worldY = (y / (segments - 1)) * depth + yOffset;

      const nx = worldX / NOISE_SCALE;
      const ny = worldY / NOISE_SCALE;

      let height = 0.8 * noiseFunc(nx, ny) + 0.2 * noiseFunc(nx * 4, ny * 4) + 0.05 * noiseFunc(nx * 16, ny * 16);
      // special noise function addon for continents
      const addon = noiseFunc(nx / 4, ny / 4);
      height += addon * 0.3;
      height = (clamp(height, -1, 1) + 1) / 2;
      height = height * height; // make it more exponential but smaller in average

      if (wholeMapSize) {
        const half = wholeMapSize / 2;

        // distance from center (0,0)
        const distX = Math.abs(worldX);
        const distY = Math.abs(worldY);
        const dist = Math.sqrt(distX * distX + distY * distY);

        // normalized 0 → 1 (center → edge)
        const norm = clamp(dist / half, 0, 1);

        // start falloff only after 90% of the radius
        const edgeStart = 0.8;
        if (norm > edgeStart) {
          const t = (norm - edgeStart) / (1 - edgeStart); // remap to 0→1
          height *= 1 - t * t * t; // quadratic fade
        }
      }

      const adjustedY = rightToLeft ? segments - 1 - y : y;
      heightMap[x + adjustedY * segments] = height;

      if (COORD_DEBUG && coordsGenerated.has(`${nx}, ${ny}`)) {
        coordsGenerated.get(`${nx}, ${ny}`)!.count++;
        coordsGenerated.get(`${nx}, ${ny}`)!.generations.push(generationCount);
        coordsGenerated.get(`${nx}, ${ny}`)!.heights.push(height);
      } else if (COORD_DEBUG) {
        coordsGenerated.set(`${nx}, ${ny}`, { count: 1, generations: [generationCount], heights: [height] });
      }
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

const COORD_DEBUG = false;
export const coordsGenerated = new Map<string, { count: number; generations: number[]; heights: number[] }>();
let generationCount = 0;

export const debugCoordsLog = () => {
  if (!COORD_DEBUG) return;
  console.log(
    [...coordsGenerated].map(
      ([key, value]) => `${key} - Count:${value.count} - Generations:${value.generations.join(", ")} - Heights:${value.heights.join(", ")}`
    )
  );
};
