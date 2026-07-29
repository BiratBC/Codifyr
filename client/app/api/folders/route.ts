import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// POST /api/folders — Creates folder hierarchy in public.folders
export async function POST(req: NextRequest) {
  try {
    const { roomCode, path } = await req.json();

    if (!roomCode || !path) {
      return NextResponse.json({ error: "roomCode and path are required" }, { status: 400 });
    }

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
        return NextResponse.json({ error: createErr.message }, { status: 500 });
      }
      room = newRoom;
    }

    const segments = path.split("/").filter(Boolean);
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

    return NextResponse.json({ success: true, folderId: currentParentId });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// DELETE /api/folders?roomCode=ABC123&path=src/components
export async function DELETE(req: NextRequest) {
  try {
    const roomCode = req.nextUrl.searchParams.get("roomCode");
    const path = req.nextUrl.searchParams.get("path");

    if (!roomCode || !path) {
      return NextResponse.json({ error: "roomCode and path are required" }, { status: 400 });
    }

    const { data: room } = await supabase
      .from("rooms")
      .select("id")
      .eq("slug", roomCode)
      .single();

    if (!room) return NextResponse.json({ success: true });

    const segments = path.split("/").filter(Boolean);
    let currentParentId: string | null = null;
    let targetFolderId: string | null = null;

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

      const { data: folder }: any = await query.maybeSingle();
      if (!folder) return NextResponse.json({ success: true });
      currentParentId = folder.id;
      targetFolderId = folder.id;
    }

    if (targetFolderId) {
      await supabase.from("folders").delete().eq("id", targetFolderId);
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
