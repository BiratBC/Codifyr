import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// POST /api/rooms/join
// Records user joining a room and returns role details
export async function POST(req: NextRequest) {
  try {
    const { roomCode, username, passcode } = await req.json();

    if (!roomCode || !username) {
      return NextResponse.json({ error: "roomCode and username are required" }, { status: 400 });
    }

    const slug = roomCode.toUpperCase().trim();

    // Fetch room
    const { data: room } = await supabase
      .from("rooms")
      .select("id, owner_passcode")
      .eq("slug", slug)
      .maybeSingle();

    if (!room) {
      return NextResponse.json({ success: false, error: "Room not found" }, { status: 404 });
    }

    let isOwner = false;
    if (passcode && room.owner_passcode && room.owner_passcode === passcode.trim()) {
      isOwner = true;
    }

    return NextResponse.json({
      success: true,
      roomId: room.id,
      role: isOwner ? "owner" : "editor",
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
