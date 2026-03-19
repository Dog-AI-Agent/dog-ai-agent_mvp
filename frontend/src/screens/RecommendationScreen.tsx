import { useEffect, useState } from "react";
import { View, Text, ScrollView, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/RootStack";
import { getRecommendations } from "../api/recommendations";
import LoadingSpinner from "../components/LoadingSpinner";
import EmptyState from "../components/EmptyState";
import ErrorState from "../components/ErrorState";
import Disclaimer from "../components/Disclaimer";
import { parseSummary } from "../utils/parseSummary";
import type { RecommendationResponse } from "../types";

type Props = NativeStackScreenProps<RootStackParamList, "Recommendation">;

const RecommendationScreen = ({ navigation, route }: Props) => {
  const { breedId, breedNameKo } = route.params;
  const [data, setData] = useState<RecommendationResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"nutrients" | "recipes">("recipes");

  useEffect(() => {
    setLoading(true);
    getRecommendations({ breed_id: breedId })
      .then(setData)
      .catch((err: { detail?: string; message?: string }) =>
        setError(err.detail || err.message || "추천 정보를 불러오지 못했습니다.")
      )
      .finally(() => setLoading(false));
  }, [breedId]);

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
        <ErrorState
          message={error}
          onRetry={() => {
            setError(null);
            setLoading(true);
            getRecommendations({ breed_id: breedId })
              .then(setData)
              .catch((e: { detail?: string; message?: string }) =>
                setError(e.detail || e.message || "추천 정보를 불러오지 못했습니다.")
              )
              .finally(() => setLoading(false));
          }}
        />
      </SafeAreaView>
    );
  }

  if (!data) {
    return (
      <SafeAreaView className="flex-1 bg-white px-6 justify-center">
        <EmptyState />
      </SafeAreaView>
    );
  }

  const parsed = parseSummary(data.summary);

  return (
    <SafeAreaView className="flex-1 bg-white">
      <ScrollView contentContainerClassName="px-6 py-4 gap-4">
        <Text className="text-center text-2xl font-bold text-gray-800">
          {data.breed_name_ko} 맞춤 추천
        </Text>

        {/* Summary */}
        <View className="rounded-xl bg-blue-50 px-4 py-4">
          <Text className="text-sm leading-5 text-gray-700">
            {parsed.message}
          </Text>
        </View>

        {/* LLM Recipes */}
        {parsed.recipes.length > 0 && (
          <View className="gap-3">
            <Text className="text-lg font-bold text-gray-800">
              AI 추천 레시피
            </Text>
            {parsed.recipes.map((recipe, idx) => (
              <View key={idx} className="rounded-xl bg-card px-4 py-4 gap-3">
                <View className="flex-row items-center gap-3">
                  <View className="h-8 w-8 items-center justify-center rounded-full bg-primary">
                    <Text className="font-bold text-white">{idx + 1}</Text>
                  </View>
                  <Text className="flex-1 text-base font-semibold text-gray-800">
                    {recipe.name}
                  </Text>
                </View>

                {!!recipe.ingredients && (
                  <View className="rounded-lg bg-white px-3 py-3">
                    <Text className="mb-1 text-xs font-bold text-primary">
                      재료
                    </Text>
                    <Text className="text-sm text-gray-700">
                      {recipe.ingredients}
                    </Text>
                  </View>
                )}

                {!!recipe.reason && (
                  <View className="rounded-lg bg-white px-3 py-3">
                    <Text className="mb-1 text-xs font-bold text-secondary">
                      추천 이유
                    </Text>
                    <Text className="text-sm text-gray-700">
                      {recipe.reason}
                    </Text>
                  </View>
                )}

                {recipe.steps.length > 0 && (
                  <View className="rounded-lg bg-white px-3 py-3">
                    <Text className="mb-1 text-xs font-bold text-accent">
                      만드는 법
                    </Text>
                    {recipe.steps.map((step, si) => (
                      <Text key={si} className="text-sm text-gray-700">
                        {si + 1}. {step}
                      </Text>
                    ))}
                  </View>
                )}

                {!!recipe.serving && (
                  <View className="rounded-lg bg-white px-3 py-3">
                    <Text className="mb-1 text-xs font-bold text-green-600">
                      급여량
                    </Text>
                    <Text className="text-sm text-gray-700">
                      {recipe.serving}
                    </Text>
                  </View>
                )}
              </View>
            ))}
          </View>
        )}

        {/* Tab bar */}
        <View className="flex-row rounded-xl bg-gray-100 p-1">
          <Pressable
            className={`flex-1 rounded-lg py-2 ${activeTab === "nutrients" ? "bg-white shadow-sm" : ""}`}
            onPress={() => setActiveTab("nutrients")}
          >
            <Text
              className={`text-center text-sm font-semibold ${activeTab === "nutrients" ? "text-primary" : "text-muted"}`}
            >
              영양소
            </Text>
          </Pressable>
          <Pressable
            className={`flex-1 rounded-lg py-2 ${activeTab === "recipes" ? "bg-white shadow-sm" : ""}`}
            onPress={() => setActiveTab("recipes")}
          >
            <Text
              className={`text-center text-sm font-semibold ${activeTab === "recipes" ? "text-primary" : "text-muted"}`}
            >
              전체 집밥 레시피
            </Text>
          </Pressable>
        </View>

        {/* Tab content */}
        {activeTab === "nutrients" && (
          <View className="gap-2">
            {data.supplements.length > 0 ? (
              data.supplements.map((s, i) => (
                <View key={i} className="rounded-xl bg-card px-4 py-3">
                  <Text className="text-sm text-gray-700">
                    {String((s as Record<string, unknown>).name || (s as Record<string, unknown>).name_ko || "")}
                  </Text>
                </View>
              ))
            ) : (
              <EmptyState message="영양소 데이터가 아직 준비되지 않았습니다." />
            )}
          </View>
        )}

        {activeTab === "recipes" && (
          <View className="gap-2">
            {data.recipes.length > 0 ? (
              data.recipes.map((r) => (
                <Pressable
                  key={r.recipe_id}
                  className="rounded-xl bg-card px-4 py-4 active:opacity-80"
                  onPress={() =>
                    navigation.navigate("RecipeDetail", {
                      recipeId: r.recipe_id,
                      breedId,
                    })
                  }
                >
                  <Text className="text-base font-semibold text-gray-800">
                    {r.title}
                  </Text>
                  {r.description && (
                    <Text className="mt-1 text-sm text-muted" numberOfLines={2}>
                      {r.description}
                    </Text>
                  )}
                  <View className="mt-2 flex-row flex-wrap gap-2">
                    {r.difficulty && (
                      <View className="rounded-full bg-primary/10 px-2 py-1">
                        <Text className="text-xs text-primary">
                          {r.difficulty}
                        </Text>
                      </View>
                    )}
                    {r.cook_time_min && (
                      <Text className="text-xs text-muted">
                        {r.cook_time_min}분
                      </Text>
                    )}
                  </View>
                  {r.target_diseases.length > 0 && (
                    <View className="mt-2 flex-row flex-wrap gap-1">
                      {r.target_diseases.map((d, i) => (
                        <View key={i} className="rounded-full bg-red-50 px-2 py-1">
                          <Text className="text-xs text-danger">{d}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                </Pressable>
              ))
            ) : (
              <EmptyState message="추천 레시피가 없습니다." />
            )}
          </View>
        )}

        <Disclaimer />

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

export default RecommendationScreen;
