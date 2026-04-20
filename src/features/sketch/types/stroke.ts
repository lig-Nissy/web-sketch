import * as THREE from "three";

export type PenType = "normal" | "fire" | "star" | "mirror";

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
