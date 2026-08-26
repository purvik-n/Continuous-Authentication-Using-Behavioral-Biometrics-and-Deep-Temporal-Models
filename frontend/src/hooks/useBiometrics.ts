import { useEffect, useRef, useState, useCallback } from 'react';

export interface BiometricFeatures {
  avgDwell: number;
  avgFlight: number;
  mouseVelocity: number;
  mouseCurvature: number;
  batchTimestamp: number;
}

export function useBiometrics(onBatchReady: (features: BiometricFeatures) => void) {
  const [isActive, setIsActive] = useState(false);
  
  // Keystroke state
  const keyMap = useRef<{ [key: string]: number }>({});
  const lastKeyUpTime = useRef<number | null>(null);
  
  // Mouse state
  const lastMousePos = useRef<{ x: number, y: number, t: number } | null>(null);
  
  // Buffers for current 2s window
  const dwellTimes = useRef<number[]>([]);
  const flightTimes = useRef<number[]>([]);
  const mouseVelocities = useRef<number[]>([]);
  const mouseCurvatures = useRef<number[]>([]); // simplified as angle variance or directional changes

  // Last known values to avoid zeros when one modality is temporarily idle
  const lastDwell = useRef<number>(110);
  const lastFlight = useRef<number>(140);
  const lastVelocity = useRef<number>(450);
  const lastCurvature = useRef<number>(0.25);

  const startCapture = useCallback(() => setIsActive(true), []);
  const stopCapture = useCallback(() => setIsActive(false), []);

  useEffect(() => {
    if (!isActive) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const now = performance.now();
      
      // Calculate flight time (time since last key up)
      if (lastKeyUpTime.current !== null) {
        const flight = now - lastKeyUpTime.current;
        if (flight > 0 && flight < 2000) { // ignore pauses > 2s
          flightTimes.current.push(flight);
        }
      }
      
      // Record keydown time for dwell calculation
      if (!keyMap.current[e.code]) {
        keyMap.current[e.code] = now;
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const now = performance.now();
      lastKeyUpTime.current = now;
      
      const downTime = keyMap.current[e.code];
      if (downTime) {
        const dwell = now - downTime;
        if (dwell > 10 && dwell < 2000) {
          dwellTimes.current.push(dwell);
        }
        delete keyMap.current[e.code];
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      const now = performance.now();
      
      if (lastMousePos.current) {
        const dx = e.clientX - lastMousePos.current.x;
        const dy = e.clientY - lastMousePos.current.y;
        const dt = now - lastMousePos.current.t;
        
        if (dt > 5) {
          const dist = Math.sqrt(dx * dx + dy * dy);
          const velocity = (dist / dt) * 1000; // in px/sec
          if (velocity > 0 && velocity < 15000) {
            mouseVelocities.current.push(velocity);
          }
          
          const angle = Math.atan2(dy, dx);
          mouseCurvatures.current.push(angle); 
        }
      }
      
      lastMousePos.current = { x: e.clientX, y: e.clientY, t: now };
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('mousemove', handleMouseMove);

    // 2-second batching interval
    const intervalId = setInterval(() => {
      const avg = (arr: number[]) => arr.length ? arr.reduce((a,b) => a+b, 0) / arr.length : 0;
      
      const hasKeys = dwellTimes.current.length > 0;
      const hasMouse = mouseVelocities.current.length > 0;

      if (hasKeys) {
        lastDwell.current = Math.round(avg(dwellTimes.current));
        if (flightTimes.current.length > 0) {
          lastFlight.current = Math.round(avg(flightTimes.current));
        }
      }

      if (hasMouse) {
        lastVelocity.current = Math.round(avg(mouseVelocities.current));
        let curvatureVariance = 0;
        if (mouseCurvatures.current.length > 1) {
          const meanAngle = avg(mouseCurvatures.current);
          const sqDiffs = mouseCurvatures.current.map(a => Math.pow(a - meanAngle, 2));
          curvatureVariance = parseFloat(avg(sqDiffs).toFixed(3));
        }
        lastCurvature.current = curvatureVariance;
      }

      // Only send if there was actual interaction in this 2s window
      if (hasKeys || hasMouse) {
        const features: BiometricFeatures = {
          avgDwell: lastDwell.current,
          avgFlight: lastFlight.current,
          mouseVelocity: lastVelocity.current,
          mouseCurvature: lastCurvature.current,
          batchTimestamp: Date.now()
        };
        
        console.log(`[TrustLoop Biometrics] Batch -> Dwell: ${features.avgDwell}ms | Flight: ${features.avgFlight}ms | Velocity: ${features.mouseVelocity}px/s | Curvature: ${features.mouseCurvature}`);
        onBatchReady(features);
      }

      // Clear buffers
      dwellTimes.current = [];
      flightTimes.current = [];
      mouseVelocities.current = [];
      mouseCurvatures.current = [];
      
    }, 2000);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('mousemove', handleMouseMove);
      clearInterval(intervalId);
    };
  }, [isActive, onBatchReady]);

  return { startCapture, stopCapture, isActive };
}
