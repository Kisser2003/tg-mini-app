import { useState } from "react";
import {
  uploadReleaseAudio,
  uploadReleaseArtwork
} from "../../../repositories/releases.repo";

type UploadFilesArgs = {
  userId: number;
  releaseId: string;
  audioFile: File;
  artworkFile: File;
};

export function useUploadFiles() {
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const upload = async (args: UploadFilesArgs) => {
    setIsUploading(true);
    setError(null);

    try {
      const [audioUrl, artworkUrl] = await Promise.all([
        uploadReleaseAudio({
          userId: args.userId,
          releaseId: args.releaseId,
          file: args.audioFile,
          options: {
            markReleaseFailedOnError: { releaseId: args.releaseId }
          }
        }),
        uploadReleaseArtwork({
          userId: args.userId,
          releaseId: args.releaseId,
          file: args.artworkFile,
          options: {
            markReleaseFailedOnError: { releaseId: args.releaseId }
          }
        })
      ]);

      return { audioUrl, artworkUrl };
    } catch (e: any) {
      setError(e?.message ?? "Failed to upload files");
      throw e;
    } finally {
      setIsUploading(false);
    }
  };

  return {
    upload,
    isUploading,
    error
  };
}

