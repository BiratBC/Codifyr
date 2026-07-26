import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// GET /api/rooms/members?roomCode=ABC123
// Returns room owner info and roster
export async function GET(req: NextRequest) {
  try {
    const roomCode = req.nextUrl.searchParams.get("roomCode");

    if (!roomCode) {
      return NextResponse.json({ error: "roomCode is required" }, { status: 400 });
    }

    const slug = roomCode.toUpperCase().trim();

    const { data: room } = await supabase
      .from("rooms")
      .select("id, owner_id")
      .eq("slug", slug)
      .maybeSingle();

    if (!room) {
      return NextResponse.json({ members: [] });
    }

    const { data: members } = await supabase
      .from("room_members")
      .select("user_id, role, joined_at")
      .eq("room_id", room.id);

    return NextResponse.json({
      roomId: room.id,
      ownerId: room.owner_id,
      members: members ?? [],
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
