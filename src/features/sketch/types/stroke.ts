import * as THREE from "three";

export interface Stroke {
  id: string;
  points: THREE.Vector3[];
  color: string;
  thickness: number;
  mesh?: THREE.Mesh;
  line?: THREE.Line;
  isSolidified: boolean;
}

export interface DrawingState {
  isDrawMode: boolean;
  currentColor: string;
  thickness: number;
  depth: number;
}
