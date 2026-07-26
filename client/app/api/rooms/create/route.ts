import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// POST /api/rooms/create
// Creates a new room with owner passcode
export async function POST(req: NextRequest) {
  try {
    const { roomCode, username, passcode } = await req.json();

    if (!roomCode || !username) {
      return NextResponse.json({ error: "roomCode and username are required" }, { status: 400 });
    }

    const slug = roomCode.toUpperCase().trim();

    // Check if room already exists
    let { data: existingRoom } = await supabase
      .from("rooms")
      .select("id, slug")
      .eq("slug", slug)
      .maybeSingle();

    if (existingRoom) {
      return NextResponse.json({ success: true, roomId: existingRoom.id });
    }

    // Insert new room record
    const ownerId = crypto.randomUUID();
    const { data: newRoom, error: createErr } = await supabase
      .from("rooms")
      .insert({
        name: slug,
        slug: slug,
        owner_id: ownerId,
        ...(passcode ? { owner_passcode: passcode } : {}),
      })
      .select("id")
      .single();

    if (createErr) {
      // Fallback if owner_id constraint triggers
      const { data: fallbackRoom, error: fallbackErr } = await supabase
        .from("rooms")
        .insert({
          name: slug,
          slug: slug,
        })
        .select("id")
        .single();

      if (fallbackErr) {
        console.error("Room creation error:", fallbackErr);
        return NextResponse.json({ error: fallbackErr.message }, { status: 500 });
      }

      return NextResponse.json({ success: true, roomId: fallbackRoom.id });
    }

    // Insert owner into room_members if table exists
    try {
      await supabase.from("room_members").insert({
        room_id: newRoom.id,
        user_id: ownerId,
        role: "owner",
      });
    } catch {}

    return NextResponse.json({ success: true, roomId: newRoom.id, ownerId });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
