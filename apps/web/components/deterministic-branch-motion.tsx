"use client";

import { useLayoutEffect, useRef, type ReactNode } from "react";

const MEANINGFUL_VISIBILITY_THRESHOLD = 0.35;
const MEANINGFUL_VISIBILITY_ROOT_MARGIN = "0px 0px -10% 0px";

export function DeterministicBranchMotion({ children }: { children: ReactNode }) {
  const branchRef = useRef<HTMLDivElement>(null);
  const activatedRef = useRef(false);

  useLayoutEffect(() => {
    const branch = branchRef.current;
    if (
      !branch ||
      !("IntersectionObserver" in window) ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) return;

    branch.classList.add("flow--motion-armed");

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting || activatedRef.current) return;

        activatedRef.current = true;
        branch.classList.replace("flow--motion-armed", "flow--motion-active");
        observer.disconnect();
      },
      {
        threshold: MEANINGFUL_VISIBILITY_THRESHOLD,
        rootMargin: MEANINGFUL_VISIBILITY_ROOT_MARGIN,
      },
    );

    observer.observe(branch);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={branchRef} className="flow flow--deterministic" aria-label="Marketplace settlement flow">
      {children}
    </div>
  );
}