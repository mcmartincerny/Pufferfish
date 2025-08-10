import { Game } from "./Game";

function App() {
  return (
    <>
      {/* <h1>Pufferfish</h1> */}
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
