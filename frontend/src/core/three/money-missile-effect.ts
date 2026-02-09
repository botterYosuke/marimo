/* Copyright 2026 Marimo. All rights reserved. */

import * as THREE from "three";

/**
 * MoneyParticle
 *
 * 個々のお金パーティクルを表す
 */
interface MoneyParticle {
  sprite: THREE.Sprite;
  velocity: THREE.Vector3;
  target: THREE.Vector3;
  targetOffset: THREE.Vector3; // ターゲットからのランダムオフセット（ホーミング用）
  lifetime: number;
  maxLifetime: number;
  isBuy: boolean;
  initialDistance: number; // 開始時のターゲットまでの距離
  hasArrived: boolean; // 到達フラグ
  arrivalTime: number; // 到達時刻
}

/**
 * MoneyMissileEffect
 *
 * 【役割】
 * - BUY/SELL時にお金のパーティクルエフェクトを表示
 * - BUY: BackcastHUB（画面左上）からドローンに向かってお金が飛ぶ
 * - SELL: ドローンからBackcastHUB（画面左上）に向かってお金が飛ぶ
 */
export class MoneyMissileEffect {
  private static readonly PARTICLE_SIZE = 40;
  private static readonly BUY_COLOR = 0xffd700; // ゴールド
  private static readonly SELL_COLOR = 0xffd700; // ゴールド
  private static readonly MAX_PARTICLES = 150;
  private static readonly PARTICLE_LIFETIME = 3.0; // 秒（フォールバック用）
  private static readonly MIN_PARTICLES = 15;
  private static readonly MAX_PARTICLES_PER_TRIGGER = 80;
  private static readonly AMOUNT_DIVISOR = 500;
  private static readonly SPAWN_SPREAD = 400;
  private static readonly TARGET_RANDOMIZATION = 50;
  private static readonly ARRIVAL_THRESHOLD = 30; // 到達判定距離
  private static readonly TARGET_TRAVEL_TIME = 1.5; // 目標到達時間（秒）
  private static readonly POST_ARRIVAL_FADE = 0; // 到達後フェード時間（秒）
  private static readonly MIN_SPEED = 200; // 最低速度
  private static readonly MAX_SPEED = 1500; // 最高速度
  private static readonly HOMING_STEERING_STRENGTH = 0.15; // ホーミングの曲がり具合

  private scene: THREE.Scene;
  private camera?: THREE.PerspectiveCamera;
  private particles: MoneyParticle[] = [];
  private buyMaterial: THREE.SpriteMaterial;
  private sellMaterial: THREE.SpriteMaterial;
  private textureCanvas: HTMLCanvasElement;
  private sharedTexture: THREE.CanvasTexture;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.textureCanvas = this.createTextureCanvas();

    // テクスチャは一度だけ作成して再利用
    this.sharedTexture = new THREE.CanvasTexture(this.textureCanvas);
    this.sharedTexture.needsUpdate = true;

    this.buyMaterial = this.createMaterial(MoneyMissileEffect.BUY_COLOR);
    this.sellMaterial = this.createMaterial(MoneyMissileEffect.SELL_COLOR);
  }

  /**
   * カメラ参照を設定
   */
  setCamera(camera: THREE.PerspectiveCamera): void {
    this.camera = camera;
  }

  /**
   * BackcastHUBの位置を計算（カメラ相対、画面左上）
   * カメラはXZ平面を上から見下ろしている（Y軸上空から）
   * 画面左右=X軸、画面上下=Z軸（-Zが上）
   * HUBはXZ平面上（Y=0）の左上に配置
   */
  private getHubPosition(): THREE.Vector3 {
    if (!this.camera) {
      // フォールバック: XZ平面の左上（X負、Z負）
      return new THREE.Vector3(-500, 0, -500);
    }

    // NDC座標（画面左上端）からレイを作成してXZ平面（Y=0）との交点を求める
    const ndc = new THREE.Vector3(-0.3, 0.85, 0.5);
    ndc.unproject(this.camera);

    // カメラ位置からndc位置への方向ベクトル
    const cameraPos = this.camera.position.clone();
    const direction = ndc.sub(cameraPos).normalize();

    // Y=0平面との交点を計算（カメラはY>0にあるので下向きに交差）
    // cameraPos.y + t * direction.y = 0
    // t = -cameraPos.y / direction.y
    if (Math.abs(direction.y) < 0.001) {
      // ほぼ水平なので交点なし、フォールバック
      return new THREE.Vector3(-500, 0, -500);
    }

    const t = -cameraPos.y / direction.y;
    const intersection = cameraPos.add(direction.multiplyScalar(t));

    return intersection;
  }

  /**
   * ¥マークのテクスチャを生成
   */
  private createTextureCanvas(): HTMLCanvasElement {
    const canvas = document.createElement("canvas");
    canvas.width = 64;
    canvas.height = 64;

    const ctx = canvas.getContext("2d");
    if (ctx) {
      // 背景を透明に
      ctx.clearRect(0, 0, 64, 64);

      // 円形の背景
      ctx.beginPath();
      ctx.arc(32, 32, 28, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
      ctx.fill();

      // ¥マーク
      ctx.font = "bold 36px Arial";
      ctx.fillStyle = "#333";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("¥", 32, 34);
    }

    return canvas;
  }

  /**
   * パーティクル用のマテリアルを作成
   */
  private createMaterial(color: number): THREE.SpriteMaterial {
    return new THREE.SpriteMaterial({
      map: this.sharedTexture,
      color: color,
      transparent: true,
      opacity: 1.0,
      depthTest: false,
      depthWrite: false,
    });
  }

  /**
   * 古いパーティクルを削除してスペースを確保
   */
  private removeOldestParticles(requiredSpace: number): void {
    while (
      this.particles.length + requiredSpace >
      MoneyMissileEffect.MAX_PARTICLES
    ) {
      const oldest = this.particles.shift();
      if (oldest) {
        this.scene.remove(oldest.sprite);
        oldest.sprite.material.dispose();
        oldest.sprite.geometry.dispose();
      }
    }
  }

  /**
   * BUY時のエフェクトをトリガー
   * BackcastHUB（画面左上）からドローンに向かってお金が飛ぶ
   *
   * @param dronePosition ドローンの現在位置
   * @param amount 取引金額（パーティクル数の参考）
   */
  triggerBuy(dronePosition: THREE.Vector3, amount: number): void {
    // 無効な値をチェック
    if (amount <= 0 || !Number.isFinite(amount)) {
      return;
    }

    // パーティクル数を計算
    const particleCount = Math.min(
      Math.max(
        Math.ceil(amount / MoneyMissileEffect.AMOUNT_DIVISOR),
        MoneyMissileEffect.MIN_PARTICLES,
      ),
      MoneyMissileEffect.MAX_PARTICLES_PER_TRIGGER,
    );

    // 現在のパーティクル数が上限に達している場合は古いものを削除
    this.removeOldestParticles(particleCount);

    // HUB位置を取得
    const hubPosition = this.getHubPosition();

    // パーティクルを生成
    for (let i = 0; i < particleCount; i++) {
      const sprite = new THREE.Sprite(this.buyMaterial.clone());
      sprite.scale.set(
        MoneyMissileEffect.PARTICLE_SIZE,
        MoneyMissileEffect.PARTICLE_SIZE,
        1,
      );

      // 開始位置: HUB（画面左上）、ランダムにばらける
      const startX =
        hubPosition.x + (Math.random() - 0.5) * MoneyMissileEffect.SPAWN_SPREAD;
      const startY =
        hubPosition.y + (Math.random() - 0.5) * MoneyMissileEffect.SPAWN_SPREAD;
      const startZ =
        hubPosition.z + (Math.random() - 0.5) * MoneyMissileEffect.SPAWN_SPREAD;
      sprite.position.set(startX, startY, startZ);

      // ターゲット: ドローンの位置（少しランダム性を加える）
      // ホーミング用にオフセットを保持
      const targetOffset = new THREE.Vector3(
        (Math.random() - 0.5) * MoneyMissileEffect.TARGET_RANDOMIZATION,
        (Math.random() - 0.5) * MoneyMissileEffect.TARGET_RANDOMIZATION,
        (Math.random() - 0.5) * MoneyMissileEffect.TARGET_RANDOMIZATION,
      );
      const target = dronePosition.clone().add(targetOffset);

      // 初期距離を計算
      const initialDistance = sprite.position.distanceTo(target);

      // 動的速度計算: 距離に基づいて速度を調整し、一定時間内に到達
      const baseSpeed = initialDistance / MoneyMissileEffect.TARGET_TRAVEL_TIME;
      const speed = Math.max(
        MoneyMissileEffect.MIN_SPEED,
        Math.min(
          baseSpeed * (0.8 + Math.random() * 0.4),
          MoneyMissileEffect.MAX_SPEED,
        ),
      );

      // 初期速度: ターゲット方向
      const velocity = target.clone().sub(sprite.position).normalize();
      velocity.multiplyScalar(speed);

      // 遅延を加えてパーティクルを徐々に出現させる
      const delay = i * 0.05;

      this.scene.add(sprite);
      this.particles.push({
        sprite,
        velocity,
        target,
        targetOffset,
        lifetime: -delay, // 負の値から開始して遅延を表現
        maxLifetime: MoneyMissileEffect.PARTICLE_LIFETIME,
        isBuy: true,
        initialDistance,
        hasArrived: false,
        arrivalTime: 0,
      });
    }
  }

  /**
   * SELL時のエフェクトをトリガー
   * ドローンからBackcastHUB（画面左上）に向かってお金が飛ぶ
   *
   * @param dronePosition ドローンの現在位置
   * @param amount 取引金額（パーティクル数の参考）
   */
  triggerSell(dronePosition: THREE.Vector3, amount: number): void {
    // 無効な値をチェック
    if (amount <= 0 || !Number.isFinite(amount)) {
      return;
    }

    // パーティクル数を計算
    const particleCount = Math.min(
      Math.max(
        Math.ceil(amount / MoneyMissileEffect.AMOUNT_DIVISOR),
        MoneyMissileEffect.MIN_PARTICLES,
      ),
      MoneyMissileEffect.MAX_PARTICLES_PER_TRIGGER,
    );

    // 現在のパーティクル数が上限に達している場合は古いものを削除
    this.removeOldestParticles(particleCount);

    // HUB位置を取得
    const hubPosition = this.getHubPosition();

    // パーティクルを生成
    for (let i = 0; i < particleCount; i++) {
      const sprite = new THREE.Sprite(this.sellMaterial.clone());
      sprite.scale.set(
        MoneyMissileEffect.PARTICLE_SIZE,
        MoneyMissileEffect.PARTICLE_SIZE,
        1,
      );

      // 開始位置: ドローンの位置（ランダムにばらける）
      const startX =
        dronePosition.x +
        (Math.random() - 0.5) * MoneyMissileEffect.SPAWN_SPREAD * 0.3;
      const startY =
        dronePosition.y +
        (Math.random() - 0.5) * MoneyMissileEffect.SPAWN_SPREAD * 0.3;
      const startZ =
        dronePosition.z +
        (Math.random() - 0.5) * MoneyMissileEffect.SPAWN_SPREAD * 0.3;
      sprite.position.set(startX, startY, startZ);

      // ターゲット: HUB位置（少しランダム性を加える）
      // ホーミング用にオフセットを保持
      const targetOffset = new THREE.Vector3(
        (Math.random() - 0.5) * MoneyMissileEffect.TARGET_RANDOMIZATION,
        (Math.random() - 0.5) * MoneyMissileEffect.TARGET_RANDOMIZATION,
        (Math.random() - 0.5) * MoneyMissileEffect.TARGET_RANDOMIZATION,
      );
      const target = hubPosition.clone().add(targetOffset);

      // 初期距離を計算
      const initialDistance = sprite.position.distanceTo(target);

      // 動的速度計算: 距離に基づいて速度を調整し、一定時間内に到達
      const baseSpeed = initialDistance / MoneyMissileEffect.TARGET_TRAVEL_TIME;
      const speed = Math.max(
        MoneyMissileEffect.MIN_SPEED,
        Math.min(
          baseSpeed * (0.8 + Math.random() * 0.4),
          MoneyMissileEffect.MAX_SPEED,
        ),
      );

      // 初期速度: ターゲット方向
      const velocity = target.clone().sub(sprite.position).normalize();
      velocity.multiplyScalar(speed);

      // 遅延を加えてパーティクルを徐々に出現させる
      const delay = i * 0.03;

      this.scene.add(sprite);
      this.particles.push({
        sprite,
        velocity,
        target,
        targetOffset,
        lifetime: -delay,
        maxLifetime: MoneyMissileEffect.PARTICLE_LIFETIME,
        isBuy: false,
        initialDistance,
        hasArrived: false,
        arrivalTime: 0,
      });
    }
  }

  /**
   * パーティクルを更新
   *
   * @param delta フレーム間の時間差（秒）
   * @param dronePosition ドローンの現在位置（ホーミング用）
   * @returns アニメーションが進行中かどうか
   */
  update(delta: number, dronePosition?: THREE.Vector3): boolean {
    const particlesToRemove: MoneyParticle[] = [];

    // SELL用にHUB位置を1フレームに1回だけ計算
    const currentHubPosition = this.getHubPosition();

    for (const particle of this.particles) {
      particle.lifetime += delta;

      // 遅延中はスキップ
      if (particle.lifetime < 0) {
        particle.sprite.visible = false;
        continue;
      }

      particle.sprite.visible = true;

      // ホーミング: ターゲット位置を毎フレーム更新
      if (!particle.hasArrived) {
        if (particle.isBuy) {
          if (dronePosition) {
            // BUY: ドローンの現在位置 + 保持したオフセット
            particle.target.copy(dronePosition).add(particle.targetOffset);
          }
          // dronePositionがない場合は最後のターゲット位置を維持（グレースフルデグラデーション）
        } else {
          // SELL: 現在のHUB位置 + 保持したオフセット
          particle.target.copy(currentHubPosition).add(particle.targetOffset);
        }

        // 速度方向を新しいターゲットに向けて補正
        const newDirection = particle.target
          .clone()
          .sub(particle.sprite.position)
          .normalize();

        const currentSpeed = particle.velocity.length();
        particle.velocity.lerp(
          newDirection.multiplyScalar(currentSpeed),
          MoneyMissileEffect.HOMING_STEERING_STRENGTH,
        );
      }

      // ターゲットまでの距離を計算
      const distanceToTarget = particle.sprite.position.distanceTo(
        particle.target,
      );

      // 到達判定
      if (
        !particle.hasArrived &&
        distanceToTarget < MoneyMissileEffect.ARRIVAL_THRESHOLD
      ) {
        particle.hasArrived = true;
        particle.arrivalTime = particle.lifetime;
      }

      if (particle.hasArrived) {
        // 即時削除（POST_ARRIVAL_FADE = 0）
        if (MoneyMissileEffect.POST_ARRIVAL_FADE <= 0) {
          particlesToRemove.push(particle);
        } else {
          // 到達後のフェードアウト
          const timeSinceArrival = particle.lifetime - particle.arrivalTime;
          const fadeProgress =
            timeSinceArrival / MoneyMissileEffect.POST_ARRIVAL_FADE;
          particle.sprite.material.opacity = 1 - Math.min(fadeProgress, 1);

          // 到達後は縮小
          const scale =
            MoneyMissileEffect.PARTICLE_SIZE *
            (1 - Math.min(fadeProgress, 1) * 0.8);
          particle.sprite.scale.set(scale, scale, 1);

          // フェード完了で削除
          if (fadeProgress >= 1) {
            particlesToRemove.push(particle);
          }
        }
      } else {
        // 未到達: 移動
        const movement = particle.velocity.clone().multiplyScalar(delta);
        const movementLength = movement.length();

        // オーバーシュート防止: 移動距離がターゲットまでの距離を超える場合は到達
        if (movementLength >= distanceToTarget) {
          particle.sprite.position.copy(particle.target);
          particle.hasArrived = true;
          particle.arrivalTime = particle.lifetime;
          particlesToRemove.push(particle);
        } else {
          particle.sprite.position.add(movement);

          // ターゲットへの接近度
          // initialDistanceが0の場合は即座に到達とみなす（ゼロ除算防止）
          const approachRatio =
            particle.initialDistance > 0
              ? distanceToTarget / particle.initialDistance
              : 0;

          // 残り30%で吸い込み加速（BUY/SELL両方）
          if (approachRatio < 0.3) {
            const direction = particle.target
              .clone()
              .sub(particle.sprite.position)
              .normalize();
            particle.velocity.lerp(
              direction.multiplyScalar(particle.velocity.length() * 1.5),
              0.15,
            );
          }

          // スケールアニメーション（距離ベース）
          if (particle.isBuy) {
            // BUY: 徐々に小さくなる
            const scale =
              MoneyMissileEffect.PARTICLE_SIZE * (0.5 + approachRatio * 0.5);
            particle.sprite.scale.set(scale, scale, 1);
          } else {
            // SELL: 最初に大きくなり、徐々に小さくなる
            const scale =
              MoneyMissileEffect.PARTICLE_SIZE *
              (approachRatio > 0.8
                ? 1 + (1 - approachRatio) * 2
                : 1.4 - (1 - approachRatio) * 0.5);
            particle.sprite.scale.set(scale, scale, 1);
          }
        }
      }

      // フォールバック: 万が一到達しない場合（時間は2倍に延長）
      if (particle.lifetime >= particle.maxLifetime * 2) {
        particlesToRemove.push(particle);
      }
    }

    // 削除対象のパーティクルを除去
    for (const particle of particlesToRemove) {
      const index = this.particles.indexOf(particle);
      if (index > -1) {
        this.particles.splice(index, 1);
        this.scene.remove(particle.sprite);
        particle.sprite.material.dispose();
        particle.sprite.geometry.dispose();
      }
    }

    return this.particles.length > 0;
  }

  /**
   * リソースをクリーンアップ
   */
  dispose(): void {
    for (const particle of this.particles) {
      this.scene.remove(particle.sprite);
      particle.sprite.material.dispose();
      particle.sprite.geometry.dispose();
    }
    this.particles = [];

    // マテリアルを破棄（テクスチャは共有なので最後に1回だけ破棄）
    this.buyMaterial.dispose();
    this.sellMaterial.dispose();

    // 共有テクスチャを破棄
    this.sharedTexture.dispose();
  }
}
