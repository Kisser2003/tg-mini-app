/** Сегмент URL после бакета `audio`: `storage/v1/object/public/audio/...` (см. public/sw-audio.js). Треки — bucket `releases`. */
export function getReleaseAudioPath(userId: number, releaseId: string): string {
  return `${userId}/${releaseId}/audio.wav`;
}

export function getReleaseArtworkPath(userId: number, releaseId: string, ext = "jpg"): string {
  return `${userId}/${releaseId}/cover.${ext}`;
}

export function getReleaseTrackAudioPath(
  userId: number,
  releaseId: string,
  trackIndex: number
): string {
  return `${userId}/${releaseId}/tracks/${trackIndex}.wav`;
}

