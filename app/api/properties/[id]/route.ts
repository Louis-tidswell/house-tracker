/// @file app/api/properties/[id]/route.ts
/// @author Shane
/// @date Created: 2025-05-28
/// @date Updated: 2025-05-28
/// @brief PATCH (update) and DELETE a single property.

import { create_supabase_client } from "@/lib/supabase";
import { NextRequest } from "next/server";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, context: RouteContext) {
    const { id } = await context.params;
    const body = await request.json();
    const supabase = create_supabase_client();

    // Build update object with only provided fields
    const updates: Record<string, unknown> = {};
    if ("notes" in body) updates.notes = body.notes;
    if ("rankings" in body) updates.rankings = body.rankings;
    if ("status" in body) updates.status = body.status;
    if ("title" in body) updates.title = body.title;
    if ("address" in body) updates.address = body.address;
    if ("suburb" in body) updates.suburb = body.suburb;
    if ("bedrooms" in body) updates.bedrooms = body.bedrooms;
    if ("bathrooms" in body) updates.bathrooms = body.bathrooms;
    if ("carSpaces" in body) updates.car_spaces = body.carSpaces;
    if ("priceText" in body) updates.price_text = body.priceText;
    if ("realestateUrl" in body) updates.realestate_url = body.realestateUrl;
    if ("domainUrl" in body) updates.domain_url = body.domainUrl;
    if ("sourceUrl" in body) updates.source_url = body.sourceUrl;
    if ("listId" in body) updates.list_id = body.listId;

    if (Object.keys(updates).length === 0) {
        return Response.json({ ok: false, error: "No fields to update" }, { status: 400 });
    }

    const { data, error } = await supabase
        .from("properties")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

    if (error) {
        return Response.json({ ok: false, error: error.message }, { status: 500 });
    }

    const property = {
        id: data.id,
        sourceUrl: data.source_url,
        title: data.title,
        address: data.address,
        suburb: data.suburb,
        bedrooms: data.bedrooms,
        bathrooms: data.bathrooms,
        carSpaces: data.car_spaces,
        priceText: data.price_text,
        notes: data.notes,
        rankings: data.rankings ?? {},
        realestateUrl: data.realestate_url,
        domainUrl: data.domain_url,
        status: data.status,
    };

    return Response.json({ ok: true, property });
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
    const { id } = await context.params;
    const supabase = create_supabase_client();

    const { error } = await supabase
        .from("properties")
        .delete()
        .eq("id", id);

    if (error) {
        return Response.json({ ok: false, error: error.message }, { status: 500 });
    }

    return Response.json({ ok: true });
}
