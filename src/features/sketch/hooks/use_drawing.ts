"use client";

import { useCallback, useRef } from "react";
import * as THREE from "three";
import type { Stroke } from "../types";

interface UseDrawingProps {
  sceneRef: React.RefObject<THREE.Scene | null>;
  cameraRef: React.RefObject<THREE.PerspectiveCamera | null>;
  containerRef: React.RefObject<HTMLDivElement | null>;
  isDrawMode: boolean;
  currentColor: string;
  thickness: number;
  depth: number;
}

interface UseDrawingReturn {
  strokesRef: React.RefObject<Stroke[]>;
  handleMouseDown: (e: React.MouseEvent) => void;
  handleMouseMove: (e: React.MouseEvent) => void;
  handleMouseUp: () => void;
  solidifyAll: () => void;
  clearAll: () => void;
}

export function useDrawing({
  sceneRef,
  cameraRef,
  containerRef,
  isDrawMode,
  currentColor,
  thickness,
  depth,
}: UseDrawingProps): UseDrawingReturn {
  const strokesRef = useRef<Stroke[]>([]);
  const currentStrokeRef = useRef<Stroke | null>(null);
  const isDrawingRef = useRef(false);
  const planeRef = useRef(new THREE.Plane(new THREE.Vector3(0, 0, 1), 0));

  const generateId = () => Math.random().toString(36).substring(2, 9);

  const getWorldPosition = useCallback(
    (e: React.MouseEvent): THREE.Vector3 | null => {
      if (!containerRef.current || !cameraRef.current) return null;

      const rect = containerRef.current.getBoundingClientRect();
      const mouse = new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1
      );

      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(mouse, cameraRef.current);

      planeRef.current.constant = -depth;

      const intersectPoint = new THREE.Vector3();
      raycaster.ray.intersectPlane(planeRef.current, intersectPoint);

      return intersectPoint;
    },
    [containerRef, cameraRef, depth]
  );

  const updateStrokeLine = useCallback(
    (stroke: Stroke) => {
      if (!sceneRef.current || stroke.points.length < 2) return;

      if (stroke.line) {
        sceneRef.current.remove(stroke.line);
        stroke.line.geometry.dispose();
        (stroke.line.material as THREE.Material).dispose();
      }

      const geometry = new THREE.BufferGeometry().setFromPoints(stroke.points);
      const material = new THREE.LineBasicMaterial({
        color: stroke.color,
        linewidth: 2,
      });
      const line = new THREE.Line(geometry, material);
      stroke.line = line;
      sceneRef.current.add(line);
    },
    [sceneRef]
  );

  const solidifyStroke = useCallback(
    (stroke: Stroke) => {
      if (!sceneRef.current || stroke.points.length < 2 || stroke.isSolidified)
        return;

      if (stroke.line) {
        sceneRef.current.remove(stroke.line);
        stroke.line.geometry.dispose();
        (stroke.line.material as THREE.Material).dispose();
        stroke.line = undefined;
      }

      if (stroke.mesh) {
        sceneRef.current.remove(stroke.mesh);
        stroke.mesh.geometry.dispose();
        (stroke.mesh.material as THREE.Material).dispose();
      }

      const curve = new THREE.CatmullRomCurve3(stroke.points);
      const tubeGeometry = new THREE.TubeGeometry(
        curve,
        Math.max(stroke.points.length * 2, 20),
        stroke.thickness,
        8,
        false
      );

      const material = new THREE.MeshPhongMaterial({
        color: stroke.color,
        shininess: 100,
        specular: 0x444444,
      });

      const mesh = new THREE.Mesh(tubeGeometry, material);
      stroke.mesh = mesh;
      stroke.isSolidified = true;
      sceneRef.current.add(mesh);
    },
    [sceneRef]
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (!isDrawMode || e.button !== 0) return;

      const worldPos = getWorldPosition(e);
      if (!worldPos) return;

      isDrawingRef.current = true;
      currentStrokeRef.current = {
        id: generateId(),
        points: [worldPos],
        color: currentColor,
        thickness: thickness,
        isSolidified: false,
      };
    },
    [isDrawMode, getWorldPosition, currentColor, thickness]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isDrawingRef.current || !currentStrokeRef.current) return;

      const worldPos = getWorldPosition(e);
      if (!worldPos) return;

      const lastPoint =
        currentStrokeRef.current.points[
          currentStrokeRef.current.points.length - 1
        ];
      if (lastPoint.distanceTo(worldPos) > 0.05) {
        currentStrokeRef.current.points.push(worldPos);
        updateStrokeLine(currentStrokeRef.current);
      }
    },
    [getWorldPosition, updateStrokeLine]
  );

  const handleMouseUp = useCallback(() => {
    if (!isDrawingRef.current || !currentStrokeRef.current) return;

    if (currentStrokeRef.current.points.length >= 2) {
      strokesRef.current.push(currentStrokeRef.current);
    } else if (currentStrokeRef.current.line && sceneRef.current) {
      sceneRef.current.remove(currentStrokeRef.current.line);
    }

    isDrawingRef.current = false;
    currentStrokeRef.current = null;
  }, [sceneRef]);

  const solidifyAll = useCallback(() => {
    strokesRef.current.forEach((stroke) => {
      if (!stroke.isSolidified) {
        solidifyStroke(stroke);
      }
    });
  }, [solidifyStroke]);

  const clearAll = useCallback(() => {
    if (!sceneRef.current) return;

    strokesRef.current.forEach((stroke) => {
      if (stroke.line) {
        sceneRef.current!.remove(stroke.line);
        stroke.line.geometry.dispose();
        (stroke.line.material as THREE.Material).dispose();
      }
      if (stroke.mesh) {
        sceneRef.current!.remove(stroke.mesh);
        stroke.mesh.geometry.dispose();
        (stroke.mesh.material as THREE.Material).dispose();
      }
    });
    strokesRef.current = [];
  }, [sceneRef]);

  return {
    strokesRef,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    solidifyAll,
    clearAll,
  };
}
