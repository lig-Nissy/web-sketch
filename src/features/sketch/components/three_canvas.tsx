"use client";

import { useState, useEffect, useRef } from "react";
import * as THREE from "three";
import { useThreeScene } from "../hooks/use_three_scene";
import { ControlPanel } from "./control_panel";
import { HelpPanel } from "./help_panel";
import type { Stroke } from "../types";

export function ThreeCanvas() {
  const [isDrawMode, setIsDrawMode] = useState(true);
  const [currentColor, setCurrentColor] = useState("#ff6b6b");
  const [thickness, setThickness] = useState(0.1);
  const [drawDistance, setDrawDistance] = useState(10);

  const { containerRef, canvas, scene, camera, controlsRef, raycastTargets, isDrawingRef } = useThreeScene();

  const strokesRef = useRef<Stroke[]>([]);
  const currentStrokeRef = useRef<Stroke | null>(null);
  const drawModeTypeRef = useRef<"floor" | "air" | null>(null);
  const fixedDrawDistanceRef = useRef<number | null>(null);

  // 最新の値をrefで保持
  const isDrawModeRef = useRef(isDrawMode);
  const currentColorRef = useRef(currentColor);
  const thicknessRef = useRef(thickness);
  const drawDistanceRef = useRef(drawDistance);

  useEffect(() => { isDrawModeRef.current = isDrawMode; }, [isDrawMode]);
  useEffect(() => { currentColorRef.current = currentColor; }, [currentColor]);
  useEffect(() => { thicknessRef.current = thickness; }, [thickness]);
  useEffect(() => { drawDistanceRef.current = drawDistance; }, [drawDistance]);

  // 描画モード切り替え時のコントロール制御
  useEffect(() => {
    if (controlsRef.current) {
      controlsRef.current.enabled = !isDrawMode;
    }
  }, [isDrawMode, controlsRef]);

  // raycastTargetsをrefで保持
  const raycastTargetsRef = useRef<THREE.Mesh[]>([]);
  useEffect(() => { raycastTargetsRef.current = raycastTargets; }, [raycastTargets]);

  // Canvas にイベントを直接アタッチ
  useEffect(() => {
    if (!canvas || !scene || !camera) return;

    // 床へのレイキャスト結果を取得
    const getFloorIntersection = (clientX: number, clientY: number): THREE.Vector3 | null => {
      const rect = canvas.getBoundingClientRect();
      const mouse = new THREE.Vector2(
        ((clientX - rect.left) / rect.width) * 2 - 1,
        -((clientY - rect.top) / rect.height) * 2 + 1
      );

      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(mouse, camera);

      const floorTargets = raycastTargetsRef.current.filter(t => t.userData.type === "floor");
      const floorIntersects = raycaster.intersectObjects(floorTargets, false);

      if (floorIntersects.length > 0) {
        return floorIntersects[0].point.clone();
      }
      return null;
    };

    // 空中の位置を取得（固定距離を使用）
    const getAirPosition = (clientX: number, clientY: number, distance: number): THREE.Vector3 => {
      const rect = canvas.getBoundingClientRect();
      const mouse = new THREE.Vector2(
        ((clientX - rect.left) / rect.width) * 2 - 1,
        -((clientY - rect.top) / rect.height) * 2 + 1
      );

      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(mouse, camera);

      const direction = raycaster.ray.direction.clone().normalize();
      return camera.position.clone().add(direction.multiplyScalar(distance));
    };

    // 描画モードに応じて位置を取得
    const getWorldPosition = (clientX: number, clientY: number): THREE.Vector3 | null => {
      // 描画中はそのモードを維持
      if (drawModeTypeRef.current === "floor") {
        const floorPos = getFloorIntersection(clientX, clientY);
        if (floorPos) return floorPos;
        return getAirPosition(clientX, clientY, fixedDrawDistanceRef.current ?? drawDistanceRef.current);
      } else if (drawModeTypeRef.current === "air" && fixedDrawDistanceRef.current !== null) {
        return getAirPosition(clientX, clientY, fixedDrawDistanceRef.current);
      }

      // 描画開始時: 床にヒットするかチェック
      const floorPos = getFloorIntersection(clientX, clientY);
      if (floorPos) {
        drawModeTypeRef.current = "floor";
        fixedDrawDistanceRef.current = drawDistanceRef.current;
        return floorPos;
      }

      // 空中モード: 現在の描画距離を固定
      drawModeTypeRef.current = "air";
      fixedDrawDistanceRef.current = drawDistanceRef.current;
      return getAirPosition(clientX, clientY, fixedDrawDistanceRef.current);
    };

    // スクロールで描画距離を調整
    const handleWheel = (e: WheelEvent) => {
      if (!isDrawModeRef.current) return;
      if (isDrawingRef.current) return; // 描画中は変更不可
      e.preventDefault();

      const delta = e.deltaY > 0 ? -1 : 1;
      setDrawDistance(prev => Math.max(2, Math.min(60, prev + delta)));
    };

    const updateStrokeMesh = (stroke: Stroke) => {
      if (stroke.points.length < 2) return;

      if (stroke.mesh) {
        scene.remove(stroke.mesh);
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
        side: THREE.DoubleSide,
      });

      const mesh = new THREE.Mesh(tubeGeometry, material);
      stroke.mesh = mesh;
      scene.add(mesh);
    };

    const handlePointerDown = (e: PointerEvent) => {
      if (!isDrawModeRef.current) return;
      if (e.button !== 0) return;

      e.preventDefault();
      canvas.setPointerCapture(e.pointerId);

      const worldPos = getWorldPosition(e.clientX, e.clientY);
      if (!worldPos) return;

      isDrawingRef.current = true;
      currentStrokeRef.current = {
        id: Math.random().toString(36).substring(2, 9),
        points: [worldPos.clone()],
        color: currentColorRef.current,
        thickness: thicknessRef.current,
        isSolidified: false,
      };
    };

    const handlePointerMove = (e: PointerEvent) => {
      if (!isDrawingRef.current || !currentStrokeRef.current) return;

      const worldPos = getWorldPosition(e.clientX, e.clientY);
      if (!worldPos) return;

      const lastPoint = currentStrokeRef.current.points[currentStrokeRef.current.points.length - 1];
      if (lastPoint.distanceTo(worldPos) > 0.1) {
        currentStrokeRef.current.points.push(worldPos.clone());
        updateStrokeMesh(currentStrokeRef.current);
      }
    };

    const handlePointerUp = (e: PointerEvent) => {
      if (!isDrawingRef.current || !currentStrokeRef.current) return;

      canvas.releasePointerCapture(e.pointerId);

      if (currentStrokeRef.current.points.length >= 2) {
        currentStrokeRef.current.isSolidified = true;
        strokesRef.current.push(currentStrokeRef.current);
      } else if (currentStrokeRef.current.mesh) {
        scene.remove(currentStrokeRef.current.mesh);
        currentStrokeRef.current.mesh.geometry.dispose();
        (currentStrokeRef.current.mesh.material as THREE.Material).dispose();
      }

      isDrawingRef.current = false;
      currentStrokeRef.current = null;
      drawModeTypeRef.current = null;
      fixedDrawDistanceRef.current = null;
    };

    canvas.addEventListener("pointerdown", handlePointerDown);
    canvas.addEventListener("pointermove", handlePointerMove);
    canvas.addEventListener("pointerup", handlePointerUp);
    canvas.addEventListener("pointerleave", handlePointerUp);
    canvas.addEventListener("pointercancel", handlePointerUp);
    canvas.addEventListener("wheel", handleWheel, { passive: false });

    return () => {
      canvas.removeEventListener("pointerdown", handlePointerDown);
      canvas.removeEventListener("pointermove", handlePointerMove);
      canvas.removeEventListener("pointerup", handlePointerUp);
      canvas.removeEventListener("pointerleave", handlePointerUp);
      canvas.removeEventListener("pointercancel", handlePointerUp);
      canvas.removeEventListener("wheel", handleWheel);
    };
  }, [canvas, scene, camera, isDrawingRef]);

  const clearAll = () => {
    if (!scene) return;

    strokesRef.current.forEach((stroke) => {
      if (stroke.mesh) {
        scene.remove(stroke.mesh);
        stroke.mesh.geometry.dispose();
        (stroke.mesh.material as THREE.Material).dispose();
      }
    });
    strokesRef.current = [];
  };

  return (
    <div className="relative w-full h-screen">
      <div
        ref={containerRef}
        className="w-full h-full"
        style={{ cursor: isDrawMode ? "crosshair" : "grab" }}
      />

      <ControlPanel
        isDrawMode={isDrawMode}
        setIsDrawMode={setIsDrawMode}
        currentColor={currentColor}
        setCurrentColor={setCurrentColor}
        thickness={thickness}
        setThickness={setThickness}
        drawDistance={drawDistance}
        setDrawDistance={setDrawDistance}
        onClear={clearAll}
      />

      <HelpPanel />
    </div>
  );
}
