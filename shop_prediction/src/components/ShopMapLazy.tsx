import { lazy, Suspense, useEffect, useState } from "react";
import type { Prediction } from "@/server/predict.functions";

const ShopMap = lazy(() => import("./ShopMap").then((m) => ({ default: m.ShopMap })));

interface Props {
  bbox: [number, number, number, number] | null;
  predictions: Prediction[];
  selectedRank: number | null;
  onSelect: (rank: number) => void;
}

export function ShopMapLazy(props: Props) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return (
      <div className="w-full h-full rounded-2xl border border-border/60 bg-card/40 animate-pulse" />
    );
  }

  return (
    <Suspense
      fallback={
        <div className="w-full h-full rounded-2xl border border-border/60 bg-card/40 animate-pulse" />
      }
    >
      <ShopMap {...props} />
    </Suspense>
  );
}
