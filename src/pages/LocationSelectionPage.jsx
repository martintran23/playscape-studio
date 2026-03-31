import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import useLocationStore from "../store/locationStore";
import { hasMapboxToken, searchLocationsWithMapbox } from "../services/geocoding";

const MOCK_LOCATIONS = [
  { name: "Golden Gate Park, San Francisco", latitude: 37.7694, longitude: -122.4862 },
  { name: "Millennium Park, Chicago", latitude: 41.8826, longitude: -87.6226 },
  { name: "Zilker Metropolitan Park, Austin", latitude: 30.2669, longitude: -97.7726 },
  { name: "Balboa Park, San Diego", latitude: 32.7341, longitude: -117.1446 },
  { name: "Central Park, New York", latitude: 40.7829, longitude: -73.9654 },
];

function LocationSelectionPage() {
  const navigate = useNavigate();
  const setLocation = useLocationStore((state) => state.setLocation);
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const debounceRef = useRef(0);
  const lastRequestAtRef = useRef(0);
  const abortRef = useRef(null);

  const onSearchChange = (event) => {
    const value = event.target.value;
    setQuery(value);
    setSelectedLocation(null);
    setIsDropdownOpen(true);
  };

  useEffect(() => {
    if (debounceRef.current) {
      window.clearTimeout(debounceRef.current);
    }
    if (abortRef.current) {
      abortRef.current.abort();
    }

    const trimmed = query.trim();
    if (!trimmed) {
      setSearchResults([]);
      setIsLoading(false);
      setErrorMessage("");
      setIsDropdownOpen(false);
      return;
    }

    const runSearch = async () => {
      const elapsed = Date.now() - lastRequestAtRef.current;
      const throttleDelayMs = elapsed >= 300 ? 0 : 300 - elapsed;
      if (throttleDelayMs) {
        await new Promise((resolve) => window.setTimeout(resolve, throttleDelayMs));
      }

      setIsLoading(true);
      setErrorMessage("");
      lastRequestAtRef.current = Date.now();

      if (!hasMapboxToken) {
        const normalized = trimmed.toLowerCase();
        const fallback = MOCK_LOCATIONS.filter((location) => location.name.toLowerCase().includes(normalized)).slice(0, 5);
        setSearchResults(fallback);
        setIsLoading(false);
        return;
      }

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const results = await searchLocationsWithMapbox(trimmed, controller.signal);
        setSearchResults(results);
      } catch (error) {
        if (error.name !== "AbortError") {
          setErrorMessage("Could not fetch locations. Showing fallback suggestions.");
          const normalized = trimmed.toLowerCase();
          const fallback = MOCK_LOCATIONS.filter((location) => location.name.toLowerCase().includes(normalized)).slice(0, 5);
          setSearchResults(fallback);
        }
      } finally {
        setIsLoading(false);
      }
    };

    debounceRef.current = window.setTimeout(runSearch, 350);

    return () => {
      if (debounceRef.current) {
        window.clearTimeout(debounceRef.current);
      }
      if (abortRef.current) {
        abortRef.current.abort();
      }
    };
  }, [query]);

  const handleSelect = (location) => {
    setSelectedLocation(location);
    setQuery(location.name);
    setSearchResults([]);
    setIsDropdownOpen(false);
    setErrorMessage("");
  };

  const handleContinue = () => {
    if (!selectedLocation) return;
    setLocation(selectedLocation);
    navigate("/editor");
  };

  return (
    <div className="page-enter flex h-full w-full items-center justify-center bg-slate-100 p-6">
      <section className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-3xl font-bold text-slate-900">PlayScape Studio</h1>
        <p className="mt-2 text-slate-600">Design playgrounds in real-world locations</p>
        <p className="mt-1 text-xs text-slate-500">
          {hasMapboxToken ? "Live search powered by Mapbox Geocoding" : "Using mock search data (set VITE_MAPBOX_ACCESS_TOKEN for live geocoding)"}
        </p>

        <div className="relative mt-6">
          <input
            value={query}
            onChange={onSearchChange}
            onFocus={() => {
              if (query.trim() && !selectedLocation) {
                setIsDropdownOpen(true);
              }
            }}
            placeholder="Search location..."
            className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          />

          {isDropdownOpen && query.trim() ? (
            <div className="absolute z-10 mt-2 w-full rounded-lg border border-slate-200 bg-white shadow-lg">
              {isLoading ? (
                <p className="px-4 py-3 text-sm text-slate-500">Searching locations...</p>
              ) : searchResults.length ? (
                searchResults.map((location) => (
                  <button
                    key={location.name}
                    type="button"
                    onClick={() => handleSelect(location)}
                    className="block w-full border-b border-slate-100 px-4 py-3 text-left text-sm hover:bg-slate-50 last:border-b-0"
                  >
                    <span className="font-medium text-slate-800">{location.name}</span>
                    <span className="ml-2 text-slate-500">
                      {location.latitude.toFixed(3)}, {location.longitude.toFixed(3)}
                    </span>
                  </button>
                ))
              ) : (
                <p className="px-4 py-3 text-sm text-slate-500">No locations found.</p>
              )}
            </div>
          ) : null}
        </div>
        {errorMessage ? <p className="mt-2 text-sm text-amber-600">{errorMessage}</p> : null}

        <button
          type="button"
          onClick={handleContinue}
          disabled={!selectedLocation}
          className="mt-6 w-full rounded-lg bg-slate-900 px-4 py-3 font-medium text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          Continue
        </button>
      </section>
    </div>
  );
}

export default LocationSelectionPage;
