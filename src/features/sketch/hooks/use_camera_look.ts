import { useEffect, type RefObject } from "react";
import * as THREE from "three";

type Mode = "draw" | "select" | "camera" | "object";

interface UseCameraLookArgs {
  canvas: HTMLCanvasElement | null;
  camera: THREE.PerspectiveCamera | null;
  modeRef: RefObject<Mode>;
  isDrawingRef: RefObject<boolean>;
}

const LOOK_SPEED = 0.003;
const PITCH_LIMIT = Math.PI / 2 - 0.05;

export function useCameraLook({ canvas, camera, modeRef, isDrawingRef }: UseCameraLookArgs) {
  useEffect(() => {
    if (!canvas || !camera) return;

    let isLooking = false;
    let lastX = 0;
    let lastY = 0;
    let pointerId: number | null = null;

    const handlePointerDown = (e: PointerEvent) => {
      if (modeRef.current !== "draw") return;
      if (e.button !== 2) return;
      if (isDrawingRef.current) return;
      e.preventDefault();
      isLooking = true;
      lastX = e.clientX;
      lastY = e.clientY;
      pointerId = e.pointerId;
      canvas.setPointerCapture(e.pointerId);
    };

    const handlePointerMove = (e: PointerEvent) => {
      if (!isLooking) return;
      // 右ボタンが離されているのに pointerup を取り逃したケースを救済
      if ((e.buttons & 2) === 0) {
        isLooking = false;
        if (pointerId !== null) {
          try {
            canvas.releasePointerCapture(pointerId);
          } catch {
            /* noop */
          }
        }
        pointerId = null;
        return;
      }
      e.preventDefault();

      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      lastX = e.clientX;
      lastY = e.clientY;

      const euler = new THREE.Euler(0, 0, 0, "YXZ");
      euler.setFromQuaternion(camera.quaternion);
      euler.y -= dx * LOOK_SPEED;
      euler.x -= dy * LOOK_SPEED;
      euler.x = Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, euler.x));
      camera.quaternion.setFromEuler(euler);
    };

    const handlePointerUp = (e: PointerEvent) => {
      if (!isLooking) return;
      if (pointerId !== null && e.pointerId === pointerId) {
        canvas.releasePointerCapture(pointerId);
      }
      isLooking = false;
      pointerId = null;
    };

    canvas.addEventListener("pointerdown", handlePointerDown);
    canvas.addEventListener("pointermove", handlePointerMove);
    canvas.addEventListener("pointerup", handlePointerUp);
    canvas.addEventListener("pointerleave", handlePointerUp);
    canvas.addEventListener("pointercancel", handlePointerUp);

    return () => {
      canvas.removeEventListener("pointerdown", handlePointerDown);
      canvas.removeEventListener("pointermove", handlePointerMove);
      canvas.removeEventListener("pointerup", handlePointerUp);
      canvas.removeEventListener("pointerleave", handlePointerUp);
      canvas.removeEventListener("pointercancel", handlePointerUp);
    };
  }, [canvas, camera, modeRef, isDrawingRef]);
}
