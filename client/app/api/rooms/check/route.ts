import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// GET /api/rooms/check?code=ABC123
// Checks if a room exists in Supabase
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");

  if (!code) {
    return NextResponse.json({ exists: false });
  }

  const { data, error } = await supabase
    .from("rooms")
    .select("id")
    .eq("slug", code.toUpperCase())
    .single();

  if (error || !data) {
    return NextResponse.json({ exists: false });
  }

  return NextResponse.json({ exists: true });
}