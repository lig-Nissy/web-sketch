import { useEffect, type RefObject } from "react";
import * as THREE from "three";
import type { Stroke, PlacedObject } from "../types";

type CollisionResult = { collides: boolean; groundY?: number };

interface UsePlayerCollisionArgs {
  collisionCheckRef: RefObject<((pos: THREE.Vector3) => CollisionResult) | null>;
  strokesRef: RefObject<Stroke[]>;
  objectsRef: RefObject<PlacedObject[]>;
}

const COLLISION_RADIUS = 0.5;
const FLOOR_Y = -5;

export function usePlayerCollision({
  collisionCheckRef,
  strokesRef,
  objectsRef,
}: UsePlayerCollisionArgs) {
  useEffect(() => {
    if (!collisionCheckRef) return;

    const checkCollision = (pos: THREE.Vector3): CollisionResult => {
      let groundY: number | undefined;

      const actualFeetY = pos.y + FLOOR_Y;
      const actualHeadY = actualFeetY + 2.0;

      for (const stroke of strokesRef.current) {
        if (!stroke.isSolidified || stroke.points.length < 2) continue;

        for (let i = 0; i < stroke.points.length - 1; i++) {
          const p1 = stroke.points[i];
          const p2 = stroke.points[i + 1];

          const line = new THREE.Vector3().subVectors(p2, p1);
          const lineLength = line.length();
          if (lineLength === 0) continue;

          const lineDir = line.normalize();
          const toPos = new THREE.Vector3().subVectors(pos, p1);

          let t = toPos.dot(lineDir);
          t = Math.max(0, Math.min(lineLength, t));

          const closestPoint = p1.clone().add(lineDir.multiplyScalar(t));
          const distance = pos.distanceTo(closestPoint);

          const effectiveThickness =
            stroke.penType === "fire" || stroke.penType === "star"
              ? stroke.thickness * 3
              : stroke.thickness;
          if (distance < effectiveThickness + COLLISION_RADIUS) {
            return { collides: true };
          }
        }
      }

      for (const obj of objectsRef.current) {
        const objPos = obj.position;

        if (obj.boundingBox) {
          const halfW = obj.boundingBox.width / 2;
          const halfH = obj.boundingBox.height / 2;
          const halfD = obj.boundingBox.depth / 2;

          const boxTop = objPos.y + halfH;
          const boxBottom = objPos.y - halfH;

          const dx = Math.abs(pos.x - objPos.x);
          const dz = Math.abs(pos.z - objPos.z);

          const inBoxHorizontal = dx < halfW + COLLISION_RADIUS && dz < halfD + COLLISION_RADIUS;

          if (inBoxHorizontal) {
            if (actualFeetY >= boxTop - 0.1) {
              const newGroundY = boxTop - FLOOR_Y;
              if (groundY === undefined || newGroundY > groundY) {
                groundY = newGroundY;
              }
            } else if (actualFeetY < boxTop && actualHeadY > boxBottom) {
              return { collides: true };
            }
          }
        } else if (obj.boundingRadius) {
          const horizontalDist = Math.sqrt(
            Math.pow(pos.x - objPos.x, 2) + Math.pow(pos.z - objPos.z, 2)
          );
          const sphereTop = objPos.y + obj.boundingRadius;
          const sphereBottom = objPos.y - obj.boundingRadius;

          if (horizontalDist < obj.boundingRadius + COLLISION_RADIUS) {
            if (actualFeetY >= sphereTop - 0.1) {
              const newGroundY = sphereTop - FLOOR_Y;
              if (groundY === undefined || newGroundY > groundY) {
                groundY = newGroundY;
              }
            } else if (actualFeetY < sphereTop && actualHeadY > sphereBottom) {
              return { collides: true };
            }
          }
        }
      }

      return { collides: false, groundY };
    };

    collisionCheckRef.current = checkCollision;

    return () => {
      collisionCheckRef.current = null;
    };
  }, [collisionCheckRef, strokesRef, objectsRef]);
}
