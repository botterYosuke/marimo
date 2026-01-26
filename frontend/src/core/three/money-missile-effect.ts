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
  lifetime: number;
  maxLifetime: number;
  isBuy: boolean;
}

/**
 * MoneyMissileEffect
 *
 * 【役割】
 * - BUY/SELL時にお金のパーティクルエフェクトを表示
 * - BUY: 画面下からドローンに向かってお金が上昇・吸収
 * - SELL: ドローンからお金が放射状に発射
 */
export class MoneyMissileEffect {
  private static readonly PARTICLE_SIZE = 40;
  private static readonly BUY_COLOR = 0x00ff88; // 緑系
  private static readonly SELL_COLOR = 0xff4444; // 赤系
  private static readonly MAX_PARTICLES = 50;
  private static readonly PARTICLE_LIFETIME = 1.5; // 秒
  private static readonly BUY_SPAWN_OFFSET_Y = -500; // ドローンの下方
  private static readonly PARTICLE_SPEED = 400; // 単位/秒
  private static readonly MIN_PARTICLES = 5;
  private static readonly MAX_PARTICLES_PER_TRIGGER = 30;
  private static readonly AMOUNT_DIVISOR = 1000;
  private static readonly SPAWN_SPREAD = 400;
  private static readonly TARGET_RANDOMIZATION = 50;
  private static readonly ATTRACTION_THRESHOLD = 100;

  private scene: THREE.Scene;
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
   * 画面下からドローンに向かってお金が上昇・吸収
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

    // パーティクルを生成
    for (let i = 0; i < particleCount; i++) {
      const sprite = new THREE.Sprite(this.buyMaterial.clone());
      sprite.scale.set(
        MoneyMissileEffect.PARTICLE_SIZE,
        MoneyMissileEffect.PARTICLE_SIZE,
        1,
      );

      // 開始位置: ドローンの下方、ランダムにばらける
      const startX =
        dronePosition.x +
        (Math.random() - 0.5) * MoneyMissileEffect.SPAWN_SPREAD;
      const startY = dronePosition.y + MoneyMissileEffect.BUY_SPAWN_OFFSET_Y;
      const startZ =
        dronePosition.z +
        (Math.random() - 0.5) * MoneyMissileEffect.SPAWN_SPREAD;
      sprite.position.set(startX, startY, startZ);

      // ターゲット: ドローンの位置（少しランダム性を加える）
      const target = dronePosition.clone();
      target.x +=
        (Math.random() - 0.5) * MoneyMissileEffect.TARGET_RANDOMIZATION;
      target.y +=
        (Math.random() - 0.5) * MoneyMissileEffect.TARGET_RANDOMIZATION;
      target.z +=
        (Math.random() - 0.5) * MoneyMissileEffect.TARGET_RANDOMIZATION;

      // 初期速度: ターゲット方向
      const velocity = target.clone().sub(sprite.position).normalize();
      velocity.multiplyScalar(
        MoneyMissileEffect.PARTICLE_SPEED * (0.8 + Math.random() * 0.4),
      );

      // 遅延を加えてパーティクルを徐々に出現させる
      const delay = i * 0.05;

      this.scene.add(sprite);
      this.particles.push({
        sprite,
        velocity,
        target,
        lifetime: -delay, // 負の値から開始して遅延を表現
        maxLifetime: MoneyMissileEffect.PARTICLE_LIFETIME,
        isBuy: true,
      });
    }
  }

  /**
   * SELL時のエフェクトをトリガー
   * ドローンからお金が放射状に発射
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

    // パーティクルを生成
    for (let i = 0; i < particleCount; i++) {
      const sprite = new THREE.Sprite(this.sellMaterial.clone());
      sprite.scale.set(
        MoneyMissileEffect.PARTICLE_SIZE,
        MoneyMissileEffect.PARTICLE_SIZE,
        1,
      );

      // 開始位置: ドローンの位置
      sprite.position.copy(dronePosition);

      // ターゲット: 放射状にランダム方向
      const angle = Math.random() * Math.PI * 2;
      const elevation = (Math.random() - 0.5) * Math.PI * 0.5; // -45° to +45°
      const distance = 300 + Math.random() * 200;

      const target = new THREE.Vector3(
        dronePosition.x +
          Math.cos(angle) * Math.cos(elevation) * distance,
        dronePosition.y + Math.sin(elevation) * distance,
        dronePosition.z +
          Math.sin(angle) * Math.cos(elevation) * distance,
      );

      // 初期速度: ターゲット方向
      const velocity = target.clone().sub(sprite.position).normalize();
      velocity.multiplyScalar(
        MoneyMissileEffect.PARTICLE_SPEED * (0.8 + Math.random() * 0.4),
      );

      // 遅延を加えてパーティクルを徐々に出現させる
      const delay = i * 0.03;

      this.scene.add(sprite);
      this.particles.push({
        sprite,
        velocity,
        target,
        lifetime: -delay,
        maxLifetime: MoneyMissileEffect.PARTICLE_LIFETIME,
        isBuy: false,
      });
    }
  }

  /**
   * パーティクルを更新
   *
   * @param delta フレーム間の時間差（秒）
   * @returns アニメーションが進行中かどうか
   */
  update(delta: number): boolean {
    const particlesToRemove: MoneyParticle[] = [];

    for (const particle of this.particles) {
      particle.lifetime += delta;

      // 遅延中はスキップ
      if (particle.lifetime < 0) {
        particle.sprite.visible = false;
        continue;
      }

      particle.sprite.visible = true;

      // 移動
      const movement = particle.velocity.clone().multiplyScalar(delta);
      particle.sprite.position.add(movement);

      // BUY時はターゲットに近づくと加速
      if (particle.isBuy) {
        const distanceToTarget = particle.sprite.position.distanceTo(
          particle.target,
        );
        if (distanceToTarget < MoneyMissileEffect.ATTRACTION_THRESHOLD) {
          // ターゲットに吸い込まれる
          const direction = particle.target
            .clone()
            .sub(particle.sprite.position)
            .normalize();
          particle.velocity.lerp(
            direction.multiplyScalar(MoneyMissileEffect.PARTICLE_SPEED * 2),
            0.1,
          );
        }
      }

      // 進捗率を計算
      const progress = particle.lifetime / particle.maxLifetime;

      // フェードアウト（最後の30%でフェード）
      if (progress > 0.7) {
        const fadeProgress = (progress - 0.7) / 0.3;
        particle.sprite.material.opacity = 1 - fadeProgress;
      }

      // スケールアニメーション
      if (particle.isBuy) {
        // BUY: 徐々に小さくなる
        const scale =
          MoneyMissileEffect.PARTICLE_SIZE * (1 - progress * 0.5);
        particle.sprite.scale.set(scale, scale, 1);
      } else {
        // SELL: 最初に大きくなり、徐々に小さくなる
        const scale =
          MoneyMissileEffect.PARTICLE_SIZE *
          (progress < 0.2 ? 1 + progress * 2 : 1.4 - progress * 0.5);
        particle.sprite.scale.set(scale, scale, 1);
      }

      // 寿命が尽きたら削除対象に追加
      if (particle.lifetime >= particle.maxLifetime) {
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
