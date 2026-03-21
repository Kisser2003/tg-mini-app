/** Понятное сообщение при сетевом таймауте (без технических деталей). */
export const USER_REQUEST_TIMEOUT_MESSAGE =
  "Сервер не ответил вовремя. Проверьте интернет и попробуйте ещё раз.";

export function formatErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === "string" && err.trim().length > 0) return err;
  return fallback;
}

