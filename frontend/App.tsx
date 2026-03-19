import "./global.css";
import { Platform, View, StyleSheet } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import RootStack from "./src/navigation/RootStack";

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
    <WebShell>
      <NavigationContainer>
        <StatusBar style="dark" />
        <RootStack />
      </NavigationContainer>
    </WebShell>
  </SafeAreaProvider>
);

const styles = StyleSheet.create({
  webOuter: {
    flex: 1,
    backgroundColor: "#1a0000",
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
