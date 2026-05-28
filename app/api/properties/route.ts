/// @file app/api/properties/route.ts
/// @author Shane
/// @date Created: 2025-05-28
/// @date Updated: 2025-05-28
/// @brief GET all properties, POST a new property.

import { create_supabase_client } from "@/lib/supabase";
import { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
    const supabase = create_supabase_client();
    const listId = request.nextUrl.searchParams.get("listId");

    let query = supabase
        .from("properties")
        .select("*")
        .order("created_at", { ascending: false });

    if (listId) {
        query = query.eq("list_id", listId);
    }

    const { data, error } = await query;

    if (error) {
        return Response.json({ ok: false, error: error.message }, { status: 500 });
    }

    // Map snake_case DB columns to camelCase for the frontend
    const properties = (data ?? []).map((row) => ({
        id: row.id,
        sourceUrl: row.source_url,
        title: row.title,
        address: row.address,
        suburb: row.suburb,
        bedrooms: row.bedrooms,
        bathrooms: row.bathrooms,
        carSpaces: row.car_spaces,
        priceText: row.price_text,
        notes: row.notes,
        rankings: row.rankings ?? {},
        realestateUrl: row.realestate_url,
        domainUrl: row.domain_url,
        status: row.status,
        listId: row.list_id,
    }));

    return Response.json({ ok: true, properties });
}

export async function POST(request: Request) {
    const body = await request.json();

    const supabase = create_supabase_client();

    // If no listId provided, find the default list
    let list_id = body.listId || null;
    if (!list_id) {
        const { data: default_list } = await supabase
            .from("property_lists")
            .select("id")
            .eq("is_default", true)
            .single();
        if (default_list) {
            list_id = default_list.id;
        }
    }

    const row = {
        id: body.id || undefined,
        source_url: body.sourceUrl || "manual-entry",
        title: body.title || null,
        address: body.address || null,
        suburb: body.suburb || null,
        bedrooms: body.bedrooms ?? null,
        bathrooms: body.bathrooms ?? null,
        car_spaces: body.carSpaces ?? null,
        price_text: body.priceText || null,
        notes: body.notes || "",
        rankings: body.rankings || {},
        realestate_url: body.realestateUrl || null,
        domain_url: body.domainUrl || null,
        status: body.status || null,
        list_id: list_id,
    };

    const { data, error } = await supabase
        .from("properties")
        .insert(row)
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
        listId: data.list_id,
    };

    return Response.json({ ok: true, property }, { status: 201 });
}
