import React, { createContext, useContext, useEffect, useState } from 'react';

interface UpdateContextType {
    progress: number;
    isDownloading: boolean;
    isReady: boolean;
    error: string | null;
    checkForUpdates: () => Promise<any>;
    installUpdate: () => void;
    clearError: () => void;
}

const checkForUpdates = async () => {
    if (window.clinic?.update?.check) {
        return await window.clinic.update.check();
    }
};

const UpdateContext = createContext<UpdateContextType | undefined>(undefined);

export const UpdateProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [progress, setProgress] = useState<number>(0);
    const [isDownloading, setIsDownloading] = useState<boolean>(false);
    const [isReady, setIsReady] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const updateApi = window.clinic?.update;
        if (!updateApi) return;

        // 1. Download progress update handler
        const unsubProgress = updateApi.onProgress((percent: number) => {
            setIsDownloading(true);
            setError(null);
            setProgress(Math.round(percent));
        });

        // 2. Download completion handler
        const unsubReady = updateApi.onReady(() => {
            setIsDownloading(false);
            setIsReady(true);
            setError(null);
        });

        // 3. Error handler
        const unsubError = updateApi.onError?.((errMessage: string) => {
            setIsDownloading(false);
            setError(errMessage || 'An error occurred during update download.');
        });

        return () => {
            if (typeof unsubProgress === 'function') unsubProgress();
            if (typeof unsubReady === 'function') unsubReady();
            if (typeof unsubError === 'function') unsubError();
        };
    }, []);

    const installUpdate = () => {
        window.clinic?.update?.install();
    };

    const clearError = () => {
        setError(null);
    };

    return (
        <UpdateContext.Provider value={{ progress, isDownloading, isReady, error, checkForUpdates, installUpdate, clearError }}>
            {children}
        </UpdateContext.Provider>
    );
};

export const useUpdate = () => {
    const context = useContext(UpdateContext);
    if (!context) throw new Error('useUpdate must be used within UpdateProvider');
    return context;
};