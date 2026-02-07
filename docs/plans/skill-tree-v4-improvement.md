# Backcast スキルツリー v4 改善実装計画

> 作成日: 2026-02-05
> 最終更新: 2026-02-05（実装完了版）
> 対象: `frontend/public/files/` (Python) + `frontend/src/components/skill-tree/` (React)

---

## 0. 実装進捗サマリ

| フェーズ | ステータス | 変更行 |
|---------|-----------|--------|
| **A0**: prerequisites ガード | ✅ 完了 | +10 (atoms.ts) |
| **A1**: ゲート廃止・永続化 | ✅ 完了 | +18 (skill_events.py) |
| **A**: サンドボックス自動トリガー | ✅ 完了 | +76/-40 (game_setup.py) |
| **B**: ブリッジ自動トリガー | ✅ 完了 | +400 (injection-templates.ts) |
| **C**: FAIL スキル自動トリガー | ✅ 完了 | (game_setup.py に含む) |
| **D**: 注入テンプレート追加 (10件) | ✅ 完了 | (injection-templates.ts に含む) |
| **E**: ノートブック整理 | ⏳ 未着手 | Phase A-C 動作確認後に実施 |
| **F**: ソーシャル機能 | ⛔ スキップ | 計画通り |
| **G**: 実績解除通知の常時表示 | ✅ 完了 | marimo toast ハック (atoms.ts, skill-reward-toast.tsx, skill-tree-panel.tsx) |

**合計 diff**: +510/-40 行（8ファイル）
**テスト結果**: atoms.test.ts 63件 PASS / injection-templates.test.ts 79件 PASS
**型チェック**: 変更対象ファイルにエラーなし（既存の Zod/hookform 互換性エラー3件は無関係）

### 変更ファイル実績

| ファイル | フェーズ | 差分 |
|---------|---------|------|
| `frontend/src/components/skill-tree/atoms.ts` | A0 | +10 |
| `frontend/public/files/skill_events.py` | A1+A | +18 |
| `frontend/public/files/game_setup.py` | A1+A+B+C | +76/-40 |
| `frontend/src/components/skill-tree/injection-templates.ts` | B+D | +400 |
| `frontend/src/components/skill-tree/__tests__/atoms.test.ts` | A0 | +18/-18 |
| `frontend/src/components/skill-tree/__tests__/injection-templates.test.ts` | D | +15/-15 |
| `frontend/public/files/backcast.py` | 付随 | +10/-10 |
| `.claude/settings.local.json` | 設定 | +3/-1 |

### 新たな知見

1. **`_check_graduations()` の post-emit フックパターンが有効** — 卒業チェックを各関数に散在させず `emit_skill()` 末尾に統合したことで、新スキル追加時に卒業条件を1箇所で管理できる
2. **`hasattr(t, 'pl')` ガードが必要** — BackcastPro の `Trade` オブジェクトは部分約定状態で `pl` 属性が未定義の場合がある。`sell()` / `trades()` / `_check_unrealized_loss()` の3箇所で統一的に使用
3. **`emit_skill()` の重複排除がトリガー条件の緩さを許容** — 同一 skill_id は `_triggered_skills` set で2回目以降無視されるため、「条件を緩くして複数箇所で発火」が安全なパターン
4. **TypeScript 型エラー3件は既存** — `app-config-form.tsx`, `user-config-form.tsx`, `charts.tsx` の `@hookform/resolvers/zod` 互換性問題。今回の変更とは無関係

### 設計変更ログ

| 項目 | 当初計画 | 実装時の変更 | 理由 |
|------|---------|-------------|------|
| `_skill_gate` 定義 | 削除検討 | 定義は残存、適用のみ外す | 将来フルモードで再利用の可能性 |
| `setup_complete()` | 新関数として追加 | 不要→廃止 | `_check_graduations()` フックで自動化 |
| FAIL_001 チェック箇所 | `trades()` のみ | `trades()` + `step()` の2箇所 | 含み損はステップ進行で発生するため |
| テンプレート総数 | 20→30 | 30テンプレート | Phase D で10件追加 |
| `backcast.py` | 変更なし | +10/-10 | ノートブックの setup セルから `sync_triggered_skills` 呼び出しと関連調整 |

### Tips

- **marimo `_` プレフィックス**: `_check_unrealized_loss()` 等のヘルパーは `_` 付きでも同一 `.py` ファイル内なら問題なし。セルローカル制約は marimo のセル間のみに適用
- **BroadcastChannel 二重発火**: `skill-complete-handler.ts` で BroadcastChannel + MutationObserver が同時検出する可能性があるが、`completeSkillAtom` の重複チェック（`progress.completedSkills.includes(skillId)`）で吸収される
- **BackcastPro の `bt.buy()`/`bt.sell()`**: 失敗しても例外を投げず `Order` を返す。サンドボックスでは無条件発火で安全
- **テスト exclusion list**: `injection-templates.test.ts` の `SKILLS_WITHOUT_TEMPLATE` に理由付きで記録。新テンプレート追加時はここからエントリを削除すること

---

## 1. 現状の棚卸し

### 致命的な問題

| # | 問題 | 影響 |
|---|------|------|
| 1 | `emit_skill()` が `SANDBOX_001` しか自動発火しない（`chart.py:1221` のみ） | buy/sell/trades で SANDBOX_002〜006 が一切進行しない |
| 2 | `game_setup.py:112` の `@_skill_gate("BRIDGE_002")` 循環依存バグ | `get_stock_daily()` を呼ぶと BRIDGE_002 獲得の設計だが、BRIDGE_002 がないと呼べない。永久アンロック不可 |
| 3 | `game_setup.py` に `emit_skill` が未インポート（L20 で `get_triggered_skills` のみ） | Python 側からスキル発火ができない |
| 4 | `completeSkillAtom` / `completeSkillWithRewardAtom` が prerequisites を検証していない | Python 側のトリガー条件が prerequisites と一致しない場合、スキルが順序を飛ばして完了する |
| 5 | `_triggered_skills` がプロセスメモリ上の `set` で、ノートブック再起動で消える | フロントエンドは localStorage で永続化済みだが、Python 側の `_skill_gate` が空集合で判定 → ブリッジ関数がブロックされて進行不能 |
| 6 | `step()` で equity <= 0 のとき BackcastPro が `raise Exception` する | FAIL_003 の emit_skill が例外の後に配置されると到達不能コードになる |

### 不足している機能

| # | 不足 | 詳細 |
|---|------|------|
| 7 | FAIL 系スキルのトリガーなし | 含み損・損切り・破産の自動検出が未実装 |
| 8 | ブリッジモードのトリガーなし | BRIDGE_001/003 を発火させるコードパスが存在しない |
| 9 | 注入テンプレート不足 | 59 スキル中 20 テンプレートのみ。教育的価値のある 10 スキルが不足 |

### 整合性の問題

| # | 問題 | 詳細 |
|---|------|------|
| 10 | 複数ノートブックの存在 | Phase 0 は単一 `backcast.py` 設計だが `sandbox.py`/`bridge.py`/`full_mode.py` が別途存在し `headless_broadcast` を重複コピー |

---

## 2. 改善計画（8フェーズ）

### Phase A0: フロントエンド prerequisites ガード [P0・最優先] ✅

**対象ファイル**: `frontend/src/components/skill-tree/atoms.ts`

#### 問題

`completeSkillAtom`（L73）と `completeSkillWithRewardAtom`（L165）は、
重複チェック（既に completedSkills に含まれるか）のみで prerequisites を検証していない。
Python 側の `emit_skill()` も prerequisites を見ないため、
トリガー条件がスキルグラフと一致しない場合にスキルが飛ばし解除される。

#### 変更: prerequisites ガード追加

`completeSkillAtom`:
```typescript
export const completeSkillAtom = atom(null, (get, set, skillId: SkillId) => {
  const progress = get(playerProgressAtom);
  const definitions = get(skillDefinitionsAtom);
  const skill = definitions.find((s) => s.id === skillId);

  if (!skill || progress.completedSkills.includes(skillId)) {
    return;
  }

  // ★追加: prerequisites 未完了ならスキップ
  if (!skill.prerequisites.every(p => progress.completedSkills.includes(p))) {
    return;
  }

  // ... 以降の報酬計算は既存のまま
});
```

`completeSkillWithRewardAtom` にも同様のガードを追加。

#### 注意: BroadcastChannel + MutationObserver 二重発火

`skill-complete-handler.ts` で BroadcastChannel と MutationObserver の両方が
同じスキルイベントを検出すると `onSkillComplete` が2回呼ばれる可能性がある。
`completeSkillAtom` の重複チェックで吸収されるが、
`rewardNotificationAtom` が2回セットされる問題が残る。
→ `completeSkillWithRewardAtom` 冒頭の重複チェックで return するため、
  通知の二重表示は発生しない。念のため動作確認すること。

**見積り**: +6行（3行 × 2箇所）

---

### Phase A1: `_triggered_skills` 再起動耐性 [P0・最優先] ✅

**対象ファイル**: `frontend/public/files/skill_events.py`、`frontend/public/files/game_setup.py`

#### 問題

`_triggered_skills` はプロセスメモリ上の `set` であり、ノートブック再起動でリセットされる。
フロントエンドの `playerProgressAtom` は localStorage に永続化されているが、
Python 側にはフィードバックされない。

再起動後:
- フロントエンド: `BRIDGE_001` 完了表示
- Python: `get_triggered_skills()` → 空集合
- `_skill_gate("BRIDGE_001")` → ブロック → **進行不能**

#### 方針: ゲートを廃止し、注入テンプレートで誘導

`_skill_gate` デコレータは UX を阻害しやすく、永続化との整合性も取りにくい。
ブリッジ関数のゲートを廃止し、注入テンプレートによる自然な誘導に切り替える。

```python
# Before: ゲート付き（循環依存 + 再起動で壊れる）
@_skill_gate("BRIDGE_002", hint="自分でデータを取得")
def get_stock_daily(code: str, **kwargs):
    return _get_stock_daily(code, **kwargs)

# After: ゲート廃止、スキル発火のみ
def get_stock_daily(code: str, **kwargs):
    """銘柄コードから株価データを取得"""
    result = _get_stock_daily(code, **kwargs)
    emit_skill("BRIDGE_002")
    return result
```

`_skill_gate` 関数自体は将来のフルモード関数用に残してもよいが、
ブリッジ関数からは外す。

`skill_events.py` に `sync_triggered_skills()` ヘルパーを追加し、
フロントエンドの completedSkills を Python 側に復元する手段を確保する:

```python
def sync_triggered_skills(skill_ids: list[str]) -> None:
    """フロントエンドの completedSkills を Python 側に同期"""
    _triggered_skills.update(skill_ids)
```

ただし、ゲート廃止によりこの関数は当面不要。
将来フルモードでゲートを使う場合に備えた予約。

**見積り**: -15行（ゲート削除）、+5行（sync ヘルパー）

---

### Phase A: サンドボックス自動トリガー [P0・最優先] ✅

**対象ファイル**: `frontend/public/files/game_setup.py`、`frontend/public/files/skill_events.py`

#### 変更1: emit_skill インポート追加（L20）

```python
# Before
from skill_events import get_triggered_skills

# After
from skill_events import get_triggered_skills, emit_skill
```

#### 変更2: 卒業チェックを emit_skill 内フックに統合

`_check_sandbox_graduation()` を4関数全てに散在させるのではなく、
`emit_skill()` 自体にフックを付けてスキル発火後に自動チェックする。

`skill_events.py` に追加:

```python
def emit_skill(skill_id: str, context: dict | None = None) -> None:
    """スキル達成をBroadcastChannelで通知（重複発行防止付き）"""
    if skill_id in _triggered_skills:
        return
    _triggered_skills.add(skill_id)

    # ... 既存の BroadcastChannel 通知ロジック ...

    # ★卒業チェック（emit 後にフック）
    _check_graduations()


def _check_graduations() -> None:
    """トラック卒業の自動チェック"""
    s = _triggered_skills
    # サンドボックス卒業
    if all(f"SANDBOX_{i:03d}" in s for i in range(1, 6)):
        emit_skill("SANDBOX_006")
    # ブリッジ卒業
    if "BRIDGE_002" in s:
        emit_skill("BRIDGE_003")
```

これにより各関数に `_check_sandbox_graduation()` を呼ぶ必要がなくなる。

#### 変更3: 各関数に emit_skill() 埋め込み

| 関数 | 挿入位置 | emit_skill | 条件 |
|------|---------|-----------|------|
| `buy()` | L78 の後 | `emit_skill("SANDBOX_002")` | 無条件（※注） |
| `trades()` | L105 の後 | `emit_skill("SANDBOX_003")` | `SANDBOX_002` 済み AND `len(bt.trades) > 0` |
| `sell()` | L87 の後 | `emit_skill("SANDBOX_004")` | 無条件（※注） |
| `chart()` | L69 の後 | `emit_skill("SANDBOX_005")` | `SANDBOX_003` + `SANDBOX_004` 済み |

> ※注: `bt.buy()` / `bt.sell()` は常に `Order` オブジェクトを返し、
> 資金不足やポジション未保有でも例外を投げない（注文は後続の `step()` 時にキャンセルされる仕組み）。
> サンドボックスでは初期資金10万円で最初の buy/sell が失敗する可能性は極めて低いため、
> 無条件発火を許容する。フルモードのトリガーでは注文の約定確認が必要。

```python
def buy():
    """トヨタ(7203)の株を買う"""
    order = bt.buy()
    # サンドボックスでは初期資金で必ず成功する前提
    emit_skill("SANDBOX_002")
    update_all_backtest_charts(bt)
    publish_state_headless(bt, status_label="取引中", status_variant="default")
    return order
```

**見積り**: `game_setup.py` +25行、`skill_events.py` +15行

---

### Phase B: ブリッジ自動トリガー [P0・最優先] ✅

**対象ファイル**: `frontend/public/files/game_setup.py`、`frontend/src/components/skill-tree/injection-templates.ts`

#### 変更1: ゲート廃止 + BRIDGE_002 発火（Phase A1 で実施済み）

```python
# ゲート廃止後
def get_stock_daily(code: str, **kwargs):
    """銘柄コードから株価データを取得"""
    result = _get_stock_daily(code, **kwargs)
    emit_skill("BRIDGE_002")
    return result
```

#### 変更2: 新関数 `reveal_data()`（BRIDGE_001 トリガー）

```python
def reveal_data():
    """サンドボックスで使われていたデータの正体を確認"""
    if not bt._data:
        mo.output.append(
            mo.callout(
                mo.md("まず `bt.chart('7203')` でチャートを表示してください"),
                kind="info",
            )
        )
        return None
    for code, df in bt._data.items():
        mo.output.append(
            mo.md(f"**{code}**: {df.index[0]} ~ {df.index[-1]} ({len(df)}行)")
        )
    emit_skill("BRIDGE_001")
    return bt._data
```

> `bt._data` が空（`chart()` 未呼出し）の場合のエッジケースに対応。

#### 変更3: `setup_complete()` を廃止

レビューにより、`setup_complete()` は `_check_graduations()` フック
（Phase A の emit_skill 内フック）で自動化されるため不要。
`BRIDGE_002` が発火した時点で `_check_graduations()` が
`BRIDGE_003` を自動発火する。

#### 変更4: SANDBOX_006 テンプレートに `reveal_data()` への誘導を追加

現在のテンプレートは「ブリッジモードで裏側の仕組みを学びましょう」とあるが、
具体的な関数名がなくユーザーが詰まる。

```typescript
// injection-templates.ts の SANDBOX_006 テンプレートを修正
{
  skillId: "SANDBOX_006",
  description: "サンドボックス卒業時、ブリッジモードへの案内を追加",
  cells: [
    {
      name: "_bridge_intro",
      code: [
        '"""',
        "おめでとうございます！サンドボックスを卒業しました。",
        "次はブリッジモードで、裏側の仕組みを学びましょう。",
        '"""',
        "mo.md('''",
        "## サンドボックス卒業！",
        "",
        "おめでとうございます！基本操作をマスターしました。",
        "",
        "### 次のステージ: ブリッジモード",
        "",
        "サンドボックスでは、裏で自動的にデータが準備されていました。",
        "ブリッジモードでは、その「魔法」の正体を明かします。",
        "",
        "**次のステップ:** `bt.reveal_data()` を実行して、データの正体を確認しよう！",  // ★追加
        "",
        "**解禁される機能:**",
        "- データ取得の仕組みを学ぶ",
        "- 別の銘柄を追加する",
        "- 自分でセットアップする",
        "''')",
      ].join("\n"),
      afterCell: "_playground",
    },
  ],
},
```

**見積り**: `game_setup.py` +15行（reveal_data のみ、setup_complete 削除）、
`injection-templates.ts` +1行（テンプレート修正）

---

### Phase C: FAIL スキル自動トリガー [P1] ✅

**対象ファイル**: `frontend/public/files/game_setup.py`

#### FAIL_001: 含み損（trades + step で検出）

`trades()` だけでなく `step()` でもチェックする。
含み損はステップ進行時に発生するため、`step()` でのチェックがより自然。

```python
def _check_unrealized_loss():
    """含み損チェック（FAIL_001 トリガー）"""
    if "SANDBOX_002" in get_triggered_skills():
        if any(hasattr(t, 'pl') and t.pl < 0 for t in bt.trades):
            emit_skill("FAIL_001")
```

| 関数 | emit_skill | 条件 |
|------|-----------|------|
| `trades()` | `FAIL_001` | `SANDBOX_002` 済み AND trades 内に `pl < 0` |
| `step()` | `FAIL_001` | `SANDBOX_002` 済み AND trades 内に `pl < 0`（★追加） |

#### FAIL_002: 損切り

> 前提条件の正確な記載: `prerequisites: ["SANDBOX_004", "FAIL_001"]`
> （計画初版では `[FAIL_001]` のみと誤記していた）

| 関数 | emit_skill | 条件 |
|------|-----------|------|
| `sell()` | `FAIL_002` | `closed_trades` 内に `pl < 0` が存在 |

> Phase A0 の prerequisites ガードにより、フロントエンド側で
> SANDBOX_004 と FAIL_001 が両方完了していない場合は無視される。
> Python 側では `sell()` が SANDBOX_004 を同時に発火するため、
> BroadcastChannel の到達順序に依存しない設計となる。

#### FAIL_003: 破産（try/except で捕捉）

BackcastPro は equity <= 0 時に全トレードを強制クローズした後
`raise Exception` する。`emit_skill` を `step()` の後に配置すると
到達不能コードになるため、**try/except で捕捉する**。

```python
def step():
    """次の日に進む"""
    try:
        result = bt.step()
    except Exception:
        # BackcastPro が equity <= 0 で raise Exception する
        emit_skill("FAIL_003")
        update_all_backtest_charts(bt)
        publish_state_headless(bt, status_label="破産", status_variant="danger")
        raise  # ユーザーに例外を見せるために再送出
    # 含み損チェック（正常時のみ）
    _check_unrealized_loss()
    update_all_backtest_charts(bt)
    publish_state_headless(bt, status_label="取引中", status_variant="default")
    return result
```

> 注意: `FAIL_003` の prerequisites は `["TRADE_001"]`。
> サンドボックスで破産した場合、TRADE_001 が未完了のため
> Phase A0 の prerequisites ガードにより無視される。
> フルモードで TRADE_001 完了後に破産した場合のみ有効。

**見積り**: +25行

---

### Phase D: 注入テンプレート追加 [P1] ✅

**対象ファイル**: `frontend/src/components/skill-tree/injection-templates.ts`

追加する教育的テンプレート（10件）:

| スキル | 内容 | 理由 |
|--------|------|------|
| `SETUP_002` | BackcastPro のインポート方法 | フルモード入口。`import BackcastPro` の書き方 |
| `SETUP_003` | Backtest 初期化の解説 | `Backtest(cash=..., commission=...)` のパラメータ説明 |
| `IND_002` | SMA を DataFrame に追加する方法 | 計算結果をデータに組み込む初ステップ |
| `IND_004` | デッドクロス検出 | IND_003（ゴールデンクロス）の対 |
| `IND_007` | ボリンジャーバンド計算 | 非自明な計算ロジック |
| `IND_009` | MACD 計算 | 非自明な計算ロジック |
| `TRADE_008` | 戦略関数の作成方法 | 概念的な飛躍が必要 |
| `TRADE_010` | `run()` ループ実行の解説 | step vs run の違いの教育 |
| `RISK_002` | テイクプロフィット設定 | RISK_001（SL）の対 |
| `CHART_003` | インジケーターをチャートに表示 | チャートへの組み込み方法 |

> 初版から SETUP_002, SETUP_003 を追加。
> フルモード突入直後のオンボーディングとして、
> SETUP カテゴリ（5スキル）にテンプレートがゼロだった問題を解消。

残り 30 スキルは達成型（コードヒント不要）のためテンプレート不要。

**見積り**: +250行（10テンプレート × 約25行）

---

### Phase E: ノートブック整理 [P1] ⏳

**方針変更**: deprecation コメントではなく、**ファイル削除を検討**。

コメントは読まれない。`game_setup.py` + `backcast.py` が正式な入口として
機能することが Phase A-C で確認できたら、以下を削除する:

**対象ファイル**:
- `frontend/public/files/sandbox.py`
- `frontend/public/files/bridge.py`
- `frontend/public/files/full_mode.py`

削除前に:
1. Phase A-C の動作確認が完了していること
2. 各ファイルに固有のロジックがないことを確認
3. `headless_broadcast` の重複コピーが含まれている場合は整理

> もし参照実装として残す必要がある場合は `docs/examples/` に移動する。

**見積り**: -3ファイル

---

### Phase F: ソーシャル機能 MVP [P2・スキップ] ⛔

**スキップ**。

理由:
- ランクシステムは `PlayerStats`（totalReturn, sharpeRatio 等）に依存
- 現在これらの値が実際のゲームプレイから計算されていない
- Phase A〜E を完了してゲーム進行が機能してから、データ蓄積 → ランク計算の順が自然

---

### Phase G: 実績解除通知の常時表示 [P1] ✅

**方針**: marimo 組み込みの `toast()` API（`@radix-ui/react-toast`）をハックして、
パネルの開閉に関係なく常にトースト通知を表示する。

#### 問題

`RewardNotification` コンポーネントは `skill-tree-panel.tsx:44` でのみマウントされている。
スキルツリーパネルが閉じている場合、コンポーネントが DOM に存在しないため、
スキル解除時の通知トーストが**一切表示されない**。

#### 解決: marimo 標準トーストのハック

marimo の `toast()` はモジュールレベルの命令的関数（React コンテキスト不要）。
`Toaster` は `MarimoApp.tsx:105` でアプリルートにマウント済み。
→ `completeSkillWithRewardAtom` 内から `toast()` を呼ぶだけで常時通知が実現する。

既存パターン: `frontend/src/core/packages/toast-components.tsx` の `showAddPackageToast` が
`description` に ReactNode を渡してリッチな表示を行っている。これと同じパターンを踏襲。

#### 変更ファイル

| ファイル | 変更 |
|---------|------|
| `frontend/src/components/skill-tree/rewards/skill-reward-toast.tsx` | **新規**: `showSkillRewardToast()` ヘルパー。`toast()` に報酬情報を渡す |
| `frontend/src/components/skill-tree/atoms.ts` | `completeSkillWithRewardAtom` 末尾で `showSkillRewardToast()` を呼び出し |
| `frontend/src/components/editor/chrome/panels/skill-tree-panel.tsx` | `RewardNotification` の import と JSX を削除 |
| `frontend/src/components/skill-tree/rewards/reward-notification.tsx` | **削除**: toast に置き換えたため不要 |
| `frontend/src/components/skill-tree/index.ts` | `RewardNotification` → `showSkillRewardToast` にエクスポート差し替え |

#### 設計判断

| 選択肢 | 採用 | 理由 |
|--------|------|------|
| marimo 標準 `toast()` をハック | ✅ | `Toaster` がアプリルートにマウント済み。パネル開閉に依存しない。既存パターン踏襲 |
| `RewardNotification` を SkillTreeButton に移動 | ❌ | 独自コンポーネント不要。toast で十分 |
| React Portal でルートに配置 | ❌ | 不要な複雑さ |
| 未確認バッジ（pendingSkillCountAtom） | 後日 | まず視覚的通知を確実に動作させてから |

**テスト結果**: skill-tree/ 全 355 件 PASS
**型チェック**: 変更に起因するエラーなし（既存の Zod/hookform 互換性エラーのみ）

---

## 3. 実行順序と依存関係

```
Phase A0 (prerequisites ガード) ─┐
Phase A1 (ゲート廃止・永続化)   ─┤─→ Phase A (サンドボックス) ─┐
                                 │   Phase B (ブリッジ)       ─┤─→ Phase E (ノートブック整理)
                                 │   Phase C (FAIL)          ─┘
                                 │
                                 └─→ Phase D (テンプレート) ← フロントエンドのみ、Phase A-C と並行可能
                                 │
                                 └─→ Phase G (通知改善) ← フロントエンドのみ、Phase A-E と並行可能
```

- **Phase A0**: 最初に実施。フロントエンドの安全弁
- **Phase A1**: ゲート廃止により Phase B のブロッカーを解消
- **Phase A + B + C**: 全て Python 側（`game_setup.py` + `skill_events.py`）を変更するため同時実装が効率的
- **Phase D**: フロントエンドのみ。Python 側と並行可能
- **Phase E**: Phase A-C 完了後（正式パスの動作確認ができてから）
- **Phase G**: フロントエンドのみ。他の全フェーズと独立して実装可能（`completeSkillWithRewardAtom` が存在すれば動作）

---

## 4. 変更ファイル一覧

| ファイル | フェーズ | 追加行 | 修正行 | 削除行 |
|---------|---------|--------|--------|--------|
| `frontend/src/components/skill-tree/atoms.ts` | A0 | 6 | 0 | 0 |
| `frontend/public/files/skill_events.py` | A1+A | 20 | 0 | 0 |
| `frontend/public/files/game_setup.py` | A1+A+B+C | 65 | 1 | 15 |
| `frontend/src/components/skill-tree/injection-templates.ts` | B+D | 251 | 0 | 0 |
| `frontend/public/files/sandbox.py` | E | 0 | 0 | 全削除 |
| `frontend/public/files/bridge.py` | E | 0 | 0 | 全削除 |
| `frontend/public/files/full_mode.py` | E | 0 | 0 | 全削除 |
| `frontend/src/components/skill-tree/rewards/skill-reward-toast.tsx` | G | 65 | 0 | 0 |
| `frontend/src/components/skill-tree/atoms.ts` | G | 3 | 0 | 0 |
| `frontend/src/components/editor/chrome/panels/skill-tree-panel.tsx` | G | 0 | 0 | 3 |
| `frontend/src/components/skill-tree/rewards/reward-notification.tsx` | G | 0 | 0 | 全削除 |
| `frontend/src/components/skill-tree/index.ts` | G | 1 | 0 | 1 |

**合計**: ~411行追加、1行修正、19行削除、4ファイル削除

---

## 5. 検証方法

### Phase A0 テスト ✅

```bash
cd frontend && pnpm test src/components/skill-tree/
```

検証項目:
- ✅ prerequisites 未完了のスキルが `completeSkillAtom` で無視されること（atoms.test.ts L689-695）
- ✅ prerequisites 完了済みのスキルは正常に完了すること（atoms.test.ts 63件 PASS）
- ✅ BroadcastChannel + MutationObserver の二重イベントで通知が重複しないこと（重複チェックで吸収）

### Phase A1 テスト ✅ (コードレビュー済み、手動テストは Phase E 前に実施)

```
1. ✅ ブリッジ関数 `get_stock_daily()` がゲートなしで呼べること（コード確認: L153-161 にデコレータなし）
2. ⏳ ノートブック再起動後も `get_stock_daily()` が使えること（手動テスト待ち）
```

### Phase A テスト（marimo ノートブック内で手動確認）⏳

```
1. ⏳ backcast.py を開く → チャート表示      → SANDBOX_001 発火
2. ⏳ bt.buy() 実行                          → SANDBOX_002 発火
3. ⏳ bt.trades() 実行（保有中）              → SANDBOX_003 発火
4. ⏳ bt.sell() 実行                          → SANDBOX_004 発火
5. ⏳ bt.chart("7203") 再表示                 → SANDBOX_005 発火
6. ⏳ （_check_graduations フックで自動）      → SANDBOX_006 発火
```

> コード実装は完了。手動の E2E テストは Phase E 判断前に実施予定。

### Phase B テスト ⏳

```
1. ✅ SANDBOX_006 後、注入セルに reveal_data() の案内があること（injection-templates.ts L111 確認済み）
2. ⏳ bt.reveal_data()                       → BRIDGE_001 発火
3. ⏳ bt.reveal_data()（bt._data が空の場合） → ガイダンス表示
4. ⏳ bt.get_stock_daily("6758")             → BRIDGE_002 発火
5. ⏳ （_check_graduations フックで自動）      → BRIDGE_003 発火
```

### Phase C テスト ⏳

```
1. ⏳ 株を買って価格下落後 bt.trades()         → FAIL_001 発火
2. ⏳ 株を買って価格下落後 bt.step()           → FAIL_001 発火（step でも検出）
3. ⏳ 損失状態で bt.sell()                     → FAIL_002 発火
4. ⏳ 破産時（equity <= 0）の bt.step()        → try/except → FAIL_003 発火
5. ✅ FAIL_003 後に例外が再送出されること（コード確認: L104 `raise`）
```

### Phase D テスト ✅

```bash
cd frontend && pnpm test src/components/skill-tree/
# injection-templates.test.ts: 79件 PASS
```

### Phase E テスト ⏳

```
1. ⏳ sandbox.py / bridge.py / full_mode.py 削除後、backcast.py が正常動作すること
2. ⏳ game_setup.py からの参照が壊れていないこと
```

> Phase A-C の手動テスト完了後に実施。

### Phase G テスト ✅ (自動テスト PASS、手動テスト待ち)

```bash
cd frontend && pnpm test src/components/skill-tree/
# 全 355 件 PASS（reward-notification.test.tsx は削除済み）
```

検証項目:
- ✅ 型チェック: 変更に起因するエラーなし
- ✅ 自動テスト: skill-tree/ 全 355 件 PASS
- ⏳ スキルツリーパネルが**閉じた状態**でスキル解除 → 右下にトースト通知が表示されること
- ⏳ スキルツリーパネルが**開いた状態**でスキル解除 → 通知が1回だけ（二重表示なし）
- ⏳ マイルストーン達成時 → タイトルが「マイルストーン達成!」+ ボーナス表示
- ⏳ 既存の marimo トースト（パッケージ追加等）が壊れていないこと

---

## 6. ユーザー体験フロー（完成後）

```
[サンドボックス]
  backcast.py 起動 → チャート表示 (SANDBOX_001)
  bt.buy()  (SANDBOX_002)
  bt.trades()  (SANDBOX_003)
  bt.sell()  (SANDBOX_004)
  bt.chart("7203")  (SANDBOX_005 → SANDBOX_006 自動卒業 via _check_graduations)

  ※ 含み損が発生した場合: bt.step() or bt.trades() → FAIL_001
  ※ 損切りした場合: bt.sell() → FAIL_002

[ブリッジ]
  注入セルの案内に従い bt.reveal_data()  (BRIDGE_001: データの正体)
  bt.get_stock_daily("6758")  (BRIDGE_002 → BRIDGE_003 自動卒業 via _check_graduations)

[フルモード]
  自由にコードを書いて各スキルを達成
  (SETUP, DATA, SET, TRADE, CHART, IND, RISK 系)
  ※ 破産時: bt.step() → try/except → FAIL_003
```

---

## 7. レビュー対応一覧

| # | レビュー指摘 | 対応 | フェーズ |
|---|-------------|------|---------|
| 致命1 | FAIL_003 が到達不能 | `step()` を try/except で囲む | C |
| 致命2 | `_triggered_skills` 再起動で消える | ゲート廃止 + sync ヘルパー予約 | A1 |
| 致命3 | `completeSkillAtom` prerequisites 未チェック | prerequisites ガード追加 | A0 |
| 改善1 | buy()/sell() 失敗時の誤発火 | コメントで意図を明記、サンドボックスでは許容 | A |
| 改善2 | SANDBOX_006 テンプレートに reveal_data() なし | テンプレート修正 | B |
| 改善3 | FAIL_001 が trades() のみ | step() でもチェック追加 | C |
| 改善4 | _check_sandbox_graduation の散在 | emit_skill 内フックに統合 | A |
| 軽微1 | FAIL_002 prerequisites 誤記 | `[SANDBOX_004, FAIL_001]` に修正 | C |
| 軽微2 | setup_complete() の必要性 | 廃止、_check_graduations で自動化 | B |
| 軽微3 | SETUP テンプレート不足 | SETUP_002, SETUP_003 追加 | D |
| 軽微4 | テンプレート数 18→20 | 正しい数値に修正 | 計画書 |
| 見落1 | completeSkillWithRewardAtom も未チェック | 同様にガード追加 | A0 |
| 見落2 | BroadcastChannel + MutationObserver 二重発火 | 既存の重複チェックで吸収、テストで確認 | A0 |
| 見落3 | SETUP_001 自動トリガー不足 | フルモード入口は後続フェーズで対応 | 後日 |
| 見落4 | Phase E deprecation → 削除 | ファイル削除に方針変更 | E |
| 見落5 | Phase F スキップ妥当性 | 妥当と確認 | F |
