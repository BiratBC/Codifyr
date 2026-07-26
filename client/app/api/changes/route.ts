import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// GET /api/changes?roomCode=ABC123 — Returns pending change requests for a room
export async function GET(req: NextRequest) {
  try {
    const roomCode = req.nextUrl.searchParams.get("roomCode");

    if (!roomCode) {
      return NextResponse.json({ error: "roomCode is required" }, { status: 400 });
    }

    const slug = roomCode.toUpperCase().trim();

    const { data: room } = await supabase
      .from("rooms")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();

    if (!room) return NextResponse.json({ changes: [] });

    const { data: changes, error } = await supabase
      .from("file_changes")
      .select("*")
      .eq("room_id", room.id)
      .eq("status", "pending")
      .order("created_at", { ascending: false });

    if (error) {
      // Return empty array if table has not been created yet
      return NextResponse.json({ changes: [] });
    }

    return NextResponse.json({ changes: changes ?? [] });
  } catch (err: any) {
    return NextResponse.json({ changes: [] });
  }
}

// POST /api/changes — Member submits code proposal for review
export async function POST(req: NextRequest) {
  try {
    const { roomCode, filePath, authorName, proposedContent, baseContent } = await req.json();

    if (!roomCode || !filePath || !proposedContent) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const slug = roomCode.toUpperCase().trim();

    const { data: room } = await supabase
      .from("rooms")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();

    if (!room) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 });
    }

    const { data: change, error } = await supabase
      .from("file_changes")
      .insert({
        room_id: room.id,
        file_path: filePath,
        author_name: authorName || "Member",
        proposed_content: proposedContent,
        base_content: baseContent ?? "",
        status: "pending",
      })
      .select("*")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, change });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// PUT /api/changes — Owner accepts or rejects a pending proposal
export async function PUT(req: NextRequest) {
  try {
    const { changeId, action, roomCode, filePath, proposedContent } = await req.json();

    if (!changeId || !action || !["accept", "reject"].includes(action)) {
      return NextResponse.json({ error: "Invalid changeId or action" }, { status: 400 });
    }

    const newStatus = action === "accept" ? "accepted" : "rejected";

    // Update status in file_changes table
    const { error: updateErr } = await supabase
      .from("file_changes")
      .update({ status: newStatus })
      .eq("id", changeId);

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    // Fetch proposal detail
    const { data: proposal } = await supabase
      .from("file_changes")
      .select("*")
      .eq("id", changeId)
      .maybeSingle();

    const targetContent = action === "accept" ? (proposedContent ?? proposal?.proposed_content) : proposal?.base_content;

    // Update Supabase storage for official file
    if (roomCode && filePath && targetContent !== undefined && targetContent !== null) {
      const slug = roomCode.toUpperCase().trim();
      const { data: room } = await supabase
        .from("rooms")
        .select("id")
        .eq("slug", slug)
        .maybeSingle();

      if (room) {
        const segments = filePath.split("/").filter(Boolean);
        const baseName = segments.pop()!;

        const { data: file } = await supabase
          .from("files")
          .select("id, storage_path")
          .eq("room_id", room.id)
          .eq("name", baseName)
          .maybeSingle();

        if (file?.storage_path) {
          await supabase.storage
            .from("code-files")
            .upload(file.storage_path, new Blob([targetContent], { type: "text/plain" }), {
              upsert: true,
            });
        }
      }
    }

    return NextResponse.json({ success: true, status: newStatus });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
