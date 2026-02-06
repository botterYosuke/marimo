from BackcastPro import Backtest, get_stock_daily as _get_stock_daily


class _ChartState:
    """チャート状態管理（chart.py の ChartStateManager と互換）"""

    def __init__(self, color_theme: str = "dark"):
        self.widgets: dict = {}
        self.last_index: dict[str, int] = {}
        self.indicators: dict[str, tuple] = {}
        # 色テーマのバリデーション
        valid_themes = ("dark", "light")
        if color_theme not in valid_themes:
            import warnings
            warnings.warn(
                f"Unknown color_theme '{color_theme}'. Using 'dark' as default. "
                f"Valid themes: {valid_themes}",
                stacklevel=3
            )
            color_theme = "dark"
        self.color_theme: str = color_theme

    def reset(self, clear_cache: bool = False) -> None:
        """チャート状態をリセット"""
        self.last_index = {}
        if clear_cache:
            self.widgets = {}
            self.indicators = {}


class Backtest_Wrapper(Backtest):
    def __init__(self, *args, color_theme: str = "dark", **kwargs):
        super().__init__(*args, **kwargs)
        self._chart_state = _ChartState(color_theme)
        self.start()
