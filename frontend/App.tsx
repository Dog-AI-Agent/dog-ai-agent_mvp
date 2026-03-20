import "./global.css";
import { Platform, View, StyleSheet } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import RootStack from "./src/navigation/RootStack";
import { BreedProvider } from "./src/context/BreedContext";
import FloatingChatButton from "./src/components/FloatingChatButton";

const App = () => (
  <SafeAreaProvider>
    <BreedProvider>
      <NavigationContainer>
        <StatusBar style="dark" />
        {Platform.OS === "web" ? (
          <View style={styles.webOuter}>
            {/* webInner 안에 FloatingChatButton 포함 → 앱 화면 기준 위치 */}
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
