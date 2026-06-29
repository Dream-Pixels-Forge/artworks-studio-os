/**
 * Directory icons (inline SVG, no icon library).
 *
 * One glyph per ProductionDirectory plus generic folder/file. Kept as line
 * icons at 16px to match the design language.
 */
import type { ProductionDirectory } from "@shared/production/index.js";

export function DirectoryIcon({ type }: { type?: ProductionDirectory }) {
  switch (type) {
    case "docs":
      return <Glyph path="M4 4h6l2 2h6v12H4z" />;
    case "assets":
      return <Glyph path="M21 19V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2zM8.5 13.5l2.5 3 3.5-4.5 4.5 6H5z" />;
    case "prompts":
      return <Glyph path="M12 2l1.5 5L19 8.5 13.5 10 12 15l-1.5-5L5 8.5 10.5 7z" />;
    case "storyboards":
      return <Glyph path="M3 5h18v12H3zM3 19h18" />;
    case "keyframes":
      return <Glyph path="M12 2l3 7h7l-5.5 4 2 7L12 16l-6.5 4 2-7L2 9h7z" />;
    case "renders":
      return <Glyph path="M2 4h20v14H2zM8 21h8" />;
    case "audio":
      return <Glyph path="M3 10v4h4l5 5V5L7 10zM16 8a5 5 0 0 1 0 8" />;
    case "exports":
      return <Glyph path="M12 3v12m0 0l-4-4m4 4l4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />;
    case "automation":
      return <Glyph path="M12 2a3 3 0 0 0-3 3c0 1.3.8 2.4 2 2.8V12l-4 4h10l-4-4V7.8c1.2-.4 2-1.5 2-2.8a3 3 0 0 0-3-3z" />;
    default:
      return <Glyph path="M3 5h6l2 2h10v12H3z" />;
  }
}

export function FileIcon() {
  return <Glyph path="M6 2h8l4 4v16H6zM14 2v4h4" />;
}

function Glyph({ path }: { path: string }) {
  return (
    <svg
      className="project-explorer__icon"
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d={path} />
    </svg>
  );
}
