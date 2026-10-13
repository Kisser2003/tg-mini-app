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

  it("uses the per-track template for an EP and marks release-wide values", () => {
    const release = {
      id: "r3",
      title: "Night EP",
      artist_name: "withoutrevenge",
      release_type: "ep",
      genre: "Trap",
      release_date: "2026-12-01",
      author_full_name: "Макаров Евгений Александрович",
      music_author: "Игнатьев Егор Анатольевич",
      license_type: "lease",
      tiktok_start_sec: 30,
      collaborators: [
        { name: "withoutrevenge", role: "primary" },
        { name: "guest", role: "featuring" }
      ],
      artist_links: {}
    } as unknown as AdminReleaseRow;
    const tracks = [
      { ...track, index: 1, title: "Two", explicit: false, lyrics: "" },
      { ...track, index: 0, title: "One" }
    ] as ReleaseTrackRow[];

    expect(buildColleagueReleaseForm(release, tracks)).toBe(
      [
        "Форма релиза (EP)",
        "",
        "0. Название релиза: Night EP",
        "0.1. Трек-лист:",
        "1. One",
        "2. Two",
        "feat.: guest *",
        "prod.: Игнатьев Егор Анатольевич *",
        "0.2. Желаемая дата релиза: 01.12.2026",
        "0.3. Жанр релиза: Trap",
        "",
        "Трек 1",
        "1. Название трека: One",
        "2. Исполнитель(-и): withoutrevenge feat. guest *",
        "3. Ненормативная лексика: Есть",
        "4. ФИО артиста(-ов): Макаров Евгений Александрович *",
        "5. Начало отрывка песни в ТикТок: 0:30 (30 сек) *",
        "6. Текст трека: файлом",
        "7. Условия использования бита: Аренда / лизинг, автор бита: Игнатьев Егор Анатольевич *",
        "",
        "Трек 2",
        "1. Название трека: Two",
        "2. Исполнитель(-и): withoutrevenge feat. guest *",
        "3. Ненормативная лексика: Нет",
        "4. ФИО артиста(-ов): Макаров Евгений Александрович *",
        "5. Начало отрывка песни в ТикТок: 0:30 (30 сек) *",
        "6. Текст трека: —",
        "7. Условия использования бита: Аренда / лизинг, автор бита: Игнатьев Егор Анатольевич *",
        "",
        "* указано артистом один раз на весь релиз — проверьте по трекам"
      ].join("\n")
    );
  });
});
