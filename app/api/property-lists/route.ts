/// @file app/api/property-lists/route.ts
/// @author Shane
/// @date Created: 2025-05-28
/// @date Updated: 2025-05-28
/// @brief GET all property lists, POST to create a new list.

import { create_supabase_client } from "@/lib/supabase";

export async function GET() {
    const supabase = create_supabase_client();

    const { data, error } = await supabase
        .from("property_lists")
        .select("*")
        .order("is_default", { ascending: false })
        .order("created_at", { ascending: true });

    if (error) {
        return Response.json({ ok: false, error: error.message }, { status: 500 });
    }

    const lists = (data ?? []).map((row) => ({
        id: row.id,
        name: row.name,
        description: row.description,
        isDefault: row.is_default ?? false,
    }));

    return Response.json({ ok: true, lists });
}

export async function POST(request: Request) {
    const body = await request.json();

    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name) {
        return Response.json({ ok: false, error: "Name is required." }, { status: 400 });
    }
    if (name.length > 100) {
        return Response.json({ ok: false, error: "Name must be 100 characters or less." }, { status: 400 });
    }

    const description = typeof body.description === "string" ? body.description.trim() : null;

    const supabase = create_supabase_client();

    const row = {
        name,
        description: description || null,
        is_default: false,
    };

    const { data, error } = await supabase
        .from("property_lists")
        .insert(row)
        .select()
        .single();

    if (error) {
        return Response.json({ ok: false, error: error.message }, { status: 500 });
    }

    const list = {
        id: data.id,
        name: data.name,
        description: data.description,
        isDefault: data.is_default ?? false,
    };

    return Response.json({ ok: true, list }, { status: 201 });
}
