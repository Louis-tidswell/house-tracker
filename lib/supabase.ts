/// @file lib/supabase.ts
/// @author Shane
/// @date Created: 2025-05-28
/// @date Updated: 2025-05-28
/// @brief Server-side Supabase client using the service role key.

import { createClient } from "@supabase/supabase-js";

export function create_supabase_client() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !key) {
        throw new Error(
            "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables"
        );
    }

    return createClient(url, key);
}
