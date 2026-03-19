import { createNativeStackNavigator } from "@react-navigation/native-stack";
import LandingScreen from "../screens/LandingScreen";
import UploadScreen from "../screens/UploadScreen";
import BreedResultScreen from "../screens/BreedResultScreen";
import RecommendationScreen from "../screens/RecommendationScreen";
import RecipeDetailScreen from "../screens/RecipeDetailScreen";
import type { BreedRecognitionResponse } from "../types";

export type RootStackParamList = {
  Landing: undefined;
  Upload: undefined;
  BreedResult: { result: BreedRecognitionResponse; imageUri: string };
  Recommendation: {
    breedId: string;
    breedNameKo: string;
    imageUri?: string;
  };
  RecipeDetail: { recipeId: string; breedId?: string };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

const RootStack = () => (
  <Stack.Navigator
    initialRouteName="Landing"
    screenOptions={{
      headerShown: false,
      animation: "slide_from_right",
    }}
  >
    <Stack.Screen name="Landing" component={LandingScreen} />
    <Stack.Screen name="Upload" component={UploadScreen} />
    <Stack.Screen name="BreedResult" component={BreedResultScreen} />
    <Stack.Screen name="Recommendation" component={RecommendationScreen} />
    <Stack.Screen name="RecipeDetail" component={RecipeDetailScreen} />
  </Stack.Navigator>
);

export default RootStack;
