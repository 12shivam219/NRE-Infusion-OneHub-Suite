import { useState, useEffect } from 'react';

export function useNetworkStatus() {
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    const [networkType, setNetworkType] = useState<string | undefined>(
        // @ts-ignore
        navigator.connection?.effectiveType
    );

    useEffect(() => {
        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);
        const handleConnectionChange = () => {
            // @ts-ignore
            setNetworkType(navigator.connection?.effectiveType);
        };

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        // @ts-ignore
        navigator.connection?.addEventListener('change', handleConnectionChange);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
            // @ts-ignore
            navigator.connection?.removeEventListener('change', handleConnectionChange);
        };
    }, []);

    return { isOnline, networkType };
}