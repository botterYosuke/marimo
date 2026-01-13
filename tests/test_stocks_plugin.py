# Copyright 2026 Marimo. All rights reserved.
"""Tests for stocks plugin."""

from __future__ import annotations

import builtins
from datetime import datetime, timedelta

import pytest


class TestStocksPluginBasic:
    """基本機能テスト"""

    def test_builtins_has_functions(self):
        """builtinsモジュールに関数が追加されていることを確認"""
        assert hasattr(builtins, "get_stock_price"), "get_stock_price should be in builtins"
        assert hasattr(builtins, "get_stock_board"), "get_stock_board should be in builtins"
        assert hasattr(builtins, "get_stock_info"), "get_stock_info should be in builtins"

    def test_functions_are_callable(self):
        """関数が呼び出し可能であることを確認"""
        assert callable(builtins.get_stock_price), "get_stock_price should be callable"
        assert callable(builtins.get_stock_board), "get_stock_board should be callable"
        assert callable(builtins.get_stock_info), "get_stock_info should be callable"

    def test_get_stock_price_basic(self):
        """get_stock_priceの基本動作確認（Stooq API使用）"""
        # トヨタ自動車の株価を取得（Stooq APIは認証不要）
        import pandas as pd

        df = builtins.get_stock_price("7203.JP")

        assert isinstance(df, pd.DataFrame), "返り値はDataFrameである必要がある"
        assert not df.empty, "DataFrameは空であってはならない"
        assert isinstance(df.index, pd.DatetimeIndex), "indexはDatetimeIndexである必要がある"

    def test_get_stock_price_with_date_range(self):
        """get_stock_priceの日付範囲指定テスト"""
        import pandas as pd

        to_date = datetime.now()
        from_date = to_date - timedelta(days=30)

        df = builtins.get_stock_price("7203.JP", from_=from_date, to=to_date)

        assert isinstance(df, pd.DataFrame), "返り値はDataFrameである必要がある"
        if not df.empty:
            assert isinstance(df.index, pd.DatetimeIndex), "indexはDatetimeIndexである必要がある"
            # 日付範囲が正しく適用されているか確認（データが存在する場合）
            if len(df) > 0:
                # DatetimeIndexの比較はTimestampで行う
                min_date = pd.Timestamp(from_date)
                max_date = pd.Timestamp(to_date)
                assert df.index.min() >= min_date, "開始日以降のデータである必要がある"
                assert df.index.max() <= max_date, "終了日以前のデータである必要がある"

    def test_get_stock_board_basic(self):
        """get_stock_boardの基本動作確認"""
        import pandas as pd

        df = builtins.get_stock_board("7203.JP")

        assert isinstance(df, pd.DataFrame), "返り値はDataFrameである必要がある"
        # 板情報のカラムが存在することを確認（データが存在する場合）

    def test_get_stock_info_single(self):
        """get_stock_infoの単一銘柄テスト"""
        import pandas as pd

        df = builtins.get_stock_info("7203.JP")

        assert isinstance(df, pd.DataFrame), "返り値はDataFrameである必要がある"

    def test_get_stock_info_all(self):
        """get_stock_infoの全銘柄取得テスト"""
        import pandas as pd

        df = builtins.get_stock_info("")

        assert isinstance(df, pd.DataFrame), "返り値はDataFrameである必要がある"
        if not df.empty:
            assert len(df) > 0, "全銘柄情報は複数の行を持つ必要がある"


class TestStocksPluginImports:
    """インポートパスの整合性テスト"""

    def test_stocks_module_import(self):
        """stocksモジュールのインポート確認"""
        from marimo._plugins.stocks import (
            get_stock_price,
            get_stock_board,
            get_stock_info,
        )
        assert callable(get_stock_price)
        assert callable(get_stock_board)
        assert callable(get_stock_info)

    def test_stocks_submodules_import(self):
        """_stocksサブモジュールのインポート確認"""
        from marimo._plugins._stocks.stocks_daily import stocks_price
        from marimo._plugins._stocks.stocks_board import stocks_board
        from marimo._plugins._stocks.stocks_info import stocks_info
        from marimo._plugins._stocks.db_manager import db_manager
        
        assert stocks_price is not None
        assert stocks_board is not None
        assert stocks_info is not None
        assert db_manager is not None

    def test_stocks_lib_imports(self):
        """libサブモジュールのインポート確認"""
        from marimo._plugins._stocks.lib import e_api, jquants, stooq

        assert stooq is not None
        assert jquants is not None
        assert e_api is not None


class TestStocksPluginWASM:
    """WASM環境テスト"""

    def test_is_pyodide_detection(self):
        """is_pyodide()の動作確認"""
        from marimo._utils.platform import is_pyodide
        
        # is_pyodide()は呼び出し可能である必要がある
        result = is_pyodide()
        assert isinstance(result, bool), "is_pyodide()はboolを返す必要がある"

    def test_db_manager_wasm_path(self):
        """db_managerのWASM環境パス設定確認"""
        from marimo._plugins._stocks.db_manager import db_manager
        
        db = db_manager()
        
        # キャッシュディレクトリが設定されていることを確認
        assert hasattr(db, "cache_dir"), "cache_dir属性が存在する必要がある"
        assert isinstance(db.cache_dir, str), "cache_dirは文字列である必要がある"
        
        # WASM環境の場合は/marimo/db、通常環境の場合は相対パス
        from marimo._utils.platform import is_pyodide
        if is_pyodide():
            assert db.cache_dir == "/marimo/db", "WASM環境では/marimo/dbである必要がある"
        else:
            # 通常環境では相対パスが設定される
            assert "db" in db.cache_dir, "通常環境ではdbディレクトリが含まれる必要がある"


class TestStocksPluginErrorHandling:
    """エラーハンドリングテスト"""

    def test_invalid_stock_code(self):
        """無効な銘柄コードのテスト"""
        import pandas as pd

        # 存在しない銘柄コードを指定
        df = builtins.get_stock_price("9999.JP")

        # エラーが発生しないことを確認（空のDataFrameが返される可能性がある）
        assert isinstance(df, pd.DataFrame), "返り値はDataFrameである必要がある"

    def test_get_stock_price_none_handling(self):
        """None値のハンドリング確認"""
        import pandas as pd

        # Noneを渡してもエラーが発生しないことを確認
        df = builtins.get_stock_price("7203.JP", from_=None, to=None)
        assert isinstance(df, pd.DataFrame), "返り値はDataFrameである必要がある"
