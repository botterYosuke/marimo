/* Copyright 2026 Marimo. All rights reserved. */

import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { TreePine, CoinsIcon } from "lucide-react";
import React, { useCallback, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tooltip } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { Button } from "../inputs/Inputs";
import { SkillTree } from "@/components/skill-tree/skill-tree";
import {
  translatedSkillsAtom,
  playerProgressAtom,
  setupSkillEventListener,
  completeSkillWithRewardAtom,
  resetProgressAtom,
  rewardNotificationAtom,
  clearRewardNotificationAtom,
  skillTreeDialogAtom,
} from "@/components/skill-tree";
import type { Skill } from "@/components/skill-tree/types";
import { useCellActions } from "@/core/cells/cells";
import { CellId } from "@/core/cells/ids";
import { maybeAddMarimoImport } from "@/core/cells/add-missing-import";
import { getRequestClient } from "@/core/network/requests";

export const SkillTreeButton: React.FC = () => {
  const [isOpen, setIsOpen] = useAtom(skillTreeDialogAtom);
  const skills = useAtomValue(translatedSkillsAtom);
  const progress = useAtomValue(playerProgressAtom);
  const completedCount = progress.completedSkills.length;
  const totalCount = skills.length;
  const { createNewCell, markTouched } = useCellActions();
  const completeSkill = useSetAtom(completeSkillWithRewardAtom);
  const resetProgress = useSetAtom(resetProgressAtom);
  const rewardNotification = useAtomValue(rewardNotificationAtom);
  const clearRewardNotification = useSetAtom(clearRewardNotificationAtom);
  const hasNewReward = rewardNotification !== null;

  // Python emit_skill() が生成する <marimo-broadcast> を検知してスキル解除
  const onSkillComplete = useCallback(
    (skillId: string) => {
      completeSkill(skillId);
    },
    [completeSkill],
  );

  useEffect(() => {
    const cleanup = setupSkillEventListener(onSkillComplete, resetProgress);
    return () => {
      cleanup();
    };
  }, [onSkillComplete, resetProgress]);

  const handleSkillClick = async (skill: Skill) => {
    if (!skill.helpContent) return;

    maybeAddMarimoImport({ autoInstantiate: true, createNewCell });

    const code = `mo.md(r"""${skill.helpContent}""")`;
    const newCellId = CellId.create();

    createNewCell({
      cellId: "__end__",
      before: false,
      code,
      lastCodeRun: code,
      newCellId,
      autoFocus: false,
      hideCode: true,
    });

    markTouched({ cellId: newCellId });

    await getRequestClient().sendRun({
      cellIds: [newCellId],
      codes: [code],
    });

    setIsOpen(false);
  };

  return (
    <>
      <Tooltip content="Skill Tree">
        <Button
          data-testid="skill-tree-button"
          onClick={() => {
            setIsOpen(true);
            clearRewardNotification();
          }}
          shape="rectangle"
          color={hasNewReward ? "yellow" : "hint-green"}
        >
          <TreePine strokeWidth={1.5} size={18} />
        </Button>
      </Tooltip>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="!max-w-[90vw] !h-[85vh] !top-[5%] !mx-0 flex flex-col">
          <DialogHeader className="flex-shrink-0 flex flex-row items-center justify-between">
            <DialogTitle>Skill Tree</DialogTitle>
            <Badge variant="secondary" className="text-xs">
              {completedCount}/{totalCount} スキル
            </Badge>
          </DialogHeader>
          <div data-testid="skill-tree-panel" className="flex-1 min-h-0">
            <SkillTree data={{ skills }} onSkillClick={handleSkillClick} />
          </div>
          <div className="flex-shrink-0 border-t pt-2 flex items-center gap-2 text-sm">
            <CoinsIcon className="w-4 h-4 text-amber-500" />
            <span className="font-medium">
              ¥{progress.currentCash.toLocaleString()}
            </span>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
