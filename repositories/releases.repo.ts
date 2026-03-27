/**
 * Barrel re-export for backward compatibility.
 * Domain modules:
 *   repositories/releases/types.ts   — types, constants, helpers
 *   repositories/releases/queries.ts — Supabase DB operations
 *   repositories/releases/tracks.ts  — tracks table operations
 *   repositories/releases/uploads.ts — Storage upload operations
 */
export * from "./releases/index";
