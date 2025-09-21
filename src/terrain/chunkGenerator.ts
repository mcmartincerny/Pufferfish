import { PerspectiveCamera, Vector2 } from "three";
import { BetterObject3D } from "../objects/BetterObject3D";
import { debugCoordsLog, heights, Terrain } from "./terrain";
import { createNoise2D, NoiseFunction2D } from "../utils/simplexNoise";
import { average, isVector2, Vector3 } from "../helpers";
import { gui } from "../Globals";
import alea from "alea";
import { MapGenerationData } from "../ui/NewMap";

type ChunkGeneratorProps = {
  camera: PerspectiveCamera;
  mapGenerationData: MapGenerationData;
};

type Chunk = {
  position: Vector2;
  terrain: Terrain;
  lod: number;
};

/**
 * CPU time measurement at different chunk sizes
 * 64: 5.7ms
 * 128: 4.05ms
 * 256: 3.75ms - dip 50ms
 * 512: 3.55ms - dip 250ms // bigger dips
 */
export const CHUNK_SIZE = 256; // 64 is the sweet spot for FPS

export class ChunkGenerator extends BetterObject3D {
  camera: PerspectiveCamera;
  viewDistance = 800;
  lodTillDistance = { 300: 1, 400: 2, 500: 4, 600: 8, 700: 16, fallback: 32 };
  replaceMoreDetailedChunksForLessDetailed = true;
  onlyOneGenPerUpdate = true;
  chunks: Chunk[] = [];
  mapGenerationData: MapGenerationData;
  noiseFunc: NoiseFunction2D;
  constructor({ camera, mapGenerationData }: ChunkGeneratorProps) {
    super();
    this.camera = camera;
    this.mapGenerationData = mapGenerationData;
    if (this.mapGenerationData.seed) {
      this.noiseFunc = createNoise2D(alea(this.mapGenerationData.seed));
    } else {
      this.noiseFunc = createNoise2D(alea());
    }
  }

  after30Updates(): void {
    this.generateChunks(); // TODO: 1-6ms - maybe try putting it into service worker
  }

  generateChunks(): void {
    const chunkVectors = this.getAllChunkVectorsInView();
    for (const chunk of chunkVectors) {
      const createdChunk = this.getChunk(chunk.vector);
      if (!createdChunk) {
        this.createChunk(chunk.vector, chunk.lod);
        if (this.onlyOneGenPerUpdate) break;
      } else if (createdChunk.lod < chunk.lod || (this.replaceMoreDetailedChunksForLessDetailed && createdChunk.lod > chunk.lod)) {
        this.destroyChunk(createdChunk);
        this.createChunk(chunk.vector, chunk.lod);
        if (this.onlyOneGenPerUpdate) break;
      }
    }

    // Destroy chunks that are not in view
    for (const createdChunk of this.chunks) {
      if (!chunkVectors.some((chunkVector) => chunkVector.vector.equals(createdChunk.position))) {
        this.destroyChunk(createdChunk);
      }
    }
  }

  createChunk(position: Vector2, lod: number) {
    const terrain = new Terrain({ position, lod, noiseFunc: this.noiseFunc, mapGenerationData: this.mapGenerationData });
    this.chunks.push({ position, terrain, lod });
    this.add(terrain);
  }

  destroyChunk(chunkOrPosition: Chunk | Vector2) {
    const chunk = isVector2(chunkOrPosition) ? this.getChunk(chunkOrPosition) : chunkOrPosition;
    if (chunk) {
      this.chunks = this.chunks.filter((c) => c !== chunk);
      this.remove(chunk.terrain);
      chunk.terrain.dispose();
    }
  }

  getChunk(position: Vector2) {
    return this.chunks.find((chunk) => chunk.position.equals(position));
  }

  getNearestChunkVector(position: Vector2 | Vector3) {
    return new Vector2(
      Math.floor((position.x + CHUNK_SIZE / 2) / CHUNK_SIZE) * CHUNK_SIZE,
      Math.floor((position.y + CHUNK_SIZE / 2) / CHUNK_SIZE) * CHUNK_SIZE
    );
  }

  getNearestChunk(position: Vector2 | Vector3) {
    const chunkPosition = this.getNearestChunkVector(position);
    return this.getChunk(chunkPosition);
  }

  getLod(distance: number) {
    return Object.entries(this.lodTillDistance).find(([dist]) => parseInt(dist) >= distance)?.[1] ?? this.lodTillDistance.fallback;
  }

  getAllChunkVectorsInView() {
    const viewDistanceFullChunks = Math.floor(this.viewDistance / CHUNK_SIZE) * CHUNK_SIZE;
    const cameraPosition = this.camera.position;
    const nearestChunk = this.getNearestChunkVector(cameraPosition);
    const xMin = nearestChunk.x - viewDistanceFullChunks;
    const xMax = nearestChunk.x + viewDistanceFullChunks;
    const yMin = nearestChunk.y - viewDistanceFullChunks;
    const yMax = nearestChunk.y + viewDistanceFullChunks;
    const chunkVectors: { vector: Vector2; distance: number; lod: number }[] = [];
    for (let x = xMin; x <= xMax; x += CHUNK_SIZE) {
      for (let y = yMin; y <= yMax; y += CHUNK_SIZE) {
        const vector = new Vector2(x, y);
        const distance = vector.distanceTo(cameraPosition);
        const lod = this.getLod(distance);
        chunkVectors.push({ vector, distance, lod });
      }
    }
    chunkVectors.sort((a, b) => a.distance - b.distance);
    return chunkVectors;
  }
}
