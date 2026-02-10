/* Copyright 2026 Marimo. All rights reserved. */

import * as THREE from "three";

/**
 * React Flow viewport ↔ Three.js camera 双方向変換ユーティリティ
 *
 * INVARIANT: カメラは常に Y 軸正方向から XZ 平面を真下に見下ろす（enableRotate=false）。
 * この前提が崩れると、アフィン変換（translate+scale）と透視投影の等価性が失われる。
 *
 * 座標マッピング:
 *   React Flow {x, y} ↔ World {x, z}  (World Y = cellPlaneY は定数)
 */

export interface RFViewport {
  x: number;
  y: number;
  zoom: number;
}

/**
 * React Flow viewport → Three.js camera 位置・ターゲットを計算
 *
 * @param viewport  React Flow の viewport {x, y, zoom}
 * @param screenW   レンダラーの幅 (px)
 * @param screenH   レンダラーの高さ (px)
 * @param fovDeg    カメラの FOV (度)。camera.fov から取得すること。
 * @param cellPlaneY セルが配置されている Y 座標 (デフォルト: 600)
 */
export function reactFlowViewportToCamera(
  viewport: RFViewport,
  screenW: number,
  screenH: number,
  fovDeg: number,
  cellPlaneY = 600,
): { position: THREE.Vector3; target: THREE.Vector3 } {
  const fovRad = (fovDeg * Math.PI) / 180;
  const halfTan = Math.tan(fovRad / 2);

  // zoom からカメラ−セル平面間距離を逆算
  // visibleHeight = 2 * d * tan(FOV/2), zoom = screenH / visibleHeight
  const d = screenH / (2 * viewport.zoom * halfTan);

  // viewport オフセットからワールド中心を逆算
  const worldCenterX = (screenW / 2 - viewport.x) / viewport.zoom;
  const worldCenterZ = (screenH / 2 - viewport.y) / viewport.zoom;

  return {
    position: new THREE.Vector3(worldCenterX, d + cellPlaneY, worldCenterZ),
    target: new THREE.Vector3(worldCenterX, 0, worldCenterZ),
  };
}

/**
 * Three.js camera → React Flow viewport を計算（初期 viewport 復元用）
 *
 * @param cameraPos  カメラ位置
 * @param screenW    レンダラーの幅 (px)
 * @param screenH    レンダラーの高さ (px)
 * @param fovDeg     カメラの FOV (度)
 * @param cellPlaneY セルが配置されている Y 座標 (デフォルト: 600)
 */
export function cameraToReactFlowViewport(
  cameraPos: { x: number; y: number; z: number },
  screenW: number,
  screenH: number,
  fovDeg: number,
  cellPlaneY = 600,
): RFViewport {
  const fovRad = (fovDeg * Math.PI) / 180;
  const halfTan = Math.tan(fovRad / 2);

  // カメラ−セル平面間距離
  const d = cameraPos.y - cellPlaneY;

  // 距離から zoom を計算
  const zoom = d > 0 ? screenH / (2 * d * halfTan) : 1;

  // ワールド中心から viewport オフセットを計算
  const x = screenW / 2 - cameraPos.x * zoom;
  const y = screenH / 2 - cameraPos.z * zoom;

  return { x, y, zoom };
}
