import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";

export const createCuboidBody = (
  world: RAPIER.World,
  position: THREE.Vector3,
  halfExtents: { x: number; y: number; z: number },
  gravity: boolean
) => {
  const desc = gravity
    ? RAPIER.RigidBodyDesc.dynamic().setLinearDamping(0.5).setAngularDamping(0.8)
    : RAPIER.RigidBodyDesc.fixed();
  desc.setTranslation(position.x, position.y, position.z);
  const body = world.createRigidBody(desc);
  const colliderDesc = RAPIER.ColliderDesc.cuboid(halfExtents.x, halfExtents.y, halfExtents.z)
    .setRestitution(0.25)
    .setFriction(0.8)
    .setDensity(1);
  const collider = world.createCollider(colliderDesc, body);
  return { body, collider };
};

export const createBallBody = (
  world: RAPIER.World,
  position: THREE.Vector3,
  radius: number,
  gravity: boolean
) => {
  const desc = gravity
    ? RAPIER.RigidBodyDesc.dynamic().setLinearDamping(0.4).setAngularDamping(0.6)
    : RAPIER.RigidBodyDesc.fixed();
  desc.setTranslation(position.x, position.y, position.z);
  const body = world.createRigidBody(desc);
  const colliderDesc = RAPIER.ColliderDesc.ball(radius)
    .setRestitution(0.4)
    .setFriction(0.7)
    .setDensity(1);
  const collider = world.createCollider(colliderDesc, body);
  return { body, collider };
};
