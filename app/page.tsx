'use client';

import Link from 'next/link';

export default function WelcomePage() {
  return (
    <div className="welcome-screen">
      <div className="welcome-frame">
        <div className="welcome-logo-row">
          <div className="welcome-logo-mark">MAVEN</div>
          <div className="welcome-logo-text">
            <div className="welcome-logo-name">CARTA</div>
            <div className="welcome-logo-expand">
              Mainframe Analysis, Visualization &amp; Engineering iNtelligence
            </div>
          </div>
        </div>

        <div className="welcome-tagline">
          Dead documentation, replaced by<br />
          <span>living comprehension.</span>
        </div>

        <div className="welcome-subtitle">
          On-demand, grounded understanding of your COBOL estate — dependency
          structure determined by static analysis, narratives grounded in that
          structure, and a human-validation gate before any artifact drives a
          code change.
        </div>

        <div className="welcome-bullets">
          <div className="welcome-bullet">
            <div className="welcome-bullet-icon">🔗</div>
            Dependency mapping
          </div>
          <div className="welcome-bullet">
            <div className="welcome-bullet-icon">📋</div>
            Business rules
          </div>
          <div className="welcome-bullet">
            <div className="welcome-bullet-icon">💥</div>
            Change impact
          </div>
          <div className="welcome-bullet">
            <div className="welcome-bullet-icon">🏗️</div>
            Modernization spec
          </div>
        </div>

        <div className="framing-box">
          <div className="framing-label">⚠ Prototype framing — please read</div>
          <p>
            <strong>This is an illustrative prototype of the intended MAVEN experience.</strong>{' '}
            Content is pre-generated on a synthetic COBOL estate authored for
            this demonstration. No parser is running, no LLM is called, no live
            code is analysed. The prototype shows the experience; the proposal
            describes the engine (CAST deterministic analysis + BNY-internal LLM)
            that produces it for real.
          </p>
        </div>

        <div className="welcome-cta">
          <Link
            href="/programs"
            className="btn btn-primary"
            style={{ fontSize: '16px', padding: '14px 40px', textDecoration: 'none' }}
          >
            Begin Demo &nbsp;→
          </Link>
        </div>

        <div className="welcome-meta">
          Settlement / Global Transaction Management · Synthetic estate
        </div>
      </div>
    </div>
  );
}
