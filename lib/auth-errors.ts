/** Русские тексты вместо сырых английских ошибок Supabase Auth. */
export function mapAuthErrorMessage(err: unknown, fallback: string): string {
  const raw = (err instanceof Error ? err.message : typeof err === "string" ? err : "").toLowerCase();
  if (!raw) return fallback;
  if (raw.includes("invalid login credentials")) return "Неверная почта или пароль.";
  if (raw.includes("email not confirmed")) return "Почта ещё не подтверждена. Открой письмо и перейди по ссылке.";
  if (raw.includes("already registered") || raw.includes("already been registered"))
    return "Этот email уже зарегистрирован. Войди в аккаунт.";
  if (raw.includes("password should be at least") || raw.includes("weak password"))
    return "Пароль слишком простой. Используй не меньше 6 символов.";
  if (raw.includes("same password") || raw.includes("different from the old"))
    return "Новый пароль должен отличаться от старого.";
  if (raw.includes("rate limit") || raw.includes("too many") || raw.includes("security purposes"))
    return "Слишком много попыток. Подожди минуту и попробуй снова.";
  if (raw.includes("invalid email") || raw.includes("unable to validate email"))
    return "Проверь адрес почты: он указан неверно.";
  if (raw.includes("failed to fetch") || raw.includes("network"))
    return "Нет соединения. Проверь интернет и попробуй снова.";
  if (raw.includes("expired") || raw.includes("invalid token") || raw.includes("session"))
    return "Ссылка устарела. Запроси новую.";
  return fallback;
}
