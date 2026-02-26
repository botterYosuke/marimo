// CDNフォールバック付きのインポート
let createChart;

async function loadLibrary() {
    const CDN_URLS = [
        'https://unpkg.com/lightweight-charts@4.2.0/dist/lightweight-charts.standalone.production.mjs',
        'https://cdn.jsdelivr.net/npm/lightweight-charts@4.2.0/dist/lightweight-charts.standalone.production.mjs',
    ];

    for (const url of CDN_URLS) {
        try {
            const mod = await import(url);
            return mod.createChart;
        } catch (e) {
            console.warn(`Failed to load from ${url}:`, e);
        }
    }
    throw new Error('All CDN sources failed');
}

// msgpack ライブラリ読み込み（Phase 3: バイナリプロトコル）
let msgpackDecode = null;
let msgpackLoadPromise = null;
async function loadMsgpack() {
    // ESM 互換の CDN URL のみ使用
    const CDN_URLS = [
        'https://cdn.jsdelivr.net/npm/msgpack-lite@0.1.26/+esm',
        'https://cdn.jsdelivr.net/npm/@msgpack/msgpack@3.0.0-beta2/+esm',
    ];
    for (const url of CDN_URLS) {
        try {
            const mod = await import(url);
            // msgpack-lite と @msgpack/msgpack の両方に対応
            return mod.default?.decode || mod.decode;
        } catch (e) {
            console.warn(`Failed to load msgpack from ${url}:`, e);
        }
    }
    console.warn('msgpack failed to load, falling back to JSON');
    return null;
}

// 遅延ロード用ヘルパー
async function ensureMsgpack() {
    if (msgpackDecode) return msgpackDecode;
    if (!msgpackLoadPromise) {
        msgpackLoadPromise = loadMsgpack();
    }
    msgpackDecode = await msgpackLoadPromise;
    return msgpackDecode;
}

// バーデータの検証
function isValidBar(bar) {
    return bar &&
        typeof bar.time === 'number' &&
        typeof bar.open === 'number' &&
        typeof bar.high === 'number' &&
        typeof bar.low === 'number' &&
        typeof bar.close === 'number';
}

// チャートインスタンスを保持するためのキー
// 重要: el ではなく model に保存する
// marimo の AnyWidgetPlugin は値が変わるたびに render() を呼び出し、
// 毎回異なる el 要素が渡される可能性がある。
// model オブジェクトは同一インスタンスが維持されるため、こちらに保存する。
const MODEL_CHART_KEY = '__lwcChart';
const MODEL_SERIES_KEY = '__lwcSeries';
const MODEL_VOLUME_KEY = '__lwcVolume';
const MODEL_OBSERVER_KEY = '__lwcObserver';
const MODEL_EL_KEY = '__lwcElement';
const MODEL_INDICATOR_SERIES_KEY = '__lwcIndicatorSeries';

async function render({ model, el }) {
    // 既存のチャートがあるか確認（べき等性のため）
    // marimo は値が変わるたびに render() を呼び出すが、
    // change:* イベントリスナーが既にデータを更新しているため、
    // ここでは新規作成をスキップする
    if (model[MODEL_CHART_KEY]) {
        // 新しい el が渡された場合、チャートを新しい el に移動
        const oldEl = model[MODEL_EL_KEY];
        if (oldEl !== el && oldEl && model[MODEL_CHART_KEY]) {
            // 既存のチャートコンテナを新しい el に移動
            while (oldEl.firstChild) {
                el.appendChild(oldEl.firstChild);
            }
            model[MODEL_EL_KEY] = el;
            // ResizeObserver を新しい el に付け替え
            if (model[MODEL_OBSERVER_KEY]) {
                model[MODEL_OBSERVER_KEY].disconnect();
                model[MODEL_OBSERVER_KEY].observe(el);
            }
            // 移動先の el に幅が確定している場合はチャートサイズを適用
            if (el.clientWidth > 0) {
                model[MODEL_CHART_KEY].applyOptions({ width: el.clientWidth });
            }
        }
        return () => {};
    }

    // ライブラリ読み込み
    try {
        createChart = await loadLibrary();
        // msgpack は遅延ロード (ensureMsgpack() で初回使用時にロード)
    } catch (e) {
        el.innerHTML = '<p style="color:#ef5350;padding:20px;">Chart library failed to load. Check network connection.</p>';
        console.error(e);
        return;
    }

    // el の幅が確定するまで待つ（3D portal タイミング対策）
    // CSS2DRenderer が gridContainer を DOM に追加する前にポータルがマウントされると
    // el.clientWidth が 0 になるため、幅が確定するまで待機する
    if (el.clientWidth === 0) {
        await new Promise((resolve) => {
            const ro = new ResizeObserver(entries => {
                if (entries[0].contentRect.width > 0) {
                    ro.disconnect();
                    resolve();
                }
            });
            ro.observe(el);
            // 安全タイムアウト: 3秒経っても幅が確定しない場合は続行
            setTimeout(() => { ro.disconnect(); resolve(); }, 3000);
        });
    }

    // チャート作成
    const options = model.get("options") || {};
    const chart = createChart(el, {
        width: el.clientWidth || 800,
        height: options.height || 400,
        layout: {
            background: { color: options.backgroundColor || '#1e1e1e' },
            textColor: options.textColor || '#d1d4dc',
        },
        grid: {
            vertLines: { color: options.gridColor || '#2B2B43' },
            horzLines: { color: options.gridColor || '#2B2B43' },
        },
        timeScale: {
            timeVisible: true,
            secondsVisible: false,
        },
        crosshair: {
            mode: 1,
        },
    });

    // チャートインスタンスを model に保存
    model[MODEL_CHART_KEY] = chart;
    model[MODEL_EL_KEY] = el;

    // 高頻度更新キーを設定（React 再レンダーをスキップ）
    // last_bar, last_bar_packed は model.on() で直接処理されるため、React の再レンダーは不要
    if (model.setDirectUpdateKeys) {
        model.setDirectUpdateKeys(['last_bar', 'last_bar_packed']);
    }

    // ローソク足シリーズ
    const upColor = options.upColor || '#26a69a';
    const downColor = options.downColor || '#ef5350';
    const candleSeries = chart.addCandlestickSeries({
        upColor: upColor,
        downColor: downColor,
        borderVisible: false,
        wickUpColor: upColor,
        wickDownColor: downColor,
    });
    model[MODEL_SERIES_KEY] = candleSeries;

    // 出来高シリーズ（オプション）
    let volumeSeries = null;
    const showVolume = options.showVolume !== false;
    if (showVolume) {
        volumeSeries = chart.addHistogramSeries({
            color: upColor,
            priceFormat: { type: 'volume' },
            priceScaleId: 'volume',
        });
        chart.priceScale('volume').applyOptions({
            scaleMargins: { top: 0.8, bottom: 0 },
        });
        model[MODEL_VOLUME_KEY] = volumeSeries;
    }

    // インジケーターライン系列（Map で管理）
    model[MODEL_INDICATOR_SERIES_KEY] = new Map();

    // 初期データ設定
    const data = model.get("data") || [];
    if (data.length > 0) {
        candleSeries.setData(data);

        // 表示範囲を制限（デフォルト60本≒約2か月）
        const visibleBars = options.visibleBars || 60;
        const visibleFrom = options.visibleFrom;
        if (data.length > visibleBars) {
            if (visibleFrom !== undefined && visibleFrom !== null) {
                chart.timeScale().setVisibleLogicalRange({
                    from: visibleFrom,
                    to: visibleFrom + visibleBars - 1,
                });
            } else {
                chart.timeScale().setVisibleLogicalRange({
                    from: data.length - visibleBars,
                    to: data.length - 1,
                });
            }
        } else {
            chart.timeScale().fitContent();
        }
    }

    // 出来高データ設定
    const volumeData = model.get("volume_data") || [];
    if (volumeSeries && volumeData.length > 0) {
        volumeSeries.setData(volumeData);
    }

    // マーカー設定
    const markers = model.get("markers") || [];
    if (markers.length > 0) {
        candleSeries.setMarkers(markers);
    }

    // インジケーターライン系列の初期化
    const indicatorOptions = model.get("indicator_options") || {};
    const indicatorData = model.get("indicator_series") || {};

    for (const [name, options] of Object.entries(indicatorOptions)) {
        const lineSeries = chart.addLineSeries({
            color: options.color || '#2196F3',
            lineWidth: options.lineWidth || 2,
            title: options.title || name,
            lastValueVisible: true,
            priceLineVisible: false,
        });

        model[MODEL_INDICATOR_SERIES_KEY].set(name, lineSeries);

        // 初期データがあれば設定
        if (indicatorData[name] && indicatorData[name].length > 0) {
            lineSeries.setData(indicatorData[name]);
        }
    }

    // バー数の正確な追跡（タイムスタンプベース）
    // 注: data は L573 で取得済みの変数を使用（タイミング問題回避）
    let actualBarCount = data.length;
    let lastTimestamp = data.length > 0 ? data[data.length - 1].time : 0;

    // データ全体が変更された時
    model.on("change:data", () => {
        const newData = model.get("data") || [];
        // カウンタリセット
        actualBarCount = newData.length;
        lastTimestamp = newData.length > 0 ? newData[newData.length - 1].time : 0;

        if (newData.length > 0) {
            candleSeries.setData(newData);

            // state restoration 後にマーカーが消えるのを防ぐ
            const currentMarkers = model.get("markers") || [];
            if (currentMarkers.length > 0) {
                candleSeries.setMarkers(currentMarkers);
            }

            // 表示範囲を制限
            const currentOptions = model.get("options") || {};
            const visibleBars = currentOptions.visibleBars || 60;
            const visibleFrom = currentOptions.visibleFrom;
            if (newData.length > visibleBars) {
                if (visibleFrom !== undefined && visibleFrom !== null) {
                    chart.timeScale().setVisibleLogicalRange({
                        from: visibleFrom,
                        to: visibleFrom + visibleBars - 1,
                    });
                } else {
                    chart.timeScale().setVisibleLogicalRange({
                        from: newData.length - visibleBars,
                        to: newData.length - 1,
                    });
                }
            } else {
                chart.timeScale().fitContent();
            }
        }
    });

    // 出来高データ変更時
    model.on("change:volume_data", () => {
        if (!volumeSeries) return;
        const newVolumeData = model.get("volume_data") || [];
        if (newVolumeData.length > 0) {
            volumeSeries.setData(newVolumeData);
        }
    });

    // マーカー変更時
    model.on("change:markers", () => {
        const newMarkers = model.get("markers") || [];
        candleSeries.setMarkers(newMarkers);
    });

    // インジケーターデータ変更時（全データ更新）
    model.on("change:indicator_series", () => {
        const newIndicatorData = model.get("indicator_series") || {};
        const indicatorSeriesMap = model[MODEL_INDICATOR_SERIES_KEY];

        if (!indicatorSeriesMap) return;

        for (const [name, series] of indicatorSeriesMap.entries()) {
            if (newIndicatorData[name] && newIndicatorData[name].length > 0) {
                series.setData(newIndicatorData[name]);
            }
        }
    });

    // インジケーターオプション変更時（系列再作成）
    model.on("change:indicator_options", () => {
        const newOptions = model.get("indicator_options") || {};
        const indicatorSeriesMap = model[MODEL_INDICATOR_SERIES_KEY];

        if (!indicatorSeriesMap) return;

        // 古い系列を削除
        for (const [name, series] of indicatorSeriesMap.entries()) {
            if (!newOptions[name]) {
                chart.removeSeries(series);
                indicatorSeriesMap.delete(name);
            }
        }

        // 新しい系列を追加
        const indicatorData = model.get("indicator_series") || {};
        for (const [name, options] of Object.entries(newOptions)) {
            if (!indicatorSeriesMap.has(name)) {
                const lineSeries = chart.addLineSeries({
                    color: options.color || '#2196F3',
                    lineWidth: options.lineWidth || 2,
                    title: options.title || name,
                    lastValueVisible: true,
                    priceLineVisible: false,
                });

                indicatorSeriesMap.set(name, lineSeries);

                if (indicatorData[name] && indicatorData[name].length > 0) {
                    lineSeries.setData(indicatorData[name]);
                }
            }
        }
    });

    // 最後のバーのみ更新（差分更新）
    // RAF ベースのバッチ更新: ブラウザの描画サイクルに同期して更新
    // 100ms間隔の更新でも最大60fpsに制限し、CPU負荷を軽減
    let pendingBar = null;
    let rafId = null;
    let isDisposed = false;

    const flushPendingBar = () => {
        // Guard: チャートが破棄されていたらスキップ
        if (isDisposed || !model[MODEL_CHART_KEY]) {
            pendingBar = null;
            rafId = null;
            return;
        }
        try {
            if (pendingBar && isValidBar(pendingBar)) {
                candleSeries.update(pendingBar);
            }
        } catch (e) {
            // チャートがRAF待機中に破棄された場合のエラーを抑制
            console.debug('Chart update skipped (disposed):', e);
        } finally {
            const hadBar = pendingBar !== null;
            pendingBar = null;
            rafId = null;

            // ACK 送信（描画完了通知）
            if (hadBar) {
                model.send({ type: 'render_ack' });
            }
        }
    };

    model.on("change:last_bar", () => {
        // チャートが破棄されていたら新規更新をスキップ
        if (isDisposed) return;

        const bar = model.get("last_bar");
        if (!isValidBar(bar)) return;

        // 複数の更新が同フレーム内に発生した場合、最新の値のみ使用
        pendingBar = bar;

        // 次の描画フレームでまとめて更新
        if (rafId === null) {
            rafId = requestAnimationFrame(flushPendingBar);
        }
    });

    // バイナリプロトコル用ハンドラ (Phase 3: INP改善)
    // msgpack でペイロードを削減し、パース時間を短縮
    // ハンドラは常に登録し、msgpack は遅延ロード
    model.on("change:last_bar_packed", async () => {
        if (isDisposed) return;

        const packed = model.get("last_bar_packed");
        if (!packed || packed.byteLength === 0) return;

        // 遅延ロード: 初回使用時に msgpack をロード
        const decode = await ensureMsgpack();
        if (!decode) {
            console.warn('msgpack unavailable, ignoring packed data');
            return;
        }

        try {
            const decoded = decode(new Uint8Array(packed));
            if (!Array.isArray(decoded) || decoded.length !== 5) {
                console.warn('Invalid packed bar format');
                return;
            }
            const [time, open, high, low, close] = decoded;
            if (!isValidBar({ time, open, high, low, close })) {
                console.warn('Invalid bar values after decode');
                return;
            }
            pendingBar = { time, open, high, low, close };

            if (rafId === null) {
                rafId = requestAnimationFrame(flushPendingBar);
            }
        } catch (e) {
            console.warn('msgpack decode failed:', e);
        }
    });

    // インジケーターの差分更新（RAFバッチング）
    let pendingIndicators = {};
    let indicatorRafId = null;

    const flushPendingIndicators = () => {
        if (isDisposed || !model[MODEL_CHART_KEY]) {
            pendingIndicators = {};
            indicatorRafId = null;
            return;
        }

        try {
            const indicatorSeriesMap = model[MODEL_INDICATOR_SERIES_KEY];
            if (!indicatorSeriesMap) return;

            for (const [name, data] of Object.entries(pendingIndicators)) {
                const series = indicatorSeriesMap.get(name);
                if (series && data && typeof data.time === 'number' && typeof data.value === 'number') {
                    series.update(data);
                }
            }
        } catch (e) {
            console.debug('Indicator update skipped (disposed):', e);
        } finally {
            pendingIndicators = {};
            indicatorRafId = null;
        }
    };

    model.on("change:last_indicators", () => {
        if (isDisposed) return;

        const newIndicators = model.get("last_indicators");
        if (!newIndicators || Object.keys(newIndicators).length === 0) return;

        pendingIndicators = { ...pendingIndicators, ...newIndicators };

        if (indicatorRafId === null) {
            indicatorRafId = requestAnimationFrame(flushPendingIndicators);
        }
    });

    // 新バーの追加（RAFバッチングなしで即座に処理）
    model.on("change:append_bars", () => {
        if (isDisposed || !model[MODEL_CHART_KEY]) return;

        const bars = model.get("append_bars") || [];
        if (bars.length === 0) return;

        try {
            for (const bar of bars) {
                if (isValidBar(bar)) {
                    candleSeries.update(bar);
                    // タイムスタンプが新しい場合のみカウント（上書きはカウントしない）
                    if (bar.time > lastTimestamp) {
                        actualBarCount++;
                        lastTimestamp = bar.time;
                    }
                }
            }

            // 表示範囲を更新
            const currentOptions = model.get("options") || {};
            const visibleBars = currentOptions.visibleBars || 60;

            if (actualBarCount <= visibleBars) {
                // 成長フェーズ: 全バーを表示（バーが増えるたび広がる）
                chart.timeScale().fitContent();
            } else {
                // スクロールフェーズ: 最新バーを右端に、visibleBars 本分を表示
                chart.timeScale().setVisibleLogicalRange({
                    from: actualBarCount - visibleBars,
                    to: actualBarCount - 1,
                });
            }
        } catch (e) {
            console.debug('Append bars failed:', e);
        }
    });

    // リスナー設定前に発生した last_bar の変更を適用
    // （チャート作成中にイベントが発火した場合への対処）
    const currentLastBar = model.get("last_bar");
    if (isValidBar(currentLastBar)) {
        candleSeries.update(currentLastBar);
    }

    // リサイズ対応
    const resizeObserver = new ResizeObserver(entries => {
        const { width } = entries[0].contentRect;
        if (width > 0) {
            chart.applyOptions({ width });
        }
    });
    resizeObserver.observe(el);
    model[MODEL_OBSERVER_KEY] = resizeObserver;

    // クリーンアップ関数を作成
    // 注: model に保存しているため、cleanup は最終的な破棄時のみ呼ばれる想定
    // marimo が毎回 cleanup を呼んでも、model にチャートが残っている限り再利用される
    const cleanup = () => {
        // 破棄フラグを設定（RAF コールバックでの更新を防止）
        isDisposed = true;

        // RAF をキャンセル（メモリリーク防止）
        if (rafId !== null) {
            cancelAnimationFrame(rafId);
            rafId = null;
        }
        pendingBar = null;

        // インジケーター RAF をキャンセル
        if (indicatorRafId !== null) {
            cancelAnimationFrame(indicatorRafId);
            indicatorRafId = null;
        }
        pendingIndicators = {};

        // model にチャートが存在しない場合はスキップ
        if (!model[MODEL_CHART_KEY]) {
            return;
        }

        // 現在の el が DOM に接続されている場合は削除しない
        // （ウィジェットがまだ表示されている可能性がある）
        const currentEl = model[MODEL_EL_KEY];
        if (currentEl && currentEl.isConnected) {
            return;
        }
        if (model[MODEL_OBSERVER_KEY]) {
            model[MODEL_OBSERVER_KEY].disconnect();
        }
        if (model[MODEL_CHART_KEY]) {
            model[MODEL_CHART_KEY].remove();
        }
        // チャート参照をクリア
        delete model[MODEL_CHART_KEY];
        delete model[MODEL_SERIES_KEY];
        delete model[MODEL_VOLUME_KEY];
        delete model[MODEL_OBSERVER_KEY];
        delete model[MODEL_EL_KEY];
        delete model[MODEL_INDICATOR_SERIES_KEY];
    };

    // 再描画時の状態復元: Pythonに最新状態を要求
    // 差分更新後に widget.data が古い場合でも正しいデータを表示できる
    // （_last_df が None の場合は Python 側でスキップされるため、初回レンダリングでも安全）
    model.send({ type: 'request_state' });

    return cleanup;
}

export default { render };
