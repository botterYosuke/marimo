/* Copyright 2026 Marimo. All rights reserved. */

import { memo, useCallback } from "react";
import { useAtomValue } from "jotai";
import { MoreHorizontalIcon, XIcon } from "lucide-react";
import { Handle, Position, type NodeProps } from "reactflow";
import { INPUTS_HANDLE_ID, OUTPUTS_HANDLE_ID } from "@/components/graph-common";
import { Cell } from "@/components/editor/notebook-cell";
import type { AppConfig, UserConfig } from "@/core/config/config-schema";
import type { AppMode } from "@/core/mode";
import type { CellId } from "@/core/cells/ids";
import type { Theme } from "@/theme/useTheme";
import {
  useCellData,
  useCellIds,
  useCellRuntime,
  useCellHandle,
} from "@/core/cells/cells";
import { displayCellName } from "@/core/cells/names";
import { isOutputEmpty } from "@/core/cells/outputs";
import { connectionAtom } from "@/core/network/connection";
import { useCellFocusActions } from "@/core/cells/focus";
import { RunButton } from "@/components/editor/cell/RunButton";
import { StopButton } from "@/components/editor/cell/StopButton";
import { CellActionsDropdown } from "@/components/editor/cell/cell-actions";
import { useRunCell } from "@/components/editor/cell/useRunCells";
import { useDeleteCellCallback } from "@/components/editor/cell/useDeleteCell";
import { ToolbarItem } from "@/components/editor/cell/toolbar";
import { isAppConnected } from "@/core/websocket/connection-utils";
import { Functions } from "@/utils/functions";
import { cn } from "@/utils/cn";
import { isMarkdownCell } from "@/core/codemirror/language/languages/markdown";
import "./cell-3d-wrapper.css";

/**
 * React Flow カスタムノードに渡されるデータ
 */
export interface CellFlowNodeData {
  cellId: CellId;
  mode: AppMode;
  userConfig: UserConfig;
  appConfig: AppConfig;
  theme: Theme;
  showPlaceholder: boolean;
  canDelete: boolean;
  isCollapsed: boolean;
  collapseCount: number;
  canMoveX: boolean;
}

/**
 * CellFlowNode
 *
 * React Flow カスタムノードとしてセルを表示する。
 * Cell3DWrapper の UI を再実装し、ドラッグは React Flow がネイティブに処理する。
 * タイトルバーが dragHandle として機能する。
 */
const CellFlowNodeInner: React.FC<NodeProps<CellFlowNodeData>> = ({ data }) => {
  const {
    cellId,
    mode,
    userConfig,
    theme,
    showPlaceholder,
    canDelete,
    isCollapsed,
    collapseCount,
    canMoveX,
  } = data;

  const cellData = useCellData(cellId);
  const isMarkdown = cellData?.code ? isMarkdownCell(cellData.code) : false;
  const cellIds = useCellIds();
  const cellIndex = cellIds.inOrderIds.indexOf(cellId);
  const cellName = displayCellName(cellData?.name ?? "_", cellIndex);

  const cellRuntime = useCellRuntime(cellId);
  const cellHandle = useCellHandle(cellId);
  const runCell = useRunCell(cellId);
  const deleteCell = useDeleteCellCallback();
  const connection = useAtomValue(connectionAtom);
  const { focusCell } = useCellFocusActions();

  const disabledOrAncestorDisabled =
    cellData?.config.disabled || cellRuntime.status === "disabled-transitively";
  const needsRun =
    cellData?.edited ||
    cellRuntime.interrupted ||
    (cellRuntime.staleInputs && !disabledOrAncestorDisabled);
  const hasOutput = !isOutputEmpty(cellRuntime.output);
  const hasConsoleOutput = cellRuntime.consoleOutputs.length > 0;
  const getEditorView = useCallback(() => {
    return cellHandle.current?.editorView ?? null;
  }, [cellHandle]);

  const handleMouseDown = useCallback(() => {
    focusCell({ cellId });
  }, [cellId, focusCell]);

  return (
    <>
      <Handle
        type="target"
        id={INPUTS_HANDLE_ID}
        position={Position.Top}
        isConnectable={false}
      />
      {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions */}
      <div
        className={cn(
          "cell-3d-wrapper floating-window",
          isMarkdown && "markdown-cell",
        )}
        data-cell-wrapper-id={cellId}
        onMouseDown={handleMouseDown}
      >
        {/* タイトルバー — dragHandle=".window-titlebar" で RF がドラッグ処理 */}
        <div
          className="window-titlebar"
          style={{ cursor: "grab", pointerEvents: "all" }}
        >
          <div className="titlebar-left">
            <span className="window-title">{cellName}</span>
          </div>
          <div className="titlebar-buttons">
            <RunButton
              edited={cellData?.edited ?? false}
              onClick={
                isAppConnected(connection.state) ? runCell : Functions.NOOP
              }
              connectionState={connection.state}
              status={cellRuntime.status}
              config={cellData?.config}
              needsRun={needsRun}
            />
            <StopButton
              status={cellRuntime.status}
              connectionState={connection.state}
            />
            <CellActionsDropdown
              cellId={cellId}
              status={cellRuntime.status}
              getEditorView={getEditorView}
              name={cellData?.name}
              config={cellData?.config}
              hasOutput={hasOutput}
              hasConsoleOutput={hasConsoleOutput}
            >
              <ToolbarItem
                variant={"green"}
                tooltip={null}
                data-testid="cell-actions-button"
              >
                <MoreHorizontalIcon strokeWidth={1.5} />
              </ToolbarItem>
            </CellActionsDropdown>
            <button
              className="titlebar-btn close"
              onClick={() => deleteCell({ cellId })}
              type="button"
              aria-label="Delete cell"
              title="Delete cell"
            >
              <XIcon size={14} />
            </button>
          </div>
        </div>

        {/* セルコンテンツ */}
        <section
          className={cn("window-content", isMarkdown && "markdown-content")}
          aria-label="Cell content"
          onMouseDown={(e) => {
            // セルコンテンツ内のクリックがRFドラッグをトリガーしないようにする
            e.stopPropagation();
            // stopPropagation で親の handleMouseDown に届かないため、ここで focusCell を呼ぶ
            focusCell({ cellId });
          }}
        >
          <Cell
            cellId={cellId}
            theme={isMarkdown ? theme : theme === "dark" ? "light" : "dark"}
            showPlaceholder={showPlaceholder}
            canDelete={canDelete}
            mode={mode}
            userConfig={userConfig}
            isCollapsed={isCollapsed}
            collapseCount={collapseCount}
            canMoveX={canMoveX}
          />
        </section>
      </div>
      <Handle
        type="source"
        id={OUTPUTS_HANDLE_ID}
        position={Position.Bottom}
        isConnectable={false}
      />
    </>
  );
};

export const CellFlowNode = memo(CellFlowNodeInner);
