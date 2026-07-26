import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// POST /api/rooms/verify-owner
// Verifies owner passcode for a room
export async function POST(req: NextRequest) {
  try {
    const { roomCode, passcode } = await req.json();

    if (!roomCode || !passcode) {
      return NextResponse.json({ isOwner: false, error: "roomCode and passcode are required" }, { status: 400 });
    }

    const slug = roomCode.toUpperCase().trim();

    // Check if room exists
    const { data: room, error: roomErr } = await supabase
      .from("rooms")
      .select("*")
      .eq("slug", slug)
      .maybeSingle();

    if (roomErr || !room) {
      return NextResponse.json({ isOwner: false, error: "Room not found" }, { status: 404 });
    }

    const storedPasscode = (room as any).owner_passcode;

    // If room has no owner PIN set yet, set this PIN as the room's owner PIN!
    if (!storedPasscode) {
      await supabase
        .from("rooms")
        .update({ owner_passcode: passcode.trim() })
        .eq("id", room.id);

      return NextResponse.json({
        isOwner: true,
        role: "owner",
        message: "Owner PIN registered successfully!",
      });
    }

    // Compare passcode
    if (String(storedPasscode).trim() === passcode.trim()) {
      return NextResponse.json({ isOwner: true, role: "owner" });
    }

    return NextResponse.json({ isOwner: false, error: "Incorrect passcode PIN" }, { status: 401 });
  } catch (err: any) {
    return NextResponse.json({ isOwner: false, error: err.message }, { status: 500 });
  }
}
