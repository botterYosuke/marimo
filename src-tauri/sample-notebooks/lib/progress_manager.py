# -*- coding: utf-8 -*-
"""
スキル進捗のファイルベース永続化マネージャー

Single Source of Truth: Python 側で JSON ファイルに読み書きし、
BroadcastChannel でフロントエンドに通知する。
"""
from __future__ import annotations

import base64
import json
import time
from pathlib import Path

import marimo as mo
from marimo._output.hypertext import Html
from marimo._runtime.context import get_context, ContextNotInitializedError


_CHANNEL = "progress_channel"
_DEFAULT_PROGRESS = {"version": 1, "completed_skills": []}


def _get_progress_path() -> Path | None:
    """進捗ファイルのパスを取得

    ノートブック名から導出: backcast.py → .backcast.progress.json
    """
    nb_dir = mo.notebook_dir()
    if nb_dir is None:
        return None
    try:
        ctx = get_context()
        filename = ctx.filename
    except (ContextNotInitializedError, AttributeError):
        return None
    if not filename:
        return None
    stem = Path(filename).stem
    return nb_dir / f".{stem}.progress.json"


def load_progress() -> dict:
    """ファイルから進捗を読み込み。不在/壊れ → デフォルト値"""
    path = _get_progress_path()
    if path is None or not path.exists():
        return dict(_DEFAULT_PROGRESS)
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        if data.get("version") != 1:
            return dict(_DEFAULT_PROGRESS)
        return data
    except (json.JSONDecodeError, OSError):
        return dict(_DEFAULT_PROGRESS)


def save_progress(completed_skills: list[str]) -> None:
    """進捗をファイルに保存"""
    path = _get_progress_path()
    if path is None:
        return
    data = {"version": 1, "completed_skills": completed_skills}
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


def add_completed_skill(skill_id: str) -> None:
    """スキルを完了リストに追加して保存"""
    data = load_progress()
    skills = data.get("completed_skills", [])
    if skill_id not in skills:
        skills.append(skill_id)
        save_progress(skills)


def broadcast_progress() -> None:
    """現在の進捗をBroadcastChannelでフロントエンドに通知"""
    data = load_progress()
    payload = json.dumps(data)
    payload_b64 = base64.b64encode(payload.encode()).decode()
    unique_id = f"progress-{int(time.time() * 1000)}"

    html = (
        f'<marimo-broadcast '
        f'id="{unique_id}" '
        f'channel="{_CHANNEL}" '
        f'type="progress_init" '
        f'payload="{payload_b64}" '
        f'style="display:none;"></marimo-broadcast>'
    )
    mo.output.append(Html(html))
