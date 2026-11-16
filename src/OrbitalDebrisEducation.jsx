
import {
  AlertTriangle,
  ArrowUpRight,
  Orbit,
  ShieldCheck,
} from "lucide-react";
import "./OrbitalDebrisEducation.css";
import "./OzoneEducation.css";

export default function OrbitalDebrisEducation() {
  return (
    <section className="earthdoc-education orbital-education">
      <div className="earthdoc-education-heading">
        <span className="earthdoc-education-kicker">
          <Orbit size={15} />
          UNDERSTANDING OUR ORBITAL ENVIRONMENT
        </span>

        <h2>Why should we care about space debris?</h2>

        <p className="earthdoc-education-lead">
          Earth's orbit is a shared environment. Keeping it usable and
          safe matters to everyone who depends on satellites and
          space exploration.
        </p>
      </div>

      <div className="orbital-education-facts">
        <article>
          <strong>1957</strong>
          <h3>Beginning of the Space Age</h3>
          <p>
            Satellites and rocket stages have been launched into
            orbit for nearly seven decades.
          </p>
        </article>

        <article>
          <strong>Millions</strong>
          <h3>Smaller debris fragments</h3>
          <p>
            Many fragments are too small to be tracked individually
            and are estimated using measurements and statistical models.
          </p>
        </article>

        <article>
          <strong>High speeds</strong>
          <h3>A serious collision hazard</h3>
          <p>
            Objects in orbit travel extremely fast. Even tiny
            fragments can damage operational spacecraft.
          </p>
        </article>
      </div>

      <div className="earthdoc-education-story">
        <AlertTriangle size={23} />

        <div>
          <h3>How did the debris build up?</h3>

          <p>
            Since the first artificial satellites were launched,
            human activity has left objects in orbit. These include
            inactive spacecraft, spent rocket stages, and fragments
            created by explosions and collisions.
          </p>

          <p>
            Each breakup can produce many additional fragments.
            Over decades, this has made some orbital regions
            increasingly crowded.
          </p>

          <p>
            The danger is not limited to large objects. Debris
            travels at extremely high speeds, meaning even a small
            fragment can damage a satellite or spacecraft.
          </p>
        </div>
      </div>

      <div className="orbital-education-bottom">
        <ShieldCheck size={24} />

        <div>
          <h3>Why monitoring matters</h3>

          <p>
            NASA, ESA, and other organizations contribute to
            space surveillance, research, and debris mitigation.
            Monitoring helps satellite operators assess collision
            risks and protect spacecraft, astronauts, and the
            services we depend on.
          </p>
        </div>

        <a
          href="https://orbitaldebris.jsc.nasa.gov/"
          target="_blank"
          rel="noreferrer"
        >
          NASA Orbital Debris Program
          <ArrowUpRight size={15} />
        </a>
      </div>

      <p className="earthdoc-education-footnote">
        Not every piece of debris can be individually tracked.
        Larger objects can be monitored, while smaller debris
        populations are estimated using scientific measurements
        and statistical models.
      </p>
    </section>
  );
}
