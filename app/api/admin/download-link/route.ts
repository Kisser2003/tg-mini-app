import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireAdminSupabaseClient } from "@/lib/admin-release-api-guard";
import { getTelegramAuthContextFromRequest } from "@/lib/api/with-telegram-auth";
import { createAdminDownloadPath } from "@/lib/admin-download-token";

export const dynamic = "force-dynamic";

const bodySchema = z.object({ path: z.string().max(300) });

/**
 * Выдаёт короткоживущую подписанную ссылку на скачивание файла релиза.
 * Нужна для Telegram: blob-ссылки там не открываются, а обычная ссылка не несёт заголовков авторизации.
 */
export async function POST(request: NextRequest): Promise<Response> {
  const guard = await requireAdminSupabaseClient(request, getTelegramAuthContextFromRequest(request));
  if (!guard.ok) return guard.response;

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Некорректный запрос." }, { status: 400 });
  }
  const path = createAdminDownloadPath(parsed.data.path);
  if (!path) {
    return NextResponse.json({ ok: false, error: "Нельзя создать ссылку для этого файла." }, { status: 400 });
  }
  return NextResponse.json({ ok: true, path });
}
