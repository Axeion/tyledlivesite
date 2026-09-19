"use client";

import dynamic from "next/dynamic";
import type { LodgeMapProps } from "@/templates/shared/LodgeMapInner";

// Leaflet touches `window` at import time, so it must never render on the server.
const Inner = dynamic(() => import("@/templates/shared/LodgeMapInner"), {
  ssr: false,
  loading: () => <div className="h-80 w-full animate-pulse rounded-lg bg-neutral-200" aria-hidden="true" />,
});

export default function LodgeMap(props: LodgeMapProps) {
  return <Inner {...props} />;
}
