import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import type { PlacedObject, Stroke } from "../types";

export const transformCowToSteak = (
  cow: PlacedObject,
  scene: THREE.Scene,
  physicsWorld: RAPIER.World | null
) => {
  if (cow.group) {
    scene.remove(cow.group);
    cow.group.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        if (child.geometry) child.geometry.dispose();
        if (Array.isArray(child.material)) {
          child.material.forEach((m) => m.dispose());
        } else if (child.material) {
          child.material.dispose();
        }
      }
    });
  }

  const group = new THREE.Group();

  const steakGeometry = new THREE.BoxGeometry(0.8, 0.12, 0.5);
  const steakMaterial = new THREE.MeshPhongMaterial({
    color: 0x8b4513,
    shininess: 30,
  });
  const steak = new THREE.Mesh(steakGeometry, steakMaterial);
  steak.position.y = 0.06;
  group.add(steak);

  const grillMarkGeometry = new THREE.BoxGeometry(0.7, 0.02, 0.06);
  const grillMarkMaterial = new THREE.MeshPhongMaterial({ color: 0x3d2817 });
  for (let i = -2; i <= 2; i++) {
    const mark = new THREE.Mesh(grillMarkGeometry, grillMarkMaterial);
    mark.position.set(0, 0.13, i * 0.1);
    mark.rotation.y = Math.PI / 6;
    group.add(mark);
  }

  const steamCount = 20;
  const steamPositions = new Float32Array(steamCount * 3);
  const steamSizes = new Float32Array(steamCount);
  for (let i = 0; i < steamCount; i++) {
    steamPositions[i * 3] = (Math.random() - 0.5) * 0.6;
    steamPositions[i * 3 + 1] = 0.2 + Math.random() * 0.5;
    steamPositions[i * 3 + 2] = (Math.random() - 0.5) * 0.4;
    steamSizes[i] = 0.1 + Math.random() * 0.1;
  }
  const steamGeometry = new THREE.BufferGeometry();
  steamGeometry.setAttribute("position", new THREE.BufferAttribute(steamPositions, 3));
  steamGeometry.setAttribute("size", new THREE.BufferAttribute(steamSizes, 1));
  const steamMaterial = new THREE.PointsMaterial({
    size: 0.15,
    color: 0xffffff,
    transparent: true,
    opacity: 0.4,
    depthWrite: false,
  });
  const steam = new THREE.Points(steamGeometry, steamMaterial);
  group.add(steam);

  group.position.copy(cow.position);
  scene.add(group);

  cow.type = "steak";
  cow.group = group;
  cow.boundingBox = { width: 0.8, height: 0.2, depth: 0.5 };
  cow.boundingRadius = undefined;
  cow.animationData = {
    ...cow.animationData,
    baseY: cow.position.y,
    steamInitialY: steamPositions.slice(),
  };

  if (cow.rigidBody && physicsWorld) {
    physicsWorld.removeRigidBody(cow.rigidBody);
    const desc = RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(cow.position.x, cow.position.y, cow.position.z)
      .setLinearDamping(0.5)
      .setAngularDamping(0.8);
    const newBody = physicsWorld.createRigidBody(desc);
    const colliderDesc = RAPIER.ColliderDesc.cuboid(0.4, 0.1, 0.25)
      .setRestitution(0.2)
      .setFriction(0.8)
      .setDensity(1);
    const newCollider = physicsWorld.createCollider(colliderDesc, newBody);
    cow.rigidBody = newBody;
    cow.collider = newCollider;
  }
};

export const checkCowFireCollision = (cow: PlacedObject, strokes: Stroke[]): boolean => {
  const cowPos = cow.position;
  const cowRadius = 1.0;

  for (const stroke of strokes) {
    if (stroke.penType !== "fire" || !stroke.isSolidified || stroke.points.length < 2) continue;

    for (let i = 0; i < stroke.points.length - 1; i++) {
      const p1 = stroke.points[i];
      const p2 = stroke.points[i + 1];

      const line = new THREE.Vector3().subVectors(p2, p1);
      const lineLength = line.length();
      if (lineLength === 0) continue;

      const lineDir = line.normalize();
      const toPos = new THREE.Vector3().subVectors(cowPos, p1);

      let t = toPos.dot(lineDir);
      t = Math.max(0, Math.min(lineLength, t));

      const closestPoint = p1.clone().add(lineDir.multiplyScalar(t));
      const distance = cowPos.distanceTo(closestPoint);

      const fireRadius = stroke.thickness * 3;
      if (distance < fireRadius + cowRadius) {
        return true;
      }
    }
  }
  return false;
};
