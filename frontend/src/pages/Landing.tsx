import React, { useState, useRef, type KeyboardEvent } from 'react';
import { Shield, Fingerprint, Activity, Lock, Search, FileText } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Landing() {
  const [keystrokes, setKeystrokes] = useState<number[]>([]);
  const lastKeyTime = useRef<number | null>(null);

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (['Shift', 'Control', 'Alt', 'Meta', 'CapsLock', 'Tab'].includes(e.key)) return;
    const now = Date.now();
    if (lastKeyTime.current) {
      const flightTime = now - lastKeyTime.current;
      setKeystrokes(prev => {
        const next = [...prev, flightTime];
        return next.slice(-20);
      });
    }
    lastKeyTime.current = now;
  };

  const handleKeyUp = (e: KeyboardEvent<HTMLInputElement>) => {
    if (['Shift', 'Control', 'Alt', 'Meta', 'CapsLock', 'Tab'].includes(e.key)) return;
    const now = Date.now();
    if (lastKeyTime.current) {
      const dwellTime = now - lastKeyTime.current;
      setKeystrokes(prev => {
        const next = [...prev, dwellTime];
        return next.slice(-20);
      });
    }
    lastKeyTime.current = now;
  };

  const generatePath = () => {
    if (keystrokes.length === 0) return '';
    const maxVal = 400; 
    const height = 60;
    const width = 400;
    const stepX = width / 20;

    let d = `M 0 ${height - (Math.min(keystrokes[0], maxVal) / maxVal) * height}`;
    for (let i = 1; i < keystrokes.length; i++) {
      const val = Math.min(keystrokes[i], maxVal);
      const y = height - (val / maxVal) * height;
      const x = i * stepX;
      const prevX = (i - 1) * stepX;
      const prevY = height - (Math.min(keystrokes[i - 1], maxVal) / maxVal) * height;
      const cp1x = prevX + stepX / 2;
      const cp1y = prevY;
      const cp2x = x - stepX / 2;
      const cp2y = y;
      
      d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${x} ${y}`;
    }
    return d;
  };

  return (
    <div style={{ backgroundColor: 'var(--bg-base)', minHeight: '100vh', color: 'var(--text-primary)' }}>
      <style>{`
        /* Scoped Layout Classes for Landing Page (since Tailwind is not used) */
        .landing-container {
          max-w: 1200px;
          margin: 0 auto;
          padding: 0 24px;
        }
        .flex-between {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .flex-center {
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .flex-col-center {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
        }
        .grid-3 {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          gap: 32px;
        }
        .grid-2 {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
          gap: 24px;
        }
        .section-padding {
          padding: 96px 0;
        }
        
        .hero-gradient {
          background: linear-gradient(135deg, rgba(51, 92, 255, 0.08) 0%, transparent 100%);
        }
        
        .draw-path {
          stroke-dasharray: 1000;
          stroke-dashoffset: 1000;
          animation: draw 2s ease-out forwards;
        }
        @keyframes draw {
          to { stroke-dashoffset: 0; }
        }
        @media (prefers-reduced-motion: reduce) {
          .draw-path {
            animation: none !important;
            stroke-dasharray: none !important;
            stroke-dashoffset: 0 !important;
          }
        }
      `}</style>

      {/* Header */}
      <header style={{ position: 'sticky', top: 0, zIndex: 50, borderBottom: '1px solid var(--border-subtle)', backgroundColor: 'var(--bg-surface)' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 24px', height: '64px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ backgroundColor: 'var(--accent-primary)', color: 'white', padding: '6px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Shield size={20} />
            </div>
            <span className="display-font" style={{ fontWeight: 'bold', fontSize: '18px' }}>TrustLoop</span>
          </div>
          <div>
            <Link to="/login" className="btn-primary" style={{ textDecoration: 'none' }}>
              Sign In
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="hero-gradient" style={{ borderBottom: '1px solid var(--border-subtle)', padding: '96px 0 80px 0' }}>
        <div style={{ maxWidth: '800px', margin: '0 auto', padding: '0 24px', textAlign: 'center' }}>
          <h1 className="display-font" style={{ fontSize: '56px', fontWeight: 'bold', lineHeight: '1.1', marginBottom: '24px', color: 'var(--text-primary)' }}>
            Zero Trust requires continuous verification.
          </h1>
          <p style={{ fontSize: '20px', color: 'var(--text-secondary)', marginBottom: '48px', lineHeight: '1.6' }}>
            Protect enterprise sessions from hijacking and unauthorized physical access by analyzing behavioral biometrics in real time.
          </p>

          {/* Interactive Demo Element */}
          <div className="card" style={{ maxWidth: '600px', margin: '0 auto', position: 'relative', overflow: 'hidden', textAlign: 'left', padding: '32px' }}>
            <label className="display-font" style={{ display: 'block', fontSize: '14px', fontWeight: '600', marginBottom: '8px', color: 'var(--text-secondary)' }}>
              Type your name to see it in action
            </label>
            <input
              type="text"
              className="input-field display-font"
              style={{ fontSize: '20px', padding: '16px', fontWeight: '500' }}
              placeholder="e.g. Jane Doe"
              onKeyDown={handleKeyDown}
              onKeyUp={handleKeyUp}
            />
            
            <div style={{ marginTop: '32px', position: 'relative', height: '80px' }}>
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none', opacity: 0.3, color: 'var(--text-secondary)' }}>
                {keystrokes.length === 0 && <span style={{ fontSize: '14px' }}>Keystroke timing signature will appear here</span>}
              </div>
              <svg width="100%" height="100%" viewBox="0 0 400 60" preserveAspectRatio="none">
                <path
                  d={generatePath()}
                  fill="none"
                  stroke="var(--accent-primary)"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className={keystrokes.length > 0 ? "draw-path" : ""}
                />
              </svg>
            </div>
          </div>
        </div>
      </section>

      {/* Credibility Strip */}
      <section style={{ padding: '24px 0', backgroundColor: 'var(--bg-surface)', borderBottom: '1px solid var(--border-subtle)' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <Activity size={20} style={{ color: 'var(--accent-trust)' }} />
          <span style={{ fontWeight: '500', color: 'var(--text-secondary)' }}>
            Validated against the CMU Keystroke Dynamics Benchmark Dataset, demonstrating a <strong style={{ color: 'var(--text-primary)' }}>15.5% Equal Error Rate (EER)</strong> in offline anomaly detection.
          </span>
        </div>
      </section>

      {/* Problem Statement */}
      <section className="section-padding" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
        <div style={{ maxWidth: '800px', margin: '0 auto', padding: '0 24px', textAlign: 'center' }}>
          <h2 className="display-font" style={{ fontSize: '32px', fontWeight: 'bold', marginBottom: '24px' }}>The Point-of-Entry Authentication Gap</h2>
          <p style={{ fontSize: '18px', lineHeight: '1.7', color: 'var(--text-secondary)' }}>
            Traditional authentication checks identity only at the point of entry. Once a session is established, it remains implicitly trusted. If a device is left unattended or a session cookie is hijacked, the perimeter is breached without triggering a single alert. TrustLoop bridges this gap by continuously verifying that the physical human interacting with the machine matches the authenticated user.
          </p>
        </div>
      </section>

      {/* How it Works */}
      <section className="section-padding" style={{ backgroundColor: 'var(--bg-surface)', borderBottom: '1px solid var(--border-subtle)' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 24px' }}>
          <div style={{ textAlign: 'center', marginBottom: '64px' }}>
            <h2 className="display-font" style={{ fontSize: '32px', fontWeight: 'bold' }}>How it Works</h2>
          </div>
          
          <div className="grid-3" style={{ maxWidth: '1000px', margin: '0 auto' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ width: '48px', height: '48px', margin: '0 auto 16px auto', borderRadius: '50%', backgroundColor: 'rgba(51, 92, 255, 0.1)', color: 'var(--accent-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', fontWeight: 'bold' }}>1</div>
              <h3 className="display-font" style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '12px' }}>Authenticate</h3>
              <p style={{ color: 'var(--text-secondary)', lineHeight: '1.6' }}>Users log in using standard credentials and their assigned network baseline.</p>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ width: '48px', height: '48px', margin: '0 auto 16px auto', borderRadius: '50%', backgroundColor: 'rgba(51, 92, 255, 0.1)', color: 'var(--accent-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', fontWeight: 'bold' }}>2</div>
              <h3 className="display-font" style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '12px' }}>Baseline Enrollment</h3>
              <p style={{ color: 'var(--text-secondary)', lineHeight: '1.6' }}>The system learns the user's unique typing cadence and mouse movement patterns over time.</p>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ width: '48px', height: '48px', margin: '0 auto 16px auto', borderRadius: '50%', backgroundColor: 'rgba(51, 92, 255, 0.1)', color: 'var(--accent-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', fontWeight: 'bold' }}>3</div>
              <h3 className="display-font" style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '12px' }}>Continuous Monitoring</h3>
              <p style={{ color: 'var(--text-secondary)', lineHeight: '1.6' }}>Trust is continuously evaluated. If the physical behavior deviates from the established baseline, the session is locked.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Grid */}
      <section className="section-padding">
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 24px' }}>
          <div className="grid-2" style={{ maxWidth: '1000px', margin: '0 auto' }}>
            <div className="card">
              <Fingerprint size={28} style={{ color: 'var(--accent-primary)', marginBottom: '16px' }} />
              <h3 className="display-font" style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '8px' }}>Behavioral Biometrics</h3>
              <p style={{ color: 'var(--text-secondary)', lineHeight: '1.6' }}>Analyzes keystroke dwell time, flight time, and cursor velocity to verify the physical human behind the keyboard.</p>
            </div>
            
            <div className="card">
              <Search size={28} style={{ color: 'var(--accent-primary)', marginBottom: '16px' }} />
              <h3 className="display-font" style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '8px' }}>Network-Aware Trust</h3>
              <p style={{ color: 'var(--text-secondary)', lineHeight: '1.6' }}>Adjusts baseline trust scores dynamically based on corporate network recognition and IP context.</p>
            </div>
            
            <div className="card">
              <Lock size={28} style={{ color: 'var(--accent-danger)', marginBottom: '16px' }} />
              <h3 className="display-font" style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '8px' }}>Real-Time Protection</h3>
              <p style={{ color: 'var(--text-secondary)', lineHeight: '1.6' }}>Immediately locks active sessions when anomalous behavior patterns are detected, limiting exposure.</p>
            </div>
            
            <div className="card">
              <FileText size={28} style={{ color: 'var(--accent-trust)', marginBottom: '16px' }} />
              <h3 className="display-font" style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '8px' }}>Enterprise Audit Trail</h3>
              <p style={{ color: 'var(--text-secondary)', lineHeight: '1.6' }}>Maintains a complete, immutable log of session trust fluctuations and security interventions for compliance.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer CTA & Footer */}
      <section style={{ padding: '96px 0', backgroundColor: 'var(--bg-surface)', borderTop: '1px solid var(--border-subtle)', borderBottom: '1px solid var(--border-subtle)' }}>
        <div style={{ maxWidth: '800px', margin: '0 auto', padding: '0 24px', textAlign: 'center' }}>
          <h2 className="display-font" style={{ fontSize: '32px', fontWeight: 'bold', marginBottom: '24px' }}>Ready to secure your sessions?</h2>
          <p style={{ fontSize: '18px', color: 'var(--text-secondary)', marginBottom: '32px' }}>Experience the real-time continuous authentication demo.</p>
          <Link to="/login" className="btn-primary" style={{ textDecoration: 'none', display: 'inline-block' }}>
            Go to the Demo
          </Link>
        </div>
      </section>

      <footer style={{ padding: '48px 0', backgroundColor: 'var(--bg-base)' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Shield size={20} style={{ color: 'var(--accent-primary)' }} />
            <span className="display-font" style={{ fontWeight: '600', fontSize: '18px' }}>TrustLoop</span>
          </div>
          <p style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
            Built for demonstration purposes. Not a real product.
          </p>
        </div>
      </footer>
    </div>
  );
}
