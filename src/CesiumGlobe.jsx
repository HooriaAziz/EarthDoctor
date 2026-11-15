import { useEffect, useRef } from "react";
import booleanPointInPolygon from "@turf/boolean-point-in-polygon";
import { point } from "@turf/helpers";

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
  HeightReference,
  ArcType,
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

const COUNTRY_OVERLAY_HEIGHT = 100;
const BASE_COUNTRY_FILL = Color.fromCssColorString("#42BFFF").withAlpha(0.025);
const HOVER_COUNTRY_FILL = Color.fromCssColorString("#00D9FF").withAlpha(0.9);

function readCountryName(properties) {
  if (!properties) return null;

  for (const key of COUNTRY_NAME_KEYS) {
    const property = properties[key];
    if (property == null) continue;

    const value =
      typeof property.getValue === "function"
        ? property.getValue()
        : property;

    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return null;
}

function normalizeCountryName(name) {
  return String(name || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}
function sanitizeGeometry(geometry) {
  if (!geometry) return geometry;

  if (geometry.type === "GeometryCollection") {
    return {
      ...geometry,
      geometries: geometry.geometries.map(sanitizeGeometry),
    };
  }

  function sanitizeCoordinates(coordinates) {
    if (!Array.isArray(coordinates)) return coordinates;

    // A coordinate pair or triplet: [longitude, latitude, ...]
    if (typeof coordinates[0] === "number") {
      const [longitude, latitude, ...rest] = coordinates;

      const safeLatitude = Math.max(
        -89.9,
        Math.min(89.9, latitude)
      );

      return [longitude, safeLatitude, ...rest];
    }

    return coordinates.map(sanitizeCoordinates);
  }

  return {
    ...geometry,
    coordinates: sanitizeCoordinates(geometry.coordinates),
  };
}

function getEventColor(event) {
  const category = String(event.category || "").toLowerCase();

  if (category.includes("fire") || category.includes("volcano")) {
    return Color.fromCssColorString("#FF8A43");
  }

  if (category.includes("earthquake")) {
    return Color.fromCssColorString("#62D9FF");
  }

  if (category.includes("storm") || category.includes("flood")) {
    return Color.fromCssColorString("#8CAEFF");
  }

  return Color.fromCssColorString("#71E5CF");
}

function createGlowImage(color) {
  const [red, green, blue] = color.toBytes();
  const rgb = `rgb(${red}, ${green}, ${blue})`;

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="128" height="128">
      <defs>
        <radialGradient id="glow">
          <stop offset="0%" stop-color="${rgb}" stop-opacity="0.9"/>
          <stop offset="15%" stop-color="${rgb}" stop-opacity="0.65"/>
          <stop offset="40%" stop-color="${rgb}" stop-opacity="0.25"/>
          <stop offset="75%" stop-color="${rgb}" stop-opacity="0.07"/>
          <stop offset="100%" stop-color="${rgb}" stop-opacity="0"/>
        </radialGradient>
      </defs>
      <circle cx="64" cy="64" r="64" fill="url(#glow)"/>
    </svg>
  `;

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export default function CesiumGlobe({ onCountrySelect, liveEvents = [] }) {
  const mapRef = useRef(null);
  const viewerRef = useRef(null);
  const eventEntitiesRef = useRef([]);
  const onCountrySelectRef = useRef(onCountrySelect);
  const countryGeoJSONRef = useRef(null);

  onCountrySelectRef.current = onCountrySelect;

  useEffect(() => {
    if (!mapRef.current) return undefined;

    let cancelled = false;
    let hoveredEntity = null;

    let previousHoverMaterial;
    let previousHoverHeight;
    let previousHoverOutline;
    let previousHoverOutlineColor;
    let previousHoverFill;
    let previousHoverShow;

    let lastHoverCheck = 0;

    const countryEntityByName = new Map();
    const countryEntityById = new Map();

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

    viewerRef.current = viewer;
    const mapResizeObserver = new ResizeObserver(() => {
  if (cancelled || viewer.isDestroyed()) return;

  const container = mapRef.current;
  if (!container) return;

  const rect = container.getBoundingClientRect();

  // Never ask Cesium to render into a zero-sized container.
  if (rect.width <= 0 || rect.height <= 0) return;

  viewer.resize();
  viewer.forceResize();

  // Resume rendering if Cesium stopped after the previous error.
  viewer.useDefaultRenderLoop = true;
  viewer.scene.requestRender();
});

mapResizeObserver.observe(mapRef.current);

    const satelliteProvider = new UrlTemplateImageryProvider({
      url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      credit: "Imagery © Esri and its imagery providers",
    });

    viewer.imageryLayers.add(new ImageryLayer(satelliteProvider));

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

      const mapPoint = point([longitude, latitude]);

      for (const feature of geojson.features) {
        if (!feature?.geometry) continue;

        try {
          if (booleanPointInPolygon(mapPoint, feature)) {
            return feature;
          }
        } catch (error) {
          // Skip malformed features so one bad shape does not break map interaction.
        }
      }

      return null;
    }

    function clearHoveredCountry() {
      if (hoveredEntity?.polygon) {
        hoveredEntity.polygon.material =
          previousHoverMaterial ?? BASE_COUNTRY_FILL;
        hoveredEntity.polygon.height =
          previousHoverHeight ?? COUNTRY_OVERLAY_HEIGHT;
        hoveredEntity.polygon.outline = previousHoverOutline ?? false;
        hoveredEntity.polygon.outlineColor =
          previousHoverOutlineColor ?? Color.TRANSPARENT;
        hoveredEntity.polygon.fill = previousHoverFill ?? true;
        hoveredEntity.polygon.show = previousHoverShow ?? true;
      }

      hoveredEntity = null;
      previousHoverMaterial = undefined;
      previousHoverHeight = undefined;
      previousHoverOutline = undefined;
      previousHoverOutlineColor = undefined;
      previousHoverFill = undefined;
      previousHoverShow = undefined;
      viewer.scene.canvas.style.cursor = "";
    }

    function highlightCountry(entity, countryName) {
      if (!entity?.polygon || entity === hoveredEntity) return;

      clearHoveredCountry();
      hoveredEntity = entity;

      previousHoverMaterial = entity.polygon.material;
      previousHoverHeight = entity.polygon.height;
      previousHoverOutline = entity.polygon.outline;
      previousHoverOutlineColor = entity.polygon.outlineColor;
      previousHoverFill = entity.polygon.fill;
      previousHoverShow = entity.polygon.show;

      entity.polygon.show = true;
      entity.polygon.fill = true;
      entity.polygon.height = 5000;
      entity.polygon.material = HOVER_COUNTRY_FILL;
      entity.polygon.outline = true;
      entity.polygon.outlineColor = Color.WHITE;

      viewer.scene.canvas.style.cursor = "pointer";
      console.log("Highlighted country:", countryName);
      console.log("Polygon fill enabled:", entity.polygon.fill);
    }

   
async function loadCountryShapes() {
  try {
    const response = await fetch("/data/country-shapes.geojson");

    if (!response.ok) {
      throw new Error(`Country GeoJSON request failed: HTTP ${response.status}`);
    }

    const geojson = await response.json();

    if (!Array.isArray(geojson.features)) {
      throw new Error("Country GeoJSON has no features array.");
    }

    if (cancelled || viewer.isDestroyed()) return;

    // Correct coordinates near the poles before Cesium processes them.
    const safeGeoJSON = {
      ...geojson,
      features: geojson.features.map((feature) => ({
        ...feature,
        geometry: sanitizeGeometry(feature.geometry),
      })),
    };

    // Turf uses this same corrected dataset for country selection.
    countryGeoJSONRef.current = safeGeoJSON;

    const dataSource = await GeoJsonDataSource.load(safeGeoJSON, {
      fill: BASE_COUNTRY_FILL,
      stroke: Color.TRANSPARENT,
      strokeWidth: 0,
      clampToGround: false,
    });

    if (cancelled || viewer.isDestroyed()) return;

    for (const entity of dataSource.entities.values) {
      if (!entity.polygon) continue;

      // Explicitly use geodesic polygon edges.
      entity.polygon.arcType = ArcType.GEODESIC;
      entity.polygon.height = COUNTRY_OVERLAY_HEIGHT;

      const entityName =
        readCountryName(entity.properties) || entity.name || "";

      const nameKey = normalizeCountryName(entityName);

      if (nameKey) {
        countryEntityByName.set(nameKey, entity);
      }

      if (entity.id != null) {
        countryEntityById.set(String(entity.id), entity);
      }
    }

    viewer.dataSources.add(dataSource);

    console.log("Country shapes loaded:", safeGeoJSON.features.length);
    console.log("Country polygons ready:", countryEntityByName.size);
  } catch (error) {
    if (!cancelled) {
      console.error("Country shapes failed:", error);
    }
  }
}


    loadCountryShapes();

    const handler = new ScreenSpaceEventHandler(viewer.scene.canvas);

    handler.setInputAction((movement) => {
      if (!countryGeoJSONRef.current) return;

      const now = Date.now();
      if (now - lastHoverCheck < 45) return;
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

      const countryName =
        readCountryName(feature.properties) || feature.id || "Unknown country";
      const featureId = feature.id == null ? null : String(feature.id);
      const entity =
        (featureId && countryEntityById.get(featureId)) ||
        countryEntityByName.get(normalizeCountryName(countryName));

      if (!entity) {
        clearHoveredCountry();
        return;
      }

      highlightCountry(entity, countryName);
    }, ScreenSpaceEventType.MOUSE_MOVE);

    handler.setInputAction((movement) => {
      const coordinates = getSurfaceCoordinates(movement.position);

      if (!coordinates) {
        console.log("Could not determine clicked coordinates.");
        return;
      }

      const { latitude, longitude } = coordinates;
      const feature = findCountryFeature(latitude, longitude);

      if (!feature) {
        console.log("No country found at these coordinates:", coordinates);
        return;
      }

      const countryName = readCountryName(feature.properties);
      if (!countryName) {
        console.log("The matched GeoJSON feature has no country name.");
        return;
      }

      console.log("Selected country:", countryName);
      console.log("Clicked coordinates:", { latitude, longitude });

      onCountrySelectRef.current?.({ name: countryName, latitude, longitude });
    }, ScreenSpaceEventType.LEFT_CLICK);

    const handleCanvasLeave = () => clearHoveredCountry();
    viewer.scene.canvas.addEventListener("mouseleave", handleCanvasLeave);

    viewer.scene.globe.enableLighting = true;
    viewer.scene.globe.showGroundAtmosphere = true;
    viewer.scene.skyAtmosphere.show = true;
    viewer.scene.skyAtmosphere.brightnessShift = 0.08;
    viewer.scene.skyAtmosphere.saturationShift = -0.15;

    viewer.camera.setView({
      destination: Cartesian3.fromDegrees(0, 15, 22000000),
    });

    return () => {
      cancelled = true;
      mapResizeObserver.disconnect();
      clearHoveredCountry();
      viewer.scene.canvas.removeEventListener("mouseleave", handleCanvasLeave);

      if (!handler.isDestroyed()) handler.destroy();
      eventEntitiesRef.current = [];
      viewerRef.current = null;

      if (!viewer.isDestroyed()) viewer.destroy();
    };
  }, []);

  // Rebuild the map's live-event point layer whenever the feeds refresh.
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed()) return;

    for (const entity of eventEntitiesRef.current) {
      viewer.entities.remove(entity);
    }
    eventEntitiesRef.current = [];

    const positionedEvents = (Array.isArray(liveEvents) ? liveEvents : [])
      .filter(
        (event) =>
          Number.isFinite(event.latitude) &&
          Number.isFinite(event.longitude) &&
          event.latitude >= -90 &&
          event.latitude <= 90 &&
          event.longitude >= -180 &&
          event.longitude <= 180
      )
      .slice(0, 350);

    for (const event of positionedEvents) {
  const color = getEventColor(event);

  const glowSize = Number.isFinite(event.magnitude)
    ? Math.max(22, Math.min(34, 22 + event.magnitude * 1.2))
    : 26;

  const entity = viewer.entities.add({
    id: `live-event-${event.id}`,
    name: `${event.source}: ${event.title}`,

    position: Cartesian3.fromDegrees(
      event.longitude,
      event.latitude,
      15000
    ),

    billboard: {
      image: createGlowImage(color),
      width: glowSize,
      height: glowSize,
      heightReference: HeightReference.NONE,
    },

    point: {
      pixelSize: 3,
      color: Color.fromCssColorString("#DCEAF2").withAlpha(0.65),
outlineColor: color.withAlpha(0.35),
outlineWidth: 1,
    },
  });

  eventEntitiesRef.current.push(entity);
}

    viewer.scene.requestRender();
  }, [liveEvents]);

  return <div ref={mapRef} className="cesium-map" />;
}
