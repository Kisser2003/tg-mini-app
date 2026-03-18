export function getReleaseAudioPath(userId: number, releaseId: string): string {
  return `${userId}/${releaseId}/audio.wav`;
}

export function getReleaseArtworkPath(userId: number, releaseId: string): string {
  return `${userId}/${releaseId}/cover.jpg`;
}

export function getReleaseTrackAudioPath(
  userId: number,
  releaseId: string,
  trackIndex: number
): string {
  return `${userId}/${releaseId}/tracks/${trackIndex}.wav`;
}

