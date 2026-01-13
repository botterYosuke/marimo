/* Copyright 2026 Marimo. All rights reserved. */

import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import type { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

/**
 * CharacterComponent
 *
 * 【役割】
 * - Three.jsシーンにGLTFキャラクターモデルを読み込み、配置する
 * - キャラクターのアニメーションを更新し、表示状態を管理する
 *
 * 【責務の境界】
 * - モデルリソース（GLTF）のロードとアタッチ
 * - アニメーションミキサーの更新と破棄
 * - Three.jsシーンへの追加・削除のみを担当
 */
export class CharacterComponent {
  private static readonly MODEL_URL = "Drone.gltf";
  private static readonly MODEL_BASE_PATH = "/sci-fi-drone/source/";
  private static readonly DEFAULT_POSITION = new THREE.Vector3(0, 300, 0);
  private static readonly DEFAULT_SCALE = new THREE.Vector3(1, 1, 1);
  private static readonly TARGET_SIZE = 300; // 3D空間での目標サイズ（単位）

  private mixer?: THREE.AnimationMixer;
  private model?: THREE.Group;
  private clock = new THREE.Clock();
  private isLoading = false;
  private animations: THREE.AnimationClip[] = [];
  private currentAction?: THREE.AnimationAction;
  private rotors: THREE.Object3D[] = [];
  private static readonly ROTOR_ROTATION_SPEED = 15; // 回転速度（ラジアン/秒）

  // 旋回機能用のプロパティ
  private camera?: THREE.PerspectiveCamera;
  private controls?: OrbitControls;
  private targetPosition = new THREE.Vector3();
  private movementSpeed = 300; // 移動速度（単位/秒）
  private waypointInterval = 3000; // 目標位置更新間隔（ミリ秒）
  private nextWaypointTime = 0;
  private safetyMargin = 0.8; // 安全マージン（80%）
  private minDistance = 100; // 視点中心からの最小距離
  private maxDistanceRatio = 0.8; // 最大距離の比率
  private orbitEnabled = true; // 旋回機能の有効/無効

  /**
   * シーンにキャラクターモデルを読み込んで追加します
   *
   * @param scene Three.jsシーン
   * @param camera カメラの参照（旋回機能用、オプショナル）
   * @param controls OrbitControlsの参照（旋回機能用、オプショナル）
   */
  load(
    scene: THREE.Scene,
    camera?: THREE.PerspectiveCamera,
    controls?: OrbitControls,
  ): void {
    if (this.model || this.isLoading) {
      return;
    }

    // カメラとcontrolsの参照を保存
    this.camera = camera;
    this.controls = controls;

    this.isLoading = true;
    const loader = new GLTFLoader();
    
    // テクスチャパスの解決（テクスチャは/sci-fi-drone/textures/にある）
    loader.setPath("/sci-fi-drone/");

    // モデルファイルのパス（setPathを使用するため相対パス）
    const modelPath = `source/${CharacterComponent.MODEL_URL}`;

    console.log(`GLTFモデルの読み込みを開始: ${CharacterComponent.MODEL_BASE_PATH}${CharacterComponent.MODEL_URL}`);

    loader.load(
      modelPath,
      (gltf) => {
        this.isLoading = false;
        // GLTFローダーの結果からsceneを取得
        this.model = gltf.scene;

        // モデルの構造を確認（デバッグ用）
        this.logModelStructure();

        // ローターを検索
        this.findRotors();

        // 初期位置・スケール・回転を適用
        this.applyTransform();

        // 旋回機能の初期化
        if (this.camera && this.controls && this.orbitEnabled) {
          this.initializeOrbit();
        }

        // シーンに追加
        scene.add(this.model);

        // アニメーションの設定
        if (gltf.animations && gltf.animations.length > 0) {
          this.animations = gltf.animations;
          this.mixer = new THREE.AnimationMixer(this.model);

          // 初期アニメーションを再生（Idle系を優先、なければ先頭を再生）
          this.playAnimation(["Idle", "idle"], true);
        }

        this.logModelInfo();
      },
      (progress) => {
        // 進捗処理（オプション）
        if (progress.lengthComputable) {
          const percentComplete = (progress.loaded / progress.total) * 100;
          console.log(
            `GLTFモデルの読み込み進捗: ${percentComplete.toFixed(1)}%`,
          );
        }
      },
      (error) => {
        this.isLoading = false;
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        const errorStack = error instanceof Error ? error.stack : undefined;
        console.error("GLTFキャラクターモデルのロードに失敗しました:", error);
        console.error("エラー詳細:", {
          message: errorMessage,
          stack: errorStack,
          modelPath: `${CharacterComponent.MODEL_BASE_PATH}${CharacterComponent.MODEL_URL}`,
        });
        // エラー時のフォールバック処理は必要に応じて実装
      },
    );
  }

  /**
   * アニメーションを更新します
   * アニメーションループ内で毎フレーム呼び出されます
   */
  update(): void {
    const delta = this.clock.getDelta();

    if (this.mixer) {
      this.mixer.update(delta);
    }

    // ローターを回転させる
    this.updateRotors(delta);

    // 旋回機能の更新
    if (this.orbitEnabled && this.camera && this.controls && this.model) {
      this.updateOrbit(delta);
    }
  }

  /**
   * リソースをクリーンアップします
   *
   * @param scene Three.jsシーン
   */
  dispose(scene: THREE.Scene): void {
    if (this.mixer) {
      this.mixer.stopAllAction();
      this.mixer = undefined;
    }

    if (this.currentAction) {
      this.currentAction.stop();
      this.currentAction = undefined;
    }

    this.animations = [];
    this.rotors = [];

    if (this.model) {
      scene.remove(this.model);
      this.disposeModel(this.model);
      this.model = undefined;
    }

    this.clock = new THREE.Clock();
    this.isLoading = false;

    // 旋回機能のクリーンアップ
    this.camera = undefined;
    this.controls = undefined;
    this.targetPosition = new THREE.Vector3();
    this.nextWaypointTime = 0;
  }

  /**
   * 初期位置・スケール・回転を適用します
   */
  private applyTransform(): void {
    if (!this.model) {
      return;
    }

    // 位置を設定
    this.model.position.copy(CharacterComponent.DEFAULT_POSITION);

    // スケールを調整（モデルのサイズに応じて）
    this.adjustScale();
  }

  /**
   * モデルのサイズに応じてスケールを調整します
   */
  private adjustScale(): void {
    if (!this.model) {
      return;
    }

    // モデルのバウンディングボックスを計算
    const box = new THREE.Box3().setFromObject(this.model);
    const size = box.getSize(new THREE.Vector3());
    const maxDimension = Math.max(size.x, size.y, size.z);

    // 目標サイズに合わせてスケールを計算
    if (maxDimension > 0) {
      const scale = CharacterComponent.TARGET_SIZE / maxDimension;
      this.model.scale.set(scale, scale, scale);
    } else {
      // バウンディングボックスが計算できない場合はデフォルトスケールを使用
      this.model.scale.copy(CharacterComponent.DEFAULT_SCALE);
    }
  }

  /**
   * 指定した名前のアニメーションを再生します
   *
   * @param preferredNames 優先するアニメーション名のリスト
   * @param allowFallbackToFirst フォールバックとして最初のアニメーションを使用するか
   */
  private playAnimation(
    preferredNames: string[],
    allowFallbackToFirst = false,
  ): void {
    if (!this.mixer || this.animations.length === 0) {
      return;
    }

    const clip =
      this.findClip(preferredNames) ||
      (allowFallbackToFirst ? this.animations[0] : undefined);

    if (!clip) {
      return;
    }

    const nextAction = this.mixer.clipAction(clip);

    if (this.currentAction === nextAction) {
      return;
    }

    nextAction.reset().fadeIn(0.3).play();

    if (this.currentAction) {
      this.currentAction.fadeOut(0.3);
    }

    this.currentAction = nextAction;
  }

  /**
   * アニメーションクリップを名前で検索します
   *
   * @param names 検索するアニメーション名のリスト
   * @returns 見つかったアニメーションクリップ、見つからない場合はundefined
   */
  private findClip(names: string[]): THREE.AnimationClip | undefined {
    if (!this.animations.length) {
      return undefined;
    }

    const lowerNames = names.map((name) => name.toLowerCase());

    return this.animations.find((clip) => {
      const clipName = clip.name.toLowerCase();
      return lowerNames.some((name) => clipName.includes(name));
    });
  }

  /**
   * モデル情報をログ出力します（デバッグ用）
   */
  private logModelInfo(): void {
    if (!this.model) {
      return;
    }

    console.log("GLTFキャラクターモデルが読み込まれました:", {
      animations: this.animations.length,
      animationNames: this.animations.map((clip) => clip.name),
      position: this.model.position,
      scale: this.model.scale,
      rotation: this.model.rotation,
    });
  }

  /**
   * モデルの構造をログ出力します（デバッグ用）
   */
  private logModelStructure(): void {
    if (!this.model) {
      return;
    }

    console.log("GLTFモデルの構造:");
    this.model.traverse((child) => {
      if (child instanceof THREE.Mesh || child instanceof THREE.Group) {
        console.log(`  - ${child.name || "無名"}:`, {
          type: child.constructor.name,
          position: child.position,
          rotation: child.rotation,
          scale: child.scale,
          children: child.children.length,
        });
      }
    });
  }

  /**
   * モデルとその子オブジェクトのリソースを破棄します
   *
   * @param root ルートオブジェクト
   */
  private disposeModel(root: THREE.Object3D): void {
    root.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        if (child.geometry) {
          child.geometry.dispose();
        }
        if (Array.isArray(child.material)) {
          child.material.forEach((material) => {
            material.dispose();
          });
        } else if (child.material) {
          child.material.dispose();
        }
      }
    });
  }

  /**
   * モデルからローターオブジェクトを検索して保存します
   */
  private findRotors(): void {
    if (!this.model) {
      return;
    }

    this.rotors = [];
    const rotorNames = [
      "rotor",
      "Rotor",
      "ROTOR",
      "propeller",
      "Propeller",
      "PROPELLER",
      "prop",
      "Prop",
    ];

    this.model.traverse((child) => {
      const name = child.name.toLowerCase();
      if (rotorNames.some((rotorName) => name.includes(rotorName.toLowerCase()))) {
        this.rotors.push(child);
        console.log(`ローターを検出: ${child.name}`);
      }
    });

    if (this.rotors.length === 0) {
      console.warn("ローターが見つかりませんでした。モデル構造を確認してください。");
    } else {
      console.log(`${this.rotors.length}個のローターを検出しました`);
    }
  }

  /**
   * ローターを回転させます
   *
   * @param delta フレーム間の時間差（秒）
   */
  private updateRotors(delta: number): void {
    if (this.rotors.length === 0) {
      return;
    }

    const rotationSpeed = CharacterComponent.ROTOR_ROTATION_SPEED * delta;
    for (const rotor of this.rotors) {
      // Z軸（上方向）を中心に回転
      rotor.rotation.z += rotationSpeed;
    }
  }

  /**
   * 旋回機能を初期化します
   */
  private initializeOrbit(): void {
    if (!this.model || !this.camera || !this.controls) {
      return;
    }

    // 初期位置を現在のモデル位置に設定
    this.targetPosition.copy(this.model.position);
    this.nextWaypointTime = 0;
  }

  /**
   * 画面内範囲を計算します
   * カメラのFOVと距離から、画面内に収まる範囲を計算
   *
   * @returns 視点中心からの最大距離
   */
  private calculateMaxDistance(): number {
    if (!this.camera || !this.controls) {
      return 500; // デフォルト値
    }

    // カメラから視点中心までの距離
    const distance = this.camera.position.distanceTo(this.controls.target);

    // FOVは垂直視野角（度）なので、ラジアンに変換
    const fovRad = (this.camera.fov * Math.PI) / 180;
    // 視野角から計算した半径（垂直方向の半分）
    const radius = distance * Math.tan(fovRad / 2);

    // 安全マージンを考慮して最大距離を計算
    const maxDistance = radius * this.safetyMargin;

    // 最小距離と最大距離の比率を考慮
    return Math.max(
      this.minDistance,
      Math.min(maxDistance, distance * this.maxDistanceRatio),
    );
  }

  /**
   * 視点中心を中心としたランダムな位置を生成します
   *
   * @returns ランダムな位置
   */
  private generateRandomPosition(): THREE.Vector3 {
    if (!this.controls) {
      return new THREE.Vector3(0, 300, 0);
    }

    const maxDistance = this.calculateMaxDistance();

    // 球面座標系でランダムな位置を生成
    // 半径: 最小距離から最大距離の間
    const minRadius = this.minDistance;
    const radius =
      minRadius + Math.random() * (maxDistance - minRadius);

    // 仰角（elevation）: -45度から45度の間（水平面を中心に）
    const elevation = (Math.random() - 0.5) * (Math.PI / 2);

    // 方位角（azimuth）: 0から2πの間（全方向）
    const azimuth = Math.random() * Math.PI * 2;

    // 球面座標から直交座標に変換
    const x =
      radius * Math.cos(elevation) * Math.cos(azimuth);
    const y = 0; // 水平面のみで移動（Y座標（高度）の変化を固定）
    const z =
      radius * Math.cos(elevation) * Math.sin(azimuth);

    // 視点中心を基準にした位置を返す
    const position = new THREE.Vector3(x, y, z);
    position.add(this.controls.target);

    return position;
  }

  /**
   * 旋回機能を更新します
   *
   * @param delta フレーム間の時間差（秒）
   */
  private updateOrbit(delta: number): void {
    if (!this.model || !this.camera || !this.controls) {
      return;
    }

    const currentTime = this.clock.getElapsedTime() * 1000; // ミリ秒に変換

    // ウェイポイント更新チェック（先に実行して最新の目標位置を確定）
    const distanceToTarget = this.model.position.distanceTo(
      this.targetPosition,
    );
    const hasReachedTarget = distanceToTarget < 10; // 10単位以内なら到達とみなす

    if (
      currentTime >= this.nextWaypointTime ||
      hasReachedTarget
    ) {
      this.targetPosition = this.generateRandomPosition();
      this.nextWaypointTime = currentTime + this.waypointInterval;
    }

    // 現在位置から目標位置への移動処理
    const moveDistance = this.movementSpeed * delta;
    const direction = new THREE.Vector3().subVectors(
      this.targetPosition,
      this.model.position,
    );
    const currentDistance = direction.length();

    // 目標位置までの距離が移動距離より小さい場合は目標位置に設定
    if (currentDistance <= moveDistance || currentDistance < 0.1) {
      this.model.position.copy(this.targetPosition);
    } else {
      // 方向ベクトルを正規化して移動
      direction.normalize();
      this.model.position.add(direction.multiplyScalar(moveDistance));
    }

    // ドローンが視点中心の方を向くように回転を調整
    if (this.controls) {
      const lookAtTarget = new THREE.Vector3().copy(
        this.controls.target,
      );
      this.model.lookAt(lookAtTarget);
    }
  }
}
