/* Copyright 2026 Marimo. All rights reserved. */

import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { CSS2DRenderer } from "three/examples/jsm/renderers/CSS2DRenderer.js";
import type { GridCSS2DService } from "./grid-css2d-service";
import type { CellCSS2DService } from "./cell-css2d-service";

/**
 * SceneManager
 * 
 * Three.jsシーン、カメラ、OrbitControlsの管理を担当
 */
export class SceneManager {
  private renderer?: THREE.WebGLRenderer;
  private css2DRenderer?: CSS2DRenderer;
  private scene?: THREE.Scene;
  private camera?: THREE.PerspectiveCamera;
  private controls?: OrbitControls;
  private animationId?: number;
  private resizeHandler?: () => void;
  private hostElement?: HTMLDivElement;
  private needsRender = true;
  private readonly MIN_FRAME_INTERVAL = 16; // 約60FPS
  private lastRenderTime = 0;
  private gridCSS2DService?: GridCSS2DService;
  private cellCSS2DService?: CellCSS2DService;

  /**
   * Three.jsシーンを初期化します
   * 
   * @param hostElement レンダラーを配置する親要素
   * @param gridCSS2DService GridCSS2DServiceの参照（オプショナル）
   * @param cellCSS2DService CellCSS2DServiceの参照（オプショナル）
   */
  initialize(
    hostElement: HTMLDivElement,
    gridCSS2DService?: GridCSS2DService,
    cellCSS2DService?: CellCSS2DService,
  ): void {
    this.dispose();

    // サービス参照を保存
    this.gridCSS2DService = gridCSS2DService;
    this.cellCSS2DService = cellCSS2DService;

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
    this.css2DRenderer.sortObjects = false;
    this.css2DRenderer.setSize(width, height);
    const css2DRendererElement = this.css2DRenderer.domElement;
    css2DRendererElement.style.position = "absolute";
    css2DRendererElement.style.top = "0";
    css2DRendererElement.style.left = "0";
    css2DRendererElement.style.pointerEvents = "none";
    // z-indexは個々のCSS2DObjectのelementで制御（zOrder関数は無効化済み）
    // Grid CSS2DObject: z-index: 5, Cell CSS2DObject: z-index: 20

    // レンダラーの作成
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(window.devicePixelRatio || 1);
    this.renderer.setSize(width, height);
    this.renderer.domElement.style.position = "absolute";
    this.renderer.domElement.style.top = "0";
    this.renderer.domElement.style.left = "0";
    // z-index: 10 - 3D物体をgrid（z-index: 5）とcell（z-index: 20）の間に配置するため
    this.renderer.domElement.style.zIndex = "10";
    
    // CSS2DRendererのDOM要素をWebGL Canvasの前に配置
    hostElement.appendChild(this.css2DRenderer.domElement);
    hostElement.appendChild(this.renderer.domElement);

    // OrbitControlsの作成
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = false;
    this.controls.enableRotate = false;
    // 左クリックにも pan を割り当て
    this.controls.mouseButtons.LEFT = THREE.MOUSE.PAN;
    // ズーム制限を設定
    this.controls.minDistance = 100;
    this.controls.maxDistance = this.camera.far * 0.9;
    // パン制限を設定
    this.controls.enablePan = true;

    // ライトの追加
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    this.scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(10, 20, 10);
    this.scene.add(directionalLight);

    // リサイズハンドラーの設定
    this.resizeHandler = () => {
      if (
        !this.camera ||
        !this.renderer ||
        !this.hostElement
      ) {
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

    // アニメーションループの開始
    this.startAnimationLoop();
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
      if (this.controls) {
        this.controls.update();
        // 操作中はレンダリングが必要
        // ダンピングが有効な場合、update()が内部で動きを検知するため
        // 常にレンダリングが必要になる可能性がある
        if (this.controls.enabled) {
          this.needsRender = true;
        }
      }

      // レンダリング
      if (this.needsRender) {
        // CSS2Dレンダリング（1回だけ実行）
        // 1つのCSS2DRendererでGridとCellの両方のCSS2DObjectをレンダリング
        if (this.css2DRenderer && this.scene && this.camera) {
          this.css2DRenderer.render(this.scene, this.camera);
        }

        // WebGLレンダリング（3Dモデル、z-index: 10）
        this.renderer.render(this.scene, this.camera);

        // 各サービスのスケール更新（レンダリング後）
        // CSS2DRenderer.render()が全CSS2DObjectのtransformを再計算・上書きするため、
        // 各コンテナのscale()を再適用する必要がある
        if (this.gridCSS2DService) {
          this.gridCSS2DService.forceUpdateContainerScale(this.camera);
        }
        if (this.cellCSS2DService) {
          this.cellCSS2DService.forceUpdateCellContainerScale(this.camera);
        }

        this.needsRender = false;
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
   * OrbitControlsを取得します
   */
  getControls(): OrbitControls | undefined {
    return this.controls;
  }

  /**
   * CSS2DRendererを取得します
   */
  getCSS2DRenderer(): CSS2DRenderer | undefined {
    return this.css2DRenderer;
  }

  /**
   * カメラの視点を設定します
   * 
   * @param position カメラの位置
   * @param target OrbitControlsのtarget（カメラが向いている方向）
   */
  setCameraView(position: THREE.Vector3, target: THREE.Vector3): void {
    if (!this.camera || !this.controls) {
      return;
    }

    this.camera.position.copy(position);
    this.controls.target.copy(target);
    this.controls.update();
    this.markNeedsRender();
  }

  /**
   * レンダリングが必要であることをマークします
   */
  markNeedsRender(): void {
    this.needsRender = true;
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

    if (this.controls) {
      this.controls.dispose();
      this.controls = undefined;
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
    this.lastRenderTime = 0;
    this.gridCSS2DService = undefined;
    this.cellCSS2DService = undefined;
  }
}

