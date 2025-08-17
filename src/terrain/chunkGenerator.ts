import { PerspectiveCamera, Vector2 } from "three";
import { BetterObject3D } from "../objects/BetterObject3D";
import { debugCoordsLog, heights, Terrain } from "./terrain";
import { createNoise2D } from "../utils/simplexNoise";
import { average, isVector2, Vector3 } from "../helpers";
import { gui } from "../Globals";

type ChunkGeneratorProps = {
  camera: PerspectiveCamera;
};

type Chunk = {
  position: Vector2;
  terrain: Terrain;
  lod: number;
};

export class ChunkGenerator extends BetterObject3D {
  camera: PerspectiveCamera;
  chunkSize = 64;
  viewDistance = 800;
  lodTillDistance = { 200: 1, 400: 2, 500: 4, 600: 8, 700: 16, fallback: 32 };
  replaceMoreDetailedChunksForLessDetailed = true;
  onlyOneGenPerUpdate = false;
  chunks: Chunk[] = [];
  noiseFunc = createNoise2D();
  constructor({ camera }: ChunkGeneratorProps) {
    super();
    this.camera = camera;
    const guiFolder = gui.addFolder("Chunk generator");
    guiFolder.close();
    guiFolder.add(this, "chunkSize").min(1).max(100).step(1).name("Chunk size");
    guiFolder.add(this, "viewDistance").min(10).max(2000).step(10).name("View distance");
    guiFolder.add(this, "replaceMoreDetailedChunksForLessDetailed").name("Replace more detailed chunks for less detailed");
    guiFolder.add(this, "onlyOneGenPerUpdate").name("Only one gen per update");
  }

  after30Updates(): void {
    this.generateChunks();
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
    const terrain = new Terrain({ position, lod, size: this.chunkSize, noiseFunc: this.noiseFunc });
    this.chunks.push({ position, terrain, lod });
    this.add(terrain);
    terrain.init();
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
    return new Vector2(Math.floor(position.x / this.chunkSize) * this.chunkSize, Math.floor(position.y / this.chunkSize) * this.chunkSize);
  }

  getNearestChunk(position: Vector2 | Vector3) {
    const chunkPosition = this.getNearestChunkVector(position);
    return this.getChunk(chunkPosition);
  }

  getLod(distance: number) {
    return Object.entries(this.lodTillDistance).find(([dist]) => parseInt(dist) >= distance)?.[1] ?? this.lodTillDistance.fallback;
  }

  getAllChunkVectorsInView() {
    const viewDistanceFullChunks = Math.floor(this.viewDistance / this.chunkSize) * this.chunkSize;
    const cameraPosition = this.camera.position;
    const nearestChunk = this.getNearestChunkVector(cameraPosition);
    const xMin = nearestChunk.x - viewDistanceFullChunks;
    const xMax = nearestChunk.x + viewDistanceFullChunks;
    const yMin = nearestChunk.y - viewDistanceFullChunks;
    const yMax = nearestChunk.y + viewDistanceFullChunks;
    const chunkVectors: { vector: Vector2; distance: number; lod: number }[] = [];
    for (let x = xMin; x <= xMax; x += this.chunkSize) {
      for (let y = yMin; y <= yMax; y += this.chunkSize) {
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
