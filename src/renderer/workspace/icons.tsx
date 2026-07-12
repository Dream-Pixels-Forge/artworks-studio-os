/**
 * Centralized SVG icon library for panel icons.
 *
 * All icons are 16x16 line icons matching the design language.
 * Replaces emoji usage across the application.
 */
import type { ComponentType, ReactNode } from "react";

interface IconProps {
  className?: string;
  size?: number;
}

function Glyph({ path, className, size = 16 }: { path: string } & IconProps): ReactNode {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      width={size}
      height={size}
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

// --- Panel Icons ---

/** Project Explorer / Film clapperboard icon */
export function ProjectExplorerIcon({ className, size }: IconProps): ReactNode {
  return (
    <Glyph
      className={className}
      size={size}
      path="M4 4h16v12H4zM4 4l8 6 8-6M4 16h16v2H4z"
    />
  );
}

/** Welcome / Sparkle icon */
export function WelcomeIcon({ className, size }: IconProps): ReactNode {
  return (
    <Glyph
      className={className}
      size={size}
      path="M12 2l2 6 6 2-6 2-2 6-2-6-6-2 6-2z"
    />
  );
}

/** Export / Download icon */
export function ExportIcon({ className, size }: IconProps): ReactNode {
  return (
    <Glyph
      className={className}
      size={size}
      path="M12 3v12m0 0l-4-4m4 4l4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"
    />
  );
}

/** Dashboard / Bar chart icon */
export function DashboardIcon({ className, size }: IconProps): ReactNode {
  return (
    <Glyph
      className={className}
      size={size}
      path="M4 20h16M4 20V10m4 10V14m4 6V8m4 12V12m4 8V6"
    />
  );
}

/** Project Manager / Folder icon */
export function ProjectManagerIcon({ className, size }: IconProps): ReactNode {
  return (
    <Glyph
      className={className}
      size={size}
      path="M3 5h6l2 2h10v12H3z"
    />
  );
}

/** Asset Browser / Image icon */
export function AssetBrowserIcon({ className, size }: IconProps): ReactNode {
  return (
    <Glyph
      className={className}
      size={size}
      path="M21 19V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2zM8.5 13.5l2.5 3 3.5-4.5 4.5 6H5z"
    />
  );
}

/** Markdown Editor / Document icon */
export function MarkdownEditorIcon({ className, size }: IconProps): ReactNode {
  return (
    <Glyph
      className={className}
      size={size}
      path="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M8 13h8M8 17h5"
    />
  );
}

/** Search / Magnifying glass icon */
export function SearchIcon({ className, size }: IconProps): ReactNode {
  return (
    <Glyph
      className={className}
      size={size}
      path="M11 3a8 8 0 1 0 0 16 8 8 0 0 0 0-16zM21 21l-4.35-4.35"
    />
  );
}

/** Knowledge Graph / Network icon */
export function KnowledgeGraphIcon({ className, size }: IconProps): ReactNode {
  return (
    <Glyph
      className={className}
      size={size}
      path="M12 2a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM6 18a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM18 18a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM8.59 13.51l6.83 3.98M15.41 6.51l-6.82 3.98"
    />
  );
}

/** Version History / History icon */
export function VersionHistoryIcon({ className, size }: IconProps): ReactNode {
  return (
    <Glyph
      className={className}
      size={size}
      path="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8M3 3v5h5M12 7v5l4 2"
    />
  );
}

/** AI Chat / Message icon */
export function AiChatIcon({ className, size }: IconProps): ReactNode {
  return (
    <Glyph
      className={className}
      size={size}
      path="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"
    />
  );
}

/** Story Bible / Book icon */
export function StoryBibleIcon({ className, size }: IconProps): ReactNode {
  return (
    <Glyph
      className={className}
      size={size}
      path="M4 19.5A2.5 2.5 0 0 1 6.5 17H20M4 19.5A2.5 2.5 0 0 0 6.5 22H20V2H6.5A2.5 2.5 0 0 0 4 4.5z"
    />
  );
}

/** Prompt Composer / Terminal icon */
export function PromptComposerIcon({ className, size }: IconProps): ReactNode {
  return (
    <Glyph
      className={className}
      size={size}
      path="M4 17l6-5-6-5M12 19h8"
    />
  );
}

/** Workflow Builder / Git branch icon */
export function WorkflowBuilderIcon({ className, size }: IconProps): ReactNode {
  return (
    <Glyph
      className={className}
      size={size}
      path="M6 3v12M18 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM6 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM18 9a9 9 0 0 1-9 9"
    />
  );
}

/** Plugin Manager / Puzzle icon */
export function PluginManagerIcon({ className, size }: IconProps): ReactNode {
  return (
    <Glyph
      className={className}
      size={size}
      path="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"
    />
  );
}

/** Timeline / Calendar icon */
export function TimelineIcon({ className, size }: IconProps): ReactNode {
  return (
    <Glyph
      className={className}
      size={size}
      path="M3 5h18v16H3zM3 9h18M8 3v4M16 3v4"
    />
  );
}

/** Collaboration / Users icon */
export function CollaborationIcon({ className, size }: IconProps): ReactNode {
  return (
    <Glyph
      className={className}
      size={size}
      path="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"
    />
  );
}

/** Studio / Clapperboard icon */
export function StudioIcon({ className, size }: IconProps): ReactNode {
  return (
    <Glyph
      className={className}
      size={size}
      path="M4 11v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8H4zM4 4h16v7H4zM9 4l-2 3M15 4l2 3M9 11h2M13 11h2"
    />
  );
}

/** Agent Teams / Bot icon */
export function AgentTeamsIcon({ className, size }: IconProps): ReactNode {
  return (
    <Glyph
      className={className}
      size={size}
      path="M12 2a4 4 0 0 0-4 4v2h8V6a4 4 0 0 0-4-4zM4 10h16v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-8zM9 18h6M12 14v4"
    />
  );
}

/** Node Production / Layers icon */
export function NodeProductionIcon({ className, size }: IconProps): ReactNode {
  return (
    <Glyph
      className={className}
      size={size}
      path="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"
    />
  );
}

/** Marketplace / Shopping bag icon */
export function MarketplaceIcon({ className, size }: IconProps): ReactNode {
  return (
    <Glyph
      className={className}
      size={size}
      path="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4zM3 6h18M16 10a4 4 0 0 1-8 0"
    />
  );
}

/** Enterprise / Building icon */
export function EnterpriseIcon({ className, size }: IconProps): ReactNode {
  return (
    <Glyph
      className={className}
      size={size}
      path="M3 21h18M5 21V7l8-4v18M13 21V3l6 4v14M9 9h.01M9 13h.01M9 17h.01"
    />
  );
}

/** Production Intelligence / Activity icon */
export function ProductionIntelligenceIcon({ className, size }: IconProps): ReactNode {
  return (
    <Glyph
      className={className}
      size={size}
      path="M22 12h-4l-3 9L9 3l-3 9H2"
    />
  );
}

/** Lifecycle / Refresh icon */
export function LifecycleIcon({ className, size }: IconProps): ReactNode {
  return (
    <Glyph
      className={className}
      size={size}
      path="M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"
    />
  );
}

/** Notification Center / Bell icon */
export function NotificationCenterIcon({ className, size }: IconProps): ReactNode {
  return (
    <Glyph
      className={className}
      size={size}
      path="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0"
    />
  );
}

/** Backup Recovery / Shield icon */
export function BackupRecoveryIcon({ className, size }: IconProps): ReactNode {
  return (
    <Glyph
      className={className}
      size={size}
      path="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"
    />
  );
}

/** Preferences / Settings icon */
export function PreferencesIcon({ className, size }: IconProps): ReactNode {
  return (
    <Glyph
      className={className}
      size={size}
      path="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"
    />
  );
}

// --- Icon Registry ---

/** Map of panel IDs to their icon components. */
export const PANEL_ICONS: Record<string, ComponentType<IconProps>> = {
  "project-explorer": ProjectExplorerIcon,
  "welcome": WelcomeIcon,
  "export": ExportIcon,
  "dashboard": DashboardIcon,
  "project-manager": ProjectManagerIcon,
  "asset-browser": AssetBrowserIcon,
  "markdown-editor": MarkdownEditorIcon,
  "crdt-markdown-editor": MarkdownEditorIcon,
  "search": SearchIcon,
  "knowledge-graph": KnowledgeGraphIcon,
  "version-history": VersionHistoryIcon,
  "ai-chat": AiChatIcon,
  "story-bible": StoryBibleIcon,
  "prompt-composer": PromptComposerIcon,
  "workflow-builder": WorkflowBuilderIcon,
  "plugin-manager": PluginManagerIcon,
  "timeline": TimelineIcon,
  "collaboration": CollaborationIcon,
  "studio": StudioIcon,
  "agent-teams": AgentTeamsIcon,
  "node-production": NodeProductionIcon,
  "marketplace": MarketplaceIcon,
  "enterprise": EnterpriseIcon,
  "production-intelligence": ProductionIntelligenceIcon,
  "lifecycle": LifecycleIcon,
  "notification-center": NotificationCenterIcon,
  "backup-recovery": BackupRecoveryIcon,
  "preferences": PreferencesIcon,
};

/**
 * Get the icon component for a panel ID.
 * Returns undefined if no icon is registered for the panel.
 */
export function getPanelIcon(panelId: string): ComponentType<IconProps> | undefined {
  return PANEL_ICONS[panelId];
}

/** Props for the {@link PanelIcon} helper component. */
export interface PanelIconProps extends IconProps {
  /** Panel id whose icon to render. */
  panelId: string;
  /** Class applied to the wrapping `<span>` (icon glyph inherits `currentColor`). */
  className?: string;
}

/**
 * Render a panel's icon inside a wrapping `<span>`, or `null` if the panel has
 * no registered icon. Centralizes the lookup + wrapper so call sites stay a
 * single element instead of a duplicated IIFE.
 */
export function PanelIcon({ panelId, className, size }: PanelIconProps): ReactNode {
  const Icon = PANEL_ICONS[panelId];
  if (!Icon) return null;
  return (
    <span className={className} aria-hidden>
      <Icon size={size} />
    </span>
  );
}
