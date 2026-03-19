// ============================================================
// S5 — 레시피 상세
// 스토리보드: 제목 + 유전병 태그 + 4열 메타 + 재료 체크리스트 + 조리 단계
// ============================================================
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

const MetaItem = ({ label, value, icon }: { label: string; value: string; icon: string }) => (
  <View className="flex-1 min-w-[22%] items-center rounded-xl bg-card px-2 py-3">
    <Text className="text-lg">{icon}</Text>
    <Text className="mt-1 text-center text-xs text-muted">{label}</Text>
    <Text className="text-center text-sm font-semibold text-gray-800">{value}</Text>
  </View>
);

const difficultyLabel = (d?: string | null) =>
  d === "easy" ? "쉬움" : d === "medium" ? "보통" : d === "hard" ? "어려움" : "—";

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
      next.has(idx) ? next.delete(idx) : next.add(idx);
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
        <Pressable
          className="mt-4 rounded-xl bg-gray-100 px-6 py-3 active:opacity-80"
          onPress={() => navigation.goBack()}
        >
          <Text className="text-center font-semibold text-muted">뒤로가기</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  if (!recipe) return null;

  const detail = recipe.summary ? parseRecipeDetail(recipe.summary) : null;

  return (
    <SafeAreaView className="flex-1 bg-white">
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 24, paddingVertical: 16, gap: 16 }}
        showsVerticalScrollIndicator={false}
      >
        {/* 제목 + 대상 유전병 태그 */}
        <View className="gap-2">
          <Text className="text-center text-2xl font-bold text-gray-800">
            {recipe.title}
          </Text>
          {recipe.target_diseases.length > 0 && (
            <View className="flex-row flex-wrap justify-center gap-1.5">
              {recipe.target_diseases.map((d, i) => (
                <View key={i} className="rounded-full bg-risk-high px-3 py-1">
                  <Text className="text-xs font-medium text-risk-high-text">{d}</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* 메타 정보 4열 그리드 — 스토리보드 S5 */}
        <View className="flex-row gap-2">
          <MetaItem
            icon="⏱"
            label="조리시간"
            value={recipe.cook_time_min != null ? `${recipe.cook_time_min}분` : "—"}
          />
          <MetaItem
            icon="🔥"
            label="칼로리"
            value={recipe.calories_per_serving != null ? `${recipe.calories_per_serving}` : "—"}
          />
          <MetaItem
            icon="📊"
            label="난이도"
            value={difficultyLabel(recipe.difficulty)}
          />
          <MetaItem
            icon="🍽"
            label="인분"
            value={`${recipe.servings}인분`}
          />
        </View>

        {/* LLM 상세 설명 (있을 경우) */}
        {detail?.message && (
          <View className="rounded-xl bg-primary-light px-4 py-4">
            <Text className="text-sm leading-5 text-gray-700">{detail.message}</Text>
          </View>
        )}

        {/* 재료별 효능 (LLM) */}
        {detail && detail.ingredientDetails.length > 0 && (
          <View className="gap-2">
            <Text className="text-lg font-bold text-gray-800">재료별 효능</Text>
            {detail.ingredientDetails.map((ing, idx) => (
              <View key={idx} className="rounded-xl bg-card px-4 py-3 gap-1">
                <Text className="text-sm font-semibold text-gray-800">
                  {idx + 1}. {ing.name}
                </Text>
                {ing.explanations.map((exp, ei) => (
                  <Text key={ei} className="ml-4 text-xs text-muted">• {exp}</Text>
                ))}
              </View>
            ))}
          </View>
        )}

        {detail?.closing && (
          <View className="rounded-xl bg-green-50 px-4 py-3">
            <Text className="text-xs font-bold text-green-700">급여 안내</Text>
            <Text className="mt-1 text-sm text-gray-700">{detail.closing}</Text>
          </View>
        )}

        {/* 설명 */}
        {recipe.description && (
          <Text className="text-sm text-muted">{recipe.description}</Text>
        )}

        {/* 재료 체크리스트 — 스토리보드: sort_order 기준 정렬 */}
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
                <View
                  className={`h-5 w-5 items-center justify-center rounded border ${
                    checked.has(i)
                      ? "border-green-500 bg-green-500"
                      : "border-gray-300 bg-white"
                  }`}
                >
                  {checked.has(i) && (
                    <Text className="text-xs text-white">✓</Text>
                  )}
                </View>
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

        {/* 조리 단계 — 스토리보드: 번호 원형 뱃지 + 설명 */}
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

        {/* 뒤로가기 */}
        <View className="gap-3 pb-4">
          <Pressable
            className="rounded-xl bg-gray-100 px-6 py-3 active:opacity-80"
            onPress={() => navigation.goBack()}
          >
            <Text className="text-center text-sm font-semibold text-muted">
              뒤로가기
            </Text>
          </Pressable>
          <Pressable
            className="rounded-xl bg-gray-100 px-6 py-3 active:opacity-80"
            onPress={() =>
              navigation.reset({ index: 0, routes: [{ name: "Upload" }] })
            }
          >
            <Text className="text-center text-sm font-semibold text-muted">
              다른 강아지 분석하기
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default RecipeDetailScreen;
