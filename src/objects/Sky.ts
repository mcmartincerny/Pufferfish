import { BackSide, Mesh, MeshBasicMaterial, PerspectiveCamera, SphereGeometry, TextureLoader } from "three";
import { BetterObject3D } from "./BetterObject3D";

export class CustomSky extends BetterObject3D {
  camera: PerspectiveCamera;
  constructor(camera: PerspectiveCamera) {
    super();
    this.loadAndSetTexture();
    this.camera = camera;
  }

  async loadAndSetTexture() {
    const texture = await new TextureLoader().loadAsync("sky8K.jpg");
    const geometry = new SphereGeometry(400, 100, 100);
    geometry.rotateX(Math.PI / 2);
    const material = new MeshBasicMaterial({ map: texture, side: BackSide });
    const sphere = new Mesh(geometry, material);
    this.add(sphere);
  }

  after30Updates(): void {
    this.position.copy(this.camera.position);
  }
}
