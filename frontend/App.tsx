import "./global.css";
import { NavigationContainer } from "@react-navigation/native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import RootStack from "./src/navigation/RootStack";

const App = () => (
  <SafeAreaProvider>
    <NavigationContainer>
      <StatusBar style="dark" />
      <RootStack />
    </NavigationContainer>
  </SafeAreaProvider>
);

export default App;
