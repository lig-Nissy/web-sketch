import * as THREE from "three";

export interface Stroke {
  id: string;
  points: THREE.Vector3[];
  color: string;
  thickness: number;
  mesh?: THREE.Mesh;
  line?: THREE.Line;
  isSolidified: boolean;
  // 始点・終点のマーカー用メッシュ
  startMarker?: THREE.Mesh;
  endMarker?: THREE.Mesh;
}

export interface DrawingState {
  isDrawMode: boolean;
  currentColor: string;
  thickness: number;
  depth: number;
}
