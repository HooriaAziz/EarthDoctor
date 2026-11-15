
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

const BASE_COUNTRY_FILL =
  Color.fromCssColorString("#42BFFF").withAlpha(0.025);

const HOVER_COUNTRY_FILL =
  Color.fromCssColorString("#00D9FF").withAlpha(0.9);

// Camera bounds for the contiguous United States.
const UNITED_STATES_MAINLAND_BOUNDS = Rectangle.fromDegrees(
  -126,
  23,
  -65,
  50
);

function addEntityToMap(map, key, entity) {
  if (!key) return;

  if (!map.has(key)) {
    map.set(key, []);
  }

  map.get(key).push(entity);
}

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

function getCountrySearchKeys(value) {
  const normalized = normalizeCountryName(value);

  const aliases = {
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

  return [
    normalized,
    ...(aliases[normalized] || []),
  ].filter(Boolean);
}

function isUnitedStatesTarget(target) {
  const values = [
    target?.name,
    target?.code,
  ].filter(Boolean);

  return values.some((value) => {
    const normalized = normalizeCountryName(value);

    return [
      "usa",
      "us",
      "unitedstates",
      "unitedstatesofamerica",
    ].includes(normalized);
  });
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

export default function CesiumGlobe({
  onCountrySelect,
  liveEvents = [],
  searchTarget = null,
}) {
  const mapRef = useRef(null);
  const viewerRef = useRef(null);
  const eventEntitiesRef = useRef([]);
  const onCountrySelectRef = useRef(onCountrySelect);
  const countryGeoJSONRef = useRef(null);
  const searchTargetRef = useRef(searchTarget);
  const countryEntityByNameRef = useRef(new Map());

  searchTargetRef.current = searchTarget;
  onCountrySelectRef.current = onCountrySelect;

  function zoomToSearchedCountry(target) {
    if (!target || !viewerRef.current) return;

    const viewer = viewerRef.current;

    if (viewer.isDestroyed()) return;

    if (isUnitedStatesTarget(target)) {
      viewer.camera.flyTo({
        destination: UNITED_STATES_MAINLAND_BOUNDS,
        duration: 2.2,
      });

      console.log("Zooming to the contiguous United States.");

      return;
    }

    const entityMap = countryEntityByNameRef.current;

    if (!entityMap.size) return;

    const searchValues = [
      target.name,
      target.code,
    ].filter(Boolean);

    const searchKeys = searchValues.flatMap(
      getCountrySearchKeys
    );

    let matchingEntities = [];

    for (const key of searchKeys) {
      const matches = entityMap.get(key);

      if (matches?.length) {
        matchingEntities = matches;
        break;
      }
    }

    if (matchingEntities.length === 0) {
      console.warn(
        "No matching country polygon was found for:",
        target.name,
        target.code
      );

      return;
    }

    viewer.flyTo(matchingEntities, {
      duration: 1.8,
    });

    console.log("Zooming to searched country:", target.name);
  }

  useEffect(() => {
    if (!mapRef.current) return undefined;

    let cancelled = false;

    let hoveredCountryKey = null;
    let previousHoverStates = [];
    let lastHoverCheck = 0;

    const countryEntityByName = new Map();
    const countryEntityById = new Map();

    // IMPORTANT:
    // Keep Cesium from rendering until the container
    // has a real width and height.
    const viewer = new Viewer(mapRef.current, {
      useDefaultRenderLoop: false,
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

    const cameraController =
      viewer.scene.screenSpaceCameraController;

    cameraController.enableCollisionDetection = true;
    cameraController.minimumZoomDistance = 6450000;
    cameraController.maximumZoomDistance = 40000000;
    cameraController.maximumTiltAngle = Math.PI / 2;

    // Observe the container so Cesium only renders
    // when the map is visible and has valid dimensions.
    const mapResizeObserver = new ResizeObserver(() => {
      if (cancelled || viewer.isDestroyed()) return;

      const container = mapRef.current;
      if (!container) return;

      const rect = container.getBoundingClientRect();

      // Stop rendering while the map is hidden.
      if (rect.width <= 0 || rect.height <= 0) {
        viewer.useDefaultRenderLoop = false;
        return;
      }

      // Resize before restarting the render loop.
      viewer.resize();

      viewer.useDefaultRenderLoop = true;
      viewer.scene.requestRender();
    });

    mapResizeObserver.observe(mapRef.current);

    const satelliteProvider = new UrlTemplateImageryProvider({
      url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      credit: "Imagery © Esri and its imagery providers",
    });

    viewer.imageryLayers.add(
      new ImageryLayer(satelliteProvider)
    );

    function getSurfaceCoordinates(screenPosition) {
      const cartesian = viewer.camera.pickEllipsoid(
        screenPosition,
        viewer.scene.globe.ellipsoid
      );

      if (!cartesian) return null;

      const cartographic =
        viewer.scene.globe.ellipsoid.cartesianToCartographic(
          cartesian
        );

      return {
        latitude: CesiumMath.toDegrees(
          cartographic.latitude
        ),
        longitude: CesiumMath.toDegrees(
          cartographic.longitude
        ),
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
          // Skip malformed features without breaking map interaction.
        }
      }

      return null;
    }

    function clearHoveredCountry() {
      for (const state of previousHoverStates) {
        const polygon = state.entity?.polygon;

        if (!polygon) continue;

        polygon.material =
          state.material ?? BASE_COUNTRY_FILL;

        polygon.height =
          state.height ?? COUNTRY_OVERLAY_HEIGHT;

        polygon.outline =
          state.outline ?? false;

        polygon.outlineColor =
          state.outlineColor ?? Color.TRANSPARENT;

        polygon.fill =
          state.fill ?? true;

        polygon.show =
          state.show ?? true;
      }

      previousHoverStates = [];
      hoveredCountryKey = null;

      if (!viewer.isDestroyed()) {
        viewer.scene.canvas.style.cursor = "";
      }
    }

    function highlightCountry(entities, countryName) {
      const validEntities = Array.isArray(entities)
        ? entities.filter((entity) => entity?.polygon)
        : [];

      if (validEntities.length === 0) return;

      const countryKey = normalizeCountryName(countryName);

      if (hoveredCountryKey === countryKey) return;

      clearHoveredCountry();

      hoveredCountryKey = countryKey;

      previousHoverStates = validEntities.map((entity) => ({
        entity,
        material: entity.polygon.material,
        height: entity.polygon.height,
        outline: entity.polygon.outline,
        outlineColor: entity.polygon.outlineColor,
        fill: entity.polygon.fill,
        show: entity.polygon.show,
      }));

      for (const entity of validEntities) {
        entity.polygon.show = true;
        entity.polygon.fill = true;
        entity.polygon.height = 5000;
        entity.polygon.material = HOVER_COUNTRY_FILL;
        entity.polygon.outline = true;
        entity.polygon.outlineColor = Color.WHITE;
      }

      viewer.scene.canvas.style.cursor = "pointer";

      console.log("Highlighted country:", countryName);
      console.log(
        "Highlighted polygon count:",
        validEntities.length
      );
    }

    async function loadCountryShapes() {
      try {
        const response = await fetch(
          "/data/country-shapes.geojson"
        );

        if (!response.ok) {
          throw new Error(
            `Country GeoJSON request failed: HTTP ${response.status}`
          );
        }

        const geojson = await response.json();

        if (!Array.isArray(geojson.features)) {
          throw new Error(
            "Country GeoJSON has no features array."
          );
        }

        if (cancelled || viewer.isDestroyed()) return;

        const safeGeoJSON = {
          ...geojson,
          features: geojson.features.map((feature) => ({
            ...feature,
            geometry: sanitizeGeometry(feature.geometry),
          })),
        };

        countryGeoJSONRef.current = safeGeoJSON;

        const dataSource = await GeoJsonDataSource.load(
          safeGeoJSON,
          {
            fill: BASE_COUNTRY_FILL,
            stroke: Color.TRANSPARENT,
            strokeWidth: 0,
            clampToGround: false,
          }
        );

        if (cancelled || viewer.isDestroyed()) return;

        for (const entity of dataSource.entities.values) {
          if (!entity.polygon) continue;

          entity.polygon.arcType = ArcType.GEODESIC;
          entity.polygon.height = COUNTRY_OVERLAY_HEIGHT;

          const entityName =
            readCountryName(entity.properties) ||
            entity.name ||
            "";

          const nameKey = normalizeCountryName(entityName);

          if (nameKey) {
            addEntityToMap(
              countryEntityByName,
              nameKey,
              entity
            );
          }

          if (entity.id != null) {
            addEntityToMap(
              countryEntityById,
              String(entity.id),
              entity
            );
          }
        }

        countryEntityByNameRef.current = countryEntityByName;

        viewer.dataSources.add(dataSource);

        const totalCountryPolygons = [
          ...countryEntityByName.values(),
        ].reduce(
          (total, entities) => total + entities.length,
          0
        );

        console.log(
          "Country shapes loaded:",
          safeGeoJSON.features.length
        );

        console.log(
          "Countries with polygons:",
          countryEntityByName.size
        );

        console.log(
          "Total country polygon entities:",
          totalCountryPolygons
        );

        const largeCountryCounts = {};

        for (const countryName of [
          "china",
          "canada",
          "russia",
          "unitedstates",
          "unitedstatesofamerica",
        ]) {
          const entities = countryEntityByName.get(countryName);

          if (entities) {
            largeCountryCounts[countryName] = entities.length;
          }
        }

        console.log(
          "Large-country polygon counts:",
          largeCountryCounts
        );

        // Run any search that happened while the GeoJSON was loading.
        if (searchTargetRef.current) {
          zoomToSearchedCountry(searchTargetRef.current);
        }

        viewer.scene.requestRender();
      } catch (error) {
        if (!cancelled) {
          console.error("Country shapes failed:", error);
        }
      }
    }

    loadCountryShapes();

    const handler = new ScreenSpaceEventHandler(
      viewer.scene.canvas
    );

    handler.setInputAction(
      (movement) => {
        if (!countryGeoJSONRef.current) return;

        const now = Date.now();

        if (now - lastHoverCheck < 45) return;

        lastHoverCheck = now;

        const coordinates = getSurfaceCoordinates(
          movement.endPosition
        );

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
          readCountryName(feature.properties) ||
          feature.id ||
          "Unknown country";

        const featureId =
          feature.id == null
            ? null
            : String(feature.id);

        const nameKey = normalizeCountryName(countryName);

        const entitiesByName =
          countryEntityByName.get(nameKey) || [];

        const entitiesById =
          featureId
            ? countryEntityById.get(featureId) || []
            : [];

        const matchingEntities = [
          ...new Set([
            ...entitiesByName,
            ...entitiesById,
          ]),
        ];

        if (matchingEntities.length === 0) {
          clearHoveredCountry();
          return;
        }

        highlightCountry(
          matchingEntities,
          countryName
        );
      },
      ScreenSpaceEventType.MOUSE_MOVE
    );

    handler.setInputAction(
      (movement) => {
        const coordinates = getSurfaceCoordinates(
          movement.position
        );

        if (!coordinates) {
          console.log(
            "Could not determine clicked coordinates."
          );
          return;
        }

        const { latitude, longitude } = coordinates;

        const feature = findCountryFeature(
          latitude,
          longitude
        );

        if (!feature) {
          console.log(
            "No country found at these coordinates:",
            coordinates
          );
          return;
        }

        const countryName = readCountryName(
          feature.properties
        );

        if (!countryName) {
          console.log(
            "The matched GeoJSON feature has no country name."
          );
          return;
        }

        console.log("Selected country:", countryName);
        console.log("Clicked coordinates:", {
          latitude,
          longitude,
        });

        onCountrySelectRef.current?.({
          name: countryName,
          latitude,
          longitude,
        });
      },
      ScreenSpaceEventType.LEFT_CLICK
    );

    const handleCanvasLeave = () => {
      clearHoveredCountry();
    };

    viewer.scene.canvas.addEventListener(
      "mouseleave",
      handleCanvasLeave
    );

    viewer.scene.globe.enableLighting = true;
    viewer.scene.globe.showGroundAtmosphere = true;

    viewer.scene.skyAtmosphere.show = true;
    viewer.scene.skyAtmosphere.brightnessShift = 0.08;
    viewer.scene.skyAtmosphere.saturationShift = -0.15;

    viewer.camera.setView({
      destination: Cartesian3.fromDegrees(
        0,
        15,
        22000000
      ),
    });

    return () => {
      cancelled = true;

      mapResizeObserver.disconnect();

      clearHoveredCountry();

      viewer.scene.canvas.removeEventListener(
        "mouseleave",
        handleCanvasLeave
      );

      if (!handler.isDestroyed()) {
        handler.destroy();
      }

      eventEntitiesRef.current = [];
      countryEntityByNameRef.current = new Map();
      viewerRef.current = null;

      if (!viewer.isDestroyed()) {
        viewer.destroy();
      }
    };
  }, []);

  // Respond to country search changes.
  useEffect(() => {
    if (!searchTarget) return;

    searchTargetRef.current = searchTarget;

    zoomToSearchedCountry(searchTarget);
  }, [searchTarget]);

  // Rebuild live-event markers when the feed changes.
  useEffect(() => {
    const viewer = viewerRef.current;

    if (!viewer || viewer.isDestroyed()) return;

    for (const entity of eventEntitiesRef.current) {
      viewer.entities.remove(entity);
    }

    eventEntitiesRef.current = [];

    const positionedEvents = (
      Array.isArray(liveEvents) ? liveEvents : []
    )
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
        ? Math.max(
            22,
            Math.min(34, 22 + event.magnitude * 1.2)
          )
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
          color: Color.fromCssColorString(
            "#DCEAF2"
          ).withAlpha(0.65),
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
