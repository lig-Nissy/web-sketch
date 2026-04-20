import * as THREE from "three";

export type PenType = "normal" | "fire" | "star" | "mirror";
export type ObjectType = "shooting_star" | "cow" | "steak" | "cube" | "box" | "sphere";

export interface PlacedObject {
  id: string;
  type: ObjectType;
  position: THREE.Vector3;
  group?: THREE.Group;
  mesh?: THREE.Mesh;
  particles?: THREE.Points;
  animationData?: Record<string, unknown>;
  // 重力関連
  hasGravity: boolean;
  velocity: THREE.Vector3;
  isGrounded: boolean;
  // 当たり判定用サイズ
  boundingBox?: { width: number; height: number; depth: number };
  boundingRadius?: number;
}

// 後方互換性のためのエイリアス
export type StampType = ObjectType;
export type Stamp = PlacedObject;

export interface Stroke {
  id: string;
  points: THREE.Vector3[];
  color: string;
  thickness: number;
  penType: PenType;
  mesh?: THREE.Mesh | THREE.Group;
  line?: THREE.Line;
  isSolidified: boolean;
  // 始点・終点のマーカー用メッシュ
  startMarker?: THREE.Mesh;
  endMarker?: THREE.Mesh;
  // 特殊エフェクト用
  particles?: THREE.Points;
  animationId?: number;
}

export interface DrawingState {
  isDrawMode: boolean;
  currentColor: string;
  thickness: number;
  depth: number;
}
