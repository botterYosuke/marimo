# -*- coding: utf-8 -*-
"""
スキルイベント発行ユーティリティ

スキル達成をBroadcastChannelで通知するための軽量関数。
AnyWidgetを使わずmarimo HTMLのみで動作。
"""
from __future__ import annotations

import base64
import json
import time

import marimo as mo
from marimo._output.hypertext import Html

from progress_manager import load_progress, add_completed_skill

_triggered_skills: set[str] = set(load_progress().get("completed_skills", []))


def get_triggered_skills() -> set[str]:
    """外部モジュールから triggered_skills を参照するためのアクセサ"""
    return _triggered_skills


def emit_skill(skill_id: str, context: dict | None = None) -> None:
    """スキル達成をBroadcastChannelで通知（重複発行防止付き）"""
    if skill_id in _triggered_skills:
        return
    _triggered_skills.add(skill_id)
    add_completed_skill(skill_id)

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
    # 卒業チェック
    _check_graduations()


def _check_graduations() -> None:
    """トラック卒業の自動チェック"""
    s = _triggered_skills
    # サンドボックス卒業
    if all(f"SANDBOX_{i:03d}" in s for i in range(1, 6)):
        emit_skill("SANDBOX_006")
    # ブリッジ卒業（BRIDGE_001 と BRIDGE_002 の両方が必要）
    if "BRIDGE_001" in s and "BRIDGE_002" in s:
        emit_skill("BRIDGE_003")


def sync_triggered_skills(skill_ids: list[str]) -> None:
    """フロントエンドの completedSkills を Python 側に同期"""
    _triggered_skills.update(skill_ids)


def reset_triggered_skills() -> None:
    """テスト用: _triggered_skills をクリアして dedup を無効化する"""
    _triggered_skills.clear()
