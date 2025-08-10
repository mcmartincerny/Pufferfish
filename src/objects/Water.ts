import { BoxGeometry, Mesh, MeshPhongMaterial } from "three";
import { BetterObject3D } from "./BetterObject3D";
import { gui } from "../Globals";

export const WATER_LINE_Z = 0;

export class Water extends BetterObject3D {
  waterLevels = 10;
  waterDepth = 10;
  waterSize = 10000;
  minOpacity = 0.3;
  maxOpacity = 0.5;

  allWaterMaterials: MeshPhongMaterial[] = [];
  constructor() {
    super();
    this.createWaterObjects();
    gui.add({ fake: true }, "fake").name("Water transparency").onChange(this.setTransparencyOnAllWaterMaterials);
  }

  createWaterObjects() {
    const waterGeometry = new BoxGeometry(this.waterSize, this.waterSize, this.waterDepth / this.waterLevels);
    const waterLayers: Mesh[] = [];
    for (let i = 0; i < this.waterLevels; i++) {
      const waterMaterial = new MeshPhongMaterial({
        color: 0x3366aa,
        transparent: true,
        opacity: this.minOpacity + (this.maxOpacity - this.minOpacity) * (i / this.waterLevels),
      });

      const layer = new Mesh(waterGeometry, waterMaterial);
      layer.renderOrder = -999;
      layer.position.z = -(WATER_LINE_Z + (i * this.waterDepth) / this.waterLevels) - this.waterDepth / this.waterLevels / 2;
      console.log(layer.position.z);
      waterLayers.push(layer);
      this.allWaterMaterials.push(waterMaterial);
    }
    this.add(...waterLayers);
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
