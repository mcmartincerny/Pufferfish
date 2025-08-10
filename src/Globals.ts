import RAPIER from "@dimforge/rapier3d-compat";
import GUI from "lil-gui";
import { Scene } from "three";
import { OutlinePass } from "three/addons/postprocessing/OutlinePass.js";

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
