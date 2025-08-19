import { useEffect, useState } from "react";
import { MenuContent, MenuWindow, Overlay } from "./Components";
import { Settings } from "./Settings";
import { MapGenerationData, NewMap } from "./NewMap";

interface MainMenuProps {
  reloadGame: () => void;
  generateMap: (mapGenerationData: MapGenerationData) => void;
  mapGenerationData: MapGenerationData;
}

enum MenuPage {
  Main,
  Settings,
  NewMap,
}

export const MainMenu = (props: MainMenuProps) => {
  const [visible, setVisible] = useState(false);
  const [showPage, setShowPage] = useState(MenuPage.Main);

  useEffect(() => {
    function handleKeyPress(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setVisible((visible) => !visible);
        setShowPage(MenuPage.Main);
      } else if (event.key.toLowerCase() === "r" && !visible) {
        props.reloadGame();
      }
    }
    // function pointerLockChangeListener() {
    //   if (document.pointerLockElement === null) {
    //     setVisible(true);
    //   }
    // }
    document.addEventListener("keydown", handleKeyPress);
    // document.addEventListener("pointerlockchange", pointerLockChangeListener);
    return () => {
      document.removeEventListener("keydown", handleKeyPress);
      // document.removeEventListener("pointerlockchange", pointerLockChangeListener);
    };
  }, [visible]);

  if (!visible) {
    return null;
  }
  return (
    <Overlay blur darkenBackground>
      <MenuWindow>
        {showPage === MenuPage.Main && (
          <>
            <h1>Pufferfish</h1>
            <MenuContent>
              <button onClick={() => setVisible(false)}>Resume Game</button>
              <button onClick={() => setShowPage(MenuPage.NewMap)}>Generate Map</button>
              <button onClick={() => setShowPage(MenuPage.Settings)}>Settings</button>
              <button
                onClick={() => {
                  props.reloadGame();
                  setVisible(false);
                }}
              >
                Reload Game
              </button>
              <br />
              <button onClick={() => window.location.reload()}>Exit</button>
            </MenuContent>
          </>
        )}
        {showPage === MenuPage.Settings && <Settings closeSettings={() => setShowPage(MenuPage.Main)} reloadGame={props.reloadGame} />}
        {showPage === MenuPage.NewMap && (
          <NewMap
            backToMain={() => setShowPage(MenuPage.Main)}
            closeMenu={() => setVisible(false)}
            generateMap={props.generateMap}
            mapGenerationData={props.mapGenerationData}
          />
        )}
      </MenuWindow>
    </Overlay>
  );
};
