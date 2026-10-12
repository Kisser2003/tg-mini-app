# Хранилище для WAV вне Supabase

Бесплатный Supabase принимает файл до **50 МБ** и хранит всего **1 ГБ**. Для WAV этого мало, поэтому
аудио можно грузить напрямую из браузера в S3-совместимое хранилище. Остальное (база, обложки, вход)
остаётся в Supabase.

## Как это работает

1. Приложение просит у сервера ссылку: `POST /api/releases/audio-upload-url` (проверяется, что релиз
   принадлежит пользователю и это черновик).
2. Браузер заливает файл по этой ссылке (`PUT`), файл не идёт через Vercel.
3. Публичный URL файла сохраняется в `tracks.file_path`. Админка, плеер и ZIP работают с ним как с обычной ссылкой.

Если `S3_*` не заданы или `NEXT_PUBLIC_AUDIO_STORAGE` не равен `s3`, всё работает как раньше через Supabase.

## Backblaze B2 (10 ГБ бесплатно, карта не нужна)

1. Зарегистрируйся на backblaze.com, создай бакет типа **Public**.
2. App Keys → создай ключ с доступом к этому бакету. Сохрани `keyID` и `applicationKey` (показывается один раз).
3. В карточке бакета посмотри **Endpoint** (вида `s3.us-west-004.backblazeb2.com`) и **Friendly URL**.
4. Настрой CORS бакета: разрешённые источники `https://<твой-домен>.vercel.app` (и `http://localhost:3000` для
   разработки), операции `S3 PUT`, `GET`, `HEAD`, заголовок `content-type`, `max age` 3600.
   Если в веб-интерфейсе такого нет, правила задаются через `b2` CLI (`b2 bucket update --cors-rules`).
5. Переменные (в `.env.local` и в Vercel → Environment Variables):

| Переменная | Значение |
| --- | --- |
| `NEXT_PUBLIC_AUDIO_STORAGE` | `s3` |
| `NEXT_PUBLIC_MAX_WAV_MB` | например `300` |
| `S3_ENDPOINT` | `https://s3.us-west-004.backblazeb2.com` |
| `S3_REGION` | регион из endpoint, например `us-west-004` |
| `S3_BUCKET` | имя бакета |
| `S3_ACCESS_KEY_ID` | `keyID` |
| `S3_SECRET_ACCESS_KEY` | `applicationKey` |
| `S3_PUBLIC_BASE_URL` | `https://<бакет>.s3.us-west-004.backblazeb2.com` (публичный адрес объектов без `/` в конце) |

После изменения `NEXT_PUBLIC_*` приложение нужно пересобрать (Redeploy).

## Cloudflare R2 (10 ГБ бесплатно, обычно просит привязать карту)

Те же переменные: `S3_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com`, `S3_REGION=auto`,
`S3_PUBLIC_BASE_URL` — публичный домен бакета (`r2.dev` или свой).

## Что не переехало

- Удаление файлов релиза из внешнего хранилища: пока не делается (файлы остаются в бакете).
- Обложки остаются в Supabase (они мелкие).
