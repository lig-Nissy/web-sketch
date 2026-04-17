"use client";

export function HelpPanel() {
  return (
    <div className="absolute bottom-5 left-5 bg-black/70 text-white p-4 rounded-lg text-sm max-w-[280px]">
      <h3 className="font-bold mb-2">操作方法</h3>
      <ul className="space-y-1">
        <li>✏️ 描画モード:</li>
        <li className="pl-4">- ドラッグ: 床や空中に描画</li>
        <li className="pl-4">- ホイール: 描画距離調整</li>
        <li>👆 選択モード:</li>
        <li className="pl-4">- クリック: オブジェクト選択</li>
        <li className="pl-4">- 🟢緑/🔴赤マーカー: 続きから描画</li>
        <li>🔄 カメラモード:</li>
        <li className="pl-4">- ドラッグ: 回転</li>
        <li className="pl-4">- ホイール: ズーム</li>
        <li>⌨️ WASD: 床の上を移動</li>
      </ul>
    </div>
  );
}
