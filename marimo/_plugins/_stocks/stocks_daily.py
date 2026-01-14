# Copyright 2026 Marimo. All rights reserved.
from marimo._plugins._stocks.lib.jquants import jquants
from marimo._plugins._stocks.lib.e_api import e_api
from marimo._plugins._stocks.lib.kabusap import kabusap
from marimo._plugins._stocks.lib.stooq import stooq_daily_quotes
from marimo._plugins._stocks.db_stocks_daily import db_stocks_daily
from marimo._plugins._stocks.lib.util import _Timestamp

import pandas as pd
import threading
from datetime import datetime
import logging

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

class stocks_price:
    """
    銘柄の株価データを取得するためのクラス
    """

    def __init__(self):
        self.db = db_stocks_daily()


    def get_japanese_stock_price_data(self, code = "", from_: datetime = None, to: datetime = None) -> pd.DataFrame:

        # 銘柄コードの検証
        if not code or not isinstance(code, str) or not code.strip():
            raise ValueError("銘柄コードが指定されていません")

        # 銘柄コードの正規化（.JPなどのサフィックスを除去）
        # J-Quants APIとe-支店APIでは4桁のコード（例: "7203"）が必要
        # Stooq APIでは".JP"サフィックス付き（例: "7203.JP"）が必要
        original_code = code
        normalized_code = code
        if code and isinstance(code, str) and code.strip():
            # .JPなどのサフィックスを除去
            if '.' in code:
                normalized_code = code.split('.')[0]
            else:
                normalized_code = code.strip()

        # from_/to の柔軟入力（str/date/pd.Timestamp）を正規化
        norm_from = _Timestamp(from_)
        norm_to = _Timestamp(to)

        if norm_from and norm_to and norm_from > norm_to:
            raise ValueError("開始日が終了日より後になっています")

        # 1) cacheフォルダから取得（元のコードで検索）
        df = self.db.load_stock_prices_from_cache(original_code, norm_from, norm_to)
        if df.empty:
            # 空のDataFrameの場合は次のデータソースを試す
            pass
        else:
            # Dateカラムをdatetime型に変換（文字列の場合も対応）
            if 'Date' in df.columns:
                df['Date'] = pd.to_datetime(df['Date'], errors='coerce')
                # 無効な日付を除外
                df = df.dropna(subset=['Date'])
                # Dateカラムをインデックスに設定し、DatetimeIndexに変換
                if not df.empty:
                    df = df.set_index('Date')
                    # インデックスを明示的にDatetimeIndexに変換
                    if not isinstance(df.index, pd.DatetimeIndex):
                        df.index = pd.DatetimeIndex(df.index)
            elif not isinstance(df.index, pd.DatetimeIndex):
                # Dateカラムがないが、インデックスがDatetimeIndexでない場合は変換を試みる
                try:
                    df.index = pd.DatetimeIndex(pd.to_datetime(df.index, errors='coerce'))
                except (ValueError, TypeError):
                    pass
            if not df.empty:
                return df

        # 2) 立花証券 e-支店から取得（正規化されたコードを使用）
        if not hasattr(self, 'e_shiten'):
            self.e_shiten = e_api()
        if self.e_shiten.isEnable:
            df = self.e_shiten.get_daily_quotes(code=normalized_code, from_=norm_from, to=norm_to)
            if df is not None and not df.empty:
                # DataFrameをcacheフォルダに保存（元のコードで保存）
                ## 非同期、遅延を避けるためデーモンスレッドで実行
                threading.Thread(target=self.db.save_stock_prices, args=(original_code, df), daemon=True).start()
                return df

        # 3) J-Quantsから取得（正規化されたコードを使用）
        if not hasattr(self, 'jq'):
            self.jq = jquants()
        if self.jq.isEnable:
            df = self.jq.get_daily_quotes(code=normalized_code, from_=norm_from, to=norm_to)
            if df is not None and not df.empty:
                # DataFrameをcacheフォルダに保存（元のコードで保存）
                ## 非同期、遅延を避けるためデーモンスレッドで実行
                threading.Thread(target=self.db.save_stock_prices, args=(original_code, df), daemon=True).start()
                return df

        # 4) stooqから取得（元のコードを使用、Stooq APIは.JPサフィックスが必要）
        df = stooq_daily_quotes(code=original_code, from_=norm_from, to=norm_to)
        if df is not None and not df.empty:
            # DataFrameをcacheフォルダに保存（元のコードで保存）
            ## 非同期、遅延を避けるためデーモンスレッドで実行
            threading.Thread(target=self.db.save_stock_prices, args=(original_code, df), daemon=True).start()
            return df

        # すべてのデータソースから取得できなかった場合は空のDataFrameを返す
        logger.warning(f"日本株式銘柄の取得に失敗しました: {original_code}")
        return pd.DataFrame()
