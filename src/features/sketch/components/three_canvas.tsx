"use client";

import { useState, useEffect, useRef } from "react";
import * as THREE from "three";
import { useThreeScene } from "../hooks/use_three_scene";
import { ControlPanel } from "./control_panel";
import { HelpPanel } from "./help_panel";
import type { Stroke, PenType, StampType, Stamp } from "../types";

type Mode = "draw" | "select" | "camera" | "stamp";

export function ThreeCanvas() {
  const [mode, setMode] = useState<Mode>("draw");
  const [currentColor, setCurrentColor] = useState("#ff6b6b");
  const [thickness, setThickness] = useState(0.1);
  const [drawDistance, setDrawDistance] = useState(10);
  const [penType, setPenType] = useState<PenType>("normal");
  const [stampType, setStampType] = useState<StampType>("shooting_star");

  const { containerRef, canvas, scene, camera, controlsRef, raycastTargets, isDrawingRef, onAnimateRef, collisionCheckRef } = useThreeScene();

  const strokesRef = useRef<Stroke[]>([]);
  const stampsRef = useRef<Stamp[]>([]);
  const currentStrokeRef = useRef<Stroke | null>(null);
  const drawModeTypeRef = useRef<"floor" | "air" | "forceFloor" | null>(null);
  const fixedDrawDistanceRef = useRef<number | null>(null);
  const [selectedStroke, setSelectedStroke] = useState<Stroke | null>(null);

  const stampTypeRef = useRef(stampType);
  useEffect(() => { stampTypeRef.current = stampType; }, [stampType]);

  // 最新の値をrefで保持
  const modeRef = useRef(mode);
  useEffect(() => { modeRef.current = mode; }, [mode]);

  const currentColorRef = useRef(currentColor);
  const thicknessRef = useRef(thickness);
  const drawDistanceRef = useRef(drawDistance);
  const selectedStrokeRef = useRef<Stroke | null>(null);

  const penTypeRef = useRef(penType);

  useEffect(() => { currentColorRef.current = currentColor; }, [currentColor]);
  useEffect(() => { thicknessRef.current = thickness; }, [thickness]);
  useEffect(() => { drawDistanceRef.current = drawDistance; }, [drawDistance]);
  useEffect(() => { selectedStrokeRef.current = selectedStroke; }, [selectedStroke]);
  useEffect(() => { penTypeRef.current = penType; }, [penType]);

  // モード切り替え時のコントロール制御
  useEffect(() => {
    if (controlsRef.current) {
      controlsRef.current.enabled = mode === "camera";
    }
  }, [mode, controlsRef]);

  // raycastTargetsをrefで保持
  const raycastTargetsRef = useRef<THREE.Mesh[]>([]);
  useEffect(() => { raycastTargetsRef.current = raycastTargets; }, [raycastTargets]);

  // ストロークとの衝突判定
  useEffect(() => {
    if (!collisionCheckRef) return;

    const COLLISION_RADIUS = 0.5; // プレイヤーの当たり判定半径

    const checkCollision = (pos: THREE.Vector3): boolean => {
      for (const stroke of strokesRef.current) {
        if (!stroke.isSolidified || stroke.points.length < 2) continue;

        // ストロークの各セグメントとの距離をチェック
        for (let i = 0; i < stroke.points.length - 1; i++) {
          const p1 = stroke.points[i];
          const p2 = stroke.points[i + 1];

          // 線分と点の最短距離を計算
          const line = new THREE.Vector3().subVectors(p2, p1);
          const lineLength = line.length();
          if (lineLength === 0) continue;

          const lineDir = line.normalize();
          const toPos = new THREE.Vector3().subVectors(pos, p1);

          // 線分上の最近接点を求める
          let t = toPos.dot(lineDir);
          t = Math.max(0, Math.min(lineLength, t));

          const closestPoint = p1.clone().add(lineDir.multiplyScalar(t));
          const distance = pos.distanceTo(closestPoint);

          // 衝突判定（ストロークの太さ + プレイヤー半径）
          if (distance < stroke.thickness + COLLISION_RADIUS) {
            return true;
          }
        }
      }
      return false;
    };

    collisionCheckRef.current = checkCollision;

    return () => {
      collisionCheckRef.current = null;
    };
  }, [collisionCheckRef]);

  // パーティクルアニメーション
  useEffect(() => {
    if (!onAnimateRef) return;

    const animateParticles = () => {
      const time = Date.now() * 0.001;

      // ストロークのパーティクルアニメーション
      strokesRef.current.forEach((stroke) => {
        if (!stroke.particles) return;

        const positions = stroke.particles.geometry.attributes.position;
        const sizes = stroke.particles.geometry.attributes.size;

        if (stroke.penType === "fire") {
          // 炎: 上に揺らめく
          for (let i = 0; i < positions.count; i++) {
            const y = positions.getY(i);
            positions.setY(i, y + Math.sin(time * 5 + i) * 0.02);
            positions.setX(i, positions.getX(i) + Math.sin(time * 3 + i * 0.5) * 0.01);

            // サイズを変動
            const baseSize = sizes.array[i];
            sizes.setX(i, baseSize * (0.8 + Math.sin(time * 10 + i) * 0.2));
          }
          positions.needsUpdate = true;
          sizes.needsUpdate = true;
        } else if (stroke.penType === "star") {
          // 星: キラキラ点滅
          for (let i = 0; i < sizes.count; i++) {
            const baseSize = stroke.thickness * (1 + Math.random() * 0.5);
            sizes.setX(i, baseSize * (0.5 + Math.abs(Math.sin(time * 8 + i * 2)) * 0.5));
          }
          sizes.needsUpdate = true;
        }
      });

      // スタンプのアニメーション
      stampsRef.current.forEach((stamp) => {
        if (stamp.type === "shooting_star" && stamp.particles) {
          // 流れ星: パーティクルを斜め下に流す
          const positions = stamp.particles.geometry.attributes.position;
          const initialPositions = stamp.animationData?.initialPositions as Float32Array;

          if (initialPositions) {
            for (let i = 0; i < positions.count; i++) {
              const offset = (time * 3 + i * 0.1) % 2;
              positions.setX(i, initialPositions[i * 3] + offset * 2);
              positions.setY(i, initialPositions[i * 3 + 1] - offset * 2);
              positions.setZ(i, initialPositions[i * 3 + 2]);
            }
            positions.needsUpdate = true;
          }
        } else if (stamp.type === "cow" && stamp.group) {
          // 牛: ゆらゆら揺れる
          stamp.group.rotation.y = Math.sin(time * 2) * 0.1;
          stamp.group.position.y = (stamp.animationData?.baseY as number || 0) + Math.sin(time * 3) * 0.1;
        }
      });
    };

    onAnimateRef.current = animateParticles;

    return () => {
      onAnimateRef.current = null;
    };
  }, [onAnimateRef]);

  // Canvas にイベントを直接アタッチ
  useEffect(() => {
    if (!canvas || !scene || !camera) return;

    const BOUNDARY = 48; // 描画可能な境界

    // 位置が境界内かチェック
    const isWithinBoundary = (pos: THREE.Vector3): boolean => {
      return pos.x >= -BOUNDARY && pos.x <= BOUNDARY &&
             pos.z >= -BOUNDARY && pos.z <= BOUNDARY;
    };

    // 位置を境界内に制限
    const clampToBoundary = (pos: THREE.Vector3): THREE.Vector3 => {
      return new THREE.Vector3(
        Math.max(-BOUNDARY, Math.min(BOUNDARY, pos.x)),
        pos.y,
        Math.max(-BOUNDARY, Math.min(BOUNDARY, pos.z))
      );
    };

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
          // 境界内に制限
          return clampToBoundary(hitPoint.clone());
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
      const pos = camera.position.clone().add(direction.multiplyScalar(distance));
      // 境界内に制限
      return clampToBoundary(pos);
    };

    // 床平面（y=-5）への投影位置を取得
    const getFloorProjection = (clientX: number, clientY: number): THREE.Vector3 | null => {
      const rect = canvas.getBoundingClientRect();
      const mouse = new THREE.Vector2(
        ((clientX - rect.left) / rect.width) * 2 - 1,
        -((clientY - rect.top) / rect.height) * 2 + 1
      );

      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(mouse, camera);

      // y=-5 の平面との交点を計算
      const floorY = -5;
      const direction = raycaster.ray.direction;
      const origin = raycaster.ray.origin;

      // 平面との交点: origin + t * direction で y = floorY となる t を求める
      if (Math.abs(direction.y) < 0.0001) return null; // ほぼ水平なら交点なし
      const t = (floorY - origin.y) / direction.y;
      if (t < 0) return null; // カメラの後ろは無視

      const pos = new THREE.Vector3(
        origin.x + t * direction.x,
        floorY,
        origin.z + t * direction.z
      );
      // 境界内に制限
      return clampToBoundary(pos);
    };

    // 描画モードに応じて位置を取得
    // shiftKey: 強制的に空中モード
    // altKey: 強制的に床モード（常に y=-5 に張り付く）
    const getWorldPosition = (clientX: number, clientY: number, shiftKey = false, altKey = false): THREE.Vector3 | null => {
      // 描画中はそのモードを維持
      if (drawModeTypeRef.current === "floor") {
        const floorPos = getFloorIntersection(clientX, clientY);
        if (floorPos) return floorPos;
        return getAirPosition(clientX, clientY, fixedDrawDistanceRef.current ?? drawDistanceRef.current);
      } else if (drawModeTypeRef.current === "air" && fixedDrawDistanceRef.current !== null) {
        return getAirPosition(clientX, clientY, fixedDrawDistanceRef.current);
      } else if (drawModeTypeRef.current === "forceFloor") {
        // 強制床モード: 常に y=-5 に張り付く
        return getFloorProjection(clientX, clientY);
      }

      // 描画開始時: モディファイアキーで強制指定
      if (shiftKey) {
        // Shift: 強制的に空中モード
        drawModeTypeRef.current = "air";
        fixedDrawDistanceRef.current = drawDistanceRef.current;
        return getAirPosition(clientX, clientY, fixedDrawDistanceRef.current);
      }

      if (altKey) {
        // Alt(Option): 強制床モード（常に y=-5 に張り付く）
        drawModeTypeRef.current = "forceFloor";
        return getFloorProjection(clientX, clientY);
      }

      // 通常: 床にヒットするかチェック
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
      if (modeRef.current !== "draw" && modeRef.current !== "stamp") return;
      if (isDrawingRef.current) return; // 描画中は変更不可
      e.preventDefault();

      const delta = e.deltaY > 0 ? -1 : 1;
      setDrawDistance(prev => Math.max(2, Math.min(60, prev + delta)));
    };

    // 流れ星スタンプを作成
    const createShootingStarStamp = (position: THREE.Vector3): Stamp => {
      const particleCount = 50;
      const positions = new Float32Array(particleCount * 3);
      const colors = new Float32Array(particleCount * 3);
      const sizes = new Float32Array(particleCount);

      const starColors = [
        new THREE.Color(0xffff00),
        new THREE.Color(0xffffaa),
        new THREE.Color(0xffffff),
      ];

      for (let i = 0; i < particleCount; i++) {
        // 斜めに配置
        const t = i / particleCount;
        positions[i * 3] = position.x - t * 2;
        positions[i * 3 + 1] = position.y + t * 2;
        positions[i * 3 + 2] = position.z;

        const color = starColors[Math.floor(Math.random() * starColors.length)];
        colors[i * 3] = color.r;
        colors[i * 3 + 1] = color.g;
        colors[i * 3 + 2] = color.b;

        sizes[i] = 0.1 + Math.random() * 0.2;
      }

      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
      geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
      geometry.setAttribute("size", new THREE.BufferAttribute(sizes, 1));

      const material = new THREE.PointsMaterial({
        size: 0.3,
        vertexColors: true,
        transparent: true,
        opacity: 0.9,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });

      const particles = new THREE.Points(geometry, material);
      scene.add(particles);

      return {
        id: Math.random().toString(36).substring(2, 9),
        type: "shooting_star",
        position: position.clone(),
        particles,
        animationData: {
          initialPositions: positions.slice(), // 初期位置を保存
        },
      };
    };

    // 牛スタンプを作成
    const createCowStamp = (position: THREE.Vector3): Stamp => {
      const group = new THREE.Group();

      // 体
      const bodyGeometry = new THREE.BoxGeometry(1.2, 0.8, 0.7);
      const bodyMaterial = new THREE.MeshPhongMaterial({ color: 0xffffff });
      const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
      body.position.y = 0.5;
      group.add(body);

      // 頭
      const headGeometry = new THREE.BoxGeometry(0.5, 0.5, 0.5);
      const head = new THREE.Mesh(headGeometry, bodyMaterial);
      head.position.set(0.7, 0.7, 0);
      group.add(head);

      // 目（左右）
      const eyeGeometry = new THREE.SphereGeometry(0.08, 8, 8);
      const eyeMaterial = new THREE.MeshPhongMaterial({ color: 0x000000 });
      const leftEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
      leftEye.position.set(0.95, 0.75, 0.15);
      group.add(leftEye);
      const rightEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
      rightEye.position.set(0.95, 0.75, -0.15);
      group.add(rightEye);

      // 鼻
      const noseGeometry = new THREE.BoxGeometry(0.15, 0.15, 0.3);
      const noseMaterial = new THREE.MeshPhongMaterial({ color: 0xffcccc });
      const nose = new THREE.Mesh(noseGeometry, noseMaterial);
      nose.position.set(0.95, 0.55, 0);
      group.add(nose);

      // 角（左右）
      const hornGeometry = new THREE.ConeGeometry(0.08, 0.3, 8);
      const hornMaterial = new THREE.MeshPhongMaterial({ color: 0xccccaa });
      const leftHorn = new THREE.Mesh(hornGeometry, hornMaterial);
      leftHorn.position.set(0.65, 1.05, 0.2);
      leftHorn.rotation.z = -0.3;
      group.add(leftHorn);
      const rightHorn = new THREE.Mesh(hornGeometry, hornMaterial);
      rightHorn.position.set(0.65, 1.05, -0.2);
      rightHorn.rotation.z = -0.3;
      group.add(rightHorn);

      // 足（4本）
      const legGeometry = new THREE.BoxGeometry(0.15, 0.4, 0.15);
      const legMaterial = new THREE.MeshPhongMaterial({ color: 0xffffff });
      const legPositions = [
        [0.4, 0.2, 0.2],
        [0.4, 0.2, -0.2],
        [-0.4, 0.2, 0.2],
        [-0.4, 0.2, -0.2],
      ];
      legPositions.forEach(([x, y, z]) => {
        const leg = new THREE.Mesh(legGeometry, legMaterial);
        leg.position.set(x, y, z);
        group.add(leg);
      });

      // 斑点
      const spotGeometry = new THREE.SphereGeometry(0.15, 8, 8);
      const spotMaterial = new THREE.MeshPhongMaterial({ color: 0x333333 });
      const spotPositions = [
        [0.2, 0.7, 0.35],
        [-0.3, 0.6, 0.35],
        [0, 0.8, -0.35],
        [-0.4, 0.5, -0.35],
      ];
      spotPositions.forEach(([x, y, z]) => {
        const spot = new THREE.Mesh(spotGeometry, spotMaterial);
        spot.position.set(x, y, z);
        spot.scale.set(1, 0.5, 0.3);
        group.add(spot);
      });

      // 尻尾
      const tailGeometry = new THREE.CylinderGeometry(0.03, 0.03, 0.5, 8);
      const tail = new THREE.Mesh(tailGeometry, bodyMaterial);
      tail.position.set(-0.7, 0.5, 0);
      tail.rotation.z = Math.PI / 4;
      group.add(tail);

      group.position.copy(position);
      group.position.y = position.y;
      scene.add(group);

      return {
        id: Math.random().toString(36).substring(2, 9),
        type: "cow",
        position: position.clone(),
        group,
        animationData: {
          baseY: position.y,
        },
      };
    };

    // スタンプを配置
    const placeStamp = (clientX: number, clientY: number) => {
      const worldPos = getWorldPosition(clientX, clientY);
      if (!worldPos) return;

      let stamp: Stamp;
      if (stampTypeRef.current === "shooting_star") {
        stamp = createShootingStarStamp(worldPos);
      } else {
        stamp = createCowStamp(worldPos);
      }
      stampsRef.current.push(stamp);
    };

    // オブジェクトを安全に破棄（useEffect内用）
    const disposeObject = (obj: THREE.Object3D) => {
      scene.remove(obj);
      obj.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          if (child.geometry) child.geometry.dispose();
          if (Array.isArray(child.material)) {
            child.material.forEach(m => m.dispose());
          } else if (child.material) {
            child.material.dispose();
          }
        }
      });
    };

    // ペンタイプに応じたマテリアルを作成
    const createMaterial = (stroke: Stroke): THREE.Material => {
      switch (stroke.penType) {
        case "fire":
          return new THREE.MeshPhongMaterial({
            color: stroke.color,
            emissive: stroke.color,
            emissiveIntensity: 0.5,
            shininess: 50,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.9,
          });
        case "star":
          return new THREE.MeshPhongMaterial({
            color: stroke.color,
            emissive: 0xffffff,
            emissiveIntensity: 0.3,
            shininess: 200,
            specular: 0xffffff,
            side: THREE.DoubleSide,
          });
        case "mirror":
          return new THREE.MeshPhongMaterial({
            color: stroke.color,
            shininess: 300,
            specular: 0xffffff,
            reflectivity: 1,
            side: THREE.DoubleSide,
            envMap: scene.environment,
          });
        default:
          return new THREE.MeshPhongMaterial({
            color: stroke.color,
            shininess: 100,
            specular: 0x444444,
            side: THREE.DoubleSide,
          });
      }
    };

    // 炎パーティクルを作成
    const createFireParticles = (stroke: Stroke, curve: THREE.CatmullRomCurve3) => {
      const particleCount = Math.max(stroke.points.length * 20, 100);
      const positions = new Float32Array(particleCount * 3);
      const colors = new Float32Array(particleCount * 3);
      const sizes = new Float32Array(particleCount);

      const baseColor = new THREE.Color(stroke.color);
      const fireColors = [
        new THREE.Color(0xff4500), // オレンジレッド
        new THREE.Color(0xff6600), // オレンジ
        new THREE.Color(0xffcc00), // 黄色
        baseColor,
      ];

      for (let i = 0; i < particleCount; i++) {
        const t = Math.random();
        const point = curve.getPointAt(t);
        const offset = new THREE.Vector3(
          (Math.random() - 0.5) * stroke.thickness * 4,
          Math.random() * stroke.thickness * 3,
          (Math.random() - 0.5) * stroke.thickness * 4
        );
        positions[i * 3] = point.x + offset.x;
        positions[i * 3 + 1] = point.y + offset.y;
        positions[i * 3 + 2] = point.z + offset.z;

        const color = fireColors[Math.floor(Math.random() * fireColors.length)];
        colors[i * 3] = color.r;
        colors[i * 3 + 1] = color.g;
        colors[i * 3 + 2] = color.b;

        sizes[i] = Math.random() * stroke.thickness * 3 + stroke.thickness;
      }

      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
      geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
      geometry.setAttribute("size", new THREE.BufferAttribute(sizes, 1));

      const material = new THREE.PointsMaterial({
        size: stroke.thickness * 2,
        vertexColors: true,
        transparent: true,
        opacity: 0.8,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });

      return new THREE.Points(geometry, material);
    };

    // 星パーティクルを作成
    const createStarParticles = (stroke: Stroke, curve: THREE.CatmullRomCurve3) => {
      const particleCount = Math.max(stroke.points.length * 50, 200);
      const positions = new Float32Array(particleCount * 3);
      const colors = new Float32Array(particleCount * 3);
      const sizes = new Float32Array(particleCount);

      const sparkleColors = [
        new THREE.Color(0xffffff),
        new THREE.Color(0xffffaa),
        new THREE.Color(0xaaffff),
        new THREE.Color(stroke.color),
      ];

      for (let i = 0; i < particleCount; i++) {
        const t = Math.random();
        const point = curve.getPointAt(t);
        const offset = new THREE.Vector3(
          (Math.random() - 0.5) * stroke.thickness * 3,
          (Math.random() - 0.5) * stroke.thickness * 3,
          (Math.random() - 0.5) * stroke.thickness * 3
        );
        positions[i * 3] = point.x + offset.x;
        positions[i * 3 + 1] = point.y + offset.y;
        positions[i * 3 + 2] = point.z + offset.z;

        const color = sparkleColors[Math.floor(Math.random() * sparkleColors.length)];
        colors[i * 3] = color.r;
        colors[i * 3 + 1] = color.g;
        colors[i * 3 + 2] = color.b;

        sizes[i] = Math.random() * stroke.thickness * 0.5 + stroke.thickness * 0.1;
      }

      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
      geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
      geometry.setAttribute("size", new THREE.BufferAttribute(sizes, 1));

      const material = new THREE.PointsMaterial({
        size: stroke.thickness * 0.4,
        vertexColors: true,
        transparent: true,
        opacity: 0.8,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });

      return new THREE.Points(geometry, material);
    };

    const updateStrokeMesh = (stroke: Stroke) => {
      if (stroke.points.length < 2) return;

      if (stroke.mesh) {
        disposeObject(stroke.mesh);
      }
      if (stroke.particles) {
        disposeObject(stroke.particles);
        stroke.particles = undefined;
      }

      const curve = new THREE.CatmullRomCurve3(stroke.points);
      const tubeSegments = Math.max(stroke.points.length * 2, 20);
      const tubeGeometry = new THREE.TubeGeometry(
        curve,
        tubeSegments,
        stroke.thickness,
        8,
        false
      );

      const material = createMaterial(stroke);

      // カーブの実際の端点と接線を取得
      const startPoint = curve.getPointAt(0);
      const endPoint = curve.getPointAt(1);
      const startTangent = curve.getTangentAt(0);
      const endTangent = curve.getTangentAt(1);

      // 端点にキャップ（半球）を追加
      const capGeometry = new THREE.SphereGeometry(
        stroke.thickness,
        8,
        8,
        0,
        Math.PI * 2,
        0,
        Math.PI / 2 // 半球
      );

      // 始点キャップ（接線の逆方向を向く）
      const startCap = new THREE.Mesh(capGeometry, material.clone());
      startCap.position.copy(startPoint);
      startCap.quaternion.setFromUnitVectors(
        new THREE.Vector3(0, 1, 0),
        startTangent.clone().negate()
      );

      // 終点キャップ（接線方向を向く）
      const endCap = new THREE.Mesh(capGeometry.clone(), material.clone());
      endCap.position.copy(endPoint);
      endCap.quaternion.setFromUnitVectors(
        new THREE.Vector3(0, 1, 0),
        endTangent
      );

      // 特殊ペンのパーティクル追加（炎・星は線なし）
      if (stroke.penType === "fire") {
        const particles = createFireParticles(stroke, curve);
        stroke.particles = particles;
        scene.add(particles);
        // 空のグループをmeshとして保持（レイキャスト用）
        const group = new THREE.Group();
        stroke.mesh = group as unknown as THREE.Mesh;
        return;
      } else if (stroke.penType === "star") {
        const particles = createStarParticles(stroke, curve);
        stroke.particles = particles;
        scene.add(particles);
        // 空のグループをmeshとして保持
        const group = new THREE.Group();
        stroke.mesh = group as unknown as THREE.Mesh;
        return;
      }

      // 通常・鏡ペンはチューブとキャップをグループ化
      const group = new THREE.Group();
      const tubeMesh = new THREE.Mesh(tubeGeometry, material);
      group.add(tubeMesh);
      group.add(startCap);
      group.add(endCap);

      stroke.mesh = group as unknown as THREE.Mesh;
      scene.add(group);
    };

    // 始点・終点マーカーを作成
    const createMarkers = (stroke: Stroke) => {
      if (stroke.points.length < 2) return;

      // 既存のマーカーを削除
      removeMarkers(stroke, false);

      const markerRadius = stroke.thickness * 2;
      const markerGeometry = new THREE.SphereGeometry(markerRadius, 16, 16);

      // 始点の方向ベクトル（始点から2番目の点への逆方向）
      const startDir = new THREE.Vector3()
        .subVectors(stroke.points[0], stroke.points[1])
        .normalize();
      const startPos = stroke.points[0].clone().add(startDir.multiplyScalar(markerRadius));

      // 終点の方向ベクトル（終点から1つ前の点への逆方向）
      const endIdx = stroke.points.length - 1;
      const endDir = new THREE.Vector3()
        .subVectors(stroke.points[endIdx], stroke.points[endIdx - 1])
        .normalize();
      const endPos = stroke.points[endIdx].clone().add(endDir.multiplyScalar(markerRadius));

      // 始点マーカー（緑）
      const startMaterial = new THREE.MeshPhongMaterial({ color: 0x00ff00 });
      const startMarker = new THREE.Mesh(markerGeometry, startMaterial);
      startMarker.position.copy(startPos);
      startMarker.userData.strokeId = stroke.id;
      startMarker.userData.markerType = "start";
      scene.add(startMarker);
      stroke.startMarker = startMarker;

      // 終点マーカー（赤）
      const endMaterial = new THREE.MeshPhongMaterial({ color: 0xff0000 });
      const endMarker = new THREE.Mesh(markerGeometry.clone(), endMaterial);
      endMarker.position.copy(endPos);
      endMarker.userData.strokeId = stroke.id;
      endMarker.userData.markerType = "end";
      scene.add(endMarker);
      stroke.endMarker = endMarker;
    };

    // マーカーを削除
    const removeMarkers = (stroke: Stroke, rebuildMesh = true) => {
      if (stroke.startMarker) {
        disposeObject(stroke.startMarker);
        stroke.startMarker = undefined;
      }
      if (stroke.endMarker) {
        disposeObject(stroke.endMarker);
        stroke.endMarker = undefined;
      }
      // マーカー削除後にメッシュを再構築して隙間を防ぐ
      if (rebuildMesh && stroke.isSolidified) {
        updateStrokeMesh(stroke);
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

      const objects: THREE.Object3D[] = [];
      strokesRef.current.forEach(s => {
        if (s.mesh) objects.push(s.mesh);
      });

      // recursive=true でグループの子要素も検索
      const intersects = raycaster.intersectObjects(objects, true);
      if (intersects.length > 0) {
        const hitObject = intersects[0].object;
        // 親グループを辿ってストロークを特定
        return strokesRef.current.find(s => {
          if (!s.mesh) return false;
          if (s.mesh === hitObject) return true;
          if (s.mesh instanceof THREE.Group) {
            return s.mesh.children.includes(hitObject);
          }
          return false;
        }) ?? null;
      }
      return null;
    };

    const handlePointerDown = (e: PointerEvent) => {
      if (e.button !== 0) return;

      // スタンプモード
      if (modeRef.current === "stamp") {
        e.preventDefault();
        placeStamp(e.clientX, e.clientY);
        return;
      }

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

          // マーカーを削除（続きを描くので再構築は不要）
          removeMarkers(markerHit.stroke, false);

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

      // 描画中はモディファイアキー不要（開始時に決定済み）
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
        disposeObject(currentStrokeRef.current.mesh);
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

  // メッシュまたはグループを安全に破棄
  const disposeMesh = (obj: THREE.Object3D) => {
    if (!scene) return;
    scene.remove(obj);

    obj.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        if (child.geometry) child.geometry.dispose();
        if (Array.isArray(child.material)) {
          child.material.forEach(m => m.dispose());
        } else if (child.material) {
          child.material.dispose();
        }
      }
    });
  };

  const clearAll = () => {
    if (!scene) return;

    strokesRef.current.forEach((stroke) => {
      if (stroke.mesh) {
        disposeMesh(stroke.mesh);
      }
      if (stroke.particles) {
        disposeMesh(stroke.particles);
      }
      if (stroke.startMarker) {
        disposeMesh(stroke.startMarker);
      }
      if (stroke.endMarker) {
        disposeMesh(stroke.endMarker);
      }
    });
    strokesRef.current = [];

    // スタンプも削除
    stampsRef.current.forEach((stamp) => {
      if (stamp.group) {
        disposeMesh(stamp.group);
      }
      if (stamp.particles) {
        disposeMesh(stamp.particles);
      }
    });
    stampsRef.current = [];

    setSelectedStroke(null);
  };

  // 選択中のストロークを削除
  const deleteSelectedStroke = () => {
    if (!scene || !selectedStroke) return;

    // メッシュとパーティクルを削除
    if (selectedStroke.mesh) {
      disposeMesh(selectedStroke.mesh);
    }
    if (selectedStroke.particles) {
      disposeMesh(selectedStroke.particles);
    }
    if (selectedStroke.startMarker) {
      disposeMesh(selectedStroke.startMarker);
    }
    if (selectedStroke.endMarker) {
      disposeMesh(selectedStroke.endMarker);
    }

    // 配列から削除
    strokesRef.current = strokesRef.current.filter(s => s.id !== selectedStroke.id);
    setSelectedStroke(null);
  };

  // Delete/Backspaceキーで選択中のストロークを削除
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.key === "Delete" || e.key === "Backspace") && selectedStroke && mode === "select") {
        e.preventDefault();
        deleteSelectedStroke();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedStroke, mode, scene]);

  return (
    <div className="relative w-full h-screen">
      <div
        ref={containerRef}
        className="w-full h-full"
        style={{ cursor: mode === "draw" ? "crosshair" : mode === "select" ? "pointer" : mode === "stamp" ? "cell" : "grab" }}
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
        stampType={stampType}
        setStampType={setStampType}
        onClear={clearAll}
      />

      <HelpPanel />
    </div>
  );
}
