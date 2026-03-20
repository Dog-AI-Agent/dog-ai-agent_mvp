import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useAuth } from "../context/AuthContext";
import LoginScreen from "../screens/LoginScreen";
import SignupScreen from "../screens/SignupScreen";
import UploadScreen from "../screens/UploadScreen";
import BreedResultScreen from "../screens/BreedResultScreen";
import RecommendationScreen from "../screens/RecommendationScreen";
import RecipeDetailScreen from "../screens/RecipeDetailScreen";
import ChatScreen from "../screens/ChatScreen";
import MyPageScreen from "../screens/MyPageScreen";
import type { BreedRecognitionResponse } from "../types";

export type RootStackParamList = {
  // Auth
  Login: undefined;
  Signup: undefined;
  // App
  Upload: undefined;
  BreedResult: { result: BreedRecognitionResponse; imageUri: string };
  Recommendation: {
    breedId: string;
    breedNameKo: string;
    imageUri?: string;
  };
  RecipeDetail: { recipeId: string; breedId?: string };
  Chat: { breedId: string; breedNameKo: string; sessionId?: string };
  MyPage: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

const RootStack = () => {
  const { isAuthenticated } = useAuth();

  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        animation: "slide_from_right",
      }}
    >
      {isAuthenticated ? (
        <>
          <Stack.Screen name="Upload" component={UploadScreen} />
          <Stack.Screen name="BreedResult" component={BreedResultScreen} />
          <Stack.Screen name="Recommendation" component={RecommendationScreen} />
          <Stack.Screen name="RecipeDetail" component={RecipeDetailScreen} />
          <Stack.Screen name="Chat" component={ChatScreen} />
          <Stack.Screen name="MyPage" component={MyPageScreen} />
        </>
      ) : (
        <>
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="Signup" component={SignupScreen} />
        </>
      )}
    </Stack.Navigator>
  );
};

export default RootStack;
