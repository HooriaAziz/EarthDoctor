
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
  { id: "LEO", radius: 1.48, count: 850, color: 0x51d7ff },
  { id: "MEO", radius: 2.05, count: 350, color: 0xffc36b },
  { id: "GEO", radius: 2.65, count: 220, color: 0xb69aff },
];

function seededRandom(seed) {
  let value = seed;

  return () => {
    value = (value * 16807) % 2147483647;
    return (value - 1) / 2147483646;
  };
}

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

function createOrbitPoints(config) {
  const random = seededRandom(
    config.id === "LEO" ? 17 : config.id === "MEO" ? 41 : 83
  );

  const positions = new Float32Array(config.count * 3);

  for (let i = 0; i < config.count; i++) {
    const angle = random() * Math.PI * 2;

    const radius =
      config.radius + (random() - 0.5) * 0.16;

    const verticalSpread =
      (random() - 0.5) * 0.55;

    positions[i * 3] = Math.cos(angle) * radius;

    positions[i * 3 + 1] =
      Math.sin(angle) * radius * 0.34 + verticalSpread;

    positions[i * 3 + 2] =
      Math.sin(angle) * radius;
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

export default function OrbitalDebrisSimulation() {
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

    scene.add(
      new THREE.AmbientLight(0x9bc9ff, 1.2)
    );

    const sunlight = new THREE.DirectionalLight(
      0xffffff,
      2.2
    );

    sunlight.position.set(4, 3, 5);
    scene.add(sunlight);

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

    const atmosphere = new THREE.Mesh(
      new THREE.SphereGeometry(1.055, 64, 64),
      new THREE.MeshBasicMaterial({
        color: 0x36aaff,
        transparent: true,
        opacity: 0.12,
        side: THREE.BackSide,
      })
    );

    earthGroup.add(atmosphere);

    const orbitGroup = new THREE.Group();
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
            if (material.map) material.map.dispose();
            material.dispose();
          });
        }
      });

      renderer.dispose();

      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  useEffect(() => {
    Object.entries(orbitObjectsRef.current).forEach(
      ([orbit, objects]) => {
        objects.forEach((object) => {
          object.visible =
            activeOrbit === "all" ||
            activeOrbit === orbit;
        });
      }
    );
  }, [activeOrbit]);

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
            <span className="orbital-live-dot" />
            ILLUSTRATIVE 3D MODEL
          </p>

          <h2>Earth's orbital environment</h2>

          <p>
            Explore a visual model of the regions where
            human-made objects and orbital debris are found.
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
          EARTH · ORBITAL REGIONS
        </div>

        <div className="orbital-canvas-help">
          Drag to rotate · Scroll to zoom
        </div>
      </div>

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

      <div className="orbital-simulation-disclaimer">
        <AlertTriangle size={19} />

        <div>
          <strong>
            Simulation disclaimer — not actual debris positions
          </strong>

          <p>
            This 3D visualization is an illustrative simulation.
            The number, positions, sizes, spacing, distribution
            and movement of the displayed objects are not accurate
            representations of real orbital debris. Objects are
            generated for visualization and are not live satellite
            tracking data. Orbital regions are simplified and are
            not shown to scale. Refer to the linked ESA statistics
            for published orbital-environment estimates.
          </p>
        </div>
      </div>
    </section>
  );
}
