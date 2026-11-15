
import React, { useEffect, useRef, useState } from "react";
import Globe from "react-globe.gl";

export default function EarthGlobe() {
  const containerRef = useRef(null);
  const [width, setWidth] = useState(800);

  useEffect(() => {
    if (!containerRef.current) return;

    const observer = new ResizeObserver((entries) => {
      const newWidth = entries[0].contentRect.width;
      setWidth(Math.max(300, newWidth));
    });

    observer.observe(containerRef.current);

    return () => observer.disconnect();
  }, []);

  return (
    <div className="earth-globe-container" ref={containerRef}>
      <Globe
        width={width}
        height={Math.min(width * 0.72, 620)}
        backgroundColor="rgba(0,0,0,0)"
        globeImageUrl="https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg"
        bumpImageUrl="https://unpkg.com/three-globe/example/img/earth-topology.png"
        backgroundImageUrl="https://unpkg.com/three-globe/example/img/night-sky.png"
        showAtmosphere={true}
        atmosphereColor="#3a9fff"
        atmosphereAltitude={0.18}
        animateIn={true}
        enablePointerInteraction={true}
        onGlobeReady={() => console.log("Earth is ready")}
      />
    </div>
  );
}
