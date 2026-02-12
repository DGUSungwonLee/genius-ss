"use client";

import dynamic from "next/dynamic";

const GameUI = dynamic(() => import("./GameUI"), { ssr: false });

export default function ClientOnlyGame() {
  return <GameUI />;
}