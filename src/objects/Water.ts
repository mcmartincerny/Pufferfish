import { BoxGeometry, DataTexture, Mesh, MeshPhongMaterial, RedFormat, RepeatWrapping, TextureLoader } from "three";
import { BetterObject3D } from "./BetterObject3D";
import { currentDeltaTime, gui } from "../Globals";
import { createNoise2D, createNoise4D, NoiseFunction4D } from "../utils/simplexNoise";

export const WATER_LINE_Z = 0;

export class Water extends BetterObject3D {
  waterLevels = 10;
  waterDepth = 10;
  waterSize = 10000;
  minOpacity = 0.3;
  maxOpacity = 0.5;
  textureResolution = 1000;
  waterMap: DataTexture | null = null;

  allWaterMaterials: MeshPhongMaterial[] = [];
  constructor() {
    super();
    this.createWaterObjects();
    gui.add({ fake: true }, "fake").name("Water transparency").onChange(this.setTransparencyOnAllWaterMaterials);
  }

  createWaterObjects() {
    const waterGeometry = new BoxGeometry(this.waterSize, this.waterSize, this.waterDepth / this.waterLevels);
    const waterLayers: Mesh[] = [];
    const textureData = generateWaterTexture(this.textureResolution, this.textureResolution);
    const waterMap = new DataTexture(new Uint8Array(textureData), this.textureResolution, this.textureResolution);
    this.waterMap = waterMap;
    waterMap.wrapS = RepeatWrapping;
    waterMap.wrapT = RepeatWrapping;
    waterMap.repeat.set(this.waterSize / 50, this.waterSize / 50);
    waterMap.needsUpdate = true;
    for (let i = 0; i < this.waterLevels; i++) {
      const waterMaterial = new MeshPhongMaterial({
        color: 0x3366aa,
        transparent: true,
        opacity: this.minOpacity + (this.maxOpacity - this.minOpacity) * (i / this.waterLevels),
        map: i === 0 ? waterMap : undefined,
      });

      const layer = new Mesh(waterGeometry, waterMaterial);
      layer.renderOrder = -999;
      layer.position.z = -(WATER_LINE_Z + (i * this.waterDepth) / this.waterLevels) - this.waterDepth / this.waterLevels / 2;
      waterLayers.push(layer);
      this.allWaterMaterials.push(waterMaterial);
    }
    this.add(...waterLayers);
  }

  afterUpdate(): void {
    if (this.waterMap) {
      const now = performance.now();
      this.waterMap.offset.x = Math.sin(now / 1000) * 0.01;
      this.waterMap.offset.y = Math.cos(now / 1000) * 0.01;
    }
  }

  setTransparencyOnAllWaterMaterials = (transparency: boolean) => {
    this.allWaterMaterials.forEach((material) => {
      material.transparent = transparency;
    });
  };

  dispose(removeFromParent?: boolean): void {
    super.dispose(removeFromParent);
    this.allWaterMaterials = [];
  }
}

let generatedWaterTexture: number[] | null = null;
const generateWaterTexture = (sizeX: number, sizeY: number, zoom = 0.3) => {
  if (generatedWaterTexture) {
    return generatedWaterTexture;
  }
  console.time("generateWaterTexture");
  const normalWaterColors = [51, 102, 170, 255];
  const semiWhiteWaterColors = [204, 204, 204, 255];
  const whiteWaterColors = [255, 255, 255, 255];
  const data = [];
  const simplex = createNoise4D();
  for (let y = 0; y < sizeY; y++) {
    for (let x = 0; x < sizeX; x++) {
      const big = tileableSimplex(simplex, x, y, sizeX, sizeY, 4 * zoom);
      const medium = tileableSimplex(simplex, x, y, sizeX, sizeY, 16 * zoom);
      const small = tileableSimplex(simplex, x, y, sizeX, sizeY, 64 * zoom);
      const value = big * 0.7 + medium * medium * 0.6 + small * small * 0.5;

      if (value > 0.6) {
        data.push(...whiteWaterColors);
      } else if (value > 0.4) {
        data.push(...semiWhiteWaterColors);
      } else {
        data.push(...normalWaterColors);
      }
    }
  }
  generatedWaterTexture = data;
  console.timeEnd("generateWaterTexture");
  return data;
};

function tileableSimplex(noise4D: NoiseFunction4D, x: number, y: number, sizeX: number, sizeY: number, scale: number) {
  const nx = (x / sizeX) * 2 * Math.PI;
  const ny = (y / sizeY) * 2 * Math.PI;

  // Map into a 4D circle
  const s = Math.cos(nx);
  const t = Math.sin(nx);
  const u = Math.cos(ny);
  const v = Math.sin(ny);

  return noise4D(s * scale, t * scale, u * scale, v * scale);
}

// let generatedBumpMap: number[] | null = null;
// const generateBumpMap = (sizeX: number, sizeY: number) => {
//   if (generatedBumpMap) {
//     return generatedBumpMap;
//   }
//   const data = [];
//   const simplex = createNoise2D();
//   for (let y = 0; y < sizeY; y++) {
//     for (let x = 0; x < sizeX; x++) {
//       const nx = x / sizeX - 0.5;
//       const ny = y / sizeY - 0.5;
//       const value = simplex(nx * 4, ny * 4);
//       data.push(value * 255);
//     }
//   }
//   generatedBumpMap = data;
//   return data;
// };
