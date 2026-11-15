
import {
  Activity,
  Bot,
  CloudSun,
  Droplets,
  Flame,
  Globe2,
  Leaf,
  Trees,
  Wind,
  TrendingUp,
} from "lucide-react";

import CesiumGlobe from "./CesiumGlobe";
import "./App.css";

const indicators = [
  {
    title: "Forest health",
    description: "Forest cover and vegetation",
    icon: Trees,
    color: "green",
  },
  {
    title: "Air quality",
    description: "Atmospheric conditions",
    icon: Wind,
    color: "blue",
  },
  {
    title: "Water health",
    description: "Water and ocean indicators",
    icon: Droplets,
    color: "cyan",
  },
  {
    title: "Fire activity",
    description: "Detected fire activity",
    icon: Flame,
    color: "orange",
  },
];

function App() {
  return (
    <div className="app">
      <header className="topbar">
        <a className="brand" href="#overview">
          <span className="brand-icon">
            <Globe2 size={23} />
          </span>
          <span>
            <strong>EARTH DOCTOR</strong>
            <small>PLANETARY INTELLIGENCE</small>
          </span>
        </a>

        <nav className="navigation">
          <a className="active" href="#overview">Overview</a>
          <a href="#indicators">Indicators</a>
          <a href="#summary">Earth Summary</a>
        </nav>

        <div className="topbar-status">
          <span className="status-dot" />
          Earth monitoring
        </div>
      </header>

      <main className="main-content" id="overview">
        <section className="intro">
          <p className="eyebrow">OUR PLANET. ONE VIEW.</p>
          <h1>Explore the health of <span>Earth.</span></h1>
          <p className="intro-description">
            Explore our changing planet through satellite imagery,
            environmental indicators, and scientific insights.
          </p>
        </section>

        <section className="map-section">
          <div className="section-heading">
            <div>
              <p className="eyebrow">GLOBAL MONITORING</p>
              <h2>Explore Earth</h2>
            </div>
            <span className="map-tag">
              <Globe2 size={15} />
              INTERACTIVE 3D MAP
            </span>
          </div>

          <div className="map-frame">
            <CesiumGlobe />
            <div className="map-caption">
              <span>Satellite imagery basemap</span>
              <span>Drag to rotate · Scroll to zoom</span>
            </div>
          </div>
        </section>

        <section className="indicators-section" id="indicators">
          <div className="section-heading">
            <div>
              <p className="eyebrow">ENVIRONMENTAL DATA</p>
              <h2>Planet indicators</h2>
            </div>
            <span className="data-status">DATA CONNECTION PENDING</span>
          </div>

          <div className="indicator-grid">
            {indicators.map((item) => {
              const Icon = item.icon;

              return (
                <article className="indicator-card" key={item.title}>
                  <div className={`indicator-icon ${item.color}`}>
                    <Icon size={23} />
                  </div>

                  <h3>{item.title}</h3>
                  <p>{item.description}</p>

                  <div className="indicator-value">—</div>
                  <span className="indicator-note">
                    Awaiting verified data
                  </span>
                </article>
              );
            })}
          </div>
        </section>

        <section className="summary-section" id="summary">
          <div className="summary-icon">
            <Activity size={25} />
          </div>

          <div className="summary-content">
            <p className="eyebrow">PLANETARY OVERVIEW</p>
            <h2>Earth Health Summary</h2>

            <p>
              Your planetary overview will appear here once verified
              environmental datasets are connected. Earth Doctor will
              summarize important changes, highlight areas of concern,
              and explain possible environmental pressures using
              evidence-based information.
            </p>

            <div className="summary-footer">
              <span><Leaf size={15} /> Evidence-based insights</span>
              <span><TrendingUp size={15} /> Historical comparisons</span>
              <span><Bot size={15} /> AI-assisted explanations</span>
            </div>
          </div>
        </section>

        <footer className="footer">
          <span>EARTH DOCTOR AI</span>
          <span>Built to better understand our planet.</span>
        </footer>
      </main>
    </div>
  );
}

export default App;
