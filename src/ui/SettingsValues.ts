import { useEffect, useState } from "react";

export const settingsValuesDefaults = {
  Game: {
    HideToolBar: { default: true, description: "Hide the toolbar at the bottom of the screen after not interacting for a few seconds" },
    ShowFPS: { default: "simple", options: ["simple", "detailed", "none"] },
    ShowRenderTime: { default: "none", options: ["simple", "detailed", "none"] },
  },
  Graphics: {
    Fullscreen: { default: true },
    ResolutionScalingFactor: {
      default: 2,
      min: 0.2,
      max: 4,
      step: 0.1,
      description: "1 is native resolution. Less than 1 is lower resolution, above 1 is super-sampling.",
    },
    ViewDistance: { default: 100, min: 10, max: 1000, step: 10 },
    FieldOfView: { default: 75, min: 50, max: 110, step: 5 },
    TextureQuality: { default: "high", options: ["low", "high"] },
    FlatShading: { default: true, description: "Flat shading makes objects look more low poly or cartoony and slightly boosts performance" },
    PolygonCountFactor: {
      default: 1,
      min: 0.2,
      max: 2,
      step: 0.1,
      description: "Simplifies the geometries of some objects and can improve performance and make some objects ugly when set too low",
    },
    Shadows: { default: "all", options: ["all", "only static", "none"] },
    AntiAliasing: { default: true },
  },
  Audio: {
    MasterVolume: { default: 1, min: 0, max: 1, step: 0.01 },
    MusicVolume: { default: 1, min: 0, max: 1, step: 0.01 },
    GameVolume: { default: 1, min: 0, max: 1, step: 0.01 },
  },
  Controls: {
    MouseSensitivity: { default: 0.004, min: 0.001, max: 0.02, step: 0.0001 },
    // TODO: Keybindings
  },
  // "Network": {
  //     "Region": {default: "auto", options: ["auto", "us", "europe", "asia"]},
  // },
  Accessibility: {
    Subtitles: { default: "all", options: ["all", "important", "none"] },
    UserInterfaceScale: { default: 1, min: 0.5, max: 3, step: 0.1 },
  },
  Debug: {
    ShowLilGuiRealTimeDebugSettings: { default: false, description: "Show special debug settings in the top right corner used for development" },
    VisualizeColliders: { default: false, description: "Visualize physical frame of all objects, has big performance hit" },
    VisualizeWireframes: { default: false, description: "Visualize polygon edges of all objects" },
  },
};

// Type to extract the `default` property from an object
type ExtractDefaults<T> = {
  [K in keyof T]: T[K] extends { default: infer U } ? U : never;
};

// Type for the entire settings default values
type SettingsValuesType = {
  [Category in keyof typeof settingsValuesDefaults]: ExtractDefaults<(typeof settingsValuesDefaults)[Category]>;
};

type CategoryWithValue = {
  [K in keyof typeof settingsValuesDefaults]: {
    [Key in keyof (typeof settingsValuesDefaults)[K]]: (typeof settingsValuesDefaults)[K][Key] & { value: boolean | number | string };
  };
}[keyof typeof settingsValuesDefaults];

const getDefaultValues = (): SettingsValuesType => {
  const values = {} as any;

  for (const category in settingsValuesDefaults) {
    values[category] = {} as any;
    for (const key in (settingsValuesDefaults as any)[category]) {
      values[category][key] = (settingsValuesDefaults as any)[category][key].default;
    }
  }
  return values;
};

let currentValues: SettingsValuesType | undefined;

export const getSettingsValues = (): SettingsValuesType => {
  // TODO add setters on the settings that will trigger change event
  if (!currentValues) {
    currentValues = getDefaultValuesWithSaved();
  }
  return currentValues;
};

const getDefaultValuesWithSaved = () => {
  const values = getDefaultValues();
  const storedValues = localStorage.getItem("settingsValues");
  if (storedValues) {
    try {
      const parsedValues = JSON.parse(storedValues);
      for (const category in parsedValues) {
        if (parsedValues[category]) {
          for (const key in parsedValues[category]) {
            if (parsedValues[category][key] != undefined) {
              (values as any)[category][key] = parsedValues[category][key];
            }
          }
        }
      }
    } catch (e) {
      console.error("Error parsing settings values", e);
    }
  }
  return values;
};

export const getCategories = () => Object.keys(settingsValuesDefaults) as (keyof SettingsValuesType)[];

export const getCategoryWithOptions = (category: keyof SettingsValuesType): CategoryWithValue => {
  const categoryOptions = settingsValuesDefaults[category];
  const values = getSettingsValues()[category];
  const clonedCategory = structuredClone(categoryOptions) as CategoryWithValue;
  for (const key in categoryOptions) {
    (clonedCategory as any)[key].value = values[key as keyof typeof values];
  }
  return clonedCategory;
};

const settingsChangeHookSets = [] as ((value: React.SetStateAction<boolean>) => void)[];

export const useGetCategoryWithOptions = (category: keyof SettingsValuesType | undefined): CategoryWithValue | undefined => {
  const [settingsChanged, setSettingsChanged] = useState(false);
  useEffect(() => {
    settingsChangeHookSets.push(setSettingsChanged);
    return () => {
      const index = settingsChangeHookSets.indexOf(setSettingsChanged);
      if (index !== -1) {
        settingsChangeHookSets.splice(index, 1);
      }
    };
  }, []);
  if (category == null) {
    return undefined;
  }
  return getCategoryWithOptions(category);
};

export const setSettingValue = (category: keyof SettingsValuesType | string, key: keyof CategoryWithValue | string, value: boolean | number | string) => {
  (currentValues as any)![category][key] = value;
  settingsChangeHookSets.forEach((set) => set((val) => !val));
};

/**
 * @returns true if the values were changed and reload is needed
 */
export const applySettings = () => {
  if (JSON.stringify(currentValues) === JSON.stringify(getDefaultValuesWithSaved())) {
    return false;
  }
  localStorage.setItem("settingsValues", JSON.stringify(currentValues));
  return true;
};

export const discardSettings = () => {
  currentValues = getDefaultValuesWithSaved();
};
