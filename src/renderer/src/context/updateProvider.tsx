import React, { createContext, useContext, useEffect, useRef, useState } from 'react';

interface UpdateContextType {
    progress: number;
    isChecking: boolean;
    isDownloading: boolean;
    isReady: boolean;
    error: string | null;
    checkForUpdates: () => Promise<any>;
    installUpdate: () => void;
    clearError: () => void;
}

const UpdateContext = createContext<UpdateContextType | undefined>(undefined);

export const UpdateProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [progress, setProgress] = useState<number>(0);
    const [isChecking, setIsChecking] = useState<boolean>(false);
    const [isDownloading, setIsDownloading] = useState<boolean>(false);
    const [isReady, setIsReady] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);

    const checkInFlight = useRef(false);

    useEffect(() => {
        const updateApi = window.clinic?.update;
        if (!updateApi) return;

        // 0. Update available
        const unsubAvailable = updateApi.onAvailable?.(() => {
            setIsChecking(false);
            setIsDownloading(true);
            setIsReady(false);
            setError(null);
        });

        // 1. Download progress
        const unsubProgress = updateApi.onProgress((percent: number) => {
            setIsChecking(false);
            setIsDownloading(true);
            setError(null);
            setProgress(percent);
        });

        // 2. Download complete
        const unsubReady = updateApi.onReady(() => {
            setIsChecking(false);
            setIsDownloading(false);
            setIsReady(true);
            setProgress(100);
            setError(null);
        });

        // 3. Error
        const unsubError = updateApi.onError?.((errMessage: string) => {
            setIsChecking(false);
            setIsDownloading(false);
            setProgress(0);
            setError(errMessage || 'An error occurred during update download.');
        });

        return () => {
            if (typeof unsubAvailable === 'function') unsubAvailable();
            if (typeof unsubProgress === 'function') unsubProgress();
            if (typeof unsubReady === 'function') unsubReady();
            if (typeof unsubError === 'function') unsubError();
        };
    }, []);

    const checkForUpdates = async () => {
        if (!window.clinic?.update?.check) return;

        if (checkInFlight.current || isDownloading) return;

        checkInFlight.current = true;
        setIsChecking(true);
        setError(null);

        try {
            const res = await window.clinic.update.check();

            if (res === 'available' || (typeof res === 'object' && (res as any)?.updateInfo)) {
                setIsDownloading(true);
                setIsReady(false);
                // Show immediate visual feedback
                setProgress((prev) => (prev === 0 ? 1 : prev));
            } else {
                setIsDownloading(false);
                setProgress(0);
            }
            return res;
        } catch (err: any) {
            setError(err?.message || 'Failed to check updates');
        } finally {
            checkInFlight.current = false;
            setIsChecking(false);
        }
    };

    const installUpdate = () => {
        window.clinic?.update?.install();
    };

    const clearError = () => {
        setError(null);
    };

    return (
        <UpdateContext.Provider value={{ progress, isChecking, isDownloading, isReady, error, checkForUpdates, installUpdate, clearError }}>
            {children}
        </UpdateContext.Provider>
    );
};

export const useUpdate = () => {
    const context = useContext(UpdateContext);
    if (!context) throw new Error('useUpdate must be used within UpdateProvider');
    return context;
};