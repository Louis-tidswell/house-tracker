/// @file app/properties/new/page.tsx
/// @author Shane
/// @date Created: 2025-05-27
/// @date Updated: 2025-05-27
/// @brief Add Property page. Reads query params from share targets and
///        prefills the form. Saves to localStorage and redirects to the
///        main property list.

"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Suspense } from "react";

const STORAGE_KEY = "house-tracker-properties-v3";
const PROFILE_STORAGE_KEY = "house-tracker-profiles-v2";

type Profile = {
    id: string;
    name: string;
};

type SavedProperty = {
    id: string;
    sourceUrl: string;
    title: string | null;
    address: string | null;
    bedrooms: number | null;
    bathrooms: number | null;
    carSpaces: number | null;
    priceText: string | null;
    notes: string;
    rankings: Record<string, number>;
    realestateUrl: string | null;
    domainUrl: string | null;
    status: string | null;
    suburb: string | null;
};

const STATUS_OPTIONS = [
    { value: "interested", label: "Interested" },
    { value: "inspect", label: "Inspect" },
    { value: "inspected", label: "Inspected" },
    { value: "offer", label: "Offer" },
    { value: "rejected", label: "Rejected" },
    { value: "sold", label: "Sold" },
];

function extract_url_from_text(text: string): string {
    const url_match = text.match(/https?:\/\/[^\s]+/);
    return url_match ? url_match[0] : "";
}

function classify_url(url: string): { realestateUrl: string; domainUrl: string } {
    if (url.includes("realestate.com.au")) return { realestateUrl: url, domainUrl: "" };
    if (url.includes("domain.com.au")) return { realestateUrl: "", domainUrl: url };
    return { realestateUrl: url, domainUrl: "" };
}

function AddPropertyForm() {
    const search_params = useSearchParams();
    const router = useRouter();

    const [listing_url, setListingUrl] = useState("");
    const [title, setTitle] = useState("");
    const [suburb, setSuburb] = useState("");
    const [price_guide, setPriceGuide] = useState("");
    const [beds, setBeds] = useState("");
    const [baths, setBaths] = useState("");
    const [cars, setCars] = useState("");
    const [status, setStatus] = useState("interested");
    const [profiles, setProfiles] = useState<Profile[]>([]);
    const [active_profile_id, setActiveProfileId] = useState("");
    const [ranking, setRanking] = useState(5);
    const [error, setError] = useState<string | null>(null);

    // Read query params and prefill
    useEffect(() => {
        const source_url = search_params.get("sourceUrl") || "";
        const param_title = search_params.get("title") || "";
        const shared_text = search_params.get("sharedText") || "";
        const text_param = search_params.get("text") || "";

        // PWA share target sends `text` param
        const combined_text = shared_text || text_param;

        let resolved_url = source_url;
        if (!resolved_url && combined_text) {
            resolved_url = extract_url_from_text(combined_text);
        }

        if (resolved_url) setListingUrl(resolved_url);
        if (param_title) setTitle(param_title);
        if (!param_title && combined_text && !extract_url_from_text(combined_text)) {
            setTitle(combined_text);
        }
    }, [search_params]);

    // Load profiles from localStorage
    useEffect(() => {
        const profiles_raw = localStorage.getItem(PROFILE_STORAGE_KEY);
        if (profiles_raw) {
            try {
                const parsed = JSON.parse(profiles_raw) as { profiles: Profile[]; activeProfileId: string };
                if (parsed.profiles.length) {
                    setProfiles(parsed.profiles);
                    setActiveProfileId(parsed.activeProfileId || parsed.profiles[0].id);
                }
            } catch {
                // ignore
            }
        }
    }, []);

    function handle_save() {
        if (!title.trim() && !listing_url.trim()) {
            setError("Enter at least a title or listing URL.");
            return;
        }

        const urls = classify_url(listing_url.trim());

        const entry: SavedProperty = {
            id: crypto.randomUUID(),
            sourceUrl: listing_url.trim() || "manual-entry",
            title: title.trim() || null,
            address: title.trim() || null,
            suburb: suburb.trim() || null,
            bedrooms: beds ? Number(beds) : null,
            bathrooms: baths ? Number(baths) : null,
            carSpaces: cars ? Number(cars) : null,
            priceText: price_guide.trim() || null,
            notes: "",
            rankings: active_profile_id ? { [active_profile_id]: ranking } : {},
            realestateUrl: urls.realestateUrl || null,
            domainUrl: urls.domainUrl || null,
            status: status || null,
        };

        // Load existing properties, prepend new one, save back
        const existing_raw = localStorage.getItem(STORAGE_KEY);
        let existing: SavedProperty[] = [];
        if (existing_raw) {
            try {
                existing = JSON.parse(existing_raw) as SavedProperty[];
            } catch {
                // ignore
            }
        }
        existing.unshift(entry);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(existing));

        router.push("/");
    }

    return (
        <main className="mx-auto flex w-full max-w-lg flex-col gap-5 p-4 md:p-8">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold">Add Property</h1>
                <a href="/" className="rounded border px-3 py-2 text-sm">
                    &larr; Back
                </a>
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <div className="flex flex-col gap-3">
                <label className="flex flex-col gap-1">
                    <span className="text-sm font-medium">Listing URL</span>
                    <input
                        type="url"
                        value={listing_url}
                        onChange={(e) => setListingUrl(e.target.value)}
                        placeholder="https://www.realestate.com.au/property-..."
                        className="rounded border p-3"
                    />
                </label>

                {listing_url.trim() && (
                    <a
                        href={listing_url.trim()}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 rounded bg-blue-600 px-4 py-2 text-sm text-white"
                    >
                        Open Listing &rarr;
                    </a>
                )}

                <label className="flex flex-col gap-1">
                    <span className="text-sm font-medium">Address / Title</span>
                    <input
                        type="text"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="e.g. 42 Smith St, Newtown"
                        className="rounded border p-3"
                    />
                </label>

                <label className="flex flex-col gap-1">
                    <span className="text-sm font-medium">Suburb</span>
                    <input
                        type="text"
                        value={suburb}
                        onChange={(e) => setSuburb(e.target.value)}
                        placeholder="e.g. Newtown"
                        className="rounded border p-3"
                    />
                </label>

                <label className="flex flex-col gap-1">
                    <span className="text-sm font-medium">Price Guide</span>
                    <input
                        type="text"
                        value={price_guide}
                        onChange={(e) => setPriceGuide(e.target.value)}
                        placeholder="e.g. $1,200,000 - $1,300,000"
                        className="rounded border p-3"
                    />
                </label>

                <div className="grid grid-cols-3 gap-2">
                    <label className="flex flex-col gap-1">
                        <span className="text-sm font-medium">Beds</span>
                        <input
                            type="number"
                            min={0}
                            value={beds}
                            onChange={(e) => setBeds(e.target.value)}
                            placeholder="0"
                            className="rounded border p-3"
                        />
                    </label>
                    <label className="flex flex-col gap-1">
                        <span className="text-sm font-medium">Baths</span>
                        <input
                            type="number"
                            min={0}
                            value={baths}
                            onChange={(e) => setBaths(e.target.value)}
                            placeholder="0"
                            className="rounded border p-3"
                        />
                    </label>
                    <label className="flex flex-col gap-1">
                        <span className="text-sm font-medium">Cars</span>
                        <input
                            type="number"
                            min={0}
                            value={cars}
                            onChange={(e) => setCars(e.target.value)}
                            placeholder="0"
                            className="rounded border p-3"
                        />
                    </label>
                </div>

                <label className="flex flex-col gap-1">
                    <span className="text-sm font-medium">Status</span>
                    <select
                        value={status}
                        onChange={(e) => setStatus(e.target.value)}
                        className="rounded border p-3"
                    >
                        {STATUS_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                                {opt.label}
                            </option>
                        ))}
                    </select>
                </label>

                {profiles.length > 0 && (
                    <div className="flex flex-col gap-1">
                        <span className="text-sm font-medium">
                            Your Ranking ({profiles.find((p) => p.id === active_profile_id)?.name ?? "Default"})
                        </span>
                        <div className="flex items-center gap-2">
                            <input
                                type="range"
                                min={1}
                                max={10}
                                value={ranking}
                                onChange={(e) => setRanking(Number(e.target.value))}
                                className="flex-1"
                            />
                            <span className="w-8 text-center font-medium">{ranking}</span>
                        </div>
                    </div>
                )}

                <button
                    onClick={handle_save}
                    className="mt-2 rounded bg-black px-4 py-3 text-lg font-medium text-white active:bg-zinc-700"
                >
                    Save Property
                </button>
            </div>
        </main>
    );
}

export default function AddPropertyPage() {
    return (
        <Suspense fallback={<div className="p-8 text-center">Loading...</div>}>
            <AddPropertyForm />
        </Suspense>
    );
}
