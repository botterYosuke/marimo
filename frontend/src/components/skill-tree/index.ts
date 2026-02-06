/* Copyright 2026 Marimo. All rights reserved. */

// Types
export type {
  Skill,
  SkillId,
  SkillStatus,
  SkillCategory,
  SkillTrack,
  SkillReward,
  RewardType,
  SkillNodeData,
  SkillTreeData,
  SkillSelection,
  PlayerProgress,
  PlayerStats,
  PlayerRank,
  Milestone,
  GameProgress,
} from "./types";

// Data
export { skillDefinitions, milestones } from "./skill-data";

// Injection Templates
export {
  injectionTemplates,
  getInjectionTemplate,
  getInjectableSkillIds,
} from "./injection-templates";
export type { CellTemplate, InjectionTemplate } from "./injection-templates";

// Skill Complete Handler
export {
  handleSkillComplete,
  loadProgressFromNotebook,
  setupSkillEventListener,
} from "./skill-complete-handler";

// Atoms
export {
  playerProgressAtom,
  skillDefinitionsAtom,
  skillsWithStatusAtom,
  completeSkillAtom,
  currentTrackAtom,
  resetProgressAtom,
  // Reward notification atoms
  rewardNotificationAtom,
  clearRewardNotificationAtom,
  completeSkillWithRewardAtom,
} from "./atoms";
export type { RewardNotificationData } from "./atoms";

// Elements & Layout
export {
  SKILL_NODE_WIDTH,
  SKILL_NODE_HEIGHT,
  TRACK_OFFSETS,
  TRACK_INFO,
  createSkillElements,
} from "./elements";

// Components
export { SkillTree } from "./skill-tree";
export { SkillTreeGraph } from "./skill-tree-graph";
export { SkillNode, skillNodeTypes, categoryColors } from "./skill-node";
export { SkillDetailPanel } from "./skill-detail-panel";
export { TrackHeader, TrackSummary } from "./track-header";
export { SandboxIndicator } from "./sandbox-indicator";
export { BridgeIndicator } from "./bridge-indicator";
export { TrackSwitcher } from "./track-switcher";

// Reward System
export {
  calculateSkillReward,
  checkMilestone,
  calculateTotalRewards,
  getNextMilestone,
  getMilestoneProgress,
} from "./rewards/reward-system";
export type { RewardResult } from "./rewards/reward-system";
export { showSkillRewardToast } from "./rewards/skill-reward-toast";
export { RewardSummary } from "./rewards/reward-summary";
