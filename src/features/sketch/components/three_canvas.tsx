"use client";

import { useState, useEffect } from "react";
import { useThreeScene } from "../hooks/use_three_scene";
import { useDrawing } from "../hooks/use_drawing";
import { ControlPanel } from "./control_panel";
import { HelpPanel } from "./help_panel";

export function ThreeCanvas() {
  const [isDrawMode, setIsDrawMode] = useState(true);
  const [currentColor, setCurrentColor] = useState("#ff6b6b");
  const [thickness, setThickness] = useState(0.1);
  const [depth, setDepth] = useState(0);

  const { containerRef, sceneRef, cameraRef, controlsRef } = useThreeScene();

  const {
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    solidifyAll,
    clearAll,
  } = useDrawing({
    sceneRef,
    cameraRef,
    containerRef,
    isDrawMode,
    currentColor,
    thickness,
    depth,
  });

  // 描画モード切り替え時のコントロール制御
  useEffect(() => {
    if (controlsRef.current) {
      controlsRef.current.enabled = !isDrawMode;
    }
  }, [isDrawMode, controlsRef]);

  return (
    <div className="relative w-full h-screen">
      <div
        ref={containerRef}
        className="w-full h-full"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      />

      <ControlPanel
        isDrawMode={isDrawMode}
        setIsDrawMode={setIsDrawMode}
        currentColor={currentColor}
        setCurrentColor={setCurrentColor}
        thickness={thickness}
        setThickness={setThickness}
        depth={depth}
        setDepth={setDepth}
        onSolidify={solidifyAll}
        onClear={clearAll}
      />

      <HelpPanel />
    </div>
  );
}
