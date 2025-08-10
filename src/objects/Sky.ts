import { BackSide, Mesh, MeshBasicMaterial, RepeatWrapping, SphereGeometry, TextureLoader } from "three";
import { BetterObject3D } from "./BetterObject3D";

export class CustomSky extends BetterObject3D {
  constructor() {
    super();
    const texture = new TextureLoader().load("sky8K.jpg");
    const geometry = new SphereGeometry(100, 100, 100);
    geometry.rotateX(Math.PI / 2);
    const material = new MeshBasicMaterial({ map: texture, side: BackSide });
    const sphere = new Mesh(geometry, material);
    this.add(sphere);
  }
}
