import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseClient";

export async function POST(request: Request) {
  if (!supabaseServer) {
    return NextResponse.json(
      { message: "Supabase is not configured on the server" },
      { status: 500 }
    );
  }

  try {
    const body = await request.json();

    const {
      artist_name,
      track_title,
      featuring,
      genre,
      release_date,
      explicit,
      wav_url,
      cover_url,
      telegram_user_id
    } = body;

    const { error } = await supabaseServer.from("releases").insert({
      artist_name,
      track_title,
      featuring,
      genre,
      release_date,
      explicit,
      wav_url,
      cover_url,
      telegram_user_id
    });

    if (error) {
      return NextResponse.json(
        { message: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { message: "Unexpected server error" },
      { status: 500 }
    );
  }
}

