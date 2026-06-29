/**
 * Palette command contract.
 *
 * Mirrors the SDK's PluginCommand shape so built-in and plugin commands are
 * uniform. The palette renders these; `run()` is the seam where a command
 * either does renderer work directly or calls a main-process channel.
 */
export interface PaletteCommand {
  /** Unique id, e.g. "theme.toggle-dark". */
  readonly id: string;
  /** Human-readable title for the palette list. */
  readonly title: string;
  /** Optional grouping label, e.g. "Theme", "Navigation". */
  readonly category?: string;
  /** Extra keywords to match against (lowercased). */
  readonly keywords?: readonly string[];
  /** Execute the command. */
  run(): void | Promise<void>;
}
