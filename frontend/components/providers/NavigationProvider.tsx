// components/providers/NavigationProvider.tsx
import React, { createContext, useContext, useState } from 'react';

type ScreenName =
  | 'ConnectWallet'
  | 'Dashboard'
  | 'Settings'
  | 'Records'
  | 'Organizations'
  | 'Upload'
  | 'RegisterOrg'
  | 'ShareRecord';

interface NavigationContextType {
  currentScreen: ScreenName;
  navigate: (screen: ScreenName) => void; // Push new screen
  goBack: () => void; // Pop the last screen
  reset: (screen: ScreenName) => void; // Reset the stack to one screen
  stack: ScreenName[]; // Expose stack if needed
  selectedRole: 'user' | 'organization';
  setSelectedRole: (role: 'user' | 'organization') => void;
}

const NavigationContext = createContext<NavigationContextType | undefined>(undefined);

export const NavigationProvider = ({ children }: { children: React.ReactNode }) => {
  const [stack, setStack] = useState<ScreenName[]>(['ConnectWallet']);
  const [selectedRole, setSelectedRole] = useState<'user' | 'organization'>("user");


  const navigate = (screen: ScreenName) => {
    setStack((prev: any) => [...prev, screen]);
  };

  const goBack = () => {
    setStack((prev: any) => (prev.length > 1 ? prev.slice(0, -1) : prev));
  };

  const reset = (screen: ScreenName) => {
    setStack([screen]);
  };

  const currentScreen = stack[stack.length - 1];

  return (
    <NavigationContext.Provider value={{ currentScreen, navigate, goBack, reset, stack, selectedRole, setSelectedRole }}>
      {children}
    </NavigationContext.Provider>
  );
};

export const useNavigation = (): NavigationContextType => {
  const context = useContext(NavigationContext);
  if (!context) throw new Error('useNavigation must be used within a NavigationProvider');
  return context;
};
