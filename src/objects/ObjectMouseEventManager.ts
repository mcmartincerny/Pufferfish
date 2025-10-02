import { Object3D, PerspectiveCamera, Raycaster, Vector2 } from "three";

type HoverEventListener = (hovered: boolean, event?: MouseEvent) => void;
type MouseDownEventListener = (event?: MouseEvent) => void;
type ClickEventListener = (event?: MouseEvent) => void;

export class ObjectMouseEventManager {
  raycaster = new Raycaster();
  camera: PerspectiveCamera;
  canvas: HTMLCanvasElement;
  mousePosition = new Vector2();

  hoverableObjects: Object3D[] = [];
  mouseDownableObjects: Object3D[] = [];
  clickableObjects: Object3D[] = [];

  previouslyHoveredObject: Object3D | null = null;

  hoverEventListeners: Map<Object3D, HoverEventListener> = new Map();
  mouseDownEventListeners: Map<Object3D, MouseDownEventListener> = new Map();
  clickEventListeners: Map<Object3D, ClickEventListener> = new Map();

  constructor(camera: PerspectiveCamera, canvas: HTMLCanvasElement) {
    this.camera = camera;
    this.canvas = canvas;
    this.canvas.addEventListener("mousemove", this.onMouseMove);
    this.canvas.addEventListener("mousedown", this.onMouseDown);
    this.canvas.addEventListener("click", this.onClick);
  }

  addHoverEventListener(object: Object3D, listener: HoverEventListener) {
    this.hoverEventListeners.set(object, listener);
    this.hoverableObjects.push(object);
  }

  addMouseDownEventListener(object: Object3D, listener: MouseDownEventListener) {
    this.mouseDownEventListeners.set(object, listener);
    this.mouseDownableObjects.push(object);
  }

  addClickEventListener(object: Object3D, listener: ClickEventListener) {
    this.clickEventListeners.set(object, listener);
    this.clickableObjects.push(object);
  }

  removeHoverEventListener(object: Object3D) {
    this.hoverEventListeners.delete(object);
    this.hoverableObjects.splice(this.hoverableObjects.indexOf(object), 1);
    if (this.previouslyHoveredObject === object) {
      this.previouslyHoveredObject = null;
    }
  }

  removeMouseDownEventListener(object: Object3D) {
    this.mouseDownEventListeners.delete(object);
    this.mouseDownableObjects.splice(this.mouseDownableObjects.indexOf(object), 1);
  }

  removeClickEventListener(object: Object3D) {
    this.clickEventListeners.delete(object);
    this.clickableObjects.splice(this.clickableObjects.indexOf(object), 1);
  }

  onMouseMove = (event: MouseEvent) => {
    if (this.hoverableObjects.length === 0) return;
    // Convert mouse to normalized device coordinates (-1 to 1)
    this.mousePosition.x = (event.clientX / window.innerWidth) * 2 - 1;
    this.mousePosition.y = -(event.clientY / window.innerHeight) * 2 + 1;
    this.raycaster.setFromCamera(this.mousePosition, this.camera);
    const intersections = this.raycaster.intersectObjects(this.hoverableObjects, false);
    const hoveredObject = intersections[0]?.object;
    if (this.previouslyHoveredObject && hoveredObject !== this.previouslyHoveredObject) {
      const previousListener = this.hoverEventListeners.get(this.previouslyHoveredObject);
      previousListener?.(false, event);
    }
    if (hoveredObject) {
      const listener = this.hoverEventListeners.get(hoveredObject);
      listener?.(true, event);
    }
    this.previouslyHoveredObject = hoveredObject;
  };

  onMouseDown = (event: MouseEvent) => {
    this.mousePosition.x = (event.clientX / window.innerWidth) * 2 - 1;
    this.mousePosition.y = -(event.clientY / window.innerHeight) * 2 + 1;
    this.raycaster.setFromCamera(this.mousePosition, this.camera);
    const intersections = this.raycaster.intersectObjects(this.mouseDownableObjects, false);
    const mouseDownObject = intersections[0]?.object;
    if (mouseDownObject) {
      const listener = this.mouseDownEventListeners.get(mouseDownObject);
      listener?.(event);
    }
  };

  onClick = (event: MouseEvent) => {
    this.mousePosition.x = (event.clientX / window.innerWidth) * 2 - 1;
    this.mousePosition.y = -(event.clientY / window.innerHeight) * 2 + 1;
    this.raycaster.setFromCamera(this.mousePosition, this.camera);
    const intersections = this.raycaster.intersectObjects(this.clickableObjects, false);
    const clickedObject = intersections[0]?.object;
    if (clickedObject) {
      const listener = this.clickEventListeners.get(clickedObject);
      listener?.(event);
    }
  };

  dispose() {
    this.canvas.removeEventListener("mousemove", this.onMouseMove);
    this.canvas.removeEventListener("mousedown", this.onMouseDown);
    this.canvas.removeEventListener("click", this.onClick);
  }

  static instance: ObjectMouseEventManager;
  static init(camera: PerspectiveCamera, canvas: HTMLCanvasElement) {
    ObjectMouseEventManager.instance = new ObjectMouseEventManager(camera, canvas);
  }
  static getInstance() {
    if (!ObjectMouseEventManager.instance) {
      throw new Error("ObjectMouseEventManager is not initialized");
    }
    return ObjectMouseEventManager.instance;
  }
}
