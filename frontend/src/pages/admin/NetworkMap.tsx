import React, { useEffect, useState } from 'react';
import { API_BASE_URL, WS_BASE_URL } from "../../config";
import { Map, Wifi, CheckCircle, AlertTriangle } from 'lucide-react';
import { ScatterChart, Scatter, XAxis, YAxis, Tooltip, ResponsiveContainer, ZAxis, Cell, PieChart, Pie } from 'recharts';

export default function NetworkMap() {
  const [employees, setEmployees] = useState<any[]>([]);
  const [stats, setStats] = useState({ recognized: 0, unrecognized: 0 });

  useEffect(() => {
    fetch(API_BASE_URL + '/api/admin/employees')
      .then(r => r.json())
      .then(setEmployees)
      .catch(console.error);

    fetch(API_BASE_URL + '/api/admin/network_stats')
      .then(r => r.json())
      .then(setStats)
      .catch(console.error);
  }, []);

  // Extract active sessions with coordinates
  const activeSessions = employees.flatMap(emp => 
    emp.sessions.filter((s: any) => s.status === 'active' && s.lat != null && s.lon != null)
      .map((s: any) => ({
        id: s.session_id,
        user: emp.full_name,
        lat: s.lat,
        lon: s.lon,
        trust: s.trust_score,
        isp: s.network_isp,
        recognized: s.network_recognized
      }))
  );

  const pieData = [
    { name: 'Corporate (Trusted)', value: stats.recognized },
    { name: 'Unknown / Remote', value: stats.unrecognized },
  ];

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div style={{ backgroundColor: 'var(--bg-surface)', padding: '12px', border: '1px solid var(--border-subtle)', borderRadius: '8px' }}>
          <div style={{ fontWeight: '600', marginBottom: '4px' }}>{data.user}</div>
          <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>ISP: {data.isp}</div>
          <div style={{ fontSize: '13px', color: data.trust >= 80 ? 'var(--accent-trust)' : 'var(--accent-warn)', fontWeight: '500', marginTop: '4px' }}>
            Trust Score: {Math.round(data.trust)}
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
      <header style={{ marginBottom: '24px' }}>
        <h1 className="display-font" style={{ fontSize: '24px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Map color="var(--accent-primary)" />
          Global Network Map
        </h1>
        <p style={{ color: 'var(--text-secondary)', marginTop: '4px' }}>
          Geographic distribution of active sessions and network reputation.
        </p>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px' }}>
        {/* Map Visualization using Scatter Chart as a proxy for coordinates */}
        <div className="card" style={{ height: '500px', display: 'flex', flexDirection: 'column' }}>
          <h2 className="display-font" style={{ fontSize: '16px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Wifi size={16} color="var(--accent-primary)" /> Active Connections
          </h2>
          <div style={{ flex: 1, backgroundColor: 'var(--bg-base)', borderRadius: '8px', border: '1px solid var(--border-subtle)', position: 'relative' }}>
             {/* Simple grid lines to simulate a coordinate plane */}
             <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0.1, backgroundImage: 'linear-gradient(var(--text-primary) 1px, transparent 1px), linear-gradient(90deg, var(--text-primary) 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
             
             <ResponsiveContainer width="100%" height="100%">
               <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                 <XAxis type="number" dataKey="lon" name="Longitude" domain={[-180, 180]} hide />
                 <YAxis type="number" dataKey="lat" name="Latitude" domain={[-90, 90]} hide />
                 <ZAxis type="number" range={[100, 400]} />
                 <Tooltip content={<CustomTooltip />} cursor={{ strokeDasharray: '3 3' }} />
                 <Scatter name="Sessions" data={activeSessions}>
                   {activeSessions.map((entry, index) => (
                     <Cell key={`cell-${index}`} fill={entry.recognized ? 'var(--accent-trust)' : 'var(--accent-warn)'} />
                   ))}
                 </Scatter>
               </ScatterChart>
             </ResponsiveContainer>

             {activeSessions.length === 0 && (
               <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', color: 'var(--text-secondary)', fontSize: '14px', fontStyle: 'italic' }}>
                 No active sessions with location data available.
               </div>
             )}
          </div>
        </div>

        {/* Network Stats Sidebar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div className="card" style={{ height: '240px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <h2 className="display-font" style={{ fontSize: '16px', marginBottom: '16px', alignSelf: 'flex-start' }}>Network Reputation</h2>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={45} outerRadius={70} dataKey="value" stroke="none">
                  {pieData.map((_, i) => (
                    <Cell key={`cell-${i}`} fill={i === 0 ? 'var(--accent-trust)' : 'var(--accent-warn)'} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', width: '100%', fontSize: '13px' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><span style={{ width: '10px', height: '10px', backgroundColor: 'var(--accent-trust)', borderRadius: '2px' }}></span> Corporate</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><span style={{ width: '10px', height: '10px', backgroundColor: 'var(--accent-warn)', borderRadius: '2px' }}></span> Unknown</span>
            </div>
          </div>

          <div className="card" style={{ flex: 1, overflowY: 'auto' }}>
            <h2 className="display-font" style={{ fontSize: '16px', marginBottom: '16px' }}>Connection Log</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {activeSessions.map((s, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
                  {s.recognized ? <CheckCircle size={16} color="var(--accent-trust)" /> : <AlertTriangle size={16} color="var(--accent-warn)" />}
                  <div>
                    <div style={{ fontWeight: '600', fontSize: '14px' }}>{s.isp}</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{s.user}</div>
                  </div>
                </div>
              ))}
              {activeSessions.length === 0 && (
                 <div style={{ color: 'var(--text-secondary)', fontSize: '13px', fontStyle: 'italic', textAlign: 'center' }}>No active connections.</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
