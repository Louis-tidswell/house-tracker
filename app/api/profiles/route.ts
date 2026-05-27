/// @file app/api/profiles/route.ts
/// @author Shane
/// @date Created: 2025-05-28
/// @date Updated: 2025-05-28
/// @brief GET all profiles, POST a new profile.

import { create_supabase_client } from "@/lib/supabase";

export async function GET() {
    const supabase = create_supabase_client();

    const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: true });

    if (error) {
        return Response.json({ ok: false, error: error.message }, { status: 500 });
    }

    const profiles = (data ?? []).map((row) => ({
        id: row.id,
        name: row.name,
    }));

    return Response.json({ ok: true, profiles });
}

export async function POST(request: Request) {
    const body = await request.json();

    if (!body.name?.trim()) {
        return Response.json({ ok: false, error: "Name is required" }, { status: 400 });
    }

    const supabase = create_supabase_client();

    const { data, error } = await supabase
        .from("profiles")
        .insert({ id: body.id || undefined, name: body.name.trim() })
        .select()
        .single();

    if (error) {
        return Response.json({ ok: false, error: error.message }, { status: 500 });
    }

    return Response.json({ ok: true, profile: { id: data.id, name: data.name } }, { status: 201 });
}
