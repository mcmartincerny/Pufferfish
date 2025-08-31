import { World } from "@dimforge/rapier3d-compat";
import { BufferAttribute, BufferGeometry, LineBasicMaterial, LineSegments, Scene } from "three";

export class RapierDebugRenderer {
  mesh;
  world;
  enabled = false;
  visible = true;

  constructor(scene: Scene, world: World) {
    this.world = world;
    this.mesh = new LineSegments(new BufferGeometry(), new LineBasicMaterial({ color: 0xffffff, vertexColors: true }));
    this.mesh.frustumCulled = false;
    scene.add(this.mesh);
  }
  update() {
    if (this.enabled) {
      this.enabled = false;
      const { vertices, colors } = this.world.debugRender();
      this.mesh.geometry.setAttribute("position", new BufferAttribute(vertices, 3));
      this.mesh.geometry.setAttribute("color", new BufferAttribute(colors, 4));
      this.mesh.visible = this.visible;
      (window as any).snapshot = this.world.takeSnapshot();
    } else {
      this.mesh.visible = this.visible;
    }
  }
}
