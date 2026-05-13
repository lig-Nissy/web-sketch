import { useEffect, type RefObject } from "react";
import * as THREE from "three";
import type RAPIER from "@dimforge/rapier3d-compat";
import type { Stroke, PlacedObject } from "../types";
import { transformCowToSteak, checkCowFireCollision } from "../utils";

interface UseParticleAnimationArgs {
  onAnimateRef: RefObject<(() => void) | null>;
  scene: THREE.Scene | null;
  physicsWorld: RAPIER.World | null;
  strokesRef: RefObject<Stroke[]>;
  objectsRef: RefObject<PlacedObject[]>;
}

export function useParticleAnimation({
  onAnimateRef,
  scene,
  physicsWorld,
  strokesRef,
  objectsRef,
}: UseParticleAnimationArgs) {
  useEffect(() => {
    if (!onAnimateRef || !scene) return;

    const animateParticles = () => {
      const time = Date.now() * 0.001;

      strokesRef.current.forEach((stroke) => {
        if (!stroke.particles) return;

        const positions = stroke.particles.geometry.attributes.position;
        const sizes = stroke.particles.geometry.attributes.size;

        if (stroke.penType === "fire") {
          for (let i = 0; i < positions.count; i++) {
            const y = positions.getY(i);
            positions.setY(i, y + Math.sin(time * 5 + i) * 0.02);
            positions.setX(i, positions.getX(i) + Math.sin(time * 3 + i * 0.5) * 0.01);

            const baseSize = sizes.array[i];
            sizes.setX(i, baseSize * (0.8 + Math.sin(time * 10 + i) * 0.2));
          }
          positions.needsUpdate = true;
          sizes.needsUpdate = true;
        } else if (stroke.penType === "star") {
          for (let i = 0; i < sizes.count; i++) {
            const baseSize = stroke.thickness * (1 + Math.random() * 0.5);
            sizes.setX(i, baseSize * (0.5 + Math.abs(Math.sin(time * 8 + i * 2)) * 0.5));
          }
          sizes.needsUpdate = true;
        }
      });

      objectsRef.current.forEach((obj) => {
        if (obj.rigidBody) {
          const t = obj.rigidBody.translation();
          const r = obj.rigidBody.rotation();
          obj.position.set(t.x, t.y, t.z);
          if (obj.group) {
            obj.group.position.set(t.x, t.y, t.z);
            obj.group.quaternion.set(r.x, r.y, r.z, r.w);
          }
          if (obj.mesh) {
            obj.mesh.position.set(t.x, t.y, t.z);
            obj.mesh.quaternion.set(r.x, r.y, r.z, r.w);
          }
        }

        if (obj.type === "shooting_star" && obj.particles) {
          const positions = obj.particles.geometry.attributes.position;
          const initialPositions = obj.animationData?.initialPositions as Float32Array;

          if (initialPositions) {
            for (let i = 0; i < positions.count; i++) {
              const offset = (time * 3 + i * 0.1) % 2;
              positions.setX(i, initialPositions[i * 3] + offset * 2);
              positions.setY(i, initialPositions[i * 3 + 1] - offset * 2);
              positions.setZ(i, initialPositions[i * 3 + 2]);
            }
            positions.needsUpdate = true;
          }
        } else if (obj.type === "cow" && obj.group) {
          if (!obj.hasGravity) {
            obj.group.rotation.y = Math.sin(time * 2) * 0.1;
            obj.group.position.y =
              ((obj.animationData?.baseY as number) || 0) + Math.sin(time * 3) * 0.1;
          }

          if (checkCowFireCollision(obj, strokesRef.current)) {
            transformCowToSteak(obj, scene, physicsWorld);
          }
        } else if (obj.type === "steak" && obj.group) {
          const steam = obj.group.children.find((c) => c instanceof THREE.Points) as
            | THREE.Points
            | undefined;
          if (steam) {
            const positions = steam.geometry.attributes.position;
            const initialY = obj.animationData?.steamInitialY as Float32Array;
            if (initialY) {
              for (let i = 0; i < positions.count; i++) {
                const baseY = initialY[i * 3 + 1];
                const offset = ((time * 0.5 + i * 0.2) % 1) * 0.8;
                positions.setY(i, baseY + offset);
                const sizes = steam.geometry.attributes.size;
                sizes.setX(i, 0.1 * (1 - offset));
              }
              positions.needsUpdate = true;
              steam.geometry.attributes.size.needsUpdate = true;
            }
          }
        }
      });
    };

    onAnimateRef.current = animateParticles;

    return () => {
      onAnimateRef.current = null;
    };
  }, [onAnimateRef, scene, physicsWorld, strokesRef, objectsRef]);
}
