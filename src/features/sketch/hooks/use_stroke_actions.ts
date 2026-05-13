import { useCallback, useEffect, type RefObject } from "react";
import * as THREE from "three";
import type RAPIER from "@dimforge/rapier3d-compat";
import type { Stroke, PlacedObject } from "../types";
import { disposeObject3D } from "../utils";

type Mode = "draw" | "select" | "camera" | "object";

interface UseStrokeActionsArgs {
  scene: THREE.Scene | null;
  physicsWorld: RAPIER.World | null;
  strokesRef: RefObject<Stroke[]>;
  objectsRef: RefObject<PlacedObject[]>;
  selectedStroke: Stroke | null;
  setSelectedStroke: (s: Stroke | null) => void;
  mode: Mode;
}

export function useStrokeActions({
  scene,
  physicsWorld,
  strokesRef,
  objectsRef,
  selectedStroke,
  setSelectedStroke,
  mode,
}: UseStrokeActionsArgs) {
  const disposeMesh = useCallback(
    (obj: THREE.Object3D) => {
      if (!scene) return;
      disposeObject3D(obj, scene);
    },
    [scene]
  );

  const clearAll = useCallback(() => {
    if (!scene) return;

    strokesRef.current.forEach((stroke) => {
      if (stroke.mesh) disposeMesh(stroke.mesh);
      if (stroke.particles) disposeMesh(stroke.particles);
      if (stroke.startMarker) disposeMesh(stroke.startMarker);
      if (stroke.endMarker) disposeMesh(stroke.endMarker);
    });
    strokesRef.current = [];

    objectsRef.current.forEach((obj) => {
      if (obj.group) disposeMesh(obj.group);
      if (obj.mesh) disposeMesh(obj.mesh);
      if (obj.particles) disposeMesh(obj.particles);
      if (obj.rigidBody && physicsWorld) {
        physicsWorld.removeRigidBody(obj.rigidBody);
      }
    });
    objectsRef.current = [];

    setSelectedStroke(null);
  }, [scene, physicsWorld, strokesRef, objectsRef, setSelectedStroke, disposeMesh]);

  const deleteSelectedStroke = useCallback(() => {
    if (!scene || !selectedStroke) return;

    if (selectedStroke.mesh) disposeMesh(selectedStroke.mesh);
    if (selectedStroke.particles) disposeMesh(selectedStroke.particles);
    if (selectedStroke.startMarker) disposeMesh(selectedStroke.startMarker);
    if (selectedStroke.endMarker) disposeMesh(selectedStroke.endMarker);

    strokesRef.current = strokesRef.current.filter((s) => s.id !== selectedStroke.id);
    setSelectedStroke(null);
  }, [scene, selectedStroke, strokesRef, setSelectedStroke, disposeMesh]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.key === "Delete" || e.key === "Backspace") && selectedStroke && mode === "select") {
        e.preventDefault();
        deleteSelectedStroke();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedStroke, mode, deleteSelectedStroke]);

  return { clearAll, deleteSelectedStroke };
}
