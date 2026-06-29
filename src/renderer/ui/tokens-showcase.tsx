/**
 * Tokens showcase.
 *
 * A dev-only reference rendering of every design token, so the design
 * system is visible and verifiable. Not a business component — used during
 * development and design review to confirm tokens render as intended.
 */
import { getTokens, themes, DEFAULT_THEME, type ThemeName } from "./tokens/index.js";

const SWATCH_TOKENS = [
  "--color-bg",
  "--color-bg-elevated",
  "--color-surface",
  "--color-surface-muted",
  "--color-text",
  "--color-text-muted",
  "--color-border",
  "--color-accent",
  "--color-accent-hover",
  "--color-accent-pressed",
  "--color-success",
  "--color-info",
  "--color-warning",
  "--color-danger",
] as const;

const SCALE_TOKENS = [
  "--space-1",
  "--space-2",
  "--space-3",
  "--space-4",
  "--space-6",
  "--space-8",
  "--space-12",
] as const;

export interface TokensShowcaseProps {
  theme?: ThemeName;
}

export function TokensShowcase({ theme = DEFAULT_THEME }: TokensShowcaseProps) {
  const tokens = getTokens(theme);
  const themeLabel = themes[theme].label;

  return (
    <div className="tokens-showcase" data-theme={theme}>
      <h2>Tokens · {themeLabel}</h2>

      <section>
        <h3>Colors</h3>
        <div className="tokens-showcase__swatches">
          {SWATCH_TOKENS.map((token) => (
            <Swatch key={token} token={token} value={tokens[token] ?? "—"} />
          ))}
        </div>
      </section>

      <section>
        <h3>Spacing</h3>
        <div className="tokens-showcase__scale">
          {SCALE_TOKENS.map((token) => (
            <div key={token} className="tokens-showcase__scale-item">
              <span className="tokens-showcase__scale-bar" />
              <code>{token}</code>
              <span>{tokens[token]}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function Swatch({ token, value }: { token: string; value: string }) {
  return (
    <div className="tokens-showcase__swatch">
      <span
        className="tokens-showcase__chip"
        style={{ backgroundColor: value }}
        aria-hidden
      />
      <code>{token}</code>
      <span>{value}</span>
    </div>
  );
}
