import { describe, expect, it } from "vitest";
import { buildColleagueReleaseForm, type AdminReleaseRow } from "@/lib/admin-release-metadata";
import type { ReleaseTrackRow } from "@/repositories/releases/types";

const track = {
  id: "t1",
  release_id: "r1",
  title: "Stop staring (freestyle)",
  file_path: "https://example.com/0.wav",
  index: 0,
  explicit: true,
  lyrics: "текст"
} as unknown as ReleaseTrackRow;

describe("buildColleagueReleaseForm", () => {
  it("fills the colleague template from release fields", () => {
    const release = {
      id: "r1",
      title: "Stop staring (freestyle)",
      artist_name: "withoutrevenge",
      genre: "Hip-Hop/Rap",
      explicit: true,
      release_date: "2026-11-03",
      author_full_name: "Макаров Евгений Александрович",
      music_author: "Игнатьев Егор Анатольевич",
      license_type: "lease",
      tiktok_start_sec: 79,
      collaborators: [{ name: "withoutrevenge", role: "primary" }],
      artist_links: {
        yandex: "https://music.yandex.ru/artist/25705606",
        spotify: "https://open.spotify.com/artist/6tvn3dp3olT8XFdAvsIINh"
      }
    } as unknown as AdminReleaseRow;

    expect(buildColleagueReleaseForm(release, [track])).toBe(
      [
        "Форма релиза",
        "",
        "1. Название релиза: Stop staring (freestyle)",
        "2. Исполнитель: withoutrevenge",
        "3. Обложка (3000 на 3000), JPG: файлом",
        "4. Трек в формате WAV: файлом",
        "5. Жанр: Hip-Hop / Rap",
        "6. Ненормативная лексика: Есть",
        "7. ФИО артиста(-ов): Макаров Евгений Александрович",
        "8. Начало отрывка песни в ТикТок: 1:19 (79 сек)",
        "9. Дата релиза: 03.11.2026",
        "10. Условия использования бита: Аренда / лизинг, автор бита: Игнатьев Егор Анатольевич",
        "11. Текст релиза: файлом",
        "",
        "Карточки артиста:",
        "Яндекс Музыка: https://music.yandex.ru/artist/25705606",
        "Spotify: https://open.spotify.com/artist/6tvn3dp3olT8XFdAvsIINh"
      ].join("\n")
    );
  });

  it("marks missing fields with a dash and skips the links block", () => {
    const release = {
      id: "r2",
      title: "X",
      artist_name: "a",
      explicit: false,
      collaborators: [],
      artist_links: {}
    } as unknown as AdminReleaseRow;
    const text = buildColleagueReleaseForm(release, [{ ...track, explicit: false } as ReleaseTrackRow]);
    expect(text).toContain("7. ФИО артиста(-ов): —");
    expect(text).toContain("10. Условия использования бита: —");
    expect(text).toContain("6. Ненормативная лексика: Нет");
    expect(text).not.toContain("Карточки артиста");
  });
});
