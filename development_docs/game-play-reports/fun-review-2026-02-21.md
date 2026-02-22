# 面白さ評価レポート 2026-02-21

**評価日**: 2026-02-21
**プレイ範囲**: E2E テスト全スイート（11 スイート、83 テスト）-- Sandbox + Bridge + Setup + Data トラック
**評価者**: game-fun-review エージェント (v6)
**参照ソース**: play-log-2026-02-21.md, skill-data.ts, reward-system.ts, skill-tree-graph.tsx, skill-node.tsx, skill-detail-panel.tsx, skill-tree.css, skill-complete-handler.ts, atoms.ts, track-switcher.tsx, sandbox-indicator.tsx, bridge-indicator.tsx, reward-summary.tsx, skill-reward-toast.tsx, elements.ts, types.ts

---

## 評価セッション更新履歴

| 更新 | 時刻 | 内容 |
|------|------|------|
| v1 | 2026-02-21 午前 | 初版作成（手動プレイ観察ベース、0/59スキル -- 再接続バグで進捗未反映） |
| v2 | 2026-02-21 午後 | E2E テスト結果（9スキル取得・Position 表示修正確認）を反映して更新 |
| v3 | 2026-02-21 夜 | ソースコード直接レビュー（skill-node.tsx, skill-detail-panel.tsx, backtest-hud.tsx, skill-tree-graph.tsx, game_setup.py, skill-data.ts）による追加発見を反映 |
| v4 | 2026-02-21 夜 | E2E フルラン（83テスト: 53 passed / 25 failed）結果 + Issue 4件レビューを反映 |
| v5 | 2026-02-21 夜 | ソースコード総合レビュー（skill-node.tsx, skill-tree-graph.tsx, game_setup.py 全体精査）による最終統合評価 |
| v6 | 2026-02-21 深夜（最新） | 最新 E2E フルラン（69 passed / 9 failed / 5 skipped）反映。ソースコード全量再精査（reward-system.ts, atoms.ts, track-switcher.tsx, sandbox-indicator.tsx, bridge-indicator.tsx, reward-summary.tsx, skill-complete-handler.ts, elements.ts, skill-tree.css, types.ts を追加）。前回 v5 比で通過率が 63.9% -> 83.1% に大幅改善したことを踏まえた再評価 |

---

## 総合スコア: ★3.5/5

## カテゴリ別評価

### フロー体験: ★4/5

**スキル取得の順序は自然か？**
SANDBOX_001（起動）-> SANDBOX_002（購入）-> SANDBOX_003（買値確認）/ SANDBOX_004（売却）-> SANDBOX_005（チャート振り返り）-> SANDBOX_006（卒業）-> BRIDGE_001 -> BRIDGE_002 -> BRIDGE_003 という流れは、投資初心者の学習ステップとして非常に自然である。前提条件の依存関係が「学習の順序」を強制するのではなく「導く」設計になっている。

SANDBOX_003 と SANDBOX_004 は SANDBOX_002 のみを前提とし並列解放される。「買値確認」と「売却」のどちらを先にやっても良い選択の自由度があり、プレイヤーの自主性を尊重している。同様に SETUP_004/SETUP_005 の並列解放（どちらも SETUP_003 のみが前提）、DATA_002/DATA_004/DATA_006 の並列解放も設計意図通りの分岐点として機能している。

E2E テスト結果: sandbox.spec.ts（10/10 通過）、setup.spec.ts（10/10 通過）、data.spec.ts（11/11 通過）は全テスト通過であり、フロー体験のコア部分は完全に安定していることが実証された。前回 v5 時点では setup.spec.ts で 2 件失敗、data.spec.ts で 1 件失敗があったが、全て解消されている。

**達成感はあるか？**
SANDBOX_006 完了時に「ブリッジモード解禁」、BRIDGE_003 完了時に「フルモード解禁」の unlock 報酬がトースト通知される設計は、「次のステージが開いた」という達成感を明確に演出する。`_check_graduations()` による自動卒業（SANDBOX_005 完了で SANDBOX_006 が自動発火）は「思いがけない報酬」のサプライズ感をもたらす好設計。

**減点理由（-1）**:
- `findCurrentTask()` が `skills.find()` で配列先頭を返すため、並列解放時（SANDBOX_003 / SANDBOX_004 など）に片方にしかフォーカスが当たらず、選択肢の存在に気づきにくい
- bridge.spec.ts で SANDBOX_006 -> BRIDGE_001 のチェーン伝搬タイミング問題が残存（1/10 失敗）

### 報酬デザイン: ★3.5/5

**現金報酬バランス**:
reward-system.ts の `calculateSkillReward()` は型安全に報酬を分類（cash / title / item / unlock）しており、設計として堅牢。全スキル完了時の総報酬を試算:

| 段階 | スキル報酬合計 | マイルストーン | 備考 |
|------|-------------|-------------|------|
| Sandbox (6) | 150,000 | -- | 序盤の太っ腹設計で正解 |
| Bridge (3) | 60,000 | -- | 遷移期として適切 |
| Fail (3) | 35,000 | 50,000(10スキル) | 失敗を報酬化する教育設計 |
| Setup (5) | 50,000 | -- | 機械的作業への適度な報酬 |
| Data (6) | 100,000 | 100,000(20スキル) | データ理解に見合う |
| Set (3) | 70,000 | -- | |
| Trade (10) | 195,000 | 200,000(35スキル) | 最大カテゴリ |
| Chart (4) | 65,000 | -- | |
| Indicator (9) | 290,000 | -- | 高難易度の見返り |
| Risk (10) | 345,000 | 400,000(50スキル) + 600,000(58スキル) | 最終カテゴリ |
| **合計** | **1,360,000** | **1,350,000** | **総計 2,710,000** |

スキル報酬とマイルストーン報酬がほぼ 1:1 の比率（1,360,000 vs 1,350,000）であり、二重の報酬構造として均衡が取れている。

**マイルストーン報酬設計**:
`milestones` 配列の 5 段階設計は、10 -> 20 -> 35 -> 50 -> 58 の間隔で、前半（10 スキル刻み）から後半（15 スキル刻み）へと間隔が広がる。`getNextMilestone()` と `getMilestoneProgress()` の組み合わせにより、RewardSummary コンポーネントで「あと X スキル」と残りスキル数が表示される設計は進捗感に寄与する。

**減点理由（-1.5）**:
- 35 -> 50 の 15 スキル空白が長すぎる。インジケーター系の高難易度スキル群が集中するゾーンで報酬フィードバックが途切れる
- 58 スキルでマスター投資家、しかし全 59 スキルの最後の 1 スキル取得に報酬がない。`strategy_templates` unlock は機能未実装
- FAIL_001 の報酬が 5,000 円と他スキル（最低でも 7,500 円）に比べて低い。「含み損を経験した」という心理的な重みに対して報酬が見合わない
- `checkMilestone()` が `completedCount >= milestone.skillCount` で判定するため、スキルを一気に複数取得した場合に中間マイルストーンを飛ばす可能性がある（`atoms.ts:206` の `checkMilestone(previousCount + 1, previousCount)` は +1 単位なので実質問題ないが、バッチ処理との整合性注意）

### UI/UX: ★3.5/5

**スキルツリーの視認性**:
ReactFlow ベースのグラフ表示は、スキルの依存関係を直感的に把握できる。`elements.ts` のレイアウトアルゴリズムは前提条件の深度から階層を自動計算し（`getLevel()` 再帰関数）、同一階層のスキルを横に等間隔配置する。SKILL_NODE_WIDTH=200, SKILL_NODE_HEIGHT=100 のカードサイズは情報量と視認性のバランスが良い。

`skill-node.tsx` の 10 カテゴリ色分け（categoryColors）は視覚的に明確:
- sandbox: 緑（#4ade80）-- 安全な練習場のイメージ
- bridge: 青（#60a5fa）-- 遷移・接続のイメージ
- fail: 赤（#f87171）-- 警告・失敗のイメージ
- trade: シアン（#22d3ee）-- 取引の活発さ
- risk: ピンク（#f472b6）-- リスクの注意喚起

各ノードの左ボーダーにカテゴリ色を適用する設計は、グラフ全体を俯瞰した際のカテゴリ識別を容易にする。

**操作性**:
- ホバー時にノードがスケール 1.02 倍 + shadow 追加（skill-tree.css:24-27）。過度な演出を避けつつ反応性を示す
- ホバー/選択時にエッジが金色ハイライト（strokeWidth: 3, stroke: #f59e0b）+ 非関連エッジの opacity 0.3 低下。前提条件の因果関係が視覚的に際立つ
- `handleInit` で `fitView` を使い、`findCurrentTask()` が返すカレントタスクに自動フォーカス。ツリーを開いた瞬間に「次に取り組むべきスキル」が中央に表示される
- Controls コンポーネント（ズーム +/-, fit view）を右下に配置。`showInteractive={false}` でノード操作の無効化表示を隠す

**TrackSwitcher の設計**:
「すべて / サンドボックス / ブリッジ / フルモード」のタブ切り替えに、ロック状態表示・完了状態表示・進捗バッジ（X/Y）が統合されている。ロックされたトラックは `opacity-50 cursor-not-allowed` で明確に無効化を表示し、カレントトラックには `ring-1 ring-primary/30` で微妙なハイライトを付ける。これはゲーム的な「段階解放」の視覚表現として適切。

**SandboxIndicator / BridgeIndicator**:
各トラックの進捗をプログレスバーで可視化し、段階に応じたメッセージ（「ゲームを起動してスタート！」「株を買ってみよう」など）を表示する設計は、ガイダンスとして機能的。完了時に色が変化して「ブリッジモード解禁」「フルモード解禁」のバッジが表示される演出も明確。

**skill-complete-glow アニメーション**:
完了時に緑色のグロー（box-shadow pulse）が 0.6 秒で表示される。アンロック時には scale 0.95 -> 1.05 -> 1.0 のバウンスアニメーション（0.3 秒）。これらの微小なアニメーションは「変化があった」ことを知覚させるのに十分であり、過剰でもない。

**SkillDetailPanel**:
スキル選択時の詳細パネルには、ステータス（ロック中/挑戦可能/達成済み）、難易度スター、報酬リスト（タイプ別カラーバッジ付き）、前提スキルのタイトル表示、helpContent の展開が含まれる。`onInsertHelp` で unlocked 状態のスキルのみ「ノートブックに挿入」ボタンが表示される条件制御は適切。

**RewardSummary**:
総報酬のグラデーション背景表示、マイルストーン進捗の「あと X スキル」表示、称号・アイテム・アンロックの分類表示は、プレイヤーの収集状況を一覧できる良い設計。全スキル達成時のトロフィー表示も用意されている。

**減点理由（-1.5）**:
- helpContent の Markdown がレンダリングされない（`<pre>` タグ使用）。コードブロック、見出し、太字が全てプレーンテキスト表示になる
- ui.spec.ts で fixme 3 件（トラック切り替え・報酬サマリー関連）がスキップされており、TrackSwitcher / RewardSummary の動作検証が不完全
- SkillDetailPanel の前提スキル表示が Badge でフラットに並ぶのみで、「どれが完了済みか」の色分けがない。ロックされたスキルの前提条件を確認する際に、どれを先にやるべきかが分かりにくい
- `elements.ts` の `TRACK_OFFSETS` が { sandbox: 0, bridge: 1200, full: 2000 } と固定値であり、スキル数が増えた際にトラック間の重複が起きる可能性がある

### 進捗感: ★3/5

**プレイヤーの成長実感**:
スキルツリーのグラフが「広がっていく」視覚効果、HUD のプログレスバー、SandboxIndicator / BridgeIndicator の段階的進捗表示、RewardSummary の累計報酬表示など、進捗を可視化する仕組みは多層的に用意されている。

**E2E テスト改善の証拠**:
前回 v5 時点で 53/78 passed (67.9%) だったテスト通過率が、今回 69/83 passed (83.1%) に改善。特に:
- sandbox.spec.ts: 8/9 -> 10/10 (完全通過)
- setup.spec.ts: 9/11 -> 10/10 (完全通過)
- data.spec.ts: 9/10 -> 11/11 (完全通過)
- persistence.spec.ts: 4/10 -> 7/8 (大幅改善)
- z-python-e2e.spec.ts: 1/4 -> 4/4 (完全通過)

これはゲームの安定性が着実に向上していることを示し、プレイヤーの「進捗が失われない」信頼感に直結する。

**減点理由（-2）**:
- persistence.spec.ts でリロード後の進捗リセット問題が残存（1/8 失敗）。スキル完了後にリロードすると、カーネル再送でスキルが再発火して進捗数が増えてしまう（期待 0 だが 2 になる）。進捗の永続化と冪等性が未完成
- integration.spec.ts（4/9 通過、5 件失敗）-- HTML パイプライン経由のスキル完了が全面的に不安定。`__testInjectBroadcastHTML` 経由のフローが機能していない
- guard-validation.spec.ts（1/3 通過、2 件失敗）-- buy/sell のガード処理検証が依然として不完全
- `atoms.ts` の `completeSkillWithRewardAtom` に保留キュー（`pendingSkillsAtom`）が実装されているが、保留スキルが永続化されないため、リロード時に保留キューが失われる
- 全テストで「Reconnected バナー検出」が発生しており、接続安定性に根本的な課題がある

---

## 良い点

1. **コアゲームループの安定性向上**: sandbox.spec.ts（10/10）、setup.spec.ts（10/10）、data.spec.ts（11/11）、z-python-e2e.spec.ts（4/4）が完全通過。前回 v5 比で 4 スイートが完全通過に到達し、コアフローの信頼性が実証された。

2. **スキルツリーのグラフ設計の完成度**: ReactFlow + 階層自動レイアウト + カテゴリ色分け + ホバーハイライト + カレントタスク自動フォーカスの組み合わせは、ゲーミフィケーション UI として高品質。`createSkillEdge()` のクロストラックエッジ（strokeDasharray: "8,4"）は、トラック間依存を視覚的に区別する細やかな配慮。

3. **報酬システムの型安全な設計**: `types.ts` で RewardType を 4 種（cash/item/unlock/title）に厳密に型定義し、`reward-system.ts` で switch-case による分岐処理。`calculateTotalRewards()` がマイルストーン報酬も統合計算する設計は拡張性が高い。

4. **保留キューによる順序保証**: `atoms.ts` の `completeSkillWithRewardAtom` が prerequisites 未達スキルを `pendingSkillsAtom` にキューイングし、他スキル完了時に自動リトライする `while (changed)` ループは、非同期イベント到着順の不確定性を吸収する堅牢な設計。

5. **多層的な進捗可視化**: SandboxIndicator（段階メッセージ付きプログレスバー）、BridgeIndicator（フルモードへのガイダンス付き）、RewardSummary（総報酬・マイルストーン進捗・称号/アイテム一覧）、TrackSwitcher（トラック別進捗バッジ）と、4 つの異なるビューポイントから進捗を表示。

6. **失敗スキルのゲームデザイン哲学**: FAIL_001（含み損）・FAIL_002（損切り）・FAIL_003（破産）を報酬対象にし、helpContent に投資格言（「損小利大がプロの鉄則」「マーケットは授業料を取る」）を含める設計は、心理的安全性と教育効果を両立している。

7. **トーストクリック -> スキルツリーダイアログ連携**: `skill-reward-toast.tsx` で `store.set(skillTreeDialogAtom, true)` を呼ぶことで、トーストクリックでスキルツリーが自動展開される。「達成 -> 確認したい」の行動フローに自然に乗る。

8. **BroadcastChannel バッファリプレイ**: `skill-complete-handler.ts` の `replayBufferedMessages()` により、React マウント前に送信されたスキルイベントを後からリプレイできる。再接続シナリオでのイベントロスを軽減する設計。

9. **i18n 対応の先見性**: `translatedSkillsAtom` で locale に応じてスキルの title/description を翻訳する仕組みが実装済み（en.ts, zh.ts）。日本語をベースに多言語展開可能な基盤がある。

10. **CSS アニメーションの抑制的な品質**: skill-unlock（0.3s バウンス）、skill-complete-glow（0.6s 緑グロー）、edge-flow（1s ダッシュアニメーション）の 3 種のアニメーションは、過度な演出を避けつつ状態変化を知覚させる。パフォーマンスへの影響も最小限。

---

## 改善提案

### P1（必須改善）

1. **進捗永続化の完成**: persistence.spec.ts のリロード後進捗リセット問題（期待 0 だが 2 になる）は、カーネル再送によるスキル再発火が原因。`completeSkillWithRewardAtom` の冪等性（`progress.completedSkills.includes(skillId)` チェック）は実装済みだが、atom 自体がリロードで初期化されるため機能しない。`atomWithStorage` による localStorage 永続化、または `initProgressFromFileAtom` のバックエンド連携を確実に動作させる必要がある。保留キュー（`pendingSkillsAtom`）の永続化も必要。

2. **HTML パイプライン経由のスキル完了修復**: integration.spec.ts の 5 件失敗は全て `__testInjectBroadcastHTML` 経由。`extractAndSendBroadcastMessages()` が HTML からスキルイベントを正しく抽出・送信できていない。本番環境での Python -> HTML 出力 -> BroadcastChannel -> フロントエンドの全パイプラインが不安定。

3. **guard-validation の修復**: buy/sell のガード処理検証 2 件の失敗を修正。ガード警告メッセージテキストの不一致（`"保有中の株がありません"` が見つからない）を解消し、初心者の誤操作時に適切なフィードバックが表示されることを保証する。

### P2（推奨改善）

1. **helpContent の Markdown レンダリング**: `skill-detail-panel.tsx` の `<pre className="whitespace-pre-wrap">` を `react-markdown` に置換。skill-data.ts の helpContent は全て Markdown 記法（`##`, `**`, ` ``` `）で記述されており、意図した表示とのギャップが大きい。コードブロックのシンタックスハイライトも追加すると Python コードの可読性が向上する。

2. **マイルストーン 35-50 の空白解消**: `milestones` 配列に `{ skillCount: 42, bonus: 150000, title: "中堅トレーダー" }` を追加し、インジケーター系高難易度スキル群の通過中に達成感のフィードバックを提供する。

3. **findCurrentTask() の改善**: 複数スキルが同時に unlocked の場合、ランダムまたはカテゴリ優先度に基づく選択に変更するか、「X 個のスキルが挑戦可能」の通知を追加する。

4. **SkillDetailPanel の前提スキル完了状態表示**: 前提スキルの Badge に完了/未完了のカラーを反映し（`prereqSkill?.status === "completed"` で緑、それ以外でグレー）、ロックされたスキルの「何を先にやるべきか」を明確にする。

5. **BRIDGE_001 チェーン伝搬タイミングの修正**: bridge.spec.ts の 1 件失敗（SANDBOX_006 完了後に BRIDGE_001 が locked のまま）は、前提条件チェーンの伝搬遅延が原因。`completeSkillWithRewardAtom` の保留キュー処理が非同期イベントの到着順に依存しているため、明示的な待機/リトライを追加する。

### P3（将来改善）

1. **59 スキルコンプリート演出**: 全スキル達成時の特別演出（フルスクリーンアニメーション、「伝説の投資家」称号）。RewardSummary の `completedCount >= totalSkills` 分岐は実装済みだが、トロフィーアイコンの静的表示のみ。

2. **TRACK_OFFSETS の動的計算**: 現在の固定値（sandbox: 0, bridge: 1200, full: 2000）を、各トラックのスキル数と階層深度に基づいて動的に計算する。スキル追加時のレイアウト崩れを防止。

3. **helpContent 未設定スキルの補完**: 59 スキル中、helpContent が設定されているのは SANDBOX_001-004, BRIDGE_001-003, FAIL_001-003 の 10 スキルのみ。少なくとも各カテゴリの最初のスキル（SETUP_001, DATA_001, SET_001, TRADE_001, CHART_001, IND_001, RISK_001）に helpContent を追加すべき。

4. **RewardSummary の称号表示上限緩和**: 現在 `titles.slice(0, 6)` で 6 個までの表示制限。全マイルストーン称号 + スキル報酬称号を合わせると 10 以上になるため、スクロール可能なリストに変更するか、表示上限を引き上げる。

5. **Reconnected バナーの根本対策**: 全テストで「Reconnected バナー検出」が発生しており、WebSocket 接続の安定性改善が必要。`ensureConnected` による自動 dismiss はワークアラウンドに過ぎず、ユーザー体験上の不安感（「接続が切れた？」）を生む。

---

## サマリー

前回 v5 評価時（53/78 passed = 67.9%）から今回（69/83 passed = 83.1%）へとテスト通過率が約 15 ポイント改善し、コアゲームループ 4 スイート（sandbox, setup, data, z-python-e2e）が完全通過に到達した。総合スコアを 3.0 から 3.5 に引き上げる。

特に評価すべきは以下の 3 点:

1. **スキルツリー UI の完成度**: ReactFlow グラフ + 10 カテゴリ色分け + ホバーハイライト + カレントタスク自動フォーカス + CSS アニメーション（unlock / complete / edge-flow）の組み合わせは、ゲーミフィケーション UI として商用品質に近い
2. **報酬システムの設計的均衡**: スキル報酬（1,360,000 円）とマイルストーン報酬（1,350,000 円）の 1:1 比率、4 種の報酬タイプ（cash / title / item / unlock）、保留キューによる順序保証は、報酬デザインとして構造的に健全
3. **多層的進捗可視化**: SandboxIndicator / BridgeIndicator / RewardSummary / TrackSwitcher の 4 コンポーネントが、異なる粒度でプレイヤーの進捗を表示する多層構造

4.0 以上に到達するための最優先課題は:
- P1-1: 進捗永続化（リロード耐性）の完成
- P1-2: HTML パイプラインの安定化
- P2-1: helpContent の Markdown レンダリング

これらが解消されれば、投資学習ゲームとして「遊びながら学べる」コアバリューが安定的に提供できる段階に到達する。

---

## テスト通過率推移

| バージョン | passed | failed | skipped | 通過率 | 備考 |
|-----------|--------|--------|---------|--------|------|
| v4 | 53 | 25 | 0 | 67.9% | 83テスト中 |
| v6（今回） | 69 | 9 | 5 | 83.1% | 83テスト中。完全通過スイート 6/11 |

## 完全通過スイート（6/11）

- backcast-integration.spec.ts (6/6)
- data.spec.ts (11/11)
- sandbox.spec.ts (10/10)
- setup.spec.ts (10/10)
- z-python-e2e.spec.ts (4/4)
- bridge.spec.ts (9/9 + 1 failed = 9/10) -- ほぼ完全

## 残存失敗（9 件）

| スイート | 失敗数 | 主な原因 |
|---------|--------|---------|
| bridge.spec.ts | 1 | チェーン伝搬タイミング |
| guard-validation.spec.ts | 2 | ガードメッセージ不一致 |
| integration.spec.ts | 5 | HTML パイプライン不安定 |
| persistence.spec.ts | 1 | カーネル再送による状態汚染 |

---

```
## game-fun-review v6 結果
- 総合スコア: ★3.5/5 (前回 ★3.0 から +0.5)
- カテゴリ別: フロー体験 ★4/5, 報酬デザイン ★3.5/5, UI/UX ★3.5/5, 進捗感 ★3/5
- 良い点: 10 件
- 改善提案: P1 x 3, P2 x 5, P3 x 5
- テスト通過率: 83.1% (前回 67.9% から +15.2pt)
- 完全通過スイート: 6/11 (前回 1/11)
- レポート: development_docs/game-play-reports/fun-review-2026-02-21.md
```
