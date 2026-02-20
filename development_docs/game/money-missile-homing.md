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

`moneyMissileEffect`・`tradeEventChannel` フィールドを追加し、以下を統合：

**initialize() 内（リサイズハンドラー後、アニメーションループ開始前）:**
```typescript
if (this.scene && this.camera) {
  this.moneyMissileEffect = new MoneyMissileEffect(this.scene);
  this.moneyMissileEffect.setCamera(this.camera);
  this.setupTradeEventListener();
}
```

**startAnimationLoop() 内（early return 後、WebGLレンダリング前）:**
```typescript
if (this.moneyMissileEffect) {
  const delta = elapsed / 1000; // elapsed / 1000 を使う（THREE.Clock 不要）
  const dronePosition = this.characterComponent?.getPosition() ?? undefined;
  const isAnimating = this.moneyMissileEffect.update(delta, dronePosition);
  if (isAnimating) {
    this.needsRender = true;
  }
}
```

**dispose() 内（renderer 解放後、scene 解放前）:**
```typescript
if (this.moneyMissileEffect) {
  this.moneyMissileEffect.dispose();
  this.moneyMissileEffect = undefined;
}
if (this.tradeEventChannel) {
  this.tradeEventChannel.close();
  this.tradeEventChannel = undefined;
}
```

**setupTradeEventListener()（プライベートメソッド）:**
```typescript
private setupTradeEventListener(): void {
  this.tradeEventChannel = new BroadcastChannel("trade_event_channel");
  this.tradeEventChannel.onmessage = (event: MessageEvent) => { ... };
}
```

> **BroadcastChannel 名:** `"trade_event_channel"`（旧 `"backtest_channel"` ではない）
> **イベントフィールド:** `event.data.data.event_type`（`"BUY"` or `"SELL"`）、`event.data.data.size`（`trade_type`/`amount` ではない）

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
4. **THREE.Clock 不使用**: `delta` は `elapsed / 1000` で計算（`elapsed = currentTime - this.lastRenderTime`）。`THREE.Clock` をフィールドに追加しないこと
5. **SceneManager の dispose 順序**: `characterComponent.dispose(scene)` が scene 引数を必要とするため、character/missile/channel の解放は `if (this.scene)` ブロックより**前**に行う

---

## 変更履歴

| 日付 | 変更内容 |
|------|----------|
| 2026-02-03 | ホーミング機能実装完了 |
| 2026-02-17 | `scene-manager.ts` 統合完了（`characterComponent` と同ファイルに統合）|
