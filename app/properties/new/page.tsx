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

const ACTIVE_PROFILE_KEY = "house-tracker-active-profile";
const THEME_KEY = "house-tracker-theme";

type Theme = "default" | "retro";

type Profile = {
    id: string;
    name: string;
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

    const [theme, setTheme] = useState<Theme>("default");
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

    // Theme management
    useEffect(() => {
        const stored = localStorage.getItem(THEME_KEY) as Theme | null;
        if (stored === "retro" || stored === "default") {
            setTheme(stored);
        }
        document.documentElement.setAttribute("data-theme", stored ?? "default");
    }, []);

    useEffect(() => {
        document.documentElement.setAttribute("data-theme", theme);
    }, [theme]);

    const is_retro = theme === "retro";

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

    // Load profiles from API
    useEffect(() => {
        void (async () => {
            try {
                const res = await fetch("/api/profiles");
                const json = await res.json();
                if (json.ok && json.profiles.length > 0) {
                    setProfiles(json.profiles);
                    const stored_active = localStorage.getItem(ACTIVE_PROFILE_KEY);
                    const valid = json.profiles.find((p: Profile) => p.id === stored_active);
                    setActiveProfileId(valid ? stored_active! : json.profiles[0].id);
                }
            } catch {
                // ignore - profiles are optional for saving
            }
        })();
    }, []);

    const [saving, setSaving] = useState(false);

    async function handle_save() {
        if (!title.trim() && !listing_url.trim()) {
            setError("Enter at least a title or listing URL.");
            return;
        }

        setSaving(true);
        setError(null);

        const urls = classify_url(listing_url.trim());

        const entry = {
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

        try {
            const res = await fetch("/api/properties", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify(entry),
            });
            const json = await res.json();
            if (!json.ok) {
                setError(json.error || "Failed to save property.");
                setSaving(false);
                return;
            }
            router.push("/");
        } catch (err) {
            setError(err instanceof Error ? err.message : "Network error.");
            setSaving(false);
        }
    }

    const input_class = is_retro ? "retro-input w-full rounded px-3 py-3" : "rounded border p-3";
    const label_class = is_retro ? "retro-label" : "text-sm font-medium";

    return (
        <main className={`mx-auto flex w-full max-w-lg flex-col gap-5 p-4 md:p-8 ${is_retro ? "font-mono" : ""}`}>
            <div className="flex items-center justify-between">
                <h1 className={`text-2xl font-bold ${is_retro ? "tracking-widest" : ""}`} style={is_retro ? { color: "var(--retro-accent)" } : undefined}>
                    {is_retro ? "[ ADD PROPERTY ]" : "Add Property"}
                </h1>
                <a href="/" className={is_retro ? "retro-btn rounded px-3 py-2 text-xs" : "rounded border px-3 py-2 text-sm"}>
                    &larr; Back
                </a>
            </div>

            {error && <p className="text-sm" style={is_retro ? { color: "#d96c6c" } : { color: "rgb(220 38 38)" }}>{error}</p>}

            <div className="flex flex-col gap-3">
                <label className="flex flex-col gap-1">
                    <span className={label_class}>Listing URL</span>
                    <input
                        type="url"
                        value={listing_url}
                        onChange={(e) => setListingUrl(e.target.value)}
                        placeholder="https://www.realestate.com.au/property-..."
                        className={input_class}
                    />
                </label>

                {listing_url.trim() && (
                    <a
                        href={listing_url.trim()}
                        target="_blank"
                        rel="noreferrer"
                        className={is_retro ? "retro-link inline-flex items-center gap-1 rounded border px-4 py-2 text-xs" : "inline-flex items-center gap-1 rounded bg-blue-600 px-4 py-2 text-sm text-white"}
                    >
                        Open Listing &rarr;
                    </a>
                )}

                <label className="flex flex-col gap-1">
                    <span className={label_class}>Address / Title</span>
                    <input
                        type="text"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="e.g. 42 Smith St, Newtown"
                        className={input_class}
                    />
                </label>

                <label className="flex flex-col gap-1">
                    <span className={label_class}>Suburb</span>
                    <input
                        type="text"
                        value={suburb}
                        onChange={(e) => setSuburb(e.target.value)}
                        placeholder="e.g. Newtown"
                        className={input_class}
                    />
                </label>

                <label className="flex flex-col gap-1">
                    <span className={label_class}>Price Guide</span>
                    <input
                        type="text"
                        value={price_guide}
                        onChange={(e) => setPriceGuide(e.target.value)}
                        placeholder="e.g. $1,200,000 - $1,300,000"
                        className={input_class}
                    />
                </label>

                <div className="grid grid-cols-3 gap-2">
                    <label className="flex flex-col gap-1">
                        <span className={label_class}>Beds</span>
                        <input
                            type="number"
                            min={0}
                            value={beds}
                            onChange={(e) => setBeds(e.target.value)}
                            placeholder="0"
                            className={input_class}
                        />
                    </label>
                    <label className="flex flex-col gap-1">
                        <span className={label_class}>Baths</span>
                        <input
                            type="number"
                            min={0}
                            value={baths}
                            onChange={(e) => setBaths(e.target.value)}
                            placeholder="0"
                            className={input_class}
                        />
                    </label>
                    <label className="flex flex-col gap-1">
                        <span className={label_class}>Cars</span>
                        <input
                            type="number"
                            min={0}
                            value={cars}
                            onChange={(e) => setCars(e.target.value)}
                            placeholder="0"
                            className={input_class}
                        />
                    </label>
                </div>

                <label className="flex flex-col gap-1">
                    <span className={label_class}>Status</span>
                    <select
                        value={status}
                        onChange={(e) => setStatus(e.target.value)}
                        className={input_class}
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
                        <span className={label_class}>
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
                    onClick={() => void handle_save()}
                    disabled={saving}
                    className={is_retro ? "retro-btn-primary mt-2 rounded px-4 py-3 text-base tracking-wider disabled:opacity-50" : "mt-2 rounded bg-black px-4 py-3 text-lg font-medium text-white active:bg-zinc-700 disabled:opacity-50"}
                >
                    {saving ? (is_retro ? "SAVING..." : "Saving...") : (is_retro ? "[ SAVE PROPERTY ]" : "Save Property")}
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
