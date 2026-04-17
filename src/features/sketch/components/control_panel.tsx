"use client";

type Mode = "draw" | "select" | "camera";

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
      </div>

      <button
        onClick={onClear}
        className="px-5 py-3 rounded-lg font-medium bg-red-500 text-white hover:bg-red-600 transition-all"
      >
        🗑️ クリア
      </button>

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
