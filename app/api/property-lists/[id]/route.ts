/// @file app/api/property-lists/[id]/route.ts
/// @author Shane
/// @date Created: 2025-05-28
/// @date Updated: 2025-05-28
/// @brief PATCH (rename) and DELETE a single property list.

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
        .from("property_lists")
        .update({ name })
        .eq("id", id)
        .select()
        .single();

    if (error) {
        return Response.json({ ok: false, error: error.message }, { status: 500 });
    }

    return Response.json({
        ok: true,
        list: { id: data.id, name: data.name, description: data.description, isDefault: data.is_default ?? false },
    });
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
    const { id } = await context.params;
    const supabase = create_supabase_client();

    // Prevent deleting the default list
    const { data: list } = await supabase
        .from("property_lists")
        .select("is_default")
        .eq("id", id)
        .single();

    if (list?.is_default) {
        return Response.json({ ok: false, error: "Cannot delete the default list." }, { status: 400 });
    }

    const { error } = await supabase
        .from("property_lists")
        .delete()
        .eq("id", id);

    if (error) {
        return Response.json({ ok: false, error: error.message }, { status: 500 });
    }

    return Response.json({ ok: true });
}
