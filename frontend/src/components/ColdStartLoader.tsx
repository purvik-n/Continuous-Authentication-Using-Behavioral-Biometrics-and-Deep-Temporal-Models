import { useEffect, useState } from 'react';
import { API_BASE_URL } from '../config';
import { Loader2 } from 'lucide-react';

export default function ColdStartLoader({ children }: { children: React.ReactNode }) {
    const [isWaking, setIsWaking] = useState(false);
    const [isReady, setIsReady] = useState(false);

    useEffect(() => {
        let timer: ReturnType<typeof setTimeout>;
        let mounted = true;

        const checkBackend = async () => {
            try {
                // If the fetch takes more than 1.5 seconds, we assume cold start
                timer = setTimeout(() => {
                    if (mounted) setIsWaking(true);
                }, 1500);

                const response = await fetch(`${API_BASE_URL}/`, {
                    // Timeout signal isn't fully supported everywhere without polyfills, but fetch will eventually fail or succeed
                });
                
                if (response.status !== 502 && response.status !== 503) {
                    if (mounted) {
                        clearTimeout(timer);
                        setIsWaking(false);
                        setIsReady(true);
                    }
                } else {
                    if (mounted) setTimeout(checkBackend, 2000);
                }
            } catch (err) {
                // Backend is likely still waking up or unreachable, retry after 2 seconds
                if (mounted) {
                    setTimeout(checkBackend, 2000);
                }
            }
        };

        checkBackend();

        return () => {
            mounted = false;
            clearTimeout(timer);
        };
    }, []);

    if (!isReady) {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', backgroundColor: 'var(--bg-base)', color: 'var(--text-primary)' }}>
                <div style={{ marginBottom: '24px' }}>
                    <Loader2 size={64} color="var(--accent-primary)" className="animate-spin" />
                </div>
                {isWaking ? (
                    <div style={{ textAlign: 'center' }}>
                        <h2 className="display-font" style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '8px' }}>Waking up the server...</h2>
                        <p style={{ color: 'var(--text-secondary)', maxWidth: '400px', lineHeight: '1.5' }}>
                            TrustLoop is hosted on a free Render tier, which spins down after 15 minutes of inactivity. 
                            It usually takes about 30-50 seconds to spin back up. Hang tight!
                        </p>
                    </div>
                ) : (
                    <div style={{ textAlign: 'center' }}>
                        <h2 className="display-font" style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '8px' }}>Connecting to TrustLoop...</h2>
                    </div>
                )}
            </div>
        );
    }

    return <>{children}</>;
}
