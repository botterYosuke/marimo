/* Copyright 2026 Marimo. All rights reserved. */

import type { SkillTranslationMap } from "./types";

export const en: SkillTranslationMap = {
  skills: {
    // ========================================
    // Sandbox (6 skills)
    // ========================================
    SANDBOX_001: {
      title: "Welcome to the Market",
      description: "Launch the Backcast game",
    },
    SANDBOX_002: {
      title: "First Purchase",
      description: "Buy stocks with bt.buy()",
    },
    SANDBOX_003: {
      title: "Check Your Buy Price",
      description: "Check the fill price of your buy order",
    },
    SANDBOX_004: {
      title: "First Sale",
      description: "Sell your holdings (profit or loss)",
    },
    SANDBOX_005: {
      title: "Review on Chart",
      description: "Check trade markers on the chart",
    },
    SANDBOX_006: {
      title: "Sandbox Graduate",
      description: "Ready to move to the next stage",
    },

    // ========================================
    // Bridge (3 skills)
    // ========================================
    BRIDGE_001: {
      title: "Behind the Data",
      description: "Discover the source of sandbox data",
    },
    BRIDGE_002: {
      title: "Fetch Data Yourself",
      description: "Run get_stock_daily() in the sandbox",
    },
    BRIDGE_003: {
      title: "Enter Full Mode",
      description: "Complete setup from scratch in a new notebook",
    },

    // ========================================
    // Fail (3 skills)
    // ========================================
    FAIL_001: {
      title: "First Unrealized Loss",
      description: "Experience your stock falling below purchase price",
    },
    FAIL_002: {
      title: "First Stop Loss",
      description: "The courage to lock in a loss",
    },
    FAIL_003: {
      title: "First Bankruptcy",
      description: "Your funds drop to zero or below",
    },

    // ========================================
    // Setup (5 skills)
    // ========================================
    SETUP_001: {
      title: "Launch marimo",
      description: "Open a notebook with marimo edit",
    },
    SETUP_002: {
      title: "Import BackcastPro",
      description: "from BackcastPro import Backtest, get_stock_daily",
    },
    SETUP_003: {
      title: "Initialize Backtest",
      description: "bt = Backtest(cash=1_000_000)",
    },
    SETUP_004: {
      title: "Set Initial Capital",
      description: "Change initial funds with the cash parameter",
    },
    SETUP_005: {
      title: "Set Commission",
      description: "Set commission rate with the commission parameter",
    },

    // ========================================
    // Data (6 skills)
    // ========================================
    DATA_001: {
      title: "Use get_stock_daily",
      description: "Fetch stock data with get_stock_daily(code)",
    },
    DATA_002: {
      title: "Inspect Stock Data",
      description: "Examine the contents of the fetched DataFrame",
    },
    DATA_003: {
      title: "Understand OHLCV",
      description: "Understand Open, High, Low, Close, Volume columns",
    },
    DATA_004: {
      title: "Fetch Another Stock",
      description: "Get data using a stock code other than Toyota",
    },
    DATA_005: {
      title: "Fetch Multiple Stocks",
      description: "Get data for 2 or more stocks",
    },
    DATA_006: {
      title: "Specify Date Range",
      description: "Fetch data for a specific period",
    },

    // ========================================
    // Set (3 skills)
    // ========================================
    SET_001: {
      title: "Set Data with set_data",
      description: "Register data with bt.set_data({code: df})",
    },
    SET_002: {
      title: "Access Data with bt.data",
      description: "Reference current data via bt.data[code]",
    },
    SET_003: {
      title: "Set Multiple Stocks",
      description: "Set 2 or more stocks simultaneously",
    },

    // ========================================
    // Trade (10 skills)
    // ========================================
    TRADE_001: {
      title: "Buy Stocks (Full Mode)",
      description: "Execute bt.buy() in full mode",
    },
    TRADE_002: {
      title: "Check Position",
      description: "Check with bt.position or bt.position_of(code)",
    },
    TRADE_003: {
      title: "Sell Stocks",
      description: "Close position with trade.close()",
    },
    TRADE_004: {
      title: "Take Profit",
      description: "Sell while in profit",
    },
    TRADE_005: {
      title: "Cut Losses",
      description: "Decide to sell at a loss",
    },
    TRADE_006: {
      title: "Use Tags",
      description: "Record trade reasons with the tag argument",
    },
    TRADE_007: {
      title: "Complete 5 Trades",
      description: "Complete a total of 5 buy/sell transactions",
    },
    TRADE_008: {
      title: "Create a Strategy Function",
      description: "Define a custom strategy with def my_strategy(bt):",
    },
    TRADE_009: {
      title: "Understand bt.step()",
      description: "Understand one step of the game loop",
    },
    TRADE_010: {
      title: "Run with run()",
      description: "Understand the difference from manual step()",
    },

    // ========================================
    // Chart (4 skills)
    // ========================================
    CHART_001: {
      title: "Display Chart",
      description: "Show candlestick chart with bt.chart()",
    },
    CHART_002: {
      title: "Check Trade Markers",
      description: "Review buy/sell points on the chart",
    },
    CHART_003: {
      title: "Display Indicator",
      description: "Overlay indicators with the indicators argument",
    },
    CHART_004: {
      title: "Display Multiple Indicators",
      description: "Show 2 or more indicators simultaneously",
    },

    // ========================================
    // Indicator (9 skills)
    // ========================================
    IND_001: {
      title: "Calculate Moving Average",
      description: "df['SMA'] = df['Close'].rolling(N).mean()",
    },
    IND_002: {
      title: "Add SMA to DataFrame",
      description: "Add calculated SMA as a DataFrame column",
    },
    IND_003: {
      title: "Detect Golden Cross",
      description: "Short-term MA crosses above long-term MA",
    },
    IND_004: {
      title: "Detect Death Cross",
      description: "Short-term MA crosses below long-term MA",
    },
    IND_005: {
      title: "Calculate RSI",
      description: "Calculate Relative Strength Index (14-day)",
    },
    IND_006: {
      title: "RSI Overbought/Oversold",
      description: "Sell when RSI>70, buy when RSI<30",
    },
    IND_007: {
      title: "Calculate Bollinger Bands",
      description: "Calculate BB(20,2)",
    },
    IND_008: {
      title: "Combined Indicator Strategy",
      description: "Strategy combining 2 or more indicators",
    },
    IND_009: {
      title: "Calculate MACD",
      description: "Calculate MACD(12,26,9)",
    },

    // ========================================
    // Risk (10 skills)
    // ========================================
    RISK_001: {
      title: "Set Stop Loss",
      description: "Place SL order with bt.buy(sl=price)",
    },
    RISK_002: {
      title: "Set Take Profit",
      description: "Place TP order with bt.buy(tp=price)",
    },
    RISK_003: {
      title: "Use SL/TP Together",
      description: "Set both simultaneously",
    },
    RISK_004: {
      title: "Risk-Reward 1:2",
      description: "Trade with TP width twice the SL width",
    },
    RISK_005: {
      title: "Check Results with finalize()",
      description: "Review backtest statistics",
    },
    RISK_006: {
      title: "Check Drawdown",
      description: "Review Max Drawdown",
    },
    RISK_007: {
      title: "Achieve DD Under 20%",
      description: "Keep max drawdown within 20%",
    },
    RISK_008: {
      title: "Achieve DD Under 10%",
      description: "Keep max drawdown within 10%",
    },
    RISK_009: {
      title: "Adjust Position Size",
      description: "Trade with only a portion of your capital",
    },
    RISK_010: {
      title: "Achieve 50%+ Win Rate",
      description: "Win rate over 50% with 10+ trades",
    },
  },
};
