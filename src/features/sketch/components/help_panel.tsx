"use client";

import { useState, useEffect } from "react";
import * as Dialog from "@radix-ui/react-dialog";

const HelpContent = () => (
  <div className="space-y-4">
    <section>
      <h4 className="font-bold text-lg mb-2">✏️ 描画モード</h4>
      <ul className="space-y-1 text-gray-300">
        <li>• ドラッグ: 床や空中に描画</li>
        <li>• Shift+ドラッグ: 強制的に空中</li>
        <li>• Option+ドラッグ: 床に張り付く</li>
        <li>• ホイール: 描画距離調整</li>
      </ul>
    </section>

    <section>
      <h4 className="font-bold text-lg mb-2">👆 選択モード</h4>
      <ul className="space-y-1 text-gray-300">
        <li>• クリック: オブジェクト選択</li>
        <li>• 🟢緑/🔴赤マーカー: 続きから描画</li>
        <li>• Delete/⌫: 選択を削除</li>
      </ul>
    </section>

    <section>
      <h4 className="font-bold text-lg mb-2">🔄 カメラモード</h4>
      <ul className="space-y-1 text-gray-300">
        <li>• ドラッグ: 回転</li>
        <li>• ホイール: ズーム</li>
      </ul>
    </section>

    <section>
      <h4 className="font-bold text-lg mb-2">⌨️ 移動</h4>
      <ul className="space-y-1 text-gray-300">
        <li>• WASD: 床の上を移動</li>
        <li>• Space: ジャンプ</li>
      </ul>
    </section>

    <section>
      <h4 className="font-bold text-lg mb-2">🖌️ 特殊ペン</h4>
      <ul className="space-y-1 text-gray-300">
        <li>• ✏️ 通常: 普通の線</li>
        <li>• 🔥 炎: めらめらエフェクト</li>
        <li>• ✨ 星: キラキラエフェクト</li>
        <li>• 🪞 鏡: 反射する線</li>
      </ul>
    </section>
  </div>
);

export function HelpPanel() {
  const [isInitialOpen, setIsInitialOpen] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // 初回表示を3秒後に自動で閉じる
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsInitialOpen(false);
    }, 3000);
    return () => clearTimeout(timer);
  }, []);

  // 初回表示（中央に大きく）
  if (isInitialOpen) {
    return (
      <div
        className="fixed inset-0 flex items-center justify-center bg-black/60 z-50"
        onClick={() => setIsInitialOpen(false)}
      >
        <div
          className="bg-gray-900/95 text-white p-8 rounded-2xl max-w-lg w-full mx-4 shadow-2xl border border-gray-700"
          onClick={(e) => e.stopPropagation()}
        >
          <h2 className="text-2xl font-bold mb-6 text-center">🎨 操作方法</h2>
          <HelpContent />
          <p className="text-center text-gray-500 mt-6 text-sm">
            クリックまたは3秒で閉じます
          </p>
        </div>
      </div>
    );
  }

  // モーダル（ヘルプボタンから開く）
  return (
    <Dialog.Root open={isModalOpen} onOpenChange={setIsModalOpen}>
      <Dialog.Trigger asChild>
        <button
          className="absolute top-5 right-5 bg-white text-black px-4 py-2 rounded-lg text-sm hover:bg-gray-200 transition-colors shadow-md"
        >
          ❓ ヘルプ
        </button>
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/60 z-50" />
        <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-gray-900/95 text-white p-8 rounded-2xl max-w-lg w-full mx-4 shadow-2xl border border-gray-700 z-50 max-h-[85vh] overflow-y-auto">
          <Dialog.Title className="text-2xl font-bold mb-6 text-center">
            🎨 操作方法
          </Dialog.Title>

          <HelpContent />

          <Dialog.Close asChild>
            <button
              className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors text-xl"
              aria-label="閉じる"
            >
              ✕
            </button>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
