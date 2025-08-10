import { Object3D } from "three";
import { Game } from "./Game";
import { Vector3 } from "./helpers";

Object3D.DEFAULT_UP = new Vector3(0, 0, 1);

function App() {
  return (
    <>
      <Game />
    </>
  );
}

export default App;

// window.onbeforeunload = (e: BeforeUnloadEvent) => {
//   e.preventDefault();
//   e.returnValue = "";
//   return "Are you sure you want to leave?";
// };
