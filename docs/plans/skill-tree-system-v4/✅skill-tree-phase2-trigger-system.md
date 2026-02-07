# Phase 2: スキルトリガーシステム

**想定日数**: 2-3日
**優先度**: P0
**依存**: Phase 1（データモデル）
**ステータス**: ✅ 完了（2026-02-03）

---

## 1. ゴール

- `backcast.py`の`with app.setup:`節にスキルトリガー関数を実装
- `<marimo-broadcast>`通信でフロントエンドにスキルイベントを配信
- フロントエンドでスキル完了を検知し、セル注入をトリガー

---

## 2. アーキテクチャ（v4: セル注入方式）

```
┌─────────────────┐     <marimo-broadcast>      ┌─────────────────┐
│  backcast.py     │  ─────────────────────→    │  marimo frontend │
│  (with app.setup)│   skill_event_channel       │                  │
│ ┌──────────────┐ │                            │ ┌──────────────┐ │
│ │ _emit_skill()│ │                            │ │ skill-tree   │ │
│ │ (関数)       │ │                            │ │ handler.ts   │ │
│ └──────────────┘ │                            │ └──────────────┘ │
│                  │                            │         │        │
│                  │    Electron IPC            │         ▼        │
│                  │ ←─────────────────────────  │ injectCells()   │
│                  │   セル注入 + 進捗更新       │                  │
└─────────────────┘                             └─────────────────┘

BackcastPro.Backtest: 変更なし（純粋なライブラリのまま維持）
```

**設計方針**:
- `backcast.py`の`with app.setup:`節に`_emit_skill()`関数を直接定義
- スキル完了時にフロントエンドが検知し、Electron IPC経由でセル注入
- 継承クラスは使用せず、単一ノートブックで全モードを管理

---

## 3. 実装済みファイル

### 3.1 backcast.py のスキルイベント発行（with app.setup:内）

**場所**: `frontend/public/files/backcast.py`

```python
with app.setup:
    import marimo as mo
    import json
    import base64
    import time
    from marimo._output.hypertext import Html
    from BackcastPro import Backtest, get_stock_daily

    # =========================================================================
    # ゲーム進捗データ（セーブデータ）
    # =========================================================================
    _GAME_PROGRESS = {
        "version": 1,
        "completed_skills": [],
        "current_mode": "sandbox",
        "cash": 0,
        "titles": [],
    }

    # =========================================================================
    # スキルイベント発行
    # =========================================================================
    _triggered_skills = set()  # 重複発行防止

    def _emit_skill(skill_id: str, context: dict = None):
        """スキル達成をBroadcastChannelで通知"""
        if skill_id in _triggered_skills:
            return  # 既に発行済み
        _triggered_skills.add(skill_id)

        event = {
            "skill_id": skill_id,
            "context": context or {},
            "timestamp": int(time.time() * 1000),
        }
        event_json = json.dumps(event)
        event_b64 = base64.b64encode(event_json.encode()).decode()

        html = (
            f'<marimo-broadcast '
            f'id="skill-{skill_id}-{int(time.time() * 1000)}" '
            f'channel="skill_event_channel" '
            f'type="skill_complete" '
            f'payload="{event_b64}" '
            f'style="display:none;"></marimo-broadcast>'
        )
        mo.output.append(Html(html))

    # Backtest初期化（以降のセルで使用）
    bt = Backtest(cash=1_000_000, commission=0.001)
```

### 3.2 skill-complete-handler.ts（スキル完了ハンドラー）

**ファイル**: `frontend/src/components/skill-tree/skill-complete-handler.ts`

- BroadcastChannelでスキルイベントを監視
- Electron IPC経由で`injectCells()`を呼び出し
- `_GAME_PROGRESS`を更新

### 3.3 notebook-injector.js（セル注入ロジック）

**ファイル**: `electron/utils/notebook-injector.js`

- ノートブックファイルを解析
- 新しいセルを挿入
- `_GAME_PROGRESS`を更新して保存

---

### 3.4 injection-templates.ts（注入テンプレート）

**ファイル**: `frontend/src/components/skill-tree/injection-templates.ts`

スキル完了時に追加するセルのテンプレートを定義。

```typescript
export interface InjectionTemplate {
  skillId: string;
  cells?: CellTemplate[];
  description: string;
}

// 例: SANDBOX_002完了時
{
  skillId: "SANDBOX_002",
  description: "初めての購入後、保有株確認のヒントを追加",
  cells: [
    {
      name: "_hint_check_trades",
      code: `mo.md('''## 次のステップ: 保有株を確認する ...''')`,
      afterCell: "_playground",
    },
  ],
}
```

---

## 4. スキル検出フロー

```
1. ユーザーが bt.buy() を実行
   │
2. Python側で _emit_skill("SANDBOX_002") を呼び出し
   │
3. <marimo-broadcast> 要素がDOMに追加される
   │
4. Frontend の BroadcastChannel が skill_complete イベントを受信
   │
5. skill-complete-handler.ts が Electron IPC を呼び出し
   │
6. notebook-injector.js が backcast.py を編集
   │  - 新しいセルを追加
   │  - _GAME_PROGRESS を更新
   │
7. marimo が変更を検知してリロード
```

---

## 5. タスク一覧

| # | タスク | ファイル | ステータス |
|---|-------|---------|-----------|
| 2.1 | `_emit_skill()` 関数 | `backcast.py` | ✅ 完了 |
| 2.2 | スキル完了ハンドラー | `skill-complete-handler.ts` | ✅ 完了 |
| 2.3 | セル注入ロジック | `notebook-injector.js` | ✅ 完了 |
| 2.4 | 注入テンプレート定義 | `injection-templates.ts` | ✅ 完了 |
| 2.5 | Electron IPC追加 | `main.js`, `preload.js` | ✅ 完了 |

---

## 6. テスト戦略

### 6.1 ユニットテスト

```typescript
// skill-complete-handler.test.ts
describe("handleSkillComplete", () => {
  it("should call injectCells with correct parameters", async () => {
    const mockInjectCells = jest.fn().mockResolvedValue({ success: true });
    window.electronAPI = { isElectron: true, injectCells: mockInjectCells };

    await handleSkillComplete("SANDBOX_002", { completed_skills: [] });

    expect(mockInjectCells).toHaveBeenCalledWith(
      expect.objectContaining({ skillId: "SANDBOX_002" })
    );
  });
});
```

### 6.2 統合テスト

1. backcast.py でスキルをトリガー
2. BroadcastChannel でイベント受信を確認
3. notebook-injector.js でセル追加を確認
4. ファイル内容の変更を検証

---

## 7. 完了条件

- [x] `_emit_skill()` が `<marimo-broadcast>` を正しく出力する
- [x] `_triggered_skills` で重複トリガー防止が動作する
- [x] Frontend で skill_complete イベントを受信
- [x] Electron IPC で `injectCells()` が呼び出される
- [x] ノートブックファイルにセルが追加される

---

## 8. 次のフェーズへの引き継ぎ

Phase 2完了後、以下が利用可能になる：

**Python側（backcast.py）:**
- `_emit_skill(skill_id, context)`: スキルイベント発行関数
- `_triggered_skills`: 重複防止用セット
- `_GAME_PROGRESS`: 進捗データ（セーブデータ）

**Frontend側:**
- `handleSkillComplete()`: スキル完了→セル注入トリガー
- `loadProgressFromNotebook()`: 進捗データ読み込み
- `setupSkillEventListener()`: BroadcastChannel監視

**Electron側:**
- `injectCells()`: セル注入IPC
- `readProgress()`: 進捗読み取りIPC
- `updateSetupBlock()`: setup節更新IPC

**BackcastProへの変更は不要**（純粋なライブラリのまま維持）
