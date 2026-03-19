// ============================================================
// S4 — 맞춤 추천
// 스토리보드: 자연어 요약 + 탭1(유전병별 영양소) + 탭2(추천 음식)
// API v2: tab_nutrients, tab_foods, recipes
// ============================================================
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
import RiskBadge from "../components/RiskBadge";
import type { RecommendationResponse } from "../types";

type Props = NativeStackScreenProps<RootStackParamList, "Recommendation">;
type TabKey = "nutrients" | "foods";

const RecommendationScreen = ({ navigation, route }: Props) => {
  const { breedId, breedNameKo } = route.params;
  const [data, setData] = useState<RecommendationResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>("nutrients");

  const fetchData = () => {
    setLoading(true);
    setError(null);
    getRecommendations({ breed_id: breedId })
      .then(setData)
      .catch((err: { detail?: string; message?: string }) =>
        setError(err.detail || err.message || "추천 정보를 불러오지 못했습니다.")
      )
      .finally(() => setLoading(false));
  };

  useEffect(fetchData, [breedId]);

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
        <ErrorState message={error} onRetry={fetchData} />
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

  const tabs: { key: TabKey; label: string }[] = [
    { key: "nutrients", label: "유전병별 영양소" },
    { key: "foods", label: "추천 음식" },
  ];

  return (
    <SafeAreaView className="flex-1 bg-white">
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 24, paddingVertical: 16, gap: 16 }}
        showsVerticalScrollIndicator={false}
      >
        {/* 헤더 */}
        <Text className="text-center text-2xl font-bold text-gray-800">
          {data.breed_name_ko} 맞춤 추천
        </Text>

        {/* 자연어 요약 — breed.summary */}
        {data.summary ? (
          <View className="rounded-xl bg-primary-light px-4 py-4">
            <Text className="text-sm leading-5 text-gray-700">{data.summary}</Text>
          </View>
        ) : null}

        {/* 탭 바 — 스토리보드: 2탭 */}
        <View className="flex-row rounded-xl bg-gray-100 p-1">
          {tabs.map((tab) => (
            <Pressable
              key={tab.key}
              className={`flex-1 rounded-lg py-2.5 ${activeTab === tab.key ? "bg-white shadow-sm" : ""}`}
              onPress={() => setActiveTab(tab.key)}
            >
              <Text
                className={`text-center text-sm font-semibold ${
                  activeTab === tab.key ? "text-primary" : "text-muted"
                }`}
              >
                {tab.label}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* ── 탭1: 유전병별 영양소 (tab_nutrients) ── */}
        {activeTab === "nutrients" && (
          <View className="gap-3">
            {data.tab_nutrients && data.tab_nutrients.length > 0 ? (
              data.tab_nutrients.map((item, idx) => (
                <View key={idx} className="rounded-xl bg-card px-4 py-4 gap-3">
                  {/* 유전병 이름 + severity 뱃지 */}
                  <View className="flex-row items-center justify-between">
                    <Text className="text-base font-semibold text-gray-800">
                      {item.disease_name_ko}
                    </Text>
                    <RiskBadge level={item.severity} />
                  </View>

                  {/* 권장 영양소 리스트 */}
                  {item.recommended_ingredients.length > 0 ? (
                    <View className="gap-2">
                      {item.recommended_ingredients.map((ing) => (
                        <View key={ing.ingredient_id} className="rounded-lg bg-white px-3 py-2">
                          <Text className="text-sm font-medium text-gray-800">
                            {ing.name_ko}
                          </Text>
                          {ing.effect_description ? (
                            <Text className="mt-1 text-xs text-muted">
                              {ing.effect_description}
                            </Text>
                          ) : null}
                        </View>
                      ))}
                    </View>
                  ) : (
                    <Text className="text-xs text-muted">권장 영양소 정보가 없습니다.</Text>
                  )}
                </View>
              ))
            ) : (
              <EmptyState message="영양소 데이터가 아직 준비되지 않았습니다." />
            )}
          </View>
        )}

        {/* ── 탭2: 추천 음식 카드 (tab_foods) ── */}
        {activeTab === "foods" && (
          <View className="gap-3">
            {data.tab_foods && data.tab_foods.length > 0 ? (
              data.tab_foods.map((food) => (
                <Pressable
                  key={food.food_id}
                  className="rounded-xl bg-card px-4 py-4 active:opacity-80"
                  disabled={food.recipe_ids.length === 0}
                  onPress={() => {
                    if (food.recipe_ids.length === 1) {
                      navigation.navigate("RecipeDetail", {
                        recipeId: food.recipe_ids[0],
                        breedId,
                      });
                    } else if (food.recipe_ids.length > 1) {
                      // 여러 레시피 → 첫 번째로 이동 (TODO: 선택 UI)
                      navigation.navigate("RecipeDetail", {
                        recipeId: food.recipe_ids[0],
                        breedId,
                      });
                    }
                  }}
                >
                  <View className="flex-row items-center justify-between">
                    <Text className="text-base font-semibold text-gray-800">
                      {food.name_ko}
                    </Text>
                    {food.category && (
                      <View className="rounded-full bg-primary-light px-2.5 py-1">
                        <Text className="text-xs font-medium text-primary">
                          {food.category}
                        </Text>
                      </View>
                    )}
                  </View>

                  {/* 관련 영양소 태그 */}
                  {food.related_ingredients.length > 0 && (
                    <View className="mt-2 flex-row flex-wrap gap-1.5">
                      {food.related_ingredients.map((ing, i) => (
                        <View key={i} className="rounded-full bg-gray-100 px-2 py-1">
                          <Text className="text-xs text-muted">{ing}</Text>
                        </View>
                      ))}
                    </View>
                  )}

                  {/* 레시피 개수 */}
                  <Text className="mt-2 text-xs font-semibold text-primary">
                    {food.recipe_ids.length > 0
                      ? `레시피 ${food.recipe_ids.length}개 ▶`
                      : "레시피 없음"}
                  </Text>
                </Pressable>
              ))
            ) : (
              // fallback: recipes 배열 사용
              data.recipes && data.recipes.length > 0 ? (
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
                    <View className="mt-2 flex-row items-center gap-3">
                      {r.difficulty && (
                        <View className="rounded-full bg-primary-light px-2.5 py-1">
                          <Text className="text-xs font-medium text-primary">
                            {r.difficulty === "easy" ? "쉬움" : r.difficulty === "medium" ? "보통" : "어려움"}
                          </Text>
                        </View>
                      )}
                      {r.cook_time_min != null && (
                        <Text className="text-xs text-muted">⏱ {r.cook_time_min}분</Text>
                      )}
                    </View>
                    {r.target_diseases.length > 0 && (
                      <View className="mt-2 flex-row flex-wrap gap-1.5">
                        {r.target_diseases.map((d, i) => (
                          <View key={i} className="rounded-full bg-risk-high px-2.5 py-1">
                            <Text className="text-xs text-risk-high-text">{d}</Text>
                          </View>
                        ))}
                      </View>
                    )}
                    <Text className="mt-2 text-xs font-semibold text-primary">
                      레시피 보기 ▶
                    </Text>
                  </Pressable>
                ))
              ) : (
                <EmptyState message="추천 음식이 없습니다." />
              )
            )}
          </View>
        )}

        {/* 하단 */}
        <Disclaimer />

        <View className="gap-3 pb-4">
          <Pressable
            className="rounded-xl bg-gray-100 px-6 py-3 active:opacity-80"
            onPress={() => navigation.goBack()}
          >
            <Text className="text-center text-sm font-semibold text-muted">뒤로가기</Text>
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

export default RecommendationScreen;
