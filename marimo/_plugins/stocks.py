# Copyright 2026 Marimo. All rights reserved.
"""Stocks plugin for marimo.

Provides functions to get Japanese stock data:
- get_stock_price: Get daily stock price data
- get_stock_board: Get stock board information
- get_stock_info: Get stock information
"""
from __future__ import annotations

from datetime import datetime

import pandas as pd

from marimo._plugins._stocks.stocks_daily import stocks_price
from marimo._plugins._stocks.stocks_board import stocks_board
from marimo._plugins._stocks.stocks_info import stocks_info


def get_stock_price(
    code: str, from_: datetime | None = None, to: datetime | None = None
) -> pd.DataFrame:
    """
    株価四本値（/prices/daily_quotes）

    - 株価は分割・併合を考慮した調整済み株価（小数点第２位四捨五入）と調整前の株価を取得することができます。
    - データの取得では、銘柄コード（code）または日付（date）の指定が必須となります。
    
    Args:
        code: 銘柄コード（例: "7203.JP"）
        from_: 開始日（datetime, str, または None）
        to: 終了日（datetime, str, または None）
    
    Returns:
        DataFrame: 株価データ（Date列がindexとして設定されている）
    """
    sp = stocks_price()

    # 株価データを取得（内部で自動的にデータベースに保存される）
    df = sp.get_japanese_stock_price_data(code=code, from_=from_, to=to)
    
    # Date列が存在する場合、indexとして設定する（Backtestで使用するため）
    if df is not None and not df.empty:
        if 'Date' in df.columns:
            # Date列をdatetime型に変換してindexに設定
            df = df.copy()  # 元のDataFrameを変更しないようにコピー
            df['Date'] = pd.to_datetime(df['Date'])
            df.set_index('Date', inplace=True)
            # indexをソート（Backtestで必要）
            df.sort_index(inplace=True)
        elif not isinstance(df.index, pd.DatetimeIndex):
            # Date列がなく、indexもDatetimeIndexでない場合の警告
            import warnings
            warnings.warn(
                f"get_stock_price('{code}') が返したDataFrameに'Date'列がありません。"
                "Backtestで使用するには、Date列が必要です。",
                stacklevel=2
            )
    
    return df


def get_stock_board(code: str) -> pd.DataFrame:
    """
    板情報を取得する
    
    Args:
        code: 銘柄コード（例: "7203.JP"）
    
    Returns:
        DataFrame: 板情報
    """
    sb = stocks_board()

    return sb.get_japanese_stock_board_data(code=code)


def get_stock_info(code: str = "", date: datetime | None = None) -> pd.DataFrame:
    """
    銘柄の情報を取得する
    
    Args:
        code: 銘柄コード（例: "7203.JP"、空文字列の場合は全銘柄）
        date: 日付（datetime, str, または None）
    
    Returns:
        DataFrame: 銘柄情報
    """
    si = stocks_info()    

    return si.get_japanese_listed_info(code=code, date=date)
