"use client";

import { useRef, useState, useCallback } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

export interface CollisionResult {
  collides: boolean;
  groundY?: number; // プレイヤーが立てる地面の高さ
}

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
  collisionCheckRef: React.RefObject<((pos: THREE.Vector3) => CollisionResult) | null>;
}

// 球面レイヤー（視覚的なガイド用）- 現在は非表示
// const SPHERE_LAYERS = [5, 15, 30, 50];

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
  const collisionCheckRef = useRef<((pos: THREE.Vector3) => CollisionResult) | null>(null);

  const containerRef = useCallback((container: HTMLDivElement | null) => {
    if (!container || initializedRef.current) return;
    initializedRef.current = true;

    // シーン
    const newScene = new THREE.Scene();
    newScene.background = new THREE.Color(0x0a0a15);

    const targets: THREE.Mesh[] = [];

    // 球面ワイヤーフレーム（視覚的なガイド）- 非表示
    // SPHERE_LAYERS.forEach((radius, index) => {
    //   const sphereGeometry = new THREE.SphereGeometry(radius, 32, 24);
    //   const sphereWireframe = new THREE.WireframeGeometry(sphereGeometry);
    //   const opacity = 0.15 + index * 0.05;
    //   const sphereLine = new THREE.LineSegments(
    //     sphereWireframe,
    //     new THREE.LineBasicMaterial({
    //       color: 0x333355,
    //       opacity,
    //       transparent: true,
    //     })
    //   );
    //   newScene.add(sphereLine);
    // });

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

    // ジャンプ用の状態
    let isJumping = false;
    let jumpVelocity = 0;
    const jumpStrength = 0.4;
    const gravity = 0.015;
    const groundY = 0; // 地面のカメラY位置

    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (key in keys) {
        keys[key as keyof typeof keys] = true;
      }
      // スペースでジャンプ
      if (e.code === "Space" && !isJumping) {
        e.preventDefault();
        isJumping = true;
        jumpVelocity = jumpStrength;
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
    const collisionRef = collisionCheckRef;

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

        const BOUNDARY = 48; // 床の端より少し内側

        // 現在立っている地面の高さを取得
        let currentGroundY = groundY;
        const groundCheck = collisionRef.current ? collisionRef.current(newCamera.position) : null;
        if (groundCheck?.groundY !== undefined) {
          currentGroundY = groundCheck.groundY;
        }

        // 移動先の位置を計算して範囲内かチェック
        const tryMove = (delta: THREE.Vector3) => {
          const newPos = newCamera.position.clone().add(delta);
          const newX = newPos.x;
          const newZ = newPos.z;

          // 境界チェック
          const withinBoundary = newX >= -BOUNDARY && newX <= BOUNDARY && newZ >= -BOUNDARY && newZ <= BOUNDARY;

          // ストロークとの衝突チェック
          const collision = collisionRef.current ? collisionRef.current(newPos) : { collides: false };

          // 範囲内かつ衝突なしなら移動
          if (withinBoundary && !collision.collides) {
            newCamera.position.add(delta);
            controls.target.add(delta);
          } else if (!withinBoundary) {
            // 壁に沿ってスライド（片方の軸だけ移動可能な場合）
            const slideX = newX >= -BOUNDARY && newX <= BOUNDARY;
            const slideZ = newZ >= -BOUNDARY && newZ <= BOUNDARY;

            if (slideX) {
              const testPos = newCamera.position.clone();
              testPos.x = newX;
              const slideCollision = collisionRef.current ? collisionRef.current(testPos) : { collides: false };
              if (!slideCollision.collides) {
                newCamera.position.x = newX;
                controls.target.x += delta.x;
              }
            }
            if (slideZ) {
              const testPos = newCamera.position.clone();
              testPos.z = newZ;
              const slideCollision = collisionRef.current ? collisionRef.current(testPos) : { collides: false };
              if (!slideCollision.collides) {
                newCamera.position.z = newZ;
                controls.target.z += delta.z;
              }
            }
          }
        };

        if (keys.w) {
          tryMove(direction.clone().multiplyScalar(moveSpeed));
        }
        if (keys.s) {
          tryMove(direction.clone().multiplyScalar(-moveSpeed));
        }
        if (keys.a) {
          tryMove(right.clone().multiplyScalar(-moveSpeed));
        }
        if (keys.d) {
          tryMove(right.clone().multiplyScalar(moveSpeed));
        }

        // 現在の地面の高さを更新
        let standingOnGround = currentGroundY;

        // ジャンプ処理
        if (isJumping) {
          const newY = newCamera.position.y + jumpVelocity;
          const testPos = newCamera.position.clone();
          testPos.y = newY;

          // ジャンプ中も衝突判定
          const jumpCollision = collisionRef.current ? collisionRef.current(testPos) : { collides: false };

          if (!jumpCollision.collides) {
            const deltaY = newY - newCamera.position.y;
            newCamera.position.y = newY;
            controls.target.y += deltaY;

            // 落下中にオブジェクトの上面を見つけたら着地
            if (jumpVelocity < 0 && jumpCollision.groundY !== undefined && newY <= jumpCollision.groundY) {
              const landY = jumpCollision.groundY;
              const landDelta = landY - newCamera.position.y;
              newCamera.position.y = landY;
              controls.target.y += landDelta;
              isJumping = false;
              jumpVelocity = 0;
              standingOnGround = landY;
            }
          } else {
            // 衝突したら速度をリセット
            if (jumpVelocity > 0) {
              // 上昇中に天井にぶつかった
              jumpVelocity = 0;
            } else if (jumpVelocity < 0) {
              // 下降中に衝突 → 着地
              isJumping = false;
              jumpVelocity = 0;
            }
          }
          jumpVelocity -= gravity;

          // 床への着地判定
          if (newCamera.position.y <= groundY) {
            const landDelta = groundY - newCamera.position.y;
            newCamera.position.y = groundY;
            controls.target.y += landDelta;
            isJumping = false;
            jumpVelocity = 0;
          }
        } else {
          // 地面の上にいる時、現在の足元をチェック
          const belowCheck = collisionRef.current ? collisionRef.current(newCamera.position) : null;

          if (belowCheck?.groundY !== undefined) {
            standingOnGround = belowCheck.groundY;
          }

          // ブロックから降りた場合（足元に何もない）
          if (standingOnGround < newCamera.position.y - 0.5 && standingOnGround <= groundY) {
            // 落下開始
            isJumping = true;
            jumpVelocity = 0;
          }
        }
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
    collisionCheckRef,
  };
}
