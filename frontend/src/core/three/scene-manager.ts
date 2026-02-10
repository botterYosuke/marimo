/* Copyright 2026 Marimo. All rights reserved. */

import * as THREE from "three";
import { CSS2DRenderer } from "three/examples/jsm/renderers/CSS2DRenderer.js";
import type { GridCSS2DService } from "./grid-css2d-service";
import type { CellCSS2DService } from "./cell-css2d-service";
import { CharacterComponent } from "./character-component";
import { MoneyMissileEffect } from "./money-missile-effect";

/**
 * SceneManager
 *
 * Three.jsシーン、カメラの管理を担当。
 * パン/ズーム/ドラッグは React Flow が処理し、カメラは RF viewport に追従する。
 *
 * INVARIANT: カメラは常に Y 軸正方向から XZ 平面を真下に見下ろす（回転なし）。
 * この前提が崩れると React Flow のアフィン変換と透視投影の等価性が失われる。
 */
export class SceneManager {
  private renderer?: THREE.WebGLRenderer;
  private css2DRenderer?: CSS2DRenderer;
  private scene?: THREE.Scene;
  private camera?: THREE.PerspectiveCamera;
  private animationId?: number;
  private resizeHandler?: () => void;
  private hostElement?: HTMLDivElement;
  private needsRender = true;
  private needsCSS2DRender = true;
  private readonly MIN_FRAME_INTERVAL = 16; // 約60FPS
  private lastRenderTime = 0;
  private gridCSS2DService?: GridCSS2DService;
  private cellCSS2DService?: CellCSS2DService;
  private characterComponent?: CharacterComponent;
  private moneyMissileEffect?: MoneyMissileEffect;
  private tradeEventChannel?: BroadcastChannel;
  // カメラ位置追跡（CSS2D最適化用）
  private lastCameraPosition = new THREE.Vector3();
  private lastCameraTarget = new THREE.Vector3();

  /**
   * Three.jsシーンを初期化します
   *
   * @param hostElement レンダラーを配置する親要素
   * @param gridCSS2DService GridCSS2DServiceの参照（オプショナル）
   */
  initialize(
    hostElement: HTMLDivElement,
    gridCSS2DService?: GridCSS2DService,
  ): void {
    this.dispose();

    // サービス参照を保存
    this.gridCSS2DService = gridCSS2DService;

    this.hostElement = hostElement;
    const width = hostElement.clientWidth;
    const height = hostElement.clientHeight;

    // シーンの作成
    this.scene = new THREE.Scene();
    this.scene.background = null;

    // カメラの作成
    this.camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 200000);
    this.camera.position.set(0, 1200, 0); // XZ平面を俯瞰するため上空に配置
    this.camera.lookAt(0, 0, 0); // カメラを原点（XZ平面）に向ける
    this.camera.up.set(0, 0, -1); // Z軸負方向を上として設定

    // CSS2DRendererの作成（WebGLRendererの前に作成）
    this.css2DRenderer = new CSS2DRenderer();
    // zOrder関数を無効化（z-indexの自動設定を停止）
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (this.css2DRenderer as any).sortObjects = false;
    this.css2DRenderer.setSize(width, height);
    const css2DRendererElement = this.css2DRenderer.domElement;
    css2DRendererElement.style.position = "absolute";
    css2DRendererElement.style.top = "0";
    css2DRendererElement.style.left = "0";
    css2DRendererElement.style.pointerEvents = "none";

    // レンダラーの作成
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(window.devicePixelRatio || 1);
    this.renderer.setSize(width, height);
    this.renderer.domElement.style.position = "absolute";
    this.renderer.domElement.style.top = "0";
    this.renderer.domElement.style.left = "0";
    // z-index: 10 - 3D物体をgrid（z-index: 5）とReact Flowセル（z-index: 20）の間に配置
    this.renderer.domElement.style.zIndex = "10";

    // CSS2DRendererのDOM要素をWebGL Canvasの前に配置
    hostElement.appendChild(this.css2DRenderer.domElement);
    hostElement.appendChild(this.renderer.domElement);

    // ライトの追加
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    this.scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(10, 20, 10);
    this.scene.add(directionalLight);

    // リサイズハンドラーの設定
    this.resizeHandler = () => {
      if (!this.camera || !this.renderer || !this.hostElement) {
        return;
      }
      const { clientWidth, clientHeight } = this.hostElement;
      if (clientWidth === 0 || clientHeight === 0) {
        return;
      }
      this.camera.aspect = clientWidth / clientHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(clientWidth, clientHeight);
      if (this.css2DRenderer) {
        this.css2DRenderer.setSize(clientWidth, clientHeight);
      }
    };

    window.addEventListener("resize", this.resizeHandler);

    // キャラクターコンポーネントの初期化
    // Grid → 3Dモデル → Cellの順序で配置するため、
    // Gridコンテナの配置後に、CharacterComponentを初期化
    if (this.scene && this.camera && this.controls) {
      this.characterComponent = new CharacterComponent();
      this.characterComponent.load(this.scene, this.camera, this.controls);
    }

    // マネーミサイルエフェクトの初期化
    if (this.scene && this.camera) {
      this.moneyMissileEffect = new MoneyMissileEffect(this.scene);
      this.moneyMissileEffect.setCamera(this.camera);
      this.setupTradeEventListener();
    }

    // アニメーションループの開始
    this.startAnimationLoop();
  }

  /**
   * 取引イベントリスナーを設定します
   * BroadcastChannelを通じてバックテストの取引イベントを受信
   */
  private setupTradeEventListener(): void {
    this.tradeEventChannel = new BroadcastChannel("trade_event_channel");

    this.tradeEventChannel.onmessage = (event: MessageEvent) => {
      try {
        if (!event.data || typeof event.data !== "object") {
          return;
        }
        if (event.data.type !== "trade_event") {
          return;
        }
        if (!event.data.data) {
          return;
        }

        const { event_type, size } = event.data.data;
        const dronePosition = this.characterComponent?.getPosition();

        if (!dronePosition || !this.moneyMissileEffect) {
          return;
        }

        if (event_type === "BUY") {
          this.moneyMissileEffect.triggerBuy(dronePosition, size);
        } else if (event_type === "SELL") {
          this.moneyMissileEffect.triggerSell(dronePosition, size);
        }

        // エフェクトが発生したのでレンダリングが必要
        this.needsRender = true;
      } catch {
        // Silently ignore errors
      }
    };
  }

  /**
   * アニメーションループを開始します
   */
  private startAnimationLoop(): void {
    const animate = (currentTime: number) => {
      this.animationId = requestAnimationFrame(animate);

      // フレームレート制限
      const elapsed = currentTime - this.lastRenderTime;
      if (elapsed < this.MIN_FRAME_INTERVAL && !this.needsRender) {
        return;
      }
      this.lastRenderTime = currentTime;

      if (!this.scene || !this.camera || !this.renderer) {
        return;
      }

      // OrbitControlsの更新
      // changeイベントでneedsRenderが設定されるため、ここでは設定しない
      if (this.controls) {
        this.controls.update();
      }

      // キャラクターコンポーネントのアニメーション更新
      // 3Dモデルのアニメーションのみ、WebGLレンダリングが必要
      // CSS2Dはカメラ移動時のみ更新（パフォーマンス最適化）
      if (this.characterComponent) {
        this.characterComponent.update();
        // 3Dモデルのアニメーションが実際に動いている場合のみWebGLレンダリングが必要
        if (this.characterComponent.isAnimating) {
          this.needsRender = true;
        }
      }

      // マネーミサイルエフェクトの更新（ホーミング用にドローン位置を渡す）
      if (this.moneyMissileEffect) {
        const delta = elapsed / 1000; // ミリ秒から秒に変換
        const dronePosition = this.characterComponent?.getPosition() ?? undefined;
        const isAnimating = this.moneyMissileEffect.update(delta, dronePosition);
        if (isAnimating) {
          this.needsRender = true;
        }
      }


      // WebGLレンダリング（3Dモデル、z-index: 10）
      if (this.needsRender) {
        this.renderer.render(this.scene, this.camera);
        this.needsRender = false;
      }

      // CSS2Dレンダリング（カメラ移動時のみ実行 - パフォーマンス最適化）
      if (this.needsCSS2DRender && this.css2DRenderer && this.scene && this.camera) {
        this.css2DRenderer.render(this.scene, this.camera);

        // GridCSS2DServiceのスケール更新（レンダリング後）
        if (this.gridCSS2DService) {
          this.gridCSS2DService.forceUpdateContainerScale(this.camera);
        }

        this.needsCSS2DRender = false;
      }
    };

    animate(0);
  }

  /**
   * Three.jsのシーンを取得します
   */
  getScene(): THREE.Scene | undefined {
    return this.scene;
  }

  /**
   * カメラを取得します
   */
  getCamera(): THREE.PerspectiveCamera | undefined {
    return this.camera;
  }

  /**
   * レンダラーを取得します
   */
  getRenderer(): THREE.WebGLRenderer | undefined {
    return this.renderer;
  }

  /**
   * CSS2DRendererを取得します
   */
  getCSS2DRenderer(): CSS2DRenderer | undefined {
    return this.css2DRenderer;
  }

  /**
   * React Flow viewport からカメラ位置を設定します。
   * onMove コールバックから呼び出される。
   */
  setCameraFromViewport(position: THREE.Vector3, target: THREE.Vector3): void {
    if (!this.camera) {
      return;
    }
    this.camera.position.copy(position);
    this.camera.lookAt(target.x, target.y, target.z);
    this.camera.updateProjectionMatrix();
    this.markNeedsRender(true);
  }

  /**
   * カメラの視点を設定します（初期復元用）
   *
   * @param position カメラの位置
   * @param target カメラが向いている方向
   */
  setCameraView(position: THREE.Vector3, target: THREE.Vector3): void {
    this.setCameraFromViewport(position, target);
  }

  /**
   * レンダリングが必要であることをマークします
   * @param includeCSS2D CSS2Dレンダリングも必要な場合はtrue（デフォルト: true）
   */
  markNeedsRender(includeCSS2D = true): void {
    this.needsRender = true;
    if (includeCSS2D) {
      this.needsCSS2DRender = true;
    }
  }

  /**
   * CSS2Dレンダリングのみが必要であることをマークします
   */
  markNeedsCSS2DRender(): void {
    this.needsCSS2DRender = true;
  }

  /**
   * リソースをクリーンアップします
   */
  dispose(): void {
    if (this.animationId !== undefined) {
      cancelAnimationFrame(this.animationId);
      this.animationId = undefined;
    }

    if (this.resizeHandler) {
      window.removeEventListener("resize", this.resizeHandler);
      this.resizeHandler = undefined;
    }

    if (this.css2DRenderer) {
      const element = this.css2DRenderer.domElement;
      if (element?.parentElement) {
        element.parentElement.removeChild(element);
      }
      this.css2DRenderer = undefined;
    }

    if (this.renderer) {
      if (this.renderer.domElement.parentElement) {
        this.renderer.domElement.parentElement.removeChild(
          this.renderer.domElement,
        );
      }
      this.renderer.dispose();
      this.renderer = undefined;
    }

    // キャラクターコンポーネントのクリーンアップ
    if (this.characterComponent && this.scene) {
      this.characterComponent.dispose(this.scene);
      this.characterComponent = undefined;
    }

    // マネーミサイルエフェクトのクリーンアップ
    if (this.moneyMissileEffect) {
      this.moneyMissileEffect.dispose();
      this.moneyMissileEffect = undefined;
    }

    // 取引イベントチャンネルのクリーンアップ
    if (this.tradeEventChannel) {
      this.tradeEventChannel.close();
      this.tradeEventChannel = undefined;
    }

    if (this.scene) {
      // シーン内のオブジェクトをクリーンアップ
      this.scene.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          if (object.geometry) {
            object.geometry.dispose();
          }
          if (object.material) {
            if (Array.isArray(object.material)) {
              object.material.forEach((material) => {
                material.dispose();
              });
            } else {
              object.material.dispose();
            }
          }
        }
      });
      this.scene = undefined;
    }

    this.camera = undefined;
    this.hostElement = undefined;
    this.needsRender = true;
    this.needsCSS2DRender = true;
    this.lastRenderTime = 0;
    this.gridCSS2DService = undefined;
  }
}
