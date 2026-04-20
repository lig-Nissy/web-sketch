import * as THREE from "three";

export type PenType = "normal" | "fire" | "star" | "mirror";
export type StampType = "shooting_star" | "cow" | "steak";

export interface Stamp {
  id: string;
  type: StampType;
  position: THREE.Vector3;
  group?: THREE.Group;
  particles?: THREE.Points;
  animationData?: Record<string, unknown>;
  // 重力関連
  hasGravity: boolean;
  velocity: THREE.Vector3;
  isGrounded: boolean;
}

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
