import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "American Red Cross — Bay Area Chapter",
};

/**
 * Red Cross Bay Area public website — the audit target.
 *
 * Deliberately incomplete: no mention of the active blood shortage,
 * no Saturday blood drive listing, no virtual CPR course, no Houston
 * deployment, no Disaster Ready Homes launch, no volunteer urgency.
 * These are the gaps Quad finds by comparing the page to the internal brain.
 */
export default function RedCrossPublicSite() {
  return (
    <>
      <style>{`
        #rc-site *, #rc-site *::before, #rc-site *::after {
          box-sizing: border-box; margin: 0; padding: 0;
        }
        #rc-site {
          font-family: system-ui, -apple-system, sans-serif;
          color: #1a1a1a;
          background: #ffffff;
          min-height: 100vh;
        }
        #rc-site a { color: inherit; text-decoration: none; }

        /* Nav */
        #rc-site nav {
          background: #ed1b2e;
          padding: 0 2rem;
          display: flex;
          align-items: center;
          justify-content: space-between;
          height: 64px;
          position: sticky;
          top: 0;
          z-index: 10;
        }
        #rc-site .nav-logo {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          color: #fff;
          font-size: 1rem;
          font-weight: 700;
          letter-spacing: -0.2px;
        }
        #rc-site .nav-cross {
          width: 32px;
          height: 32px;
          background: #fff;
          border-radius: 3px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        #rc-site .nav-cross::before {
          content: '+';
          color: #ed1b2e;
          font-size: 1.5rem;
          font-weight: 900;
          line-height: 1;
        }
        #rc-site .nav-links { display: flex; gap: 2rem; }
        #rc-site .nav-links a { color: rgba(255,255,255,0.88); font-size: 0.9rem; }
        #rc-site .nav-links a:hover { color: #fff; }
        #rc-site .nav-cta {
          background: #fff;
          color: #ed1b2e;
          font-weight: 700;
          font-size: 0.875rem;
          padding: 0.5rem 1.25rem;
          border-radius: 3px;
        }

        /* Hero */
        #rc-site .hero {
          background: linear-gradient(135deg, #c8102e 0%, #ed1b2e 50%, #f44 100%);
          color: #fff;
          padding: 5rem 2rem;
          text-align: center;
        }
        #rc-site .hero h1 { font-size: 2.6rem; line-height: 1.15; max-width: 680px; margin: 0 auto 1.25rem; font-weight: 800; }
        #rc-site .hero p { font-size: 1.1rem; max-width: 520px; margin: 0 auto 2.5rem; opacity: 0.92; }
        #rc-site .hero-btns { display: flex; gap: 1rem; justify-content: center; flex-wrap: wrap; }
        #rc-site .btn-white {
          background: #fff;
          color: #c8102e;
          font-weight: 700;
          padding: 0.875rem 2rem;
          border-radius: 3px;
          font-size: 1rem;
        }
        #rc-site .btn-outline {
          background: transparent;
          color: #fff;
          font-weight: 600;
          padding: 0.875rem 2rem;
          border-radius: 3px;
          font-size: 1rem;
          border: 2px solid rgba(255,255,255,0.7);
        }

        /* Sections */
        #rc-site .section { padding: 4rem 2rem; max-width: 960px; margin: 0 auto; }
        #rc-site h2 { font-size: 1.75rem; font-weight: 700; color: #111; margin-bottom: 1rem; }
        #rc-site h3 { font-size: 1.125rem; font-weight: 700; color: #c8102e; margin-bottom: 0.5rem; }
        #rc-site p { line-height: 1.7; color: #444; margin-bottom: 1rem; }
        #rc-site .label {
          display: inline-block;
          background: #fdecea;
          color: #c8102e;
          font-size: 0.75rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          padding: 0.2rem 0.6rem;
          border-radius: 2px;
          margin-bottom: 0.75rem;
        }

        /* Cards */
        #rc-site .card-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          gap: 1.5rem;
          margin-top: 2rem;
        }
        #rc-site .card {
          border: 1px solid #e8e8e8;
          border-radius: 6px;
          padding: 1.5rem;
          background: #fafafa;
        }
        #rc-site .card:hover { border-color: #ed1b2e; }

        /* Stats */
        #rc-site .stats-band {
          background: #fdecea;
          padding: 3rem 2rem;
          text-align: center;
        }
        #rc-site .stats-grid {
          display: flex;
          gap: 4rem;
          justify-content: center;
          flex-wrap: wrap;
          max-width: 800px;
          margin: 0 auto;
        }
        #rc-site .stat .stat-number { font-size: 2.4rem; font-weight: 800; color: #c8102e; }
        #rc-site .stat .stat-label { font-size: 0.875rem; color: #555; margin-top: 0.25rem; max-width: 140px; }

        /* Donate */
        #rc-site .donate-band {
          background: #c8102e;
          color: #fff;
          text-align: center;
          padding: 4.5rem 2rem;
        }
        #rc-site .donate-band h2 { color: #fff; }
        #rc-site .donate-band p { color: rgba(255,255,255,0.88); max-width: 520px; margin: 0 auto 2rem; }
        #rc-site .btn-donate {
          background: #fff;
          color: #c8102e;
          font-weight: 800;
          font-size: 1.05rem;
          padding: 1rem 2.75rem;
          border-radius: 3px;
        }

        /* Alert banner */
        #rc-site .alert-banner {
          background: #fff3cd;
          border-left: 4px solid #f0ad4e;
          padding: 0.75rem 2rem;
          font-size: 0.9rem;
          color: #664d03;
        }

        /* Footer */
        #rc-site footer {
          background: #111;
          color: #888;
          text-align: center;
          padding: 2rem;
          font-size: 0.8rem;
          line-height: 2;
        }
        #rc-site footer a { color: #aaa; }

        /* Volunteer section */
        #rc-site .volunteer-strip {
          background: #1a1a1a;
          color: #fff;
          padding: 3rem 2rem;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 2rem;
          flex-wrap: wrap;
        }
        #rc-site .volunteer-strip h2 { color: #fff; margin-bottom: 0.5rem; }
        #rc-site .volunteer-strip p { color: rgba(255,255,255,0.75); margin: 0; max-width: 500px; }
        #rc-site .btn-vol {
          flex-shrink: 0;
          background: #ed1b2e;
          color: #fff;
          font-weight: 700;
          padding: 0.875rem 2rem;
          border-radius: 3px;
          white-space: nowrap;
        }
      `}</style>

      <div id="rc-site">

        {/* Nav */}
        <nav>
          <div className="nav-logo">
            <div className="nav-cross" />
            American Red Cross Bay Area
          </div>
          <div className="nav-links">
            <a href="#about">About</a>
            <a href="#services">Services</a>
            <a href="#training">Training</a>
            <a href="#volunteer">Volunteer</a>
          </div>
          <a href="#donate" className="nav-cta">Donate</a>
        </nav>

        {/* Hero — no mention of the active blood shortage */}
        <div className="hero">
          <h1>When Disaster Strikes, We Are There</h1>
          <p>
            The Red Cross Bay Area chapter provides disaster relief, blood services, and
            emergency training to communities across the Bay Area.
          </p>
          <div className="hero-btns">
            <a href="#donate" className="btn-white">Donate Blood</a>
            <a href="#volunteer" className="btn-outline">Volunteer</a>
          </div>
        </div>

        {/* Generic alert — does NOT name the specific shortage or Saturday drive */}
        <div className="alert-banner">
          Blood donations are always needed. Schedule your appointment today at redcrossblood.org.
        </div>

        {/* About */}
        <div className="section" id="about">
          <span className="label">About Us</span>
          <h2>Serving the Bay Area for Over 100 Years</h2>
          <p>
            The American Red Cross Bay Area chapter has been a cornerstone of the region's
            emergency response network since 1917. We mobilize volunteers and donors to respond
            to disasters, supply blood to hospitals, and provide essential safety training
            to local communities.
          </p>
          <p>
            Our chapter covers seven counties, from San Francisco to Monterey. Every year, our
            volunteers respond to an average of 180 local disasters — house fires, floods, and
            other emergencies — helping families recover and rebuild.
          </p>
        </div>

        {/* Services — Houston deployment NOT mentioned; Disaster Ready Homes NOT mentioned */}
        <div className="section" id="services">
          <span className="label">Services</span>
          <h2>What We Do</h2>
          <div className="card-grid">
            <div className="card">
              <h3>Disaster Relief</h3>
              <p>
                When disaster strikes locally or nationally, Red Cross deploys trained relief
                workers to provide food, shelter, and emotional support. We are available 24/7.
              </p>
            </div>
            <div className="card">
              <h3>Blood Services</h3>
              <p>
                The Red Cross supplies approximately 40% of the nation's blood supply. Donate
                whole blood, platelets, or plasma at a donation center or mobile drive near you.
              </p>
            </div>
            <div className="card">
              <h3>Emergency Preparedness</h3>
              <p>
                We help individuals and families build emergency plans. Download our emergency
                app or visit a workshop to learn how to prepare for earthquakes, wildfires,
                and other Bay Area hazards.
              </p>
              {/* Note: Disaster Ready Homes ($1.2M FEMA program, July 15 launch) not listed here */}
            </div>
            <div className="card">
              <h3>International Services</h3>
              <p>
                Red Cross connects Bay Area families with loved ones in crisis zones worldwide
                and supports global humanitarian operations through the International Red Cross network.
              </p>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="stats-band">
          <h2 style={{ color: "#c8102e", marginBottom: "2.5rem" }}>Our Impact</h2>
          <div className="stats-grid">
            <div className="stat">
              <div className="stat-number">180+</div>
              <div className="stat-label">Local disaster responses each year</div>
            </div>
            <div className="stat">
              <div className="stat-number">600+</div>
              {/* Note: website says 600+, internal docs show 612 — with a 340-person shortfall */}
              <div className="stat-label">Active volunteers</div>
            </div>
            <div className="stat">
              <div className="stat-number">40%</div>
              <div className="stat-label">Of the US blood supply provided by Red Cross</div>
            </div>
          </div>
        </div>

        {/* Training — only shows in-person CPR, no virtual option */}
        <div className="section" id="training">
          <span className="label">Training</span>
          <h2>Certification Courses</h2>
          <p>
            Red Cross Bay Area offers American Heart Association-recognized first aid and
            CPR certifications. Classes are held at our San Francisco and Oakland training
            centers, as well as at partner locations across the Bay.
          </p>
          <div className="card-grid">
            <div className="card">
              <h3>CPR &amp; AED Certification</h3>
              <p>
                In-person, hands-on CPR and AED training. 4-hour course. $45 per participant.
                Certificate valid for 2 years. Group rates available for teams of 10 or more.
              </p>
              {/* Virtual CPR ($29.99, launched May 2026, 2,400 completions) is NOT listed here */}
            </div>
            <div className="card">
              <h3>First Aid</h3>
              <p>
                Covers wound care, choking, burns, and basic medical emergencies. Often combined
                with CPR for a full certification day. Accepted by most employers and childcare
                licensing boards.
              </p>
            </div>
            <div className="card">
              <h3>Lifeguard Training</h3>
              <p>
                Comprehensive lifeguard certification including water rescue, CPR, and AED.
                Offered in partnership with Bay Area aquatic facilities. 30-hour program.
              </p>
            </div>
          </div>
        </div>

        {/* Volunteer — no urgency, no specific roles, no hurricane season context */}
        <div className="volunteer-strip" id="volunteer">
          <div>
            <h2>Volunteer with Us</h2>
            <p>
              Our volunteers are the backbone of Red Cross Bay Area. Whether you can give a few
              hours a month or commit to regular shifts, there is a role for you.
              {/* No mention: 340 volunteer shortfall, shelter ops / blood coord / mental health urgency */}
            </p>
          </div>
          <a href="#" className="btn-vol">Get Involved</a>
        </div>

        {/* Donate */}
        <div className="donate-band" id="donate">
          <h2>Your Gift Saves Lives</h2>
          <p>
            Every dollar supports disaster relief operations, blood services, and community
            training programs across the Bay Area and beyond.
          </p>
          <a href="#" className="btn-donate">Donate Now</a>
        </div>

        {/* Footer */}
        <footer>
          <p>American Red Cross Bay Area Chapter &copy; 2025 &mdash; San Francisco, CA</p>
          <p>
            <a href="#">Privacy Policy</a> &nbsp;&middot;&nbsp;
            <a href="#">Accessibility</a> &nbsp;&middot;&nbsp;
            Contact: bayarea@redcross.org &nbsp;&middot;&nbsp; 1-800-RED-CROSS
          </p>
        </footer>

      </div>
    </>
  );
}
