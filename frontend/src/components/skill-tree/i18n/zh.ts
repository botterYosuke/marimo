/* Copyright 2026 Marimo. All rights reserved. */

import type { SkillTranslationMap } from "./types";

export const zh: SkillTranslationMap = {
  skills: {
    // ========================================
    // 沙盒 (6 skills)
    // ========================================
    SANDBOX_001: {
      title: "欢迎来到市场",
      description: "启动Backcast游戏",
    },
    SANDBOX_002: {
      title: "首次购买",
      description: "使用 bt.buy() 购买股票",
    },
    SANDBOX_003: {
      title: "查看买入价格",
      description: "确认买入订单的成交价格",
    },
    SANDBOX_004: {
      title: "首次卖出",
      description: "卖出持有的股票（不论盈亏）",
    },
    SANDBOX_005: {
      title: "在图表上回顾",
      description: "查看图表上的买卖标记",
    },
    SANDBOX_006: {
      title: "沙盒毕业",
      description: "准备进入下一阶段",
    },

    // ========================================
    // 桥接 (3 skills)
    // ========================================
    BRIDGE_001: {
      title: "数据的真相",
      description: "了解沙盒中使用的数据来源",
    },
    BRIDGE_002: {
      title: "自己获取数据",
      description: "在沙盒中执行 get_stock_daily()",
    },
    BRIDGE_003: {
      title: "进入完整模式",
      description: "在新笔记本中从零完成设置",
    },

    // ========================================
    // 失败 (3 skills)
    // ========================================
    FAIL_001: {
      title: "首次浮亏",
      description: "体验持有股票跌破买入价",
    },
    FAIL_002: {
      title: "首次止损",
      description: "确认亏损的勇气",
    },
    FAIL_003: {
      title: "首次破产",
      description: "资金降至零或以下",
    },

    // ========================================
    // 设置 (5 skills)
    // ========================================
    SETUP_001: {
      title: "启动 marimo",
      description: "使用 marimo edit 打开笔记本",
    },
    SETUP_002: {
      title: "导入 BackcastPro",
      description: "from BackcastPro import Backtest, get_stock_daily",
    },
    SETUP_003: {
      title: "初始化 Backtest",
      description: "bt = Backtest(cash=1_000_000)",
    },
    SETUP_004: {
      title: "设置初始资金",
      description: "通过 cash 参数修改初始资金",
    },
    SETUP_005: {
      title: "设置手续费",
      description: "通过 commission 参数设置手续费率",
    },

    // ========================================
    // 数据 (6 skills)
    // ========================================
    DATA_001: {
      title: "使用 get_stock_daily",
      description: "使用 get_stock_daily(code) 获取股票数据",
    },
    DATA_002: {
      title: "查看股票数据",
      description: "检查获取的 DataFrame 内容",
    },
    DATA_003: {
      title: "理解 OHLCV 列",
      description: "理解 Open、High、Low、Close、Volume 的含义",
    },
    DATA_004: {
      title: "获取其他股票",
      description: "使用丰田以外的股票代码获取数据",
    },
    DATA_005: {
      title: "获取多只股票",
      description: "获取2只以上股票的数据",
    },
    DATA_006: {
      title: "指定日期范围",
      description: "获取特定时期的数据",
    },

    // ========================================
    // 数据设置 (3 skills)
    // ========================================
    SET_001: {
      title: "使用 set_data 设置数据",
      description: "通过 bt.set_data({code: df}) 注册数据",
    },
    SET_002: {
      title: "通过 bt.data 访问数据",
      description: "通过 bt.data[code] 引用当前数据",
    },
    SET_003: {
      title: "设置多只股票",
      description: "同时设置2只以上股票",
    },

    // ========================================
    // 交易 (10 skills)
    // ========================================
    TRADE_001: {
      title: "购买股票（完整模式）",
      description: "在完整模式下执行 bt.buy()",
    },
    TRADE_002: {
      title: "查看持仓",
      description: "通过 bt.position 或 bt.position_of(code) 查看",
    },
    TRADE_003: {
      title: "卖出股票",
      description: "通过 trade.close() 平仓",
    },
    TRADE_004: {
      title: "获利了结",
      description: "在盈利状态下卖出",
    },
    TRADE_005: {
      title: "止损卖出",
      description: "在亏损状态下决定卖出",
    },
    TRADE_006: {
      title: "使用标签",
      description: "通过 tag 参数记录交易理由",
    },
    TRADE_007: {
      title: "完成5笔交易",
      description: "完成共计5笔买卖交易",
    },
    TRADE_008: {
      title: "创建策略函数",
      description: "使用 def my_strategy(bt): 定义自定义策略",
    },
    TRADE_009: {
      title: "理解 bt.step()",
      description: "理解游戏循环的一步",
    },
    TRADE_010: {
      title: "使用 run() 运行",
      description: "理解与手动 step() 的区别",
    },

    // ========================================
    // 图表 (4 skills)
    // ========================================
    CHART_001: {
      title: "显示图表",
      description: "使用 bt.chart() 显示K线图",
    },
    CHART_002: {
      title: "查看交易标记",
      description: "在图表上查看买卖点",
    },
    CHART_003: {
      title: "显示指标",
      description: "使用 indicators 参数叠加指标",
    },
    CHART_004: {
      title: "显示多个指标",
      description: "同时显示2个以上指标",
    },

    // ========================================
    // 指标 (9 skills)
    // ========================================
    IND_001: {
      title: "计算移动平均线",
      description: "df['SMA'] = df['Close'].rolling(N).mean()",
    },
    IND_002: {
      title: "将SMA添加到DataFrame",
      description: "将计算的SMA作为DataFrame列添加",
    },
    IND_003: {
      title: "检测金叉",
      description: "短期均线上穿长期均线",
    },
    IND_004: {
      title: "检测死叉",
      description: "短期均线下穿长期均线",
    },
    IND_005: {
      title: "计算RSI",
      description: "计算相对强弱指数（14日）",
    },
    IND_006: {
      title: "RSI超买超卖判断",
      description: "RSI>70时卖出，RSI<30时买入",
    },
    IND_007: {
      title: "计算布林带",
      description: "计算 BB(20,2)",
    },
    IND_008: {
      title: "组合指标策略",
      description: "组合2个以上指标的策略",
    },
    IND_009: {
      title: "计算MACD",
      description: "计算 MACD(12,26,9)",
    },

    // ========================================
    // 风险 (10 skills)
    // ========================================
    RISK_001: {
      title: "设置止损",
      description: "通过 bt.buy(sl=价格) 下止损单",
    },
    RISK_002: {
      title: "设置止盈",
      description: "通过 bt.buy(tp=价格) 下止盈单",
    },
    RISK_003: {
      title: "同时使用止损/止盈",
      description: "同时设置两者",
    },
    RISK_004: {
      title: "风险回报比 1:2",
      description: "止盈幅度为止损幅度的2倍",
    },
    RISK_005: {
      title: "使用 finalize() 查看结果",
      description: "查看回测统计数据",
    },
    RISK_006: {
      title: "查看回撤",
      description: "查看最大回撤",
    },
    RISK_007: {
      title: "实现回撤20%以内",
      description: "最大回撤控制在20%以内",
    },
    RISK_008: {
      title: "实现回撤10%以内",
      description: "最大回撤控制在10%以内",
    },
    RISK_009: {
      title: "调整仓位大小",
      description: "只用部分资金进行交易",
    },
    RISK_010: {
      title: "实现50%以上胜率",
      description: "10笔以上交易中胜率超过50%",
    },
  },
};
