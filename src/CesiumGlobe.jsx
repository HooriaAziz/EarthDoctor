import { useEffect, useRef } from "react";
import booleanPointInPolygon from "@turf/boolean-point-in-polygon";
import { point } from "@turf/helpers";

import {
  Viewer,
  Cartesian3,
  Color,
  ColorMaterialProperty,
  Math as CesiumMath,
  GeoJsonDataSource,
  UrlTemplateImageryProvider,
  ImageryLayer,
  ScreenSpaceEventHandler,
  ScreenSpaceEventType,
} from "cesium";

const COUNTRY_NAME_KEYS = [
  "name",
  "NAME",
  "ADMIN",
  "name_en",
  "NAME_EN",
  "name_long",
  "NAME_LONG",
  "name_alt",
];

const BASE_COUNTRY_FILL = Color.fromCssColorString("#42BFFF").withAlpha(0.035);
const HOVER_COUNTRY_FILL = Color.fromCssColorString("#38D5FF").withAlpha(0.48);

function readCountryName(properties) {
  if (!properties) return null;

  for (const key of COUNTRY_NAME_KEYS) {
    const property = properties[key];
    if (property == null) continue;

    const value =
      typeof property.getValue === "function" ? property.getValue() : property;

    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return null;
}

function normalizeCountryName(name) {
  return String(name || "")
    .trim()
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

export default function CesiumGlobe({ onCountrySelect }) {
  const mapRef = useRef(null);
  const onCountrySelectRef = useRef(onCountrySelect);
  const countryGeoJSONRef = useRef(null);

  // Keep the latest callback without rebuilding the Cesium viewer.
  onCountrySelectRef.current = onCountrySelect;

  useEffect(() => {
    if (!mapRef.current) return undefined;

    let cancelled = false;
    let hoveredEntity = null;
    let previousHoverMaterial = null;
    let lastHoverCheck = 0;

    const countryEntityByName = new Map();

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

    // Satellite imagery basemap.
    const satelliteProvider = new UrlTemplateImageryProvider({
      url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      credit: "Imagery © Esri and its imagery providers",
    });

    viewer.imageryLayers.add(new ImageryLayer(satelliteProvider));

    // Use the same geographic lookup for hover and click. This avoids relying
    // on Cesium's visual picking of translucent GeoJSON polygons.
    function getSurfaceCoordinates(screenPosition) {
      const cartesian = viewer.camera.pickEllipsoid(
        screenPosition,
        viewer.scene.globe.ellipsoid
      );

      if (!cartesian) return null;

      const cartographic =
        viewer.scene.globe.ellipsoid.cartesianToCartographic(cartesian);

      return {
        latitude: CesiumMath.toDegrees(cartographic.latitude),
        longitude: CesiumMath.toDegrees(cartographic.longitude),
      };
    }

    function findCountryFeature(latitude, longitude) {
      const geojson = countryGeoJSONRef.current;
      if (!geojson?.features?.length) return null;

      const clickedPoint = point([longitude, latitude]);

      return (
        geojson.features.find((feature) => {
          if (!feature?.geometry) return false;

          try {
            return booleanPointInPolygon(clickedPoint, feature);
          } catch (error) {
            console.warn("Could not check one country feature:", error);
            return false;
          }
        }) || null
      );
    }

    function clearHoveredCountry() {
      if (hoveredEntity?.polygon && previousHoverMaterial) {
        hoveredEntity.polygon.material = previousHoverMaterial;
      }

      hoveredEntity = null;
      previousHoverMaterial = null;
      viewer.scene.canvas.style.cursor = "";
    }

    function highlightCountry(entity) {
      if (!entity?.polygon || entity === hoveredEntity) return;

      clearHoveredCountry();

      hoveredEntity = entity;
      previousHoverMaterial = entity.polygon.material;
      entity.polygon.material = new ColorMaterialProperty(HOVER_COUNTRY_FILL);
      viewer.scene.canvas.style.cursor = "pointer";
    }

    // Load country shapes once. Keep the raw GeoJSON for Turf matching and
    // index Cesium entities by country name for the hover highlight.
    async function loadCountryShapes() {
      try {
        const response = await fetch("/data/country-shapes.geojson");

        if (!response.ok) {
          throw new Error(
            `Country GeoJSON request failed with HTTP ${response.status}`
          );
        }

        const geojson = await response.json();

        if (!Array.isArray(geojson.features)) {
          throw new Error("The country GeoJSON does not contain a features array.");
        }

        if (cancelled || viewer.isDestroyed()) return;

        countryGeoJSONRef.current = geojson;

        const dataSource = await GeoJsonDataSource.load(geojson, {
          fill: BASE_COUNTRY_FILL,
          stroke: Color.TRANSPARENT,
          strokeWidth: 0,
          clampToGround: false,
        });

        if (cancelled || viewer.isDestroyed()) return;

        viewer.dataSources.add(dataSource);

        for (const entity of dataSource.entities.values) {
          const countryName = readCountryName(entity.properties);
          const key = normalizeCountryName(countryName);

          if (key && entity.polygon) {
            countryEntityByName.set(key, entity);
          }
        }

        console.log("Country shapes loaded:", geojson.features.length);
        console.log("Country hover entities ready:", countryEntityByName.size);
      } catch (error) {
        if (!cancelled) {
          console.error("Country shapes failed:", error);
        }
      }
    }

    loadCountryShapes();

    const handler = new ScreenSpaceEventHandler(viewer.scene.canvas);

    // Hover: find the country under the pointer using its real coordinates,
    // then brighten the matching Cesium polygon entity.
    handler.setInputAction((movement) => {
      if (!countryGeoJSONRef.current) return;

      // Limit the geographic lookup frequency to keep mouse movement smooth.
      const now = Date.now();
      if (now - lastHoverCheck < 55) return;
      lastHoverCheck = now;

      const coordinates = getSurfaceCoordinates(movement.endPosition);

      if (!coordinates) {
        clearHoveredCountry();
        return;
      }

      const feature = findCountryFeature(
        coordinates.latitude,
        coordinates.longitude
      );

      if (!feature) {
        clearHoveredCountry();
        return;
      }

      const featureName = readCountryName(feature.properties);
      const entity = countryEntityByName.get(normalizeCountryName(featureName));

      if (!entity) {
        clearHoveredCountry();
        return;
      }

      highlightCountry(entity);
    }, ScreenSpaceEventType.MOUSE_MOVE);

    // Click: select a country and pass its name and clicked coordinates to App.jsx.
    handler.setInputAction((movement) => {
      const coordinates = getSurfaceCoordinates(movement.position);

      if (!coordinates) {
        console.log("Could not determine clicked coordinates. Click on the globe.");
        return;
      }

      const { latitude, longitude } = coordinates;
      const matchedFeature = findCountryFeature(latitude, longitude);

      if (!matchedFeature) {
        console.log("No country found at these coordinates:", coordinates);
        return;
      }

      const countryName = readCountryName(matchedFeature.properties);

      if (!countryName) {
        console.log("The matched GeoJSON feature has no country name.");
        return;
      }

      const selectedLocation = {
        name: countryName,
        latitude,
        longitude,
      };

      console.log("Selected country:", selectedLocation.name);
      console.log("Clicked coordinates:", { latitude, longitude });

      onCountrySelectRef.current?.(selectedLocation);
    }, ScreenSpaceEventType.LEFT_CLICK);

    // Globe appearance.
    viewer.scene.globe.enableLighting = true;
    viewer.scene.globe.showGroundAtmosphere = true;
    viewer.scene.skyAtmosphere.show = true;
    viewer.scene.skyAtmosphere.brightnessShift = 0.08;
    viewer.scene.skyAtmosphere.saturationShift = -0.15;

    // Initial camera position.
    viewer.camera.setView({
      destination: Cartesian3.fromDegrees(0, 15, 22000000),
    });

    // Clean up Cesium resources when React unmounts this component.
    return () => {
      cancelled = true;
      clearHoveredCountry();

      if (!handler.isDestroyed()) {
        handler.destroy();
      }

      if (!viewer.isDestroyed()) {
        viewer.destroy();
      }
    };
  }, []);

  return <div ref={mapRef} className="cesium-map" />;
}
