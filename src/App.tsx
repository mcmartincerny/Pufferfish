import { Object3D } from "three";
import { Game } from "./Game";
// Store context removed; components read store via singleton internally
import { Vector3 } from "./helpers";
import { IconRendererManager } from "./ui/building/ItemRendererManager";
import { useEffect } from "react";
import { ToastManager } from "./ui/ToastManager";

Object3D.DEFAULT_UP = new Vector3(0, 0, 1);

function App() {
  useEffect(() => {
    return () => {
      // This useEffect cleanup will only run for Hot Module Reload (HMR) while developing.
      // Cleanup stuff that can't be cleaned up elsewhere.
      IconRendererManager.disposeInstance();
    };
  }, []);

  useEffect(() => {
    // Disable right click context menu
    const contextMenuListener = (event: MouseEvent) => {
      event.preventDefault();
    };
    document.addEventListener("contextmenu", contextMenuListener);
    return () => {
      document.removeEventListener("contextmenu", contextMenuListener);
    };
  }, []);
  return (
    <>
      <Game />
      <ToastManager />
    </>
  );
}

export default App;

// window.onbeforeunload = (e: BeforeUnloadEvent) => {
//   e.preventDefault();
//   e.returnValue = "";
//   return "Are you sure you want to leave?";
// };
