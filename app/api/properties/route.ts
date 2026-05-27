/// @file app/api/properties/route.ts
/// @author Shane
/// @date Created: 2025-05-28
/// @date Updated: 2025-05-28
/// @brief GET all properties, POST a new property.

import { create_supabase_client } from "@/lib/supabase";

export async function GET() {
    const supabase = create_supabase_client();

    const { data, error } = await supabase
        .from("properties")
        .select("*")
        .order("created_at", { ascending: false });

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
    }));

    return Response.json({ ok: true, properties });
}

export async function POST(request: Request) {
    const body = await request.json();

    const supabase = create_supabase_client();

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
    };

    return Response.json({ ok: true, property }, { status: 201 });
}
