"use client";

import { useRef, useState, useCallback } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

interface UseThreeSceneReturn {
  containerRef: (node: HTMLDivElement | null) => void;
  canvas: HTMLCanvasElement | null;
  scene: THREE.Scene | null;
  camera: THREE.PerspectiveCamera | null;
  controlsRef: React.RefObject<OrbitControls | null>;
  cameraPosition: THREE.Vector3 | null;
  raycastTargets: THREE.Mesh[];
  isDrawingRef: React.RefObject<boolean>;
  onAnimateRef: React.RefObject<(() => void) | null>;
}

// 球面レイヤー（視覚的なガイド用）
const SPHERE_LAYERS = [5, 15, 30, 50];

export function useThreeScene(): UseThreeSceneReturn {
  const [canvas, setCanvas] = useState<HTMLCanvasElement | null>(null);
  const [scene, setScene] = useState<THREE.Scene | null>(null);
  const [camera, setCamera] = useState<THREE.PerspectiveCamera | null>(null);
  const [cameraPosition, setCameraPosition] = useState<THREE.Vector3 | null>(null);
  const [raycastTargets, setRaycastTargets] = useState<THREE.Mesh[]>([]);
  const controlsRef = useRef<OrbitControls | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const initializedRef = useRef(false);
  const isDrawingRef = useRef(false);
  const onAnimateRef = useRef<(() => void) | null>(null);

  const containerRef = useCallback((container: HTMLDivElement | null) => {
    if (!container || initializedRef.current) return;
    initializedRef.current = true;

    // シーン
    const newScene = new THREE.Scene();
    newScene.background = new THREE.Color(0x0a0a15);

    const targets: THREE.Mesh[] = [];

    // 球面ワイヤーフレーム（視覚的なガイド）
    SPHERE_LAYERS.forEach((radius, index) => {
      const sphereGeometry = new THREE.SphereGeometry(radius, 32, 24);
      const sphereWireframe = new THREE.WireframeGeometry(sphereGeometry);
      const opacity = 0.15 + index * 0.05;
      const sphereLine = new THREE.LineSegments(
        sphereWireframe,
        new THREE.LineBasicMaterial({
          color: 0x333355,
          opacity,
          transparent: true,
        })
      );
      newScene.add(sphereLine);
    });

    // 床（BoxGeometry で薄い平面）
    const floorGeometry = new THREE.BoxGeometry(100, 0.1, 100);
    const floorMaterial = new THREE.MeshPhongMaterial({
      color: 0xffffff,
      shininess: 10,
    });
    const floorMesh = new THREE.Mesh(floorGeometry, floorMaterial);
    floorMesh.position.y = -5;
    floorMesh.receiveShadow = true;
    floorMesh.userData.type = "floor";
    newScene.add(floorMesh);
    targets.push(floorMesh);

    // カメラを中心に配置
    const newCamera = new THREE.PerspectiveCamera(
      90,
      container.clientWidth / container.clientHeight,
      0.1,
      1000
    );
    newCamera.position.set(0, 0, 0.1);

    // レンダラー
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.domElement.style.touchAction = "none";
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // OrbitControls
    const controls = new OrbitControls(newCamera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.enableZoom = true;
    controls.enablePan = true;
    controls.rotateSpeed = 0.5;
    controls.zoomSpeed = 1.0;
    controls.panSpeed = 0.8;
    controls.minDistance = 0.1;
    controls.maxDistance = 50;
    controls.target.set(0, 0, 0);
    controlsRef.current = controls;

    // ライト
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
    newScene.add(ambientLight);

    const pointLight = new THREE.PointLight(0xffffff, 1);
    pointLight.position.set(0, 0, 0);
    newScene.add(pointLight);

    // WASD移動用のキー状態
    const keys = { w: false, a: false, s: false, d: false };
    const moveSpeed = 0.3;

    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (key in keys) {
        keys[key as keyof typeof keys] = true;
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (key in keys) {
        keys[key as keyof typeof keys] = false;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    // isDrawingRefへの参照を保持
    const drawingRef = isDrawingRef;
    const animateCallbackRef = onAnimateRef;

    // アニメーションループ
    const animate = () => {
      requestAnimationFrame(animate);

      // カスタムアニメーションコールバック
      if (animateCallbackRef.current) {
        animateCallbackRef.current();
      }

      // 描画中はWASD移動を無効にする
      if (!drawingRef.current) {
        const direction = new THREE.Vector3();
        newCamera.getWorldDirection(direction);
        direction.y = 0;
        direction.normalize();

        const right = new THREE.Vector3();
        right.crossVectors(direction, new THREE.Vector3(0, 1, 0)).normalize();

        if (keys.w) {
          newCamera.position.addScaledVector(direction, moveSpeed);
          controls.target.addScaledVector(direction, moveSpeed);
        }
        if (keys.s) {
          newCamera.position.addScaledVector(direction, -moveSpeed);
          controls.target.addScaledVector(direction, -moveSpeed);
        }
        if (keys.a) {
          newCamera.position.addScaledVector(right, -moveSpeed);
          controls.target.addScaledVector(right, -moveSpeed);
        }
        if (keys.d) {
          newCamera.position.addScaledVector(right, moveSpeed);
          controls.target.addScaledVector(right, moveSpeed);
        }

        // 床の範囲内に制限
        newCamera.position.x = Math.max(-50, Math.min(50, newCamera.position.x));
        newCamera.position.z = Math.max(-50, Math.min(50, newCamera.position.z));
        controls.target.x = Math.max(-50, Math.min(50, controls.target.x));
        controls.target.z = Math.max(-50, Math.min(50, controls.target.z));
      }

      setCameraPosition(newCamera.position.clone());
      controls.update();
      renderer.render(newScene, newCamera);
    };
    animate();

    // リサイズ対応
    const handleResize = () => {
      newCamera.aspect = container.clientWidth / container.clientHeight;
      newCamera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    };
    window.addEventListener("resize", handleResize);

    // State更新
    setCanvas(renderer.domElement);
    setScene(newScene);
    setCamera(newCamera);
    setRaycastTargets(targets);
  }, []);

  return {
    containerRef,
    canvas,
    scene,
    camera,
    controlsRef,
    cameraPosition,
    raycastTargets,
    isDrawingRef,
    onAnimateRef,
  };
}
