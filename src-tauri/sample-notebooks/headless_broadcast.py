# -*- coding: utf-8 -*-
"""
ヘッドレスBroadcastChannel公開ユーティリティ

marimoセル内でBroadcastChannelにデータを公開するための
軽量なヘッドレス関数群。AnyWidgetを使わずmarimo HTMLのみで動作。
"""
from __future__ import annotations

import base64
import json
import time
from typing import TYPE_CHECKING

import marimo as mo
from marimo._output.hypertext import Html

if TYPE_CHECKING:
    from BackcastPro import Backtest


def publish_state_headless(
    bt: "Backtest",
    status_label: str = "Backtest",
    status_variant: str = "secondary",
) -> None:
    """バックテスト状態をBroadcastChannelで公開

    Args:
        bt: Backtestインスタンス
        status_label: ステータス表示ラベル
        status_variant: ステータスのバリアント ("secondary", "success", etc.)
    """
    state = bt.get_state_snapshot()
    state["status_label"] = status_label
    state["status_variant"] = status_variant

    # position がオブジェクトの場合は数値に変換
    pos = state.get("position")
    if isinstance(pos, dict):
        state["position"] = sum(pos.values())
    elif pos is not None and not isinstance(pos, (int, float)):
        try:
            state["position"] = float(pos)
        except (TypeError, ValueError):
            state["position"] = 0

    state_json = json.dumps(state)
    state_b64 = base64.b64encode(state_json.encode()).decode()
    unique_id = f"marimo-bc-{bt.step_index}-{int(time.time() * 1000)}"

    html = (
        f'<marimo-broadcast '
        f'id="{unique_id}" '
        f'channel="backtest_channel" '
        f'type="backtest_update" '
        f'payload="{state_b64}" '
        f'style="display:none;"></marimo-broadcast>'
    )
    mo.output.append(Html(html))


def publish_trade_event_headless(
    event_type: str,
    code: str,
    size: int,
    price: float,
    tag: str | None = None,
) -> None:
    """取引イベントをBroadcastChannelで公開

    Args:
        event_type: 'BUY' または 'SELL'
        code: 銘柄コード
        size: 取引数量（正の値）
        price: 約定価格
        tag: 取引タグ（オプション）
    """
    event = {
        "event_type": event_type,
        "code": code,
        "size": abs(size),
        "price": float(price),
        "tag": str(tag) if tag else None,
    }

    event_json = json.dumps(event)
    event_b64 = base64.b64encode(event_json.encode()).decode()

    html = (
        f'<div data-marimo-broadcast="trade_event_channel" '
        f'data-marimo-type="trade_event" '
        f'data-marimo-payload="{event_b64}" '
        f'style="display:none;"></div>'
    )
    mo.output.append(Html(html))


def enable_headless_trade_events(bt: "Backtest") -> None:
    """取引イベントをヘッドレスモードで自動発行するよう設定

    Args:
        bt: Backtestインスタンス
    """
    def on_trade(event_type: str, trade) -> None:
        publish_trade_event_headless(
            event_type=event_type,
            code=trade.code,
            size=trade.size,
            price=trade.entry_price,
            tag=getattr(trade, "tag", None),
        )
    bt.add_trade_callback(on_trade)