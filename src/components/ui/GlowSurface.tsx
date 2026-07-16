"use client";

import { useEffect, useRef, type HTMLAttributes, type PointerEvent } from "react";
import { cx } from "./class-names";

export type GlowTone = "danger" | "attention" | "attendance" | "active";

export interface GlowSurfaceProps extends HTMLAttributes<HTMLDivElement> {
  tone: GlowTone;
  active?: boolean;
  breathe?: boolean;
}

export function GlowSurface({ tone, active = false, breathe = false, className, children, onPointerMove, onPointerLeave, ...props }: GlowSurfaceProps) {
  const surfaceRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<number | null>(null);
  const pointerRef = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => () => {
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
  }, []);

  function updatePointer(event: PointerEvent<HTMLDivElement>) {
    onPointerMove?.(event);
    if (event.pointerType === "touch" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    pointerRef.current = { x: event.clientX, y: event.clientY };
    if (frameRef.current !== null) return;
    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = null;
      const element = surfaceRef.current;
      const pointer = pointerRef.current;
      if (!element || !pointer) return;
      const rect = element.getBoundingClientRect();
      const x = Math.min(rect.width, Math.max(0, pointer.x - rect.left));
      const y = Math.min(rect.height, Math.max(0, pointer.y - rect.top));
      const edgeDistance = Math.min(x, y, rect.width - x, rect.height - y);
      const edgeRange = Math.max(24, Math.min(rect.width, rect.height) * 0.34);
      const edgeStrength = Math.max(0, Math.min(1, 1 - edgeDistance / edgeRange));
      element.style.setProperty("--glow-x", `${x}px`);
      element.style.setProperty("--glow-y", `${y}px`);
      element.style.setProperty("--glow-edge", edgeStrength.toFixed(3));
      element.style.setProperty("--glow-halo-strength", `${18 + edgeStrength * 27}%`);
      element.style.setProperty("--glow-border-strength", `${18 + edgeStrength * 48}%`);
      element.style.setProperty("--glow-fill-strength", `${4 + edgeStrength * 12}%`);
    });
  }

  function clearPointer(event: PointerEvent<HTMLDivElement>) {
    onPointerLeave?.(event);
    pointerRef.current = null;
    surfaceRef.current?.style.setProperty("--glow-edge", "0");
    surfaceRef.current?.style.setProperty("--glow-halo-strength", "18%");
    surfaceRef.current?.style.setProperty("--glow-border-strength", "18%");
    surfaceRef.current?.style.setProperty("--glow-fill-strength", "4%");
  }

  return (
    <div
      ref={surfaceRef}
      className={cx("glow-surface", active && "is-glow-active", active && breathe && "is-glow-breathing", className)}
      data-glow-tone={tone}
      onPointerMove={updatePointer}
      onPointerLeave={clearPointer}
      {...props}
    >
      {children}
    </div>
  );
}
