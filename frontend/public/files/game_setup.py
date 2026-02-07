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

from BackcastPro import get_stock_daily as _get_stock_daily
from backtest_wrapper import Backtest_Wrapper
from chart import backtest_chart, update_all_backtest_charts
from headless_broadcast import enable_headless_trade_events, publish_state_headless
from skill_events import get_triggered_skills, emit_skill

bt = Backtest_Wrapper(
    cash=100_000,
    commission=0.001,
    finalize_trades=True,
    color_theme="light",
)
enable_headless_trade_events(bt)
publish_state_headless(bt, status_label="準備完了", status_variant="secondary")


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
    df = get_stock_daily(code)
    set_data({code: df})
    # step()  # 1日だけ進める
    s = get_triggered_skills()

    emit_skill("SANDBOX_001")
    if "SANDBOX_003" in s and "SANDBOX_004" in s:
        emit_skill("SANDBOX_005")

    return backtest_chart(bt, code=code, **kwargs)

def set_data(dct):
    bt.set_data(dct)

def buy():
    """トヨタ(7203)の株を買う"""
    order = bt.buy()
    emit_skill("SANDBOX_002")
    update_all_backtest_charts(bt)
    publish_state_headless(bt, status_label="取引中", status_variant="default")
    return order

def sell():
    """保有中の株を売る"""
    order = bt.sell()
    emit_skill("SANDBOX_004")
    # 損切りチェック
    if any(hasattr(t, 'pl') and t.pl < 0 for t in bt.closed_trades):
        emit_skill("FAIL_002")
    update_all_backtest_charts(bt)
    publish_state_headless(bt, status_label="取引中", status_variant="default")
    return order

def step():
    """次の日に進む"""
    try:
        result = bt.step()
    except Exception:
        emit_skill("FAIL_003")
        update_all_backtest_charts(bt)
        publish_state_headless(bt, status_label="破産", status_variant="danger")
        raise
    _check_unrealized_loss()
    update_all_backtest_charts(bt)
    publish_state_headless(bt, status_label="取引中", status_variant="default")
    return result

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
    if "SANDBOX_002" in s and len(bt.trades) > 0:
        emit_skill("SANDBOX_003")
    if "SANDBOX_002" in s:
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
