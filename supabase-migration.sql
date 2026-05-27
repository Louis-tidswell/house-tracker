-- House Tracker: Database migration
-- Run this in Supabase SQL Editor if setting up from scratch.

-- Properties table
CREATE TABLE IF NOT EXISTS properties (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    source_url text NOT NULL DEFAULT 'manual-entry',
    title text,
    address text,
    suburb text,
    bedrooms integer,
    bathrooms integer,
    car_spaces integer,
    price_text text,
    notes text NOT NULL DEFAULT '',
    rankings jsonb NOT NULL DEFAULT '{}',
    realestate_url text,
    domain_url text,
    status text,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- Profiles table
CREATE TABLE IF NOT EXISTS profiles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- Permissive RLS (no auth, shared between friends)
ALTER TABLE properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'properties' AND policyname = 'Allow all on properties') THEN
        CREATE POLICY "Allow all on properties" ON properties FOR ALL USING (true) WITH CHECK (true);
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'Allow all on profiles') THEN
        CREATE POLICY "Allow all on profiles" ON profiles FOR ALL USING (true) WITH CHECK (true);
    END IF;
END $$;
