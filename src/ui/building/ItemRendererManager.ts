import { Scene, WebGLRenderer, Camera } from "three";

export class IconRendererManager {
  private static instance: IconRendererManager | null = null;
  private renderer: WebGLRenderer | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private scenes: Scene[] = [];
  private animationId: number | null = null;

  static getInstance(): IconRendererManager {
    if (!IconRendererManager.instance) {
      IconRendererManager.instance = new IconRendererManager();
    }
    return IconRendererManager.instance;
  }

  static disposeInstance() {
    if (IconRendererManager.instance) {
      IconRendererManager.instance.dispose();
    }
  }

  private initRenderer() {
    if (this.renderer) return;

    // Create single canvas that covers the entire page
    this.canvas = document.createElement("canvas");
    this.canvas.style.position = "fixed";
    this.canvas.style.top = "0";
    this.canvas.style.left = "0";
    this.canvas.style.width = "100vw";
    this.canvas.style.height = "100vh";
    this.canvas.style.pointerEvents = "none";
    this.canvas.style.zIndex = "10000";
    document.body.appendChild(this.canvas);

    // Create single renderer
    this.renderer = new WebGLRenderer({ canvas: this.canvas, antialias: true, alpha: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.setClearColor(0x000000, 0); // Transparent background
    this.renderer.setScissorTest(true);
  }

  addScene(scene: Scene) {
    this.initRenderer();
    this.scenes.push(scene);
    this.startAnimation();
  }

  removeScene(scene: Scene) {
    const index = this.scenes.indexOf(scene);
    if (index > -1) {
      this.scenes.splice(index, 1);
    }
    if (this.scenes.length === 0 && this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
      this.renderer!.clear();
    }
  }

  private startAnimation() {
    if (this.animationId) return;
    const animate = () => {
      if (!this.renderer) return;

      this.scenes.forEach((scene) => {
        const element = scene.userData.element as HTMLElement;
        if (!element) return;

        // Get element's position and size
        const rect = element.getBoundingClientRect();

        // Check if element is visible
        if (rect.bottom < 0 || rect.top > window.innerHeight || rect.right < 0 || rect.left > window.innerWidth) {
          return;
        }

        // Set viewport and scissor
        const width = rect.right - rect.left;
        const height = rect.bottom - rect.top;
        const left = rect.left;
        const bottom = window.innerHeight - rect.bottom;

        this.renderer!.setViewport(left, bottom, width, height);
        this.renderer!.setScissor(left, bottom, width, height);

        // Animate the scene
        scene.userData.animate?.();

        // Render scene
        const camera = scene.userData.camera as Camera;
        if (camera) {
          this.renderer!.render(scene, camera);
        }
      });

      this.animationId = requestAnimationFrame(animate);
    };

    animate();
  }

  dispose() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }
    if (this.renderer) {
      this.renderer.dispose();
    }
    if (this.canvas && this.canvas.parentNode) {
      this.canvas.parentNode.removeChild(this.canvas);
    }
    this.scenes = [];
    IconRendererManager.instance = null;
  }
}
