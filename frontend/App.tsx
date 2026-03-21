import "./global.css";
import { useEffect } from "react";
import { Platform, View, StyleSheet } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import RootStack from "./src/navigation/RootStack";
import { BreedProvider } from "./src/context/BreedContext";
import FloatingChatButton from "./src/components/FloatingChatButton";

// AuthContext가 있으면 사용, 없으면 스킵
let AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <>{children}</>
);
let useAuth: () => {
  login?: (token: string, user: any) => void;
  isAuthenticated?: boolean;
} = () => ({});
try {
  const authModule = require("./src/context/AuthContext");
  AuthProvider = authModule.AuthProvider;
  useAuth = authModule.useAuth;
} catch (e) {
  // AuthContext 없으면 패스
}

const App = () => (
  <SafeAreaProvider>
    <AuthProvider>
      <BreedProvider>
        <NavigationContainer>
          <StatusBar style="dark" />
          {Platform.OS === "web" ? (
            <View style={styles.webOuter}>
              <View style={styles.webInner}>
                <RootStack />
                <FloatingChatButton />
              </View>
            </View>
          ) : (
            <>
              <RootStack />
              <FloatingChatButton />
            </>
          )}
        </NavigationContainer>
      </BreedProvider>
    </AuthProvider>
  </SafeAreaProvider>
);

const styles = StyleSheet.create({
  webOuter: {
    flex: 1,
    backgroundColor: "#f0f0f0",
    alignItems: "center",
    justifyContent: "flex-start",
  },
  webInner: {
    flex: 1,
    width: "100%",
    maxWidth: 480,
    backgroundColor: "#ffffff",
    // @ts-ignore
    boxShadow: "0 4px 40px rgba(0,0,0,0.13)",
    position: "relative",
    overflow: "hidden",
  },
});

export default App;
