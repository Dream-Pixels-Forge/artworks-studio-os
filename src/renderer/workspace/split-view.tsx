/**
 * SplitView — a row or column of panes separated by draggable splitters.
 *
 * The docking framework's resize primitive (#6). Renders `children` along a
 * `direction` with a thin grabber between each adjacent pair. Dragging a
 * grabber updates the `sizes` array (normalized fractions) via `onResize`.
 *
 * Pure presentation + pointer handling; all layout logic lives in the
 * reducer/state modules. Uses native pointer events (no DnD library).
 */
import { useCallback, useLayoutEffect, useRef, type ReactNode, type PointerEvent as ReactPointerEvent } from "react";
import type { SplitDirection } from "./types.js";

export interface SplitViewProps {
  /** Layout direction of the children. */
  direction: SplitDirection;
  /** Normalized sizes in (0,1), one per child. */
  sizes: number[];
  /** Called with the updated sizes when a splitter is dragged. */
  onResize: (sizes: number[]) => void;
  children: ReactNode[];
}

const MIN = 0.05;

export function SplitView({ direction, sizes, onResize, children }: SplitViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Keep each pane's flex-basis in sync with `sizes` imperatively so dragging
  // is smooth (avoids a re-render per pointermove).
  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const panes = Array.from(el.children).filter((c) => c.classList.contains("split-view__pane")) as HTMLElement[];
    panes.forEach((pane, i) => {
      pane.style.flexBasis = `${(sizes[i] ?? 1 / children.length) * 100}%`;
    });
  }, [sizes, children.length]);

  const startDrag = useCallback(
    (index: number) => (e: ReactPointerEvent<HTMLDivElement>) => {
      e.preventDefault();
      const container = containerRef.current;
      if (!container) return;
      const panes = Array.from(container.children).filter((c) => c.classList.contains("split-view__pane")) as HTMLElement[];
      if (panes.length < 2) return;

      const isRow = direction === "row";
      const containerSize = isRow ? container.getBoundingClientRect().width : container.getBoundingClientRect().height;
      if (containerSize <= 0) return;

      const startX = e.clientX;
      const startY = e.clientY;
      const startSizes = sizes.slice();
      // Only the two adjacent panes flanking this splitter move together.
      const a = index;
      const b = index + 1;
      const pairTotal = (startSizes[a] ?? 0) + (startSizes[b] ?? 0);

      const move = (ev: PointerEvent) => {
        const deltaPx = isRow ? ev.clientX - startX : ev.clientY - startY;
        let delta = deltaPx / containerSize;
        const newA = (startSizes[a] ?? 0) + delta;
        const newB = (startSizes[b] ?? 0) - delta;
        // Clamp both sides to the minimum.
        if (newA < MIN) delta -= MIN - newA;
        if (newB < MIN) delta += MIN - newB;
        const clampedA = (startSizes[a] ?? 0) + delta;
        const clampedB = pairTotal - clampedA;
        const next = startSizes.slice();
        next[a] = Math.max(MIN, clampedA);
        next[b] = Math.max(MIN, clampedB);
        onResize(next);
      };
      const up = () => {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
        document.body.style.userSelect = "";
        document.body.style.cursor = "";
      };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
      document.body.style.userSelect = "none";
      document.body.style.cursor = isRow ? "col-resize" : "row-resize";
    },
    [direction, sizes, onResize],
  );

  const isRow = direction === "row";
  const nodes: ReactNode[] = [];
  children.forEach((child, i) => {
    nodes.push(
      <div key={`pane-${i}`} className="split-view__pane" role="group" style={{ flexBasis: `${(sizes[i] ?? 1 / children.length) * 100}%` }}>
        {child}
      </div>,
    );
    if (i < children.length - 1) {
      nodes.push(
        <div
          key={`split-${i}`}
          className={`split-view__handle ${isRow ? "split-view__handle--col" : "split-view__handle--row"}`}
          role="separator"
          aria-orientation={isRow ? "vertical" : "horizontal"}
          onPointerDown={startDrag(i)}
        />,
      );
    }
  });

  return (
    <div ref={containerRef} className={`split-view ${isRow ? "split-view--row" : "split-view--column"}`}>
      {nodes}
    </div>
  );
}
