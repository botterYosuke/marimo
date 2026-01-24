/* Copyright 2026 Marimo. All rights reserved. */
/* eslint-disable @typescript-eslint/no-explicit-any */

import type { AnyWidget, Experimental } from "@anywidget/types";
import { isEqual } from "lodash-es";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import useEvent from "react-use-event-hook";
import { z } from "zod";
import { MarimoIncomingMessageEvent } from "@/core/dom/events";
import { asRemoteURL } from "@/core/runtime/config";
import { useAsyncData } from "@/hooks/useAsyncData";
import { useDeepCompareMemoize } from "@/hooks/useDeepCompareMemoize";
import {
  type HTMLElementNotDerivedFromRef,
  useEventListener,
} from "@/hooks/useEventListener";
import { createPlugin } from "@/plugins/core/builder";
import { rpc } from "@/plugins/core/rpc";
import type { IPluginProps } from "@/plugins/types";
import {
  decodeFromWire,
  isWireFormat,
  serializeBuffersToBase64,
  type WireFormat,
} from "@/utils/data-views";
import { prettyError } from "@/utils/errors";
import type { Base64String } from "@/utils/json/base64";
import { Logger } from "@/utils/Logger";
import { ErrorBanner } from "../common/error-banner";
import { MODEL_MANAGER, Model, registerGlobalModelUpdateCallback } from "./model";

interface Data {
  jsUrl: string;
  jsHash: string;
  css?: string | null;
}

type T = Record<string, unknown>;

// eslint-disable-next-line @typescript-eslint/consistent-type-definitions
type PluginFunctions = {
  send_to_widget: <T>(req: {
    content: unknown;
    buffers: Base64String[];
  }) => Promise<null | undefined>;
};

export const AnyWidgetPlugin = createPlugin<WireFormat<T>>("marimo-anywidget")
  .withData(
    z.object({
      jsUrl: z.string(),
      jsHash: z.string(),
      css: z.string().nullish(),
    }),
  )
  .withFunctions<PluginFunctions>({
    send_to_widget: rpc
      .input(
        z.object({
          content: z.unknown(),
          buffers: z.array(z.string().transform((v) => v as Base64String)),
        }),
      )
      .output(z.null().optional()),
  })
  .renderer((props) => <AnyWidgetSlot {...props} />);

const AnyWidgetSlot = (
  props: IPluginProps<WireFormat<T>, Data, PluginFunctions>,
) => {
  const { css, jsUrl, jsHash } = props.data;

  // Decode wire format { state, bufferPaths, buffers } to state with DataViews
  const valueWithBuffers = useMemo(() => {
    if (isWireFormat(props.value)) {
      const decoded = decodeFromWire(props.value);
      Logger.debug("AnyWidget decoded wire format:", {
        bufferPaths: props.value.bufferPaths,
        buffersCount: props.value.buffers?.length,
        decodedKeys: Object.keys(decoded),
      });
      return decoded;
    }
    Logger.warn("AnyWidget value is not wire format:", props.value);
    return props.value;
  }, [props.value]);

  // JS is an ESM file with a render function on it
  // export function render({ model, el }) {
  //   ...
  const {
    data: module,
    error,
    refetch,
  } = useAsyncData(async () => {
    const url = asRemoteURL(jsUrl).toString();
    return await import(/* @vite-ignore */ url);
    // Re-render on jsHash change (which is a hash of the contents of the file)
    // instead of a jsUrl change because URLs may change without the contents
    // actually changing (and we don't want to re-render on every change).
    // If there is an error loading the URL (e.g. maybe an invalid or old URL),
    // we also want to re-render.
  }, [jsHash]);

  // If there is an error and the jsUrl has changed, we want to re-render
  // because the URL may have changed to a valid URL.
  const hasError = Boolean(error);
  useEffect(() => {
    if (hasError && jsUrl) {
      refetch();
    }
  }, [hasError, jsUrl]);

  // Mount the CSS
  useEffect(() => {
    const shadowRoot = props.host.shadowRoot;
    if (!css || !shadowRoot) {
      return;
    }

    // Try constructed stylesheets first
    if (
      "adoptedStyleSheets" in Document.prototype &&
      "replace" in CSSStyleSheet.prototype
    ) {
      const sheet = new CSSStyleSheet();
      try {
        sheet.replaceSync(css);
        if (shadowRoot) {
          shadowRoot.adoptedStyleSheets = [
            ...shadowRoot.adoptedStyleSheets,
            sheet,
          ];
        }
        return () => {
          if (shadowRoot) {
            shadowRoot.adoptedStyleSheets =
              shadowRoot.adoptedStyleSheets.filter((s) => s !== sheet);
          }
        };
      } catch {
        // Fall through to inline styles if constructed sheets fail
      }
    }

    // Fallback to inline styles
    const style = document.createElement("style");
    style.innerHTML = css;
    shadowRoot.append(style);
    return () => {
      style.remove();
    };
  }, [css, props.host]);

  // Wrap setValue to serialize DataViews back to base64 before sending
  // Structure matches ipywidgets protocol: { state, bufferPaths, buffers }
  const wrappedSetValue = useEvent((partialValue: Partial<T>) =>
    props.setValue(serializeBuffersToBase64(partialValue)),
  );

  if (error) {
    return <ErrorBanner error={error} />;
  }

  if (!module) {
    return null;
  }

  if (!isAnyWidgetModule(module)) {
    const error = new Error(
      `Module at ${jsUrl} does not appear to be a valid anywidget`,
    );
    return <ErrorBanner error={error} />;
  }

  // Find the closest parent element with an attribute of `random-id`
  const randomId = props.host.closest("[random-id]")?.getAttribute("random-id");
  // Use jsHash instead of jsUrl to prevent re-mounting when only the URL changes
  // but the content remains the same (jsHash is content-based)
  const key = randomId ?? jsHash ?? jsUrl;

  return (
    <LoadedSlot
      // Use the a key to force a re-render when the randomId (or jsUrl) changes
      // Plugins may be stateful and we cannot make assumptions that we won't be
      // so it is safer to just re-render.
      key={key}
      {...props}
      widget={module.default}
      setValue={wrappedSetValue}
      value={valueWithBuffers}
    />
  );
};

/**
 * Run the anywidget module
 *
 * @param widgetDef - The anywidget definition
 * @param model - The model to pass to the widget
 * @param clearElement - Whether to clear the element before rendering (default: true)
 */
async function runAnyWidgetModule(
  widgetDef: AnyWidget,
  model: Model<T>,
  el: HTMLElement,
  clearElement = true,
): Promise<() => void> {
  const experimental: Experimental = {
    invoke: async (_name, _msg, _options) => {
      const message =
        "anywidget.invoke not supported in marimo. Please file an issue at https://github.com/marimo-team/marimo/issues";
      Logger.warn(message);
      throw new Error(message);
    },
  };
  // Clear the element only on initial render, not on re-renders
  // This prevents flickering when data changes but ESM stays the same
  if (clearElement) {
    el.innerHTML = "";
  }
  const widget =
    typeof widgetDef === "function" ? await widgetDef() : widgetDef;
  await widget.initialize?.({ model, experimental });
  try {
    const unsub = await widget.render?.({ model, el, experimental });
    return () => {
      unsub?.();
    };
  } catch (error) {
    Logger.error("Error rendering anywidget", error);
    el.classList.add("text-error");
    el.innerHTML = `Error rendering anywidget: ${prettyError(error)}`;
    return () => {
      // No-op
    };
  }
}

function isAnyWidgetModule(mod: any): mod is { default: AnyWidget } {
  return (
    mod.default &&
    (typeof mod.default === "function" ||
      mod.default?.render ||
      mod.default?.initialize)
  );
}

export function getDirtyFields(value: T, initialValue: T): Set<keyof T> {
  return new Set(
    Object.keys(value).filter((key) => !isEqual(value[key], initialValue[key])),
  );
}

function hasModelId(message: unknown): message is { model_id: string } {
  return (
    typeof message === "object" && message !== null && "model_id" in message
  );
}

interface Props
  extends Omit<IPluginProps<T, Data, PluginFunctions>, "setValue"> {
  widget: AnyWidget;
  value: T;
  setValue: (value: Partial<T>) => void;
}

const LoadedSlot = ({
  value,
  setValue,
  widget,
  functions,
  data,
  host,
}: Props & { widget: AnyWidget }) => {
  const htmlRef = useRef<HTMLDivElement>(null);
  const isFirstRender = useRef(true);
  const unsubRef = useRef<(() => void) | null>(null);

  // Counter to force re-render when model is updated via WebSocket
  const [modelUpdateCount, setModelUpdateCount] = useState(0);

  // Track if update came from WebSocket to avoid double-processing
  const updateSourceRef = useRef<"websocket" | "props">("props");

  // Ref to access current value in async callbacks (fixes stale closure issue)
  const valueRef = useRef(value);
  valueRef.current = value;

  // value is already decoded from wire format
  const model = useRef<Model<T>>(
    new Model(value, setValue, functions.send_to_widget, new Set()),
  );

  // Set up callback to be notified when model is updated via WebSocket
  const handleModelUpdate = useCallback(() => {
    updateSourceRef.current = "websocket";
    setModelUpdateCount((c) => c + 1);
  }, []);

  useEffect(() => {
    model.current.setOnModelUpdate(handleModelUpdate);
  }, [handleModelUpdate]);

  // Suppress "Object is disposed" errors from widgets like lightweight-charts
  // These errors occur when requestAnimationFrame callbacks execute after chart disposal
  // This is a known issue with lightweight-charts and similar libraries that use rAF
  // Using addEventListener with capture phase for targeted error interception
  useEffect(() => {
    const handler = (event: ErrorEvent) => {
      // Only suppress errors that match the specific pattern from lightweight-charts
      // Check both message content and optionally the source file
      const isDisposedError =
        event.message === "Object is disposed" ||
        event.message === "Uncaught Object is disposed";
      const isFromLightweightCharts =
        event.filename?.includes("lightweight-charts") ?? true; // Default to true if no filename

      if (isDisposedError && isFromLightweightCharts) {
        event.preventDefault();
        event.stopPropagation();
        Logger.debug(
          "[AnyWidget] Suppressed 'Object is disposed' error (widget cleanup race condition)",
        );
        return;
      }
    };
    window.addEventListener("error", handler, { capture: true });
    return () => {
      window.removeEventListener("error", handler, { capture: true });
    };
  }, []);

  // Listen for global model updates from MODEL_MANAGER
  // This handles the case where WebSocket messages go directly to MODEL_MANAGER
  // (when uiElement is not set in the message)
  useEffect(() => {
    let mounted = true;
    const jsHash = data.jsHash;

    const unsubscribe = registerGlobalModelUpdateCallback((modelId) => {
      // Check if this update is for our widget (modelId matches jsHash)
      if (!mounted || modelId !== jsHash) {
        return;
      }

      // Get the model from MODEL_MANAGER and sync data to local model
      MODEL_MANAGER.get(modelId)
        .then((managerModel) => {
          // Guard against unmounted update
          if (!mounted) {
            return;
          }
          // Note: We don't check document.contains() here because:
          // 1. ShadowDOM elements may not be detected correctly by document.contains()
          // 2. The mounted flag is sufficient to track component lifecycle
          // 3. Any errors from disposed widgets are caught by try-catch below
          // Use valueRef.current to get latest value (fixes stale closure)
          const keys = Object.keys(valueRef.current) as Array<keyof T>;
          const updatedValue: Partial<T> = {};
          let hasChanges = false;
          for (const key of keys) {
            const newVal = managerModel.get(key);
            const oldVal = model.current.get(key);
            // Use deep comparison for objects/arrays to avoid false positives
            // Reference comparison (===) would treat new array/object refs as changes
            // even when content is identical, causing unnecessary re-renders
            if (!isEqual(newVal, oldVal)) {
              updatedValue[key] = newVal;
              hasChanges = true;
              Logger.debug(
                `[AnyWidget] Global callback: key=${String(key)} changed`,
              );
            }
          }
          if (hasChanges) {
            Logger.debug(
              "[AnyWidget] Global callback: updating local model with",
              updatedValue,
            );
            // Wrap in try-catch to handle "Object is disposed" errors
            // from widgets (e.g., lightweight-charts) when component unmounts
            try {
              model.current.updateAndEmitDiffs(updatedValue as T);
            } catch (err) {
              Logger.debug(
                "[AnyWidget] Error updating model (widget may be disposed):",
                err,
              );
            }
          } else {
            Logger.debug(
              "[AnyWidget] Global callback: no changes detected, skipping update",
            );
          }
        })
        .catch((err) => {
          // Model not found in MODEL_MANAGER
          Logger.debug(
            `[AnyWidget] Model not found in MODEL_MANAGER for ${modelId}:`,
            err,
          );
        });
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, [data.jsHash]); // Only re-subscribe when jsHash changes

  // Listen to incoming messages
  useEventListener(
    host as HTMLElementNotDerivedFromRef,
    MarimoIncomingMessageEvent.TYPE,
    (e) => {
      const message = e.detail.message;
      if (hasModelId(message)) {
        // Update MODEL_MANAGER's model (for ipywidgets compatibility)
        MODEL_MANAGER.get(message.model_id).then((m) => {
          m.receiveCustomMessage(message, e.detail.buffers);
        });
      }
      // Always update local model to trigger re-render via onModelUpdate callback
      model.current.receiveCustomMessage(message, e.detail.buffers);
    },
  );

  // Initial render - clear element and render widget
  useEffect(() => {
    if (!htmlRef.current) {
      return;
    }
    isFirstRender.current = true;
    const unsubPromise = runAnyWidgetModule(
      widget,
      model.current,
      htmlRef.current,
      true, // clearElement on initial render
    );
    unsubPromise.then((unsub) => {
      unsubRef.current = unsub;
    });
    return () => {
      // Dispose the model to prevent "Object is disposed" errors
      // from widgets (e.g., lightweight-charts) after component unmounts.
      // dispose() sets the disposed flag and clears all listeners,
      // ensuring emit() calls are silently skipped after unmount.
      model.current.dispose();
      unsubPromise.then((unsub) => unsub());
    };
    // Only re-run on jsHash change (ESM content change)
  }, [widget, data.jsHash]);

  // When value changes OR model is updated via WebSocket, re-render the widget.
  // Some widgets use model.on() listeners, others expect render() to be called again.
  const valueMemo = useDeepCompareMemoize(value);
  useEffect(() => {
    // Skip if element ref is not available
    if (!htmlRef.current) {
      return;
    }
    // Note: We don't check document.contains() because:
    // 1. ShadowDOM elements may not be detected correctly
    // 2. React handles cleanup via the return function
    // 3. Errors from disposed widgets are caught by try-catch
    // Update the model with latest value - emits change events for any diffs
    // Skip if update came from WebSocket - model already has latest data
    if (updateSourceRef.current !== "websocket") {
      // Wrap in try-catch to handle "Object is disposed" errors
      // from widgets (e.g., lightweight-charts) when component unmounts
      try {
        model.current.updateAndEmitDiffs(valueMemo);
      } catch (err) {
        Logger.debug(
          "[AnyWidget] Error updating model (widget may be disposed):",
          err,
        );
      }
    }
    // Reset update source for next update
    updateSourceRef.current = "props";

    // Skip re-render on first mount (already rendered above)
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    // Re-render widget for widgets that don't use model.on() listeners.
    // DON'T call cleanup (unsubRef) before new render - that would destroy the chart
    // and cause flickering. The render function should be able to update the existing chart.
    if (htmlRef.current) {
      runAnyWidgetModule(
        widget,
        model.current,
        htmlRef.current,
        false, // Don't clear element - prevents flickering
      ).then((unsub) => {
        // Clean up previous subscription AFTER new render completes
        unsubRef.current?.();
        unsubRef.current = unsub;
      });
    }
  }, [valueMemo, widget, modelUpdateCount]);

  return <div ref={htmlRef} />;
};

export const visibleForTesting = {
  LoadedSlot,
  runAnyWidgetModule,
  isAnyWidgetModule,
  getDirtyFields,
};
