"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";

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
  status?: string | null;
  suburb?: string | null;
};

type Profile = {
  id: string;
  name: string;
};

type Coordinates = Record<string, { lat: number; lon: number }>;

type Theme = "default" | "retro";

const COORDS_STORAGE_KEY = "house-tracker-coordinates-v1";
const ACTIVE_PROFILE_KEY = "house-tracker-active-profile";
const THEME_KEY = "house-tracker-theme";
const PropertyMap = dynamic(() => import("./components/PropertyMap"), { ssr: false });

export default function Home() {
  const [theme, setTheme] = useState<Theme>("default");
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [profileNameInput, setProfileNameInput] = useState("");
  const [activeProfileId, setActiveProfileId] = useState("");

  const [saved, setSaved] = useState<SavedProperty[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [coordinates, setCoordinates] = useState<Coordinates>({});
  const [draftPriority, setDraftPriority] = useState<Record<string, number>>({});
  const geocode_failed = useRef<Set<string>>(new Set());

  const [filterMinBeds, setFilterMinBeds] = useState("");
  const [filterMinBaths, setFilterMinBaths] = useState("");
  const [filterMinCars, setFilterMinCars] = useState("");
  const [filterPrice, setFilterPrice] = useState("");
  const [sortBy, setSortBy] = useState<"priority" | "beds" | "baths" | "cars" | "price">("priority");

  const cardRefs = useRef<Record<string, HTMLElement | null>>({});
  const notes_timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const is_retro = theme === "retro";

  const activeProfile = profiles.find((profile) => profile.id === activeProfileId) ?? null;
  const priorityProfiles = useMemo(() => {
    const hasCustomProfile = profiles.some((profile) => profile.name !== "Profile 1");
    if (!hasCustomProfile) return profiles;
    return profiles.filter((profile) => profile.name !== "Profile 1");
  }, [profiles]);

  // Theme management
  useEffect(() => {
    const stored = localStorage.getItem(THEME_KEY) as Theme | null;
    if (stored === "retro" || stored === "default") {
      setTheme(stored);
    }
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  // Load data from API on mount
  useEffect(() => {
    async function load_data() {
      try {
        const [props_res, profiles_res] = await Promise.all([
          fetch("/api/properties"),
          fetch("/api/profiles"),
        ]);

        if (!props_res.ok || !profiles_res.ok) {
          setLoadError("Failed to load data from server.");
          setReady(true);
          return;
        }

        const props_json = await props_res.json();
        const profiles_json = await profiles_res.json();

        if (props_json.ok) {
          setSaved(props_json.properties);
        }

        if (profiles_json.ok && profiles_json.profiles.length > 0) {
          setProfiles(profiles_json.profiles);
          const stored_active = localStorage.getItem(ACTIVE_PROFILE_KEY);
          const valid = profiles_json.profiles.find((p: Profile) => p.id === stored_active);
          setActiveProfileId(valid ? stored_active! : profiles_json.profiles[0].id);
        } else {
          const res = await fetch("/api/profiles", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ name: "Profile 1" }),
          });
          const json = await res.json();
          if (json.ok) {
            setProfiles([json.profile]);
            setActiveProfileId(json.profile.id);
          }
        }

        const coordsRaw = localStorage.getItem(COORDS_STORAGE_KEY);
        if (coordsRaw) {
          try {
            setCoordinates(JSON.parse(coordsRaw) as Coordinates);
          } catch {
            localStorage.removeItem(COORDS_STORAGE_KEY);
          }
        }
      } catch (err) {
        setLoadError(err instanceof Error ? err.message : "Failed to connect to server.");
      }
      setReady(true);
    }
    void load_data();
  }, []);

  useEffect(() => {
    if (!ready || !activeProfileId) return;
    localStorage.setItem(ACTIVE_PROFILE_KEY, activeProfileId);
  }, [activeProfileId, ready]);

  useEffect(() => {
    if (!ready) return;
    localStorage.setItem(COORDS_STORAGE_KEY, JSON.stringify(coordinates));
  }, [coordinates, ready]);

  const geocodeProperty = useCallback(async (property: SavedProperty) => {
    if (!property.address || coordinates[property.id] || geocode_failed.current.has(property.id)) return;
    try {
      let query = property.address;
      if (property.suburb && !query.toLowerCase().includes(property.suburb.toLowerCase())) {
        query += `, ${property.suburb}`;
      }
      const params = new URLSearchParams({ address: query });
      if (property.suburb) params.set("suburb", property.suburb);
      const response = await fetch(`/api/geocode?${params.toString()}`);
      if (!response.ok) {
        geocode_failed.current.add(property.id);
        return;
      }
      const json = (await response.json()) as { ok: boolean; lat?: number; lon?: number };
      if (!json.ok || typeof json.lat !== "number" || typeof json.lon !== "number") {
        geocode_failed.current.add(property.id);
        return;
      }
      setCoordinates((prev) => ({ ...prev, [property.id]: { lat: json.lat as number, lon: json.lon as number } }));
    } catch {
      geocode_failed.current.add(property.id);
    }
  }, [coordinates]);

  useEffect(() => {
    if (!ready) return;
    saved.forEach((property) => {
      void geocodeProperty(property);
    });
  }, [saved, geocodeProperty, ready]);

  const getPriority = useCallback((property: SavedProperty): number => {
    if (!activeProfileId) return 5;
    if (typeof draftPriority[property.id] === "number") return draftPriority[property.id];
    return property.rankings[activeProfileId] ?? 5;
  }, [activeProfileId, draftPriority]);

  function parsePriceValue(priceText: string | null): number {
    if (!priceText) return Number.MAX_SAFE_INTEGER;
    const normalized = priceText.replace(/,/g, "");
    const millionMatch = normalized.match(/(\d+(?:\.\d+)?)\s*m/i);
    if (millionMatch) return Math.round(Number(millionMatch[1]) * 1_000_000);
    const numberMatch = normalized.match(/\d{5,8}/);
    return numberMatch ? Number(numberMatch[0]) : Number.MAX_SAFE_INTEGER;
  }

  const sorted = useMemo(() => {
    const clone = [...saved];
    clone.sort((a, b) => {
      if (sortBy === "beds") return (b.bedrooms ?? -1) - (a.bedrooms ?? -1);
      if (sortBy === "baths") return (b.bathrooms ?? -1) - (a.bathrooms ?? -1);
      if (sortBy === "cars") return (b.carSpaces ?? -1) - (a.carSpaces ?? -1);
      if (sortBy === "price") return parsePriceValue(a.priceText) - parsePriceValue(b.priceText);
      return getPriority(b) - getPriority(a);
    });
    return clone;
  }, [saved, sortBy, getPriority]);

  function matchesFilters(property: SavedProperty): boolean {
    const minBeds = filterMinBeds ? Number(filterMinBeds) : 0;
    const minBaths = filterMinBaths ? Number(filterMinBaths) : 0;
    const minCars = filterMinCars ? Number(filterMinCars) : 0;
    const priceFilter = filterPrice.trim().toLowerCase();

    if ((property.bedrooms ?? 0) < minBeds) return false;
    if ((property.bathrooms ?? 0) < minBaths) return false;
    if ((property.carSpaces ?? 0) < minCars) return false;
    if (priceFilter && !(property.priceText ?? "").toLowerCase().includes(priceFilter)) return false;
    return true;
  }

  const matched = sorted.filter(matchesFilters);
  const unmatched = sorted.filter((item) => !matchesFilters(item));
  const selected = sorted.find((item) => item.id === selectedId) ?? matched[0] ?? sorted[0] ?? null;

  function removeProperty(id: string) {
    setSaved((prev) => prev.filter((item) => item.id !== id));
    if (selectedId === id) setSelectedId(null);
    void fetch(`/api/properties/${id}`, { method: "DELETE" });
  }

  function commitPriority(propertyId: string) {
    const value = draftPriority[propertyId];
    if (typeof value !== "number" || !activeProfileId) return;

    const property = saved.find((p) => p.id === propertyId);
    if (!property) return;

    const new_rankings = { ...property.rankings, [activeProfileId]: value };

    setSaved((prev) => prev.map((p) =>
      p.id === propertyId
        ? { ...p, rankings: new_rankings }
        : p,
    ));

    setDraftPriority((prev) => {
      const next = { ...prev };
      delete next[propertyId];
      return next;
    });

    void fetch(`/api/properties/${propertyId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ rankings: new_rankings }),
    });
  }

  function addProfile() {
    const name = profileNameInput.trim();
    if (!name) return;

    void (async () => {
      const res = await fetch("/api/profiles", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const json = await res.json();
      if (json.ok) {
        setProfiles((prev) => [...prev, json.profile]);
        setActiveProfileId(json.profile.id);
        setProfileNameInput("");
      }
    })();
  }

  function clearFilters() {
    setFilterMinBeds("");
    setFilterMinBaths("");
    setFilterMinCars("");
    setFilterPrice("");
  }

  function ensureAuthorPrefix(propertyId: string) {
    if (!activeProfile) return;
    const prefix = `${activeProfile.name}: `;
    setSaved((prev) => prev.map((property) => {
      if (property.id !== propertyId) return property;
      let new_notes = property.notes;
      if (!property.notes.trim()) {
        new_notes = prefix;
      } else if (!property.notes.includes(prefix)) {
        new_notes = `${property.notes}\n${prefix}`;
      } else {
        return property;
      }
      void fetch(`/api/properties/${propertyId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ notes: new_notes }),
      });
      return { ...property, notes: new_notes };
    }));
  }

  function update_notes(propertyId: string, new_notes: string) {
    setSaved((prev) => prev.map((item) =>
      item.id === propertyId ? { ...item, notes: new_notes } : item
    ));

    if (notes_timers.current[propertyId]) {
      clearTimeout(notes_timers.current[propertyId]);
    }
    notes_timers.current[propertyId] = setTimeout(() => {
      void fetch(`/api/properties/${propertyId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ notes: new_notes }),
      });
    }, 800);
  }

  const mapItems = sorted
    .map((property) => ({ property, coord: coordinates[property.id] }))
    .filter((item) => Boolean(item.coord));

  const unresolved = sorted.filter((property) => property.address && !coordinates[property.id]);

  // ─── Loading / Error states ───

  if (!ready) {
    if (is_retro) {
      return <main className="flex h-screen items-center justify-center" style={{ background: "#0b0f0c", color: "#74ff95", fontFamily: "monospace" }}><p>INITIALIZING SYSTEM...</p></main>;
    }
    return <main className="flex h-screen items-center justify-center"><p>Loading...</p></main>;
  }

  if (loadError) {
    return (
      <main className={`mx-auto max-w-lg p-8 ${is_retro ? "font-mono" : ""}`} style={is_retro ? { background: "#0b0f0c", color: "#d8ffe1", minHeight: "100vh" } : undefined}>
        <h1 className={`text-2xl font-bold ${is_retro ? "" : "text-red-600"}`} style={is_retro ? { color: "#d96c6c" } : undefined}>Connection Error</h1>
        <p className="mt-2">{loadError}</p>
        <button onClick={() => window.location.reload()} className={`mt-4 rounded px-4 py-2 ${is_retro ? "retro-btn" : "bg-black text-white"}`}>Retry</button>
      </main>
    );
  }

  // ─── DEFAULT THEME RENDER ───

  if (!is_retro) {
    return (
      <main className="mx-auto flex w-full max-w-7xl flex-col gap-5 p-4 md:p-8">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">House Tracker</h1>
          <select value={theme} onChange={(e) => setTheme(e.target.value as Theme)} className="rounded border p-2 text-sm">
            <option value="default">Default</option>
            <option value="retro">Retro</option>
          </select>
        </div>

        <section className="rounded border p-3">
          <h2 className="mb-2 text-lg font-semibold">Profiles</h2>
          <div className="flex flex-wrap items-center gap-2">
            <select value={activeProfileId} onChange={(event) => setActiveProfileId(event.target.value)} className="rounded border p-2">
              {profiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.name}</option>)}
            </select>
            <input value={profileNameInput} onChange={(event) => setProfileNameInput(event.target.value)} placeholder="Add profile name" className="rounded border p-2" />
            <button onClick={addProfile} className="rounded border px-3 py-2">Add Profile</button>
          </div>
        </section>

        <a href="/properties/new" className="inline-flex items-center justify-center rounded bg-black px-4 py-3 text-lg font-medium text-white active:bg-zinc-700">
          + Add Property
        </a>

        <section className="rounded border p-3">
          <h2 className="mb-2 text-lg font-semibold">Filters & Sort</h2>
          <div className="grid gap-2 md:grid-cols-5">
            <input value={filterMinBeds} onChange={(event) => setFilterMinBeds(event.target.value)} placeholder="Min beds" className="rounded border p-2" />
            <input value={filterMinBaths} onChange={(event) => setFilterMinBaths(event.target.value)} placeholder="Min baths" className="rounded border p-2" />
            <input value={filterMinCars} onChange={(event) => setFilterMinCars(event.target.value)} placeholder="Min cars" className="rounded border p-2" />
            <input value={filterPrice} onChange={(event) => setFilterPrice(event.target.value)} placeholder="Price contains" className="rounded border p-2" />
            <select value={sortBy} onChange={(event) => setSortBy(event.target.value as "priority" | "beds" | "baths" | "cars" | "price")} className="rounded border p-2">
              <option value="priority">Sort: Your priority</option>
              <option value="beds">Sort: Bedrooms</option>
              <option value="baths">Sort: Bathrooms</option>
              <option value="cars">Sort: Car spaces</option>
              <option value="price">Sort: Price</option>
            </select>
          </div>
          <button onClick={clearFilters} className="mt-2 rounded border px-3 py-2">Clear Filters</button>
        </section>

        <div className="grid gap-6 lg:grid-cols-2">
          <section className="space-y-3">
            <h2 className="text-xl font-semibold">Saved Properties ({sorted.length})</h2>
            {[...matched, ...unmatched].map((property, index) => {
              const isMatched = index < matched.length;
              return (
                <article key={property.id} ref={(node) => { cardRefs.current[property.id] = node; }} className={`rounded border p-3 ${!isMatched ? "opacity-45" : ""} ${selected?.id === property.id ? "ring-2 ring-black" : ""}`} onClick={() => setSelectedId(property.id)}>
                  <h3 className="font-medium">{property.title ?? "Untitled property"}</h3>
                  <p className="text-sm text-zinc-600">{property.address ?? property.sourceUrl}</p>
                  <p className="text-sm">{property.bedrooms ?? "?"} bed | {property.bathrooms ?? "?"} bath | {property.carSpaces ?? "?"} car</p>
                  <p className="text-sm">{property.priceText ?? "No price"}</p>
                  <div className="mt-2 flex flex-wrap gap-2 text-sm">
                    {property.realestateUrl ? <a href={property.realestateUrl} target="_blank" rel="noreferrer" className="rounded border px-2 py-1">Open realestate link</a> : null}
                    {property.domainUrl ? <a href={property.domainUrl} target="_blank" rel="noreferrer" className="rounded border px-2 py-1">Open Domain link</a> : null}
                  </div>
                  <div className="mt-2 rounded border p-2 text-sm">
                    <p className="mb-1 font-medium">Priorities</p>
                    {priorityProfiles.map((profile) => {
                      const isActive = profile.id === activeProfileId;
                      const current = isActive ? getPriority(property) : (property.rankings[profile.id] ?? 5);
                      return (
                        <div key={profile.id} className="mb-1">
                          <div className="flex items-center justify-between">
                            <span>{profile.name}</span>
                            <span>{current}/10</span>
                          </div>
                          {isActive ? (
                            <input type="range" min={1} max={10} value={current}
                              onChange={(event) => setDraftPriority((prev) => ({ ...prev, [property.id]: Number(event.target.value) }))}
                              onMouseUp={() => commitPriority(property.id)}
                              onTouchEnd={() => commitPriority(property.id)}
                              onKeyUp={() => commitPriority(property.id)}
                              className="w-full" />
                          ) : (
                            <div className="h-2 w-full rounded bg-zinc-200">
                              <div className="h-2 rounded bg-zinc-400" style={{ width: `${(current / 10) * 100}%` }} />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  <div className="mt-2 space-y-2">
                    <div className="flex gap-2">
                      <button onClick={() => ensureAuthorPrefix(property.id)} className="rounded border px-3 py-1 text-sm">Insert My Name</button>
                    </div>
                    <textarea value={property.notes} onChange={(event) => update_notes(property.id, event.target.value)} className="w-full rounded border p-2 text-sm" rows={5} placeholder="Shared notes (editable by everyone)" />
                  </div>
                  <button onClick={() => removeProperty(property.id)} className="mt-2 text-sm text-red-600">Remove</button>
                </article>
              );
            })}
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold">Map (All Saved Addresses)</h2>
            <div className="relative h-[460px] w-full overflow-hidden rounded border">
              <PropertyMap
                items={mapItems.map((item) => ({ id: item.property.id, title: item.property.title, address: item.property.address, lat: item.coord!.lat, lon: item.coord!.lon }))}
                selectedId={selected?.id ?? null}
                onSelect={(id) => { setSelectedId(id); cardRefs.current[id]?.scrollIntoView({ behavior: "smooth", block: "center" }); }}
              />
            </div>
            {!!unresolved.length && (
              <div className="rounded border p-2 text-sm">
                <p className="font-medium">Addresses waiting for map coordinates:</p>
                {unresolved.map((property) => (
                  <div key={property.id} className="mt-1 flex items-center justify-between gap-2">
                    <span>{property.address}</span>
                    <button onClick={() => { geocode_failed.current.delete(property.id); void geocodeProperty(property); }} className="rounded border px-2 py-1">Retry</button>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </main>
    );
  }

  // ─── RETRO THEME RENDER ───

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 p-4 md:p-8 font-mono">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-widest" style={{ color: "var(--retro-accent)" }}>
            HOUSE TRACKER <span style={{ color: "var(--retro-text-dim)" }}>//</span> PROPERTY COMMAND
          </h1>
          <p className="mt-1 text-xs" style={{ color: "var(--retro-text-dim)" }}>
            Shared shortlist / {profiles.length} operator{profiles.length !== 1 ? "s" : ""} active
          </p>
        </div>
        <select value={theme} onChange={(e) => setTheme(e.target.value as Theme)} className="retro-input rounded px-2 py-1 text-xs">
          <option value="default">Default</option>
          <option value="retro">Retro</option>
        </select>
      </div>

      {/* Operators Panel */}
      <section className="retro-panel rounded p-4">
        <p className="retro-heading mb-3">ACTIVE OPERATORS</p>
        <div className="flex flex-wrap items-center gap-2">
          {profiles.map((profile) => (
            <button
              key={profile.id}
              onClick={() => setActiveProfileId(profile.id)}
              className={`rounded px-3 py-1.5 text-xs font-bold tracking-wide transition-all ${
                profile.id === activeProfileId
                  ? "border-2"
                  : "border opacity-60"
              }`}
              style={{
                borderColor: profile.id === activeProfileId ? "var(--retro-accent)" : "var(--retro-border)",
                color: profile.id === activeProfileId ? "var(--retro-accent)" : "var(--foreground)",
                background: profile.id === activeProfileId ? "rgba(116, 255, 149, 0.08)" : "transparent",
              }}
            >
              {profile.name.toUpperCase()}
            </button>
          ))}
          <div className="flex items-center gap-1">
            <input
              value={profileNameInput}
              onChange={(event) => setProfileNameInput(event.target.value)}
              placeholder="New operator..."
              className="retro-input rounded px-2 py-1.5 text-xs w-28"
            />
            <button onClick={addProfile} className="retro-btn rounded px-2 py-1.5 text-xs">+</button>
          </div>
        </div>
      </section>

      {/* Add Property Command Button */}
      <a href="/properties/new" className="retro-btn-primary inline-flex items-center justify-center rounded px-6 py-3 text-base tracking-wider">
        [ + ADD PROPERTY ]
      </a>

      {/* Filters */}
      <section className="retro-panel rounded p-4">
        <p className="retro-heading mb-3">SYSTEM CONTROLS</p>
        <div className="grid gap-3 md:grid-cols-5">
          <div>
            <p className="retro-label">MIN BEDS</p>
            <input value={filterMinBeds} onChange={(event) => setFilterMinBeds(event.target.value)} placeholder="—" className="retro-input w-full rounded px-2 py-2 text-sm" />
          </div>
          <div>
            <p className="retro-label">MIN BATHS</p>
            <input value={filterMinBaths} onChange={(event) => setFilterMinBaths(event.target.value)} placeholder="—" className="retro-input w-full rounded px-2 py-2 text-sm" />
          </div>
          <div>
            <p className="retro-label">MIN CARS</p>
            <input value={filterMinCars} onChange={(event) => setFilterMinCars(event.target.value)} placeholder="—" className="retro-input w-full rounded px-2 py-2 text-sm" />
          </div>
          <div>
            <p className="retro-label">PRICE FILTER</p>
            <input value={filterPrice} onChange={(event) => setFilterPrice(event.target.value)} placeholder="—" className="retro-input w-full rounded px-2 py-2 text-sm" />
          </div>
          <div>
            <p className="retro-label">SORT BY</p>
            <select value={sortBy} onChange={(event) => setSortBy(event.target.value as "priority" | "beds" | "baths" | "cars" | "price")} className="retro-input w-full rounded px-2 py-2 text-sm">
              <option value="priority">Priority</option>
              <option value="beds">Bedrooms</option>
              <option value="baths">Bathrooms</option>
              <option value="cars">Car spaces</option>
              <option value="price">Price</option>
            </select>
          </div>
        </div>
        <button onClick={clearFilters} className="retro-btn mt-3 rounded px-3 py-1.5 text-xs">CLEAR FILTERS</button>
      </section>

      {/* Main grid */}
      <div className="grid gap-6 lg:grid-cols-2">

        {/* Property cards */}
        <section className="space-y-4">
          <p className="retro-heading">DATA READOUT — {sorted.length} PROPERTIES</p>
          {[...matched, ...unmatched].map((property, index) => {
            const isMatched = index < matched.length;
            const isSelected = selected?.id === property.id;
            return (
              <article
                key={property.id}
                ref={(node) => { cardRefs.current[property.id] = node; }}
                className={`retro-card rounded p-4 cursor-pointer ${!isMatched ? "opacity-40" : ""} ${isSelected ? "retro-card-selected" : ""}`}
                onClick={() => setSelectedId(property.id)}
              >
                {/* Title row */}
                <h3 className="text-sm font-bold" style={{ color: "var(--retro-accent)" }}>
                  {property.title ?? "UNTITLED PROPERTY"}
                </h3>
                <p className="mt-0.5 text-xs" style={{ color: "var(--retro-text-dim)" }}>
                  {property.address ?? property.sourceUrl}
                </p>

                <div className="retro-separator" />

                {/* Price */}
                <p className="text-sm font-bold" style={{ color: "var(--retro-amber)" }}>
                  {property.priceText ?? "Price TBD"}
                </p>

                {/* Stats row */}
                <div className="mt-2 flex gap-4 text-xs" style={{ color: "var(--foreground)" }}>
                  <span>{property.bedrooms ?? "?"} BED</span>
                  <span>{property.bathrooms ?? "?"} BATH</span>
                  <span>{property.carSpaces ?? "?"} CAR</span>
                </div>

                <div className="retro-separator" />

                {/* Links */}
                {(property.realestateUrl || property.domainUrl) && (
                  <div className="flex flex-wrap gap-2 text-xs mb-2">
                    {property.realestateUrl && <a href={property.realestateUrl} target="_blank" rel="noreferrer" className="retro-link rounded border px-2 py-1">REALESTATE</a>}
                    {property.domainUrl && <a href={property.domainUrl} target="_blank" rel="noreferrer" className="retro-link rounded border px-2 py-1">DOMAIN</a>}
                  </div>
                )}

                {/* Priority / Calibration */}
                <div className="retro-panel rounded p-3 mt-2">
                  <p className="retro-heading mb-2">CALIBRATION</p>
                  {priorityProfiles.map((profile) => {
                    const isActive = profile.id === activeProfileId;
                    const current = isActive ? getPriority(property) : (property.rankings[profile.id] ?? 5);
                    return (
                      <div key={profile.id} className="mb-2">
                        <div className="flex items-center justify-between text-xs mb-0.5">
                          <span style={{ color: isActive ? "var(--retro-accent)" : "var(--retro-text-dim)" }}>
                            {profile.name.toUpperCase()}
                          </span>
                          <span style={{ color: "var(--retro-amber)" }}>{current}/10</span>
                        </div>
                        {isActive ? (
                          <input type="range" min={1} max={10} value={current}
                            onChange={(event) => setDraftPriority((prev) => ({ ...prev, [property.id]: Number(event.target.value) }))}
                            onMouseUp={() => commitPriority(property.id)}
                            onTouchEnd={() => commitPriority(property.id)}
                            onKeyUp={() => commitPriority(property.id)}
                            className="w-full" />
                        ) : (
                          <div className="h-1.5 w-full" style={{ background: "var(--retro-panel)", border: "1px solid var(--retro-border)" }}>
                            <div className="h-full" style={{ width: `${(current / 10) * 100}%`, background: "var(--retro-muted)" }} />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                <div className="retro-separator" />

                {/* Notes */}
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <button onClick={() => ensureAuthorPrefix(property.id)} className="retro-btn rounded px-2 py-1 text-xs">INSERT NAME</button>
                  </div>
                  <textarea
                    value={property.notes}
                    onChange={(event) => update_notes(property.id, event.target.value)}
                    className="retro-input w-full rounded p-2 text-xs"
                    rows={4}
                    placeholder="Shared notes..."
                  />
                </div>

                <button onClick={() => removeProperty(property.id)} className="retro-danger retro-btn mt-2 rounded px-2 py-1 text-xs">REMOVE</button>
              </article>
            );
          })}
        </section>

        {/* Map */}
        <section className="space-y-3">
          <p className="retro-heading">LOCATION GRID</p>
          <div className="retro-panel rounded overflow-hidden">
            <div className="relative h-[460px] w-full">
              <PropertyMap
                items={mapItems.map((item) => ({ id: item.property.id, title: item.property.title, address: item.property.address, lat: item.coord!.lat, lon: item.coord!.lon }))}
                selectedId={selected?.id ?? null}
                onSelect={(id) => { setSelectedId(id); cardRefs.current[id]?.scrollIntoView({ behavior: "smooth", block: "center" }); }}
              />
            </div>
            {mapItems.length > 0 && (
              <div className="px-3 py-2 text-xs" style={{ color: "var(--retro-text-dim)", borderTop: "1px solid var(--retro-border)" }}>
                {mapItems.length} coordinate{mapItems.length !== 1 ? "s" : ""} plotted
              </div>
            )}
          </div>
          {!!unresolved.length && (
            <div className="retro-panel rounded p-3 text-xs">
              <p className="retro-heading mb-2">PENDING COORDINATES</p>
              {unresolved.map((property) => (
                <div key={property.id} className="mt-1 flex items-center justify-between gap-2">
                  <span style={{ color: "var(--retro-text-dim)" }}>{property.address}</span>
                  <button onClick={() => { geocode_failed.current.delete(property.id); void geocodeProperty(property); }} className="retro-btn rounded px-2 py-0.5 text-xs">RETRY</button>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
