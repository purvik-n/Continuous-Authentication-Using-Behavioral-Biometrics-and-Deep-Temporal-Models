import React, { useEffect, useState } from 'react';
import { API_BASE_URL } from '../../config';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { BrainCircuit, Activity, CheckCircle, AlertTriangle, Play } from 'lucide-react';

interface ROCPoint {
  fpr: number;
  tpr: number;
}

interface FARFRRPoint {
  threshold: number;
  far: number;
  frr: number;
}

interface EvaluationResult {
  auc: number;
  eer: number;
  roc_curve: ROCPoint[];
  far_frr_curve: FARFRRPoint[];
  summary: string;
}

export default function ModelEvaluation() {
  const [result, setResult] = useState<EvaluationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const adminToken = () => localStorage.getItem('trustloop_token') || '';
  const adminHeaders = () => ({
    'Authorization': `Bearer ${adminToken()}`,
    'Content-Type': 'application/json'
  });

  const runEvaluation = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/evaluation`, {
        headers: adminHeaders()
      });
      if (!res.ok) throw new Error('Failed to run evaluation');
      const data: EvaluationResult = await res.json();
      setResult(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Run evaluation automatically on first load
    runEvaluation();
  }, []);

  return (
    <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
      <header style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 className="display-font" style={{ fontSize: '24px', color: 'var(--text-primary)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <BrainCircuit color="var(--accent-primary)" />
            Model Evaluation & Benchmarking
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
            Continuous Authentication Model Performance Metrics on synthetic continuous behavioral distributions.
          </p>
        </div>
        <button 
          onClick={runEvaluation} 
          disabled={loading}
          style={{ 
            display: 'flex', alignItems: 'center', gap: '8px', 
            padding: '10px 16px', borderRadius: '8px',
            backgroundColor: 'var(--accent-primary)', color: 'white',
            border: 'none', cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.7 : 1, fontWeight: '500'
          }}
        >
          {loading ? <Activity size={18} className="spin" /> : <Play size={18} />}
          {loading ? 'Running Evaluation...' : 'Rerun Evaluation'}
        </button>
      </header>

      {error && (
        <div style={{ padding: '16px', backgroundColor: 'rgba(255, 68, 68, 0.1)', color: 'var(--accent-danger)', borderRadius: '8px', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <AlertTriangle size={18} />
          {error}
        </div>
      )}

      {result && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px', marginBottom: '24px' }}>
            <div className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <div style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '8px' }}>Area Under ROC (AUC)</div>
              <div className="display-font" style={{ fontSize: '36px', color: 'var(--accent-trust)' }}>
                {result.auc.toFixed(4)}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                1.0 is perfect discrimination.
              </div>
            </div>
            
            <div className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <div style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '8px' }}>Equal Error Rate (EER)</div>
              <div className="display-font" style={{ fontSize: '36px', color: 'var(--accent-primary)' }}>
                {(result.eer * 100).toFixed(2)}%
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                Where False Acceptance = False Rejection. Lower is better.
              </div>
            </div>

            <div className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <div style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '8px' }}>Status Summary</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--accent-trust)', fontWeight: '500' }}>
                <CheckCircle size={20} /> Evaluation Successful
              </div>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '8px', lineHeight: '1.4' }}>
                {result.summary}
              </p>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(500px, 1fr))', gap: '24px' }}>
            {/* ROC Curve Chart */}
            <div className="card">
              <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '16px', color: 'var(--text-primary)' }}>Receiver Operating Characteristic (ROC)</h3>
              <div style={{ height: '350px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={result.roc_curve} margin={{ top: 5, right: 30, left: 20, bottom: 25 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
                    <XAxis 
                      dataKey="fpr" 
                      type="number" 
                      domain={[0, 1]} 
                      stroke="var(--text-secondary)"
                      label={{ value: 'False Positive Rate (FAR)', position: 'bottom', offset: 0, fill: 'var(--text-secondary)', fontSize: 12 }} 
                      tick={{fill: 'var(--text-secondary)', fontSize: 11}}
                    />
                    <YAxis 
                      dataKey="tpr" 
                      type="number" 
                      domain={[0, 1]} 
                      stroke="var(--text-secondary)"
                      label={{ value: 'True Positive Rate (1 - FRR)', angle: -90, position: 'insideLeft', fill: 'var(--text-secondary)', fontSize: 12 }}
                      tick={{fill: 'var(--text-secondary)', fontSize: 11}}
                    />
                    <RechartsTooltip 
                      contentStyle={{ backgroundColor: 'var(--bg-elevated)', borderColor: 'var(--border-subtle)', borderRadius: '8px' }}
                      formatter={(value: any) => typeof value === 'number' ? value.toFixed(3) : value}
                    />
                    <Line type="monotone" dataKey="tpr" stroke="var(--accent-primary)" strokeWidth={3} dot={false} name="Model ROC" />
                    <Line type="monotone" dataKey="fpr" stroke="var(--text-secondary)" strokeDasharray="5 5" dot={false} name="Random Guess" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* FAR/FRR Curve Chart */}
            <div className="card">
              <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '16px', color: 'var(--text-primary)' }}>FAR vs FRR Threshold Trade-off</h3>
              <div style={{ height: '350px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={result.far_frr_curve} margin={{ top: 5, right: 30, left: 20, bottom: 25 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
                    <XAxis 
                      dataKey="threshold" 
                      stroke="var(--text-secondary)"
                      label={{ value: 'Anomaly Score Threshold', position: 'bottom', offset: 0, fill: 'var(--text-secondary)', fontSize: 12 }}
                      tick={{fill: 'var(--text-secondary)', fontSize: 11}}
                      tickFormatter={(value) => value.toFixed(1)}
                    />
                    <YAxis 
                      stroke="var(--text-secondary)"
                      label={{ value: 'Error Rate', angle: -90, position: 'insideLeft', fill: 'var(--text-secondary)', fontSize: 12 }}
                      tick={{fill: 'var(--text-secondary)', fontSize: 11}}
                    />
                    <RechartsTooltip 
                      contentStyle={{ backgroundColor: 'var(--bg-elevated)', borderColor: 'var(--border-subtle)', borderRadius: '8px' }}
                      formatter={(value: any) => typeof value === 'number' ? value.toFixed(3) : value}
                      labelFormatter={(label) => `Threshold: ${Number(label).toFixed(2)}`}
                    />
                    <Legend wrapperStyle={{ fontSize: '12px', color: 'var(--text-secondary)' }} />
                    <Line type="monotone" dataKey="far" stroke="var(--accent-danger)" strokeWidth={2} dot={false} name="False Acceptance Rate (FAR)" />
                    <Line type="monotone" dataKey="frr" stroke="var(--accent-warn)" strokeWidth={2} dot={false} name="False Rejection Rate (FRR)" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
