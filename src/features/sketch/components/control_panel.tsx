"use client";

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
  isDrawMode: boolean;
  setIsDrawMode: (value: boolean) => void;
  currentColor: string;
  setCurrentColor: (value: string) => void;
  thickness: number;
  setThickness: (value: number) => void;
  depth: number;
  setDepth: (value: number) => void;
  onSolidify: () => void;
  onClear: () => void;
}

export function ControlPanel({
  isDrawMode,
  setIsDrawMode,
  currentColor,
  setCurrentColor,
  thickness,
  setThickness,
  depth,
  setDepth,
  onSolidify,
  onClear,
}: ControlPanelProps) {
  return (
    <div className="absolute top-5 left-5 flex flex-col gap-3">
      <button
        onClick={() => setIsDrawMode(!isDrawMode)}
        className={`px-5 py-3 rounded-lg font-medium transition-all ${
          isDrawMode
            ? "bg-blue-500 text-white shadow-lg shadow-blue-500/30"
            : "bg-gray-600 text-white hover:bg-gray-500"
        }`}
      >
        {isDrawMode ? "✏️ 描画モード" : "🔄 カメラモード"}
      </button>

      <button
        onClick={onSolidify}
        className="px-5 py-3 rounded-lg font-medium bg-purple-500 text-white hover:bg-purple-600 transition-all"
      >
        🎨 実体化
      </button>

      <button
        onClick={onClear}
        className="px-5 py-3 rounded-lg font-medium bg-red-500 text-white hover:bg-red-600 transition-all"
      >
        🗑️ クリア
      </button>

      {/* カラーパレット */}
      <div className="flex flex-wrap gap-2 max-w-[180px] bg-black/50 p-3 rounded-lg">
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

      {/* 太さスライダー */}
      <div className="bg-black/50 p-3 rounded-lg text-white text-sm">
        <label className="block mb-2">線の太さ: {thickness.toFixed(2)}</label>
        <input
          type="range"
          min="0.02"
          max="0.3"
          step="0.02"
          value={thickness}
          onChange={(e) => setThickness(parseFloat(e.target.value))}
          className="w-full"
        />
      </div>

      {/* 深度スライダー */}
      <div className="bg-black/50 p-3 rounded-lg text-white text-sm">
        <label className="block mb-2">描画深度: {depth.toFixed(1)}</label>
        <input
          type="range"
          min="-5"
          max="5"
          step="0.5"
          value={depth}
          onChange={(e) => setDepth(parseFloat(e.target.value))}
          className="w-full"
        />
      </div>
    </div>
  );
}
