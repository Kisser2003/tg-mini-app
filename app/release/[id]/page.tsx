import type { Metadata } from "next";
import { z } from "zod";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import ReleaseDetailsClient from "./ReleaseDetailsClient";

const APP_NAME = "omf mini app";

export async function generateMetadata({
  params
}: {
  params: { id: string };
}): Promise<Metadata> {
  const id = params.id;
  if (!z.string().uuid().safeParse(id).success) {
    return { title: `Релиз | ${APP_NAME}` };
  }

  const admin = createSupabaseAdmin();
  if (!admin) {
    return {
      title: `Релиз | ${APP_NAME}`,
      description: "Премиальный Telegram Mini App для музыкальной дистрибуции"
    };
  }

  const { data } = await admin
    .from("releases")
    .select("track_name, artist_name, artwork_url")
    .eq("id", id)
    .maybeSingle();

  if (!data) {
    return { title: `Релиз не найден | ${APP_NAME}` };
  }

  const title = `${data.track_name} — ${data.artist_name}`;
  const description = `${data.track_name} · ${data.artist_name} — ${APP_NAME}`;

  const ogImages = data.artwork_url
    ? [
        {
          url: data.artwork_url,
          width: 1200,
          height: 1200,
          alt: title
        }
      ]
    : [];

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "website",
      siteName: APP_NAME,
      locale: "ru_RU",
      images: ogImages
    },
    twitter: {
      card: data.artwork_url ? "summary_large_image" : "summary",
      title,
      description,
      images: data.artwork_url ? [data.artwork_url] : undefined
    }
  };
}

export default function ReleasePage() {
  return <ReleaseDetailsClient />;
}
