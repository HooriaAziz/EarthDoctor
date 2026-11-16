
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { AlertTriangle, RotateCcw } from "lucide-react";
import "./OrbitalDebrisSimulation.css";

const ORBIT_OPTIONS = [
  { id: "all", label: "All orbits" },
  { id: "LEO", label: "LEO" },
  { id: "MEO", label: "MEO" },
  { id: "GEO", label: "GEO" },
];

const ORBIT_CONFIG = [
  { id: "LEO", radius: 1.48, count: 850, color: 0x398cf0 },
  { id: "MEO", radius: 2.05, count: 350, color: 0x13b981 },
  { id: "GEO", radius: 2.65, count: 220, color: 0xe8b341 },
];

function seededRandom(seed) {
  let value = seed;

  return () => {
    value = (value * 16807) % 2147483647;
    return (value - 1) / 2147483646;
  };
}

// Simplified Earth texture shared by both modes.
function createEarthTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 512;

  const context = canvas.getContext("2d");

  context.fillStyle = "#123d68";
  context.fillRect(0, 0, 1024, 512);

  context.fillStyle = "#438c75";

  const continents = [
    [[120, 105], [170, 75], [235, 90], [260, 135], [225, 175], [205, 230], [160, 210], [145, 160]],
    [[245, 245], [285, 265], [300, 325], [270, 405], [235, 370], [220, 305]],
    [[420, 110], [470, 80], [535, 95], [565, 135], [535, 175], [485, 160], [450, 190], [415, 155]],
    [[470, 190], [525, 205], [550, 265], [520, 345], [480, 365], [455, 300]],
    [[585, 110], [665, 80], [750, 110], [810, 155], [775, 205], [715, 190], [680, 225], [620, 180]],
    [[690, 270], [750, 250], [790, 290], [770, 360], [725, 390], [685, 345]],
    [[845, 105], [900, 125], [930, 165], [895, 190], [850, 165]],
  ];

  continents.forEach((shape) => {
    context.beginPath();

    shape.forEach(([x, y], index) => {
      if (index === 0) {
        context.moveTo(x, y);
      } else {
        context.lineTo(x, y);
      }
    });

    context.closePath();
    context.fill();
  });

  context.strokeStyle = "rgba(180, 225, 255, 0.12)";
  context.lineWidth = 1;

  for (let y = 0; y <= 512; y += 64) {
    context.beginPath();
    context.moveTo(0, y);
    context.lineTo(1024, y);
    context.stroke();
  }

  for (let x = 0; x <= 1024; x += 64) {
    context.beginPath();
    context.moveTo(x, 0);
    context.lineTo(x, 512);
    context.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;

  return texture;
}

// Creates an illustrative false-color ozone texture.
// This is a visual simulation, not NASA measurement data.
function createOzoneTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 2048;
  canvas.height = 1024;

  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("Could not create ozone texture.");
  }

  context.clearRect(0, 0, canvas.width, canvas.height);

  // Broad color transitions across the globe.
  const latitudeGradient = context.createLinearGradient(
    0,
    0,
    0,
    canvas.height
  );

  latitudeGradient.addColorStop(
    0.0,
    "rgba(220, 91, 53, 0.68)"
  );

  latitudeGradient.addColorStop(
    0.13,
    "rgba(231, 174, 55, 0.60)"
  );

  latitudeGradient.addColorStop(
    0.27,
    "rgba(91, 183, 105, 0.49)"
  );

  latitudeGradient.addColorStop(
    0.42,
    "rgba(38, 153, 203, 0.51)"
  );

  latitudeGradient.addColorStop(
    0.57,
    "rgba(38, 153, 203, 0.51)"
  );

  latitudeGradient.addColorStop(
    0.73,
    "rgba(85, 183, 105, 0.50)"
  );

  latitudeGradient.addColorStop(
    0.86,
    "rgba(220, 174, 53, 0.57)"
  );

  latitudeGradient.addColorStop(
    1.0,
    "rgba(70, 42, 166, 0.76)"
  );

  context.fillStyle = latitudeGradient;
  context.fillRect(0, 0, canvas.width, canvas.height);

  // Illustrative lower-color region near Antarctica.
  const southernRegion = context.createRadialGradient(
    1024,
    965,
    20,
    1024,
    965,
    300
  );

  southernRegion.addColorStop(
    0,
    "rgba(48, 27, 155, 0.92)"
  );

  southernRegion.addColorStop(
    0.45,
    "rgba(66, 61, 196, 0.76)"
  );

  southernRegion.addColorStop(
    0.76,
    "rgba(39, 121, 207, 0.38)"
  );

  southernRegion.addColorStop(
    1,
    "rgba(39, 121, 207, 0)"
  );

  context.fillStyle = southernRegion;
  context.fillRect(0, 650, canvas.width, 374);

  // Soft color variations to avoid a perfectly uniform band.
  const patches = [
    {
      x: 350,
      y: 260,
      radius: 250,
      color: "rgba(234, 179, 57, 0.48)",
    },
    {
      x: 1350,
      y: 330,
      radius: 290,
      color: "rgba(72, 194, 119, 0.38)",
    },
    {
      x: 1700,
      y: 730,
      radius: 260,
      color: "rgba(231, 151, 54, 0.43)",
    },
    {
      x: 540,
      y: 790,
      radius: 220,
      color: "rgba(44, 112, 206, 0.35)",
    },
  ];

  patches.forEach((patch) => {
    const gradient = context.createRadialGradient(
      patch.x,
      patch.y,
      5,
      patch.x,
      patch.y,
      patch.radius
    );

    gradient.addColorStop(0, patch.color);
    gradient.addColorStop(1, "rgba(0, 0, 0, 0)");

    context.fillStyle = gradient;

    context.fillRect(
      patch.x - patch.radius,
      patch.y - patch.radius,
      patch.radius * 2,
      patch.radius * 2
    );
  });

  const texture = new THREE.CanvasTexture(canvas);

  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;

  return texture;
}

function createOrbitPoints(config) {
  const random = seededRandom(
    config.id === "LEO" ? 17 : config.id === "MEO" ? 41 : 83
  );

  const positions = new Float32Array(config.count * 3);

  for (let i = 0; i < config.count; i++) {
    const angle = random() * Math.PI * 2;
    const radius = config.radius + (random() - 0.5) * 0.16;
    const verticalSpread = (random() - 0.5) * 0.55;

    positions[i * 3] = Math.cos(angle) * radius;

    positions[i * 3 + 1] =
      Math.sin(angle) * radius * 0.34 + verticalSpread;

    positions[i * 3 + 2] = Math.sin(angle) * radius;
  }

  const geometry = new THREE.BufferGeometry();

  geometry.setAttribute(
    "position",
    new THREE.BufferAttribute(positions, 3)
  );

  const material = new THREE.PointsMaterial({
    color: config.color,
    size: 0.055,
    transparent: false,
    opacity: 1,
    sizeAttenuation: false,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  return new THREE.Points(geometry, material);
}

export default function OrbitalDebrisSimulation({
  mode = "debris",
}) {
  const isOzoneMode = mode === "ozone";

  const mountRef = useRef(null);
  const orbitObjectsRef = useRef({});
  const controlsRef = useRef(null);
  const cameraRef = useRef(null);

  const [activeOrbit, setActiveOrbit] = useState("all");
  const [paused, setPaused] = useState(false);

  const pausedRef = useRef(false);

  useEffect(() => {
    const container = mountRef.current;

    if (!container) return undefined;

    let animationFrame;
    let disposed = false;

    const scene = new THREE.Scene();

    const camera = new THREE.PerspectiveCamera(
      45,
      container.clientWidth / container.clientHeight || 1,
      0.1,
      100
    );

    camera.position.set(0, 3.4, 6.4);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
    });

    renderer.setPixelRatio(
      Math.min(window.devicePixelRatio, 2)
    );

    renderer.setSize(
      container.clientWidth,
      container.clientHeight
    );

    renderer.outputColorSpace = THREE.SRGBColorSpace;

    container.appendChild(renderer.domElement);

    const controls = new OrbitControls(
      camera,
      renderer.domElement
    );

    controls.enableDamping = true;
    controls.dampingFactor = 0.045;
    controls.minDistance = 3.5;
    controls.maxDistance = 10;
    controls.enablePan = false;

    controlsRef.current = controls;

    scene.add(new THREE.AmbientLight(0x9bc9ff, 1.2));

    const sunlight = new THREE.DirectionalLight(
      0xffffff,
      2.2
    );

    sunlight.position.set(4, 3, 5);
    scene.add(sunlight);

    // Shared Earth used by both modes.
    const earthGroup = new THREE.Group();
    scene.add(earthGroup);

    const earth = new THREE.Mesh(
      new THREE.SphereGeometry(1, 64, 64),
      new THREE.MeshStandardMaterial({
        map: createEarthTexture(),
        roughness: 0.95,
        metalness: 0,
      })
    );

    earthGroup.add(earth);

    // Standard atmospheric glow for the orbital debris view.
    const atmosphere = new THREE.Mesh(
      new THREE.SphereGeometry(1.055, 64, 64),
      new THREE.MeshBasicMaterial({
        color: 0x36aaff,
        transparent: true,
        opacity: 0.12,
        side: THREE.BackSide,
        depthWrite: false,
      })
    );

    atmosphere.visible = !isOzoneMode;
    earthGroup.add(atmosphere);

    // Colored ozone layer surrounding Earth.
    const ozoneShell = new THREE.Mesh(
      new THREE.SphereGeometry(1.12, 96, 96),
      new THREE.MeshBasicMaterial({
        map: createOzoneTexture(),
        transparent: true,
        opacity: 0.78,
        side: THREE.DoubleSide,
        depthWrite: false,
        blending: THREE.NormalBlending,
      })
    );

    ozoneShell.visible = isOzoneMode;
    earthGroup.add(ozoneShell);

    // Softer blue glow outside the colored ozone layer.
    const ozoneGlow = new THREE.Mesh(
      new THREE.SphereGeometry(1.22, 64, 64),
      new THREE.MeshBasicMaterial({
        color: 0x168bff,
        transparent: true,
        opacity: 0.16,
        side: THREE.DoubleSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      })
    );

    ozoneGlow.visible = isOzoneMode;
    earthGroup.add(ozoneGlow);

    // Orbital objects are only displayed in debris mode.
    const orbitGroup = new THREE.Group();

    orbitGroup.visible = !isOzoneMode;
    scene.add(orbitGroup);

    orbitObjectsRef.current = {};

    ORBIT_CONFIG.forEach((config, index) => {
      const ringGeometry = new THREE.RingGeometry(
        config.radius - 0.006,
        config.radius + 0.006,
        160
      );

      const ringMaterial = new THREE.MeshBasicMaterial({
        color: config.color,
        transparent: true,
        opacity: 0.35,
        side: THREE.DoubleSide,
      });

      const ring = new THREE.Mesh(
        ringGeometry,
        ringMaterial
      );

      ring.rotation.x = Math.PI / 2;
      ring.rotation.y = index * 0.12;

      orbitGroup.add(ring);

      const points = createOrbitPoints(config);

      points.rotation.x = index * 0.18;
      points.rotation.z = index * 0.12;

      orbitGroup.add(points);

      orbitObjectsRef.current[config.id] = [
        ring,
        points,
      ];
    });

    // Background stars shared by both views.
    const starRandom = seededRandom(2026);
    const starPositions = new Float32Array(900 * 3);

    for (let i = 0; i < 900; i++) {
      const radius = 5 + starRandom() * 8;
      const theta = starRandom() * Math.PI * 2;
      const phi = Math.acos(2 * starRandom() - 1);

      starPositions[i * 3] =
        radius * Math.sin(phi) * Math.cos(theta);

      starPositions[i * 3 + 1] =
        radius * Math.cos(phi);

      starPositions[i * 3 + 2] =
        radius * Math.sin(phi) * Math.sin(theta);
    }

    const starGeometry = new THREE.BufferGeometry();

    starGeometry.setAttribute(
      "position",
      new THREE.BufferAttribute(starPositions, 3)
    );

    const stars = new THREE.Points(
      starGeometry,
      new THREE.PointsMaterial({
        color: 0xa9cde3,
        size: 0.012,
        transparent: true,
        opacity: 0.65,
      })
    );

    scene.add(stars);

    const resizeObserver = new ResizeObserver(() => {
      if (disposed) return;

      const width = container.clientWidth;
      const height = container.clientHeight;

      if (!width || !height) return;

      camera.aspect = width / height;
      camera.updateProjectionMatrix();

      renderer.setSize(width, height);
    });

    resizeObserver.observe(container);

    const clock = new THREE.Clock();

    function animate() {
      if (disposed) return;

      animationFrame = requestAnimationFrame(animate);

      const delta = Math.min(clock.getDelta(), 0.05);

      if (!pausedRef.current) {
        earth.rotation.y += delta * 0.035;
        orbitGroup.rotation.y += delta * 0.025;
        stars.rotation.y += delta * 0.002;
      }

      controls.update();
      renderer.render(scene, camera);
    }

    animate();

    return () => {
      disposed = true;

      cancelAnimationFrame(animationFrame);
      resizeObserver.disconnect();
      controls.dispose();

      controlsRef.current = null;
      cameraRef.current = null;
      orbitObjectsRef.current = {};

      scene.traverse((object) => {
        if (object.geometry) {
          object.geometry.dispose();
        }

        if (object.material) {
          const materials = Array.isArray(object.material)
            ? object.material
            : [object.material];

          materials.forEach((material) => {
            if (material.map) {
              material.map.dispose();
            }

            material.dispose();
          });
        }
      });

      renderer.dispose();

      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [isOzoneMode]);

  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  useEffect(() => {
    Object.entries(orbitObjectsRef.current).forEach(
      ([orbit, objects]) => {
        objects.forEach((object) => {
          object.visible =
            !isOzoneMode &&
            (activeOrbit === "all" || activeOrbit === orbit);
        });
      }
    );
  }, [activeOrbit, isOzoneMode]);

  function resetView() {
    if (cameraRef.current && controlsRef.current) {
      cameraRef.current.position.set(0, 3.4, 6.4);

      controlsRef.current.target.set(0, 0, 0);
      controlsRef.current.update();
    }

    setActiveOrbit("all");
    setPaused(false);
  }

  return (
    <section className="orbital-simulation-section">
      <div className="orbital-simulation-heading">
        <div>
          <p className="orbital-simulation-eyebrow">
            {isOzoneMode
              ? "ILLUSTRATIVE ATMOSPHERIC MODEL"
              : "ILLUSTRATIVE 3D MODEL"}
          </p>

          <h2 className="panel-title">
            {isOzoneMode
              ? "Earth's ozone layer"
              : "Earth's orbital environment"}
          </h2>

          <p>
            {isOzoneMode
              ? "Explore a simplified false-color representation of ozone surrounding Earth."
              : "Explore a visual model of the regions where human-made objects and orbital debris are found."}
          </p>
        </div>

        <button
          className="orbital-reset-button"
          onClick={resetView}
          title="Reset the visualization"
          type="button"
        >
          <RotateCcw size={15} />
          Reset
        </button>
      </div>

      <div className="orbital-simulation-toolbar">
        {!isOzoneMode && (
          <div className="orbital-filter-buttons">
            {ORBIT_OPTIONS.map((option) => (
              <button
                key={option.id}
                type="button"
                className={
                  activeOrbit === option.id ? "active" : ""
                }
                onClick={() => setActiveOrbit(option.id)}
              >
                {option.label}
              </button>
            ))}
          </div>
        )}

        <button
          type="button"
          className="orbital-pause-button"
          onClick={() => setPaused((value) => !value)}
        >
          {paused ? "Resume rotation" : "Pause rotation"}
        </button>
      </div>

      <div className="orbital-canvas-wrap">
        <div
          className="orbital-canvas"
          ref={mountRef}
        />

        <div className="orbital-canvas-label">
          {isOzoneMode
            ? "EARTH · OZONE LAYER SIMULATION"
            : "EARTH · ORBITAL REGIONS"}
        </div>

        <div className="orbital-canvas-help">
          Drag to rotate · Scroll to zoom
        </div>
      </div>

      {isOzoneMode ? (
        <div className="orbital-simulation-legend">
          <div className="orbital-legend-item">
            <span
              className="orbital-legend-dot"
              style={{ backgroundColor: "#4930aa" }}
            />
            <strong>Blue / purple</strong>
            <span>Cool color zone</span>
          </div>

          <div className="orbital-legend-item">
            <span
              className="orbital-legend-dot"
              style={{ backgroundColor: "#42b98a" }}
            />
            <strong>Teal / green</strong>
            <span>Transition zone</span>
          </div>

          <div className="orbital-legend-item">
            <span
              className="orbital-legend-dot"
              style={{ backgroundColor: "#e2a638" }}
            />
            <strong>Yellow / orange</strong>
            <span>Warm color zone</span>
          </div>
        </div>
      ) : (
        <div className="orbital-simulation-legend">
          {ORBIT_CONFIG.map((orbit) => (
            <div
              className="orbital-legend-item"
              key={orbit.id}
            >
              <span
                className="orbital-legend-dot"
                style={{
                  backgroundColor: `#${orbit.color
                    .toString(16)
                    .padStart(6, "0")}`,
                }}
              />

              <strong>{orbit.id}</strong>

              <span>
                {orbit.id === "LEO"
                  ? "Low Earth Orbit"
                  : orbit.id === "MEO"
                    ? "Medium Earth Orbit"
                    : "Geostationary Orbit"}
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="orbital-simulation-disclaimer">
        <AlertTriangle size={19} />

        <div>
          <strong>
            {isOzoneMode
              ? "Illustrative ozone colors — not measured concentrations"
              : "Simulation disclaimer — not actual debris positions"}
          </strong>

          <p>
            {isOzoneMode
              ? "The colored atmospheric shell is a visual simulation. Its colors and regional patterns are artistic approximations, not actual NASA ozone measurements, Dobson Unit values, or real-time atmospheric conditions. Refer to the NASA observation maps below for measured ozone data."
              : "This 3D visualization is an illustrative simulation. The number, positions, sizes, spacing, distribution and movement of the displayed objects are not accurate representations of real orbital debris. Objects are generated for visualization and are not live satellite tracking data. Orbital regions are simplified and are not shown to scale. Refer to the linked ESA statistics for published orbital-environment estimates."}
          </p>
        </div>
      </div>
    </section>
  );
}
