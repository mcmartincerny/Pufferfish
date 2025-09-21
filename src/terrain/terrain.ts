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
    this.heightMap = generateHeightMap(
      noiseFunc,
      CHUNK_SIZE,
      CHUNK_SIZE,
      segments,
      -position.y - CHUNK_SIZE / 2,
      position.x - CHUNK_SIZE / 2,
      mapGenerationData.mapSize,
      false
    );
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

type ColorStop = {
  height: number;
  color: [number, number, number, number]; // RGBA
};

export const lerpColors = (height: number, colorStops: ColorStop[]): [number, number, number, number] => {
  // Sort colorStops by height just in case they're not sorted
  const sortedStops = [...colorStops].sort((a, b) => a.height - b.height);

  // Handle edge cases
  if (height <= sortedStops[0].height) {
    return sortedStops[0].color;
  }
  if (height >= sortedStops[sortedStops.length - 1].height) {
    return sortedStops[sortedStops.length - 1].color;
  }

  // Find the two stops we need to interpolate between
  for (let i = 0; i < sortedStops.length - 1; i++) {
    const current = sortedStops[i];
    const next = sortedStops[i + 1];

    if (height >= current.height && height <= next.height) {
      // Calculate the interpolation factor (0 to 1)
      const t = (height - current.height) / (next.height - current.height);

      // Interpolate each color component
      const r = Math.round(current.color[0] + (next.color[0] - current.color[0]) * t);
      const g = Math.round(current.color[1] + (next.color[1] - current.color[1]) * t);
      const b = Math.round(current.color[2] + (next.color[2] - current.color[2]) * t);
      const a = Math.round(current.color[3] + (next.color[3] - current.color[3]) * t);

      return [r, g, b, a];
    }
  }

  // This shouldn't happen if the logic above is correct
  return [0, 0, 0, 255];
};

export const hightMapToRGBA = (heightMap: number[], forMapPreview: boolean = false) => {
  // Define color stops for smooth interpolation
  const colorStops: ColorStop[] = [
    { height: 0.0, color: [0, 0, 255, 255] }, // blue (water)
    { height: 0.55, color: [180, 180, 0, 255] }, // yellow (beach)
    { height: 0.6, color: [0, 150, 0, 255] }, // light green (grass)
    { height: 0.7, color: [50, 60, 80, 255] }, // gray (rocks)
    { height: 0.8, color: [255, 255, 255, 255] }, // white (snow)
  ];

  const colorStopsForMapPreview: ColorStop[] = [
    { height: 0.45, color: [0, 0, 255, 255] }, // blue (water)
    { height: 0.55, color: [180, 180, 0, 255] }, // yellow (beach)
    { height: 0.6, color: [0, 150, 0, 255] }, // light green (grass)
    { height: 0.7, color: [50, 60, 80, 255] }, // gray (rocks)
    { height: 0.8, color: [255, 255, 255, 255] }, // white (snow)
  ];

  // debug should contain key that is rounded to 0.1 digit and value is count of that height
  const rgba = new Uint8ClampedArray(heightMap.length * 4);
  for (let i = 0; i < heightMap.length; i++) {
    const height = heightMap[i];
    // const roundedHeight = Math.round(height * 10) / 10;
    // debug.set(roundedHeight, (debug.get(roundedHeight) ?? 0) + 1);

    const [r, g, b, a] = lerpColors(height, forMapPreview ? colorStopsForMapPreview : colorStops);
    rgba[i * 4] = r;
    rgba[i * 4 + 1] = g;
    rgba[i * 4 + 2] = b;
    rgba[i * 4 + 3] = a;
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
  wholeMapSize: number,
  rightToLeft: boolean
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

      const half = wholeMapSize / 2;

      // distance from center (0,0)
      const distX = Math.abs(worldX);
      const distY = Math.abs(worldY);
      const dist = Math.sqrt(distX * distX + distY * distY);

      // normalized 0 → 1 (center → edge)
      const norm = clamp(dist / half, 0, 1);

      // start falloff only after 80% of the radius
      const edgeStart = 0.8;
      if (norm > edgeStart) {
        const t = (norm - edgeStart) / (1 - edgeStart); // remap to 0→1
        height *= 1 - t * t * t; // quadratic fade
      }

      // Height snapping to a few steps
      // const stepsToSnap = [0.55];
      // const differenceToSnap = 0.02;
      // const differenceToLerp = 0.05;

      // for (const step of stepsToSnap) {
      //   const dist = Math.abs(height - step);

      //   if (dist < differenceToSnap) {
      //     height = step;
      //   } else if (dist < differenceToLerp) {
      //     const t = 1 - dist / differenceToLerp; // 1 near, 0 far
      //     const smoothT = t * t * (3 - 2 * t); // smoothstep easing
      //     height = height + (step - height) * smoothT;
      //   }
      // }

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
