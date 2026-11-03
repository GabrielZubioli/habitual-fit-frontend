import { colorScheme as nativewindScheme, useColorScheme, vars } from "nativewind";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { View } from "react-native";
import * as SecureStore from "expo-secure-store";
import tokens from "./tokens.gen.json";

/**
 * Tema do app: escuro por padrão (como o web), com escolha persistida entre
 * claro, escuro e sistema.
 * As cores são as do web (`tokens.gen.json`), aplicadas como variáveis numa
 * `View` na raiz — é delas que saem `bg-primary`, `text-foreground` etc.
 */
export type ThemeMode = "system" | "light" | "dark";
export type Scheme = "light" | "dark";

const STORAGE_KEY = "forja.theme-mode";

const variaveis = {
  light: vars(Object.fromEntries(Object.entries(tokens.light).map(([k, v]) => [`--${k}`, v.rgb]))),
  dark: vars(Object.fromEntries(Object.entries(tokens.dark).map(([k, v]) => [`--${k}`, v.rgb]))),
};

interface ThemeContextValue {
  mode: ThemeMode;
  scheme: Scheme;
  setMode: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  mode: "dark",
  scheme: "dark",
  setMode: () => undefined,
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>("dark");
  const scheme: Scheme = useColorScheme().colorScheme === "dark" ? "dark" : "light";

  useEffect(() => {
    void SecureStore.getItemAsync(STORAGE_KEY).then((saved) => {
      const inicial = saved === "light" || saved === "system" ? saved : "dark";
      setModeState(inicial);
      nativewindScheme.set(inicial);
    });
  }, []);

  const setMode = useCallback((next: ThemeMode) => {
    setModeState(next);
    nativewindScheme.set(next);
    void SecureStore.setItemAsync(STORAGE_KEY, next);
  }, []);

  const value = useMemo(() => ({ mode, scheme, setMode }), [mode, scheme, setMode]);

  return (
    <ThemeContext.Provider value={value}>
      <View style={[{ flex: 1 }, variaveis[scheme]]}>{children}</View>
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}

/** Cor de um token em hex, para quem não aceita className (ícones, gráficos, StatusBar). */
export function useColor(nome: keyof typeof tokens.light): string {
  return tokens[useTheme().scheme][nome].hex;
}
