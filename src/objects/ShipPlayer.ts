import { Ship } from "./Ship";

const THRUST_FORWARD_KEY = "w";
const THRUST_BACKWARD_KEY = "s";
const RUDDER_LEFT_KEY = "a";
const RUDDER_RIGHT_KEY = "d";

export class ShipPlayer extends Ship {
  pressedKeys: Set<string> = new Set();
  constructor() {
    super();

    document.addEventListener("keydown", this.keyDown);
    document.addEventListener("keyup", this.keyUp);
  }

  beforeUpdate(): void {
    if (this.pressedKeys.has(THRUST_FORWARD_KEY)) {
      this.thrustParts.forEach((part) => part.thrust(1));
    }
    if (this.pressedKeys.has(THRUST_BACKWARD_KEY)) {
      this.thrustParts.forEach((part) => part.thrust(-1));
    }
    if (this.pressedKeys.has(RUDDER_LEFT_KEY)) {
    }
    if (this.pressedKeys.has(RUDDER_RIGHT_KEY)) {
    }
  }

  keyDown = (event: KeyboardEvent) => {
    this.pressedKeys.add(event.key);
  };

  keyUp = (event: KeyboardEvent) => {
    this.pressedKeys.delete(event.key);
  };

  dispose(removeFromParent?: boolean): void {
    super.dispose(removeFromParent);
    document.removeEventListener("keydown", this.keyDown);
    document.removeEventListener("keyup", this.keyUp);
  }
}
