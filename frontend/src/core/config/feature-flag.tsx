/* Copyright 2026 Marimo. All rights reserved. */

import { repl } from "@/utils/repl";
import { getRequestClient } from "../network/requests";
import { getResolvedMarimoConfig, userConfigAtom } from "./config";
import { store } from "../state/jotai";

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface ExperimentalFeatures {
  markdown: boolean; // Used in playground (community cloud)
  wasm_layouts: boolean; // Used in playground (community cloud)
  rtc_v2: boolean;
  performant_table_charts: boolean;
  chat_modes: boolean;
  cache_panel: boolean;
  external_agents: boolean;
  // Add new feature flags here
}

const defaultValues: ExperimentalFeatures = {
  markdown: true,
  wasm_layouts: false,
  rtc_v2: false,
  performant_table_charts: false,
  chat_modes: false,
  cache_panel: false,
  external_agents: import.meta.env.DEV,
};

export function getFeatureFlag<T extends keyof ExperimentalFeatures>(
  feature: T,
): ExperimentalFeatures[T] {
  return (
    (getResolvedMarimoConfig()?.experimental?.[
      feature
    ] as ExperimentalFeatures[T]) ?? defaultValues[feature]
  );
}

function setFeatureFlag(feature: keyof ExperimentalFeatures, value: boolean) {
  // Update userConfigAtom immediately for instant UI update
  const currentConfig = store.get(userConfigAtom);
  store.set(userConfigAtom, {
    ...currentConfig,
    experimental: {
      ...currentConfig.experimental,
      [feature]: value,
    },
  });
  
  // Also save to server (async, may fail in WASM mode)
  void getRequestClient().saveUserConfig({
    config: { experimental: { [feature]: value } },
  });
}

export const FeatureFlagged: React.FC<{
  feature: keyof ExperimentalFeatures;
  children: React.ReactNode;
}> = ({ feature, children }) => {
  const value = getFeatureFlag(feature);
  if (value) {
    return children;
  }
  return null;
};

// Allow setting feature flags from the console
repl(setFeatureFlag, "setFeatureFlag");
