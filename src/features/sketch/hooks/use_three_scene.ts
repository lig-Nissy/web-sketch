"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import RAPIER from "@dimforge/rapier3d-compat";

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
  physicsWorld: RAPIER.World | null;
  rapierReady: boolean;
  resetBowlingRef: React.RefObject<(() => void) | null>;
}

// 球面レイヤー（視覚的なガイド用）- 現在は非表示
// const SPHERE_LAYERS = [5, 15, 30, 50];

export function useThreeScene(): UseThreeSceneReturn {
  const [canvas, setCanvas] = useState<HTMLCanvasElement | null>(null);
  const [scene, setScene] = useState<THREE.Scene | null>(null);
  const [camera, setCamera] = useState<THREE.PerspectiveCamera | null>(null);
  const [cameraPosition, setCameraPosition] = useState<THREE.Vector3 | null>(null);
  const [raycastTargets, setRaycastTargets] = useState<THREE.Mesh[]>([]);
  const [physicsWorld, setPhysicsWorld] = useState<RAPIER.World | null>(null);
  const [rapierReady, setRapierReady] = useState(false);
  const controlsRef = useRef<OrbitControls | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const initializedRef = useRef(false);
  const isDrawingRef = useRef(false);
  const onAnimateRef = useRef<(() => void) | null>(null);
  const collisionCheckRef = useRef<((pos: THREE.Vector3) => CollisionResult) | null>(null);
  const physicsWorldRef = useRef<RAPIER.World | null>(null);
  const pendingContainerRef = useRef<HTMLDivElement | null>(null);
  const loopStoppersRef = useRef<Array<() => void>>([]);
  const resetBowlingRef = useRef<(() => void) | null>(null);

  // Rapier の WASM を一度だけ読み込む
  useEffect(() => {
    let cancelled = false;
    RAPIER.init().then(() => {
      if (cancelled) return;
      setRapierReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const containerRef = useCallback((container: HTMLDivElement | null) => {
    if (!container) return;
    if (!rapierReady) {
      pendingContainerRef.current = container;
      return;
    }
    // 二重初期化防止（StrictMode / hot reload 対策）
    if (initializedRef.current || physicsWorldRef.current) return;
    initializedRef.current = true;

    // シーン
    const newScene = new THREE.Scene();
    newScene.background = new THREE.Color(0x05060f);

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

    // 看板を作成
    const createSignboard = () => {
      const group = new THREE.Group();

      // 看板の板
      const boardGeometry = new THREE.BoxGeometry(8, 5, 0.2);
      const boardMaterial = new THREE.MeshPhongMaterial({ color: 0x8b4513 });
      const board = new THREE.Mesh(boardGeometry, boardMaterial);
      board.position.y = 2.5;
      group.add(board);

      // 支柱
      const poleGeometry = new THREE.CylinderGeometry(0.15, 0.15, 5, 8);
      const poleMaterial = new THREE.MeshPhongMaterial({ color: 0x654321 });
      const pole = new THREE.Mesh(poleGeometry, poleMaterial);
      pole.position.set(0, 0, 0);
      group.add(pole);

      // テキストをCanvasで描画してテクスチャに
      const canvas = document.createElement("canvas");
      canvas.width = 512;
      canvas.height = 320;
      const ctx = canvas.getContext("2d")!;

      // 背景
      ctx.fillStyle = "#f5deb3";
      ctx.fillRect(0, 0, 512, 320);

      // 枠線
      ctx.strokeStyle = "#8b4513";
      ctx.lineWidth = 8;
      ctx.strokeRect(4, 4, 504, 312);

      // タイトル
      ctx.fillStyle = "#333";
      ctx.font = "bold 32px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("Web Sketch", 256, 45);

      // 操作方法
      ctx.font = "20px sans-serif";
      ctx.textAlign = "left";
      const lines = [
        "【操作方法】",
        "WASD: 移動",
        "Space: ジャンプ",
        "マウス: 描画 / カメラ操作",
        "Shift: 空中に描画",
        "Option: 床に固定して描画",
        "",
        "【隠し要素】",
        "🐄 + 🔥 = ???",
      ];
      lines.forEach((line, i) => {
        ctx.fillText(line, 30, 80 + i * 26);
      });

      const texture = new THREE.CanvasTexture(canvas);
      const textGeometry = new THREE.PlaneGeometry(7, 4.4);
      const textMaterial = new THREE.MeshBasicMaterial({ map: texture });
      const textMesh = new THREE.Mesh(textGeometry, textMaterial);
      textMesh.position.set(0, 2.5, 0.15);
      group.add(textMesh);

      return group;
    };

    const signboard = createSignboard();
    signboard.position.set(0, -5, -8);
    newScene.add(signboard);

    // ルール看板を作成
    const createRuleSign = () => {
      const group = new THREE.Group();

      // 看板の板
      const boardGeometry = new THREE.BoxGeometry(5, 3, 0.2);
      const boardMaterial = new THREE.MeshPhongMaterial({ color: 0x2e8b57 });
      const board = new THREE.Mesh(boardGeometry, boardMaterial);
      board.position.y = 1.5;
      group.add(board);

      // 支柱
      const poleGeometry = new THREE.CylinderGeometry(0.12, 0.12, 4, 8);
      const poleMaterial = new THREE.MeshPhongMaterial({ color: 0x228b22 });
      const pole = new THREE.Mesh(poleGeometry, poleMaterial);
      pole.position.set(0, -0.5, 0);
      group.add(pole);

      // テキストをCanvasで描画
      const canvas = document.createElement("canvas");
      canvas.width = 320;
      canvas.height = 192;
      const ctx = canvas.getContext("2d")!;

      // 背景
      ctx.fillStyle = "#fffacd";
      ctx.fillRect(0, 0, 320, 192);

      // 枠線
      ctx.strokeStyle = "#2e8b57";
      ctx.lineWidth = 6;
      ctx.strokeRect(3, 3, 314, 186);

      // タイトル
      ctx.fillStyle = "#333";
      ctx.font = "bold 28px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("📜 ルール", 160, 45);

      // ルール
      ctx.font = "bold 36px sans-serif";
      ctx.fillText("好きに楽しむ！", 160, 120);

      const texture = new THREE.CanvasTexture(canvas);
      const textGeometry = new THREE.PlaneGeometry(4.4, 2.6);
      const textMaterial = new THREE.MeshBasicMaterial({ map: texture });
      const textMesh = new THREE.Mesh(textGeometry, textMaterial);
      textMesh.position.set(0, 1.5, 0.15);
      group.add(textMesh);

      return group;
    };

    const ruleSign = createRuleSign();
    ruleSign.position.set(6, -5, -6);
    ruleSign.rotation.y = -0.3;
    newScene.add(ruleSign);

    // ジェットコースター（会場を囲む・観賞用）
    const createRollerCoaster = () => {
      const group = new THREE.Group();

      // 任意の関数からカーブを生成するためのヘルパークラス
      class FunctionCurve extends THREE.Curve<THREE.Vector3> {
        private fn: (t: number) => THREE.Vector3;
        constructor(fn: (t: number) => THREE.Vector3) {
          super();
          this.fn = fn;
        }
        getPoint(t: number, target = new THREE.Vector3()): THREE.Vector3 {
          const p = this.fn(t);
          return target.set(p.x, p.y, p.z);
        }
      }

      // ============================================================
      // コース構築：CurvePath で複数セグメントを連結
      // 進行方向は南→東→北→西→南（時計回り）
      // ============================================================
      const path = new THREE.CurvePath<THREE.Vector3>();

      // セグメント1：スタート/ゴール直線（南辺、東向き）— x: -50 → 50, z = 60, y = 4
      path.add(
        new FunctionCurve((t) => new THREE.Vector3(-50 + 100 * t, 4, 60))
      );

      // セグメント2：南東コーナーから巻き上げ（カーブで高度上昇 → ループ底点へ）
      // ループ底点 (70, 28, -18) に向かって、北向き(z-) かつ上向きの tangent を作る
      path.add(
        new THREE.CatmullRomCurve3(
          [
            new THREE.Vector3(50, 4, 60),
            new THREE.Vector3(65, 8, 50),
            new THREE.Vector3(70, 14, 30),
            new THREE.Vector3(70, 22, 10),
            new THREE.Vector3(70, 28, -18), // ループ入口 = 底点
          ],
          false,
          "catmullrom",
          0.3
        )
      );

      // セグメント3：縦ループ（x=70 平面の yz 円、半径 10、1 回転して同じ点に戻る）
      // 入口 = 出口 = (70, 28, -18) とすることで円が閉じ、自然に 1 回転する
      const loopCenter = new THREE.Vector3(70, 38, -18);
      const loopRadius = 10;
      path.add(
        new FunctionCurve((t) => {
          // angle: t=0 → 底点 (-π/2)、反時計回りに 1 周 (進行 = z- 方向)
          //   t=0   : (y, z) = (cy - R, cz)        底
          //   t=0.25: (y, z) = (cy,     cz - R)    北端
          //   t=0.5 : (y, z) = (cy + R, cz)        頂点
          //   t=0.75: (y, z) = (cy,     cz + R)    南端
          //   t=1   : 底点に戻る
          const angle = -Math.PI / 2 + 2 * Math.PI * t;
          const y = loopCenter.y + loopRadius * Math.sin(angle);
          const z = loopCenter.z - loopRadius * Math.cos(angle); // z- に進入
          return new THREE.Vector3(70, y, z);
        })
      );

      // セグメント4：ループ後の下降カーブ（ループ底点 → 北辺へ）
      // ループ出口 (70, 28, -18) からスムーズに z- 方向へ抜ける
      path.add(
        new THREE.CatmullRomCurve3(
          [
            new THREE.Vector3(70, 28, -18),
            new THREE.Vector3(70, 24, -35),
            new THREE.Vector3(65, 18, -50),
            new THREE.Vector3(50, 14, -60),
          ],
          false,
          "catmullrom",
          0.3
        )
      );

      // セグメント5：北辺直線（東→西、x: 50 → -50, z = -60）
      path.add(
        new FunctionCurve((t) => new THREE.Vector3(50 - 100 * t, 14, -60))
      );

      // セグメント6：北西カーブ → コークスクリュー入口
      path.add(
        new THREE.CatmullRomCurve3(
          [
            new THREE.Vector3(-50, 14, -60),
            new THREE.Vector3(-65, 12, -45),
            new THREE.Vector3(-70, 10, -25),
          ],
          false,
          "catmullrom",
          0.3
        )
      );

      // セグメント7：コークスクリュー（西辺、x≈-70 をベースに螺旋）
      // tangent は概ね z 正方向（北→南）。レール自体を進行方向まわりに 2 回転
      path.add(
        new FunctionCurve((t) => {
          // ベース：直線 (-70, 8, -25 → -70, 8, 25) を進む
          const baseX = -70;
          const baseY = 8;
          const baseZ = -25 + 50 * t;
          // 進行軸まわりにロール：螺旋を半径 4 で 2 回転
          const spiralRadius = 4;
          const turns = 2;
          const angle = 2 * Math.PI * turns * t;
          // 進行軸 = z 方向。螺旋オフセットは xy 平面上
          const ox = spiralRadius * Math.cos(angle);
          const oy = spiralRadius * Math.sin(angle);
          return new THREE.Vector3(baseX + ox, baseY + spiralRadius + oy, baseZ);
        })
      );

      // セグメント8：南西カーブで南辺スタート地点に戻る
      path.add(
        new THREE.CatmullRomCurve3(
          [
            new THREE.Vector3(-70, 8, 25),
            new THREE.Vector3(-65, 6, 45),
            new THREE.Vector3(-50, 4, 60),
          ],
          false,
          "catmullrom",
          0.3
        )
      );

      // ============================================================
      // パスをサンプリングして、レール / 枕木 / 支柱 / 車両姿勢用の姿勢配列を作る
      // ============================================================
      const samples = 1200;
      const positions: THREE.Vector3[] = [];
      const tangents: THREE.Vector3[] = [];
      const normals: THREE.Vector3[] = [];
      const binormals: THREE.Vector3[] = [];

      for (let i = 0; i <= samples; i++) {
        const t = i / samples;
        positions.push(path.getPoint(t));
      }
      // tangent を中央差分で計算
      for (let i = 0; i <= samples; i++) {
        const prev = positions[Math.max(0, i - 1)];
        const next = positions[Math.min(samples, i + 1)];
        tangents.push(next.clone().sub(prev).normalize());
      }
      // 平行運送（parallel transport）で normal/binormal を伝播
      // 初期 normal は world up に最も近い tangent と直交する向き
      const initialUp = new THREE.Vector3(0, 1, 0);
      let prevNormal = new THREE.Vector3()
        .crossVectors(tangents[0], initialUp)
        .cross(tangents[0])
        .normalize();
      if (prevNormal.lengthSq() < 1e-6) {
        prevNormal = new THREE.Vector3(0, 1, 0);
      }
      for (let i = 0; i <= samples; i++) {
        const tan = tangents[i];
        // 直前の normal を tangent に直交化
        const projected = prevNormal
          .clone()
          .sub(tan.clone().multiplyScalar(prevNormal.dot(tan)));
        if (projected.lengthSq() < 1e-6) {
          // 退化したら world up から再構築
          projected.crossVectors(tan, initialUp).cross(tan).normalize();
        } else {
          projected.normalize();
        }
        normals.push(projected);
        const binormal = new THREE.Vector3().crossVectors(tan, projected).normalize();
        binormals.push(binormal);
        prevNormal = projected;
      }

      // ============================================================
      // レール（左右 2 本）— サンプル点を side オフセットして TubeGeometry
      // ============================================================
      const railColor = 0xc0392b;
      const railMaterial = new THREE.MeshPhongMaterial({ color: railColor, shininess: 60 });
      const railOffset = 0.6;

      const buildRail = (sideOffset: number) => {
        const railPoints: THREE.Vector3[] = [];
        for (let i = 0; i <= samples; i++) {
          railPoints.push(
            positions[i].clone().add(binormals[i].clone().multiplyScalar(sideOffset))
          );
        }
        const railCurve = new THREE.CatmullRomCurve3(railPoints, false);
        return new THREE.Mesh(
          new THREE.TubeGeometry(railCurve, 1200, 0.12, 8, false),
          railMaterial
        );
      };

      group.add(buildRail(railOffset));
      group.add(buildRail(-railOffset));

      // ============================================================
      // 枕木（一定間隔）
      // ============================================================
      const tieGeometry = new THREE.BoxGeometry(1.5, 0.08, 0.2);
      const tieMaterial = new THREE.MeshPhongMaterial({ color: 0x4a3520 });
      const tieCount = 300;
      const orientMat = new THREE.Matrix4();
      for (let i = 0; i < tieCount; i++) {
        const idx = Math.floor((i / tieCount) * samples);
        const tie = new THREE.Mesh(tieGeometry, tieMaterial);
        tie.position.copy(positions[idx]);
        // 姿勢: -Z = tangent, +Y = normal
        const target = positions[idx].clone().sub(tangents[idx]);
        orientMat.lookAt(positions[idx], target, normals[idx]);
        tie.quaternion.setFromRotationMatrix(orientMat);
        group.add(tie);
      }

      // ============================================================
      // 支柱（地面まで）— ループ/コークスクリューの上下逆セクションは支柱を生やさない
      // ============================================================
      const supportMaterial = new THREE.MeshPhongMaterial({ color: 0x555555 });
      const supportCount = 80;
      for (let i = 0; i < supportCount; i++) {
        const idx = Math.floor((i / supportCount) * samples);
        const pos = positions[idx];
        const groundLevel = 0;
        const height = pos.y - groundLevel;
        if (height <= 1.0) continue; // 低すぎ・地面下はスキップ
        // normal が下向きなセクション（ループ天井等）も支柱不要
        if (normals[idx].y < 0.3) continue;
        const supportGeo = new THREE.CylinderGeometry(0.15, 0.15, height, 6);
        const support = new THREE.Mesh(supportGeo, supportMaterial);
        support.position.set(pos.x, groundLevel + height / 2, pos.z);
        group.add(support);
      }

      // ============================================================
      // コースター車両
      // ============================================================
      const carColors = [0xf1c40f, 0x3498db, 0x2ecc71, 0xe91e63];
      const cars: THREE.Group[] = [];
      carColors.forEach((color) => {
        const car = new THREE.Group();
        const body = new THREE.Mesh(
          new THREE.BoxGeometry(1.0, 0.6, 1.6),
          new THREE.MeshPhongMaterial({ color, shininess: 80 })
        );
        body.position.y = 0.4;
        car.add(body);
        const roof = new THREE.Mesh(
          new THREE.BoxGeometry(0.9, 0.15, 1.4),
          new THREE.MeshPhongMaterial({ color: 0x222222 })
        );
        roof.position.y = 0.78;
        car.add(roof);
        const wheelGeo = new THREE.CylinderGeometry(0.18, 0.18, 0.1, 12);
        const wheelMat = new THREE.MeshPhongMaterial({ color: 0x111111 });
        [-0.55, 0.55].forEach((zOff) => {
          [-0.5, 0.5].forEach((xOff) => {
            const wheel = new THREE.Mesh(wheelGeo, wheelMat);
            wheel.rotation.z = Math.PI / 2;
            wheel.position.set(xOff, 0.1, zOff);
            car.add(wheel);
          });
        });
        cars.push(car);
        group.add(car);
      });

      // ============================================================
      // 走行アニメーション — 平行運送 frame に沿って車両を配置・回転
      // ============================================================
      let progress = 0;
      const speed = 0.04; // 1 秒あたりの t 増分
      const carSpacing = 0.008;
      const carOrientMat = new THREE.Matrix4();
      const updater = (deltaSeconds: number) => {
        progress = (progress + speed * deltaSeconds) % 1;
        cars.forEach((car, carIdx) => {
          const t = (progress - carIdx * carSpacing + 1) % 1;
          const fIdx = t * samples;
          const i0 = Math.floor(fIdx);
          const i1 = Math.min(samples, i0 + 1);
          const frac = fIdx - i0;

          // 線形補間
          const pos = positions[i0].clone().lerp(positions[i1], frac);
          const tan = tangents[i0].clone().lerp(tangents[i1], frac).normalize();
          const norm = normals[i0].clone().lerp(normals[i1], frac).normalize();

          car.position.copy(pos);
          // 姿勢：-Z = tangent, +Y = normal
          const target = pos.clone().sub(tan);
          carOrientMat.lookAt(pos, target, norm);
          car.quaternion.setFromRotationMatrix(carOrientMat);
        });
      };
      updater(0);

      return { group, updater };
    };

    const coaster = createRollerCoaster();
    // 会場（床 y=-5）を囲むように、地面に合わせて中心配置
    coaster.group.position.set(0, -5, 0);
    newScene.add(coaster.group);
    const coasterUpdater = coaster.updater;

    // ============================================================
    // 観覧車（会場北側、コースターの外側に遠景として配置）
    // ============================================================
    const createFerrisWheel = () => {
      const group = new THREE.Group();
      const wheelRadius = 32;
      const gondolaCount = 16;

      // 中心軸を支える 2 本の脚 + 軸
      const legMaterial = new THREE.MeshPhongMaterial({ color: 0x666666 });
      const legHeight = wheelRadius + 6; // 地面からハブまで
      const legSpread = 14;
      [-legSpread, legSpread].forEach((xOff) => {
        const legGeo = new THREE.CylinderGeometry(0.6, 0.9, legHeight, 8);
        const leg = new THREE.Mesh(legGeo, legMaterial);
        leg.position.set(xOff, legHeight / 2, 0);
        // 軸に向かって少し倒す
        leg.rotation.z = Math.atan2(xOff, legHeight) * -0.5;
        group.add(leg);
      });
      // 軸（ハブ）
      const hubGeo = new THREE.CylinderGeometry(1.0, 1.0, legSpread * 2 + 1, 16);
      const hub = new THREE.Mesh(hubGeo, legMaterial);
      hub.rotation.z = Math.PI / 2;
      hub.position.y = legHeight;
      group.add(hub);

      // ホイール本体（回転する Group）
      const wheel = new THREE.Group();
      wheel.position.y = legHeight;
      group.add(wheel);

      // リング（外周 2 本 + 内周 1 本）
      const ringMat = new THREE.MeshPhongMaterial({ color: 0xe74c3c, shininess: 60 });
      const buildRing = (radius: number, tubeRadius: number, xOffset: number) => {
        const ringGeo = new THREE.TorusGeometry(radius, tubeRadius, 8, 48);
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.rotation.y = Math.PI / 2; // x 軸まわりに見せるため yz 平面に
        ring.position.x = xOffset;
        wheel.add(ring);
      };
      const ringSpread = 5;
      buildRing(wheelRadius, 0.3, -ringSpread);
      buildRing(wheelRadius, 0.3, ringSpread);
      buildRing(wheelRadius * 0.5, 0.2, 0);

      // スポーク
      const spokeMat = new THREE.MeshPhongMaterial({ color: 0xecf0f1 });
      for (let i = 0; i < gondolaCount; i++) {
        const angle = (i / gondolaCount) * Math.PI * 2;
        [-ringSpread, ringSpread].forEach((xOff) => {
          const spokeGeo = new THREE.CylinderGeometry(0.1, 0.1, wheelRadius * 2, 6);
          const spoke = new THREE.Mesh(spokeGeo, spokeMat);
          spoke.position.x = xOff;
          spoke.rotation.x = angle;
          wheel.add(spoke);
        });
      }

      // ゴンドラ（counter-rotate して常に下向き）
      const gondolaColors = [0xf1c40f, 0xe91e63, 0x3498db, 0x2ecc71, 0x9b59b6, 0xe67e22];
      const gondolas: { pivot: THREE.Group; gondola: THREE.Group }[] = [];
      for (let i = 0; i < gondolaCount; i++) {
        const angle = (i / gondolaCount) * Math.PI * 2;
        // pivot: ホイールに付随して回る空 Group。ゴンドラの吊り下げ点
        const pivot = new THREE.Group();
        pivot.position.set(0, Math.sin(angle) * wheelRadius, Math.cos(angle) * wheelRadius);
        wheel.add(pivot);

        // ゴンドラ本体（pivot の子。pivot 回転に対して逆回転で常に上向きキープ）
        const gondola = new THREE.Group();
        const cabinColor = gondolaColors[i % gondolaColors.length];
        const cabin = new THREE.Mesh(
          new THREE.BoxGeometry(3.4, 2.6, 3.4),
          new THREE.MeshPhongMaterial({ color: cabinColor, shininess: 60 })
        );
        cabin.position.y = -2.5; // 吊り下げ位置
        gondola.add(cabin);
        // 屋根
        const roof = new THREE.Mesh(
          new THREE.ConeGeometry(2.5, 1.0, 4),
          new THREE.MeshPhongMaterial({ color: 0x2c3e50 })
        );
        roof.position.y = -0.7;
        roof.rotation.y = Math.PI / 4;
        gondola.add(roof);
        // 吊り下げ棒
        const armGeo = new THREE.CylinderGeometry(0.08, 0.08, 1.2, 6);
        const arm = new THREE.Mesh(armGeo, spokeMat);
        arm.position.y = -0.6;
        gondola.add(arm);

        pivot.add(gondola);
        gondolas.push({ pivot, gondola });
      }

      // アニメーション
      let wheelAngle = 0;
      const wheelSpeed = 0.1; // rad/sec
      const updater = (delta: number) => {
        wheelAngle += wheelSpeed * delta;
        wheel.rotation.x = wheelAngle;
        // 各ゴンドラを counter-rotate して常に直立
        gondolas.forEach(({ gondola }) => {
          gondola.rotation.x = -wheelAngle;
        });
      };
      updater(0);

      return { group, updater };
    };

    const ferrisWheel = createFerrisWheel();
    ferrisWheel.group.position.set(0, -5, -95); // 北、会場外
    ferrisWheel.group.rotation.y = Math.PI / 2; // 観覧車の向きを 90 度回転
    newScene.add(ferrisWheel.group);
    const ferrisUpdater = ferrisWheel.updater;

    // ============================================================
    // 花火（夜空にランダムに打ち上がるパーティクル）
    // ============================================================
    interface Firework {
      points: THREE.Points;
      velocities: Float32Array;
      ages: Float32Array;
      lifetime: number;
      phase: "rising" | "exploding";
      riseTimer: number;
      origin: THREE.Vector3;
      explosionPos: THREE.Vector3;
      color: THREE.Color;
    }
    const fireworks: Firework[] = [];
    const fireworksGroup = new THREE.Group();
    newScene.add(fireworksGroup);

    const FIREWORK_COLORS = [
      0xff4757, 0xffa502, 0xfffa65, 0x7bed9f, 0x70a1ff,
      0xa55eea, 0xff6b9d, 0x48dbfb,
    ];

    const spawnFirework = () => {
      // 打ち上げ位置（会場の上空、ランダム）
      const origin = new THREE.Vector3(
        (Math.random() - 0.5) * 120,
        -5,
        (Math.random() - 0.5) * 120
      );
      const explosionHeight = 25 + Math.random() * 20;
      const explosionPos = origin.clone();
      explosionPos.y = explosionHeight;

      const particleCount = 80 + Math.floor(Math.random() * 60);
      const positions = new Float32Array(particleCount * 3);
      const velocities = new Float32Array(particleCount * 3);
      const ages = new Float32Array(particleCount);

      // 最初は全部 origin に
      for (let i = 0; i < particleCount; i++) {
        positions[i * 3] = origin.x;
        positions[i * 3 + 1] = origin.y;
        positions[i * 3 + 2] = origin.z;
      }

      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
      const colorHex = FIREWORK_COLORS[Math.floor(Math.random() * FIREWORK_COLORS.length)];
      const color = new THREE.Color(colorHex);
      const material = new THREE.PointsMaterial({
        color,
        size: 0.5,
        transparent: true,
        opacity: 1,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const points = new THREE.Points(geometry, material);
      fireworksGroup.add(points);

      fireworks.push({
        points,
        velocities,
        ages,
        lifetime: 1.8,
        phase: "rising",
        riseTimer: 0,
        origin,
        explosionPos,
        color,
      });
    };

    const updateFireworks = (delta: number) => {
      // ランダム打ち上げ（平均 0.7 秒に 1 発）
      if (Math.random() < delta / 0.7 && fireworks.length < 8) {
        spawnFirework();
      }

      for (let i = fireworks.length - 1; i >= 0; i--) {
        const fw = fireworks[i];
        const positions = fw.points.geometry.attributes.position as THREE.BufferAttribute;
        const arr = positions.array as Float32Array;
        const count = arr.length / 3;

        if (fw.phase === "rising") {
          fw.riseTimer += delta;
          // 0.6 秒で打ち上げ高度に到達
          const riseDuration = 0.6;
          const t = Math.min(1, fw.riseTimer / riseDuration);
          // イーズアウト
          const eased = 1 - Math.pow(1 - t, 2);
          const currentY = fw.origin.y + (fw.explosionPos.y - fw.origin.y) * eased;
          for (let p = 0; p < count; p++) {
            arr[p * 3] = fw.explosionPos.x;
            arr[p * 3 + 1] = currentY;
            arr[p * 3 + 2] = fw.explosionPos.z;
          }
          positions.needsUpdate = true;

          if (t >= 1) {
            // 爆発フェーズへ
            fw.phase = "exploding";
            // ランダム方向に速度を割り当て（球状）
            for (let p = 0; p < count; p++) {
              const theta = Math.random() * Math.PI * 2;
              const phi = Math.acos(2 * Math.random() - 1);
              const speed = 6 + Math.random() * 6;
              fw.velocities[p * 3] = speed * Math.sin(phi) * Math.cos(theta);
              fw.velocities[p * 3 + 1] = speed * Math.cos(phi);
              fw.velocities[p * 3 + 2] = speed * Math.sin(phi) * Math.sin(theta);
              fw.ages[p] = 0;
            }
          }
        } else {
          // 爆発拡散 + 重力 + フェード
          let maxAge = 0;
          for (let p = 0; p < count; p++) {
            fw.ages[p] += delta;
            if (fw.ages[p] > maxAge) maxAge = fw.ages[p];
            // 重力
            fw.velocities[p * 3 + 1] -= 9.8 * delta;
            // 空気抵抗
            const drag = Math.pow(0.92, delta * 60);
            fw.velocities[p * 3] *= drag;
            fw.velocities[p * 3 + 1] *= drag;
            fw.velocities[p * 3 + 2] *= drag;
            arr[p * 3] += fw.velocities[p * 3] * delta;
            arr[p * 3 + 1] += fw.velocities[p * 3 + 1] * delta;
            arr[p * 3 + 2] += fw.velocities[p * 3 + 2] * delta;
          }
          positions.needsUpdate = true;

          // フェードアウト
          const fadeT = Math.min(1, maxAge / fw.lifetime);
          (fw.points.material as THREE.PointsMaterial).opacity = 1 - fadeT;

          if (maxAge >= fw.lifetime) {
            fireworksGroup.remove(fw.points);
            fw.points.geometry.dispose();
            (fw.points.material as THREE.PointsMaterial).dispose();
            fireworks.splice(i, 1);
          }
        }
      }
    };

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
    controls.rotateSpeed = 0.5;
    controls.zoomSpeed = 1.0;
    controls.panSpeed = 0.8;
    controls.minDistance = 0.1;
    controls.maxDistance = 50;
    controls.target.set(0, 0, 0);
    controls.mouseButtons = {
      LEFT: THREE.MOUSE.ROTATE,
      MIDDLE: THREE.MOUSE.DOLLY,
      RIGHT: THREE.MOUSE.PAN,
    };
    // 初期モード(draw)では OrbitControls を無効にしておく。
    // three_canvas.tsx の mode useEffect は controls 生成より先に走るため、
    // ここで disabled にしておかないと初回マウント時に左ドラッグで OrbitControls が
    // 反応してしまい、描画とカメラ回転が混在する。
    controls.enabled = false;
    controls.enableRotate = false;
    controls.enableZoom = false;
    controls.enablePan = false;
    controlsRef.current = controls;

    // ============================================================
    // 物理ワールド（Rapier）
    // ============================================================
    const world = new RAPIER.World(new RAPIER.Vector3(0, -30, 0));
    physicsWorldRef.current = world;

    // 床（静的）: 上面が y=-5 になるよう Cuboid を配置
    const floorBody = world.createRigidBody(
      RAPIER.RigidBodyDesc.fixed().setTranslation(0, -5.5, 0)
    );
    world.createCollider(
      RAPIER.ColliderDesc.cuboid(50, 0.5, 50).setFriction(0.6).setRestitution(0.1),
      floorBody
    );

    // 境界壁（±48）静的
    const WALL_THICK = 1;
    const WALL_HEIGHT = 30;
    const WALL_LIMIT = 48;
    const wallSpecs: Array<[number, number, number, number, number, number]> = [
      // 各要素: [tx, ty, tz, hx, hy, hz]
      [WALL_LIMIT + WALL_THICK, 0, 0, WALL_THICK, WALL_HEIGHT, WALL_LIMIT + WALL_THICK],
      [-WALL_LIMIT - WALL_THICK, 0, 0, WALL_THICK, WALL_HEIGHT, WALL_LIMIT + WALL_THICK],
      [0, 0, WALL_LIMIT + WALL_THICK, WALL_LIMIT + WALL_THICK, WALL_HEIGHT, WALL_THICK],
      [0, 0, -WALL_LIMIT - WALL_THICK, WALL_LIMIT + WALL_THICK, WALL_HEIGHT, WALL_THICK],
    ];
    for (const [tx, ty, tz, hx, hy, hz] of wallSpecs) {
      const body = world.createRigidBody(
        RAPIER.RigidBodyDesc.fixed().setTranslation(tx, ty, tz)
      );
      world.createCollider(
        RAPIER.ColliderDesc.cuboid(hx, hy, hz).setFriction(0.4),
        body
      );
    }

    // ============================================================
    // ボウリングコーナー（東側）
    // ============================================================
    const BOWLING_BASE_X = 30;
    const BOWLING_BASE_Z = 20;
    const FLOOR_TOP_Y = -5;

    // レーン（演出用の薄い板）
    const laneGeometry = new THREE.BoxGeometry(8, 0.05, 22);
    const laneMaterial = new THREE.MeshPhongMaterial({ color: 0xdeb887, shininess: 60 });
    const laneMesh = new THREE.Mesh(laneGeometry, laneMaterial);
    laneMesh.position.set(BOWLING_BASE_X, FLOOR_TOP_Y + 0.03, BOWLING_BASE_Z);
    newScene.add(laneMesh);

    // ピン（10本、三角配置）
    const PIN_RADIUS = 0.5;
    const PIN_HEIGHT = 2.5;
    const PIN_SPACING = 1.6;
    const pinRowZ = BOWLING_BASE_Z - 5; // 奥にピン
    const pinPositions: Array<[number, number]> = [];
    // ボウリングは奥行き方向の三角形（行が増えるほど奥）
    for (let row = 0; row < 4; row++) {
      const pinsInRow = row + 1;
      const rowZ = pinRowZ - row * PIN_SPACING * 0.95;
      for (let i = 0; i < pinsInRow; i++) {
        const px = BOWLING_BASE_X + (i - (pinsInRow - 1) / 2) * PIN_SPACING;
        pinPositions.push([px, rowZ]);
      }
    }

    const pinMaterial = new THREE.MeshPhongMaterial({ color: 0xffffff, shininess: 80 });
    const pinStripeMaterial = new THREE.MeshPhongMaterial({ color: 0xe74c3c });
    const bowlingPinsData: Array<{ mesh: THREE.Group; body: RAPIER.RigidBody }> = [];

    for (const [px, pz] of pinPositions) {
      // シンプルな円柱ピン
      const pinGroup = new THREE.Group();
      const cyl = new THREE.Mesh(
        new THREE.CylinderGeometry(PIN_RADIUS, PIN_RADIUS, PIN_HEIGHT, 16),
        pinMaterial
      );
      // 円柱の中心はグループ原点 = 剛体中心
      pinGroup.add(cyl);
      // 装飾: 赤帯（上部）
      const stripe = new THREE.Mesh(
        new THREE.CylinderGeometry(PIN_RADIUS * 1.01, PIN_RADIUS * 1.01, 0.18, 16),
        pinStripeMaterial
      );
      stripe.position.y = PIN_HEIGHT * 0.3;
      pinGroup.add(stripe);

      // 床上に立たせる: 中心は床上面 + 半分の高さ
      const initialY = FLOOR_TOP_Y + PIN_HEIGHT / 2;
      pinGroup.position.set(px, initialY, pz);
      newScene.add(pinGroup);

      const pinBody = world.createRigidBody(
        RAPIER.RigidBodyDesc.dynamic()
          .setTranslation(px, initialY, pz)
          .setLinearDamping(0.4)
          .setAngularDamping(0.8)
      );
      // 円柱コライダー（halfHeight, radius）
      world.createCollider(
        RAPIER.ColliderDesc.cylinder(PIN_HEIGHT / 2, PIN_RADIUS)
          .setRestitution(0.2)
          .setFriction(0.7)
          .setDensity(0.4),
        pinBody
      );
      bowlingPinsData.push({ mesh: pinGroup, body: pinBody });
    }

    // ボウリングボール（手前に配置、転がせる）
    const BALL_RADIUS = 0.9;
    const ballGeometry = new THREE.SphereGeometry(BALL_RADIUS, 24, 18);
    const ballMaterial = new THREE.MeshPhongMaterial({
      color: 0x222244,
      shininess: 150,
      specular: 0x666688,
    });
    const ballMesh = new THREE.Mesh(ballGeometry, ballMaterial);
    const ballStart = new THREE.Vector3(
      BOWLING_BASE_X,
      FLOOR_TOP_Y + BALL_RADIUS,
      BOWLING_BASE_Z + 5
    );
    ballMesh.position.copy(ballStart);
    newScene.add(ballMesh);

    const ballBody = world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(ballStart.x, ballStart.y, ballStart.z)
        .setLinearDamping(0.3)
        .setAngularDamping(0.5)
    );
    world.createCollider(
      RAPIER.ColliderDesc.ball(BALL_RADIUS)
        .setRestitution(0.4)
        .setFriction(0.4)
        .setDensity(5), // ボールは重い
      ballBody
    );

    // 初期位置を保持してリセットできるように
    const bowlingDynamics: Array<{
      mesh: THREE.Object3D;
      body: RAPIER.RigidBody;
      initialPos: { x: number; y: number; z: number };
    }> = [];
    for (const p of bowlingPinsData) {
      const t = p.body.translation();
      bowlingDynamics.push({
        mesh: p.mesh,
        body: p.body,
        initialPos: { x: t.x, y: t.y, z: t.z },
      });
    }
    bowlingDynamics.push({
      mesh: ballMesh as unknown as THREE.Object3D,
      body: ballBody,
      initialPos: { x: ballStart.x, y: ballStart.y, z: ballStart.z },
    });

    const syncBowling = () => {
      for (const { mesh, body } of bowlingDynamics) {
        const t = body.translation();
        const r = body.rotation();
        mesh.position.set(t.x, t.y, t.z);
        mesh.quaternion.set(r.x, r.y, r.z, r.w);
      }
    };

    const zeroVec = new RAPIER.Vector3(0, 0, 0);
    const upQuat = new RAPIER.Quaternion(0, 0, 0, 1);
    const resetBowling = () => {
      for (const { body, initialPos } of bowlingDynamics) {
        body.setTranslation(initialPos, true);
        body.setRotation(upQuat, true);
        body.setLinvel(zeroVec, true);
        body.setAngvel(zeroVec, true);
      }
      strikeState.active = false;
      strikeState.elapsed = 0;
      strikeBanner.visible = false;
      strikeParticles.visible = false;
    };
    resetBowlingRef.current = resetBowling;

    // ============================================================
    // ストライク演出
    // ============================================================
    // 全ピンが「倒れた」と判定する: ローカル up ベクトル (0,1,0) を回転で
    // 変換した後の y 成分が小さい = 横倒し
    const PIN_DOWN_THRESHOLD = 0.4; // 上向き y 成分がこれ未満で「倒れた」
    const _upHelper = new THREE.Vector3();
    const _quatHelper = new THREE.Quaternion();
    const isPinDown = (body: RAPIER.RigidBody): boolean => {
      const r = body.rotation();
      _quatHelper.set(r.x, r.y, r.z, r.w);
      _upHelper.set(0, 1, 0).applyQuaternion(_quatHelper);
      return _upHelper.y < PIN_DOWN_THRESHOLD;
    };

    const strikeState = {
      active: false,
      elapsed: 0,
      duration: 3.5,
    };

    // ストライクバナー: "STRIKE!" テキスト
    const strikeCanvas = document.createElement("canvas");
    strikeCanvas.width = 512;
    strikeCanvas.height = 192;
    const stx = strikeCanvas.getContext("2d")!;
    stx.fillStyle = "rgba(0,0,0,0)";
    stx.fillRect(0, 0, 512, 192);
    stx.font = "bold 110px sans-serif";
    stx.textAlign = "center";
    stx.textBaseline = "middle";
    // 縁取り
    stx.strokeStyle = "#000";
    stx.lineWidth = 10;
    stx.strokeText("STRIKE!", 256, 96);
    stx.fillStyle = "#ffd700";
    stx.fillText("STRIKE!", 256, 96);
    const strikeTexture = new THREE.CanvasTexture(strikeCanvas);
    const strikeBanner = new THREE.Mesh(
      new THREE.PlaneGeometry(10, 3.8),
      new THREE.MeshBasicMaterial({
        map: strikeTexture,
        transparent: true,
        depthTest: false,
        depthWrite: false,
      })
    );
    strikeBanner.renderOrder = 999;
    // ピン群の上空（少し奥）に出す
    strikeBanner.position.set(
      BOWLING_BASE_X,
      FLOOR_TOP_Y + 8,
      BOWLING_BASE_Z - 3
    );
    strikeBanner.visible = false;
    newScene.add(strikeBanner);

    // ストライク紙吹雪パーティクル
    const CONFETTI_COUNT = 220;
    const confettiPositions = new Float32Array(CONFETTI_COUNT * 3);
    const confettiColors = new Float32Array(CONFETTI_COUNT * 3);
    const confettiVelocities = new Float32Array(CONFETTI_COUNT * 3);
    const CONFETTI_COLOR_POOL = [
      new THREE.Color(0xff4757),
      new THREE.Color(0xffa502),
      new THREE.Color(0xfffa65),
      new THREE.Color(0x7bed9f),
      new THREE.Color(0x70a1ff),
      new THREE.Color(0xa55eea),
      new THREE.Color(0xff6b9d),
    ];
    const confettiGeometry = new THREE.BufferGeometry();
    confettiGeometry.setAttribute("position", new THREE.BufferAttribute(confettiPositions, 3));
    confettiGeometry.setAttribute("color", new THREE.BufferAttribute(confettiColors, 3));
    const confettiMaterial = new THREE.PointsMaterial({
      size: 0.4,
      vertexColors: true,
      transparent: true,
      opacity: 1,
      depthWrite: false,
      blending: THREE.NormalBlending,
    });
    const strikeParticles = new THREE.Points(confettiGeometry, confettiMaterial);
    strikeParticles.visible = false;
    newScene.add(strikeParticles);

    const triggerStrike = () => {
      strikeState.active = true;
      strikeState.elapsed = 0;
      strikeBanner.visible = true;
      strikeParticles.visible = true;
      // 紙吹雪を初期化（ピン群の中央から打ち上げ）
      const cx = BOWLING_BASE_X;
      const cz = BOWLING_BASE_Z - 3;
      const cy = FLOOR_TOP_Y + 1;
      for (let i = 0; i < CONFETTI_COUNT; i++) {
        confettiPositions[i * 3] = cx + (Math.random() - 0.5) * 2;
        confettiPositions[i * 3 + 1] = cy + Math.random() * 0.5;
        confettiPositions[i * 3 + 2] = cz + (Math.random() - 0.5) * 2;
        // 上方向にランダム速度
        const theta = Math.random() * Math.PI * 2;
        const speed = 6 + Math.random() * 6;
        const upSpeed = 10 + Math.random() * 6;
        confettiVelocities[i * 3] = Math.cos(theta) * speed;
        confettiVelocities[i * 3 + 1] = upSpeed;
        confettiVelocities[i * 3 + 2] = Math.sin(theta) * speed;
        const color = CONFETTI_COLOR_POOL[Math.floor(Math.random() * CONFETTI_COLOR_POOL.length)];
        confettiColors[i * 3] = color.r;
        confettiColors[i * 3 + 1] = color.g;
        confettiColors[i * 3 + 2] = color.b;
      }
      (confettiGeometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
      (confettiGeometry.attributes.color as THREE.BufferAttribute).needsUpdate = true;
      confettiMaterial.opacity = 1;
    };

    const updateStrike = (delta: number) => {
      // 演出中でなく、かつ全ピンが倒れていれば発動
      if (!strikeState.active) {
        const allDown =
          bowlingPinsData.length > 0 &&
          bowlingPinsData.every((p) => isPinDown(p.body));
        if (allDown) {
          triggerStrike();
        }
        return;
      }

      // 演出進行
      strikeState.elapsed += delta;

      // バナー: ふわっと拡大 + 軽くゆれる
      const t = strikeState.elapsed;
      const scale = 1 + 0.15 * Math.sin(t * 6);
      strikeBanner.scale.set(scale, scale, scale);
      // 常にカメラ向き（ビルボード: PlaneGeometry の +Z 表面をカメラに向ける）
      strikeBanner.quaternion.copy(newCamera.quaternion);

      // 紙吹雪: 物理シミュレーション（重力 + 抗力）
      const positions = confettiGeometry.attributes.position as THREE.BufferAttribute;
      const arr = positions.array as Float32Array;
      const drag = Math.pow(0.96, delta * 60);
      for (let i = 0; i < CONFETTI_COUNT; i++) {
        confettiVelocities[i * 3 + 1] -= 18 * delta;
        confettiVelocities[i * 3] *= drag;
        confettiVelocities[i * 3 + 1] *= drag;
        confettiVelocities[i * 3 + 2] *= drag;
        arr[i * 3] += confettiVelocities[i * 3] * delta;
        arr[i * 3 + 1] += confettiVelocities[i * 3 + 1] * delta;
        arr[i * 3 + 2] += confettiVelocities[i * 3 + 2] * delta;
      }
      positions.needsUpdate = true;

      // フェードアウト
      const fadeStart = strikeState.duration - 1.0;
      if (t > fadeStart) {
        const fade = Math.max(0, 1 - (t - fadeStart) / 1.0);
        confettiMaterial.opacity = fade;
        (strikeBanner.material as THREE.MeshBasicMaterial).opacity = fade;
      } else {
        (strikeBanner.material as THREE.MeshBasicMaterial).opacity = 1;
      }

      if (t >= strikeState.duration) {
        strikeState.active = false;
        strikeBanner.visible = false;
        strikeParticles.visible = false;
        (strikeBanner.material as THREE.MeshBasicMaterial).opacity = 1;
      }
    };

    // --- canvas 内リセットボタン（空に浮かぶ文字だけ） ---
    const resetTextCanvas = document.createElement("canvas");
    resetTextCanvas.width = 512;
    resetTextCanvas.height = 160;
    const rtx = resetTextCanvas.getContext("2d")!;
    rtx.clearRect(0, 0, 512, 160);
    rtx.font = "bold 88px sans-serif";
    rtx.textAlign = "center";
    rtx.textBaseline = "middle";
    // 縁取り
    rtx.strokeStyle = "#000";
    rtx.lineWidth = 8;
    rtx.strokeText("🎳 RESET", 256, 80);
    rtx.fillStyle = "#ffd700";
    rtx.fillText("🎳 RESET", 256, 80);
    const resetTexture = new THREE.CanvasTexture(resetTextCanvas);

    const resetText = new THREE.Mesh(
      new THREE.PlaneGeometry(5, 1.6),
      new THREE.MeshBasicMaterial({
        map: resetTexture,
        transparent: true,
        depthTest: false,
        depthWrite: false,
      })
    );
    resetText.renderOrder = 998;
    resetText.userData.type = "bowlingReset";
    // ボウリングレーン上空（ピン奥の少し上）に浮かす
    const resetTextBaseY = FLOOR_TOP_Y + 7;
    resetText.position.set(BOWLING_BASE_X, resetTextBaseY, BOWLING_BASE_Z - 3);
    newScene.add(resetText);
    targets.push(resetText);

    // 押下アニメーション用
    const resetButtonAnim = { pressedT: 0 };
    const pressResetButton = () => {
      resetButtonAnim.pressedT = 0.001;
      resetBowling();
    };
    const updateResetButton = (delta: number) => {
      // 常にカメラ正対（ビルボード）+ ふわふわ上下。
      // PlaneGeometry の +Z 面がカメラを向くよう、カメラと同じ姿勢をコピーする。
      resetText.quaternion.copy(newCamera.quaternion);
      const floatY = Math.sin(performance.now() * 0.002) * 0.2;
      resetText.position.y = resetTextBaseY + floatY;

      // 押下時のフラッシュ（拡大）
      if (resetButtonAnim.pressedT > 0) {
        resetButtonAnim.pressedT += delta;
        const t = resetButtonAnim.pressedT;
        let s = 1;
        if (t < 0.15) s = 1 + (t / 0.15) * 0.3;
        else if (t < 0.3) s = 1 + (1 - (t - 0.15) / 0.15) * 0.3;
        else {
          s = 1;
          resetButtonAnim.pressedT = 0;
        }
        resetText.scale.set(s, s, s);
      } else {
        resetText.scale.set(1, 1, 1);
      }
    };

    resetBowlingRef.current = pressResetButton;

    // ============================================================
    // プレイヤー（カメラ）の物理ボディ — キネマティック
    // ============================================================
    // 既存のカメラ歩行系では「カメラ位置 = 足元」前提（collisionCheckRef 参照）。
    // 物理側もこれに合わせて足元基準にする。
    const PLAYER_RADIUS = 0.6;
    const PLAYER_HEIGHT = 2.0;
    const playerBody = world.createRigidBody(
      RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(0, FLOOR_TOP_Y + PLAYER_HEIGHT / 2, 0)
    );
    world.createCollider(
      RAPIER.ColliderDesc.capsule(PLAYER_HEIGHT / 2 - PLAYER_RADIUS, PLAYER_RADIUS).setFriction(0.0),
      playerBody
    );

    // ============================================================
    // 星（背景に固定、ゆっくり瞬き）
    // ============================================================
    const STAR_COUNT = 800;
    const starPositions = new Float32Array(STAR_COUNT * 3);
    const starSizes = new Float32Array(STAR_COUNT);
    const starPhases = new Float32Array(STAR_COUNT);
    const starBaseSizes = new Float32Array(STAR_COUNT);
    for (let i = 0; i < STAR_COUNT; i++) {
      // 大きな球殻にランダム配置（半径 350、上半球寄り）
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 0.9 + 0.05); // 0.05〜0.95 で上寄り
      const radius = 320 + Math.random() * 60;
      starPositions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
      starPositions[i * 3 + 1] = radius * Math.cos(phi);
      starPositions[i * 3 + 2] = radius * Math.sin(phi) * Math.sin(theta);
      const base = 0.6 + Math.random() * 1.4;
      starBaseSizes[i] = base;
      starSizes[i] = base;
      starPhases[i] = Math.random() * Math.PI * 2;
    }
    const starGeometry = new THREE.BufferGeometry();
    starGeometry.setAttribute("position", new THREE.BufferAttribute(starPositions, 3));
    starGeometry.setAttribute("size", new THREE.BufferAttribute(starSizes, 1));
    const starMaterial = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 1.2,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.95,
      depthWrite: false,
    });
    const stars = new THREE.Points(starGeometry, starMaterial);
    newScene.add(stars);

    const updateStars = (time: number) => {
      const sizes = stars.geometry.attributes.size as THREE.BufferAttribute;
      for (let i = 0; i < STAR_COUNT; i++) {
        const twinkle = 0.7 + 0.3 * Math.sin(time * 2 + starPhases[i]);
        sizes.setX(i, starBaseSizes[i] * twinkle);
      }
      sizes.needsUpdate = true;
    };

    // ============================================================
    // 雲（タイプ別: もくもく雲・入道雲・鰯雲）
    // ============================================================
    interface Cloud {
      points: THREE.Points;
      speed: number;
      bounds: number;
    }
    const clouds: Cloud[] = [];
    const CLOUD_BOUND = 200;

    // パフを球状に膨らませて積む（ヘルパー: 1 個の puff = 多数の点）
    // yFlatten: 1=球, <1 で縦方向を圧縮（雲が薄く広がる）
    // yBias: 正で上半球寄り、底を平らに見せる
    const addPuff = (
      positions: number[],
      cx: number,
      cy: number,
      cz: number,
      radius: number,
      density: number,
      yFlatten = 1,
      yBias = 0
    ) => {
      for (let i = 0; i < density; i++) {
        const u = Math.random();
        const v = Math.random();
        const theta = u * Math.PI * 2;
        const phi = Math.acos(2 * v - 1);
        const r = radius * Math.cbrt(Math.random());
        let dy = r * Math.cos(phi) * yFlatten + yBias * radius;
        // 底をクリップ（下に伸びすぎないように）
        const floor = -radius * 0.15;
        if (dy < floor) dy = floor + (Math.random() - 0.5) * radius * 0.05;
        positions.push(
          cx + r * Math.sin(phi) * Math.cos(theta),
          cy + dy,
          cz + r * Math.sin(phi) * Math.sin(theta)
        );
      }
    };

    // ふわっとした円形スプライト（テクスチャ）。中心から外側へなだらかにフェード。
    const makeSoftCircleTexture = () => {
      const size = 128;
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d")!;
      const gradient = ctx.createRadialGradient(
        size / 2,
        size / 2,
        0,
        size / 2,
        size / 2,
        size / 2
      );
      gradient.addColorStop(0, "rgba(255,255,255,1)");
      gradient.addColorStop(0.35, "rgba(255,255,255,0.6)");
      gradient.addColorStop(0.7, "rgba(255,255,255,0.15)");
      gradient.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, size, size);
      const texture = new THREE.CanvasTexture(canvas);
      texture.needsUpdate = true;
      return texture;
    };
    const softCircleTexture = makeSoftCircleTexture();

    const buildCloudPoints = (
      positions: number[],
      color: number,
      size: number,
      opacity: number
    ): THREE.Points => {
      const arr = new Float32Array(positions);
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.BufferAttribute(arr, 3));
      const material = new THREE.PointsMaterial({
        color,
        size,
        map: softCircleTexture,
        alphaTest: 0.01,
        transparent: true,
        opacity,
        depthWrite: false,
        blending: THREE.NormalBlending,
      });
      return new THREE.Points(geometry, material);
    };

    // --- もくもく雲（cumulus）: 球を複数並べた塊。中速で流れる ---
    // 底を平らに、上半分にもくもく盛り上がる形に
    const buildCumulus = () => {
      const positions: number[] = [];
      const cx = (Math.random() - 0.5) * CLOUD_BOUND * 2;
      const cy = 55 + Math.random() * 20;
      const cz = (Math.random() - 0.5) * CLOUD_BOUND * 2;
      const puffs = 5 + Math.floor(Math.random() * 5);
      for (let p = 0; p < puffs; p++) {
        const ox = (Math.random() - 0.5) * 22;
        const oy = Math.random() * 2; // 上方向の微小ばらつきのみ
        const oz = (Math.random() - 0.5) * 14;
        const radius = 5 + Math.random() * 4;
        // yFlatten=0.55 で縦に潰す、yBias=0.35 で上半球寄り
        addPuff(positions, cx + ox, cy + oy, cz + oz, radius, 180, 0.55, 0.35);
      }
      return buildCloudPoints(positions, 0xb8c4d8, 11, 0.55);
    };

    // --- 入道雲（cumulonimbus）: 縦に高く積み上がる ---
    const buildCumulonimbus = () => {
      const positions: number[] = [];
      const cx = (Math.random() - 0.5) * CLOUD_BOUND * 2;
      const baseY = 50 + Math.random() * 10;
      const cz = (Math.random() - 0.5) * CLOUD_BOUND * 2;
      const totalHeight = 45 + Math.random() * 15;
      const layers = 8;
      for (let l = 0; l < layers; l++) {
        const t = l / (layers - 1);
        const yOff = totalHeight * t;
        let radiusH: number;
        if (t < 0.85) {
          radiusH = 9 + t * 7;
        } else {
          const flatT = (t - 0.85) / 0.15;
          radiusH = 16 + flatT * 9;
        }
        const puffs = 3 + Math.floor(Math.random() * 3);
        for (let p = 0; p < puffs; p++) {
          const ox = (Math.random() - 0.5) * radiusH * 1.2;
          const oz = (Math.random() - 0.5) * radiusH * 1.2;
          const radius = radiusH * (0.6 + Math.random() * 0.3);
          addPuff(positions, cx + ox, baseY + yOff, cz + oz, radius, 220);
        }
      }
      return buildCloudPoints(positions, 0xc8d0e0, 12, 0.6);
    };

    // --- 羊雲（altocumulus 風）: 小さいふわふわの塊が群れる ---
    const buildAltocumulus = () => {
      const positions: number[] = [];
      const cx = (Math.random() - 0.5) * CLOUD_BOUND * 2;
      const cy = 75 + Math.random() * 20;
      const cz = (Math.random() - 0.5) * CLOUD_BOUND * 2;
      // 群れの広がり
      const spreadX = 35 + Math.random() * 20;
      const spreadZ = 25 + Math.random() * 15;
      const sheepCount = 12 + Math.floor(Math.random() * 10);
      for (let s = 0; s < sheepCount; s++) {
        // 楕円分布で群れ感を出す
        const angle = Math.random() * Math.PI * 2;
        const dist = Math.sqrt(Math.random());
        const ox = Math.cos(angle) * dist * spreadX + (Math.random() - 0.5) * 4;
        const oz = Math.sin(angle) * dist * spreadZ + (Math.random() - 0.5) * 4;
        const oy = (Math.random() - 0.5) * 2.5;
        // 1 匹分の小さなもくもく（球を 2〜3 個重ねる）
        const sheepRadius = 2.2 + Math.random() * 1.3;
        const lumps = 2 + Math.floor(Math.random() * 2);
        for (let l = 0; l < lumps; l++) {
          const lx = (Math.random() - 0.5) * sheepRadius * 0.8;
          const ly = Math.random() * sheepRadius * 0.4;
          const lz = (Math.random() - 0.5) * sheepRadius * 0.8;
          addPuff(
            positions,
            cx + ox + lx,
            cy + oy + ly,
            cz + oz + lz,
            sheepRadius * (0.7 + Math.random() * 0.3),
            70,
            0.7,
            0.2
          );
        }
      }
      return buildCloudPoints(positions, 0xc8d0e0, 8, 0.55);
    };

    // 出現比率: 通常 85% / 入道雲 8% / 羊雲 7%
    type CloudKind = "cumulus" | "cumulonimbus" | "altocumulus";
    const pickCloudKind = (): CloudKind => {
      const r = Math.random();
      if (r < 0.85) return "cumulus";
      if (r < 0.93) return "cumulonimbus";
      return "altocumulus";
    };

    // 雲を 1 個生成して任意のレイヤーに追加
    const spawnCloud = (opts: {
      bound: number;            // ループ境界（広いほど遠景）
      scale: number;            // 位置と高さの倍率（>1 で遠景化）
      speedScale: number;       // 速度倍率（遠景は遅く見せる）
      colorTint?: number;       // 色（遠景は薄くする）
    }) => {
      const kind = pickCloudKind();
      let points: THREE.Points;
      let baseSpeed: number;
      if (kind === "cumulonimbus") {
        points = buildCumulonimbus();
        baseSpeed = 0.6 + Math.random() * 0.8;
      } else if (kind === "altocumulus") {
        points = buildAltocumulus();
        baseSpeed = 2 + Math.random() * 1.5;
      } else {
        points = buildCumulus();
        baseSpeed = 1.5 + Math.random() * 2;
      }

      // 生成済み座標を遠景レイヤーに再配置（CLOUD_BOUND を基準に作られているので X/Z をスケール）
      if (opts.scale !== 1) {
        const positions = points.geometry.attributes.position as THREE.BufferAttribute;
        const arr = positions.array as Float32Array;
        for (let i = 0; i < arr.length / 3; i++) {
          arr[i * 3] *= opts.scale;
          arr[i * 3 + 2] *= opts.scale;
        }
        positions.needsUpdate = true;
      }
      if (opts.colorTint !== undefined) {
        (points.material as THREE.PointsMaterial).color.setHex(opts.colorTint);
      }
      newScene.add(points);
      clouds.push({
        points,
        speed: baseSpeed * opts.speedScale,
        bounds: opts.bound,
      });
    };

    // 近景レイヤー（既存）: 3〜7 個
    const NEAR_COUNT = 3 + Math.floor(Math.random() * 5);
    for (let i = 0; i < NEAR_COUNT; i++) {
      spawnCloud({ bound: CLOUD_BOUND, scale: 1, speedScale: 1 });
    }

    // 遠景レイヤー: 3〜6 個、距離 2.5 倍、速度 0.4 倍、色を青みがかった薄色に
    const FAR_BOUND = CLOUD_BOUND * 2.5;
    const FAR_COUNT = 3 + Math.floor(Math.random() * 4);
    for (let i = 0; i < FAR_COUNT; i++) {
      spawnCloud({
        bound: FAR_BOUND,
        scale: 2.5,
        speedScale: 0.4,
        colorTint: 0x8090a8,
      });
    }

    const updateClouds = (delta: number) => {
      for (const cloud of clouds) {
        const positions = cloud.points.geometry.attributes.position as THREE.BufferAttribute;
        const arr = positions.array as Float32Array;
        for (let i = 0; i < arr.length / 3; i++) {
          arr[i * 3] += cloud.speed * delta;
          if (arr[i * 3] > cloud.bounds) {
            arr[i * 3] -= cloud.bounds * 2;
          }
        }
        positions.needsUpdate = true;
      }
    };

    // ============================================================
    // 流れ星（時々斜めに走る）
    // ============================================================
    interface ShootingStarLine {
      line: THREE.Line;
      velocity: THREE.Vector3;
      life: number;
      maxLife: number;
    }
    const shootingStars: ShootingStarLine[] = [];

    const spawnShootingStar = () => {
      const start = new THREE.Vector3(
        (Math.random() - 0.5) * 200,
        80 + Math.random() * 40,
        (Math.random() - 0.5) * 200
      );
      // 斜め下方向（西〜東、奥〜手前のランダム方向）
      const dirX = (Math.random() - 0.5) * 2;
      const dirY = -1 - Math.random();
      const dirZ = (Math.random() - 0.5) * 2;
      const velocity = new THREE.Vector3(dirX, dirY, dirZ).normalize().multiplyScalar(140);

      const tailLength = 12;
      const points = [start.clone(), start.clone().sub(velocity.clone().normalize().multiplyScalar(tailLength))];
      const geometry = new THREE.BufferGeometry().setFromPoints(points);
      const material = new THREE.LineBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 1,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const line = new THREE.Line(geometry, material);
      newScene.add(line);
      shootingStars.push({
        line,
        velocity,
        life: 0,
        maxLife: 1.2 + Math.random() * 0.6,
      });
    };

    const updateShootingStars = (delta: number) => {
      // 平均 2.5 秒に 1 発
      if (Math.random() < delta / 2.5 && shootingStars.length < 4) {
        spawnShootingStar();
      }
      for (let i = shootingStars.length - 1; i >= 0; i--) {
        const ss = shootingStars[i];
        ss.life += delta;
        const positions = ss.line.geometry.attributes.position as THREE.BufferAttribute;
        const arr = positions.array as Float32Array;
        // 頭と尾の両方を速度で進める
        for (let p = 0; p < 2; p++) {
          arr[p * 3] += ss.velocity.x * delta;
          arr[p * 3 + 1] += ss.velocity.y * delta;
          arr[p * 3 + 2] += ss.velocity.z * delta;
        }
        positions.needsUpdate = true;

        const t = ss.life / ss.maxLife;
        (ss.line.material as THREE.LineBasicMaterial).opacity = Math.max(0, 1 - t);

        if (ss.life >= ss.maxLife) {
          newScene.remove(ss.line);
          ss.line.geometry.dispose();
          (ss.line.material as THREE.LineBasicMaterial).dispose();
          shootingStars.splice(i, 1);
        }
      }
    };

    // ライト
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.55);
    newScene.add(ambientLight);

    const moonLight = new THREE.DirectionalLight(0xc8d4ff, 0.4);
    moonLight.position.set(40, 80, -30);
    newScene.add(moonLight);

    const pointLight = new THREE.PointLight(0xffffff, 0.8);
    pointLight.position.set(0, 0, 0);
    newScene.add(pointLight);

    // WASD移動用のキー状態
    const keys = { w: false, a: false, s: false, d: false };
    const moveSpeed = 0.15;

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
    const clock = new THREE.Clock();
    let physicsAccumulator = 0;
    const PHYSICS_STEP = 1 / 60;
    let stopped = false;
    loopStoppersRef.current.push(() => { stopped = true; });
    const animate = () => {
      if (stopped) return;
      requestAnimationFrame(animate);

      const delta = clock.getDelta();
      const elapsed = clock.elapsedTime;

      // 物理ボディが解放されている可能性があるので try/catch で防御
      try {
        // 既存実装の前提: カメラ位置 = 足元（pos.y + FLOOR_Y が実ワールドの足元 y）
        // 剛体中心 = 足元 + PLAYER_HEIGHT/2
        const feetWorldY = newCamera.position.y + FLOOR_TOP_Y;
        playerBody.setNextKinematicTranslation({
          x: newCamera.position.x,
          y: feetWorldY + PLAYER_HEIGHT / 2,
          z: newCamera.position.z,
        });

        // 物理ステップ（固定タイムステップでアキュムレート）
        physicsAccumulator += Math.min(delta, 0.25);
        while (physicsAccumulator >= PHYSICS_STEP) {
          world.step();
          physicsAccumulator -= PHYSICS_STEP;
        }

        // ボウリング同期
        syncBowling();
        updateResetButton(delta);
        updateStrike(delta);
      } catch (e) {
        // 物理エラーが起きてもループは継続（WASD は動かす）
        console.warn("[useThreeScene] physics step failed", e);
      }

      // ジェットコースターの自動走行
      coasterUpdater(delta);

      // 観覧車の回転
      ferrisUpdater(delta);

      // 花火
      updateFireworks(delta);

      // 夜空エフェクト
      updateStars(elapsed);
      updateClouds(delta);
      updateShootingStars(delta);

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
      // controls.enabled=false の時は update() を呼ばない。
      // 呼ぶと damping や target の残留状態でカメラ姿勢が引き戻され、
      // draw モードの自前ルック（use_camera_look）と競合する。
      if (controls.enabled) {
        controls.update();
      }
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
    setPhysicsWorld(world);
  }, [rapierReady]);

  // rapierReady が true になったタイミングで保留中の container を初期化
  useEffect(() => {
    if (rapierReady && pendingContainerRef.current && !initializedRef.current) {
      const c = pendingContainerRef.current;
      pendingContainerRef.current = null;
      containerRef(c);
    }
  }, [rapierReady, containerRef]);

  // アンマウント時に animate ループを止める（古い world が解放された後に触らない）
  useEffect(() => {
    return () => {
      for (const stop of loopStoppersRef.current) stop();
      loopStoppersRef.current = [];
    };
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
    physicsWorld,
    rapierReady,
    resetBowlingRef,
  };
}
