import * as THREE from "three";
import type { Stroke } from "../types";
import { disposeObject3D } from "./three_dispose";

export const createStrokeMaterial = (stroke: Stroke, scene: THREE.Scene): THREE.Material => {
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

export const createFireParticles = (stroke: Stroke, curve: THREE.CatmullRomCurve3) => {
  const particleCount = Math.max(stroke.points.length * 20, 100);
  const positions = new Float32Array(particleCount * 3);
  const colors = new Float32Array(particleCount * 3);
  const sizes = new Float32Array(particleCount);

  const baseColor = new THREE.Color(stroke.color);
  const fireColors = [
    new THREE.Color(0xff4500),
    new THREE.Color(0xff6600),
    new THREE.Color(0xffcc00),
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

export const createStarParticles = (stroke: Stroke, curve: THREE.CatmullRomCurve3) => {
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

export const updateStrokeMesh = (stroke: Stroke, scene: THREE.Scene) => {
  if (stroke.points.length < 2) return;

  if (stroke.mesh) {
    disposeObject3D(stroke.mesh, scene);
  }
  if (stroke.particles) {
    disposeObject3D(stroke.particles, scene);
    stroke.particles = undefined;
  }

  const curve = new THREE.CatmullRomCurve3(stroke.points);
  const tubeSegments = Math.max(stroke.points.length * 2, 20);
  const tubeGeometry = new THREE.TubeGeometry(curve, tubeSegments, stroke.thickness, 8, false);

  const material = createStrokeMaterial(stroke, scene);

  const startPoint = curve.getPointAt(0);
  const endPoint = curve.getPointAt(1);
  const startTangent = curve.getTangentAt(0);
  const endTangent = curve.getTangentAt(1);

  const capGeometry = new THREE.SphereGeometry(stroke.thickness, 8, 8, 0, Math.PI * 2, 0, Math.PI / 2);

  const startCap = new THREE.Mesh(capGeometry, material.clone());
  startCap.position.copy(startPoint);
  startCap.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), startTangent.clone().negate());

  const endCap = new THREE.Mesh(capGeometry.clone(), material.clone());
  endCap.position.copy(endPoint);
  endCap.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), endTangent);

  if (stroke.penType === "fire") {
    const particles = createFireParticles(stroke, curve);
    stroke.particles = particles;
    scene.add(particles);
    const group = new THREE.Group();
    stroke.mesh = group as unknown as THREE.Mesh;
    return;
  } else if (stroke.penType === "star") {
    const particles = createStarParticles(stroke, curve);
    stroke.particles = particles;
    scene.add(particles);
    const group = new THREE.Group();
    stroke.mesh = group as unknown as THREE.Mesh;
    return;
  }

  const group = new THREE.Group();
  const tubeMesh = new THREE.Mesh(tubeGeometry, material);
  group.add(tubeMesh);
  group.add(startCap);
  group.add(endCap);

  stroke.mesh = group as unknown as THREE.Mesh;
  scene.add(group);
};

export const createStrokeMarkers = (stroke: Stroke, scene: THREE.Scene) => {
  if (stroke.points.length < 2) return;

  removeStrokeMarkers(stroke, scene, false);

  const markerRadius = stroke.thickness * 2;
  const markerGeometry = new THREE.SphereGeometry(markerRadius, 16, 16);

  const startDir = new THREE.Vector3().subVectors(stroke.points[0], stroke.points[1]).normalize();
  const startPos = stroke.points[0].clone().add(startDir.multiplyScalar(markerRadius));

  const endIdx = stroke.points.length - 1;
  const endDir = new THREE.Vector3()
    .subVectors(stroke.points[endIdx], stroke.points[endIdx - 1])
    .normalize();
  const endPos = stroke.points[endIdx].clone().add(endDir.multiplyScalar(markerRadius));

  const startMaterial = new THREE.MeshPhongMaterial({ color: 0x00ff00 });
  const startMarker = new THREE.Mesh(markerGeometry, startMaterial);
  startMarker.position.copy(startPos);
  startMarker.userData.strokeId = stroke.id;
  startMarker.userData.markerType = "start";
  scene.add(startMarker);
  stroke.startMarker = startMarker;

  const endMaterial = new THREE.MeshPhongMaterial({ color: 0xff0000 });
  const endMarker = new THREE.Mesh(markerGeometry.clone(), endMaterial);
  endMarker.position.copy(endPos);
  endMarker.userData.strokeId = stroke.id;
  endMarker.userData.markerType = "end";
  scene.add(endMarker);
  stroke.endMarker = endMarker;
};

export const removeStrokeMarkers = (stroke: Stroke, scene: THREE.Scene, rebuildMesh = true) => {
  if (stroke.startMarker) {
    disposeObject3D(stroke.startMarker, scene);
    stroke.startMarker = undefined;
  }
  if (stroke.endMarker) {
    disposeObject3D(stroke.endMarker, scene);
    stroke.endMarker = undefined;
  }
  if (rebuildMesh && stroke.isSolidified) {
    updateStrokeMesh(stroke, scene);
  }
};
