import React, { useState, useEffect, Suspense } from 'react';
import { motion } from 'framer-motion';
import { Shield, Fingerprint, Activity, Lock, Search, FileText, ChevronRight, Zap, Network, Crosshair, Server, Database, Code, Globe, LogIn } from 'lucide-react';
import { Link } from 'react-router-dom';

// Lazy load the 3D Hero to avoid blocking the main thread
const Hero3D = React.lazy(() => import('../components/Hero3D'));

// Fallback for non-Webgl or mobile
function Hero3DFallback() {
  return (
    <div style={{
      width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'radial-gradient(circle at center, rgba(51, 92, 255, 0.1) 0%, transparent 70%)'
    }}>
      <div className="glass-panel" style={{ width: '120px', height: '120px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'var(--accent-primary)', opacity: 0.8, animation: 'pulse-glow 3s infinite alternate' }} />
      </div>
    </div>
  );
}

const FadeIn = ({ children, delay = 0 }: { children: React.ReactNode, delay?: number }) => (
  <motion.div
    initial={{ opacity: 0, y: 30 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true, margin: "-100px" }}
    transition={{ duration: 0.6, delay }}
  >
    {children}
  </motion.div>
);

export default function Landing() {
  const [isImpostor, setIsImpostor] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div style={{ backgroundColor: 'var(--bg-base)', minHeight: '100vh', color: 'var(--text-primary)', overflowX: 'hidden' }}>
      <style>{`
        .glass-nav {
          background: ${scrolled ? 'rgba(255, 255, 255, 0.85)' : 'transparent'};
          backdrop-filter: ${scrolled ? 'blur(12px)' : 'none'};
          border-bottom: ${scrolled ? '1px solid var(--border-subtle)' : '1px solid transparent'};
          transition: all 0.3s ease;
        }
        .nav-link {
          color: var(--text-secondary);
          text-decoration: none;
          font-weight: 500;
          font-size: 14px;
          transition: color 0.2s;
        }
        .nav-link:hover {
          color: var(--text-primary);
        }
        .section-container {
          max-width: 1200px;
          margin: 0 auto;
          padding: 96px 24px;
        }
        .bento-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
          gap: 24px;
        }
        .bento-item {
          background: var(--bg-surface);
          border: 1px solid var(--border-subtle);
          border-radius: 16px;
          padding: 32px;
          transition: transform 0.3s ease, box-shadow 0.3s ease;
        }
        .bento-item:hover {
          transform: translateY(-4px);
          box-shadow: 0 12px 24px rgba(51, 92, 255, 0.08);
          border-color: rgba(51, 92, 255, 0.2);
        }
        .chip {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 6px 12px;
          background: var(--bg-elevated);
          border: 1px solid var(--border-subtle);
          border-radius: 20px;
          font-size: 13px;
          color: var(--text-secondary);
        }
      `}</style>

      {/* 1. Glass Navbar */}
      <nav className="glass-nav" style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100, height: '72px' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 24px', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ background: 'linear-gradient(135deg, var(--accent-primary), #60a5fa)', color: 'white', padding: '8px', borderRadius: '10px' }}>
              <Shield size={22} />
            </div>
            <span className="display-font" style={{ fontWeight: '700', fontSize: '20px', letterSpacing: '-0.5px' }}>TrustLoop</span>
          </div>
          <div style={{ display: 'none', gap: '32px' }} className="desktop-nav">
            <a href="#features" className="nav-link">Features</a>
            <a href="#how-it-works" className="nav-link">How it Works</a>
            <a href="#tech" className="nav-link">Technology</a>
            <a href="#security" className="nav-link">Security</a>
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <Link to="/login" className="btn-primary" style={{ backgroundColor: 'var(--bg-elevated)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)' }}>
              Employee Portal
            </Link>
            <Link to="/login" className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Lock size={16} /> Admin Console
            </Link>
          </div>
        </div>
      </nav>

      {/* 2. Hero Section */}
      <section style={{ paddingTop: '160px', paddingBottom: '96px', position: 'relative', overflow: 'hidden' }}>
        <div className="section-container" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', position: 'relative', zIndex: 10 }}>
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.8, ease: 'easeOut' }}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '6px 16px', background: 'rgba(51, 92, 255, 0.1)', color: 'var(--accent-primary)', borderRadius: '24px', fontSize: '14px', fontWeight: '600', marginBottom: '32px' }}
          >
            <SparkleIcon /> TrustLoop 2.0 is Live
          </motion.div>
          
          <motion.h1 
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.1 }}
            className="display-font" style={{ fontSize: 'clamp(40px, 6vw, 72px)', fontWeight: '700', lineHeight: '1.1', letterSpacing: '-1px', maxWidth: '900px', marginBottom: '24px' }}
          >
            Zero Trust requires <span style={{ color: 'var(--accent-primary)' }}>continuous</span> verification.
          </motion.h1>
          
          <motion.p 
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.2 }}
            style={{ fontSize: 'clamp(18px, 2vw, 22px)', color: 'var(--text-secondary)', maxWidth: '700px', marginBottom: '48px', lineHeight: '1.6' }}
          >
            Protect enterprise sessions from hijacking and unauthorized physical access by analyzing behavioral biometrics and network telemetry in real time.
          </motion.p>

          <motion.div 
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.3 }}
            style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', justifyContent: 'center', marginBottom: '80px' }}
          >
            <Link to="/login" className="btn-primary" style={{ fontSize: '16px', padding: '14px 32px' }}>Start Demo</Link>
            <a href="https://github.com" target="_blank" rel="noreferrer" className="btn-primary" style={{ backgroundColor: 'white', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)', fontSize: '16px', padding: '14px 32px' }}>View on GitHub</a>
          </motion.div>

          {/* 3D Scene Container */}
          <motion.div 
            initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1, delay: 0.4 }}
            style={{ position: 'relative', width: '100%', maxWidth: '1000px', height: '500px', margin: '0 auto', borderRadius: '24px', background: 'linear-gradient(180deg, rgba(255,255,255,0.5) 0%, rgba(255,255,255,0.1) 100%)', border: '1px solid rgba(255,255,255,0.4)', boxShadow: '0 24px 64px rgba(51, 92, 255, 0.1)', overflow: 'hidden' }}
          >
            {/* Top Interactive Toggle */}
            <div style={{ position: 'absolute', top: '24px', left: '50%', transform: 'translateX(-50%)', zIndex: 20, display: 'flex', alignItems: 'center', gap: '12px', background: 'rgba(255,255,255,0.8)', backdropFilter: 'blur(12px)', padding: '12px 24px', borderRadius: '32px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)', border: '1px solid rgba(255,255,255,0.5)' }}>
              <span style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-secondary)' }}>Interactive Demo</span>
              <div style={{ width: '1px', height: '16px', background: 'var(--border-subtle)' }} />
              <button 
                onClick={() => setIsImpostor(!isImpostor)}
                style={{ background: isImpostor ? 'var(--accent-danger)' : 'var(--bg-base)', border: isImpostor ? 'none' : '1px solid var(--border-subtle)', color: isImpostor ? 'white' : 'var(--text-primary)', padding: '6px 16px', borderRadius: '16px', fontSize: '13px', fontWeight: '600', cursor: 'pointer', transition: 'all 0.2s' }}
              >
                {isImpostor ? 'Restore Session' : 'Simulate Impostor'}
              </button>
            </div>

            {/* Small live trust gauge overlay */}
            <div style={{ position: 'absolute', bottom: '24px', right: '24px', zIndex: 20, background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(12px)', padding: '16px', borderRadius: '16px', border: '1px solid var(--border-subtle)', boxShadow: '0 8px 24px rgba(0,0,0,0.08)', width: '200px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)' }}>TRUST SCORE</span>
                <span style={{ fontSize: '12px', fontWeight: '700', color: isImpostor ? 'var(--accent-danger)' : 'var(--accent-trust)' }}>{isImpostor ? 'CRITICAL' : 'SECURE'}</span>
              </div>
              <div className="display-font" style={{ fontSize: '32px', fontWeight: '700', color: isImpostor ? 'var(--accent-danger)' : 'var(--accent-trust)', marginBottom: '8px', transition: 'color 1s ease' }}>
                {isImpostor ? '14.2' : '98.5'}
              </div>
              <div style={{ height: '4px', background: 'var(--bg-elevated)', borderRadius: '2px', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: isImpostor ? '14%' : '98%', background: isImpostor ? 'var(--accent-danger)' : 'var(--accent-trust)', transition: 'width 1s cubic-bezier(0.4, 0, 0.2, 1), background 1s' }} />
              </div>
            </div>

            <Suspense fallback={<Hero3DFallback />}>
              {/* Force re-mount on mobile preference for reduced motion or let canvas handle it. We rely on Canvas being lightweight enough, but users with prefers-reduced-motion will see it slower in the component if we had hooked it. For now, it respects standard React Three Fiber. */}
              <div style={{ width: '100%', height: '100%' }}>
                <Hero3D isImpostor={isImpostor} />
              </div>
            </Suspense>
          </motion.div>
        </div>
        
        {/* Background Gradients */}
        <div style={{ position: 'absolute', top: '-10%', left: '-10%', width: '50%', height: '50%', background: 'radial-gradient(circle, rgba(51, 92, 255, 0.15) 0%, transparent 70%)', zIndex: 0, filter: 'blur(60px)' }} />
        <div style={{ position: 'absolute', top: '30%', right: '-10%', width: '40%', height: '60%', background: 'radial-gradient(circle, rgba(139, 92, 246, 0.1) 0%, transparent 70%)', zIndex: 0, filter: 'blur(60px)' }} />
      </section>

      {/* 3. How it Works */}
      <section id="how-it-works" style={{ backgroundColor: '#ffffff', padding: '96px 0', borderTop: '1px solid var(--border-subtle)', borderBottom: '1px solid var(--border-subtle)' }}>
        <div className="section-container">
          <FadeIn>
            <div style={{ textAlign: 'center', marginBottom: '64px' }}>
              <h2 className="display-font" style={{ fontSize: '36px', fontWeight: '700', marginBottom: '16px' }}>How TrustLoop Works</h2>
              <p style={{ fontSize: '18px', color: 'var(--text-secondary)', maxWidth: '600px', margin: '0 auto' }}>A seamless, passive continuous authentication pipeline.</p>
            </div>
          </FadeIn>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '48px', maxWidth: '800px', margin: '0 auto' }}>
            {[
              { num: '01', title: 'Capture (2-Second Windows)', desc: 'As the user interacts, passive telemetry (dwell time, flight time, cursor kinematics) is captured locally in 2-second windows without recording actual key values.' },
              { num: '02', title: 'Adaptive Enrollment', desc: 'The system requires 15 clean batches to establish a minimum viable baseline. It then calculates feature means and fits a scaler.' },
              { num: '03', title: 'Score (Isolation Forest)', desc: 'Live batches are passed through an ensemble Isolation Forest model. Raw anomaly scores are combined with Mahalanobis-style drift and EMA smoothing.' },
              { num: '04', title: 'Respond (RBAC Policies)', desc: 'If the EMA-smoothed trust score dips below policy thresholds (e.g., < 60), the session is instantly locked and SOC alerts are fired.' }
            ].map((step, i) => (
              <FadeIn key={i} delay={i * 0.1}>
                <div style={{ display: 'flex', gap: '24px', alignItems: 'flex-start' }}>
                  <div className="display-font" style={{ fontSize: '48px', fontWeight: '700', color: 'rgba(51, 92, 255, 0.2)', lineHeight: '1' }}>
                    {step.num}
                  </div>
                  <div>
                    <h3 className="display-font" style={{ fontSize: '22px', fontWeight: '600', marginBottom: '8px' }}>{step.title}</h3>
                    <p style={{ color: 'var(--text-secondary)', lineHeight: '1.6', fontSize: '16px' }}>{step.desc}</p>
                  </div>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* 4. Features Bento Grid */}
      <section id="features" style={{ padding: '96px 0' }}>
        <div className="section-container">
          <FadeIn>
            <div style={{ textAlign: 'center', marginBottom: '64px' }}>
              <h2 className="display-font" style={{ fontSize: '36px', fontWeight: '700', marginBottom: '16px' }}>Enterprise Features</h2>
              <p style={{ fontSize: '18px', color: 'var(--text-secondary)', maxWidth: '600px', margin: '0 auto' }}>True to the codebase. No marketing fluff.</p>
            </div>
          </FadeIn>
          
          <div className="bento-grid">
            <FadeIn delay={0.1}>
              <div className="bento-item">
                <Fingerprint size={28} color="var(--accent-primary)" style={{ marginBottom: '16px' }} />
                <h3 className="display-font" style={{ fontSize: '20px', fontWeight: '600', marginBottom: '12px' }}>Keystroke & Mouse Kinematics</h3>
                <p style={{ color: 'var(--text-secondary)', lineHeight: '1.5', fontSize: '15px' }}>Analyzes key dwell/flight times, and cursor velocity/curvature. Zero raw inputs are ever transmitted.</p>
              </div>
            </FadeIn>
            <FadeIn delay={0.2}>
              <div className="bento-item">
                <Network size={28} color="var(--accent-primary)" style={{ marginBottom: '16px' }} />
                <h3 className="display-font" style={{ fontSize: '20px', fontWeight: '600', marginBottom: '12px' }}>Continuous Network Scanning</h3>
                <p style={{ color: 'var(--text-secondary)', lineHeight: '1.5', fontSize: '15px' }}>Detects VPNs, Tor exit nodes, and Datacenter proxies using live IP intelligence and ASN lookups.</p>
              </div>
            </FadeIn>
            <FadeIn delay={0.3}>
              <div className="bento-item">
                <Globe size={28} color="var(--accent-primary)" style={{ marginBottom: '16px' }} />
                <h3 className="display-font" style={{ fontSize: '20px', fontWeight: '600', marginBottom: '12px' }}>Impossible Travel Detection</h3>
                <p style={{ color: 'var(--text-secondary)', lineHeight: '1.5', fontSize: '15px' }}>Calculates Haversine distance between session IP geo-coordinates to detect physically impossible speed.</p>
              </div>
            </FadeIn>
            <FadeIn delay={0.4}>
              <div className="bento-item">
                <Activity size={28} color="var(--accent-primary)" style={{ marginBottom: '16px' }} />
                <h3 className="display-font" style={{ fontSize: '20px', fontWeight: '600', marginBottom: '12px' }}>WebSocket Latency & Jitter</h3>
                <p style={{ color: 'var(--text-secondary)', lineHeight: '1.5', fontSize: '15px' }}>Monitors transport integrity via ping/pong to detect proxy relay chaining and network hijacking.</p>
              </div>
            </FadeIn>
            <FadeIn delay={0.5}>
              <div className="bento-item" style={{ gridColumn: '1 / -1', background: 'linear-gradient(135deg, var(--bg-surface) 0%, var(--bg-elevated) 100%)' }}>
                <div style={{ display: 'flex', gap: '32px', flexWrap: 'wrap', alignItems: 'center' }}>
                  <div style={{ flex: '1 1 300px' }}>
                    <Server size={28} color="var(--accent-primary)" style={{ marginBottom: '16px' }} />
                    <h3 className="display-font" style={{ fontSize: '24px', fontWeight: '600', marginBottom: '12px' }}>Real-time SOC Console</h3>
                    <p style={{ color: 'var(--text-secondary)', lineHeight: '1.6', fontSize: '16px' }}>A comprehensive admin dashboard with live session drill-downs, policy threshold controls, strict RBAC, and an immutable audit log with CSV exports.</p>
                  </div>
                  <div style={{ flex: '1 1 300px', display: 'flex', justifyContent: 'center' }}>
                    <div style={{ padding: '24px', background: 'white', borderRadius: '16px', boxShadow: '0 8px 24px rgba(0,0,0,0.05)', border: '1px solid var(--border-subtle)', width: '100%' }}>
                       <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '8px', fontWeight: '600' }}>LIVE AUDIT FEED</div>
                       <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                         <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}><span style={{ color: 'var(--accent-danger)' }}>Session Locked</span> <span className="mono-font">emp_01</span></div>
                         <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}><span style={{ color: 'var(--accent-warn)' }}>VPN Detected</span> <span className="mono-font">emp_02</span></div>
                         <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}><span style={{ color: 'var(--accent-trust)' }}>Enrollment Complete</span> <span className="mono-font">emp_03</span></div>
                       </div>
                    </div>
                  </div>
                </div>
              </div>
            </FadeIn>
          </div>
        </div>
      </section>

      {/* 5. What's New Timeline */}
      <section style={{ backgroundColor: '#ffffff', padding: '96px 0', borderTop: '1px solid var(--border-subtle)' }}>
        <div className="section-container">
          <FadeIn>
            <div style={{ textAlign: 'center', marginBottom: '48px' }}>
              <h2 className="display-font" style={{ fontSize: '36px', fontWeight: '700', marginBottom: '16px' }}>TrustLoop 2.0 Upgrades</h2>
            </div>
          </FadeIn>
          <div style={{ maxWidth: '800px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {[
              "Continuous network monitoring engine (Haversine distance, ASN checks)",
              "Live threat simulator for instant network anomaly testing",
              "Model evaluation dashboard (AUC, EER, ROC, FAR/FRR on synthetic datasets)",
              "JWT-protected Websockets and strict Admin RBAC",
              "Brute-force rate limiting & temporary lockouts",
              "Docker Compose deployment infrastructure",
              "Adaptive enrollment progress and UI redesign"
            ].map((item, idx) => (
              <FadeIn key={idx} delay={idx * 0.05}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '16px 24px', background: 'var(--bg-elevated)', borderRadius: '12px', border: '1px solid var(--border-subtle)' }}>
                  <CheckCircleIcon color="var(--accent-trust)" />
                  <span style={{ fontSize: '16px', fontWeight: '500' }}>{item}</span>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* 6. Tech Stack */}
      <section id="tech" style={{ padding: '96px 0' }}>
        <div className="section-container">
          <FadeIn>
            <div style={{ textAlign: 'center', marginBottom: '64px' }}>
              <h2 className="display-font" style={{ fontSize: '36px', fontWeight: '700', marginBottom: '16px' }}>Technology Stack</h2>
              <p style={{ fontSize: '18px', color: 'var(--text-secondary)', maxWidth: '600px', margin: '0 auto' }}>Built with modern, typed, and performant tools.</p>
            </div>
          </FadeIn>

          <div className="grid-2" style={{ gap: '32px' }}>
            <FadeIn delay={0.1}>
              <div className="card">
                <h3 className="display-font" style={{ fontSize: '18px', fontWeight: '600', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}><Code size={20} /> Frontend</h3>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  <span className="chip">React 19</span> <span className="chip">TypeScript</span> <span className="chip">Vite</span>
                  <span className="chip">Vanilla CSS Variables</span> <span className="chip">Recharts</span> <span className="chip">Lucide</span>
                  <span className="chip">React Three Fiber</span> <span className="chip">Framer Motion</span>
                </div>
              </div>
            </FadeIn>
            <FadeIn delay={0.2}>
              <div className="card">
                <h3 className="display-font" style={{ fontSize: '18px', fontWeight: '600', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}><Server size={20} /> Backend</h3>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  <span className="chip">FastAPI</span> <span className="chip">Python 3.10</span> <span className="chip">WebSockets</span>
                  <span className="chip">JWT Auth</span> <span className="chip">Pydantic</span> <span className="chip">Uvicorn</span>
                </div>
              </div>
            </FadeIn>
            <FadeIn delay={0.3}>
              <div className="card">
                <h3 className="display-font" style={{ fontSize: '18px', fontWeight: '600', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}><Crosshair size={20} /> Machine Learning</h3>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  <span className="chip">scikit-learn</span> <span className="chip">Isolation Forest</span> <span className="chip">NumPy</span>
                  <span className="chip">Feature Drift Scoring</span> <span className="chip">EMA Smoothing</span>
                </div>
              </div>
            </FadeIn>
            <FadeIn delay={0.4}>
              <div className="card">
                <h3 className="display-font" style={{ fontSize: '18px', fontWeight: '600', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}><Database size={20} /> DevOps & Data</h3>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  <span className="chip">Docker</span> <span className="chip">Docker Compose</span> <span className="chip">Nginx</span>
                  <span className="chip">SQLite</span> <span className="chip">SQLAlchemy ORM</span> <span className="chip">IP-API</span>
                </div>
              </div>
            </FadeIn>
          </div>
        </div>
      </section>

      {/* 7. Privacy By Design */}
      <section style={{ backgroundColor: 'var(--bg-surface)', padding: '96px 0', borderTop: '1px solid var(--border-subtle)', borderBottom: '1px solid var(--border-subtle)' }}>
        <div className="section-container">
          <FadeIn>
            <div style={{ textAlign: 'center', maxWidth: '800px', margin: '0 auto' }}>
              <Shield size={48} color="var(--accent-trust)" style={{ margin: '0 auto 24px auto' }} />
              <h2 className="display-font" style={{ fontSize: '36px', fontWeight: '700', marginBottom: '24px' }}>Privacy by Design</h2>
              <p style={{ fontSize: '24px', color: 'var(--text-primary)', fontWeight: '500', marginBottom: '32px' }}>"We never record what you type, only when."</p>
              
              <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', justifyContent: 'center' }}>
                <div style={{ padding: '24px', background: 'rgba(18, 183, 106, 0.1)', color: 'var(--text-primary)', borderRadius: '16px', flex: '1 1 250px', textAlign: 'left', border: '1px solid rgba(18, 183, 106, 0.2)' }}>
                  <h4 style={{ fontWeight: '600', marginBottom: '12px', color: 'var(--accent-trust)' }}>What We Collect</h4>
                  <ul style={{ paddingLeft: '20px', lineHeight: '1.6', fontSize: '15px' }}>
                    <li>Key flight/dwell times (ms)</li>
                    <li>Mouse speed & curvature</li>
                    <li>IP address (for geolocation)</li>
                    <li>Ping latency</li>
                  </ul>
                </div>
                <div style={{ padding: '24px', background: 'rgba(240, 68, 56, 0.1)', color: 'var(--text-primary)', borderRadius: '16px', flex: '1 1 250px', textAlign: 'left', border: '1px solid rgba(240, 68, 56, 0.2)' }}>
                  <h4 style={{ fontWeight: '600', marginBottom: '12px', color: 'var(--accent-danger)' }}>What We NEVER Collect</h4>
                  <ul style={{ paddingLeft: '20px', lineHeight: '1.6', fontSize: '15px' }}>
                    <li>Actual character inputs</li>
                    <li>Passwords or form data</li>
                    <li>Raw screen coordinates</li>
                    <li>Screen recordings</li>
                  </ul>
                </div>
              </div>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* 8. Portals */}
      <section style={{ padding: '96px 0' }}>
        <div className="section-container">
          <FadeIn>
            <div style={{ textAlign: 'center', marginBottom: '64px' }}>
              <h2 className="display-font" style={{ fontSize: '36px', fontWeight: '700', marginBottom: '16px' }}>Two Portals, One Truth</h2>
              <p style={{ fontSize: '18px', color: 'var(--text-secondary)', maxWidth: '600px', margin: '0 auto' }}>Strict RBAC ensures employees only see their data, while the SOC monitors the whole organization.</p>
            </div>
          </FadeIn>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '32px' }}>
            <FadeIn delay={0.1}>
              <div className="card" style={{ background: 'var(--bg-surface)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                  <h3 className="display-font" style={{ fontSize: '24px', fontWeight: '600' }}>Employee Portal</h3>
                  <span className="chip">emp_01</span>
                </div>
                <p style={{ color: 'var(--text-secondary)', marginBottom: '24px', lineHeight: '1.6' }}>A privacy-first dashboard showing their live trust score, active device fingerprint, and personal network security evaluation.</p>
                <div style={{ height: '200px', background: 'var(--bg-elevated)', borderRadius: '12px', border: '1px solid var(--border-subtle)', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ width: '40%', height: '24px', background: 'var(--border-subtle)', borderRadius: '4px' }} />
                  <div style={{ display: 'flex', gap: '12px' }}>
                    <div style={{ flex: 1, height: '100px', background: 'var(--bg-surface)', borderRadius: '8px', border: '1px solid var(--border-subtle)', padding: '12px' }}>
                       <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '8px' }}>TRUST SCORE</div>
                       <div className="display-font" style={{ fontSize: '28px', color: 'var(--accent-trust)', fontWeight: '600' }}>98</div>
                    </div>
                    <div style={{ flex: 2, height: '100px', background: 'var(--bg-surface)', borderRadius: '8px', border: '1px solid var(--border-subtle)' }} />
                  </div>
                </div>
              </div>
            </FadeIn>
            
            <FadeIn delay={0.2}>
              <div className="card" style={{ background: 'linear-gradient(135deg, rgba(51, 92, 255, 0.05) 0%, transparent 100%)', borderColor: 'rgba(51, 92, 255, 0.2)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                  <h3 className="display-font" style={{ fontSize: '24px', fontWeight: '600' }}>Admin SOC</h3>
                  <span className="chip" style={{ background: 'rgba(51, 92, 255, 0.1)', color: 'var(--accent-primary)', borderColor: 'rgba(51, 92, 255, 0.2)' }}>admin</span>
                </div>
                <p style={{ color: 'var(--text-secondary)', marginBottom: '24px', lineHeight: '1.6' }}>Global visibility. Real-time network maps, threat simulation toggles, model evaluation metrics, and manual termination controls.</p>
                <div style={{ height: '200px', background: 'var(--bg-surface)', borderRadius: '12px', border: '1px solid var(--border-subtle)', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px', boxShadow: '0 12px 24px rgba(0,0,0,0.05)' }}>
                  <div style={{ display: 'flex', gap: '8px' }}>
                     <div style={{ width: '20%', height: '140px', background: 'var(--bg-elevated)', borderRadius: '4px' }} />
                     <div style={{ width: '80%', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                       <div style={{ height: '40px', background: 'var(--bg-elevated)', borderRadius: '4px' }} />
                       <div style={{ height: '90px', background: 'var(--bg-elevated)', borderRadius: '4px' }} />
                     </div>
                  </div>
                </div>
              </div>
            </FadeIn>
          </div>
        </div>
      </section>

      {/* 9. Limitations */}
      <section style={{ padding: '64px 0', backgroundColor: 'var(--bg-base)' }}>
        <div className="section-container" style={{ maxWidth: '800px' }}>
          <h3 className="display-font" style={{ fontSize: '20px', fontWeight: '600', marginBottom: '24px', color: 'var(--text-secondary)' }}>Honest Limitations & Roadmap</h3>
          <ul style={{ color: 'var(--text-secondary)', lineHeight: '1.8', fontSize: '15px', paddingLeft: '20px' }}>
            <li><strong style={{ color: 'var(--text-primary)' }}>On-device Inference:</strong> Currently, telemetry is streamed to the server. Future roadmap moves the Isolation Forest to WebAssembly (WASM) for edge computing.</li>
            <li><strong style={{ color: 'var(--text-primary)' }}>Step-up Authentication:</strong> Hard lockouts are implemented. Next version will feature seamless TOTP step-up flows.</li>
            <li><strong style={{ color: 'var(--text-primary)' }}>Deep Temporal Models:</strong> Replacing static isolation forests with RNNs/LSTMs for time-series memory.</li>
            <li><strong style={{ color: 'var(--text-primary)' }}>Mobile Touch:</strong> Support for mobile device orientation and touchscreen pressure.</li>
          </ul>
        </div>
      </section>

      {/* 10. CTA & Footer */}
      <section style={{ padding: '96px 0', backgroundColor: 'var(--bg-surface)', borderTop: '1px solid var(--border-subtle)' }}>
        <div style={{ maxWidth: '800px', margin: '0 auto', padding: '0 24px', textAlign: 'center' }}>
          <h2 className="display-font" style={{ fontSize: '40px', fontWeight: '700', marginBottom: '24px' }}>Ready to explore?</h2>
          <p style={{ fontSize: '20px', color: 'var(--text-secondary)', marginBottom: '40px' }}>Log in to experience continuous authentication in real time.</p>
          <div style={{ display: 'flex', gap: '16px', justifyContent: 'center' }}>
            <Link to="/login" className="btn-primary" style={{ fontSize: '16px', padding: '16px 40px' }}>Go to Login</Link>
          </div>
        </div>
      </section>

      <footer style={{ padding: '48px 0', backgroundColor: 'var(--bg-base)' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Shield size={20} style={{ color: 'var(--text-secondary)' }} />
            <span className="display-font" style={{ fontWeight: '600', fontSize: '18px', color: 'var(--text-secondary)' }}>TrustLoop 2.0</span>
          </div>
          <div style={{ fontSize: '14px', color: 'var(--text-secondary)', display: 'flex', gap: '24px' }}>
            <a href="https://github.com" target="_blank" rel="noreferrer" style={{ color: 'inherit', textDecoration: 'none' }}>GitHub Repository</a>
            <span>Demo Application</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

// Inline Icon components for cleanliness
const SparkleIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3L12 3Z"/></svg>;
const CheckCircleIcon = ({ color }: { color: string }) => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>;
