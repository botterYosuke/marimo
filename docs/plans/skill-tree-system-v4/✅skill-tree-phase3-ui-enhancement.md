# Phase 3: UI強化

**想定日数**: 4-5日
**優先度**: P0
**依存**: Phase 1（データモデル）
**ステータス**: ✅ 完了（2026-02-03）

---

## 実装状況サマリー

| 項目 | ステータス |
|------|-----------|
| skill-node.tsx カテゴリ色追加 | ✅ 完了 |
| skill-node.tsx 難易度スター追加 | ✅ 完了 |
| elements.ts トラック別レイアウト | ✅ 完了 |
| skill-detail-panel.tsx 新規作成 | ✅ 完了 |
| track-header.tsx 新規作成 | ✅ 完了 |
| skill-tree.css アニメーション追加 | ✅ 完了 |
| skill-tree-graph.tsx layoutElements削除 | ✅ 完了 |
| index.ts エクスポート更新 | ✅ 完了 |
| injection-templates.ts 構文エラー修正 | ✅ 完了 |
| 型チェック（skill-tree関連） | ✅ パス |

---

## 新たな知見

### 1. Dagre レイアウトの二重適用問題
計画書では `layoutElements()` と `elements.ts` の両方でレイアウトを行う想定だったが、実際には **elements.ts 内で完結させる** 方が効率的。`skill-tree-graph.tsx` から `layoutElements()` のインポートを削除し、`createSkillElements()` で直接位置計算を行うように変更。

### 2. テンプレートリテラルの罠
`injection-templates.ts` でテンプレートリテラル内に Python コードブロック（\`\`\`python）を含めると、TypeScript がバッククォートを誤認識して構文エラーになる。
- **解決策**: 配列の `.join("\n")` で文字列を構築

```typescript
// NG: テンプレートリテラル内のバッククォート
code: `mo.md('''
\`\`\`python
bt.buy()
\`\`\`
''')`

// OK: 配列で構築
code: [
  "mo.md('''",
  "```python",
  "bt.buy()",
  "```",
  "''')"
].join("\n")
```

### 3. React インポートの不要化
React 17+ の新 JSX Transform を使用している場合、JSX ファイルで `import React from "react"` は不要。型チェックで `TS6133: 'React' is declared but its value is never read` エラーが出る。

### 4. JSON.parse の unknown 型
TypeScript の strict モードでは `JSON.parse()` の戻り値が `unknown` 型になる。型アサーションが必要:
```typescript
const data = JSON.parse(decoded) as { skill_id?: string };
```

---

## 設計変更

### 1. レイアウト方式の簡素化
計画書では Dagre ライブラリを直接使用する想定だったが、既存の依存関係グラフとの整合性を考慮し、**独自の簡易レイアウト関数**を実装。

```typescript
// 計画書: Dagre を直接使用
import dagre from "@dagrejs/dagre";
const dagreGraph = new dagre.graphlib.Graph();

// 実装: 独自の階層計算（前提条件ベース）
function layoutTrackSkills(skills, yOffset) {
  const levels = new Map<string, number>();
  function getLevel(skillId) { /* 再帰的に階層計算 */ }
  // ...
}
```

### 2. ノードサイズの調整
計画書: `SKILL_NODE_WIDTH = 220`, `SKILL_NODE_HEIGHT = 120`
実装: `SKILL_NODE_WIDTH = 200`, `SKILL_NODE_HEIGHT = 100`

既存の 180x90 から若干拡大しつつ、詳細パネルとのバランスを考慮。

### 3. トラックオフセットの調整
計画書: `sandbox: 0, bridge: 600, full: 1200`
実装: `sandbox: 0, bridge: 800, full: 1600`

59スキルのレイアウトを実際に確認し、トラック間の余白を確保。

### 4. TrackHeader の設計変更
計画書では ReactFlow の上にオーバーレイとして配置する想定だったが、**スタンドアロンコンポーネント**として実装。`TrackSummary` を追加し、全トラックの進捗を一覧表示可能に。

### 5. categoryColors のエクスポート
`skill-detail-panel.tsx` でも使用するため、`skill-node.tsx` から `export const categoryColors` としてエクスポート。

---

## Tips

### 1. 型チェックの実行
```bash
cd /d/Documents/marimo/frontend && pnpm typecheck
```
skill-tree 関連以外のエラー（backcastpro-loader.ts, download.test.tsx 等）は既存の問題。

### 2. スターコンポーネントのサイズ
ノード内では `w-2 h-2`、詳細パネルでは `w-3.5 h-3.5` と使い分け。

### 3. エッジのアニメーション
`animated: targetStatus === "unlocked"` で unlocked 状態のエッジのみアニメーション。CSS の `@keyframes edge-flow` と連動。

### 4. クロストラックエッジのスタイル
トラック間を跨ぐエッジは `strokeWidth: 3`, `strokeDasharray: "8,4"` で強調。

### 5. Progress コンポーネント
Radix UI の `Progress` を使用。`@/components/ui/progress` からインポート。

---

## 1. ゴール

- カテゴリ別の色分け表示
- 難易度インジケーター（★）
- 複数報酬の表示対応
- トラック分割レイアウト
- スキル詳細パネル

---

## 2. カテゴリカラースキーム

```typescript
export const categoryColors: Record<SkillCategory, string> = {
  sandbox: "#4ade80",   // green-400
  bridge: "#60a5fa",    // blue-400
  fail: "#f87171",      // red-400
  setup: "#a78bfa",     // violet-400
  data: "#fbbf24",      // amber-400
  set: "#fb923c",       // orange-400
  trade: "#22d3ee",     // cyan-400
  chart: "#e879f9",     // fuchsia-400
  indicator: "#818cf8", // indigo-400
  risk: "#f472b6",      // pink-400
};
```

---

## 3. 修正/作成ファイル

### 3.1 スキルノードの強化

**ファイル**: `D:\Documents\marimo\frontend\src\components\skill-tree\skill-node.tsx`

```typescript
/* Copyright 2026 Marimo. All rights reserved. */

import React, { memo } from "react";
import { Handle, Position, type NodeProps } from "reactflow";
import {
  LockIcon,
  CheckCircle2Icon,
  CircleIcon,
  GiftIcon,
  StarIcon,
} from "lucide-react";
import { cn } from "@/utils/cn";
import { Badge } from "@/components/ui/badge";
import {
  INPUTS_HANDLE_ID,
  OUTPUTS_HANDLE_ID,
} from "@/components/graph-common";
import type { SkillNodeData, SkillStatus, SkillCategory } from "./types";
import { SKILL_NODE_HEIGHT, SKILL_NODE_WIDTH } from "./elements";

export type SkillNodeProps = NodeProps<SkillNodeData>;

// カテゴリカラー
const categoryColors: Record<SkillCategory, string> = {
  sandbox: "#4ade80",
  bridge: "#60a5fa",
  fail: "#f87171",
  setup: "#a78bfa",
  data: "#fbbf24",
  set: "#fb923c",
  trade: "#22d3ee",
  chart: "#e879f9",
  indicator: "#818cf8",
  risk: "#f472b6",
};

// ステータス設定
const statusConfig: Record<
  SkillStatus,
  { icon: React.ReactNode; className: string; handleColor: string }
> = {
  locked: {
    icon: <LockIcon className="w-4 h-4" />,
    className: "opacity-50 bg-muted border-muted-foreground/30",
    handleColor: "var(--gray-5)",
  },
  unlocked: {
    icon: <CircleIcon className="w-4 h-4" />,
    className: "bg-card border-primary/50 shadow-md",
    handleColor: "var(--gray-5)",
  },
  completed: {
    icon: <CheckCircle2Icon className="w-4 h-4 text-green-500" />,
    className: "bg-card border-green-500/50",
    handleColor: "var(--green-9)",
  },
};

// 難易度スター
function DifficultyStars({ level }: { level: number }) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <StarIcon
          key={i}
          className={cn(
            "w-3 h-3",
            i < level ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"
          )}
        />
      ))}
    </div>
  );
}

// 報酬バッジ（複数対応）
function RewardBadges({ rewards, completed }: {
  rewards: SkillNodeData["skill"]["reward"];
  completed: boolean;
}) {
  // 最初の報酬のみ表示（スペース節約）
  const primaryReward = rewards[0];
  const hasMore = rewards.length > 1;

  return (
    <div className="flex items-center gap-1">
      <Badge
        variant={completed ? "success" : "outline"}
        className="text-xs truncate max-w-[140px]"
      >
        {primaryReward.description}
      </Badge>
      {hasMore && (
        <Badge variant="secondary" className="text-xs">
          +{rewards.length - 1}
        </Badge>
      )}
    </div>
  );
}

export const SkillNode = memo((props: SkillNodeProps) => {
  const { data, selected } = props;
  const { skill } = data;
  const config = statusConfig[skill.status];
  const categoryColor = categoryColors[skill.category];

  return (
    <div>
      {/* Input handle */}
      <Handle
        type="target"
        id={INPUTS_HANDLE_ID}
        position={Position.Top}
        style={{ background: config.handleColor }}
      />

      {/* Skill card */}
      <div
        className={cn(
          "flex flex-col border rounded-lg overflow-hidden transition-all",
          config.className,
          selected && "ring-2 ring-primary",
        )}
        style={{
          width: SKILL_NODE_WIDTH,
          minHeight: SKILL_NODE_HEIGHT,
          borderLeftWidth: 4,
          borderLeftColor: categoryColor,
        }}
      >
        {/* Header */}
        <div className="flex items-center gap-2 px-3 py-2 bg-muted/50 border-b">
          {config.icon}
          <span className="font-semibold text-sm truncate flex-1">
            {skill.title}
          </span>
          <DifficultyStars level={skill.difficulty} />
        </div>

        {/* Description */}
        <div className="px-3 py-2 flex-1">
          <p className="text-xs text-muted-foreground line-clamp-2">
            {skill.description}
          </p>
        </div>

        {/* Reward section */}
        <div className="px-3 py-2 border-t bg-muted/30 flex items-center gap-2">
          <GiftIcon className="w-3 h-3 text-amber-500 flex-shrink-0" />
          <RewardBadges
            rewards={skill.reward}
            completed={skill.status === "completed"}
          />
        </div>
      </div>

      {/* Output handle */}
      <Handle
        type="source"
        id={OUTPUTS_HANDLE_ID}
        position={Position.Bottom}
        style={{ background: config.handleColor }}
      />
    </div>
  );
});

SkillNode.displayName = "SkillNode";

export const skillNodeTypes = {
  skill: SkillNode,
};
```

---

### 3.2 グラフレイアウトの改善

**ファイル**: `D:\Documents\marimo\frontend\src\components\skill-tree\elements.ts`

```typescript
/* Copyright 2026 Marimo. All rights reserved. */

import type { Node, Edge } from "reactflow";
import dagre from "@dagrejs/dagre";
import type { Skill, SkillNodeData, SkillTrack } from "./types";
import { INPUTS_HANDLE_ID, OUTPUTS_HANDLE_ID } from "@/components/graph-common";

export const SKILL_NODE_WIDTH = 220;
export const SKILL_NODE_HEIGHT = 120;

// トラック別のY座標オフセット
const TRACK_OFFSETS: Record<SkillTrack, number> = {
  sandbox: 0,
  bridge: 600,
  full: 1200,
};

export function createSkillElements(skills: Skill[]): {
  nodes: Node<SkillNodeData>[];
  edges: Edge[];
} {
  // トラック別にグループ化
  const skillsByTrack = {
    sandbox: skills.filter((s) => s.track === "sandbox"),
    bridge: skills.filter((s) => s.track === "bridge"),
    full: skills.filter((s) => s.track === "full"),
  };

  const allNodes: Node<SkillNodeData>[] = [];
  const allEdges: Edge[] = [];

  // 各トラックを個別にレイアウト
  for (const [track, trackSkills] of Object.entries(skillsByTrack)) {
    if (trackSkills.length === 0) continue;

    const { nodes, edges } = layoutTrack(
      trackSkills,
      track as SkillTrack,
      TRACK_OFFSETS[track as SkillTrack]
    );

    allNodes.push(...nodes);
    allEdges.push(...edges);
  }

  // トラック間のエッジを追加
  const crossTrackEdges = createCrossTrackEdges(skills);
  allEdges.push(...crossTrackEdges);

  return { nodes: allNodes, edges: allEdges };
}

function layoutTrack(
  skills: Skill[],
  track: SkillTrack,
  yOffset: number
): { nodes: Node<SkillNodeData>[]; edges: Edge[] } {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));
  dagreGraph.setGraph({
    rankdir: "TB",
    nodesep: 50,
    ranksep: 80,
    marginx: 20,
    marginy: 20,
  });

  // ノードを追加
  for (const skill of skills) {
    dagreGraph.setNode(skill.id, {
      width: SKILL_NODE_WIDTH,
      height: SKILL_NODE_HEIGHT,
    });
  }

  // 同トラック内のエッジを追加
  for (const skill of skills) {
    for (const prereq of skill.prerequisites) {
      const prereqSkill = skills.find((s) => s.id === prereq);
      if (prereqSkill && prereqSkill.track === track) {
        dagreGraph.setEdge(prereq, skill.id);
      }
    }
  }

  dagre.layout(dagreGraph);

  // ノードを生成
  const nodes: Node<SkillNodeData>[] = skills.map((skill) => {
    const node = dagreGraph.node(skill.id);
    return {
      id: skill.id,
      type: "skill",
      position: {
        x: node.x - SKILL_NODE_WIDTH / 2,
        y: node.y - SKILL_NODE_HEIGHT / 2 + yOffset,
      },
      data: { skill },
    };
  });

  // エッジを生成
  const edges: Edge[] = [];
  for (const skill of skills) {
    for (const prereq of skill.prerequisites) {
      const prereqSkill = skills.find((s) => s.id === prereq);
      if (prereqSkill && prereqSkill.track === track) {
        edges.push(createSkillEdge(prereq, skill.id, skill.status));
      }
    }
  }

  return { nodes, edges };
}

function createCrossTrackEdges(skills: Skill[]): Edge[] {
  const edges: Edge[] = [];

  for (const skill of skills) {
    for (const prereq of skill.prerequisites) {
      const prereqSkill = skills.find((s) => s.id === prereq);
      if (prereqSkill && prereqSkill.track !== skill.track) {
        edges.push(createSkillEdge(prereq, skill.id, skill.status, true));
      }
    }
  }

  return edges;
}

function createSkillEdge(
  source: string,
  target: string,
  targetStatus: Skill["status"],
  isCrossTrack = false
): Edge {
  return {
    id: `${source}-${target}`,
    source,
    target,
    sourceHandle: OUTPUTS_HANDLE_ID,
    targetHandle: INPUTS_HANDLE_ID,
    type: "smoothstep",
    animated: targetStatus === "unlocked",
    style: {
      stroke: targetStatus === "completed"
        ? "var(--green-9)"
        : targetStatus === "unlocked"
          ? "var(--blue-9)"
          : "var(--gray-5)",
      strokeWidth: isCrossTrack ? 3 : 2,
      strokeDasharray: isCrossTrack ? "8,4" : undefined,
    },
  };
}
```

---

### 3.3 スキル詳細パネル（新規）

**ファイル**: `D:\Documents\marimo\frontend\src\components\skill-tree\skill-detail-panel.tsx`

```typescript
/* Copyright 2026 Marimo. All rights reserved. */

import React from "react";
import { useAtomValue } from "jotai";
import {
  CheckCircle2Icon,
  CircleIcon,
  LockIcon,
  StarIcon,
  GiftIcon,
  BookOpenIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/utils/cn";
import type { Skill } from "./types";
import { categoryColors } from "./skill-node";

interface SkillDetailPanelProps {
  skill: Skill | null;
  onInsertHelp?: (content: string) => void;
}

export function SkillDetailPanel({
  skill,
  onInsertHelp,
}: SkillDetailPanelProps) {
  if (!skill) {
    return (
      <div className="p-4 text-center text-muted-foreground">
        スキルを選択してください
      </div>
    );
  }

  const statusIcon = {
    locked: <LockIcon className="w-5 h-5 text-muted-foreground" />,
    unlocked: <CircleIcon className="w-5 h-5 text-blue-500" />,
    completed: <CheckCircle2Icon className="w-5 h-5 text-green-500" />,
  }[skill.status];

  const statusLabel = {
    locked: "ロック中",
    unlocked: "挑戦可能",
    completed: "達成済み",
  }[skill.status];

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div
          className="w-2 h-full rounded-full"
          style={{ backgroundColor: categoryColors[skill.category] }}
        />
        <div className="flex-1">
          <h3 className="text-lg font-semibold">{skill.title}</h3>
          <p className="text-sm text-muted-foreground">{skill.description}</p>
        </div>
      </div>

      {/* Status */}
      <div className="flex items-center gap-2">
        {statusIcon}
        <span className="text-sm">{statusLabel}</span>
        <div className="flex-1" />
        <div className="flex gap-0.5">
          {Array.from({ length: 5 }).map((_, i) => (
            <StarIcon
              key={i}
              className={cn(
                "w-4 h-4",
                i < skill.difficulty
                  ? "fill-amber-400 text-amber-400"
                  : "text-muted-foreground/30"
              )}
            />
          ))}
        </div>
      </div>

      {/* Rewards */}
      <div className="space-y-2">
        <h4 className="text-sm font-medium flex items-center gap-2">
          <GiftIcon className="w-4 h-4 text-amber-500" />
          報酬
        </h4>
        <div className="space-y-1">
          {skill.reward.map((reward, i) => (
            <div
              key={i}
              className="flex items-center gap-2 text-sm bg-muted/50 rounded px-2 py-1"
            >
              <Badge variant="outline" className="text-xs">
                {reward.type}
              </Badge>
              <span>{reward.description}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Help Content */}
      {skill.helpContent && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium flex items-center gap-2">
            <BookOpenIcon className="w-4 h-4" />
            ヘルプ
          </h4>
          <div className="text-sm bg-muted/30 rounded p-3 max-h-48 overflow-y-auto prose prose-sm dark:prose-invert">
            {/* Markdown rendering would go here */}
            <pre className="whitespace-pre-wrap text-xs">
              {skill.helpContent}
            </pre>
          </div>
          {onInsertHelp && skill.status === "unlocked" && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => onInsertHelp(skill.helpContent!)}
            >
              ノートブックに挿入
            </Button>
          )}
        </div>
      )}

      {/* Prerequisites */}
      {skill.prerequisites.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium">前提スキル</h4>
          <div className="flex flex-wrap gap-1">
            {skill.prerequisites.map((prereq) => (
              <Badge key={prereq} variant="secondary" className="text-xs">
                {prereq}
              </Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
```

---

### 3.4 トラックヘッダー（新規）

**ファイル**: `D:\Documents\marimo\frontend\src\components\skill-tree\track-header.tsx`

```typescript
/* Copyright 2026 Marimo. All rights reserved. */

import React from "react";
import { Badge } from "@/components/ui/badge";
import type { SkillTrack } from "./types";

interface TrackHeaderProps {
  track: SkillTrack;
  completed: number;
  total: number;
  yPosition: number;
}

const trackConfig: Record<SkillTrack, { title: string; description: string }> = {
  sandbox: {
    title: "サンドボックス",
    description: "即座に楽しい",
  },
  bridge: {
    title: "ブリッジ",
    description: "段階的に理解",
  },
  full: {
    title: "フルモード",
    description: "マスタリー",
  },
};

export function TrackHeader({
  track,
  completed,
  total,
  yPosition,
}: TrackHeaderProps) {
  const config = trackConfig[track];
  const progress = total > 0 ? (completed / total) * 100 : 0;

  return (
    <div
      className="absolute left-4 bg-background/80 backdrop-blur-sm rounded-lg p-3 border shadow-sm"
      style={{ top: yPosition }}
    >
      <div className="flex items-center gap-2">
        <h3 className="font-semibold">{config.title}</h3>
        <Badge variant="secondary" className="text-xs">
          {completed}/{total}
        </Badge>
      </div>
      <p className="text-xs text-muted-foreground">{config.description}</p>
      <div className="mt-2 h-1 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full bg-primary transition-all"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}
```

---

## 4. CSSの追加

**ファイル**: `D:\Documents\marimo\frontend\src\components\skill-tree\skill-tree.css`

```css
/* トラック区切り線 */
.skill-tree-track-divider {
  position: absolute;
  left: 0;
  right: 0;
  height: 2px;
  background: linear-gradient(
    to right,
    transparent,
    var(--border) 20%,
    var(--border) 80%,
    transparent
  );
}

/* ノードのホバーエフェクト */
.react-flow__node-skill:hover {
  z-index: 10 !important;
}

.react-flow__node-skill:hover > div {
  transform: scale(1.02);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

/* アンロック時のアニメーション */
@keyframes skill-unlock {
  0% {
    transform: scale(0.95);
    opacity: 0.5;
  }
  50% {
    transform: scale(1.05);
  }
  100% {
    transform: scale(1);
    opacity: 1;
  }
}

.skill-node-unlocked {
  animation: skill-unlock 0.3s ease-out;
}

/* 完了時のグロー */
.skill-node-completed {
  box-shadow: 0 0 0 2px var(--green-5), 0 0 12px var(--green-5);
}
```

---

## 5. タスク一覧

| # | タスク | ファイル | 詳細 | ステータス |
|---|-------|---------|------|-----------|
| 3.1 | SkillNode拡張 | `skill-node.tsx` | カテゴリ色、難易度、複数報酬 | ✅ |
| 3.2 | elements.ts更新 | `elements.ts` | トラック別レイアウト | ✅ |
| 3.3 | 詳細パネル作成 | `skill-detail-panel.tsx` | 報酬、ヘルプ表示 | ✅ |
| 3.4 | トラックヘッダー | `track-header.tsx` | 進捗バー付きヘッダー | ✅ |
| 3.5 | CSS追加 | `skill-tree.css` | アニメーション、エフェクト | ✅ |
| 3.6 | グラフ統合 | `skill-tree-graph.tsx` | layoutElements削除、直接レイアウト | ✅ |
| 3.7 | index.ts更新 | `index.ts` | 新コンポーネントエクスポート | ✅ |
| 3.8 | injection-templates修正 | `injection-templates.ts` | テンプレートリテラル構文エラー修正 | ✅ |

---

## 6. テスト戦略

### 6.1 ビジュアルテスト

- Storybookでコンポーネント確認
- 各ステータス（locked/unlocked/completed）の表示
- 各カテゴリの色表示

### 6.2 レスポンシブテスト

- パネル内での表示確認
- ズーム/パン操作の確認

---

## 7. 完了条件

- [x] 全カテゴリの色分けが正しく表示 ✅
- [x] 難易度★が1-5で表示 ✅
- [x] 複数報酬が「+N」形式で表示 ✅
- [x] トラック別にグループ化されている ✅
- [x] 詳細パネルでスキル情報が表示 ✅
- [x] アニメーションが正しく動作 ✅

---

## 8. 次のフェーズへの引き継ぎ

Phase 3完了後、以下が利用可能になる：

### 新規エクスポート（`@/components/skill-tree`から）

**Constants:**
- `categoryColors`: 10カテゴリのカラーマップ
- `TRACK_OFFSETS`: トラック別Y座標オフセット
- `TRACK_INFO`: トラック別タイトル・説明

**Components:**
- `SkillDetailPanel`: スキル詳細表示パネル
- `TrackHeader`: トラック進捗ヘッダー
- `TrackSummary`: 全トラック進捗サマリー

**Functions:**
- `createSkillElements()`: トラック別レイアウト済みノード・エッジ生成

### Phase 4で必要な作業

1. サンドボックスモードの初期セル定義
2. `SkillDetailPanel` をパネルUIに統合
3. スキル完了時のアニメーショントリガー
4. トラック間ナビゲーションの実装
