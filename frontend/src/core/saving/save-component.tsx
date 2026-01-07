/* Copyright 2026 Marimo. All rights reserved. */

import { useAtom, useAtomValue, useSetAtom, useStore } from "jotai";
import { SaveIcon } from "lucide-react";
import { useState } from "react";
import { FilenameInput } from "@/components/editor/header/filename-input";
import { Button as ControlButton } from "@/components/editor/inputs/Inputs";
import { RecoveryButton } from "@/components/editor/RecoveryButton";
import { renderShortcut } from "@/components/shortcuts/renderShortcut";
import { Tooltip } from "@/components/ui/tooltip";
import { useEventListener } from "@/hooks/useEventListener";
import { useHotkey } from "@/hooks/useHotkey";
import { useImperativeModal } from "../../components/modal/ImperativeModal";
import { Button } from "../../components/ui/button";
import {
  DialogContent,
  DialogFooter,
  DialogTitle,
} from "../../components/ui/dialog";
import { Label } from "../../components/ui/label";
import { useEvent } from "../../hooks/useEvent";
import { Logger } from "../../utils/Logger";
import { getCellConfigs, getNotebook, useNotebook } from "../cells/cells";
import { notebookCells } from "../cells/utils";
import { formatAll } from "../codemirror/format";
import { autoSaveConfigAtom } from "../config/config";
import { useAutoExport } from "../export/hooks";
import { getSerializedLayout, layoutStateAtom } from "../layout/layout";
import { kioskModeAtom } from "../mode";
import { connectionAtom } from "../network/connection";
import { getSessionId } from "../kernel/session";
import { useRequestClient } from "../network/requests";
import { WebSocketState } from "../websocket/types";
import { isWasm } from "../wasm/utils";
import { filenameAtom } from "./file-state";
import { useFilename, useUpdateFilename } from "./filename";
import { lastSavedNotebookAtom, needsSaveAtom } from "./state";
import { useAutoSave } from "./useAutoSave";


interface SaveNotebookProps {
  kioskMode: boolean;
}

export const SaveComponent = ({ kioskMode }: SaveNotebookProps) => {
  const filename = useFilename();
  const needsSave = useAtomValue(needsSaveAtom);
  const closed = useAtomValue(connectionAtom).state === WebSocketState.CLOSED;
  const { saveOrNameNotebook, saveIfNotebookIsPersistent } = useSaveNotebook();
  useAutoSaveNotebook({ onSave: saveIfNotebookIsPersistent, kioskMode });

  useAutoExport();

  // Add beforeunload event listener to prevent accidental closing when there are unsaved changes
  useEventListener(window, "beforeunload", (event) => {
    // Only prevent unload if we have unsaved changes
    if (needsSave) {
      // Standard way to show a confirmation dialog before closing
      event.preventDefault();
      // Required for older browsers
      event.returnValue =
        "You have unsaved changes. Are you sure you want to leave?";
      return event.returnValue;
    }
  });

  const handleSaveClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    saveOrNameNotebook();
  };

  useHotkey("global.save", saveOrNameNotebook);

  if (closed) {
    return <RecoveryButton filename={filename} needsSave={needsSave} />;
  }

  return (
    <Tooltip content={renderShortcut("global.save")}>
      <ControlButton
        data-testid="save-button"
        id="save-button"
        shape="rectangle"
        color={needsSave ? "yellow" : "hint-green"}
        onClick={handleSaveClick}
      >
        <SaveIcon strokeWidth={1.5} size={18} />
      </ControlButton>
    </Tooltip>
  );
};

export function useSaveNotebook() {
  const { sendSave, getRunningNotebooks } = useRequestClient();
  const { openModal, closeModal, openAlert } = useImperativeModal();
  const setLastSavedNotebook = useSetAtom(lastSavedNotebookAtom);
  const updateFilename = useUpdateFilename();
  const store = useStore();

  // Save the notebook with the given filename
  const saveNotebook = useEvent(
    async (filename: string, userInitiated: boolean) => {
      const connection = store.get(connectionAtom);
      const autoSaveConfig = store.get(autoSaveConfigAtom);
      const kioskMode = store.get(kioskModeAtom);

      if (kioskMode) {
        return;
      }

      // Don't save if we are not connected to a kernel
      if (connection.state !== WebSocketState.OPEN) {
        openAlert("Failed to save notebook: not connected to a kernel.");
        return;
      }

      Logger.log("saving to ", filename);

      if (userInitiated && autoSaveConfig.format_on_save) {
        Logger.log("formatting notebook (onSave)");
        await formatAll();
      }

      // Grab the latest notebook state, after formatting
      const notebook = getNotebook();
      const cells = notebookCells(notebook);
      const cellIds = cells.map((cell) => cell.id);
      const codes = cells.map((cell) => cell.code);
      const cellNames = cells.map((cell) => cell.name);
      const configs = getCellConfigs(notebook);
      const layout = store.get(layoutStateAtom);

      // Don't save if there are no cells
      if (codes.length === 0) {
        return;
      }

      // プラン3: バックエンドから現在のファイル名（絶対パス）を取得
      let actualFilename = filename;
      try {
        const currentSessionId = getSessionId();
        const runningNotebooksResponse = await getRunningNotebooks();

        // files が存在し、配列であることを確認
        if (
          runningNotebooksResponse?.files &&
          Array.isArray(runningNotebooksResponse.files)
        ) {
          const currentSessionFile = runningNotebooksResponse.files.find(
            (f) => f?.sessionId === currentSessionId
          );

          if (currentSessionFile?.path) {
            // バックエンドから取得した絶対パスを使用
            actualFilename = currentSessionFile.path;
            Logger.log("Using absolute path from backend", {
              original: filename,
              absolute: actualFilename,
            });
          } else {
            // 新規ファイル作成時など、セッションファイルが見つからない場合
            Logger.warn(
              "Current session file not found in running notebooks, using filename from atom",
              {
                sessionId: currentSessionId,
                filename,
                availableFiles: runningNotebooksResponse.files.map((f) => ({
                  sessionId: f?.sessionId,
                  path: f?.path,
                })),
              }
            );
          }
        } else {
          Logger.warn(
            "Running notebooks response has invalid structure, using filename from atom",
            {
              sessionId: currentSessionId,
              filename,
              response: runningNotebooksResponse,
            }
          );
        }
      } catch (e) {
        // エラーが発生した場合は、元のfilenameを使用
        // worker.tsとsave-worker.tsのsaveNotebookがopts.filenameを使用するため、
        // ここでgetCurrentFilename()を呼び出す必要はない
        // Pyodide環境ではgetRunningNotebooks()が未実装であるため、エラーは予想される動作
        if (isWasm()) {
          // Pyodide環境では、getRunningNotebooks()が未実装であるため、警告を出さない
          Logger.debug(
            "getRunningNotebooks() not implemented in Pyodide environment, using filename from atom",
            {
              filename,
            }
          );
        } else {
          // 通常環境では、エラーを警告として記録
          Logger.warn(
            "Failed to get filename from backend, using filename from atom",
            {
              error: e,
              filename,
            }
          );
        }
      }

      await sendSave({
        cellIds: cellIds,
        codes,
        names: cellNames,
        filename: actualFilename,
        configs,
        layout: getSerializedLayout(),
        persist: true,
      });

      setLastSavedNotebook({
        names: cellNames,
        codes,
        configs,
        layout,
      });
    },
  );

  // Save the notebook with the current filename, only if the filename exists
  const saveIfNotebookIsPersistent = useEvent((userInitiated = false) => {
    const filename = store.get(filenameAtom);
    const connection = store.get(connectionAtom);
    if (
      isNamedPersistentFile(filename) &&
      connection.state === WebSocketState.OPEN
    ) {
      saveNotebook(filename, userInitiated);
    }
  });

  const handleSaveDialog = (pythonFilename: string) => {
    // 新規ファイル作成時: updateFilename でバックエンドにファイル名を設定してから保存
    updateFilename(pythonFilename).then((name) => {
      if (name !== null) {
        // updateFilename 完了後、バックエンドにファイル情報が反映されている可能性がある
        // saveNotebook 内で getRunningNotebooks() を呼び出すことで、最新のファイル情報を取得
        saveNotebook(name, true);
      }
    });
  };

  // Save the notebook with the current filename, or prompt the user to name
  const saveOrNameNotebook = useEvent(() => {
    const filename = store.get(filenameAtom);
    const connection = store.get(connectionAtom);
    saveIfNotebookIsPersistent(true);

    // Filename does not exist and we are connected to a kernel
    if (
      !isNamedPersistentFile(filename) &&
      connection.state !== WebSocketState.CLOSED
    ) {
      openModal(<SaveDialog onClose={closeModal} onSave={handleSaveDialog} />);
    }
  });

  return {
    saveOrNameNotebook,
    saveIfNotebookIsPersistent,
  };
}

function isNamedPersistentFile(filename: string | null): filename is string {
  return (
    filename !== null &&
    // Linux
    !filename.startsWith("/tmp") &&
    // macOS
    !filename.startsWith("/var/folders") &&
    // Windows
    !filename.includes("AppData\\Local\\Temp")
  );
}

export function useAutoSaveNotebook(opts: {
  onSave: () => void;
  kioskMode: boolean;
}) {
  const autoSaveConfig = useAtomValue(autoSaveConfigAtom);
  const notebook = useNotebook();
  const [connection] = useAtom(connectionAtom);
  const needsSave = useAtomValue(needsSaveAtom);

  const cells = notebookCells(notebook);
  const codes = cells.map((cell) => cell.code);
  const cellNames = cells.map((cell) => cell.name);
  const configs = getCellConfigs(notebook);

  useAutoSave({
    onSave: opts.onSave,
    needsSave: needsSave,
    codes: codes,
    cellConfigs: configs,
    cellNames: cellNames,
    connStatus: connection,
    config: autoSaveConfig,
    kioskMode: opts.kioskMode,
  });
}

const SaveDialog = (props: {
  onClose: () => void;
  onSave: (filename: string) => void;
}) => {
  const { onClose, onSave } = props;
  const cancelButtonLabel = "Cancel";
  const [filename, setFilename] = useState<string>();
  const handleFilenameChange = (name: string) => {
    setFilename(name);
    if (name.trim()) {
      onSave(name);
      onClose();
    }
  };

  return (
    <DialogContent>
      <DialogTitle>Save notebook</DialogTitle>
      <div className="flex flex-col">
        <Label className="text-md pt-6 px-1">Save as</Label>
        <FilenameInput
          onNameChange={handleFilenameChange}
          placeholderText="filename"
          className="missing-filename"
        />
      </div>
      <DialogFooter>
        <Button
          data-testid="cancel-save-dialog-button"
          aria-label={cancelButtonLabel}
          variant="secondary"
          onClick={onClose}
        >
          Cancel
        </Button>
        <Button
          data-testid="submit-save-dialog-button"
          aria-label="Save"
          variant="default"
          disabled={!filename}
          type="submit"
        >
          Save
        </Button>
      </DialogFooter>
    </DialogContent>
  );
};
