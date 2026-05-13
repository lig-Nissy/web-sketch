import { useEffect, type RefObject } from "react";
import * as THREE from "three";
import type RAPIER from "@dimforge/rapier3d-compat";
import type { Stroke, PlacedObject, PenType, ObjectType } from "../types";
import {
  getFloorIntersection,
  getAirPosition,
  getFloorProjection,
  checkMarkerHit,
  checkStrokeHit,
  checkResetButtonHit,
  updateStrokeMesh,
  createStrokeMarkers,
  removeStrokeMarkers,
  disposeObject3D,
  createPlacedObject,
} from "../utils";

type Mode = "draw" | "select" | "camera" | "object";
type DrawModeType = "floor" | "air" | "forceFloor" | null;

interface UseDrawingInputArgs {
  canvas: HTMLCanvasElement | null;
  scene: THREE.Scene | null;
  camera: THREE.PerspectiveCamera | null;
  physicsWorld: RAPIER.World | null;
  raycastTargetsRef: RefObject<THREE.Mesh[]>;
  isDrawingRef: RefObject<boolean>;
  resetBowlingRef: RefObject<(() => void) | null>;

  strokesRef: RefObject<Stroke[]>;
  objectsRef: RefObject<PlacedObject[]>;
  currentStrokeRef: RefObject<Stroke | null>;
  drawModeTypeRef: RefObject<DrawModeType>;
  fixedDrawDistanceRef: RefObject<number | null>;
  selectedStrokeRef: RefObject<Stroke | null>;

  modeRef: RefObject<Mode>;
  currentColorRef: RefObject<string>;
  thicknessRef: RefObject<number>;
  drawDistanceRef: RefObject<number>;
  penTypeRef: RefObject<PenType>;
  objectTypeRef: RefObject<ObjectType>;
  objectGravityRef: RefObject<boolean>;

  setDrawDistance: (updater: (prev: number) => number) => void;
  setSelectedStroke: (s: Stroke | null) => void;
  setMode: (m: Mode) => void;
}

export function useDrawingInput(args: UseDrawingInputArgs) {
  const {
    canvas,
    scene,
    camera,
    physicsWorld,
    raycastTargetsRef,
    isDrawingRef,
    resetBowlingRef,
    strokesRef,
    objectsRef,
    currentStrokeRef,
    drawModeTypeRef,
    fixedDrawDistanceRef,
    selectedStrokeRef,
    modeRef,
    currentColorRef,
    thicknessRef,
    drawDistanceRef,
    penTypeRef,
    objectTypeRef,
    objectGravityRef,
    setDrawDistance,
    setSelectedStroke,
    setMode,
  } = args;

  useEffect(() => {
    if (!canvas || !scene || !camera || !physicsWorld) return;
    const world = physicsWorld;

    const getWorldPosition = (
      clientX: number,
      clientY: number,
      shiftKey = false,
      altKey = false
    ): THREE.Vector3 | null => {
      const currentDrawDistance = fixedDrawDistanceRef.current ?? drawDistanceRef.current;

      if (drawModeTypeRef.current === "floor") {
        const floorPos = getFloorIntersection(
          canvas,
          camera,
          raycastTargetsRef.current,
          clientX,
          clientY,
          currentDrawDistance
        );
        if (floorPos) return floorPos;
        return getAirPosition(canvas, camera, clientX, clientY, currentDrawDistance);
      } else if (drawModeTypeRef.current === "air" && fixedDrawDistanceRef.current !== null) {
        return getAirPosition(canvas, camera, clientX, clientY, fixedDrawDistanceRef.current);
      } else if (drawModeTypeRef.current === "forceFloor") {
        return getFloorProjection(canvas, camera, clientX, clientY);
      }

      if (shiftKey) {
        drawModeTypeRef.current = "air";
        fixedDrawDistanceRef.current = drawDistanceRef.current;
        return getAirPosition(canvas, camera, clientX, clientY, fixedDrawDistanceRef.current);
      }

      if (altKey) {
        drawModeTypeRef.current = "forceFloor";
        return getFloorProjection(canvas, camera, clientX, clientY);
      }

      const floorPos = getFloorIntersection(
        canvas,
        camera,
        raycastTargetsRef.current,
        clientX,
        clientY,
        drawDistanceRef.current
      );
      if (floorPos) {
        drawModeTypeRef.current = "floor";
        fixedDrawDistanceRef.current = drawDistanceRef.current;
        return floorPos;
      }

      drawModeTypeRef.current = "air";
      fixedDrawDistanceRef.current = drawDistanceRef.current;
      return getAirPosition(canvas, camera, clientX, clientY, fixedDrawDistanceRef.current);
    };

    const handleWheel = (e: WheelEvent) => {
      if (modeRef.current !== "draw" && modeRef.current !== "object") return;
      if (isDrawingRef.current) return;
      e.preventDefault();

      const delta = e.deltaY > 0 ? -1 : 1;
      setDrawDistance((prev) => Math.max(2, Math.min(60, prev + delta)));
    };

    const placeObject = (clientX: number, clientY: number) => {
      const worldPos = getWorldPosition(clientX, clientY);
      if (!worldPos) return;

      const obj = createPlacedObject(objectTypeRef.current, worldPos, {
        scene,
        world,
        color: currentColorRef.current,
        hasGravity: objectGravityRef.current,
      });
      objectsRef.current.push(obj);
    };

    const handlePointerDown = (e: PointerEvent) => {
      if (e.button !== 0) return;

      if (checkResetButtonHit(canvas, camera, raycastTargetsRef.current, e.clientX, e.clientY)) {
        e.preventDefault();
        resetBowlingRef.current?.();
        return;
      }

      if (modeRef.current === "object") {
        e.preventDefault();
        placeObject(e.clientX, e.clientY);
        return;
      }

      if (modeRef.current === "select") {
        e.preventDefault();

        const markerHit = checkMarkerHit(
          canvas,
          camera,
          selectedStrokeRef.current,
          strokesRef.current,
          e.clientX,
          e.clientY
        );
        if (markerHit) {
          canvas.setPointerCapture(e.pointerId);
          isDrawingRef.current = true;
          currentStrokeRef.current = markerHit.stroke;

          removeStrokeMarkers(markerHit.stroke, scene, false);

          if (markerHit.type === "start") {
            markerHit.stroke.points.reverse();
          }

          setSelectedStroke(null);
          setMode("draw");
          return;
        }

        const strokeHit = checkStrokeHit(canvas, camera, strokesRef.current, e.clientX, e.clientY);
        if (strokeHit) {
          const prevSelected = selectedStrokeRef.current;
          if (prevSelected && prevSelected !== strokeHit) {
            removeStrokeMarkers(prevSelected, scene);
          }

          setSelectedStroke(strokeHit);
          createStrokeMarkers(strokeHit, scene);
        } else {
          const prevSelected = selectedStrokeRef.current;
          if (prevSelected) {
            removeStrokeMarkers(prevSelected, scene);
          }
          setSelectedStroke(null);
        }
        return;
      }

      if (modeRef.current === "draw") {
        e.preventDefault();
        canvas.setPointerCapture(e.pointerId);

        const worldPos = getWorldPosition(e.clientX, e.clientY, e.shiftKey, e.altKey);
        if (!worldPos) return;

        isDrawingRef.current = true;
        currentStrokeRef.current = {
          id: Math.random().toString(36).substring(2, 9),
          points: [worldPos.clone()],
          color: currentColorRef.current,
          thickness: thicknessRef.current,
          penType: penTypeRef.current,
          isSolidified: false,
        };
      }
    };

    const handlePointerMove = (e: PointerEvent) => {
      if (!isDrawingRef.current || !currentStrokeRef.current) return;

      const worldPos = getWorldPosition(e.clientX, e.clientY);
      if (!worldPos) return;

      const lastPoint =
        currentStrokeRef.current.points[currentStrokeRef.current.points.length - 1];
      if (lastPoint.distanceTo(worldPos) > 0.1) {
        currentStrokeRef.current.points.push(worldPos.clone());
        updateStrokeMesh(currentStrokeRef.current, scene);
      }
    };

    const handlePointerUp = (e: PointerEvent) => {
      if (!isDrawingRef.current || !currentStrokeRef.current) return;

      canvas.releasePointerCapture(e.pointerId);

      if (currentStrokeRef.current.points.length >= 2) {
        currentStrokeRef.current.isSolidified = true;

        if (!strokesRef.current.includes(currentStrokeRef.current)) {
          strokesRef.current.push(currentStrokeRef.current);
        }
      } else if (currentStrokeRef.current.mesh) {
        disposeObject3D(currentStrokeRef.current.mesh, scene);
      }

      isDrawingRef.current = false;
      currentStrokeRef.current = null;
      drawModeTypeRef.current = null;
      fixedDrawDistanceRef.current = null;
    };

    // 右クリックメニューを抑止（OrbitControls の右ドラッグ回転と競合するため）
    const handleContextMenu = (e: MouseEvent) => e.preventDefault();

    canvas.addEventListener("pointerdown", handlePointerDown);
    canvas.addEventListener("pointermove", handlePointerMove);
    canvas.addEventListener("pointerup", handlePointerUp);
    canvas.addEventListener("pointerleave", handlePointerUp);
    canvas.addEventListener("pointercancel", handlePointerUp);
    canvas.addEventListener("wheel", handleWheel, { passive: false });
    canvas.addEventListener("contextmenu", handleContextMenu);

    return () => {
      canvas.removeEventListener("pointerdown", handlePointerDown);
      canvas.removeEventListener("pointermove", handlePointerMove);
      canvas.removeEventListener("pointerup", handlePointerUp);
      canvas.removeEventListener("pointerleave", handlePointerUp);
      canvas.removeEventListener("pointercancel", handlePointerUp);
      canvas.removeEventListener("wheel", handleWheel);
      canvas.removeEventListener("contextmenu", handleContextMenu);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canvas, scene, camera, physicsWorld]);
}
