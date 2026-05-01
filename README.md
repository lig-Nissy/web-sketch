# web-sketch

Three.js × Next.js で動く 3D 空間お絵描きアプリ。床や空中に線を描いたり、特殊ペンでエフェクトをかけたり、WASD でシーン内を歩き回れます。

## 技術スタック

- Next.js 16 (App Router) / React 19
- TypeScript 5
- Three.js 0.184
- Tailwind CSS v4
- Radix UI (Dialog)

## セットアップ

```bash
npm install
npm run dev
```

開発サーバーは `http://localhost:2400` で起動します。

## スクリプト

| コマンド | 内容 |
| --- | --- |
| `npm run dev` | 開発サーバー起動 (port 2400) |
| `npm run build` | 本番ビルド |
| `npm run start` | 本番サーバー起動 |
| `npm run lint` | ESLint 実行 |

## 操作方法

### ✏️ 描画モード
- ドラッグ: 床や空中に描画
- Shift+ドラッグ: 強制的に空中
- Option+ドラッグ: 床に張り付く
- ホイール: 描画距離調整

### 👆 選択モード
- クリック: オブジェクト選択
- 🟢緑/🔴赤マーカー: 続きから描画
- Delete/⌫: 選択を削除

### 🔄 カメラモード
- ドラッグ: 回転
- ホイール: ズーム

### ⌨️ 移動
- WASD: 床の上を移動
- Space: ジャンプ

### 🖌️ 特殊ペン
- ✏️ 通常: 普通の線
- 🔥 炎: めらめらエフェクト
- ✨ 星: キラキラエフェクト
- 🪞 鏡: 反射する線

## ディレクトリ構成

```
src/
├── app/                    # Next.js App Router エントリ
└── features/
    └── sketch/             # 3D スケッチ機能
        ├── components/     # ThreeCanvas / ControlPanel / HelpPanel
        ├── hooks/          # use_three_scene
        ├── pages/          # SketchPage
        ├── providers/
        ├── types/
        └── utils/
```

`src/app/page.tsx` は `SketchPage` を `ssr: false` で動的 import し、Three.js をクライアント側でのみ初期化しています。
