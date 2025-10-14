import RAPIER from "@dimforge/rapier3d-compat";
import GUI from "lil-gui";
import { Scene } from "three";
import { OutlinePass } from "three/addons/postprocessing/OutlinePass.js";
import { MapGenerationData } from "./ui/NewMap";
import { ShowToastFunction } from "./ui/ToastManager";

export let world: RAPIER.World;

export const setWorld = (newWorld: RAPIER.World) => {
  world = newWorld;
};

export let scene: Scene;

export const setScene = (newScene: Scene) => {
  scene = newScene;
};

export let gui: GUI;

export const setGui = (newGui: GUI) => {
  gui = newGui;
};

export let outlinePass: OutlinePass | null = null;

export const setOutlinePass = (newOutlinePass: OutlinePass) => {
  outlinePass = newOutlinePass;
};

export let currentDeltaTime = 0;

export const setCurrentDeltaTime = (newDeltaTime: number) => {
  currentDeltaTime = newDeltaTime;
};

export const MAP_GENERATION_DATA_DEFAULT: MapGenerationData = {
  seed: undefined,
  mapSize: 1048,
  spawnPoint: { x: 0, y: 0 },
};

export let showToast: ShowToastFunction;

export const setShowToastFunction = (newShowToast: ShowToastFunction) => {
  showToast = newShowToast;
};
