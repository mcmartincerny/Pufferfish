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
    const geometry = new SphereGeometry(900, 100, 100); // first number is radius, should be little less then camera.far
    geometry.rotateX(Math.PI / 2);
    const material = new MeshBasicMaterial({ map: texture, side: BackSide });
    const sphere = new Mesh(geometry, material);
    this.add(sphere);
  }

  // TODO: maybe change to after30Updates
  afterUpdate(): void {
    this.position.copy(this.camera.position);
  }
}
