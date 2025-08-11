import { BackSide, Mesh, MeshBasicMaterial, SphereGeometry, TextureLoader } from "three";
import { BetterObject3D } from "./BetterObject3D";

export class CustomSky extends BetterObject3D {
  constructor() {
    super();
    this.loadAndSetTexture();
  }

  async loadAndSetTexture() {
    const texture = await new TextureLoader().loadAsync("sky8K.jpg");
    const geometry = new SphereGeometry(100, 100, 100);
    geometry.rotateX(Math.PI / 2);
    const material = new MeshBasicMaterial({ map: texture, side: BackSide });
    const sphere = new Mesh(geometry, material);
    this.add(sphere);
  }
}
