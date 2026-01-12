/* Copyright 2026 Marimo. All rights reserved. */

import { CSS2DRenderer, CSS2DObject } from "three/examples/jsm/renderers/CSS2DRenderer.js";
import * as THREE from "three";

/**
 * GridCSS2DService
 *
 * CSS2DRendererの初期化と管理を担当
 * - CSS2DRendererの初期化
 * - コンテナDOM要素の作成と管理
 * - コンテナ全体をCSS2DObjectとして3D空間に配置
 * - カメラ距離に基づくスケール調整
 * - レンダリングループの管理
 */
export class GridCSS2DService {
  private css2DRenderer?: CSS2DRenderer;
  private css2DObject?: CSS2DObject;
  private isContainerVisible = true;
  private divContainer?: HTMLDivElement;

  // スケール計算用の設定
  private baseDistance: number | null = null; // 基準距離（起動時の距離で初期化）
  private readonly MIN_SCALE = 0.1; // 最小スケール
  private readonly MAX_SCALE = 5.0; // 最大スケール
  private readonly DEFAULT_BASE_DISTANCE = 1200; // デフォルト基準距離

  // レンダリング最適化用
  private needsRender = false;
  private isInteracting = false;
  private lastCameraPosition = new THREE.Vector3();
  private readonly CAMERA_MOVE_THRESHOLD = 0.1; // 最小移動量

  // スタイル要素のID（重複チェック用）
  private static readonly STYLE_ELEMENT_ID = "marimo-grid-3d-container-styles";

  /**
   * CSS2DRendererとコンテナを初期化します
   */
  initializeRenderer(hostElement: HTMLElement, width: number, height: number): CSS2DRenderer {
    this.dispose();

    this.css2DRenderer = new CSS2DRenderer();
    this.css2DRenderer.setSize(width, height);

    // CSS2DRendererのスタイル設定
    const rendererElement = this.css2DRenderer.domElement;
    rendererElement.style.position = "absolute";
    rendererElement.style.top = "0";
    rendererElement.style.left = "0";
    rendererElement.style.pointerEvents = "none";
    // z-index: 5 - gridを最下層に配置（3D物体をgridとcellの間に配置するため）
    rendererElement.style.zIndex = "5";

    hostElement.appendChild(rendererElement);

    // コンテナを作成
    this.createContainer();
    this.applyContainerVisibility();

    return this.css2DRenderer;
  }

  /**
   * コンテナDOM要素を作成します
   */
  private createContainer(): HTMLDivElement {
    if (this.divContainer) {
      this.applyContainerVisibility();
      return this.divContainer;
    }

    const container = document.createElement("div");
    container.className = "grid-3d-container";

    // CSSスタイルをインラインで設定
    container.style.position = "absolute";
    container.style.top = "0";
    container.style.left = "0";
    container.style.width = "100%";
    container.style.height = "100%";
    container.style.pointerEvents = "none";
    container.style.zIndex = "1";
    // 背景や装飾を非表示にする
    container.style.background = "transparent";
    container.style.border = "none";
    container.style.boxShadow = "none";

    // 子要素のスタイルを上書きするCSSを追加
    this.injectContainerStyles();

    this.divContainer = container;
    this.applyContainerVisibility();

    return container;
  }

  /**
   * 子要素のスタイルを上書きするCSSを注入します
   */
  private injectContainerStyles(): void {
    // 既存のスタイル要素が存在する場合はスキップ
    if (document.getElementById(GridCSS2DService.STYLE_ELEMENT_ID)) {
      return;
    }

    const style = document.createElement("style");
    style.id = GridCSS2DService.STYLE_ELEMENT_ID;
    style.textContent = `
      /* グリッドレイアウトの背景・ボーダー・シャドウを非表示 */
      .grid-3d-container .react-grid-layout {
        background: transparent !important;
        background-image: none !important;
        border: none !important;
        box-shadow: none !important;
      }

      /* borderedモード時の背景・ボーダー・シャドウを非表示 */
      .grid-3d-container .bg-background.border-t.border-x {
        background: transparent !important;
        border: none !important;
        box-shadow: none !important;
      }

      /* サイドバーの背景・ボーダー・シャドウを非表示 */
      .grid-3d-container .flex-none.flex.flex-col.w-\\[300px\\] {
        background: transparent !important;
        border: none !important;
        box-shadow: none !important;
      }
    `;
    document.head.appendChild(style);
  }

  /**
   * 注入したスタイル要素を削除します
   */
  private removeContainerStyles(): void {
    const styleElement = document.getElementById(GridCSS2DService.STYLE_ELEMENT_ID);
    if (styleElement) {
      styleElement.remove();
    }
  }

  /**
   * コンテナを取得します
   * コンテナが存在しない場合は自動的に作成します
   */
  getContainer(): HTMLDivElement | undefined {
    if (!this.divContainer) {
      this.createContainer();
    }
    return this.divContainer;
  }

  /**
   * コンテナを3D空間に配置します
   */
  attachContainerToScene(
    scene: THREE.Scene,
    position: THREE.Vector3 = new THREE.Vector3(0, 0, 0),
  ): CSS2DObject | null {
    if (!this.divContainer) {
      this.createContainer();
    }

    if (!this.divContainer) {
      console.warn(
        "grid-3d-container is not created. Call initializeRenderer() first.",
      );
      return null;
    }

    // 既存のオブジェクトを削除
    if (this.css2DObject?.parent) {
      this.css2DObject.parent.remove(this.css2DObject);
    }

    // CSS2DObjectを作成
    this.css2DObject = new CSS2DObject(this.divContainer);
    this.css2DObject.position.copy(position);
    this.css2DObject.scale.set(1, 1, 1);

    // シーンに追加
    scene.add(this.css2DObject);

    return this.css2DObject;
  }

  /**
   * CSS2DObjectを取得します
   */
  getCSS2DObject(): CSS2DObject | undefined {
    return this.css2DObject;
  }

  /**
   * コンテナの3D位置を取得します
   */
  getContainerPosition(): THREE.Vector3 | undefined {
    if (this.css2DObject) {
      return this.css2DObject.position.clone();
    }
    return undefined;
  }

  /**
   * カメラからの距離に基づいてスケール値を計算します
   */
  private calculateScale(distance: number): number {
    if (distance <= 0) {
      return this.MAX_SCALE;
    }

    // 基準距離が設定されていない場合は、現在の距離を基準距離として使用
    if (this.baseDistance === null) {
        this.baseDistance = this.DEFAULT_BASE_DISTANCE;
    }

    // スケール = 基準距離 / 現在の距離
    // 起動時（基準距離 = 現在の距離）の場合はスケール1になる
    const scale = this.baseDistance / distance;

    // スケールを MIN_SCALE ~ MAX_SCALE の範囲にクランプ
    return Math.max(this.MIN_SCALE, Math.min(this.MAX_SCALE, scale));
  }

  /**
   * コンテナのスケールを更新する共通ロジック
   */
  private updateContainerScaleInternal(
    container: HTMLDivElement,
    css2DObject: CSS2DObject,
    camera: THREE.PerspectiveCamera,
    distanceOffset: number = 0
  ): void {
    // カメラとCSS2Dオブジェクトの3D空間での位置を取得
    const cameraPosition = camera.position;
    const objectPosition = new THREE.Vector3();
    css2DObject.getWorldPosition(objectPosition);

    // 距離を計算（y方向のみ）+ オフセット
    const distance = Math.abs(cameraPosition.y - objectPosition.y) + distanceOffset;

    // スケールを計算
    const scale = this.calculateScale(distance);

    // CSS2DRendererが設定した既存のtransformを取得
    const existingTransform = container.style.transform || "";

    // 既存のtransformからscale()を削除（既に存在する場合）
    const cleanedTransform = existingTransform.replace(/\s*scale\([^)]*\)/gi, "");

    // 既存のtransformにscale()を追加
    const newTransform = cleanedTransform.trim()
      ? `${cleanedTransform.trim()} scale(${scale})`
      : `scale(${scale})`;

    // DOM要素のtransformスタイルを更新
    container.style.transform = newTransform;
    container.style.transformOrigin = "center center";
  }

  /**
   * コンテナのスケールを更新します（内部用）
   */
  private updateContainerScale(camera: THREE.PerspectiveCamera): void {
    if (!this.divContainer || !this.css2DObject) {
      return;
    }
    this.updateContainerScaleInternal(this.divContainer, this.css2DObject, camera);
  }

  /**
   * 外部からコンテナのスケールを強制的に更新します
   * CellCSS2DRenderer.render()がGrid containerのtransformを上書きした後に呼び出されます
   */
  forceUpdateContainerScale(camera: THREE.PerspectiveCamera): void {
    this.updateContainerScale(camera);
    // lastCameraPositionを更新して、次のフレームでのカメラ移動検出を正確にする
    this.lastCameraPosition.copy(camera.position);
  }

  /**
   * CSS2Dシーンをレンダリングします
   */
  render(
    scene: THREE.Scene,
    camera: THREE.PerspectiveCamera,
  ): void {
    if (!this.css2DRenderer) {
      return;
    }

    // カメラが移動した場合も再レンダリング
    const cameraDistance = camera.position.distanceTo(this.lastCameraPosition);
    const cameraMoved = cameraDistance > this.CAMERA_MOVE_THRESHOLD;

    // レンダリング条件：変更がある、操作中、またはカメラが移動した場合のみ
    if (!this.needsRender && !this.isInteracting && !cameraMoved) {
      return; // スキップ
    }

    // CSS2DRendererのrender()を先に実行
    // これがtransformを設定する
    this.css2DRenderer.render(scene, camera);

    // CSS2DRendererのrender()の後にscaleを適用
    // CSS2DRenderer.render()がtransformをリセットするため、scale()を再適用する必要がある
    this.updateContainerScale(camera);

    this.lastCameraPosition.copy(camera.position);
    this.needsRender = false;
  }

  /**
   * レンダリングが必要であることをマークします
   */
  markNeedsRender(): void {
    this.needsRender = true;
  }

  /**
   * インタラクション状態を設定します
   */
  setInteracting(isInteracting: boolean): void {
    this.isInteracting = isInteracting;
    if (isInteracting) {
      this.needsRender = true;
    }
  }

  /**
   * レンダラーのサイズを変更します
   */
  setSize(width: number, height: number): void {
    if (this.css2DRenderer) {
      this.css2DRenderer.setSize(width, height);
    }
  }

  /**
   * CSS2DRendererを取得します
   */
  getRenderer(): CSS2DRenderer | undefined {
    return this.css2DRenderer;
  }

  /**
   * 現在のスケール値を取得します
   */
  getCurrentScale(): number {
    if (!this.divContainer) {
      return 1.0;
    }

    // transformスタイルからscale値を抽出
    const transform = this.divContainer.style.transform || "";
    const scaleMatch = transform.match(/scale\(([^)]+)\)/);

    if (scaleMatch) { 
      if(scaleMatch[1]) {
        const scaleValue = parseFloat(scaleMatch[1].trim());
        return Number.isNaN(scaleValue) ? 1.0 : scaleValue;
      }
    }

    // scaleが見つからない場合は1.0を返す
    return 1.0;
  }

  /**
   * コンテナの現在のスケール値を取得します
   */
  getContainerScale(): number {
    if (!this.divContainer) {
      return 1.0;
    }

    // transformスタイルからscale値を抽出
    const transform = this.divContainer.style.transform || "";
    const scaleMatch = transform.match(/scale\(([^)]+)\)/);

    if (scaleMatch) { 
      if(scaleMatch[1]) {
        const scaleValue = parseFloat(scaleMatch[1].trim());
        return Number.isNaN(scaleValue) ? 1.0 : scaleValue;
      }
    }

    // scaleが見つからない場合は1.0を返す
    return 1.0;
  }

  /**
   * コンテナを非表示にします
   */
  hideDivContainer(): void {
    this.isContainerVisible = false;
    this.applyContainerVisibility();
  }

  /**
   * コンテナを表示します
   */
  showDivContainer(): void {
    this.isContainerVisible = true;
    this.applyContainerVisibility();
  }

  /**
   * コンテナの表示状態を反映します
   */
  private applyContainerVisibility(): void {
    const displayValue = this.isContainerVisible ? "" : "none";
    if (this.divContainer) {
      this.divContainer.style.display = displayValue;
    }
  }

  /**
   * リソースをクリーンアップします
   */
  dispose(): void {
    // CSS2DObjectをシーンから削除
    if (this.css2DObject?.parent) {
      this.css2DObject.parent.remove(this.css2DObject);
    }
    this.css2DObject = undefined;

    // コンテナを削除
    if (this.divContainer) {
      // コンテナ内の子要素をすべて削除
      while (this.divContainer.firstChild) {
        this.divContainer.removeChild(this.divContainer.firstChild);
      }
      // コンテナ自体を削除
      if (this.divContainer.parentElement) {
        this.divContainer.parentElement.removeChild(this.divContainer);
      }
      this.divContainer = undefined;
    }

    // CSS2DRendererのDOMを削除
    if (this.css2DRenderer) {
      const element = this.css2DRenderer.domElement;
      if (element?.parentElement) {
        element.parentElement.removeChild(element);
      }
      this.css2DRenderer = undefined;
    }

    // 注入したスタイル要素を削除
    this.removeContainerStyles();

    // 基準距離をリセット
    this.baseDistance = null;

    // レンダリング状態をリセット
    this.needsRender = false;
    this.isInteracting = false;
    this.lastCameraPosition = new THREE.Vector3();
  }

  /**
   * CSS2Dレンダリングが初期化されているかチェックします
   */
  isInitialized(): boolean {
    return !!this.css2DRenderer;
  }

}


