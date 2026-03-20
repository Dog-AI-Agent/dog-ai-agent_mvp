import "./global.css";
import { useEffect } from "react";
import { Platform, View, StyleSheet } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { AuthProvider, useAuth } from "./src/context/AuthContext";
import type { AuthUser } from "./src/context/AuthContext";
import RootStack from "./src/navigation/RootStack";

// OAuth 콜백: URL에 ?auth_token=xxx&auth_user=... 가 있으면 자동 로그인
const OAuthCallbackHandler = () => {
  const { login: saveAuth, isAuthenticated } = useAuth();

  useEffect(() => {
    if (Platform.OS !== "web" || isAuthenticated) return;
    if (typeof window === "undefined") return;

    const params = new URLSearchParams(window.location.search);
    const token = params.get("auth_token");
    const userJson = params.get("auth_user");
    const oauthError = params.get("oauth_error");

    if (oauthError) {
      console.warn("OAuth 오류:", oauthError);
      // URL 파라미터 제거
      window.history.replaceState({}, "", window.location.pathname);
      return;
    }

    if (token && userJson) {
      try {
        const user = JSON.parse(decodeURIComponent(userJson)) as AuthUser;
        saveAuth(token, user);
      } catch (e) {
        console.warn("OAuth 유저 파싱 오류:", e);
      } finally {
        // URL 파라미터 제거 (보안 + UX)
        window.history.replaceState({}, "", window.location.pathname);
      }
    }
  }, []);

  return null;
};

// 웹에서 모바일 앱처럼 보이도록 중앙 고정 컨테이너
const WebShell = ({ children }: { children: React.ReactNode }) => {
  if (Platform.OS !== "web") return <>{children}</>;
  return (
    <View style={styles.webOuter}>
      <View style={styles.webInner}>{children}</View>
    </View>
  );
};

const App = () => (
  <SafeAreaProvider>
    <AuthProvider>
      <WebShell>
        <NavigationContainer>
          <StatusBar style="dark" />
          <OAuthCallbackHandler />
          <RootStack />
        </NavigationContainer>
      </WebShell>
    </AuthProvider>
  </SafeAreaProvider>
);

const styles = StyleSheet.create({
  webOuter: {
    flex: 1,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "flex-start",
  },
  webInner: {
    flex: 1,
    width: "100%",
    maxWidth: 480,
    backgroundColor: "#ffffff",
    // 카드 그림자
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    // @ts-ignore — web 전용 속성
    boxShadow: "0 4px 40px rgba(0,0,0,0.13)",
    overflow: "hidden",
  },
});

export default App;
