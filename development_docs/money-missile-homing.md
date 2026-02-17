# マネーミサイル ホーミング機能

> **ステータス:** 完了 (2026-02-03)

## 概要

BUY/SELL時に発射される¥マークパーティクルが、移動中のドローンやカメラ視点変更に追従してターゲットに確実に到達する機能。

---

## アーキテクチャ

```
Trade Event (BUY/SELL)
    │
    ▼ triggerBuy() / triggerSell()
パーティクル生成（target + targetOffset を保持）
    │
    ▼ 毎フレーム update(delta, dronePosition)
ターゲット位置を再計算 → 速度方向を補正（lerp）
    │
    ▼
パーティクルが曲線軌道でターゲットに到達
```

### ホーミングの仕組み

1. **パーティクル生成時**: ランダムオフセット `targetOffset` を保持
2. **毎フレーム**:
   - BUY: `target = dronePosition + targetOffset`
   - SELL: `target = hubPosition + targetOffset`
3. **速度補正**: `velocity.lerp(newDirection, 0.15)` で滑らかに方向転換

---

## 実装ファイル

### 1. MoneyMissileEffect

**ファイル:** `frontend/src/core/three/money-missile-effect.ts`

```typescript
interface MoneyParticle {
  // ... 既存フィールド
  targetOffset: THREE.Vector3; // ホーミング用オフセット
}

// 定数
private static readonly HOMING_STEERING_STRENGTH = 0.15;

// update() でホーミング処理
update(delta: number, dronePosition?: THREE.Vector3): boolean {
  const currentHubPosition = this.getHubPosition(); // 1フレーム1回

  for (const particle of this.particles) {
    if (!particle.hasArrived) {
      // ターゲット位置を更新
      if (particle.isBuy && dronePosition) {
        particle.target.copy(dronePosition).add(particle.targetOffset);
      } else if (!particle.isBuy) {
        particle.target.copy(currentHubPosition).add(particle.targetOffset);
      }

      // 速度方向を補正
      const newDirection = particle.target.clone()
        .sub(particle.sprite.position).normalize();
      particle.velocity.lerp(
        newDirection.multiplyScalar(currentSpeed),
        HOMING_STEERING_STRENGTH
      );
    }
  }
}
```

### 2. SceneManager

**ファイル:** `frontend/src/core/three/scene-manager.ts`

```typescript
// アニメーションループでドローン位置を渡す
if (this.moneyMissileEffect) {
  const delta = elapsed / 1000;
  const dronePosition = this.characterComponent?.getPosition() ?? undefined;
  const isAnimating = this.moneyMissileEffect.update(delta, dronePosition);
}
```

---

## パラメータ調整

| パラメータ | 値 | 説明 |
|-----------|-----|------|
| `HOMING_STEERING_STRENGTH` | 0.15 | 方向補正の強さ（0.0-1.0）|

- **0.05-0.1**: 滑らかな曲線軌道（ミサイルらしい動き）
- **0.2-0.3**: 素早い追従（シャープな動き）
- **1.0**: 即座に方向転換（スムージングなし）

---

## 注意点

1. **dronePosition が null の場合**: BUYパーティクルは最後の既知位置を維持
2. **パフォーマンス**: `getHubPosition()` は1フレームに1回のみ呼び出し
3. **ゼロ除算防止**: `initialDistance === 0` の場合は `approachRatio = 0`
