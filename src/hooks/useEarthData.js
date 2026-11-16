import { useEffect, useState } from "react";
import { fetchLiveEarthData, fetchSelectedLocationData } from "../liveEarthData";

// Refresh cadences are per feed, not a uniform "live" interval:
// USGS summary feeds update roughly every minute and EONET irregularly,
// so a 5-minute check is adequate. Open-Meteo models update hourly at
// most, so selected-location data is re-checked every 15 minutes.
const GLOBAL_EVENT_REFRESH_MS = 5 * 60 * 1000;
const LOCATION_DATA_REFRESH_MS = 15 * 60 * 1000;

const EMPTY_LIVE_EVENTS = {
  events: [],
  sourceStatus: { eonet: "loading", usgs: "loading" },
  sourceErrors: [],
  fetchedAt: null,
};

export function useGlobalEvents() {
  const [data, setData] = useState(EMPTY_LIVE_EVENTS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    let controller = null;

    async function load() {
      controller?.abort();
      controller = new AbortController();
      setLoading(true);

      try {
        const result = await fetchLiveEarthData(controller.signal);
        if (active) setData(result);
      } catch (error) {
        if (active && error.name !== "AbortError") {
          setData((previous) => ({
            ...previous,
            sourceStatus: { eonet: "unavailable", usgs: "unavailable" },
            sourceErrors: [error.message || "Unable to load global event feeds."],
            fetchedAt: new Date().toISOString(),
          }));
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    load();
    const intervalId = window.setInterval(load, GLOBAL_EVENT_REFRESH_MS);

    return () => {
      active = false;
      window.clearInterval(intervalId);
      controller?.abort();
    };
  }, []);

  return { data, loading };
}

const IDLE_LOCATION = { status: "idle", data: null, error: null };

export function useLocationData(latitude, longitude) {
  const [state, setState] = useState(IDLE_LOCATION);
  const hasPoint =
    typeof latitude === "number" && typeof longitude === "number";

  // Reset when the selection is cleared (derived during render rather
  // than via an effect, to avoid a cascading render).
  const [trackedPoint, setTrackedPoint] = useState(null);
  const pointKey = hasPoint ? `${latitude},${longitude}` : null;
  if (pointKey !== trackedPoint) {
    setTrackedPoint(pointKey);
    if (!hasPoint) setState(IDLE_LOCATION);
  }

  useEffect(() => {
    if (!hasPoint) return undefined;

    let active = true;
    let controller = null;

    async function load() {
      controller?.abort();
      controller = new AbortController();

      setState((previous) => ({
        status: "loading",
        // Keep previous values only for a refresh of the same point.
        data: previous.data?.point === pointKey ? previous.data : null,
        error: null,
      }));

      try {
        const result = await fetchSelectedLocationData({
          latitude,
          longitude,
          signal: controller.signal,
        });

        if (!active) return;

        const weatherOk = Boolean(result.weather);
        const airOk = Boolean(result.airQuality);

        setState({
          status: weatherOk && airOk ? "loaded" : weatherOk || airOk ? "partial" : "error",
          data: { ...result, point: pointKey },
          error: weatherOk || airOk ? null : result.errors.join(" · "),
        });
      } catch (error) {
        if (active && error.name !== "AbortError") {
          setState({
            status: "error",
            data: null,
            error: error.message || "Unable to load selected-location data.",
          });
        }
      }
    }

    load();
    const intervalId = window.setInterval(load, LOCATION_DATA_REFRESH_MS);

    return () => {
      active = false;
      window.clearInterval(intervalId);
      controller?.abort();
    };
  }, [hasPoint, latitude, longitude, pointKey]);

  return state;
}
