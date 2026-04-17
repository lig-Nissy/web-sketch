"use client";

export function HelpPanel() {
  return (
    <div className="absolute bottom-5 left-5 bg-black/70 text-white p-4 rounded-lg text-sm max-w-[280px]">
      <h3 className="font-bold mb-2">操作方法</h3>
      <ul className="space-y-1">
        <li>🖱️ ドラッグ: 線を描く（描画モード時）</li>
        <li>🎨 実体化: 線をチューブ状に変換</li>
        <li>🔄 カメラモード: ドラッグで回転</li>
        <li>🔍 ホイール: ズーム</li>
      </ul>
    </div>
  );
}
