import React, {createContext, useContext, useState} from 'react';

type ScreenName =
  | 'ConnectWallet'
  | 'Dashboard'
  | 'Settings'
  | 'Records'
  | 'Organizations'
  | 'Upload'
  | 'RegisterOrg'
  | 'ShareRecord';

interface ScreenStackEntry {
  name: ScreenName;
  params?: Record<string, any>;
}

interface NavigationContextType {
  currentScreen: ScreenName;
  currentParams?: Record<string, any>;
  navigate: (screen: ScreenName, params?: Record<string, any>) => void;
  goBack: () => void;
  reset: (screen: ScreenName, params?: Record<string, any>) => void;
  stack: ScreenStackEntry[];
  selectedRole: 'user' | 'organization';
  setSelectedRole: (role: 'user' | 'organization') => void;
}

const NavigationContext = createContext<NavigationContextType | undefined>(
  undefined,
);

export const NavigationProvider = ({children}: {children: React.ReactNode}) => {
  const [stack, setStack] = useState<ScreenStackEntry[]>([
    {name: 'ConnectWallet'},
  ]);
  const [selectedRole, setSelectedRole] = useState<'user' | 'organization'>(
    'user',
  );

  const navigate = (screen: ScreenName, params?: Record<string, any>) => {
    setStack(prev => [...prev, {name: screen, params}]);
  };

  const goBack = () => {
    setStack(prev => (prev.length > 1 ? prev.slice(0, -1) : prev));
  };

  const reset = (screen: ScreenName, params?: Record<string, any>) => {
    setStack([{name: screen, params}]);
  };

  const currentEntry = stack[stack.length - 1];
  const currentScreen = currentEntry.name;
  const currentParams = currentEntry.params;

  return (
    <NavigationContext.Provider
      value={{
        currentScreen,
        currentParams,
        navigate,
        goBack,
        reset,
        stack,
        selectedRole,
        setSelectedRole,
      }}>
      {children}
    </NavigationContext.Provider>
  );
};

export const useNavigation = (): NavigationContextType => {
  const context = useContext(NavigationContext);
  if (!context)
    throw new Error('useNavigation must be used within a NavigationProvider');
  return context;
};
