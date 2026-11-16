import { useEffect, useRef } from "react";
import booleanPointInPolygon from "@turf/boolean-point-in-polygon";
import { point } from "@turf/helpers";

import {
  Viewer,
  Cartesian3,
  Color,
  Math as CesiumMath,
  Rectangle,
  GeoJsonDataSource,
  UrlTemplateImageryProvider,
  ImageryLayer,
  ScreenSpaceEventHandler,
  ScreenSpaceEventType,
  HeightReference,
  ArcType,
  VerticalOrigin,
} from "cesium";

import { EVENT_GROUP_BY_ID, classifyEvent, shapePath } from "./lib/eventTypes";

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

const BASE_COUNTRY_FILL = Color.fromCssColorString("#398CF0").withAlpha(0.01);
const HOVER_COUNTRY_FILL = Color.fromCssColorString("#398CF0").withAlpha(0.28);
const HOVER_COUNTRY_OUTLINE = Color.fromCssColorString("#9CC3F5");
const SELECTED_COUNTRY_FILL = Color.fromCssColorString("#2563D9").withAlpha(0.36);
const SELECTED_COUNTRY_OUTLINE = Color.fromCssColorString("#398CF0");

const HOME_VIEW = { longitude: 10, latitude: 18, height: 11_500_000 };

// Camera bounds for the contiguous United States.
const UNITED_STATES_MAINLAND_BOUNDS = Rectangle.fromDegrees(-126, 23, -65, 50);

const EVENT_ENTITY_PREFIX = "live-event-";

function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
  );
}

function flightDuration(seconds) {
  return prefersReducedMotion() ? 0 : seconds;
}

function addEntityToMap(map, key, entity) {
  if (!key) return;
  if (!map.has(key)) map.set(key, []);
  map.get(key).push(entity);
}

function readCountryName(properties) {
  if (!properties) return null;

  for (const key of COUNTRY_NAME_KEYS) {
    const property = properties[key];
    if (property == null) continue;

    const value =
      typeof property.getValue === "function" ? property.getValue() : property;

    if (typeof value === "string" && value.trim()) return value.trim();
  }

  return null;
}

function normalizeCountryName(name) {
  return String(name || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

const COUNTRY_ALIASES = {
  usa: ["unitedstates", "unitedstatesofamerica"],
  us: ["unitedstates", "unitedstatesofamerica"],
  unitedstates: ["usa", "us", "unitedstatesofamerica"],
  unitedstatesofamerica: ["usa", "us", "unitedstates"],
  russia: ["russianfederation"],
  russianfederation: ["russia"],
  southkorea: ["republicofkorea"],
  republicofkorea: ["southkorea"],
  northkorea: ["democraticpeoplesrepublicofkorea"],
  china: ["peoplesrepublicofchina"],
  iran: ["islamicrepublicofiran"],
  vietnam: ["vietname"],
  tanzania: ["unitedrepublicoftanzania"],
  bolivia: ["plurinationalstateofbolivia"],
  venezuela: ["bolivarianrepublicofvenezuela"],
  moldova: ["republicofmoldova"],
  syria: ["syrianarabrepublic"],
  laos: ["laopeoplesdemocraticrepublic"],
  turkey: ["turkiye"],
  czechia: ["czechrepublic"],
  myanmar: ["burma"],
  burma: ["myanmar"],
};

function getCountrySearchKeys(value) {
  const normalized = normalizeCountryName(value);
  return [normalized, ...(COUNTRY_ALIASES[normalized] || [])].filter(Boolean);
}

function isUnitedStatesTarget(target) {
  return [target?.name, target?.code].filter(Boolean).some((value) =>
    ["usa", "us", "unitedstates", "unitedstatesofamerica"].includes(
      normalizeCountryName(value)
    )
  );
}

function sanitizeGeometry(geometry) {
  if (!geometry) return geometry;

  if (geometry.type === "GeometryCollection") {
    return { ...geometry, geometries: geometry.geometries.map(sanitizeGeometry) };
  }

  function sanitizeCoordinates(coordinates) {
    if (!Array.isArray(coordinates)) return coordinates;

    if (typeof coordinates[0] === "number") {
      const [longitude, latitude, ...rest] = coordinates;
      return [longitude, Math.max(-89.9, Math.min(89.9, latitude)), ...rest];
    }

    return coordinates.map(sanitizeCoordinates);
  }

  return { ...geometry, coordinates: sanitizeCoordinates(geometry.coordinates) };
}

// Bounding box per feature so hover/click checks skip most polygons.
function computeBbox(geometry) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  function walk(coordinates) {
    if (!Array.isArray(coordinates)) return;
    if (typeof coordinates[0] === "number") {
      const [x, y] = coordinates;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
      return;
    }
    coordinates.forEach(walk);
  }

  if (geometry?.type === "GeometryCollection") {
    geometry.geometries.forEach((child) => walk(child.coordinates));
  } else {
    walk(geometry?.coordinates);
  }

  return [minX, minY, maxX, maxY];
}

const markerImageCache = new Map();

function markerImage(groupId, selected = false) {
  const key = `${groupId}:${selected}`;
  if (markerImageCache.has(key)) return markerImageCache.get(key);

  const group = EVENT_GROUP_BY_ID[groupId] || EVENT_GROUP_BY_ID.other;
  const path = shapePath(group.shape);
  const fill = group.shape === "ring" ? "none" : group.color;
  const stroke = group.shape === "ring" ? group.color : "#070B12";
  const strokeWidth = group.shape === "ring" ? 2.4 : 1.4;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 16 16">${
    selected
      ? `<circle cx="8" cy="8" r="7.3" fill="none" stroke="#F1F5F9" stroke-width="0.9"/>`
      : ""
  }<g transform="${selected ? "translate(2.4 2.4) scale(0.7)" : ""}"><path d="${path}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linejoin="round"/></g></svg>`;

  const uri = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  markerImageCache.set(key, uri);
  return uri;
}

function markerSize(event, groupId) {
  if (groupId === "earthquake" && Number.isFinite(event.magnitude)) {
    return Math.round(Math.max(10, Math.min(26, 4 + event.magnitude * 3)));
  }
  return 15;
}

export default function CesiumGlobe({
  onLocationSelect,
  onEventSelect,
  onPointerMove,
  onStatusChange,
  events = [],
  selectedEventId = null,
  selectedPoint = null,
  selectedCountryName = null,
  searchTarget = null,
  command = null,
  showLabels = true,
  dayNight = false,
}) {
  const mapRef = useRef(null);
  const viewerRef = useRef(null);
  const eventEntitiesRef = useRef(new Map());
  const callbacksRef = useRef({});
  const countryGeoJSONRef = useRef(null);
  const searchTargetRef = useRef(searchTarget);
  const countryEntityByNameRef = useRef(new Map());
  const selectedCountryEntitiesRef = useRef(new Set());
  const selectedCountryNameRef = useRef(selectedCountryName);
  const labelsLayerRef = useRef(null);
  const selectionEntityRef = useRef(null);
  const selectedEventEntityRef = useRef(null);

  useEffect(() => {
    callbacksRef.current = {
      onLocationSelect,
      onEventSelect,
      onPointerMove,
      onStatusChange,
    };
  });

  function requestRender() {
    const viewer = viewerRef.current;
    if (viewer && !viewer.isDestroyed()) viewer.scene.requestRender();
  }

  function applySelectedCountryStyle(entity) {
    const polygon = entity.polygon;
    polygon.show = true;
    polygon.fill = true;
    polygon.material = SELECTED_COUNTRY_FILL;
    polygon.outline = true;
    polygon.outlineColor = SELECTED_COUNTRY_OUTLINE;
    polygon.height = COUNTRY_OVERLAY_HEIGHT;
  }

  function applyBaseCountryStyle(entity) {
    const polygon = entity.polygon;
    polygon.material = BASE_COUNTRY_FILL;
    polygon.outline = false;
    polygon.outlineColor = Color.TRANSPARENT;
    polygon.height = COUNTRY_OVERLAY_HEIGHT;
  }

  function findCountryEntities(values) {
    const entityMap = countryEntityByNameRef.current;
    if (!entityMap.size) return [];

    for (const key of values.filter(Boolean).flatMap(getCountrySearchKeys)) {
      const matches = entityMap.get(key);
      if (matches?.length) return matches;
    }

    return [];
  }

  function syncSelectedCountry(name) {
    for (const entity of selectedCountryEntitiesRef.current) {
      if (entity.polygon) applyBaseCountryStyle(entity);
    }

    const entities = name ? findCountryEntities([name]) : [];
    selectedCountryEntitiesRef.current = new Set(entities);

    for (const entity of entities) {
      if (entity.polygon) applySelectedCountryStyle(entity);
    }

    requestRender();
  }

  function zoomToSearchedCountry(target) {
    const viewer = viewerRef.current;
    if (!target || !viewer || viewer.isDestroyed()) return;

    if (isUnitedStatesTarget(target)) {
      viewer.camera.flyTo({
        destination: UNITED_STATES_MAINLAND_BOUNDS,
        duration: flightDuration(1.6),
      });
      return;
    }

    const matchingEntities = findCountryEntities([target.name, target.code]);

    if (matchingEntities.length === 0) {
      console.warn("No matching country polygon was found for:", target.name);
      return;
    }

    viewer.flyTo(matchingEntities, { duration: flightDuration(1.6) });
  }

  // Create the viewer exactly once.
  useEffect(() => {
    if (!mapRef.current) return undefined;

    let cancelled = false;
    let hoveredCountryKey = null;
    let previousHoverStates = [];
    let lastHoverCheck = 0;

    const countryEntityByName = new Map();
    const countryEntityById = new Map();

    const viewer = new Viewer(mapRef.current, {
      useDefaultRenderLoop: false,
      requestRenderMode: true,
      maximumRenderTimeChange: Infinity,
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

    const cameraController = viewer.scene.screenSpaceCameraController;
    cameraController.enableCollisionDetection = true;
    cameraController.minimumZoomDistance = 150_000;
    cameraController.maximumZoomDistance = 40_000_000;
    cameraController.maximumTiltAngle = Math.PI / 2;

    // Only render once the container has real dimensions.
    const mapResizeObserver = new ResizeObserver(() => {
      if (cancelled || viewer.isDestroyed()) return;
      const container = mapRef.current;
      if (!container) return;

      const rect = container.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) {
        viewer.useDefaultRenderLoop = false;
        return;
      }

      viewer.resize();
      viewer.useDefaultRenderLoop = true;
      viewer.scene.requestRender();
    });

    mapResizeObserver.observe(mapRef.current);

    viewer.imageryLayers.add(
      new ImageryLayer(
        new UrlTemplateImageryProvider({
          url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
          credit: "Imagery © Esri and its imagery providers",
          maximumLevel: 19,
        })
      )
    );

    const labelsLayer = new ImageryLayer(
      new UrlTemplateImageryProvider({
        url: "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}",
        credit: "Boundaries & places © Esri",
        maximumLevel: 19,
      })
    );
    labelsLayer.alpha = 0.9;
    viewer.imageryLayers.add(labelsLayer);
    labelsLayerRef.current = labelsLayer;

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
        const [minX, minY, maxX, maxY] = feature.bbox || [];
        if (
          longitude < minX ||
          longitude > maxX ||
          latitude < minY ||
          latitude > maxY
        ) {
          continue;
        }

        try {
          if (booleanPointInPolygon(mapPoint, feature)) return feature;
        } catch {
          // Skip malformed features without breaking map interaction.
        }
      }

      return null;
    }

    function clearHoveredCountry() {
      for (const state of previousHoverStates) {
        const entity = state.entity;
        if (!entity?.polygon) continue;

        if (selectedCountryEntitiesRef.current.has(entity)) {
          applySelectedCountryStyle(entity);
        } else {
          applyBaseCountryStyle(entity);
        }
      }

      previousHoverStates = [];
      hoveredCountryKey = null;

      if (!viewer.isDestroyed()) {
        viewer.scene.canvas.style.cursor = "";
        viewer.scene.requestRender();
      }
    }

    function highlightCountry(entities, countryName) {
      const validEntities = entities.filter((entity) => entity?.polygon);
      if (validEntities.length === 0) return;

      const countryKey = normalizeCountryName(countryName);
      if (hoveredCountryKey === countryKey) return;

      clearHoveredCountry();
      hoveredCountryKey = countryKey;
      previousHoverStates = validEntities.map((entity) => ({ entity }));

      for (const entity of validEntities) {
        entity.polygon.show = true;
        entity.polygon.fill = true;
        entity.polygon.material = selectedCountryEntitiesRef.current.has(entity)
          ? SELECTED_COUNTRY_FILL
          : HOVER_COUNTRY_FILL;
        entity.polygon.outline = true;
        entity.polygon.outlineColor = HOVER_COUNTRY_OUTLINE;
      }

      viewer.scene.requestRender();
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

        const safeGeoJSON = {
          ...geojson,
          features: geojson.features.map((feature) => {
            const geometry = sanitizeGeometry(feature.geometry);
            return { ...feature, geometry, bbox: computeBbox(geometry) };
          }),
        };

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

          entity.polygon.arcType = ArcType.GEODESIC;
          entity.polygon.height = COUNTRY_OVERLAY_HEIGHT;

          const entityName = readCountryName(entity.properties) || entity.name || "";
          addEntityToMap(countryEntityByName, normalizeCountryName(entityName), entity);

          if (entity.id != null) {
            addEntityToMap(countryEntityById, String(entity.id), entity);
          }
        }

        countryEntityByNameRef.current = countryEntityByName;
        viewer.dataSources.add(dataSource);

        // Apply state that arrived while the shapes were loading.
        if (selectedCountryNameRef.current) {
          syncSelectedCountry(selectedCountryNameRef.current);
        }
        if (searchTargetRef.current) {
          zoomToSearchedCountry(searchTargetRef.current);
        }

        callbacksRef.current.onStatusChange?.({ countries: "ready" });
        viewer.scene.requestRender();
      } catch (error) {
        if (!cancelled) {
          console.error("Country shapes failed:", error);
          callbacksRef.current.onStatusChange?.({ countries: "error" });
        }
      }
    }

    loadCountryShapes();

    const handler = new ScreenSpaceEventHandler(viewer.scene.canvas);

    handler.setInputAction((movement) => {
      const now = Date.now();
      if (now - lastHoverCheck < 50) return;
      lastHoverCheck = now;

      const coordinates = getSurfaceCoordinates(movement.endPosition);

      if (!coordinates) {
        clearHoveredCountry();
        callbacksRef.current.onPointerMove?.(null);
        return;
      }

      // Event markers take priority over country hover.
      const picked = viewer.scene.pick(movement.endPosition);
      const pickedId = picked?.id?.id;
      if (typeof pickedId === "string" && pickedId.startsWith(EVENT_ENTITY_PREFIX)) {
        clearHoveredCountry();
        viewer.scene.canvas.style.cursor = "pointer";
        callbacksRef.current.onPointerMove?.({
          ...coordinates,
          label: picked.id.name || null,
        });
        return;
      }

      const feature = findCountryFeature(coordinates.latitude, coordinates.longitude);
      const countryName = feature
        ? readCountryName(feature.properties) || null
        : null;

      callbacksRef.current.onPointerMove?.({ ...coordinates, label: countryName });

      if (!feature) {
        clearHoveredCountry();
        viewer.scene.canvas.style.cursor = "crosshair";
        return;
      }

      const featureId = feature.id == null ? null : String(feature.id);
      const matchingEntities = [
        ...new Set([
          ...(countryEntityByName.get(normalizeCountryName(countryName)) || []),
          ...(featureId ? countryEntityById.get(featureId) || [] : []),
        ]),
      ];

      if (matchingEntities.length === 0) {
        clearHoveredCountry();
        return;
      }

      highlightCountry(matchingEntities, countryName || featureId);
      viewer.scene.canvas.style.cursor = "pointer";
    }, ScreenSpaceEventType.MOUSE_MOVE);

    handler.setInputAction((movement) => {
      const picked = viewer.scene.pick(movement.position);
      const pickedId = picked?.id?.id;

      if (typeof pickedId === "string" && pickedId.startsWith(EVENT_ENTITY_PREFIX)) {
        callbacksRef.current.onEventSelect?.(pickedId.slice(EVENT_ENTITY_PREFIX.length));
        return;
      }

      // Clicking the current selection markers is not a new selection.
      if (pickedId === "selected-event" || pickedId === "selected-location") return;

      const coordinates = getSurfaceCoordinates(movement.position);
      if (!coordinates) return;

      const feature = findCountryFeature(coordinates.latitude, coordinates.longitude);

      // Points outside any country polygon (e.g. open ocean) are still
      // valid locations for model weather and air-quality data.
      callbacksRef.current.onLocationSelect?.({
        name: feature ? readCountryName(feature.properties) : null,
        latitude: coordinates.latitude,
        longitude: coordinates.longitude,
      });
    }, ScreenSpaceEventType.LEFT_CLICK);

    const handleCanvasLeave = () => {
      clearHoveredCountry();
      callbacksRef.current.onPointerMove?.(null);
    };

    viewer.scene.canvas.addEventListener("mouseleave", handleCanvasLeave);

    const scene = viewer.scene;
    scene.globe.enableLighting = false;
    scene.globe.showGroundAtmosphere = true;
    scene.globe.baseColor = Color.fromCssColorString("#0B1A2E");
    scene.skyAtmosphere.show = true;
    scene.skyAtmosphere.brightnessShift = 0.05;
    scene.skyAtmosphere.saturationShift = -0.1;
    scene.backgroundColor = Color.fromCssColorString("#05080D");
    if (scene.sun) scene.sun.show = false;
    if (scene.moon) scene.moon.show = false;

    viewer.camera.setView({
      destination: Cartesian3.fromDegrees(
        HOME_VIEW.longitude,
        HOME_VIEW.latitude,
        HOME_VIEW.height
      ),
    });

    const eventEntities = eventEntitiesRef.current;

    return () => {
      cancelled = true;
      mapResizeObserver.disconnect();
      clearHoveredCountry();
      viewer.scene.canvas.removeEventListener("mouseleave", handleCanvasLeave);

      if (!handler.isDestroyed()) handler.destroy();

      eventEntities.clear();
      countryEntityByNameRef.current = new Map();
      selectedCountryEntitiesRef.current = new Set();
      selectionEntityRef.current = null;
      selectedEventEntityRef.current = null;
      labelsLayerRef.current = null;
      viewerRef.current = null;

      if (!viewer.isDestroyed()) viewer.destroy();
    };
    // The viewer is created once; later props are applied by the effects below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Country search → fly to the matching polygon(s).
  useEffect(() => {
    searchTargetRef.current = searchTarget;
    if (searchTarget) zoomToSearchedCountry(searchTarget);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTarget]);

  // Persistent highlight of the selected country.
  useEffect(() => {
    selectedCountryNameRef.current = selectedCountryName;
    syncSelectedCountry(selectedCountryName);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCountryName]);

  // Camera commands from the toolbar and event explorer.
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!command || !viewer || viewer.isDestroyed()) return;

    const camera = viewer.camera;
    const height = camera.positionCartographic.height;

    switch (command.type) {
      case "zoomIn":
        camera.zoomIn(height * 0.45);
        break;
      case "zoomOut":
        camera.zoomOut(Math.min(height * 0.8, 40_000_000 - height));
        break;
      case "reset":
        camera.flyTo({
          destination: Cartesian3.fromDegrees(
            HOME_VIEW.longitude,
            HOME_VIEW.latitude,
            HOME_VIEW.height
          ),
          duration: flightDuration(1.2),
        });
        break;
      case "focus":
        if (Number.isFinite(command.latitude) && Number.isFinite(command.longitude)) {
          camera.flyTo({
            destination: Cartesian3.fromDegrees(
              command.longitude,
              command.latitude,
              command.height ?? 2_800_000
            ),
            duration: flightDuration(1.2),
          });
        }
        break;
      default:
        break;
    }

    viewer.scene.requestRender();
  }, [command]);

  // Imagery and lighting layers.
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed()) return;
    if (labelsLayerRef.current) labelsLayerRef.current.show = showLabels;
    viewer.scene.globe.enableLighting = dayNight;
    viewer.scene.requestRender();
  }, [showLabels, dayNight]);

  // Selected location marker.
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed()) return;

    if (selectionEntityRef.current) {
      viewer.entities.remove(selectionEntityRef.current);
      selectionEntityRef.current = null;
    }

    const lat = selectedPoint?.latitude;
    const lon = selectedPoint?.longitude;

    if (Number.isFinite(lat) && Number.isFinite(lon)) {
      selectionEntityRef.current = viewer.entities.add({
        id: "selected-location",
        position: Cartesian3.fromDegrees(lon, lat, 20_000),
        point: {
          pixelSize: 10,
          color: Color.fromCssColorString("#398CF0"),
          outlineColor: Color.fromCssColorString("#F1F5F9"),
          outlineWidth: 2,
          heightReference: HeightReference.NONE,
        },
      });
    }

    viewer.scene.requestRender();
  }, [selectedPoint?.latitude, selectedPoint?.longitude]);

  // Rebuild event markers when the visible event set changes.
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed()) return;

    const entities = eventEntitiesRef.current;
    for (const entity of entities.values()) viewer.entities.remove(entity);
    entities.clear();

    const positioned = (Array.isArray(events) ? events : [])
      .filter(
        (event) =>
          Number.isFinite(event.latitude) &&
          Number.isFinite(event.longitude) &&
          Math.abs(event.latitude) <= 90 &&
          Math.abs(event.longitude) <= 180
      )
      .slice(0, 400);

    for (const event of positioned) {
      const groupId = classifyEvent(event);
      const size = markerSize(event, groupId);

      const entity = viewer.entities.add({
        id: `${EVENT_ENTITY_PREFIX}${event.id}`,
        name: `${event.source}: ${event.title}`,
        position: Cartesian3.fromDegrees(event.longitude, event.latitude, 15_000),
        billboard: {
          image: markerImage(groupId),
          width: size,
          height: size,
          verticalOrigin: VerticalOrigin.CENTER,
          heightReference: HeightReference.NONE,
        },
      });

      entities.set(event.id, entity);
    }

    viewer.scene.requestRender();
  }, [events]);

  // Selected-event emphasis.
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed()) return;

    if (selectedEventEntityRef.current) {
      viewer.entities.remove(selectedEventEntityRef.current);
      selectedEventEntityRef.current = null;
    }

    const event = selectedEventId
      ? events.find((item) => item.id === selectedEventId)
      : null;

    if (event && Number.isFinite(event.latitude) && Number.isFinite(event.longitude)) {
      const groupId = classifyEvent(event);
      const size = markerSize(event, groupId) + 16;

      selectedEventEntityRef.current = viewer.entities.add({
        id: "selected-event",
        position: Cartesian3.fromDegrees(event.longitude, event.latitude, 16_000),
        billboard: {
          image: markerImage(groupId, true),
          width: size,
          height: size,
          verticalOrigin: VerticalOrigin.CENTER,
          heightReference: HeightReference.NONE,
        },
      });
    }

    viewer.scene.requestRender();
  }, [selectedEventId, events]);

  return <div ref={mapRef} className="cesium-map" />;
}
