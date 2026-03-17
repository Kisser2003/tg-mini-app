import { supabase } from "../lib/supabase";

export type ReleaseStatus = "draft" | "submitted" | "error";

export type ReleaseStep1Payload = {
  user_id: number;
  artist_name: string;
  track_name: string;
  release_type: "single" | "ep" | "album";
  main_genre: string;
  release_date: string;
  right_holder: string;
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
  artist_name: string;
  track_name: string;
  release_type: string;
  main_genre: string;
  release_date: string;
  right_holder: string;
  explicit: boolean;
  audio_url: string | null;
  artwork_url: string | null;
  status: ReleaseStatus;
  created_at: string;
} & ReleaseStep2Payload;

export async function createDraftRelease(
  payload: ReleaseStep1Payload
): Promise<ReleaseRecord> {
  const { data, error } = await supabase
    .from("releases")
    .insert({
      ...payload,
      status: "draft" as ReleaseStatus
    })
    .select("*")
    .single();

  if (error || !data) {
    throw error ?? new Error("Failed to create draft release");
  }

  return data as ReleaseRecord;
}

export async function updateRelease(
  id: string,
  payload: Partial<ReleaseStep1Payload & ReleaseStep2Payload> & {
    audio_url?: string | null;
    artwork_url?: string | null;
  }
): Promise<ReleaseRecord> {
  const { data, error } = await supabase
    .from("releases")
    .update(payload)
    .eq("id", id)
    .select("*")
    .single();

  if (error || !data) {
    throw error ?? new Error("Failed to update release");
  }

  return data as ReleaseRecord;
}

export async function submitRelease(id: string): Promise<ReleaseRecord> {
  const { data, error } = await supabase
    .from("releases")
    .update({ status: "submitted" satisfies ReleaseStatus })
    .eq("id", id)
    .select("*")
    .single();

  if (error || !data) {
    throw error ?? new Error("Failed to submit release");
  }

  return data as ReleaseRecord;
}

export async function uploadReleaseAudio(params: {
  userId: number;
  releaseId: string;
  file: File;
}): Promise<string> {
  const path = `${params.userId}/${params.releaseId}/audio.wav`;

  const { error } = await supabase.storage
    .from("audio")
    .upload(path, params.file, { upsert: true });

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
  const path = `${params.userId}/${params.releaseId}/cover.jpg`;

  const { error } = await supabase.storage
    .from("artwork")
    .upload(path, params.file, { upsert: true });

  if (error) {
    throw error;
  }

  const {
    data: { publicUrl }
  } = supabase.storage.from("artwork").getPublicUrl(path);

  return publicUrl;
}

