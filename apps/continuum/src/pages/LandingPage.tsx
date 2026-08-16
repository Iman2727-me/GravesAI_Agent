import { Link } from "react-router-dom";

export default function LandingPage() {
  return (
    <>
      <section className="hero">
        <div className="hero-inner">
          <h1>Graves Continuum</h1>
          <p>
            Watch personalized medicine happen in four easy steps — check a person,
            see their risk, peek ahead, then pick a clear treatment plan.
          </p>
          <div className="cta-row">
            <Link className="btn" to="/pick">
              Show me how it works
            </Link>
          </div>
        </div>
      </section>

      <main>
        <section className="section">
          <h2>The whole idea</h2>
          <p className="lede">
            One person. A few taps. Real science underneath — explained in plain words.
          </p>
          <div className="blueprint">
            {[
              "Check their body signals",
              "See if they’re at higher risk",
              "Peek at what might happen next",
              "Choose the clearest treatment option",
            ].map((step, i) => (
              <div className="blueprint-item" key={step}>
                <div className="step-num">{i + 1}</div>
                <div>{step}</div>
              </div>
            ))}
          </div>
          <div className="row" style={{ marginTop: "1.25rem" }}>
            <Link className="btn" to="/pick">
              Pick a person
            </Link>
          </div>
        </section>
      </main>
    </>
  );
}
