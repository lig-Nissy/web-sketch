import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import type { PlacedObject, ObjectType } from "../types";
import { createCuboidBody, createBallBody } from "./physics_bodies";

const newId = () => Math.random().toString(36).substring(2, 9);

interface FactoryContext {
  scene: THREE.Scene;
  world: RAPIER.World;
  color: string;
  hasGravity: boolean;
}

export const createCube = (position: THREE.Vector3, ctx: FactoryContext): PlacedObject => {
  const size = 3;
  const geometry = new THREE.BoxGeometry(size, size, size);
  const material = new THREE.MeshPhongMaterial({ color: ctx.color, shininess: 100 });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.copy(position);
  ctx.scene.add(mesh);

  const { body, collider } = createCuboidBody(
    ctx.world,
    position,
    { x: size / 2, y: size / 2, z: size / 2 },
    ctx.hasGravity
  );

  return {
    id: newId(),
    type: "cube",
    position: position.clone(),
    mesh,
    boundingBox: { width: size, height: size, depth: size },
    hasGravity: ctx.hasGravity,
    rigidBody: body,
    collider,
  };
};

export const createBox = (position: THREE.Vector3, ctx: FactoryContext): PlacedObject => {
  const width = 5,
    height = 2,
    depth = 3;
  const geometry = new THREE.BoxGeometry(width, height, depth);
  const material = new THREE.MeshPhongMaterial({ color: ctx.color, shininess: 100 });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.copy(position);
  ctx.scene.add(mesh);

  const { body, collider } = createCuboidBody(
    ctx.world,
    position,
    { x: width / 2, y: height / 2, z: depth / 2 },
    ctx.hasGravity
  );

  return {
    id: newId(),
    type: "box",
    position: position.clone(),
    mesh,
    boundingBox: { width, height, depth },
    hasGravity: ctx.hasGravity,
    rigidBody: body,
    collider,
  };
};

export const createSphere = (position: THREE.Vector3, ctx: FactoryContext): PlacedObject => {
  const radius = 1.5;
  const geometry = new THREE.SphereGeometry(radius, 32, 32);
  const material = new THREE.MeshPhongMaterial({ color: ctx.color, shininess: 100 });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.copy(position);
  ctx.scene.add(mesh);

  const { body, collider } = createBallBody(ctx.world, position, radius, ctx.hasGravity);

  return {
    id: newId(),
    type: "sphere",
    position: position.clone(),
    mesh,
    boundingRadius: radius,
    hasGravity: ctx.hasGravity,
    rigidBody: body,
    collider,
  };
};

export const createShootingStar = (position: THREE.Vector3, ctx: FactoryContext): PlacedObject => {
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
  ctx.scene.add(particles);

  return {
    id: newId(),
    type: "shooting_star",
    position: position.clone(),
    particles,
    animationData: { initialPositions: positions.slice() },
    boundingRadius: 1.5,
    hasGravity: false,
  };
};

export const createCow = (position: THREE.Vector3, ctx: FactoryContext): PlacedObject => {
  const group = new THREE.Group();

  const bodyGeometry = new THREE.BoxGeometry(1.2, 0.8, 0.7);
  const bodyMaterial = new THREE.MeshPhongMaterial({ color: 0xffffff });
  const cowBody = new THREE.Mesh(bodyGeometry, bodyMaterial);
  cowBody.position.y = 0.5;
  group.add(cowBody);

  const headGeometry = new THREE.BoxGeometry(0.5, 0.5, 0.5);
  const head = new THREE.Mesh(headGeometry, bodyMaterial);
  head.position.set(0.7, 0.7, 0);
  group.add(head);

  const eyeGeometry = new THREE.SphereGeometry(0.08, 8, 8);
  const eyeMaterial = new THREE.MeshPhongMaterial({ color: 0x000000 });
  const leftEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
  leftEye.position.set(0.95, 0.75, 0.15);
  group.add(leftEye);
  const rightEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
  rightEye.position.set(0.95, 0.75, -0.15);
  group.add(rightEye);

  const noseGeometry = new THREE.BoxGeometry(0.15, 0.15, 0.3);
  const noseMaterial = new THREE.MeshPhongMaterial({ color: 0xffcccc });
  const nose = new THREE.Mesh(noseGeometry, noseMaterial);
  nose.position.set(0.95, 0.55, 0);
  group.add(nose);

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

  const tailGeometry = new THREE.CylinderGeometry(0.03, 0.03, 0.5, 8);
  const tail = new THREE.Mesh(tailGeometry, bodyMaterial);
  tail.position.set(-0.7, 0.5, 0);
  tail.rotation.z = Math.PI / 4;
  group.add(tail);

  group.position.copy(position);
  ctx.scene.add(group);

  const cowSize = { width: 1.5, height: 1.2, depth: 0.8 };
  let body: RAPIER.RigidBody | undefined;
  let collider: RAPIER.Collider | undefined;
  if (ctx.hasGravity) {
    const created = createCuboidBody(
      ctx.world,
      position,
      { x: cowSize.width / 2, y: cowSize.height / 2, z: cowSize.depth / 2 },
      true
    );
    body = created.body;
    collider = created.collider;
  }

  return {
    id: newId(),
    type: "cow",
    position: position.clone(),
    group,
    animationData: { baseY: position.y },
    boundingBox: cowSize,
    hasGravity: ctx.hasGravity,
    rigidBody: body,
    collider,
  };
};

export const createPlacedObject = (
  type: ObjectType,
  position: THREE.Vector3,
  ctx: FactoryContext
): PlacedObject => {
  switch (type) {
    case "cube":
      return createCube(position, ctx);
    case "box":
      return createBox(position, ctx);
    case "sphere":
      return createSphere(position, ctx);
    case "shooting_star":
      return createShootingStar(position, ctx);
    case "cow":
      return createCow(position, ctx);
    default:
      return createCube(position, ctx);
  }
};
