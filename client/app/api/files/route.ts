import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Server-side Supabase client — uses env vars, never exposed to browser
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// GET /api/files?roomCode=ABC123
// Returns all files for a room
export async function GET(req: NextRequest) {
  const roomCode = req.nextUrl.searchParams.get("roomCode");
  if (!roomCode) {
    return NextResponse.json({ error: "roomCode is required" }, { status: 400 });
  }

  // Find the room by slug (room code)
  const { data: room, error: roomErr } = await supabase
    .from("rooms")
    .select("id")
    .eq("slug", roomCode)
    .single();

  if (roomErr || !room) {
    // Room doesn't exist yet — return empty list
    return NextResponse.json({ files: [] });
  }

  const { data: files, error } = await supabase
    .from("files")
    .select("id, name, language, storage_path, created_at")
    .eq("room_id", room.id)
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Fetch content for each file from storage
  const filesWithContent = await Promise.all(
    (files ?? []).map(async (f) => {
      const { data } = await supabase.storage
        .from("code-files")
        .download(f.storage_path);
      const content = data ? await data.text() : "";
      return { ...f, content };
    })
  );

  return NextResponse.json({ files: filesWithContent });
}

// POST /api/files
// Creates or updates a file
export async function POST(req: NextRequest) {
  const { roomCode, filename, language, content } = await req.json();

  if (!roomCode || !filename) {
    return NextResponse.json({ error: "roomCode and filename are required" }, { status: 400 });
  }

  // Upsert room by slug
  let { data: room } = await supabase
    .from("rooms")
    .select("id")
    .eq("slug", roomCode)
    .single();

  if (!room) {
    const { data: newRoom, error: createErr } = await supabase
      .from("rooms")
      .insert({ name: roomCode, slug: roomCode })
      .select("id")
      .single();

    if (createErr) {
      console.error("Room create error:", createErr);
      return NextResponse.json({ error: createErr.message }, { status: 500 });
    }
    room = newRoom;
  }

  const storagePath = `${room.id}/${filename}/current`;

  // Upload content to storage
  const { error: uploadErr } = await supabase.storage
    .from("code-files")
    .upload(storagePath, new Blob([content ?? ""], { type: "text/plain" }), {
      upsert: true,
    });

  if (uploadErr) {
    console.error("Storage upload error:", uploadErr);
    return NextResponse.json({ error: uploadErr.message }, { status: 500 });
  }

  // Upsert file record
  const { data: file, error: fileErr } = await supabase
    .from("files")
    .upsert(
      {
        room_id: room.id,
        name: filename,
        language,
        storage_path: storagePath,
        size_bytes: (content ?? "").length,
      },
      { onConflict: "room_id,folder_id,name" }
    )
    .select("id")
    .single();

  if (fileErr) {
    return NextResponse.json({ error: fileErr.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, fileId: file.id });
}

// DELETE /api/files?roomCode=ABC123&filename=main.js
export async function DELETE(req: NextRequest) {
  const roomCode = req.nextUrl.searchParams.get("roomCode");
  const filename = req.nextUrl.searchParams.get("filename");

  if (!roomCode || !filename) {
    return NextResponse.json({ error: "roomCode and filename are required" }, { status: 400 });
  }

  const { data: room } = await supabase
    .from("rooms")
    .select("id")
    .eq("slug", roomCode)
    .single();

  if (!room) return NextResponse.json({ success: true });

  // Delete file record (storage cleanup optional)
  await supabase
    .from("files")
    .delete()
    .eq("room_id", room.id)
    .eq("name", filename);

  await supabase.storage
    .from("code-files")
    .remove([`${room.id}/${filename}/current`]);

  return NextResponse.json({ success: true });
}