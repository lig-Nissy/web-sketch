"use client";

import { useState, useEffect, useRef } from "react";
import * as THREE from "three";
import {
  useThreeScene,
  usePlayerCollision,
  useParticleAnimation,
  useStrokeActions,
  useDrawingInput,
  useCameraLook,
} from "../hooks";
import { ControlPanel } from "./control_panel";
import { HelpPanel } from "./help_panel";
import type { Stroke, PenType, ObjectType, PlacedObject } from "../types";

type Mode = "draw" | "select" | "camera" | "object";
type DrawModeType = "floor" | "air" | "forceFloor" | null;

export function ThreeCanvas() {
  const [mode, setMode] = useState<Mode>("draw");
  const [currentColor, setCurrentColor] = useState("#ff6b6b");
  const [thickness, setThickness] = useState(0.1);
  const [drawDistance, setDrawDistance] = useState(10);
  const [penType, setPenType] = useState<PenType>("normal");
  const [objectType, setObjectType] = useState<ObjectType>("cube");
  const [objectGravity, setObjectGravity] = useState(false);
  const [selectedStroke, setSelectedStroke] = useState<Stroke | null>(null);

  const {
    containerRef,
    canvas,
    scene,
    camera,
    controlsRef,
    raycastTargets,
    isDrawingRef,
    onAnimateRef,
    collisionCheckRef,
    physicsWorld,
    resetBowlingRef,
  } = useThreeScene();

  const strokesRef = useRef<Stroke[]>([]);
  const objectsRef = useRef<PlacedObject[]>([]);
  const currentStrokeRef = useRef<Stroke | null>(null);
  const drawModeTypeRef = useRef<DrawModeType>(null);
  const fixedDrawDistanceRef = useRef<number | null>(null);
  const selectedStrokeRef = useRef<Stroke | null>(null);

  const modeRef = useRef(mode);
  const currentColorRef = useRef(currentColor);
  const thicknessRef = useRef(thickness);
  const drawDistanceRef = useRef(drawDistance);
  const penTypeRef = useRef(penType);
  const objectTypeRef = useRef(objectType);
  const objectGravityRef = useRef(objectGravity);
  const raycastTargetsRef = useRef<THREE.Mesh[]>([]);

  useEffect(() => { modeRef.current = mode; }, [mode]);
  useEffect(() => { currentColorRef.current = currentColor; }, [currentColor]);
  useEffect(() => { thicknessRef.current = thickness; }, [thickness]);
  useEffect(() => { drawDistanceRef.current = drawDistance; }, [drawDistance]);
  useEffect(() => { penTypeRef.current = penType; }, [penType]);
  useEffect(() => { objectTypeRef.current = objectType; }, [objectType]);
  useEffect(() => { objectGravityRef.current = objectGravity; }, [objectGravity]);
  useEffect(() => { selectedStrokeRef.current = selectedStroke; }, [selectedStroke]);
  useEffect(() => { raycastTargetsRef.current = raycastTargets; }, [raycastTargets]);

  useEffect(() => {
    const controls = controlsRef.current;
    if (!controls) return;

    if (mode === "camera") {
      // camera モード: target をカメラ前方に張り直してから OrbitControls 有効化
      const cam = controls.object as THREE.PerspectiveCamera;
      const forward = new THREE.Vector3();
      cam.getWorldDirection(forward);
      controls.target.copy(cam.position).add(forward);
      controls.enabled = true;
      controls.enableZoom = true;
      controls.mouseButtons = {
        LEFT: THREE.MOUSE.ROTATE,
        MIDDLE: THREE.MOUSE.DOLLY,
        RIGHT: THREE.MOUSE.PAN,
      };
      controls.update();
    } else {
      // それ以外（draw / select / object）: OrbitControls は無効。
      // draw 中のカメラ回転は自前の FPS 風実装（use_camera_look）が担当。
      controls.enabled = false;
    }
  }, [mode, controlsRef]);

  useCameraLook({ canvas, camera, modeRef, isDrawingRef });

  usePlayerCollision({ collisionCheckRef, strokesRef, objectsRef });

  useParticleAnimation({ onAnimateRef, scene, physicsWorld, strokesRef, objectsRef });

  const { clearAll } = useStrokeActions({
    scene,
    physicsWorld,
    strokesRef,
    objectsRef,
    selectedStroke,
    setSelectedStroke,
    mode,
  });

  useDrawingInput({
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
  });

  return (
    <div className="relative w-full h-screen">
      <div
        ref={containerRef}
        className="w-full h-full"
        style={{
          cursor:
            mode === "draw"
              ? "crosshair"
              : mode === "select"
                ? "pointer"
                : mode === "object"
                  ? "cell"
                  : "grab",
        }}
      />

      <ControlPanel
        mode={mode}
        setMode={setMode}
        currentColor={currentColor}
        setCurrentColor={setCurrentColor}
        thickness={thickness}
        setThickness={setThickness}
        drawDistance={drawDistance}
        setDrawDistance={setDrawDistance}
        penType={penType}
        setPenType={setPenType}
        objectType={objectType}
        setObjectType={setObjectType}
        objectGravity={objectGravity}
        setObjectGravity={setObjectGravity}
        onClear={clearAll}
      />

      <HelpPanel />
    </div>
  );
}
