import type { z } from "zod";
import type { metadataSchema, tracksSchema } from "./schemas";

export type CreateMetadata = z.input<typeof metadataSchema>;

export type CreateTrack = z.input<typeof tracksSchema>["tracks"][number];

export type CreateTracks = z.input<typeof tracksSchema>;

export type CreateStep = "metadata" | "assets" | "tracks" | "review" | "success";

export type SubmissionStatus = "idle" | "submitting" | "success" | "error";

export type CreateReleaseSuccessSummary = {
  artistName: string;
  trackName: string;
};

