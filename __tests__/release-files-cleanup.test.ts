import { describe, it, expect, vi, beforeEach } from "vitest";

const { blobDel } = vi.hoisted(() => ({ blobDel: vi.fn() }));
vi.mock("@vercel/blob", () => ({ del: (...a: unknown[]) => blobDel(...a) }));

import { deleteAllReleaseFiles } from "@/lib/release-audio-cleanup.server";

const ID = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";
const SB = "https://x.supabase.co/storage/v1/object/public";

function storageMock() {
  const removed: Record<string, string[]> = {};
  const admin = {
    storage: {
      from: (bucket: string) => ({
        remove: async (keys: string[]) => {
          removed[bucket] = [...(removed[bucket] ?? []), ...keys];
          return { error: null };
        }
      })
    }
  };
  return { admin: admin as never, removed };
}

beforeEach(() => blobDel.mockReset());

describe("deleteAllReleaseFiles", () => {
  it("удаляет WAV треков, обложку и старый WAV только этого релиза", async () => {
    const { admin, removed } = storageMock();
    await deleteAllReleaseFiles(
      admin,
      {
        id: ID,
        artwork_url: `${SB}/artwork/42/${ID}/cover.png?t=1`,
        audio_url: `${SB}/audio/42/${ID}/audio.wav`
      },
      [
        `${SB}/releases/42/${ID}/tracks/0.wav`,
        `${SB}/releases/42/${OTHER}/tracks/0.wav`,
        `https://abc.public.blob.vercel-storage.com/42/${ID}/tracks/1.wav`,
        ""
      ]
    );
    expect(removed.releases).toEqual([`42/${ID}/tracks/0.wav`]);
    expect(removed.artwork).toEqual([`42/${ID}/cover.png`]);
    expect(removed.audio).toEqual([`42/${ID}/audio.wav`]);
    expect(blobDel).toHaveBeenCalledWith([`https://abc.public.blob.vercel-storage.com/42/${ID}/tracks/1.wav`]);
  });

  it("не трогает обложку другого релиза и чужие пути", async () => {
    const { admin, removed } = storageMock();
    await deleteAllReleaseFiles(
      admin,
      { id: ID, artwork_url: `${SB}/artwork/42/${OTHER}/cover.jpg`, audio_url: `${SB}/audio/42/${ID}/../x.wav` },
      []
    );
    expect(removed).toEqual({});
    expect(blobDel).not.toHaveBeenCalled();
  });
});
