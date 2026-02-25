# -*- coding: utf-8 -*-
"""
ゲーム初期化ユーティリティ

Backtestインスタンスの生成・データ読み込み・チャート表示を
ワンステップで提供する。

import game_setup as gs で1行インポート。
関数追加時に利用側の変更は不要。
"""
from __future__ import annotations

import functools

import marimo as mo

from BackcastPro import get_stock_daily as _get_stock_daily, BankruptError
from backtest_wrapper import Backtest_Wrapper
from backtest_chart import backtest_chart, update_all_backtest_charts
from headless_broadcast import enable_headless_trade_events, publish_state_headless
from progress_manager import broadcast_progress
from skill_events import get_triggered_skills, emit_skill

bt = Backtest_Wrapper(
    cash=100_000,
    commission=0.001,
    finalize_trades=True,
    color_theme="light",
)
enable_headless_trade_events(bt)
publish_state_headless(bt, status_label="Ready", status_variant="secondary")  # mo.output.append()
broadcast_progress()  # mo.output.append()


# ---------------------------------------------------------------------------
# スキルゲーティング
# ---------------------------------------------------------------------------

def _skill_gate(required_skill: str, hint: str = ""):
    """スキル未解除なら callout メッセージを表示して None を返す"""
    def decorator(fn):
        @functools.wraps(fn)
        def wrapper(*args, **kwargs):
            if required_skill not in get_triggered_skills():
                mo.output.append(mo.callout(
                    mo.md(
                        f"`{fn.__name__}()` は"
                        f"「{hint}」を達成すると解除されます"
                    ),
                    kind="warn",
                ))
                return None
            return fn(*args, **kwargs)
        return wrapper
    return decorator


# ---------------------------------------------------------------------------
# サンドボックス関数（ゲートなし）
# ---------------------------------------------------------------------------

def chart(code: str, **kwargs):
    """銘柄データを取得してチャートを表示

    Args:
        code: 銘柄コード（例: "7203"）
        **kwargs: backtest_chart に渡す追加オプション
    """
    # _get_stock_daily を直接使用（get_stock_daily はBRIDGE_002を発火するため）
    df = _get_stock_daily(code)
    set_data({code: df})
    s = get_triggered_skills()

    emit_skill("SANDBOX_001")
    if "SANDBOX_003" in s and "SANDBOX_004" in s and "SANDBOX_005" not in s:
        emit_skill("SANDBOX_005")

    return backtest_chart(bt, code=code, **kwargs)

def set_data(dct):
    bt.set_data(dct)

def buy():
    """トヨタ(7203)の株を買う"""
    if not bt._data:
        mo.output.append(mo.callout(
            mo.md("まず `bt.chart('7203')` でチャートを表示してください"),
            kind="warn",
        ))
        return None
    if bt.position.size != 0:
        mo.output.append(mo.callout(
            mo.md("すでに株を保有中です。`bt.sell()` で売却してから再度購入してください"),
            kind="warn",
        ))
        return None
    order = bt.buy()
    price = bt._broker_instance.last_price(order.code)
    emit_skill("SANDBOX_002")
    update_all_backtest_charts(bt)
    publish_state_headless(bt, status_label="Trading", status_variant="default")
    mo.output.append(mo.callout(
        mo.md(f"**買い注文を出しました** — {order.code} @ ¥{price:,.0f}"),
        kind="success",
    ))

def sell():
    """保有中の株を売る"""
    if bt.position.size == 0:
        mo.output.append(mo.callout(
            mo.md("保有中の株がありません。まず `bt.buy()` で株を購入してください"),
            kind="warn",
        ))
        return None
    order = bt.sell()
    price = bt._broker_instance.last_price(order.code)
    emit_skill("SANDBOX_004")
    update_all_backtest_charts(bt)
    publish_state_headless(bt, status_label="Trading", status_variant="default")
    mo.output.append(mo.callout(
        mo.md(f"**売り注文を出しました** — {order.code} @ ¥{price:,.0f}"),
        kind="success",
    ))

def step():
    """次の日に進む"""
    prev_closed_count = len(bt.closed_trades)
    try:
        result = bt.step()
    except BankruptError:
        emit_skill("FAIL_003")
        update_all_backtest_charts(bt)
        publish_state_headless(bt, status_label="Bankrupt", status_variant="danger")
        raise
    _check_unrealized_loss()
    # FAIL_002: sell() 後の step() で新たに決済されたトレードに損失があれば発火
    new_closed = bt.closed_trades[prev_closed_count:]
    if new_closed and any(hasattr(t, 'pl') and t.pl < 0 for t in new_closed):
        emit_skill("FAIL_002")
    update_all_backtest_charts(bt)
    # ゲーム終了時は "Finished"、継続中は "Trading" を表示
    if result:
        publish_state_headless(bt, status_label="Trading", status_variant="default")
    else:
        publish_state_headless(bt, status_label="Finished", status_variant="secondary")
    _format_step_summary(result)

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

def trades():
    """保有中の取引を確認"""
    s = get_triggered_skills()
    # SANDBOX_002（買い注文）実行済みなら trades() 呼び出しでスキル発火
    # （bt.trades が空でも buy() 後に呼んだこと自体を評価）
    if "SANDBOX_002" in s:
        emit_skill("SANDBOX_003")
        if any(hasattr(t, 'pl') and t.pl < 0 for t in bt.trades):
            emit_skill("FAIL_001")
    return bt.trades


# ---------------------------------------------------------------------------
# ヘルパー
# ---------------------------------------------------------------------------

def _check_unrealized_loss():
    """含み損チェック（FAIL_001 トリガー）"""
    if "SANDBOX_002" in get_triggered_skills():
        if any(hasattr(t, 'pl') and t.pl < 0 for t in bt.trades):
            emit_skill("FAIL_001")


def _format_step_summary(result: bool) -> None:
    """step() の結果をユーザーフレンドリーなサマリーとして表示"""
    if result:
        date_str = bt.current_time.strftime("%Y-%m-%d") if bt.current_time else "?"
        equity = bt.equity

        price_str = ""
        if bt._current_data:
            code = list(bt._current_data.keys())[0]
            current_price = bt._current_data[code]["Close"].iloc[-1]
            price_str = f"株価: ¥{current_price:,.0f}  |  "

        pl_str = ""
        if bt.position.size != 0:
            pl = bt.position.pl
            sign = "+" if pl >= 0 else ""
            pl_str = f"  |  含み損益: ¥{sign}{pl:,.0f}"

        summary = (
            f"**{date_str}** に進みました\n\n"
            f"{price_str}資産: **¥{equity:,.0f}**{pl_str}"
        )
        mo.output.append(mo.callout(mo.md(summary), kind="info"))
    else:
        equity = bt.equity
        initial_cash = bt._broker_factory.keywords.get("cash", 100_000)
        total_return = (equity - initial_cash) / initial_cash * 100
        sign = "+" if total_return >= 0 else ""

        summary = (
            f"**最終日に到達しました！**\n\n"
            f"最終資産: **¥{equity:,.0f}**  |  "
            f"リターン: **{sign}{total_return:.1f}%**"
        )
        kind = "success" if total_return >= 0 else "danger"
        mo.output.append(mo.callout(mo.md(summary), kind=kind))


# ---------------------------------------------------------------------------
# ブリッジ関数
# ---------------------------------------------------------------------------

def get_stock_daily(code: str, **kwargs):
    """銘柄コードから株価データを取得

    Args:
        code: 銘柄コード（例: "7203", "6758"）
    """
    result = _get_stock_daily(code, **kwargs)
    emit_skill("BRIDGE_002")
    return result
