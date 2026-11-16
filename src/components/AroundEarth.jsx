import { useState } from "react";
import { BookOpen } from "lucide-react";

import OrbitalDebrisSimulation from "../OrbitalDebrisSimulation";
import OzoneLayerMonitor from "../OzoneLayerMonitor";
import OrbitalDebrisMonitor from "../OrbitalDebrisMonitor";
import OzoneEducation from "../OzoneEducation";
import OrbitalDebrisEducation from "../OrbitalDebrisEducation";

const VIEWS = [
  { id: "atmosphere", label: "Atmosphere · ozone" },
  { id: "orbit", label: "Orbital environment" },
];

export default function AroundEarth() {
  const [view, setView] = useState("atmosphere");

  return (
    <div className="section-body">
      <div className="page-head">
        <div>
          <h1>Atmosphere &amp; orbital environment</h1>
          <p className="page-context">
            {view === "atmosphere"
              ? "Stratospheric ozone from NASA Ozone Watch: daily ozone-hole area, polar maps and the 1979–2025 annual record."
              : "Catalogued objects and debris in Earth orbit from ESA statistics and a CelesTrak-based historical reconstruction."}
          </p>
        </div>
        <div className="segmented" role="tablist" aria-label="Around Earth views">
          {VIEWS.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={view === item.id}
              className={view === item.id ? "is-active" : undefined}
              onClick={() => setView(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {view === "atmosphere" ? (
        <>
          <OzoneLayerMonitor visual={<OrbitalDebrisSimulation mode="ozone" />} />
          <details className="panel background-details">
            <summary>
              <BookOpen size={14} aria-hidden="true" /> Background: why the ozone layer matters
            </summary>
            <OzoneEducation />
          </details>
        </>
      ) : (
        <>
          <OrbitalDebrisMonitor visual={<OrbitalDebrisSimulation key="debris" />} />
          <details className="panel background-details">
            <summary>
              <BookOpen size={14} aria-hidden="true" /> Background: why orbital debris matters
            </summary>
            <OrbitalDebrisEducation />
          </details>
        </>
      )}
    </div>
  );
}
