import { useRemote } from "./useRemote";
import { loadGlobalTemperature, loadGml } from "../data/loaders";

// NOAA products update monthly; a 6-hour cache is ample.
const SIX_HOURS = 6 * 3600 * 1000;

export function useClimateData() {
  const temp = useRemote("ncei-global-temp", loadGlobalTemperature, { maxAgeMs: SIX_HOURS });
  const co2 = useRemote("gml-co2_mlo", (s) => loadGml("co2_mlo", s), { maxAgeMs: SIX_HOURS });
  const ch4 = useRemote("gml-ch4_gl", (s) => loadGml("ch4_gl", s), { maxAgeMs: SIX_HOURS });
  const n2o = useRemote("gml-n2o_gl", (s) => loadGml("n2o_gl", s), { maxAgeMs: SIX_HOURS });
  return { temp, co2, ch4, n2o };
}
