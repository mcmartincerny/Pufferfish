import styled from "@emotion/styled";
import { theme } from "./Theme";
import { useEffect, useRef, useState } from "react";
import alea from "alea";
import { createNoise2D } from "../utils/simplexNoise";
import { generateHeightMap, hightMapToRGBA } from "../terrain/terrain";
import { clamp } from "../helpers";
interface MapPreviewProps {
  mapSize: number;
  seed: string;
  // mapX and mapY are the coordinates on the map that user clicked on
  onClick?: (mapX: number, mapY: number) => void;
}

export const MapPreview = ({ mapSize, seed, onClick }: MapPreviewProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [clickPos, setClickPos] = useState<{ x: number; y: number } | null>(null);

  const handleClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!onClick) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const cx = event.clientX - rect.left;
    const cy = event.clientY - rect.top;

    setClickPos({ x: cx, y: cy });

    // Convert canvas coords → world coords
    const worldX = ((cy / rect.height) * mapSize - mapSize / 2) * -1;
    const worldY = ((cx / rect.width) * mapSize - mapSize / 2) * -1;

    console.log(worldX, worldY); // -117 ; -173
    onClick(worldX, worldY);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const parent = canvas.parentElement!;
    const parentWidth = parent.clientWidth;
    const parentGap = parseInt(parent.computedStyleMap().get("gap")?.toString().replace("px", "") ?? "16");
    const parentChildren = parent.children.length;
    let calculatedWidth = parentWidth / parentChildren - parentGap * (parentChildren - 1);
    const windowHeight65 = window.innerHeight * 0.65;
    calculatedWidth = clamp(calculatedWidth, 100, windowHeight65);
    canvas.width = calculatedWidth;
    canvas.height = calculatedWidth;
    const noiseFunc = createNoise2D(alea(seed));
    const heightMap = generateHeightMap(noiseFunc, mapSize, mapSize, canvas.width, -mapSize / 2, -mapSize / 2, mapSize, true);
    const rgba = hightMapToRGBA(heightMap, true);
    const imageData = new ImageData(rgba, canvas.width, canvas.width);
    ctx.putImageData(imageData, 0, 0);

    if (clickPos) {
      ctx.strokeStyle = "red";
      ctx.lineWidth = 2;
      const size = 10;
      ctx.beginPath();
      ctx.moveTo(clickPos.x - size, clickPos.y - size);
      ctx.lineTo(clickPos.x + size, clickPos.y + size);
      ctx.moveTo(clickPos.x + size, clickPos.y - size);
      ctx.lineTo(clickPos.x - size, clickPos.y + size);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(clickPos.x, clickPos.y, size - 1, 0, Math.PI * 2);
      ctx.stroke();
    }
  }, [mapSize, seed, clickPos]); // re-run if click position changes
  return <Canvas ref={canvasRef} onClick={handleClick} />;
};

const Canvas = styled.canvas`
  cursor: pointer;
  flex-grow: 1;
  min-width: 100px;
  max-width: 65vh;
  max-height: 65vh;
  border-radius: 8px;
  border: 2px solid ${theme.colors.green};
  &:hover,
  &:focus,
  &:active {
    border: 2px solid ${theme.colors.ultraWhite};
  }
`;
