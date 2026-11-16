
import {
  ArrowUpRight,
  FlaskConical,
  Leaf,
  ShieldCheck,
} from "lucide-react";

import "./OzoneEducation.css";

export default function OzoneEducation() {
  return (
    <section className="earthdoc-education ozone-education">
      <div className="earthdoc-education-heading">
        <span className="earthdoc-education-kicker">
          <ShieldCheck size={15} />
          UNDERSTANDING EARTH'S OZONE LAYER
        </span>

        <h2>Why should we care about the ozone layer?</h2>

        <p className="earthdoc-education-lead">
          High above Earth's surface, stratospheric ozone absorbs
          much of the Sun's harmful ultraviolet radiation.
          Protecting this layer helps protect people, plants,
          and ecosystems.
        </p>
      </div>

      <div className="ozone-education-grid">
        <article>
          <ShieldCheck size={22} />

          <h3>Ozone is Earth's protective shield</h3>

          <p>
            Ozone is a gas made of three oxygen atoms (O3).
            Most atmospheric ozone is found in the stratosphere,
            where it absorbs much of the Sun's ultraviolet-B
            radiation.
          </p>
        </article>

        <article>
          <FlaskConical size={22} />

          <h3>Some human-made chemicals destroy ozone</h3>

          <p>
            Chemicals such as chlorofluorocarbons (CFCs) and
            halons can reach the stratosphere. Ultraviolet light
            breaks them down, releasing chlorine or bromine
            compounds that participate in reactions that destroy
            ozone molecules.
          </p>
        </article>

        <article>
          <Leaf size={22} />

          <h3>The ozone hole is not a literal hole</h3>

          <p>
            The term describes a region of unusually low
            stratospheric ozone, most notably the seasonal
            Antarctic ozone hole. It is a thinning of the
            ozone layer, not an opening through the atmosphere.
          </p>
        </article>
      </div>

      <div className="ozone-education-callout">
        <h3>
          Ozone-depleting gases and greenhouse gases
          are not the same thing
        </h3>

        <p>
          CFCs are ozone-depleting substances and also powerful
          greenhouse gases. Carbon dioxide (CO2) and methane
          (CH4), by contrast, are important greenhouse gases
          but are not the main chemicals responsible for the
          Antarctic ozone hole. Nitrous oxide (N2O) is a
          greenhouse gas that also contributes to stratospheric
          ozone depletion.
        </p>
      </div>

      <div className="ozone-education-bottom">
        <ShieldCheck size={24} />

        <div>
          <h3>
            There is reason for hope — and a reason to keep monitoring
          </h3>

          <p>
            The Montreal Protocol, agreed in 1987, led countries
            to phase out many major ozone-depleting substances.
            The ozone layer is recovering gradually, although
            the pace varies by region and season. Continued
            observations help scientists assess that recovery.
          </p>
        </div>

        <a
          href="https://ozonewatch.gsfc.nasa.gov/"
          target="_blank"
          rel="noreferrer"
        >
          NASA Ozone Watch
          <ArrowUpRight size={15} />
        </a>
      </div>

      <p className="earthdoc-education-footnote">
        Scientific note: the ozone-hole area is commonly defined
        using the region where total-column ozone is below
        220 Dobson Units. This threshold measures ozone depletion;
        it is not a measurement of greenhouse-gas concentration.
      </p>
    </section>
  );
}
