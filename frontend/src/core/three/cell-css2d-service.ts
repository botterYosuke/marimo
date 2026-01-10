/* Copyright 2026 Marimo. All rights reserved. */

import { CSS2DRenderer, CSS2DObject } from "three/examples/jsm/renderers/CSS2DRenderer.js";
import * as THREE from "three";

/**
 * CellCSS2DService
 *
 * CSS2DRendererの初期化と管理を担当（セルコンテナ専用）
 * - CSS2DRendererの初期化（z-index: 15）
 * - セルコンテナDOM要素の作成と管理
 * - セルコンテナ全体をCSS2DObjectとして3D空間に配置
 * - カメラ距離に基づくスケール調整
 * - レンダリングループの管理
 */
export class CellCSS2DService {
  private css2DRenderer?: CSS2DRenderer;
  private css2DObject?: CSS2DObject;
  private isContainerVisible = true;
  private cellContainer?: HTMLDivElement;
  private styleElement?: HTMLStyleElement;

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

  /**
   * CSS2DRendererとセルコンテナを初期化します
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
    // z-index: 15 - セルを最上層に配置（3D物体をgridとcellの間に配置するため）
    rendererElement.style.zIndex = "15";

    hostElement.appendChild(rendererElement);

    // セルコンテナを作成
    this.createCellContainer();
    this.applyContainerVisibility();

    return this.css2DRenderer;
  }

  /**
   * セルコンテナDOM要素を作成します
   */
  private createCellContainer(): HTMLDivElement {
    if (this.cellContainer) {
      this.applyContainerVisibility();
      return this.cellContainer;
    }

    const container = document.createElement("div");
    container.className = "cell-3d-container";

    // CSSスタイルをインラインで設定
    container.style.position = "absolute";
    container.style.top = "0";
    container.style.left = "0";
    container.style.width = "0";
    container.style.height = "0";
    container.style.pointerEvents = "none";
    container.style.zIndex = "100";

    // 子要素のpointer-eventsを有効化するためのスタイルを追加
    this.styleElement = document.createElement("style");
    this.styleElement.textContent = `
      .cell-3d-container > * {
        pointer-events: all;
      }
    `;
    document.head.appendChild(this.styleElement);

    this.cellContainer = container;
    this.applyContainerVisibility();

    return container;
  }

  /**
   * セルコンテナを取得します
   */
  getCellContainer(): HTMLDivElement | undefined {
    if (!this.cellContainer) {
      this.createCellContainer();
    }
    return this.cellContainer;
  }

  /**
   * セルコンテナを3D空間に配置します
   */
  attachCellContainerToScene(
    scene: THREE.Scene,
    // 初期位置: (0, 600, 0) - gridContainerより前方（Y軸正方向）に配置
    // 3D物体をgridとcellの間に表示するため、セルをより前方（カメラに近い位置）に配置
    // カメラ位置: (0, 1200, 0) との関係を考慮
    position: THREE.Vector3 = new THREE.Vector3(0, 600, 0),
  ): CSS2DObject | null {
    if (!this.cellContainer) {
      this.createCellContainer();
    }

    if (!this.cellContainer) {
      console.warn(
        "Cell container is not created. Call initializeRenderer() first.",
      );
      return null;
    }

    // 既存のオブジェクトを削除
    if (this.css2DObject?.parent) {
      this.css2DObject.parent.remove(this.css2DObject);
    }

    // CSS2DObjectを作成
    this.css2DObject = new CSS2DObject(this.cellContainer);
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
   * セルコンテナの3D位置を取得します
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
   * セルコンテナのスケールを更新する共通ロジック
   */
  private updateCellContainerScaleInternal(
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
   * セルコンテナのスケールを更新します
   */
  private updateCellContainerScale(camera: THREE.PerspectiveCamera): void {
    if (!this.cellContainer || !this.css2DObject) {
      return;
    }
    this.updateCellContainerScaleInternal(this.cellContainer, this.css2DObject, camera);
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
    const cameraMoved =
      camera.position.distanceTo(this.lastCameraPosition) >
      this.CAMERA_MOVE_THRESHOLD;

    // レンダリング条件：変更がある、操作中、またはカメラが移動した場合のみ
    if (!this.needsRender && !this.isInteracting && !cameraMoved) {
      return; // スキップ
    }

    // CSS2DRendererのrender()を先に実行
    // これがtransformを設定する
    this.css2DRenderer.render(scene, camera);

    // CSS2DRendererのrender()の後にscaleを適用
    this.updateCellContainerScale(camera);

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
   * セルコンテナの現在のスケール値を取得します
   */
  getContainerScale(): number {
    if (!this.cellContainer) {
      return 1.0;
    }

    // transformスタイルからscale値を抽出
    const transform = this.cellContainer.style.transform || "";
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
   * 現在のスケール値を取得します
   * getContainerScale()のエイリアスです
   */
  getCurrentScale(): number {
    return this.getContainerScale();
  }

  /**
   * セルコンテナを非表示にします
   */
  hideCellContainer(): void {
    this.isContainerVisible = false;
    this.applyContainerVisibility();
  }

  /**
   * セルコンテナを表示します
   */
  showCellContainer(): void {
    this.isContainerVisible = true;
    this.applyContainerVisibility();
  }

  /**
   * セルコンテナの表示状態を反映します
   */
  private applyContainerVisibility(): void {
    const displayValue = this.isContainerVisible ? "" : "none";
    if (this.cellContainer) {
      this.cellContainer.style.display = displayValue;
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

    // セルコンテナを削除
    if (this.cellContainer) {
      // セルコンテナ内の子要素をすべて削除
      while (this.cellContainer.firstChild) {
        this.cellContainer.removeChild(this.cellContainer.firstChild);
      }
      // セルコンテナ自体を削除
      if (this.cellContainer.parentElement) {
        this.cellContainer.parentElement.removeChild(this.cellContainer);
      }
      this.cellContainer = undefined;
    }

    // スタイル要素を削除
    if (this.styleElement) {
      if (this.styleElement.parentElement) {
        this.styleElement.parentElement.removeChild(this.styleElement);
      }
      this.styleElement = undefined;
    }

    // CSS2DRendererのDOMを削除
    if (this.css2DRenderer) {
      const element = this.css2DRenderer.domElement;
      if (element?.parentElement) {
        element.parentElement.removeChild(element);
      }
      this.css2DRenderer = undefined;
    }

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
