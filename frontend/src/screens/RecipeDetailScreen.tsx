import { useEffect, useState } from "react";
import { View, Text, ScrollView, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/RootStack";
import { getRecipe } from "../api/recipes";
import LoadingSpinner from "../components/LoadingSpinner";
import ErrorState from "../components/ErrorState";
import { parseRecipeDetail } from "../utils/parseSummary";
import type { RecipeDetailResponse } from "../types";

type Props = NativeStackScreenProps<RootStackParamList, "RecipeDetail">;

const RecipeDetailScreen = ({ navigation, route }: Props) => {
  const { recipeId, breedId } = route.params;
  const [recipe, setRecipe] = useState<RecipeDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [checked, setChecked] = useState<Set<number>>(new Set());

  useEffect(() => {
    setLoading(true);
    getRecipe(recipeId, breedId)
      .then(setRecipe)
      .catch((err: { detail?: string; message?: string }) =>
        setError(err.detail || err.message || "레시피를 불러오지 못했습니다.")
      )
      .finally(() => setLoading(false));
  }, [recipeId, breedId]);

  const toggleIngredient = (idx: number) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-white">
        <LoadingSpinner />
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView className="flex-1 bg-white px-6 justify-center">
        <ErrorState message={error} />
      </SafeAreaView>
    );
  }

  if (!recipe) return null;

  const detail = recipe.summary ? parseRecipeDetail(recipe.summary) : null;

  return (
    <SafeAreaView className="flex-1 bg-white">
      <ScrollView contentContainerClassName="px-6 py-4 gap-4">
        <Text className="text-center text-2xl font-bold text-gray-800">
          {recipe.title}
        </Text>

        {/* LLM Detail */}
        {detail && (
          <View className="gap-3">
            {!!detail.message && (
              <View className="rounded-xl bg-blue-50 px-4 py-4">
                <Text className="text-sm leading-5 text-gray-700">
                  {detail.message}
                </Text>
              </View>
            )}

            {detail.ingredientDetails.length > 0 && (
              <View className="gap-2">
                <Text className="text-lg font-bold text-gray-800">
                  재료별 효능
                </Text>
                {detail.ingredientDetails.map((ing, idx) => (
                  <View key={idx} className="rounded-xl bg-card px-4 py-4 gap-2">
                    <View className="flex-row items-center gap-3">
                      <View className="h-7 w-7 items-center justify-center rounded-full bg-primary">
                        <Text className="text-xs font-bold text-white">
                          {idx + 1}
                        </Text>
                      </View>
                      <Text className="text-base font-semibold text-gray-800">
                        {ing.name}
                      </Text>
                    </View>
                    {ing.explanations.length > 0 && (
                      <View className="ml-10 gap-1">
                        {ing.explanations.map((exp, ei) => (
                          <Text key={ei} className="text-sm text-gray-600">
                            • {exp}
                          </Text>
                        ))}
                      </View>
                    )}
                  </View>
                ))}
              </View>
            )}

            {!!detail.closing && (
              <View className="rounded-xl bg-green-50 px-4 py-4">
                <Text className="mb-1 text-xs font-bold text-green-700">
                  급여 안내
                </Text>
                <Text className="text-sm text-gray-700">{detail.closing}</Text>
              </View>
            )}
          </View>
        )}

        {/* Description */}
        {recipe.description && (
          <Text className="text-sm text-muted">{recipe.description}</Text>
        )}

        {/* Info grid */}
        <View className="flex-row flex-wrap gap-2">
          {recipe.calories_per_serving != null && (
            <View className="flex-1 min-w-[45%] rounded-xl bg-card px-3 py-3 items-center">
              <Text className="text-xs text-muted">칼로리</Text>
              <Text className="text-base font-semibold text-gray-800">
                {recipe.calories_per_serving} kcal
              </Text>
            </View>
          )}
          {recipe.cook_time_min != null && (
            <View className="flex-1 min-w-[45%] rounded-xl bg-card px-3 py-3 items-center">
              <Text className="text-xs text-muted">조리 시간</Text>
              <Text className="text-base font-semibold text-gray-800">
                {recipe.cook_time_min}분
              </Text>
            </View>
          )}
          {recipe.difficulty && (
            <View className="flex-1 min-w-[45%] rounded-xl bg-card px-3 py-3 items-center">
              <Text className="text-xs text-muted">난이도</Text>
              <Text className="text-base font-semibold text-gray-800">
                {recipe.difficulty}
              </Text>
            </View>
          )}
          <View className="flex-1 min-w-[45%] rounded-xl bg-card px-3 py-3 items-center">
            <Text className="text-xs text-muted">인분</Text>
            <Text className="text-base font-semibold text-gray-800">
              {recipe.servings}인분
            </Text>
          </View>
        </View>

        {/* Target diseases */}
        {recipe.target_diseases.length > 0 && (
          <View className="gap-2">
            <Text className="text-lg font-bold text-gray-800">대상 질병</Text>
            <View className="flex-row flex-wrap gap-2">
              {recipe.target_diseases.map((d, i) => (
                <View key={i} className="rounded-full bg-red-50 px-3 py-1">
                  <Text className="text-xs text-danger">{d}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Ingredients checklist */}
        {recipe.ingredients.length > 0 && (
          <View className="gap-2">
            <Text className="text-lg font-bold text-gray-800">재료</Text>
            {recipe.ingredients.map((ing, i) => (
              <Pressable
                key={i}
                className={`flex-row items-center gap-3 rounded-xl px-4 py-3 ${
                  checked.has(i) ? "bg-green-50" : "bg-card"
                }`}
                onPress={() => toggleIngredient(i)}
              >
                <Text className="text-lg">
                  {checked.has(i) ? "☑" : "☐"}
                </Text>
                <Text
                  className={`flex-1 text-sm ${
                    checked.has(i) ? "text-gray-400 line-through" : "text-gray-800"
                  }`}
                >
                  {ing.name}
                </Text>
                {ing.amount && (
                  <Text className="text-sm text-muted">{ing.amount}</Text>
                )}
              </Pressable>
            ))}
          </View>
        )}

        {/* Steps */}
        {recipe.steps.length > 0 && (
          <View className="gap-2">
            <Text className="text-lg font-bold text-gray-800">조리 단계</Text>
            {recipe.steps.map((step) => (
              <View
                key={step.step_number}
                className="flex-row gap-3 rounded-xl bg-card px-4 py-3"
              >
                <View className="h-7 w-7 items-center justify-center rounded-full bg-primary">
                  <Text className="text-xs font-bold text-white">
                    {step.step_number}
                  </Text>
                </View>
                <Text className="flex-1 text-sm leading-5 text-gray-700">
                  {step.instruction}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Actions */}
        <View className="gap-3 pb-4">
          <Pressable
            className="rounded-xl bg-gray-100 px-6 py-3 active:opacity-80"
            onPress={() => navigation.goBack()}
          >
            <Text className="text-center font-semibold text-muted">
              뒤로가기
            </Text>
          </Pressable>
          <Pressable
            className="rounded-xl bg-gray-100 px-6 py-3 active:opacity-80"
            onPress={() =>
              navigation.reset({ index: 0, routes: [{ name: "Landing" }] })
            }
          >
            <Text className="text-center font-semibold text-muted">
              다른 강아지 분석하기
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default RecipeDetailScreen;
