"use client";

import dynamic from "next/dynamic";

const SketchPage = dynamic(
  () =>
    import("@/features/sketch/pages/sketch_page").then((mod) => mod.SketchPage),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-screen flex items-center justify-center bg-[#1a1a2e] text-white">
        <div className="text-xl">Loading 3D Canvas...</div>
      </div>
    ),
  }
);

export default function Home() {
  return <SketchPage />;
}
