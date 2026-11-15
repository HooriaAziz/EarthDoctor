
import { useEffect, useRef } from "react";

import {
  Viewer,
  Cartesian3,
  Color,
  Math as CesiumMath,
  GeoJsonDataSource,
  UrlTemplateImageryProvider,
  ImageryLayer,
  ScreenSpaceEventHandler,
  ScreenSpaceEventType,
} from "cesium";

export default function CesiumGlobe({ onCountrySelect }) {
  const mapRef = useRef(null);
  const onCountrySelectRef = useRef(onCountrySelect);

  // Keep the latest callback without recreating the Cesium viewer
  onCountrySelectRef.current = onCountrySelect;

  useEffect(() => {
    if (!mapRef.current) return;

    let cancelled = false;

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

    // Country shapes
    GeoJsonDataSource.load("/data/country-shapes.geojson", {
      fill: Color.WHITE.withAlpha(0.01),
      stroke: Color.TRANSPARENT,
      clampToGround: true,
    })
      .then((dataSource) => {
        if (cancelled || viewer.isDestroyed()) return;

        viewer.dataSources.add(dataSource);
        console.log("Country shapes loaded!");
      })
      .catch((error) => {
        if (!cancelled) {
          console.error("Country shapes failed:", error);
        }
      });

    // Country selection
    const handler = new ScreenSpaceEventHandler(
      viewer.scene.canvas
    );

    handler.setInputAction((movement) => {
      const pickedObject = viewer.scene.pick(movement.position);

      if (!pickedObject || !pickedObject.id) return;

      const entity = pickedObject.id;

      if (!entity.properties) return;

      // Find country name
      const properties = entity.properties;
      const propertyNames = properties.propertyNames || [];

      const possibleNames = [
        "name",
        "NAME",
        "ADMIN",
        "name_en",
        "NAME_EN",
        "name_long",
        "NAME_LONG",
        "name_alt",
      ];

      let countryName = null;

      for (const key of possibleNames) {
        if (!propertyNames.includes(key)) continue;

        const value = properties[key].getValue();

        if (typeof value === "string" && value.trim()) {
          countryName = value.split(",")[0].trim();
          break;
        }
      }

      if (!countryName) {
        console.log("Country name not found:", propertyNames);
        return;
      }

      // Find the clicked position on Earth's surface
      const cartesian = viewer.camera.pickEllipsoid(
        movement.position,
        viewer.scene.globe.ellipsoid
      );

      if (!cartesian) {
        console.log("Could not determine clicked coordinates.");
        return;
      }



      const position = viewer.scene.globe.ellipsoid.cartesianToCartographic(
        cartesian
      );

      const latitude = CesiumMath.toDegrees(position.latitude);
      const longitude = CesiumMath.toDegrees(position.longitude);

      console.log("Selected country:", countryName);
      console.log("Clicked coordinates:", {
        latitude,
        longitude,
      });

      // Send country and coordinates to App.jsx
      onCountrySelectRef.current?.({
        name: countryName,
        latitude,
        longitude,
      });
    }, ScreenSpaceEventType.LEFT_CLICK);

    // Globe appearance
    viewer.scene.globe.enableLighting = true;
    viewer.scene.globe.showGroundAtmosphere = true;

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
      cancelled = true;
      handler.destroy();

      if (!viewer.isDestroyed()) {
        viewer.destroy();
      }
    };
  }, []);

  return <div ref={mapRef} className="cesium-map" />;
}
