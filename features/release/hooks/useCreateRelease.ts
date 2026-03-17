import { useState } from "react";
import {
  ReleaseRecord,
  ReleaseStep1Payload,
  ReleaseStep2Payload,
  createDraftRelease,
  submitRelease,
  updateRelease
} from "../../../repositories/releases.repo";

type CreateReleaseArgs = {
  step1: ReleaseStep1Payload;
  step2?: ReleaseStep2Payload;
  audioUrl: string;
  artworkUrl: string;
};

export function useCreateRelease() {
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const create = async (args: CreateReleaseArgs): Promise<ReleaseRecord> => {
    setIsSaving(true);
    setError(null);

    try {
      // 1. Создаем draft, если еще нет
      const draft = await createDraftRelease(args.step1);

      // 2. Обновляем всеми данными и ссылками на файлы
      const updated = await updateRelease(draft.id, {
        ...(args.step2 ?? {}),
        audio_url: args.audioUrl,
        artwork_url: args.artworkUrl
      });

      // 3. Сабмитим
      const submitted = await submitRelease(updated.id);

      return submitted;
    } catch (e: any) {
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

