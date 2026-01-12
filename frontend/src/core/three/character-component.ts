/* Copyright 2026 Marimo. All rights reserved. */

import * as THREE from "three";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader.js";

/**
 * CharacterComponent
 *
 * 【役割】
 * - Three.jsシーンにFBXキャラクターモデルを読み込み、配置する
 * - キャラクターのアニメーションを更新し、表示状態を管理する
 *
 * 【責務の境界】
 * - モデルリソース（FBX）のロードとアタッチ
 * - アニメーションミキサーの更新と破棄
 * - Three.jsシーンへの追加・削除のみを担当
 */
export class CharacterComponent {
  private static readonly MODEL_URL = "drone_fab_fbx_v1.Fbx";
  private static readonly MODEL_BASE_PATH = "/drone_fab_v1_fbx/";
  private static readonly DEFAULT_POSITION = new THREE.Vector3(0, 300, 0);
  private static readonly DEFAULT_SCALE = new THREE.Vector3(1, 1, 1);
  private static readonly TARGET_SIZE = 100; // 3D空間での目標サイズ（単位）

  private mixer?: THREE.AnimationMixer;
  private model?: THREE.Group;
  private clock = new THREE.Clock();
  private isLoading = false;
  private animations: THREE.AnimationClip[] = [];
  private currentAction?: THREE.AnimationAction;
  private rotors: THREE.Object3D[] = [];
  private static readonly ROTOR_ROTATION_SPEED = 15; // 回転速度（ラジアン/秒）

  /**
   * シーンにキャラクターモデルを読み込んで追加します
   *
   * @param scene Three.jsシーン
   */
  load(scene: THREE.Scene): void {
    if (this.model || this.isLoading) {
      return;
    }

    this.isLoading = true;
    const loader = new FBXLoader();
    
    // テクスチャパスの解決
    loader.setPath(CharacterComponent.MODEL_BASE_PATH);

    // モデルファイルのパス（setPathを使用するため相対パス）
    const modelPath = CharacterComponent.MODEL_URL;

    console.log(`FBXモデルの読み込みを開始: ${CharacterComponent.MODEL_BASE_PATH}${modelPath}`);

    loader.load(
      modelPath,
      (fbx) => {
        this.isLoading = false;
        this.model = fbx;

        // モデルの構造を確認（デバッグ用）
        this.logModelStructure();

        // ローターを検索
        this.findRotors();

        // 初期位置・スケール・回転を適用
        this.applyTransform();

        // シーンに追加
        scene.add(this.model);

        // アニメーションの設定
        if (fbx.animations && fbx.animations.length > 0) {
          this.animations = fbx.animations;
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
            `FBXモデルの読み込み進捗: ${percentComplete.toFixed(1)}%`,
          );
        }
      },
      (error) => {
        this.isLoading = false;
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        const errorStack = error instanceof Error ? error.stack : undefined;
        console.error("FBXキャラクターモデルのロードに失敗しました:", error);
        console.error("エラー詳細:", {
          message: errorMessage,
          stack: errorStack,
          modelPath: `${CharacterComponent.MODEL_BASE_PATH}${modelPath}`,
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

    console.log("FBXキャラクターモデルが読み込まれました:", {
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

    console.log("FBXモデルの構造:");
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
}
