import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "BrightPath Foundation",
};

/**
 * BrightPath Foundation public website — the audit target.
 *
 * Deliberately thin: vague stats, missing programs, no waitlist info,
 * no expansion news. This is what Kali audits against the internal brain.
 */
export default function BrightPathPublicSite() {
  return (
    <>
      <style>{`
        #brightpath-site *, #brightpath-site *::before, #brightpath-site *::after {
          box-sizing: border-box; margin: 0; padding: 0;
        }
        #brightpath-site {
          font-family: Georgia, 'Times New Roman', serif;
          color: #1a1a1a;
          background: #ffffff;
          min-height: 100vh;
        }
        #brightpath-site a { color: inherit; text-decoration: none; }
        #brightpath-site img { max-width: 100%; }

        /* Nav */
        #brightpath-site nav {
          background: #1d4e89;
          padding: 0 2rem;
          display: flex;
          align-items: center;
          justify-content: space-between;
          height: 64px;
        }
        #brightpath-site .nav-logo { color: #fff; font-size: 1.25rem; font-weight: 700; letter-spacing: -0.5px; }
        #brightpath-site .nav-links { display: flex; gap: 2rem; }
        #brightpath-site .nav-links a { color: #cde; font-size: 0.9rem; }
        #brightpath-site .nav-links a:hover { color: #fff; }

        /* Hero */
        #brightpath-site .hero {
          background: linear-gradient(135deg, #1d4e89 0%, #2e6db4 60%, #4a90d9 100%);
          color: #fff;
          padding: 5rem 2rem;
          text-align: center;
        }
        #brightpath-site .hero h1 { font-size: 2.8rem; line-height: 1.2; max-width: 680px; margin: 0 auto 1.25rem; }
        #brightpath-site .hero p { font-size: 1.15rem; max-width: 520px; margin: 0 auto 2rem; opacity: 0.88; font-family: system-ui, sans-serif; }
        #brightpath-site .btn-primary {
          display: inline-block;
          background: #f7a11a;
          color: #1a1a1a;
          font-family: system-ui, sans-serif;
          font-weight: 700;
          font-size: 1rem;
          padding: 0.85rem 2.2rem;
          border-radius: 4px;
          cursor: pointer;
        }
        #brightpath-site .btn-primary:hover { background: #e5920a; }

        /* Sections */
        #brightpath-site section { padding: 4rem 2rem; max-width: 900px; margin: 0 auto; }
        #brightpath-site h2 { font-size: 1.75rem; color: #1d4e89; margin-bottom: 1rem; }
        #brightpath-site h3 { font-size: 1.2rem; color: #2e6db4; margin-bottom: 0.5rem; }
        #brightpath-site p { font-family: system-ui, sans-serif; line-height: 1.7; color: #333; margin-bottom: 1rem; }

        /* Programs */
        #brightpath-site .programs-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
          gap: 1.5rem;
          margin-top: 2rem;
        }
        #brightpath-site .program-card {
          border: 1px solid #d8e4f0;
          border-radius: 8px;
          padding: 1.5rem;
          background: #f8fbff;
        }

        /* Stats */
        #brightpath-site .stats-band {
          background: #eef4fb;
          padding: 3rem 2rem;
          text-align: center;
        }
        #brightpath-site .stats-grid {
          display: flex;
          gap: 3rem;
          justify-content: center;
          flex-wrap: wrap;
          max-width: 700px;
          margin: 0 auto;
        }
        #brightpath-site .stat { text-align: center; }
        #brightpath-site .stat-number { font-size: 2.4rem; font-weight: 700; color: #1d4e89; }
        #brightpath-site .stat-label { font-family: system-ui, sans-serif; font-size: 0.85rem; color: #555; margin-top: 0.25rem; }

        /* Donate */
        #brightpath-site .donate-section {
          background: #1d4e89;
          color: #fff;
          text-align: center;
          padding: 4rem 2rem;
        }
        #brightpath-site .donate-section h2 { color: #fff; }
        #brightpath-site .donate-section p { color: #cde; max-width: 500px; margin: 0 auto 2rem; }
        #brightpath-site .btn-donate {
          display: inline-block;
          background: #f7a11a;
          color: #1a1a1a;
          font-family: system-ui, sans-serif;
          font-weight: 700;
          font-size: 1.05rem;
          padding: 0.9rem 2.5rem;
          border-radius: 4px;
        }

        /* Footer */
        #brightpath-site footer {
          background: #111;
          color: #888;
          text-align: center;
          padding: 1.5rem;
          font-family: system-ui, sans-serif;
          font-size: 0.8rem;
        }

        #brightpath-site .about-section { border-top: 1px solid #e8eef5; }
      `}</style>

      <div id="brightpath-site">
        {/* Navigation */}
        <nav>
          <span className="nav-logo">BrightPath Foundation</span>
          <div className="nav-links">
            <a href="#about">About</a>
            <a href="#programs">Programs</a>
            <a href="#impact">Impact</a>
            <a href="#donate">Donate</a>
          </div>
        </nav>

        {/* Hero */}
        <div className="hero">
          <h1>Empowering Youth Through Education</h1>
          <p>
            We empower youth through education in Oakland and Berkeley, building brighter
            futures one student at a time.
          </p>
          <a href="#donate" className="btn-primary">Donate Today</a>
        </div>

        {/* About */}
        <section id="about" className="about-section">
          <h2>About BrightPath</h2>
          <p>
            BrightPath Foundation is a nonprofit organization dedicated to expanding
            educational access for underserved youth in the East Bay. Founded in 2012,
            we partner with schools, families, and community organizations to create
            pathways to success.
          </p>
          <p>
            Our team of educators and volunteers works directly with students to provide
            the support they need to thrive academically and personally. We believe
            every young person deserves a brighter future.
          </p>
        </section>

        {/* Programs */}
        <section id="programs">
          <h2>Our Programs</h2>
          <p>
            Programs include tutoring and college mentorship. We serve students in
            Oakland and Berkeley with personalized academic support.
          </p>
          <div className="programs-grid">
            <div className="program-card">
              <h3>After-School Tutoring</h3>
              <p>
                One-on-one and small-group tutoring in math, reading, and science for
                students in grades 3 through 12. Sessions held Monday through Thursday
                at partner school sites.
              </p>
            </div>
            <div className="program-card">
              <h3>College Prep Mentorship</h3>
              <p>
                Guidance on college applications, essays, financial aid, and campus visits.
                Students are paired with a dedicated mentor throughout the process.
              </p>
            </div>
          </div>
        </section>

        {/* Impact stats */}
        <div className="stats-band" id="impact">
          <h2 style={{ color: "#1d4e89", marginBottom: "2rem" }}>Our Impact</h2>
          <div className="stats-grid">
            <div className="stat">
              <div className="stat-number">1,000+</div>
              <div className="stat-label">Students served annually</div>
            </div>
            <div className="stat">
              <div className="stat-number">10+</div>
              <div className="stat-label">Years in the community</div>
            </div>
            <div className="stat">
              <div className="stat-number">30+</div>
              <div className="stat-label">Volunteer educators</div>
            </div>
          </div>
        </div>

        {/* Testimonial */}
        <section>
          <h2>What Families Say</h2>
          <p style={{ fontStyle: "italic", borderLeft: "3px solid #2e6db4", paddingLeft: "1rem", color: "#444" }}>
            &ldquo;BrightPath helped my daughter believe in herself. The tutors really
            care about each student.&rdquo;
          </p>
          <p style={{ color: "#777", fontSize: "0.9rem", fontFamily: "system-ui, sans-serif" }}>
            &mdash; Oakland parent, 2025
          </p>
        </section>

        {/* Donate CTA */}
        <div className="donate-section" id="donate">
          <h2>Join Us in Building Brighter Futures</h2>
          <p>
            Your gift helps us reach more students across Oakland and Berkeley.
            Every contribution makes a difference.
          </p>
          <a href="#" className="btn-donate">Donate Now</a>
        </div>

        {/* Footer */}
        <footer>
          <p>BrightPath Foundation &copy; 2025. Oakland, CA. All rights reserved.</p>
          <p style={{ marginTop: "0.5rem" }}>
            Questions? Email us at info@brightpathfoundation.org
          </p>
        </footer>
      </div>
    </>
  );
}
