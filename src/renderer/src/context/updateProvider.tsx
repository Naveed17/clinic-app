import React, { createContext, useContext, useEffect, useState } from 'react';

interface UpdateContextType {
    progress: number;
    isDownloading: boolean;
    isReady: boolean;
    // Type void ki jagah Promise<any> ya Promise<string | undefined> karein:
    checkForUpdates: () => Promise<any>;
    installUpdate: () => void;
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

    useEffect(() => {
        const updateApi = window.clinic?.update;
        if (!updateApi) return;

        // 1. Download progress update handler
        const unsubProgress = updateApi.onProgress((percent: number) => {
            setIsDownloading(true);
            setProgress(Math.round(percent));
        });

        // 2. Download completion handler
        const unsubReady = updateApi.onReady(() => {
            setIsDownloading(false);
            setIsReady(true);
        });

        return () => {
            if (typeof unsubProgress === 'function') unsubProgress();
            if (typeof unsubReady === 'function') unsubReady();
        };
    }, []);



    const installUpdate = () => {
        window.clinic?.update?.install();
    };

    return (
        <UpdateContext.Provider value={{ progress, isDownloading, isReady, checkForUpdates, installUpdate }}>
            {children}
        </UpdateContext.Provider>
    );
};

export const useUpdate = () => {
    const context = useContext(UpdateContext);
    if (!context) throw new Error('useUpdate must be used within UpdateProvider');
    return context;
};