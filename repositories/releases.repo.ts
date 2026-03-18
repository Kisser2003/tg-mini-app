import { z } from "zod";
import { supabase } from "../lib/supabase";
import {
  RELEASE_STATUS_VALUES,
  RELEASE_TYPE_VALUES,
  type ReleaseStatus,
  type ReleaseType
} from "../lib/db-enums";
import {
  getReleaseAudioPath,
  getReleaseArtworkPath,
  getReleaseTrackAudioPath
} from "../lib/storagePaths";

const releaseStatusSchema = z.enum(RELEASE_STATUS_VALUES);
export type { ReleaseStatus };

export type ReleaseStep1Payload = {
  user_id: number;
  client_request_id: string;
  artist_name: string;
  track_name: string;
  release_type: ReleaseType;
  genre: string;
  release_date: string;
  explicit: boolean;
};

export type ReleaseStep2Payload = {
  isrc?: string | null;
  authors?: string | null;
  splits?: string | null;
};

export type ReleaseRecord = {
  id: string;
  user_id: number;
  client_request_id: string;
  artist_name: string;
  track_name: string;
  release_type: ReleaseType;
  genre: string;
  release_date: string;
  explicit: boolean;
  audio_url: string | null;
  artwork_url: string | null;
  status: ReleaseStatus;
  created_at: string;
  error_message?: string | null;
} & ReleaseStep2Payload;

const releaseStep1Schema = z.object({
  user_id: z.number().int().nonnegative(),
  client_request_id: z.string().uuid(),
  artist_name: z.string().min(1).max(256).trim(),
  track_name: z.string().min(1).max(256).trim(),
  release_type: z.enum(RELEASE_TYPE_VALUES),
  genre: z.string().min(1).max(128).trim(),
  release_date: z.string().min(1),
  explicit: z.boolean()
});

const releaseStep2Schema = z.object({
  isrc: z
    .string()
    .max(15)
    .trim()
    .optional()
    .nullable(),
  authors: z
    .string()
    .max(512)
    .trim()
    .optional()
    .nullable(),
  splits: z
    .string()
    .max(512)
    .trim()
    .optional()
    .nullable()
});

const trackInsertSchema = z.object({
  releaseId: z.string().min(1),
  index: z.number().int().nonnegative(),
  title: z.string().min(1).max(256).trim(),
  explicit: z.boolean(),
  audioUrl: z.string().url()
});

type NetworkFn = () => Promise<any>;

async function withRetry(
  fn: NetworkFn,
  retries = 2,
  baseDelayMs = 200
): Promise<any> {
  let attempt = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      return await fn();
    } catch (error) {
      if (attempt >= retries) {
        throw error;
      }
      const delay = baseDelayMs * 2 ** attempt;
      await new Promise((resolve) => setTimeout(resolve, delay));
      attempt += 1;
    }
  }
}

async function logReleaseEvent(params: {
  releaseId: string;
  stage: "create" | "upload" | "finalize" | "status" | "error";
  status: ReleaseStatus;
  errorMessage?: string | null;
}) {
  await withRetry(async () => {
    const { error } = await supabase.from("release_logs").insert({
      release_id: params.releaseId,
      stage: params.stage,
      status: params.status,
      error_message: params.errorMessage ?? null
    });

    if (error) {
      throw error;
    }

    return null;
  });
}

export async function createDraftRelease(
  payload: ReleaseStep1Payload
): Promise<ReleaseRecord> {
  const validated = releaseStep1Schema.parse(payload);

  const { data, error } = await withRetry(async () => {
    const response = await supabase
      .from("releases")
      .upsert(
        {
          ...validated,
          status: "draft" as ReleaseStatus
        },
        { onConflict: "client_request_id" }
      )
      .select("*");
    return response;
  });

  if (error) {
    throw error;
  }

  const rows = data as ReleaseRecord[] | null;
  if (!rows || rows.length === 0) {
    throw new Error("Upsert вернул 0 строк — проверьте RLS-политики таблицы releases");
  }

  const record = rows[0];
  await logReleaseEvent({
    releaseId: record.id,
    stage: "create",
    status: record.status
  }).catch(() => {});

  return record;
}

export async function updateRelease(
  id: string,
  payload: Partial<ReleaseStep1Payload & ReleaseStep2Payload> & {
    audio_url?: string | null;
    artwork_url?: string | null;
    status?: ReleaseStatus;
    error_message?: string | null;
  }
): Promise<ReleaseRecord> {
  const base: Partial<ReleaseStep1Payload & ReleaseStep2Payload> = {};

  if (payload.artist_name !== undefined) base.artist_name = payload.artist_name;
  if (payload.track_name !== undefined) base.track_name = payload.track_name;
  if (payload.release_type !== undefined) base.release_type = payload.release_type;
  if (payload.genre !== undefined) base.genre = payload.genre;
  if (payload.release_date !== undefined) base.release_date = payload.release_date;
  if (payload.explicit !== undefined) base.explicit = payload.explicit;
  if (payload.isrc !== undefined) base.isrc = payload.isrc;
  if (payload.authors !== undefined) base.authors = payload.authors;
  if (payload.splits !== undefined) base.splits = payload.splits;
  if (payload.status !== undefined) {
    releaseStatusSchema.parse(payload.status);
  }

  if (Object.keys(base).length > 0) {
    releaseStep1Schema
      .omit({ client_request_id: true, user_id: true })
      .partial()
      .parse(base);
    releaseStep2Schema.partial().parse(base);
  }

  const { data, error } = await withRetry(async () => {
    const response = await supabase
      .from("releases")
      .update(payload)
      .eq("id", id)
      .select("*");
    return response;
  });

  if (error) {
    throw error;
  }

  const rows = data as ReleaseRecord[] | null;
  if (!rows || rows.length === 0) {
    throw new Error(`Запись релиза не найдена (id: ${id})`);
  }

  const record = rows[0];
  await logReleaseEvent({
    releaseId: record.id,
    stage: "status",
    status: record.status
  }).catch(() => {});

  return record;
}

export async function submitRelease(id: string): Promise<ReleaseRecord> {
  // Try RPC first; fall back to simple status update if the function doesn't exist
  let record: ReleaseRecord;

  const { data: rpcData, error: rpcError } = await withRetry(async () => {
    return await supabase.rpc("finalize_release", { p_release_id: id });
  });

  if (rpcError) {
    const isMissing =
      rpcError.message?.includes("could not find") ||
      rpcError.message?.includes("function") ||
      rpcError.code === "PGRST202";

    if (isMissing) {
      const updated = await updateRelease(id, { status: "processing" as ReleaseStatus });
      record = updated;
    } else {
      await logReleaseEvent({
        releaseId: id,
        stage: "error",
        status: "failed",
        errorMessage: rpcError.message
      }).catch(() => {});
      throw rpcError;
    }
  } else {
    const rows = Array.isArray(rpcData) ? rpcData : rpcData ? [rpcData] : [];
    if (rows.length === 0) {
      const updated = await updateRelease(id, { status: "processing" as ReleaseStatus });
      record = updated;
    } else {
      record = rows[0] as ReleaseRecord;
    }
  }

  await logReleaseEvent({
    releaseId: record.id,
    stage: "finalize",
    status: record.status
  }).catch(() => {});

  return record;
}

function assertAudioFile(file: File, maxSizeMb: number) {
  const sizeMb = file.size / (1024 * 1024);
  if (sizeMb > maxSizeMb) {
    throw new Error(`Audio file is too large. Max ${maxSizeMb}MB allowed.`);
  }
  if (!file.type.includes("wav") && !file.name.toLowerCase().endsWith(".wav")) {
    throw new Error("Only WAV audio is allowed.");
  }
}

function assertArtworkFile(file: File, maxSizeMb: number) {
  const sizeMb = file.size / (1024 * 1024);
  if (sizeMb > maxSizeMb) {
    throw new Error(`Artwork file is too large. Max ${maxSizeMb}MB allowed.`);
  }
  if (!["image/jpeg", "image/jpg", "image/png"].includes(file.type)) {
    throw new Error("Artwork must be JPG or PNG.");
  }
}

export async function uploadReleaseAudio(params: {
  userId: number;
  releaseId: string;
  file: File;
}): Promise<string> {
  assertAudioFile(params.file, 200);
  const path = getReleaseAudioPath(params.userId, params.releaseId);

  const { error } = await withRetry(async () => {
    const response = await supabase.storage
      .from("audio")
      .upload(path, params.file, { upsert: true });
    return response;
  });

  if (error) {
    throw error;
  }

  const {
    data: { publicUrl }
  } = supabase.storage.from("audio").getPublicUrl(path);

  return publicUrl;
}

export async function uploadReleaseArtwork(params: {
  userId: number;
  releaseId: string;
  file: File;
}): Promise<string> {
  assertArtworkFile(params.file, 20);

  const ext = params.file.type === "image/png" ? "png" : "jpg";
  const path = getReleaseArtworkPath(params.userId, params.releaseId, ext);

  const { error } = await withRetry(async () => {
    const response = await supabase.storage
      .from("artwork")
      .upload(path, params.file, {
        upsert: true,
        contentType: params.file.type
      });
    return response;
  });

  if (error) {
    console.error("[uploadReleaseArtwork] Supabase Storage error:", {
      message: error.message,
      name: (error as any).name,
      statusCode: (error as any).statusCode,
      error: JSON.stringify(error)
    });
    throw new Error(`Ошибка загрузки обложки: ${error.message}`);
  }

  const {
    data: { publicUrl }
  } = supabase.storage.from("artwork").getPublicUrl(path);

  return publicUrl;
}

export async function uploadReleaseTrackAudio(params: {
  userId: number;
  releaseId: string;
  trackIndex: number;
  file: File;
}): Promise<string> {
  assertAudioFile(params.file, 200);
  const path = getReleaseTrackAudioPath(params.userId, params.releaseId, params.trackIndex);

  const { error } = await withRetry(async () => {
    const response = await supabase.storage
      .from("audio")
      .upload(path, params.file, { upsert: true });
    return response;
  });

  if (error) {
    throw error;
  }

  const {
    data: { publicUrl }
  } = supabase.storage.from("audio").getPublicUrl(path);

  return publicUrl;
}

export async function addReleaseTrack(params: {
  releaseId: string;
  index: number;
  title: string;
  explicit: boolean;
  audioUrl: string;
}): Promise<void> {
  const validated = trackInsertSchema.parse(params);

  const { error } = await withRetry(async () => {
    const response = await supabase
      .from("release_tracks")
      .upsert(
        {
          release_id: validated.releaseId,
          index: validated.index,
          title: validated.title,
          explicit: validated.explicit,
          audio_url: validated.audioUrl
        },
        { onConflict: "release_id,index" }
      );
    return response;
  });

  if (error) {
    throw error;
  }
}

export async function deleteReleaseFiles(params: {
  userId: number;
  releaseId: string;
  trackCount?: number;
}): Promise<void> {
  const audioBucket = supabase.storage.from("audio");
  const artworkBucket = supabase.storage.from("artwork");

  const audioPaths: string[] = [getReleaseAudioPath(params.userId, params.releaseId)];
  if (params.trackCount && params.trackCount > 0) {
    for (let i = 0; i < params.trackCount; i += 1) {
      audioPaths.push(getReleaseTrackAudioPath(params.userId, params.releaseId, i));
    }
  }

  await Promise.all([
    withRetry(async () => {
      const response = await audioBucket.remove(audioPaths);
      return response;
    }),
    withRetry(async () => {
      const response = await artworkBucket.remove([
        getReleaseArtworkPath(params.userId, params.releaseId)
      ]);
      return response;
    })
  ]);
}

export async function cleanupReleaseTracks(releaseId: string): Promise<void> {
  await withRetry(async () => {
    const response = await supabase
      .from("release_tracks")
      .delete()
      .eq("release_id", releaseId);
    return response;
  });
}

export async function getReleaseById(id: string): Promise<ReleaseRecord> {
  const { data, error } = await withRetry(async () => {
    const response = await supabase
      .from("releases")
      .select("*")
      .eq("id", id)
      .single();
    return response;
  });

  if (error || !data) {
    throw error ?? new Error("Failed to load release");
  }

  return data as ReleaseRecord;
}


