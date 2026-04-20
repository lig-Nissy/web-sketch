"use client";

import type { PenType, StampType } from "../types";

type Mode = "draw" | "select" | "camera" | "stamp";

const PEN_TYPES: { type: PenType; label: string; icon: string }[] = [
  { type: "normal", label: "通常", icon: "✏️" },
  { type: "fire", label: "炎", icon: "🔥" },
  { type: "star", label: "星", icon: "✨" },
  { type: "mirror", label: "鏡", icon: "🪞" },
];

const STAMP_TYPES: { type: StampType; label: string; icon: string }[] = [
  { type: "shooting_star", label: "流れ星", icon: "🌠" },
  { type: "cow", label: "牛", icon: "🐄" },
];

const COLORS = [
  "#ff6b6b",
  "#4ecdc4",
  "#45b7d1",
  "#96ceb4",
  "#ffeaa7",
  "#dfe6e9",
  "#a29bfe",
  "#fd79a8",
];

interface ControlPanelProps {
  mode: Mode;
  setMode: (value: Mode) => void;
  currentColor: string;
  setCurrentColor: (value: string) => void;
  thickness: number;
  setThickness: (value: number) => void;
  drawDistance: number;
  setDrawDistance: (value: number) => void;
  penType: PenType;
  setPenType: (value: PenType) => void;
  stampType: StampType;
  setStampType: (value: StampType) => void;
  stampGravity: boolean;
  setStampGravity: (value: boolean) => void;
  onClear: () => void;
}

export function ControlPanel({
  mode,
  setMode,
  currentColor,
  setCurrentColor,
  thickness,
  setThickness,
  drawDistance,
  setDrawDistance,
  penType,
  setPenType,
  stampType,
  setStampType,
  stampGravity,
  setStampGravity,
  onClear,
}: ControlPanelProps) {
  return (
    <div className="absolute top-5 left-5 flex flex-col gap-3">
      {/* モード切り替え */}
      <div className="flex gap-2">
        <button
          onClick={() => setMode("draw")}
          className={`px-4 py-2 rounded-lg font-medium transition-all ${
            mode === "draw"
              ? "bg-blue-500 text-white shadow-lg shadow-blue-500/30"
              : "bg-gray-600 text-white hover:bg-gray-500"
          }`}
        >
          ✏️ 描画
        </button>
        <button
          onClick={() => setMode("select")}
          className={`px-4 py-2 rounded-lg font-medium transition-all ${
            mode === "select"
              ? "bg-green-500 text-white shadow-lg shadow-green-500/30"
              : "bg-gray-600 text-white hover:bg-gray-500"
          }`}
        >
          👆 選択
        </button>
        <button
          onClick={() => setMode("camera")}
          className={`px-4 py-2 rounded-lg font-medium transition-all ${
            mode === "camera"
              ? "bg-purple-500 text-white shadow-lg shadow-purple-500/30"
              : "bg-gray-600 text-white hover:bg-gray-500"
          }`}
        >
          🔄 カメラ
        </button>
        <button
          onClick={() => setMode("stamp")}
          className={`px-4 py-2 rounded-lg font-medium transition-all ${
            mode === "stamp"
              ? "bg-orange-500 text-white shadow-lg shadow-orange-500/30"
              : "bg-gray-600 text-white hover:bg-gray-500"
          }`}
        >
          🎨 スタンプ
        </button>
      </div>

      <button
        onClick={onClear}
        className="px-5 py-3 rounded-lg font-medium bg-red-500 text-white hover:bg-red-600 transition-all"
      >
        🗑️ クリア
      </button>

      {/* ペン種類（描画モード時のみ表示） */}
      {mode === "draw" && (
        <div className="bg-black/50 p-3 rounded-lg">
          <p className="text-white text-sm mb-2">ペン種類</p>
          <div className="flex gap-2">
            {PEN_TYPES.map((pen) => (
              <button
                key={pen.type}
                onClick={() => setPenType(pen.type)}
                className={`px-3 py-2 rounded-lg text-sm transition-all ${
                  penType === pen.type
                    ? "bg-yellow-500 text-black shadow-lg"
                    : "bg-gray-700 text-white hover:bg-gray-600"
                }`}
                title={pen.label}
              >
                {pen.icon}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* スタンプ種類（スタンプモード時のみ表示） */}
      {mode === "stamp" && (
        <div className="bg-black/50 p-3 rounded-lg">
          <p className="text-white text-sm mb-2">スタンプ種類</p>
          <div className="flex gap-2">
            {STAMP_TYPES.map((stamp) => (
              <button
                key={stamp.type}
                onClick={() => setStampType(stamp.type)}
                className={`px-3 py-2 rounded-lg text-sm transition-all ${
                  stampType === stamp.type
                    ? "bg-orange-500 text-white shadow-lg"
                    : "bg-gray-700 text-white hover:bg-gray-600"
                }`}
                title={stamp.label}
              >
                {stamp.icon}
              </button>
            ))}
          </div>
          {/* 重力トグル */}
          <label className="flex items-center gap-2 mt-3 cursor-pointer">
            <input
              type="checkbox"
              checked={stampGravity}
              onChange={(e) => setStampGravity(e.target.checked)}
              className="w-4 h-4 rounded"
            />
            <span className="text-white text-sm">🌍 重力</span>
          </label>
        </div>
      )}

      {/* カラーパレット */}
      <div className="bg-black/50 p-3 rounded-lg">
        <div className="flex flex-wrap gap-2 max-w-[180px]">
          {COLORS.map((color) => (
            <button
              key={color}
              onClick={() => setCurrentColor(color)}
              className={`w-8 h-8 rounded-full transition-transform hover:scale-110 ${
                currentColor === color
                  ? "ring-2 ring-white ring-offset-2 ring-offset-black"
                  : ""
              }`}
              style={{ backgroundColor: color }}
            />
          ))}
        </div>
        {/* カスタムカラーピッカー */}
        <div className="flex items-center gap-2 mt-3">
          <input
            type="color"
            value={currentColor}
            onChange={(e) => setCurrentColor(e.target.value)}
            className="w-8 h-8 rounded cursor-pointer border-0 bg-transparent"
          />
          <span className="text-white text-xs">{currentColor}</span>
        </div>
      </div>

      {/* 太さスライダー */}
      <div className="bg-black/50 p-3 rounded-lg text-white text-sm">
        <label className="block mb-2">線の太さ: {thickness.toFixed(2)}</label>
        <input
          type="range"
          min="0.05"
          max="0.5"
          step="0.05"
          value={thickness}
          onChange={(e) => setThickness(parseFloat(e.target.value))}
          className="w-full"
        />
      </div>

      {/* 描画距離スライダー */}
      <div className="bg-black/50 p-3 rounded-lg text-white text-sm">
        <label className="block mb-2">描画距離: {drawDistance.toFixed(0)}</label>
        <input
          type="range"
          min="2"
          max="60"
          step="1"
          value={drawDistance}
          onChange={(e) => setDrawDistance(parseFloat(e.target.value))}
          className="w-full"
        />
        <p className="text-xs text-gray-400 mt-2">スクロールでも調整可能</p>
      </div>
    </div>
  );
}
