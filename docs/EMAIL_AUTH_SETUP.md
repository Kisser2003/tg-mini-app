# Настройка Email-верификации и восстановления пароля

## Обзор

Приложение поддерживает полноценную систему email-верификации и восстановления пароля через Supabase Auth.

## Страницы

- `/login` - Вход и регистрация
- `/auth/confirm` - Подтверждение email после регистрации
- `/auth/reset-password` - Запрос ссылки для сброса пароля
- `/auth/update-password` - Установка нового пароля

## Настройка Supabase

### 1. Откройте Supabase Dashboard

1. Перейдите на [app.supabase.com](https://app.supabase.com)
2. Выберите ваш проект
3. Перейдите в **Authentication** → **Email Templates**

### 2. Настройте Email Templates

#### Confirm Signup (Подтверждение регистрации)

```
Subject: Подтвердите ваш email - OMF Distribution

Body:
Привет!

Спасибо за регистрацию в OMF Distribution.

Подтвердите ваш email, нажав на кнопку ниже:

<a href="{{ .ConfirmationURL }}">Подтвердить email</a>

Если вы не регистрировались на нашем сайте, просто проигнорируйте это письмо.

--
Команда OMF Distribution
```

#### Reset Password (Сброс пароля)

```
Subject: Сброс пароля - OMF Distribution

Body:
Привет!

Вы запросили сброс пароля для вашего аккаунта в OMF Distribution.

Нажмите на кнопку ниже, чтобы установить новый пароль:

<a href="{{ .ConfirmationURL }}">Сбросить пароль</a>

Если вы не запрашивали сброс пароля, просто проигнорируйте это письмо.

Ссылка действительна в течение 1 часа.

--
Команда OMF Distribution
```

### 3. Настройте Email Auth Settings

1. Перейдите в **Authentication** → **Settings** → **Auth**
2. **Site URL**: `https://app.omf-studio.ru` (ваш продакшн URL)
3. **Redirect URLs**: Добавьте следующие URL:
   ```
   http://localhost:3000/auth/confirm
   http://localhost:3000/auth/update-password
   https://app.omf-studio.ru/auth/confirm
   https://app.omf-studio.ru/auth/update-password
   ```

4. **Email Settings**:
   - Enable email confirmations: ✓ (включено)
   - Secure email change: ✓ (рекомендуется)
   - Email rate limit: 3-5 emails per hour (рекомендуется)

### 4. Настройте SMTP (опционально)

Для продакшна рекомендуется настроить собственный SMTP сервер вместо встроенного Supabase SMTP:

1. Перейдите в **Project Settings** → **Auth** → **SMTP Settings**
2. Включите **Enable Custom SMTP**
3. Заполните данные вашего SMTP провайдера (например, Gmail, SendGrid, AWS SES)

#### Пример для Gmail:

```
SMTP Host: smtp.gmail.com
SMTP Port: 587
SMTP Username: your-email@gmail.com
SMTP Password: your-app-password (не ваш обычный пароль!)
Sender email: noreply@yourdomain.com
Sender name: OMF Distribution
```

## Процесс регистрации

1. **Пользователь регистрируется** на `/login?mode=signup`
   - Вводит email и пароль
   - Нажимает "Зарегистрироваться"

2. **Supabase отправляет письмо** с ссылкой подтверждения
   - Письмо содержит ссылку вида: `https://app.omf-studio.ru/auth/confirm?token=...`

3. **Пользователь кликает на ссылку** в письме
   - Открывается страница `/auth/confirm`
   - Автоматически происходит подтверждение email
   - Редирект на `/library`

4. **Пользователь авторизован** и может пользоваться приложением

## Процесс восстановления пароля

1. **Пользователь забыл пароль** на `/login`
   - Нажимает "Забыли пароль?"
   - Переходит на `/auth/reset-password`

2. **Вводит email** и нажимает "Отправить ссылку"
   - Supabase отправляет письмо с ссылкой сброса

3. **Пользователь кликает на ссылку** в письме
   - Открывается страница `/auth/update-password`
   - Вводит новый пароль два раза

4. **Пароль обновлен**
   - Автоматический вход в систему
   - Редирект на `/library`

## Тестирование локально

В режиме разработки (localhost):

1. **Без SMTP**: Supabase не будет отправлять реальные письма
   - Проверяйте ссылки в Dashboard → Authentication → Logs
   - Или настройте `.env.local` с тестовым SMTP

2. **С тестовым SMTP**: 
   - Используйте сервисы типа [Mailtrap.io](https://mailtrap.io) или [Ethereal Email](https://ethereal.email)
   - Все письма будут перехватываться и сохраняться в тестовом inbox

## Безопасность

- **Email verification обязательна** - пользователи не могут войти без подтверждения email
- **Rate limiting** - ограничение на количество писем для защиты от спама
- **Token expiration** - ссылки действительны ограниченное время (по умолчанию 1 час)
- **HTTPS only** в продакшне - cookies и tokens передаются только через защищенное соединение

## Troubleshooting

### Письма не приходят

1. Проверьте **Authentication** → **Logs** в Supabase Dashboard
2. Проверьте spam/junk папку
3. Убедитесь что email добавлен в **Redirect URLs**
4. Проверьте SMTP настройки (если используете кастомный SMTP)

### Ссылка не работает

1. Проверьте что `NEXT_PUBLIC_APP_URL` установлен правильно в `.env.local`
2. Убедитесь что URL добавлен в **Redirect URLs** в Supabase Dashboard
3. Проверьте что токен не истек (по умолчанию 1 час)

### Ошибка "Invalid redirect URL"

1. Добавьте URL в **Authentication** → **Settings** → **Auth** → **Redirect URLs**
2. Формат должен быть: `https://yourdomain.com/auth/confirm` (без query параметров)

## Дополнительные возможности

### Magic Links (вход по ссылке из email)

Можно добавить "passwordless" вход - пользователь вводит только email и получает ссылку для входа:

```typescript
const { data, error } = await supabase.auth.signInWithOtp({
  email: 'user@example.com',
  options: {
    emailRedirectTo: `${window.location.origin}/auth/confirm`
  }
})
```

### Social Auth (Google, GitHub, etc.)

Supabase поддерживает OAuth провайдеры. Настраивается в **Authentication** → **Providers**.

## Дополнительная информация

- [Supabase Auth Documentation](https://supabase.com/docs/guides/auth)
- [Email Templates Guide](https://supabase.com/docs/guides/auth/auth-email-templates)
- [SMTP Configuration](https://supabase.com/docs/guides/auth/auth-smtp)
