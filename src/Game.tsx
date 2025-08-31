import { useCallback, useEffect, useState } from "react";
import {
  ACESFilmicToneMapping,
  AgXToneMapping,
  AmbientLight,
  BoxGeometry,
  CineonToneMapping,
  ColorSpace,
  CustomToneMapping,
  DepthTexture,
  DirectionalLight,
  HemisphereLight,
  LinearToneMapping,
  Mesh,
  MeshPhongMaterial,
  MeshStandardMaterial,
  NeutralToneMapping,
  NoToneMapping,
  Object3D,
  PerspectiveCamera,
  PlaneGeometry,
  ReinhardToneMapping,
  Scene,
  ToneMapping,
  UnsignedShortType,
  Vector2,
  WebGLRenderer,
} from "three";
import Stats from "stats.js";
import GUI from "lil-gui";
import { BetterObject3D } from "./objects/BetterObject3D";
import { MAP_GENERATION_DATA_DEFAULT, setCurrentDeltaTime, setGui, setOutlinePass, setScene, setWorld } from "./Globals.ts";
import { createTimeStats, resetDebugRigidBodies, Vector3 } from "./helpers";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { OutlinePass } from "three/addons/postprocessing/OutlinePass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import RAPIER, { EventQueue } from "@dimforge/rapier3d-compat";
import { CameraSwitcher, CameraType } from "./cameras/CameraSwitcher.ts";
import { RapierDebugRenderer } from "./Debug.ts";
import { Water } from "./objects/Water.ts";
import { BuoyantObject } from "./objects/BuoyantObject.ts";
import { PhysicsHooks } from "./PhysicsHooks.ts";
import { CustomSky } from "./objects/Sky.ts";
import { ShipPlayer } from "./objects/ShipPlayer.ts";
import { ChunkGenerator } from "./terrain/chunkGenerator.ts";
import { MainMenu } from "./ui/MainMenu.tsx";
import { MapGenerationData } from "./ui/NewMap.tsx";
await RAPIER.init();

const stats = new Stats();

export const Game = () => {
  const [reset, setReset] = useState(false);
  const [mapGenerationData, setMapGenerationData] = useState<MapGenerationData>(MAP_GENERATION_DATA_DEFAULT);

  const reloadGame = useCallback(() => {
    setReset((r) => !r);
  }, []);

  const generateMap = useCallback((mapGenerationData: MapGenerationData) => {
    setMapGenerationData(mapGenerationData);
    setReset((r) => !r);
  }, []);

  useEffect(() => {
    return init(mapGenerationData);
  }, [reset]);

  useEffect(() => {
    stats.showPanel(0);
    (stats.dom.children[1] as HTMLElement).style.display = "block";
    document.body.appendChild(stats.dom);
    return () => {
      document.body.removeChild(stats.dom);
    };
  }, []);

  return (
    <>
      <canvas id="mainCanvas" />
      <MainMenu reloadGame={reloadGame} generateMap={generateMap} mapGenerationData={mapGenerationData} />
    </>
  );
};

const init = (mapGenerationData: MapGenerationData) => {
  console.log("init");
  const gui = new GUI();
  gui.$title.textContent = "Debug";
  // gui.close();
  setGui(gui);
  const canvas = document.querySelector("#mainCanvas") as HTMLCanvasElement;
  const scene = new Scene();
  setScene(scene);
  const world = new RAPIER.World({ x: 0.0, y: 0.0, z: -9.81 });
  setWorld(world);
  const cameraSwitcher = new CameraSwitcher(canvas);
  const camera = cameraSwitcher.camera;
  const renderer = new WebGLRenderer({ antialias: true, canvas, alpha: true }); // TODO: settings
  renderer.setPixelRatio(2); // TODO: settings
  const composer = new EffectComposer(renderer);
  composer.setPixelRatio(2); // TODO: settings
  const renderPass = new RenderPass(scene, camera);
  composer.addPass(renderPass);

  const outlinePass = new OutlinePass(new Vector2(canvas.clientWidth, canvas.clientHeight), scene, camera);
  setOutlinePass(outlinePass);
  outlinePass.edgeStrength = 3.0;
  outlinePass.edgeGlow = 1.0;
  outlinePass.edgeThickness = 3.0;
  outlinePass.pulsePeriod = 0;
  outlinePass.usePatternTexture = false;
  outlinePass.visibleEdgeColor.set("#ffffff");
  outlinePass.hiddenEdgeColor.set("#858585");
  // outlinePass.selectedObjects = [person];
  composer.addPass(outlinePass);

  const outputPass = new OutputPass();
  composer.addPass(outputPass);

  const toneMappingOptions = [
    NoToneMapping,
    LinearToneMapping,
    ReinhardToneMapping,
    CineonToneMapping,
    ACESFilmicToneMapping,
    AgXToneMapping,
    NeutralToneMapping,
    CustomToneMapping,
  ];
  gui
    .add(renderer, "toneMapping", toneMappingOptions)
    .name("Tone mapping")
    .onChange((toneMapping: ToneMapping) => {
      renderer.toneMapping = toneMapping;
      console.log("Tone mapping set to", toneMapping);
    });
  gui.add(renderer, "toneMappingExposure").min(0.0).max(1.0).step(0.01).name("Tone mapping exposure");
  renderer.outputColorSpace = "srgb" as ColorSpace;

  const rapierDebugRenderer = new RapierDebugRenderer(scene, world);
  gui.add(rapierDebugRenderer, "enabled").name("Show physics debug");
  const guiHelper = {
    set gravity(value: number) {
      world.gravity = { x: 0, y: 0, z: value };
      scene.traverse((object) => (object as BetterObject3D).rigidBody?.wakeUp());
    },
    get gravity() {
      return world.gravity.z;
    },
    slowMotion: 1,
  };
  gui.add(guiHelper, "gravity", -9.81, 9.81).name("Gravity");
  gui.add(guiHelper, "slowMotion").min(1).max(10);

  const ambientLight = new AmbientLight(0xffffff, 1);
  scene.add(ambientLight);

  const directionalLight = new DirectionalLight(0xffffff, 4);
  directionalLight.position.set(18, 13, 20);
  directionalLight.lookAt(0, 0, 0);
  scene.add(directionalLight);
  // const directionalLightHelper = new DirectionalLightHelper(directionalLight, 10);
  // scene.add(directionalLightHelper);

  const hemisphereLight = new HemisphereLight(0xffffff, 0x444444, 0.1);
  scene.add(hemisphereLight);

  const sky = new CustomSky(camera);
  scene.add(sky);
  sky.init();

  // scene.fog = new Fog(0xcccccc, 20, 80);

  // const geometry = new SphereGeometry(0.62, 100, 100);
  // const material = new MeshPhongMaterial({ color: 0xaa7788 });
  // const sphere = new Mesh(geometry, material);
  // scene.add(sphere);
  // const sphereRigidBody = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(0.0, 2.0, 5.0));
  // const sphereCollider = world.createCollider(RAPIER.ColliderDesc.ball(0.62).setTranslation(0.0, 0.0, 0.0), sphereRigidBody);
  // sphereCollider.setRestitution(0.8);
  // const sphereObject = new BuoyantObject();
  // sphereObject.add(sphere);
  // sphereObject.rigidBody = sphereRigidBody;
  // scene.add(sphereObject);
  // sphereObject.init();

  const cubeGeometry = new BoxGeometry(2, 2, 2);
  const cubeMaterial = new MeshStandardMaterial({ color: 0x44aa88 });
  const cube = new Mesh(cubeGeometry, cubeMaterial);
  const cubeRigidBody = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(6.0, 0.0, 5.0));
  const cubeCollider = world.createCollider(RAPIER.ColliderDesc.cuboid(1, 1, 1).setTranslation(0.0, 0.0, 0.0), cubeRigidBody);
  cubeCollider.setRestitution(0);
  const cubeObject = new BuoyantObject();
  cubeObject.add(cube);
  cubeObject.rigidBody = cubeRigidBody;
  scene.add(cubeObject);
  cubeObject.init();

  const cubeGrayGeometry = new BoxGeometry(1.5, 1.5, 1.5);
  const cubeGray = new MeshStandardMaterial({ color: 0xcccccc });
  const cube2 = new Mesh(cubeGrayGeometry, cubeGray);
  const cube2RigidBody = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(-4.0, -1.0, 5.0));
  const cube2Collider = world.createCollider(RAPIER.ColliderDesc.cuboid(0.75, 0.75, 0.75).setTranslation(0.0, 0.0, 0.0), cube2RigidBody);
  cube2Collider.setRestitution(0);
  const cube2Object = new BuoyantObject();
  cube2Object.add(cube2);
  cube2Object.rigidBody = cube2RigidBody;
  scene.add(cube2Object);
  cube2Object.init();

  // const cube3 = new Mesh(cubeGeometry, cubeGray);
  // const cube3RigidBody = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(-1.0, -1.0, 5.0));
  // const cube3Collider = world.createCollider(RAPIER.ColliderDesc.cuboid(0.5, 0.5, 0.5).setTranslation(0.0, 0.0, 0.0), cube3RigidBody);
  // cube3Collider.setRestitution(0.8);
  // const cube3Object = new BuoyantObject();
  // cube3Object.add(cube3);
  // cube3Object.rigidBody = cube3RigidBody;
  // scene.add(cube3Object);

  // world.createImpulseJoint(
  //   JointData.fixed({ x: -0.5, y: 0, z: 0 }, new Quaternion(), { x: 0.5, y: 0, z: 0 }, new Quaternion()),
  //   cube2RigidBody,
  //   cube3RigidBody,
  //   true
  // );

  const ship = new ShipPlayer(new Vector3(mapGenerationData.spawnPoint.x, mapGenerationData.spawnPoint.y, 10));
  scene.add(ship);
  ship.init();
  cameraSwitcher.setTarget(ship);

  const water = new Water();
  scene.add(water);
  water.init();

  const chunkGenerator = new ChunkGenerator({ camera, mapGenerationData });
  scene.add(chunkGenerator);
  chunkGenerator.init();

  gui
    .add({}, "dummy", CameraType)
    .name("Camera type")
    .setValue(cameraSwitcher.type)
    .onChange((type: CameraType) => cameraSwitcher.switchCamera(type));

  const cpuTimeStats = createTimeStats();

  let running = true;
  let previousTime: number;
  const animate = (time: number) => {
    if (!running) return;
    cpuTimeStats.start();
    stats.begin();
    requestAnimationFrame(animate);
    if (previousTime) {
      let delta = time - previousTime;
      if (delta > 50) {
        delta = 50;
      }
      setCurrentDeltaTime(delta);
      world.timestep = delta / 1000 / guiHelper.slowMotion;
    }
    previousTime = time;
    traverseObjects(scene, (object) => (object as BetterObject3D).beforeStep?.());
    cameraSwitcher.beforeStep();
    world.step(new EventQueue(true), PhysicsHooks);
    scene.traverse((object) => (object as BetterObject3D).afterStep?.());
    cameraSwitcher.afterStep();
    rapierDebugRenderer.update();
    resizeRendererToDisplaySize(renderer, composer, cameraSwitcher.camera);
    composer.render();
    stats.end();
    cpuTimeStats.end();
  };
  animate(performance.now());

  return () => {
    running = false;
    previousAspectRatio = 0;
    destroySceneObjects(scene);
    renderer.dispose();
    gui.destroy();
    cameraSwitcher.dispose();
    resetDebugRigidBodies();
    console.log("cleanup complete");
  };
};

function traverseObjects(obj: Object3D, callback: (obj: Object3D) => void) {
  callback(obj);
  if (obj.children) {
    const children = obj.children;
    for (let i = 0, l = children.length; i < l; i++) {
      if (children[i] != undefined) {
        traverseObjects(children[i], callback);
      }
    }
  }
}

let previousAspectRatio = 0;

const resizeRendererToDisplaySize = (renderer: WebGLRenderer, composer: EffectComposer, camera: PerspectiveCamera) => {
  const canvas = renderer.domElement;
  const pixelRatio = window.devicePixelRatio;
  const width = Math.floor(canvas.clientWidth * pixelRatio);
  const height = Math.floor(canvas.clientHeight * pixelRatio);
  const aspect = width / height;
  const needResize = aspect !== previousAspectRatio;
  previousAspectRatio = aspect;
  if (needResize) {
    renderer.setSize(width, height, false);
    composer.setSize(width, height);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }
};

function destroySceneObjects(scene: Scene) {
  scene.traverse((object) => {
    console.log("disposing", object);
    if (hasDispose(object)) {
      object.dispose(false);
    }

    if (!isMesh(object)) return;

    // Dispose of geometries
    if (object.geometry) {
      object.geometry.dispose();
    }

    // Dispose of materials
    if (object.material) {
      if (Array.isArray(object.material)) {
        object.material.forEach((material) => material.dispose());
      } else {
        object.material.dispose();
      }
    }
  });

  // Remove objects from the scene
  while (scene.children.length > 0) {
    scene.remove(scene.children[0]);
  }
}

function hasDispose(object: any): object is { dispose: (...args: any) => void } {
  return object && object.dispose;
}

function isMesh(object: any): object is Mesh {
  return object && object.isMesh;
}
