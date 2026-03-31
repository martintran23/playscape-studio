const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN;
const MAPBOX_ENDPOINT = "https://api.mapbox.com/geocoding/v5/mapbox.places";

export const hasMapboxToken = Boolean(MAPBOX_TOKEN);

export async function searchLocationsWithMapbox(query, signal) {
  const encodedQuery = encodeURIComponent(query);
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
