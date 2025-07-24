import React, { createContext, useContext, useState, ReactNode } from 'react';

export type TEEState = {
    attestation: string;
    isInitialized: boolean;
    pubkey: string;
    signer: string;
};

type TEEContextType = {
    teeState: TEEState | null;
    setTEEState: (state: TEEState) => void;
};

const TEEContext = createContext<TEEContextType | undefined>(undefined);

export const TEEStateProvider = ({ children }: { children: ReactNode }) => {
    const [teeState, setTEEState] = useState<TEEState | null>(null);

    return (
        <TEEContext.Provider value={{ teeState, setTEEState }}>
            {children}
        </TEEContext.Provider>
    );
};

export const useTEEContext = (): TEEContextType => {
    const context = useContext(TEEContext);
    if (!context) {
        throw new Error('useTEEContext must be used within a TEEProvider');
    }
    return context;
};
