import { useCallback, useSyncExternalStore } from "react";
import { Vector3 } from "../helpers";
import { ShipPartInfo } from "../objects/ShipParts";

export type SelectedItem = ShipPartInfo;

// Core state
export type GameMode = "third_person" | "build";
export type GameState = {
  mode: GameMode;
  building: {
    selectedItem: SelectedItem | null;
    mouseNewPartPosition: Vector3 | null;
  };
};

export const initialGameState: GameState = {
  mode: "third_person",
  building: { selectedItem: null, mouseNewPartPosition: null },
};

deepFreeze(initialGameState);

// Type-level utilities to infer dot-paths and their values from GameState
type Primitive = string | number | boolean | symbol | bigint | null | undefined;
type NonObject = Primitive | ((...args: unknown[]) => unknown) | Date | RegExp | Array<unknown>;

type DotPath<T> = T extends NonObject
  ? never
  : {
      [K in Extract<keyof T, string>]: T[K] extends NonObject ? K : K | `${K}.${DotPath<T[K]>}`;
    }[Extract<keyof T, string>];

type PathValue<T, P extends string> = P extends `${infer K}.${infer Rest}`
  ? K extends keyof T
    ? PathValue<T[K], Rest>
    : never
  : P extends keyof T
  ? T[P]
  : never;

export type GamePath = DotPath<GameState>;

// Utility helpers for dot-path access with immutable updates
function getByPath<TValue>(obj: unknown, path: string): TValue {
  return path.split(".").reduce((acc: unknown, key: string) => (acc as any)?.[key], obj as any) as TValue;
}

function setByPath<P extends GamePath>(obj: GameState, path: P, value: PathValue<GameState, P>): void {
  const keys = path.split(".");
  let cursor: any = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    cursor = cursor[keys[i]];
  }
  cursor[keys[keys.length - 1]] = value as any;
}

function isSameValue(a: unknown, b: unknown): boolean {
  // Object.is handles NaN and -0 correctly; for objects, reference equality is fine
  return Object.is(a, b);
}

export class GameStore {
  private state: GameState;
  private listeners = new Map<string, Set<(v: unknown) => void>>();

  static instance: GameStore;
  static getInstance(): GameStore {
    if (!GameStore.instance) {
      GameStore.instance = new GameStore(deepCopyUsingJSON(initialGameState));
    }
    return GameStore.instance;
  }

  constructor(initial: GameState) {
    this.state = initial;
  }

  getState(): GameState {
    return this.state;
  }

  get<P extends GamePath>(path: P): PathValue<GameState, P> {
    return getByPath<PathValue<GameState, P>>(this.state, path);
  }

  set<P extends GamePath>(path: P, value: PathValue<GameState, P>): void {
    const prev = this.get(path);
    if (isSameValue(prev, value)) return;
    setByPath(this.state, path, value);
    const listenersForPath = this.listeners.get(path);
    if (listenersForPath && listenersForPath.size > 0) {
      const current = this.get(path);
      listenersForPath.forEach((l) => l(current));
    }
  }

  update<P extends GamePath>(path: P, updater: (prev: PathValue<GameState, P>) => PathValue<GameState, P>) {
    const prev = this.get(path);
    this.set(path, updater(prev));
  }

  subscribe<P extends GamePath>(path: P, listener: (value: PathValue<GameState, P>) => void): () => void {
    const set = this.listeners.get(path) ?? new Set<(v: unknown) => void>();
    const typed = listener as unknown as (v: unknown) => void;
    set.add(typed);
    this.listeners.set(path, set);
    return () => {
      const s = this.listeners.get(path);
      if (s) {
        s.delete(typed);
        if (s.size === 0) this.listeners.delete(path);
      }
    };
  }

  resetToInitialState() {
    this.state = deepCopyUsingJSON(initialGameState);
    // notify all listeners
    [...this.listeners.entries()].forEach(([path, listener]) =>
      listener.forEach((l) => {
        console.log("notifying listener", path, this.get(path as GamePath), l);
        l(this.get(path as GamePath));
      })
    );
  }
}

// React context for the store instance
// Accessor for the singleton store from hooks/components
const useStoreInstance = () => GameStore.getInstance();

export function useGameValue<P extends GamePath>(path: P): [PathValue<GameState, P>, (v: PathValue<GameState, P>) => void] {
  const store = useStoreInstance();
  const subscribe = useCallback((onChange: () => void) => store.subscribe(path, () => onChange()), [store, path]);
  const getSnapshot = useCallback(() => store.get(path), [store, path]);
  const value = useSyncExternalStore(subscribe, getSnapshot, getSnapshot) as PathValue<GameState, P>; // TODO: Maybe remove the third argument?
  const set = useCallback((v: PathValue<GameState, P>) => store.set(path, v), [store, path]);
  return [value, set];
}

function deepFreeze<T>(obj: T): T {
  if (typeof obj === "object" && obj !== null) {
    Object.freeze(obj);
    Object.values(obj).forEach((value) => deepFreeze(value));
  }
  return obj;
}

/**
 * This uses JSON.parse(JSON.stringify(obj)) to create a deep copy of the object.
 * Can be only used for simple data like objects or arrays.
 */
function deepCopyUsingJSON<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}
