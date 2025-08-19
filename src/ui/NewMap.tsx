import { useState } from "react";
import { FlexRowNoWrap, FlexRowWrap, MenuContent, SliderWithNumberInput, SmallButton, TextInput, WrapperWithLabel } from "./Components";
import { BottomButtons } from "./Settings";
import styled from "@emotion/styled";
import { MapPreview } from "./MapPreview";

export interface MapGenerationData {
  seed?: string;
  mapSize: number;
  spawnPoint: { x: number; y: number };
}

interface NewMapProps {
  backToMain: () => void;
  closeMenu: () => void;
  mapGenerationData: MapGenerationData;
  generateMap: (mapGenerationData: MapGenerationData) => void;
}

const MAP_SIZE_MIN = 1024;
const MAP_SIZE_MAX = 4096;
const MAP_SIZE_STEP = 256;

export const NewMap = (props: NewMapProps) => {
  const [mapSize, setMapSize] = useState(props.mapGenerationData.mapSize ?? MAP_SIZE_MIN);
  const getRandomSeed = () => Math.random().toString(36).substring(2, 15);
  const [seed, setSeed] = useState(props.mapGenerationData.seed ?? getRandomSeed());
  const [selectedPreviewSeed, setSelectedPreviewSeed] = useState<string | null>(null);
  const [selectedSpawnPoint, setSelectedSpawnPoint] = useState<{ x: number; y: number } | null>(null);

  if (!selectedPreviewSeed) {
    return (
      <>
        <h1>Generate Map</h1>
        <StyledMenuContent>
          <FlexRowWrap>
            <WrapperWithLabel label="Map Size:">
              <SliderWithNumberInput value={mapSize} min={MAP_SIZE_MIN} max={MAP_SIZE_MAX} step={MAP_SIZE_STEP} onChange={setMapSize} />
            </WrapperWithLabel>
            <TextInput value={seed} onChange={(value) => setSeed(value)} label="Seed:" width="150px" />
            <SmallButton className="secondary" onClick={() => setSeed(getRandomSeed())}>
              Randomize Seed
            </SmallButton>
          </FlexRowWrap>
          <FlexRowNoWrap center>
            <MapPreview mapSize={mapSize} seed={seed} onClick={() => setSelectedPreviewSeed(seed)} />
            <MapPreview mapSize={mapSize} seed={seed + "1"} onClick={() => setSelectedPreviewSeed(seed + "1")} />
            <MapPreview mapSize={mapSize} seed={seed + "2"} onClick={() => setSelectedPreviewSeed(seed + "2")} />
          </FlexRowNoWrap>
        </StyledMenuContent>
        <BottomButtons>
          <button className="secondary" onClick={props.backToMain}>
            Back
          </button>
        </BottomButtons>
      </>
    );
  }

  return (
    <>
      <h1>Select spawn point</h1>
      <StyledMenuContent>
        <FlexRowWrap center>
          <MapPreview mapSize={mapSize} seed={selectedPreviewSeed} onClick={(pointX, pointY) => setSelectedSpawnPoint({ x: pointX, y: pointY })} />
        </FlexRowWrap>
      </StyledMenuContent>
      <BottomButtons>
        <button
          className="secondary"
          onClick={() => {
            setSelectedPreviewSeed(null);
            setSelectedSpawnPoint(null);
          }}
        >
          Back
        </button>
        {selectedSpawnPoint && (
          <button
            className="primary"
            onClick={() => {
              props.closeMenu();
              props.generateMap({ seed: selectedPreviewSeed, mapSize, spawnPoint: selectedSpawnPoint });
            }}
          >
            Spawn
          </button>
        )}
      </BottomButtons>
    </>
  );
};

const StyledMenuContent = styled(MenuContent)`
  width: 65vw;
  max-height: 70vh;
`;
