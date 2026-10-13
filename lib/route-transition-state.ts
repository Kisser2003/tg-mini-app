/**
 * Где пользователь был до текущего экрана — для направления анимаций и кнопки «Назад».
 *
 * Обновляется из `PageTransition` (корневой layout, живёт всю сессию) во время рендера:
 * родитель рендерится раньше страниц, поэтому дочерние компоненты уже видят новое значение.
 * Повторный рендер с тем же путём ничего не меняет.
 *
 * На сервере модуль общий для всех запросов, поэтому там состояние не трогаем и всегда
 * отвечаем «первый экран» — так SSR совпадает с первым клиентским рендером.
 */
const isServer = typeof window === "undefined";

let currentPath: string | null = null;
let previousPath: string | null = null;
let navigationId = 0;

export function notePathname(pathname: string): void {
  if (isServer || pathname === currentPath) return;
  previousPath = currentPath;
  currentPath = pathname;
  navigationId += 1;
}

/** Путь предыдущего экрана в этой сессии (null — экран открыт первым). */
export function getPreviousPathname(): string | null {
  return previousPath;
}

/** Растёт на каждую смену пути: отличает «тот же экран перемонтировался» от «пришли заново». */
export function getNavigationId(): number {
  return navigationId;
}

/** Был ли переход внутри приложения (иначе экран открыт по прямой ссылке / холодным стартом). */
export function hasNavigatedInApp(): boolean {
  return navigationId > 1;
}
