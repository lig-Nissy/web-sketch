import * as THREE from "three";

export const disposeObject3D = (obj: THREE.Object3D, scene?: THREE.Scene | null) => {
  if (scene) scene.remove(obj);
  obj.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      if (child.geometry) child.geometry.dispose();
      if (Array.isArray(child.material)) {
        child.material.forEach((m) => m.dispose());
      } else if (child.material) {
        child.material.dispose();
      }
    }
  });
};
