/**
 * Production domain types.
 *
 * Production lifecycle stages, the canonical capability directories a
 * production contains, and identifier prefixes. These mirror the `aw` CLI's
 * conventions so both sides agree on production structure.
 */

export const PRODUCTION_DIRECTORIES = [
  "docs",
  "assets",
  "prompts",
  "storyboards",
  "keyframes",
  "renders",
  "audio",
  "exports",
  "automation",
] as const;

export type ProductionDirectory = (typeof PRODUCTION_DIRECTORIES)[number];

/** Identifier prefixes per the specification.md identifier system. */
export const ID_PREFIXES = {
  character: "CHR",
  scene: "SCN",
  shot: "SHOT",
  prop: "PROP",
  environment: "ENV",
  document: "DOC",
  prompt: "PROMPT",
  image: "IMG",
  video: "VID",
} as const;

export type ProductionStage =
  | "development"
  | "preproduction"
  | "production"
  | "post"
  | "publishing";

export const PRODUCTION_STAGES: readonly ProductionStage[] = [
  "development",
  "preproduction",
  "production",
  "post",
  "publishing",
] as const;
