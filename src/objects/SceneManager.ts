import { BetterObject3D } from "./BetterObject3D";
import { GameStore } from "../ui/GameContext";
import { scene } from "../Globals";
import { ShipPlayer } from "./ShipPlayer";
import { Quaternion, Vector3 } from "../helpers";
import { defaultShipBlueprint } from "./Ship";
import { BlueprintBuildable } from "./BlueprintBuildable";

export class SceneManager extends BetterObject3D {
  private store = GameStore.getInstance();
  private currentActor: BetterObject3D | null = null;
  private unsubscribeMode?: () => void;

  constructor(spawnPoint: Vector3) {
    super();
    // Create initial ShipPlayer
    const ship = new ShipPlayer({ position: spawnPoint.clone(), rotation: new Quaternion(), blueprint: defaultShipBlueprint });
    this.setActor(ship);
    // Subscribe to mode changes to switch between ship and buildable
    this.unsubscribeMode = this.store.subscribe("mode", (mode) => {
      if (mode === "build") {
        this.switchToBuildable();
      } else if (mode === "third_person") {
        this.switchToShip();
      }
    });
  }

  private setActor(actor: BetterObject3D) {
    console.log("setActor", actor);
    if (this.currentActor) {
      this.currentActor.dispose(true);
    }
    this.currentActor = actor;
    scene.add(actor);
    this.store.set("camera.target", actor);
  }

  private switchToBuildable() {
    if (!this.currentActor) return;
    if ("shipProps" in this.currentActor) {
      console.log("switchToBuildable");
      const ship = this.currentActor as unknown as ShipPlayer;
      const shipProps = ship.shipProps;
      shipProps.position = ship.position.clone();
      shipProps.rotation = new Quaternion().setFromEuler(ship.rotation);
      const buildable = new BlueprintBuildable(shipProps);
      this.setActor(buildable);
    }
  }

  private switchToShip() {
    if (!this.currentActor) return;
    if (this.currentActor instanceof BlueprintBuildable) {
      console.log("switchToShip");
      const props = this.currentActor.buildableData;
      const ship = new ShipPlayer(props);
      this.setActor(ship);
    }
  }

  dispose(removeFromParent?: boolean): void {
    super.dispose(removeFromParent);
    this.unsubscribeMode?.();
  }
}
