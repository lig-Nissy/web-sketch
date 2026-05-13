import * as THREE from "three";
import type { Stroke } from "../types";

export const BOUNDARY = 48;
export const FLOOR_Y = -5;

export const isWithinBoundary = (pos: THREE.Vector3): boolean => {
  return pos.x >= -BOUNDARY && pos.x <= BOUNDARY && pos.z >= -BOUNDARY && pos.z <= BOUNDARY;
};

export const clampToBoundary = (pos: THREE.Vector3): THREE.Vector3 => {
  return new THREE.Vector3(
    Math.max(-BOUNDARY, Math.min(BOUNDARY, pos.x)),
    pos.y,
    Math.max(-BOUNDARY, Math.min(BOUNDARY, pos.z))
  );
};

const toMouse = (canvas: HTMLCanvasElement, clientX: number, clientY: number): THREE.Vector2 => {
  const rect = canvas.getBoundingClientRect();
  return new THREE.Vector2(
    ((clientX - rect.left) / rect.width) * 2 - 1,
    -((clientY - rect.top) / rect.height) * 2 + 1
  );
};

const buildRaycaster = (
  canvas: HTMLCanvasElement,
  camera: THREE.PerspectiveCamera,
  clientX: number,
  clientY: number
): THREE.Raycaster => {
  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(toMouse(canvas, clientX, clientY), camera);
  return raycaster;
};

export const getFloorIntersection = (
  canvas: HTMLCanvasElement,
  camera: THREE.PerspectiveCamera,
  raycastTargets: THREE.Mesh[],
  clientX: number,
  clientY: number,
  currentDrawDistance: number
): THREE.Vector3 | null => {
  const raycaster = buildRaycaster(canvas, camera, clientX, clientY);
  const floorTargets = raycastTargets.filter((t) => t.userData.type === "floor");
  const floorIntersects = raycaster.intersectObjects(floorTargets, false);

  if (floorIntersects.length > 0) {
    const hitPoint = floorIntersects[0].point;
    const distanceToHit = camera.position.distanceTo(hitPoint);
    if (distanceToHit < currentDrawDistance) {
      return clampToBoundary(hitPoint.clone());
    }
  }
  return null;
};

export const getAirPosition = (
  canvas: HTMLCanvasElement,
  camera: THREE.PerspectiveCamera,
  clientX: number,
  clientY: number,
  distance: number
): THREE.Vector3 => {
  const raycaster = buildRaycaster(canvas, camera, clientX, clientY);
  const direction = raycaster.ray.direction.clone().normalize();
  const pos = camera.position.clone().add(direction.multiplyScalar(distance));
  return clampToBoundary(pos);
};

export const getFloorProjection = (
  canvas: HTMLCanvasElement,
  camera: THREE.PerspectiveCamera,
  clientX: number,
  clientY: number
): THREE.Vector3 | null => {
  const raycaster = buildRaycaster(canvas, camera, clientX, clientY);
  const direction = raycaster.ray.direction;
  const origin = raycaster.ray.origin;

  if (Math.abs(direction.y) < 0.0001) return null;
  const t = (FLOOR_Y - origin.y) / direction.y;
  if (t < 0) return null;

  return clampToBoundary(
    new THREE.Vector3(origin.x + t * direction.x, FLOOR_Y, origin.z + t * direction.z)
  );
};

export const checkMarkerHit = (
  canvas: HTMLCanvasElement,
  camera: THREE.PerspectiveCamera,
  selectedStroke: Stroke | null,
  strokes: Stroke[],
  clientX: number,
  clientY: number
): { stroke: Stroke; type: "start" | "end" } | null => {
  const raycaster = buildRaycaster(canvas, camera, clientX, clientY);

  const markers: THREE.Mesh[] = [];
  if (selectedStroke) {
    if (selectedStroke.startMarker) markers.push(selectedStroke.startMarker);
    if (selectedStroke.endMarker) markers.push(selectedStroke.endMarker);
  }

  const intersects = raycaster.intersectObjects(markers, false);
  if (intersects.length > 0) {
    const hit = intersects[0].object as THREE.Mesh;
    const strokeId = hit.userData.strokeId;
    const markerType = hit.userData.markerType as "start" | "end";
    const stroke = strokes.find((s) => s.id === strokeId);
    if (stroke) return { stroke, type: markerType };
  }
  return null;
};

export const checkStrokeHit = (
  canvas: HTMLCanvasElement,
  camera: THREE.PerspectiveCamera,
  strokes: Stroke[],
  clientX: number,
  clientY: number
): Stroke | null => {
  const raycaster = buildRaycaster(canvas, camera, clientX, clientY);

  const objects: THREE.Object3D[] = [];
  strokes.forEach((s) => {
    if (s.mesh) objects.push(s.mesh);
  });

  const intersects = raycaster.intersectObjects(objects, true);
  if (intersects.length > 0) {
    const hitObject = intersects[0].object;
    return (
      strokes.find((s) => {
        if (!s.mesh) return false;
        if (s.mesh === hitObject) return true;
        if (s.mesh instanceof THREE.Group) {
          return s.mesh.children.includes(hitObject);
        }
        return false;
      }) ?? null
    );
  }
  return null;
};

export const checkResetButtonHit = (
  canvas: HTMLCanvasElement,
  camera: THREE.PerspectiveCamera,
  raycastTargets: THREE.Mesh[],
  clientX: number,
  clientY: number
): boolean => {
  const raycaster = buildRaycaster(canvas, camera, clientX, clientY);
  const buttonTargets = raycastTargets.filter((t) => t.userData.type === "bowlingReset");
  return raycaster.intersectObjects(buttonTargets, false).length > 0;
};
