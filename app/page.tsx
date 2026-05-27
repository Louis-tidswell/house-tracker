"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";

type ImportedProperty = {
  sourceUrl: string;
  title: string | null;
  address: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  carSpaces: number | null;
  priceText: string | null;
};

type SavedProperty = ImportedProperty & {
  id: string;
  notes: string;
  rankings: Record<string, number>;
  realestateUrl: string | null;
  domainUrl: string | null;
};

type ImportResult = {
  ok: boolean;
  property?: ImportedProperty;
  error?: string;
  manualRequired?: boolean;
};

type Profile = {
  id: string;
  name: string;
};

type Coordinates = Record<string, { lat: number; lon: number }>;

const STORAGE_KEY = "house-tracker-properties-v3";
const PROFILE_STORAGE_KEY = "house-tracker-profiles-v2";
const COORDS_STORAGE_KEY = "house-tracker-coordinates-v1";
const PropertyMap = dynamic(() => import("./components/PropertyMap"), { ssr: false });

export default function Home() {
  const [address, setAddress] = useState("");
  const [realestateUrl, setRealestateUrl] = useState("");
  const [domainUrl, setDomainUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [manualRequired, setManualRequired] = useState(false);
  const [ready, setReady] = useState(false);

  const [manualTitle, setManualTitle] = useState("");
  const [manualAddress, setManualAddress] = useState("");
  const [manualPrice, setManualPrice] = useState("");
  const [manualBedrooms, setManualBedrooms] = useState("");
  const [manualBathrooms, setManualBathrooms] = useState("");
  const [manualCarSpaces, setManualCarSpaces] = useState("");

  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [profileNameInput, setProfileNameInput] = useState("");
  const [activeProfileId, setActiveProfileId] = useState("");

  const [saved, setSaved] = useState<SavedProperty[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [coordinates, setCoordinates] = useState<Coordinates>({});
  const [draftPriority, setDraftPriority] = useState<Record<string, number>>({});

  const [filterMinBeds, setFilterMinBeds] = useState("");
  const [filterMinBaths, setFilterMinBaths] = useState("");
  const [filterMinCars, setFilterMinCars] = useState("");
  const [filterPrice, setFilterPrice] = useState("");
  const [sortBy, setSortBy] = useState<"priority" | "beds" | "baths" | "cars" | "price">("priority");

  const cardRefs = useRef<Record<string, HTMLElement | null>>({});

  const activeProfile = profiles.find((profile) => profile.id === activeProfileId) ?? null;
  const priorityProfiles = useMemo(() => {
    const hasCustomProfile = profiles.some((profile) => profile.name !== "Profile 1");
    if (!hasCustomProfile) return profiles;
    return profiles.filter((profile) => profile.name !== "Profile 1");
  }, [profiles]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const savedRaw = localStorage.getItem(STORAGE_KEY);
      if (savedRaw) {
        try {
          const parsed = JSON.parse(savedRaw) as SavedProperty[];
          const migrated = parsed.map((item) => ({
            ...item,
            notes: typeof (item as { notes?: unknown }).notes === "string" ? (item as { notes?: string }).notes ?? "" : "",
          }));
          setSaved(migrated);
        } catch {
          localStorage.removeItem(STORAGE_KEY);
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

      const profilesRaw = localStorage.getItem(PROFILE_STORAGE_KEY);
      if (profilesRaw) {
        try {
          const parsed = JSON.parse(profilesRaw) as { profiles: Profile[]; activeProfileId: string };
          if (parsed.profiles.length) {
            setProfiles(parsed.profiles);
            setActiveProfileId(parsed.activeProfileId || parsed.profiles[0].id);
            setReady(true);
            return;
          }
        } catch {
          localStorage.removeItem(PROFILE_STORAGE_KEY);
        }
      }

      const defaultProfile = { id: crypto.randomUUID(), name: "Profile 1" };
      setProfiles([defaultProfile]);
      setActiveProfileId(defaultProfile.id);
      setReady(true);
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!ready) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
  }, [saved, ready]);

  useEffect(() => {
    if (!ready) return;
    localStorage.setItem(COORDS_STORAGE_KEY, JSON.stringify(coordinates));
  }, [coordinates, ready]);

  useEffect(() => {
    if (!ready || !profiles.length) return;
    localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify({ profiles, activeProfileId }));
  }, [profiles, activeProfileId, ready]);

  const geocodeProperty = useCallback(async (property: SavedProperty) => {
    if (!property.address || coordinates[property.id]) return;
    try {
      const response = await fetch(`/api/geocode?address=${encodeURIComponent(property.address)}`);
      if (!response.ok) return;
      const json = (await response.json()) as { ok: boolean; lat?: number; lon?: number };
      if (!json.ok || typeof json.lat !== "number" || typeof json.lon !== "number") return;
      setCoordinates((prev) => ({ ...prev, [property.id]: { lat: json.lat as number, lon: json.lon as number } }));
    } catch {
      // best effort only
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

  async function importProperty() {
    const targetAddress = address.trim();
    const targetRealestateUrl = realestateUrl.trim();
    const targetDomainUrl = domainUrl.trim();
    if (!targetAddress && !targetRealestateUrl && !targetDomainUrl) return;

    setLoading(true);
    setError(null);
    setStatus(null);
    setManualRequired(false);

    try {
      const response = await fetch("/api/import-property", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          address: targetAddress || undefined,
          realestateUrl: targetRealestateUrl || undefined,
          domainUrl: targetDomainUrl || undefined,
        }),
      });

      const data = (await response.json()) as ImportResult;
      if (!response.ok || !data.ok || !data.property) {
        if (data.manualRequired) {
          setManualRequired(true);
          setError(data.error ?? "No match found.");
          return;
        }
        throw new Error(data.error ?? "Import failed");
      }

      const entry: SavedProperty = {
        ...data.property,
        id: crypto.randomUUID(),
        notes: activeProfile ? `${activeProfile.name}: ` : "",
        rankings: activeProfileId ? { [activeProfileId]: 5 } : {},
        realestateUrl: targetRealestateUrl || null,
        domainUrl: targetDomainUrl || (data.property.sourceUrl.includes("domain.com.au") ? data.property.sourceUrl : null),
      };

      setSaved((prev) => [entry, ...prev]);
      setSelectedId(entry.id);
      setStatus("Imported successfully.");
      setAddress("");
      setRealestateUrl("");
      setDomainUrl("");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Import failed");
    } finally {
      setLoading(false);
    }
  }

  function addManualProperty() {
    if (!manualTitle.trim()) {
      setError("Enter at least a title for manual entry.");
      return;
    }

    const entry: SavedProperty = {
      id: crypto.randomUUID(),
      sourceUrl: domainUrl.trim() || realestateUrl.trim() || "manual-entry",
      title: manualTitle.trim(),
      address: manualAddress.trim() || address.trim() || null,
      bedrooms: manualBedrooms ? Number(manualBedrooms) : null,
      bathrooms: manualBathrooms ? Number(manualBathrooms) : null,
      carSpaces: manualCarSpaces ? Number(manualCarSpaces) : null,
      priceText: manualPrice.trim() || null,
      notes: activeProfile ? `${activeProfile.name}: ` : "",
      rankings: activeProfileId ? { [activeProfileId]: 5 } : {},
      realestateUrl: realestateUrl.trim() || null,
      domainUrl: domainUrl.trim() || null,
    };

    setSaved((prev) => [entry, ...prev]);
    setSelectedId(entry.id);
    setManualRequired(false);
    setStatus("Added manually.");
    setError(null);
    setManualTitle("");
    setManualAddress("");
    setManualPrice("");
    setManualBedrooms("");
    setManualBathrooms("");
    setManualCarSpaces("");
  }

  function removeProperty(id: string) {
    setSaved((prev) => prev.filter((item) => item.id !== id));
    if (selectedId === id) setSelectedId(null);
  }

  function commitPriority(propertyId: string) {
    const value = draftPriority[propertyId];
    if (typeof value !== "number" || !activeProfileId) return;

    setSaved((prev) => prev.map((property) =>
      property.id === propertyId
        ? { ...property, rankings: { ...property.rankings, [activeProfileId]: value } }
        : property,
    ));

    setDraftPriority((prev) => {
      const next = { ...prev };
      delete next[propertyId];
      return next;
    });
  }

  function addProfile() {
    const name = profileNameInput.trim();
    if (!name) return;
    const newProfile = { id: crypto.randomUUID(), name };
    setProfiles((prev) => [...prev, newProfile]);
    setActiveProfileId(newProfile.id);
    setProfileNameInput("");
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
      if (!property.notes.trim()) return { ...property, notes: prefix };
      if (property.notes.includes(prefix)) return property;
      return { ...property, notes: `${property.notes}\n${prefix}` };
    }));
  }

  async function importFromClipboard() {
    try {
      const clip = await navigator.clipboard.readText();
      if (!clip.trim()) {
        setError("Clipboard is empty.");
        return;
      }
      if (clip.includes("domain.com.au")) setDomainUrl(clip.trim());
      else if (clip.includes("realestate.com.au")) setRealestateUrl(clip.trim());
      else setAddress(clip.trim());
    } catch {
      setError("Clipboard read failed. Paste manually instead.");
    }
  }

  const mapItems = sorted
    .map((property) => ({ property, coord: coordinates[property.id] }))
    .filter((item) => Boolean(item.coord));

  const unresolved = sorted.filter((property) => property.address && !coordinates[property.id]);

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-5 p-4 md:p-8">
      <h1 className="text-3xl font-bold">House Tracker</h1>

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

      <section className="rounded border p-3">
        <h2 className="mb-2 text-lg font-semibold">Import</h2>
        <div className="grid gap-2 md:grid-cols-3">
          <input value={address} onChange={(event) => setAddress(event.target.value)} placeholder="Address (preferred)" className="rounded border p-3" />
          <input value={domainUrl} onChange={(event) => setDomainUrl(event.target.value)} placeholder="Domain URL" className="rounded border p-3" />
          <input value={realestateUrl} onChange={(event) => setRealestateUrl(event.target.value)} placeholder="realestate URL" className="rounded border p-3" />
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          <button onClick={() => void importProperty()} disabled={loading || (!address.trim() && !domainUrl.trim() && !realestateUrl.trim())} className="rounded bg-black px-4 py-3 text-white disabled:opacity-50">{loading ? "Importing..." : "Import Property"}</button>
          <button onClick={importFromClipboard} disabled={loading} className="rounded border px-4 py-3">Paste From Clipboard</button>
        </div>
      </section>

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

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {status ? <p className="text-sm text-green-700">{status}</p> : null}

      {manualRequired ? (
        <section className="rounded border p-3">
          <h2 className="text-lg font-semibold">Manual Entry</h2>
          <div className="grid gap-2 md:grid-cols-2">
            <input value={manualTitle} onChange={(event) => setManualTitle(event.target.value)} placeholder="Title *" className="rounded border p-2" />
            <input value={manualAddress} onChange={(event) => setManualAddress(event.target.value)} placeholder="Address" className="rounded border p-2" />
            <input value={manualPrice} onChange={(event) => setManualPrice(event.target.value)} placeholder="Price" className="rounded border p-2" />
            <div className="flex gap-2">
              <input value={manualBedrooms} onChange={(event) => setManualBedrooms(event.target.value)} placeholder="Beds" className="w-full rounded border p-2" />
              <input value={manualBathrooms} onChange={(event) => setManualBathrooms(event.target.value)} placeholder="Baths" className="w-full rounded border p-2" />
              <input value={manualCarSpaces} onChange={(event) => setManualCarSpaces(event.target.value)} placeholder="Cars" className="w-full rounded border p-2" />
            </div>
          </div>
          <button onClick={addManualProperty} className="mt-3 rounded bg-zinc-800 px-4 py-2 text-white">Save Manual Entry</button>
        </section>
      ) : null}

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
                    const current = isActive
                      ? getPriority(property)
                      : (property.rankings[profile.id] ?? 5);
                    return (
                      <div key={profile.id} className="mb-1">
                        <div className="flex items-center justify-between">
                          <span>{profile.name}</span>
                          <span>{current}/10</span>
                        </div>
                        {isActive ? (
                          <input
                            type="range"
                            min={1}
                            max={10}
                            value={current}
                            onChange={(event) =>
                              setDraftPriority((prev) => ({
                                ...prev,
                                [property.id]: Number(event.target.value),
                              }))
                            }
                            onMouseUp={() => commitPriority(property.id)}
                            onTouchEnd={() => commitPriority(property.id)}
                            onKeyUp={() => commitPriority(property.id)}
                            className="w-full"
                          />
                        ) : (
                          <div className="h-2 w-full rounded bg-zinc-200">
                            <div
                              className="h-2 rounded bg-zinc-400"
                              style={{ width: `${(current / 10) * 100}%` }}
                            />
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
                  <textarea
                    value={property.notes}
                    onChange={(event) => setSaved((prev) => prev.map((item) => item.id === property.id ? { ...item, notes: event.target.value } : item))}
                    className="w-full rounded border p-2 text-sm"
                    rows={5}
                    placeholder="Shared notes (editable by everyone)"
                  />
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
              items={mapItems.map((item) => ({
                id: item.property.id,
                title: item.property.title,
                address: item.property.address,
                lat: item.coord!.lat,
                lon: item.coord!.lon,
              }))}
              selectedId={selected?.id ?? null}
              onSelect={(id) => {
                setSelectedId(id);
                cardRefs.current[id]?.scrollIntoView({ behavior: "smooth", block: "center" });
              }}
            />
          </div>
          {!!unresolved.length ? (
            <div className="rounded border p-2 text-sm">
              <p className="font-medium">Addresses waiting for map coordinates:</p>
              {unresolved.map((property) => (
                <div key={property.id} className="mt-1 flex items-center justify-between gap-2">
                  <span>{property.address}</span>
                  <button onClick={() => void geocodeProperty(property)} className="rounded border px-2 py-1">Retry</button>
                </div>
              ))}
            </div>
          ) : null}
        </section>
      </div>
    </main>
  );
}
