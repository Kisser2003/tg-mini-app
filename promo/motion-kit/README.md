# omf motion kit

Инструменты для промо-роликов mini app (серия для Stories/Reels, 1080×1920, 30 fps).
В кадре — настоящая разметка и CSS приложения (снимки DOM), анимации проигрываются покадрово
с параметрами из кода. Образец — `examples/video-1` («Приложение, которое приятно трогать»).

## Шаги

1. **Поднять приложение** из этой ветки: `npm ci`, затем
   `NEXT_PUBLIC_ALLOW_DEV_API_AUTH=true npx next dev -p 3000`.
   Боевую базу не трогаем: `tools/capture.mjs` перехватывает `/api/releases/my` и отдаёт фейковые релизы.
2. **Снять экраны:** `node promo/motion-kit/tools/capture.mjs all` (или `library | wizard | success`).
   Для нового видео допиши свои состояния в `capture.mjs` (переходы, клики, данные в localStorage).
   Результат: `ref/*.png` (проверка) и `ref/*.json` (DOM + CSS).
   Шаг мастера «Обложка» закрыт проверкой паспорта: для съёмки временно поставь
   `false && !guard.allowed` в `app/create/assets/page.tsx` и **не коммить** это.
3. **Подготовить:** `node promo/motion-kit/tools/prep.mjs` — шрифты в `assets/fonts`, CSS под shadow DOM,
   мобильная раскладка заморожена на 390×844, ник в заголовке библиотеки — по карте `NICK`.
4. **Композиция:** скопируй `examples/video-1/index.html` в `promo/motion-kit/index.html` и меняй сцены.
   Всё — чистая функция времени `render(t)`; таймлайн `T`, камера `CAMS`, тапы `TAPS`.
   Пружины framer-motion: фильтр 520/40, таб 500/40, шторки 300/30. Кривая — `cubic-bezier(0.22, 1, 0.36, 1)`.
5. **Музыка:** положи `assets/music.wav` (вырезка трека с заходом/затуханием), такты и клэпы — в `BAR`/`CLAP`.
6. **Стопкадры:** `node promo/motion-kit/tools/snap.mjs 1.5 4.2 …` → `snap/`, `sheet.png`. Показать до рендера.
7. **Рендер:** `node promo/motion-kit/tools/render.mjs` (≈8 мин на 23 с; `DUR` в начале файла) → `raw.mp4`.
8. **Финал:** постер в нулевой кадр (`overlay=enable='lt(t,1/30)'`), сжатие `crf 20, maxrate 12M`, `share-copy.txt`.

Нужен Chrome (Playwright `channel: 'chrome'`) и ffmpeg.
Обложки в `assets/covers`: «Холод» — 4mess, REGOS — KISSER, JAPAN — KISSER, JEEP — SAKRON.
