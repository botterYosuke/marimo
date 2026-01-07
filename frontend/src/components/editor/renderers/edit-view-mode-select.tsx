/* Copyright 2026 Marimo. All rights reserved. */

import { startCase } from "lodash-es";
import { Grid3x3Icon, ListIcon } from "lucide-react";
import type React from "react";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useLayoutActions, useLayoutState } from "@/core/layout/layout";
import { logNever } from "@/utils/assertNever";

type EditViewModeType = "vertical" | "grid";

const EDIT_VIEW_MODES: EditViewModeType[] = ["vertical", "grid"];

export const EditViewModeSelect: React.FC = () => {
  const { selectedLayout } = useLayoutState();
  const { setLayoutView } = useLayoutActions();

  // selectedLayoutが"vertical"または"grid"でない場合（例："slides"）、
  // "vertical"をデフォルトとして使用
  const currentLayout =
    selectedLayout === "vertical" || selectedLayout === "grid"
      ? selectedLayout
      : "vertical";

  return (
    <Select
      data-testid="edit-view-mode-select"
      value={currentLayout}
      onValueChange={(v) => setLayoutView(v as EditViewModeType)}
    >
      <SelectTrigger
        className="min-w-[110px] border-border bg-background"
        data-testid="edit-view-mode-select"
      >
        <SelectValue placeholder="Select a view" />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectLabel>View as</SelectLabel>
          {EDIT_VIEW_MODES.map((layout) => (
            <SelectItem key={layout} value={layout}>
              <div className="flex items-center gap-1.5 leading-5">
                {renderIcon(layout)}
                <span>{displayLayoutName(layout)}</span>
              </div>
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
};

function renderIcon(layoutType: EditViewModeType) {
  const Icon = getLayoutIcon(layoutType);
  return <Icon className="h-4 w-4" />;
}

function getLayoutIcon(layoutType: EditViewModeType) {
  switch (layoutType) {
    case "vertical":
      return ListIcon;
    case "grid":
      return Grid3x3Icon;
    default:
      logNever(layoutType);
      return ListIcon;
  }
}

function displayLayoutName(layoutType: EditViewModeType): string {
  return startCase(layoutType);
}

