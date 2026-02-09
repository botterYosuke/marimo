# Skill-Tree 多言語対応（スキルデータ title / description のみ）

## Context

skill-tree システムの59スキルの `title` と `description` を日本語(ja)・英語(en)・中国語(zh)の3言語に対応させる。UIテキスト（ボタン、ラベル、セクション見出し等）や `helpContent` は翻訳対象外。

現状、marimoのi18n基盤はReact Ariaによるロケール書式（数値・日付）のみで、テキスト翻訳の仕組みはない。外部ライブラリを追加せず、Jotai atomの派生パターンで軽量に実装する。

## 方針

- `skill-data.ts` （日本語のソースオブトゥルース）は変更しない
- 新規の翻訳ファイル（en.ts, zh.ts）にスキルID→{title, description}のマッピングを定義
- 既存の `localeAtom` からロケールを読み、`translatedSkillsAtom` で翻訳済みスキルリストを返す
- 各コンシューマは `skillsWithStatusAtom` → `translatedSkillsAtom` に切り替えるだけ

## 新規作成ファイル（5ファイル）

### 1. `frontend/src/components/skill-tree/i18n/types.ts`
```typescript
export type SupportedLocale = "ja" | "en" | "zh";

export interface SkillTranslation {
  title: string;
  description: string;
}

export interface MilestoneTranslation {
  title: string;
}

export interface SkillTranslationMap {
  skills: Record<string, SkillTranslation>;
  milestones: Record<number, MilestoneTranslation>;
}
```

### 2. `frontend/src/components/skill-tree/i18n/en.ts`
59スキルの英語翻訳 + 5マイルストーンのタイトル翻訳。

### 3. `frontend/src/components/skill-tree/i18n/zh.ts`
59スキルの中国語翻訳 + 5マイルストーンのタイトル翻訳。

### 4. `frontend/src/components/skill-tree/i18n/index.ts`
- `normalizeLocale(locale)`: `"en-US"` → `"en"`, `"zh-CN"` → `"zh"`, 不明 → `"ja"`
- `getTranslationMap(locale)`: `"ja"` → `undefined`（翻訳不要）、`"en"` / `"zh"` → 対応マップ

### 5. `frontend/src/components/skill-tree/i18n/use-skill-translation.ts`
Props経由でスキルを受け取るコンポーネント用のフック（必要に応じて使用）。

## 変更ファイル（6ファイル）

### 6. `frontend/src/components/skill-tree/atoms.ts`
- `translatedSkillsAtom` を追加（`skillsWithStatusAtom` + `localeAtom` → 翻訳済みスキル配列）
- `completeSkillWithRewardAtom` 内のトースト用 `skillTitle` を翻訳対応

### 7. `frontend/src/components/skill-tree/index.ts`
- `translatedSkillsAtom` をエクスポートに追加

### 8-12. コンシューマ5ファイル（`skillsWithStatusAtom` → `translatedSkillsAtom` に変更）
| ファイル | 変更内容 |
|---------|---------|
| `editor/chrome/panels/skill-tree-panel.tsx` | import と useAtomValue を切替 |
| `editor/controls/skill-tree-button.tsx` | import と useAtomValue を切替 |
| `skill-tree/sandbox-indicator.tsx` | import と useAtomValue を切替 |
| `skill-tree/bridge-indicator.tsx` | import と useAtomValue を切替 |
| `skill-tree/track-switcher.tsx` | import と useAtomValue を切替 |

## 変更不要のコンポーネント

| ファイル | 理由 |
|---------|------|
| `skill-node.tsx` | 親からprops経由で翻訳済みskillを受け取る |
| `skill-detail-panel.tsx` | 親からprops経由で翻訳済みskillを受け取る |
| `skill-tree.tsx` / `skill-tree-graph.tsx` | パススルー |
| `reward-summary.tsx` | `PlayerProgress` の保存済み文字列を表示（対象外）|
| `skill-data.ts` | ソースオブトゥルース、変更なし |
| `types.ts` | 型定義変更なし |

## 実装順

1. `i18n/types.ts` 作成
2. `i18n/en.ts` 作成（59スキル + 5マイルストーン英訳）
3. `i18n/zh.ts` 作成（59スキル + 5マイルストーン中訳）
4. `i18n/index.ts` 作成（normalizeLocale, getTranslationMap）
5. `i18n/use-skill-translation.ts` 作成
6. `atoms.ts` に `translatedSkillsAtom` 追加
7. `index.ts` エクスポート追加
8. コンシューマ5ファイルを切替
9. テスト追加・既存テスト確認

## テスト

### 新規テスト: `__tests__/i18n.test.ts`
- `normalizeLocale` の各パターン（"en-US"→"en", "zh-CN"→"zh", null→"ja"等）
- 全59スキルIDが en/zh 翻訳マップに存在すること（完全性チェック）
- 空の title/description がないこと

### 検証方法
1. `npm test` で既存テスト + 新規テストが通ること
2. ブラウザでロケールを en / zh に変更し、スキルツリーのノード表示が切り替わること
3. ja ロケール（デフォルト）で従来通りの日本語表示が維持されること

## 注意点

- `PlayerProgress.earnedTitles` はローカルストレージに日本語で保存される。ロケール切替後も保存済みの称号は日本語のまま（将来のマイグレーション課題）
- `reward.description`（"+30,000円" 等）は翻訳対象外。スキルタイトルが英語でも報酬表記は日本語のままとなるが、要件通り
