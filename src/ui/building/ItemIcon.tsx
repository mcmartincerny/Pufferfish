import { useEffect, useRef } from "react";
import * as THREE from "three";
import { ShipPartInfo } from "../../objects/ShipParts";
import { destroySceneObjects, Quaternion, Vector3 } from "../../helpers";

export interface ItemIconProps {
  partInfo: ShipPartInfo;
  size?: "small" | "large";
}

export const ItemIcon = ({ partInfo, size = "small" }: ItemIconProps) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const animRef = useRef<number | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const pixelSize = size === "small" ? 40 : 160;
    const container = containerRef.current;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ alpha: true });
    renderer.setSize(pixelSize, pixelSize, false);
    renderer.setPixelRatio(window.devicePixelRatio);
    container.innerHTML = "";
    container.appendChild(renderer.domElement);

    // Scene & Camera
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(35, 1, 0.01, 100);

    // Lights
    const hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 0.6);
    scene.add(hemi);
    const dir = new THREE.DirectionalLight(0xffffff, 0.9);
    dir.position.set(3, 4, 5);
    scene.add(dir);

    // Ground fill light for nicer contrast
    const fill = new THREE.DirectionalLight(0xffddaa, 0.3);
    fill.position.set(-4, -2, 3);
    scene.add(fill);

    // Create part instance centered at origin
    const part = new partInfo.constructor({ rotation: new Quaternion(), translation: new Vector3(0, 0, 0) });
    scene.add(part);
    part.init();

    // Center and frame the object
    const bbox = new THREE.Box3().setFromObject(part);
    const sizeVec = new THREE.Vector3();
    bbox.getSize(sizeVec);
    const radius = sizeVec.length() / 2 || 1;

    // Position camera to fit object nicely
    const dist = radius * 2.2;
    camera.position.set(dist, dist * 0.9, dist);
    camera.lookAt(0, 0, 0);

    scene.background = null;

    // Animate (slow rotation)
    const animate = () => {
      part.rotation.set(part.rotation.x, part.rotation.y, part.rotation.z + 0.01);
      renderer.render(scene, camera);
      animRef.current = requestAnimationFrame(animate);
    };
    animate();

    // Cleanup
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
      renderer.dispose();
      destroySceneObjects(scene);
      container.innerHTML = "";
    };
  }, [partInfo, size]);

  const cssSize = size === "small" ? 40 : 160;

  return <div ref={containerRef} style={{ width: cssSize, height: cssSize }} />;
};
