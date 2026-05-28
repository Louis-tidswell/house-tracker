/// @file app/api/profiles/[id]/route.ts
/// @author Shane
/// @date Created: 2025-05-28
/// @date Updated: 2025-05-28
/// @brief PATCH (rename) and DELETE a single profile.

import { create_supabase_client } from "@/lib/supabase";
import { NextRequest } from "next/server";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, context: RouteContext) {
    const { id } = await context.params;
    const body = await request.json();
    const supabase = create_supabase_client();

    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name) {
        return Response.json({ ok: false, error: "Name is required." }, { status: 400 });
    }

    const { data, error } = await supabase
        .from("profiles")
        .update({ name })
        .eq("id", id)
        .select()
        .single();

    if (error) {
        return Response.json({ ok: false, error: error.message }, { status: 500 });
    }

    return Response.json({ ok: true, profile: { id: data.id, name: data.name } });
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
    const { id } = await context.params;
    const supabase = create_supabase_client();

    const { error } = await supabase
        .from("profiles")
        .delete()
        .eq("id", id);

    if (error) {
        return Response.json({ ok: false, error: error.message }, { status: 500 });
    }

    return Response.json({ ok: true });
}
