/**
 * Command palette modal.
 *
 * A fixed-position overlay: text input, ranked results, keyboard nav. All
 * keyboard handling lives on the input (ArrowUp/Down/Enter/Esc) so the
 * caret is never lost. Styled entirely with design tokens.
 */
import { useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import type { PaletteCommand } from "@shared/palette/command.js";
import { commandRegistry } from "./registry.js";
import { scoreCommand } from "./scorer.js";
import { recencyWeight } from "./recency.js";

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  onRun: (id: string) => void;
}

export function CommandPalette({ open, onClose, onRun }: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [, forceRender] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Re-render when the registry changes.
  useEffect(() => commandRegistry.subscribe(() => forceRender((n) => n + 1)), []);

  // Focus the input on open, reset state on close.
  useEffect(() => {
    if (open) {
      setQuery("");
      setActiveIndex(0);
      // Defer focus until the overlay mounts.
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  const ranked = useMemo<PaletteCommand[]>(() => {
    const commands = commandRegistry.list();
    const scored = commands
      .map((cmd) => ({ cmd, score: scoreCommand(cmd, query, recencyWeight(cmd.id)) }))
      .filter((s): s is { cmd: PaletteCommand; score: number } => s.score !== null)
      .sort((a, b) => b.score - a.score || a.cmd.title.localeCompare(b.cmd.title));
    return scored.map((s) => s.cmd);
  }, [query]);

  // Clamp active index when results change.
  useEffect(() => {
    setActiveIndex((i) => Math.min(i, Math.max(0, ranked.length - 1)));
  }, [ranked.length]);

  if (!open) return null;

  const onKeyDown = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => (ranked.length === 0 ? 0 : (i + 1) % ranked.length));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => (ranked.length === 0 ? 0 : (i - 1 + ranked.length) % ranked.length));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const active = ranked[activeIndex];
      if (active) onRun(active.id);
    } else if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    }
  };

  return (
    <div className="command-palette__overlay" onClick={onClose} role="presentation">
      <div
        className="command-palette__panel"
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        onClick={(e) => e.stopPropagation()}
      >
        <input
          ref={inputRef}
          className="command-palette__input"
          type="text"
          placeholder="Type a command or search…"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActiveIndex(0);
          }}
          onKeyDown={onKeyDown}
          role="combobox"
          aria-expanded={ranked.length > 0}
          aria-controls="command-palette-list"
          aria-activedescendant={ranked[activeIndex]?.id}
        />
        <ul className="command-palette__list" id="command-palette-list" role="listbox">
          {ranked.map((cmd, i) => (
            <li
              key={cmd.id}
              id={cmd.id}
              className={`command-palette__item${i === activeIndex ? " command-palette__item--active" : ""}`}
              role="option"
              aria-selected={i === activeIndex}
              onClick={() => onRun(cmd.id)}
              onMouseEnter={() => setActiveIndex(i)}
            >
              <span className="command-palette__title">{cmd.title}</span>
              {cmd.category && (
                <span className="command-palette__category">{cmd.category}</span>
              )}
            </li>
          ))}
          {ranked.length === 0 && (
            <li className="command-palette__empty">No matching commands</li>
          )}
        </ul>
      </div>
    </div>
  );
}
