import { Vector3 } from "../helpers";
import { Ship } from "./Ship";

const THRUST_FORWARD_KEY = "w";
const THRUST_BACKWARD_KEY = "s";
const RUDDER_LEFT_KEY = "a";
const RUDDER_RIGHT_KEY = "d";

export class ShipPlayer extends Ship {
  pressedKeys: Set<string> = new Set();
  constructor(position: Vector3) {
    super(position);

    document.addEventListener("keydown", this.keyDown);
    document.addEventListener("keyup", this.keyUp);
  }

  beforeUpdate(): void {
    super.beforeUpdate();
    if (this.pressedKeys.has(THRUST_FORWARD_KEY)) {
      this.thrustParts.forEach((part) => part.thrust(1));
    }
    if (this.pressedKeys.has(THRUST_BACKWARD_KEY)) {
      this.thrustParts.forEach((part) => part.thrust(-1));
    }

    // Rudder control: A = left (-1), D = right (+1)
    const left = this.pressedKeys.has(RUDDER_LEFT_KEY) ? -1 : 0;
    const right = this.pressedKeys.has(RUDDER_RIGHT_KEY) ? 1 : 0;
    const steerInput = Math.max(-1, Math.min(1, left + right));

    this.rudderParts.forEach((rudder) => {
      rudder.setInput(steerInput);
      rudder.stepRudder(); // visual only
      rudder.applyHydrodynamicForces(); // physics impulses
    });
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
