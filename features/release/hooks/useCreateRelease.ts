import { useState } from "react";
import {
  ReleaseRecord,
  ReleaseStep1Payload,
  ReleaseStep2Payload,
  cleanupReleaseTracks,
  createDraftRelease,
  createFullRelease,
  deleteReleaseFiles,
  updateRelease,
  uploadReleaseAudio,
  uploadReleaseArtwork
} from "../../../repositories/releases.repo";

type CreateReleaseArgs = {
  step1: ReleaseStep1Payload;
  step2?: ReleaseStep2Payload;
  audioFile: File;
  artworkFile: File;
};

export function useCreateRelease() {
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const create = async (args: CreateReleaseArgs): Promise<ReleaseRecord> => {
    setIsSaving(true);
    setError(null);

    let draft: ReleaseRecord | null = null;

    try {
      // 1. Создаем или переиспользуем draft (идемпотентно по client_request_id)
      draft = await createDraftRelease(args.step1);

      await updateRelease(draft.id, { status: "processing" });

      // 2. Загружаем файлы в storage, используя user_id и id черновика
      const [audioUrl, artworkUrl] = await Promise.all([
        uploadReleaseAudio({
          userId: draft.user_id,
          releaseId: draft.id,
          file: args.audioFile
        }),
        uploadReleaseArtwork({
          userId: draft.user_id,
          releaseId: draft.id,
          file: args.artworkFile
        })
      ]);

      // 3. Завершаем релиз через RPC в одной транзакции (URLs + step2 + статус)
      const full = await createFullRelease({
        releaseId: draft.id,
        audioUrl,
        artworkUrl,
        step2: args.step2
      });

      return full;
    } catch (e: any) {
      if (draft) {
        try {
          await Promise.all([
            updateRelease(draft.id, {
              status: "failed",
              error_message: e?.message ?? "Failed to create release"
            }),
            cleanupReleaseTracks(draft.id),
            deleteReleaseFiles({
              userId: draft.user_id,
              releaseId: draft.id
            })
          ]);
        } catch {
          // best‑effort cleanup
        }
      }
      setError(e?.message ?? "Failed to create release");
      throw e;
    } finally {
      setIsSaving(false);
    }
  };

  return {
    create,
    isSaving,
    error
  };
}
