/* Copyright 2026 Marimo. All rights reserved. */

import React from "react";
import { ReactFlowProvider } from "reactflow";
import { SkillTreeGraph } from "./skill-tree-graph";
import type { Skill, SkillTreeData } from "./types";

import "reactflow/dist/style.css";
import "./skill-tree.css";

interface Props {
  data: SkillTreeData;
  onSkillClick?: (skill: Skill) => void;
}

export const SkillTree: React.FC<Props> = ({ data, onSkillClick }) => {
  return (
    <div className="w-full h-full">
      <ReactFlowProvider>
        <SkillTreeGraph data={data} onSkillClick={onSkillClick} />
      </ReactFlowProvider>
    </div>
  );
};
