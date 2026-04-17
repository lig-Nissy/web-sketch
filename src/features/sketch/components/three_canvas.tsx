"use client";

import { useState, useEffect, useRef } from "react";
import * as THREE from "three";
import { useThreeScene } from "../hooks/use_three_scene";
import { ControlPanel } from "./control_panel";
import { HelpPanel } from "./help_panel";
import type { Stroke } from "../types";

type Mode = "draw" | "select" | "camera";

export function ThreeCanvas() {
  const [mode, setMode] = useState<Mode>("draw");
  const [currentColor, setCurrentColor] = useState("#ff6b6b");
  const [thickness, setThickness] = useState(0.1);
  const [drawDistance, setDrawDistance] = useState(10);

  const { containerRef, canvas, scene, camera, controlsRef, raycastTargets, isDrawingRef } = useThreeScene();

  const strokesRef = useRef<Stroke[]>([]);
  const currentStrokeRef = useRef<Stroke | null>(null);
  const drawModeTypeRef = useRef<"floor" | "air" | null>(null);
  const fixedDrawDistanceRef = useRef<number | null>(null);
  const [selectedStroke, setSelectedStroke] = useState<Stroke | null>(null);

  // 最新の値をrefで保持
  const modeRef = useRef(mode);
  useEffect(() => { modeRef.current = mode; }, [mode]);

  const currentColorRef = useRef(currentColor);
  const thicknessRef = useRef(thickness);
  const drawDistanceRef = useRef(drawDistance);
  const selectedStrokeRef = useRef<Stroke | null>(null);

  useEffect(() => { currentColorRef.current = currentColor; }, [currentColor]);
  useEffect(() => { thicknessRef.current = thickness; }, [thickness]);
  useEffect(() => { drawDistanceRef.current = drawDistance; }, [drawDistance]);
  useEffect(() => { selectedStrokeRef.current = selectedStroke; }, [selectedStroke]);

  // モード切り替え時のコントロール制御
  useEffect(() => {
    if (controlsRef.current) {
      controlsRef.current.enabled = mode === "camera";
    }
  }, [mode, controlsRef]);

  // raycastTargetsをrefで保持
  const raycastTargetsRef = useRef<THREE.Mesh[]>([]);
  useEffect(() => { raycastTargetsRef.current = raycastTargets; }, [raycastTargets]);

  // Canvas にイベントを直接アタッチ
  useEffect(() => {
    if (!canvas || !scene || !camera) return;

    // 床へのレイキャスト結果を取得（描画距離より手前のみ）
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
        const hitPoint = floorIntersects[0].point;
        const distanceToHit = camera.position.distanceTo(hitPoint);

        // 描画距離より手前の場合のみ床として判定
        const currentDistance = fixedDrawDistanceRef.current ?? drawDistanceRef.current;
        if (distanceToHit < currentDistance) {
          return hitPoint.clone();
        }
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
      if (modeRef.current !== "draw") return;
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

    // 始点・終点マーカーを作成
    const createMarkers = (stroke: Stroke) => {
      if (stroke.points.length < 2) return;

      // 既存のマーカーを削除
      removeMarkers(stroke);

      const markerGeometry = new THREE.SphereGeometry(stroke.thickness * 2, 16, 16);

      // 始点マーカー（緑）
      const startMaterial = new THREE.MeshPhongMaterial({ color: 0x00ff00 });
      const startMarker = new THREE.Mesh(markerGeometry, startMaterial);
      startMarker.position.copy(stroke.points[0]);
      startMarker.userData.strokeId = stroke.id;
      startMarker.userData.markerType = "start";
      scene.add(startMarker);
      stroke.startMarker = startMarker;

      // 終点マーカー（赤）
      const endMaterial = new THREE.MeshPhongMaterial({ color: 0xff0000 });
      const endMarker = new THREE.Mesh(markerGeometry.clone(), endMaterial);
      endMarker.position.copy(stroke.points[stroke.points.length - 1]);
      endMarker.userData.strokeId = stroke.id;
      endMarker.userData.markerType = "end";
      scene.add(endMarker);
      stroke.endMarker = endMarker;
    };

    // マーカーを削除
    const removeMarkers = (stroke: Stroke) => {
      if (stroke.startMarker) {
        scene.remove(stroke.startMarker);
        stroke.startMarker.geometry.dispose();
        (stroke.startMarker.material as THREE.Material).dispose();
        stroke.startMarker = undefined;
      }
      if (stroke.endMarker) {
        scene.remove(stroke.endMarker);
        stroke.endMarker.geometry.dispose();
        (stroke.endMarker.material as THREE.Material).dispose();
        stroke.endMarker = undefined;
      }
    };

    // マーカーへのレイキャストをチェック
    const checkMarkerHit = (clientX: number, clientY: number): { stroke: Stroke; type: "start" | "end" } | null => {
      const rect = canvas.getBoundingClientRect();
      const mouse = new THREE.Vector2(
        ((clientX - rect.left) / rect.width) * 2 - 1,
        -((clientY - rect.top) / rect.height) * 2 + 1
      );

      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(mouse, camera);

      // 選択中のストロークのマーカーのみ
      const markers: THREE.Mesh[] = [];
      const selected = selectedStrokeRef.current;
      if (selected) {
        if (selected.startMarker) markers.push(selected.startMarker);
        if (selected.endMarker) markers.push(selected.endMarker);
      }

      const intersects = raycaster.intersectObjects(markers, false);
      if (intersects.length > 0) {
        const hit = intersects[0].object as THREE.Mesh;
        const strokeId = hit.userData.strokeId;
        const markerType = hit.userData.markerType as "start" | "end";
        const stroke = strokesRef.current.find(s => s.id === strokeId);
        if (stroke) {
          return { stroke, type: markerType };
        }
      }
      return null;
    };

    // ストロークのメッシュへのレイキャストをチェック
    const checkStrokeHit = (clientX: number, clientY: number): Stroke | null => {
      const rect = canvas.getBoundingClientRect();
      const mouse = new THREE.Vector2(
        ((clientX - rect.left) / rect.width) * 2 - 1,
        -((clientY - rect.top) / rect.height) * 2 + 1
      );

      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(mouse, camera);

      const meshes: THREE.Mesh[] = [];
      strokesRef.current.forEach(s => {
        if (s.mesh) meshes.push(s.mesh);
      });

      const intersects = raycaster.intersectObjects(meshes, false);
      if (intersects.length > 0) {
        const hitMesh = intersects[0].object as THREE.Mesh;
        return strokesRef.current.find(s => s.mesh === hitMesh) ?? null;
      }
      return null;
    };

    const handlePointerDown = (e: PointerEvent) => {
      if (e.button !== 0) return;

      // 選択モード
      if (modeRef.current === "select") {
        e.preventDefault();

        // マーカーをクリックした場合は描画モードへ
        const markerHit = checkMarkerHit(e.clientX, e.clientY);
        if (markerHit) {
          // 選択中のストロークの続きから描画開始
          canvas.setPointerCapture(e.pointerId);
          isDrawingRef.current = true;
          currentStrokeRef.current = markerHit.stroke;

          // マーカーを削除
          removeMarkers(markerHit.stroke);

          // 始点からの場合はポイントを逆順にする
          if (markerHit.type === "start") {
            markerHit.stroke.points.reverse();
          }

          setSelectedStroke(null);
          setMode("draw");
          return;
        }

        // ストロークをクリックした場合
        const strokeHit = checkStrokeHit(e.clientX, e.clientY);
        if (strokeHit) {
          // 既に選択中のストロークがあればマーカーを削除
          const prevSelected = selectedStrokeRef.current;
          if (prevSelected && prevSelected !== strokeHit) {
            removeMarkers(prevSelected);
          }

          // 新しいストロークを選択してマーカー表示
          setSelectedStroke(strokeHit);
          createMarkers(strokeHit);
        } else {
          // 何もない場所をクリックしたら選択解除
          const prevSelected = selectedStrokeRef.current;
          if (prevSelected) {
            removeMarkers(prevSelected);
          }
          setSelectedStroke(null);
        }
        return;
      }

      // 描画モード
      if (modeRef.current === "draw") {
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
      }
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

        // 新規ストロークの場合のみ配列に追加
        if (!strokesRef.current.includes(currentStrokeRef.current)) {
          strokesRef.current.push(currentStrokeRef.current);
        }
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
      if (stroke.startMarker) {
        scene.remove(stroke.startMarker);
        stroke.startMarker.geometry.dispose();
        (stroke.startMarker.material as THREE.Material).dispose();
      }
      if (stroke.endMarker) {
        scene.remove(stroke.endMarker);
        stroke.endMarker.geometry.dispose();
        (stroke.endMarker.material as THREE.Material).dispose();
      }
    });
    strokesRef.current = [];
    setSelectedStroke(null);
  };

  return (
    <div className="relative w-full h-screen">
      <div
        ref={containerRef}
        className="w-full h-full"
        style={{ cursor: mode === "draw" ? "crosshair" : mode === "select" ? "pointer" : "grab" }}
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
        onClear={clearAll}
      />

      <HelpPanel />
    </div>
  );
}
