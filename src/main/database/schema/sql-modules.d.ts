/**
 * Ambient declarations for Vite's `?raw` imports.
 *
 * `migrations.ts` inlines SQL schema files at build time via
 * `import v from "./schema/vN.sql?raw"`. Vite resolves these to the file's
 * string contents, but `tsc` needs to be told the module shape so
 * `pnpm typecheck` stays green. The build (electron-vite) ignores this
 * file — it understands `?raw` natively.
 */
declare module "*.sql?raw" {
  const content: string;
  export default content;
}
