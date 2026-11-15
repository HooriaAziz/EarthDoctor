
import { useEffect, useRef } from "react";

import {
  Viewer,
  Cartesian3,
  Color,
  GeoJsonDataSource,
  UrlTemplateImageryProvider,
  ImageryLayer,
} from "cesium";

export default function CesiumGlobe() {
  const mapRef = useRef(null);

  useEffect(() => {
    if (!mapRef.current) return;

    const viewer = new Viewer(mapRef.current, {
      baseLayer: false,
      animation: false,
      timeline: false,
      baseLayerPicker: false,
      fullscreenButton: false,
      geocoder: false,
      homeButton: false,
      infoBox: false,
      sceneModePicker: false,
      selectionIndicator: false,
      navigationHelpButton: false,
    });

    // Satellite imagery
    const satelliteProvider = new UrlTemplateImageryProvider({
      url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      credit: "Imagery © Esri and its imagery providers",
    });

    viewer.imageryLayers.add(
      new ImageryLayer(satelliteProvider)
    );

    // Country boundary lines
   GeoJsonDataSource.load("/data/country-lines.geojson", {
  stroke: Color.fromCssColorString("#42BFFF").withAlpha(0.75),
  strokeWidth: 1.2,
  fill: Color.TRANSPARENT,
})
      .then((dataSource) => {
        viewer.dataSources.add(dataSource);
        console.log("Country boundaries loaded!");
      })
      .catch((error) => {
        console.error("Country boundaries failed:", error);
      });

    // Globe appearance
   // Globe appearance
viewer.scene.globe.enableLighting = true;
viewer.scene.globe.showGroundAtmosphere = true;

// Softer atmospheric appearance
viewer.scene.skyAtmosphere.show = true;
viewer.scene.skyAtmosphere.brightnessShift = 0.08;
viewer.scene.skyAtmosphere.saturationShift = -0.15;
viewer.scene.skyAtmosphere.hueShift = 0.0;
    // Initial camera position
    viewer.camera.setView({
      destination: Cartesian3.fromDegrees(0, 15, 22000000),
    });

    // Cleanup
    return () => {
      if (!viewer.isDestroyed()) {
        viewer.destroy();
      }
    };
  }, []);

  return <div ref={mapRef} className="cesium-map" />;
}
