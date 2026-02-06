/* Copyright 2026 Marimo. All rights reserved. */

import { atom, useAtom, useAtomValue, useSetAtom } from "jotai";
import { TreePine } from "lucide-react";
import React, { useCallback, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tooltip } from "@/components/ui/tooltip";
import { Button } from "../inputs/Inputs";
import { SkillTree } from "@/components/skill-tree/skill-tree";
import {
  skillsWithStatusAtom,
  setupSkillEventListener,
  completeSkillWithRewardAtom,
} from "@/components/skill-tree";
import type { Skill } from "@/components/skill-tree/types";
import { useCellActions } from "@/core/cells/cells";
import { CellId } from "@/core/cells/ids";
import { maybeAddMarimoImport } from "@/core/cells/add-missing-import";
import { getRequestClient } from "@/core/network/requests";

const skillTreeDialogAtom = atom(false);

export const SkillTreeButton: React.FC = () => {
  const [isOpen, setIsOpen] = useAtom(skillTreeDialogAtom);
  const skills = useAtomValue(skillsWithStatusAtom);
  const { createNewCell, markTouched } = useCellActions();
  const completeSkill = useSetAtom(completeSkillWithRewardAtom);

  // Python emit_skill() が生成する <marimo-broadcast> を検知してスキル解除
  const onSkillComplete = useCallback(
    (skillId: string) => {
      completeSkill(skillId);
    },
    [completeSkill],
  );

  useEffect(() => {
    const cleanup = setupSkillEventListener(onSkillComplete);
    return () => {
      cleanup();
    };
  }, [onSkillComplete]);

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
          onClick={() => setIsOpen(true)}
          shape="rectangle"
          color="hint-green"
        >
          <TreePine strokeWidth={1.5} size={18} />
        </Button>
      </Tooltip>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="!max-w-[90vw] !h-[85vh] !top-[5%] !mx-0 flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle>Skill Tree</DialogTitle>
          </DialogHeader>
          <div className="flex-1 min-h-0">
            <SkillTree data={{ skills }} onSkillClick={handleSkillClick} />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
