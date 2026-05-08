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
    const clock = new THREE.Clock();
    const animate = () => {
      requestAnimationFrame(animate);

      const delta = clock.getDelta();

      // ジェットコースターの自動走行
      coasterUpdater(delta);

      // 観覧車の回転
      ferrisUpdater(delta);

      // 花火
      updateFireworks(delta);

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
