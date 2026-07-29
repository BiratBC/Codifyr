import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Server-side Supabase client — uses env vars
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// GET /api/files?roomCode=ABC123
export async function GET(req: NextRequest) {
  const roomCode = req.nextUrl.searchParams.get("roomCode");
  if (!roomCode) {
    return NextResponse.json({ error: "roomCode is required" }, { status: 400 });
  }

  // Find room by slug
  const { data: room, error: roomErr } = await supabase
    .from("rooms")
    .select("id")
    .eq("slug", roomCode)
    .single();

  if (roomErr || !room) {
    return NextResponse.json({ files: [] });
  }

  // Fetch folders to rebuild relative paths
  const { data: folders } = await supabase
    .from("folders")
    .select("id, parent_id, name")
    .eq("room_id", room.id);

  const folderMap = new Map((folders ?? []).map((f: any) => [f.id, f]));

  function getFolderPath(folderId: string | null): string {
    if (!folderId) return "";
    const parts: string[] = [];
    let currId: string | null = folderId;
    while (currId && folderMap.has(currId)) {
      const folderItem: any = folderMap.get(currId)!;
      parts.unshift(folderItem.name);
      currId = folderItem.parent_id;
    }
    return parts.join("/");
  }

  // Fetch files
  const { data: files, error } = await supabase
    .from("files")
    .select("id, folder_id, name, language, storage_path, created_at")
    .eq("room_id", room.id)
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Format folder objects with relative path
  const folderEntries = (folders ?? []).map((f: any) => ({
    id: f.id,
    name: f.name,
    path: getFolderPath(f.id),
    isFolder: true,
  }));

  // Download content for each file from storage
  const filesWithContent = await Promise.all(
    (files ?? []).map(async (f: any) => {
      const folderPath = getFolderPath(f.folder_id);
      const fullPath = folderPath ? `${folderPath}/${f.name}` : f.name;

      const { data } = await supabase.storage
        .from("code-files")
        .download(f.storage_path);
      const content = data ? await data.text() : "";

      return {
        id: f.id,
        name: f.name,
        path: fullPath,
        language: f.language,
        content,
        isFolder: false,
      };
    })
  );

  return NextResponse.json({ files: filesWithContent, folders: folderEntries });
}

// POST /api/files
export async function POST(req: NextRequest) {
  const body = await req.json();
  const roomCode = body.roomCode;
  const filePath = body.path || body.filename;
  const language = body.language;
  const content = body.content;

  if (body.isFolder) {
    return NextResponse.json({ success: true, message: "Folder operations use public.folders" });
  }

  if (!roomCode || !filePath) {
    return NextResponse.json({ error: "roomCode and path/filename are required" }, { status: 400 });
  }

  // Find or insert room
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

  // Parse path hierarchy
  const segments = filePath.split("/").filter(Boolean);
  const baseName = segments.pop()!;
  let currentParentId: string | null = null;

  for (const folderName of segments) {
    let query = supabase
      .from("folders")
      .select("id")
      .eq("room_id", room.id)
      .eq("name", folderName);

    if (currentParentId) {
      query = query.eq("parent_id", currentParentId);
    } else {
      query = query.is("parent_id", null);
    }

    const existingFolderRes: any = await query.maybeSingle();
    let folder = existingFolderRes.data;

    if (!folder) {
      const insertFolderRes: any = await supabase
        .from("folders")
        .insert({
          room_id: room.id,
          parent_id: currentParentId,
          name: folderName,
        })
        .select("id")
        .single();

      if (insertFolderRes.error) {
        console.error("Folder insert error:", insertFolderRes.error);
      }
      folder = insertFolderRes.data;
    }
    if (folder) currentParentId = folder.id;
  }

  // Find or create file
  let fileQuery = supabase
    .from("files")
    .select("id, storage_path")
    .eq("room_id", room.id)
    .eq("name", baseName);

  if (currentParentId) {
    fileQuery = fileQuery.eq("folder_id", currentParentId);
  } else {
    fileQuery = fileQuery.is("folder_id", null);
  }

  let { data: existingFile } = await fileQuery.maybeSingle();

  let fileId = existingFile?.id;
  let storagePath = existingFile?.storage_path;

  if (!fileId) {
    fileId = crypto.randomUUID();
    storagePath = `${room.id}/${fileId}/current`;

    const { error: insertFileErr } = await supabase.from("files").insert({
      id: fileId,
      room_id: room.id,
      folder_id: currentParentId,
      name: baseName,
      language,
      storage_path: storagePath,
      size_bytes: (content ?? "").length,
    });

    if (insertFileErr) {
      console.error("File insert error:", insertFileErr);
      return NextResponse.json({ error: insertFileErr.message }, { status: 500 });
    }
  } else {
    await supabase.from("files").update({
      size_bytes: (content ?? "").length,
      updated_at: new Date().toISOString(),
    }).eq("id", fileId);
  }

  // Upload to Supabase storage bucket
  const { error: uploadErr } = await supabase.storage
    .from("code-files")
    .upload(storagePath, new Blob([content ?? ""], { type: "text/plain" }), {
      upsert: true,
    });

  if (uploadErr) {
    console.error("Storage upload error:", uploadErr);
    return NextResponse.json({ error: uploadErr.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, fileId });
}

// DELETE /api/files?roomCode=ABC123&path=src/utils/helpers.ts
export async function DELETE(req: NextRequest) {
  const roomCode = req.nextUrl.searchParams.get("roomCode");
  const filePath = req.nextUrl.searchParams.get("path") || req.nextUrl.searchParams.get("filename");

  if (!roomCode || !filePath) {
    return NextResponse.json({ error: "roomCode and path/filename are required" }, { status: 400 });
  }

  const { data: room } = await supabase
    .from("rooms")
    .select("id")
    .eq("slug", roomCode)
    .single();

  if (!room) return NextResponse.json({ success: true });

  const segments = filePath.split("/").filter(Boolean);
  const baseName = segments.pop()!;
  let currentParentId: string | null = null;

  for (const folderName of segments) {
    let query = supabase
      .from("folders")
      .select("id")
      .eq("room_id", room.id)
      .eq("name", folderName);

    if (currentParentId) {
      query = query.eq("parent_id", currentParentId);
    } else {
      query = query.is("parent_id", null);
    }

    const { data: folder } = await query.maybeSingle();
    if (!folder) return NextResponse.json({ success: true });
    currentParentId = folder.id;
  }

  let fileQuery = supabase
    .from("files")
    .select("id, storage_path")
    .eq("room_id", room.id)
    .eq("name", baseName);

  if (currentParentId) {
    fileQuery = fileQuery.eq("folder_id", currentParentId);
  } else {
    fileQuery = fileQuery.is("folder_id", null);
  }

  const { data: file } = await fileQuery.maybeSingle();

  if (file) {
    await supabase.from("files").delete().eq("id", file.id);
    await supabase.storage.from("code-files").remove([file.storage_path]);
  }

  return NextResponse.json({ success: true });
}