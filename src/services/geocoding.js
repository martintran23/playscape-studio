const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN || import.meta.env.VITE_MAPBOX_ACCESS_TOKEN;
const MAPBOX_ENDPOINT = "https://api.mapbox.com/geocoding/v5/mapbox.places";

/** Mapbox rejects very long / malformed queries with 422. */
const MAX_GEOCODING_QUERY_LENGTH = 200;

export const hasMapboxToken = Boolean(MAPBOX_TOKEN);

/** Avoid sending pasted logs, URLs, or huge strings to the Geocoding API. */
export function shouldSkipGeocodingQuery(raw) {
  const q = String(raw ?? "").trim();
  if (!q) return true;
  if (q.length > MAX_GEOCODING_QUERY_LENGTH) return true;
  if (/https?:\/\//i.test(q)) return true;
  if (/[\r\n]/.test(q)) return true;
  if (/\b(THREE\.|react-three-fiber|WebGLRenderer|Could not load|Failed to load resource|client:\d+)\b/i.test(q)) {
    return true;
  }
  return false;
}

export async function searchLocationsWithMapbox(query, signal) {
  if (shouldSkipGeocodingQuery(query)) {
    return [];
  }

  const encodedQuery = encodeURIComponent(query.trim());
  const url = `${MAPBOX_ENDPOINT}/${encodedQuery}.json?access_token=${MAPBOX_TOKEN}&autocomplete=true&limit=5`;

  const response = await fetch(url, { signal });
  if (!response.ok) {
    throw new Error("Mapbox geocoding request failed.");
  }

  const data = await response.json();
  return (data.features ?? []).map((feature) => ({
    name: feature.place_name,
    latitude: feature.center?.[1] ?? feature.geometry?.coordinates?.[1] ?? 0,
    longitude: feature.center?.[0] ?? feature.geometry?.coordinates?.[0] ?? 0,
  }));
}
