// ============================================================
// S4 — 맞춤 추천
// 스토리보드: 자연어 요약 + 탭1(유전병별 영양소) + 탭2(추천 음식)
// API v2: tab_nutrients, tab_foods, recipes
// ============================================================
import { useEffect, useState, useCallback } from "react";
import { View, Text, ScrollView, Pressable, LayoutAnimation, Platform, UIManager } from "react-native";

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

import { SafeAreaView } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/RootStack";
import { getRecommendations } from "../api/recommendations";
import LoadingSpinner from "../components/LoadingSpinner";
import EmptyState from "../components/EmptyState";
import ErrorState from "../components/ErrorState";
import Disclaimer from "../components/Disclaimer";
import RiskBadge from "../components/RiskBadge";
import MarkdownRenderer from "../components/MarkdownRenderer";
import { extractReasonOnly } from "../utils/reorderSummary";
import { categorizeIngredients, CATEGORY_META } from "../utils/categorizeIngredients";
import type { IngredientCategory } from "../utils/categorizeIngredients";
import type { RecommendationResponse } from "../types";

type Props = NativeStackScreenProps<RootStackParamList, "Recommendation">;
type TabKey = "nutrients" | "foods";

/** 요약 접기/펼치기 카드 */
const CollapsibleSummary = ({ summary }: { summary: string }) => {
  const [expanded, setExpanded] = useState(false);
  // 추천이유/intro 섹션만 추출
  const reasonText = extractReasonOnly(summary);
  // 마크다운 기호 제거한 순수 텍스트
  const plainText = reasonText
    .replace(/^#{1,4}\s*/gm, "")
    .replace(/\*\*/g, "")
    .replace(/^[-•*]\s*/gm, "")
    .trim();

  const toggle = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded((v) => !v);
  };

  return (
    <Pressable
      onPress={toggle}
      style={{
        backgroundColor: "#eef1ff",
        borderRadius: 16,
        padding: 16,
        gap: 8,
      }}
    >
      {/* 헤더 행 */}
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Text style={{ fontSize: 15 }}>💡</Text>
          <Text style={{ fontSize: 13, fontWeight: "700", color: "#4361ee" }}>AI 추천 이유</Text>
        </View>
        <Text style={{ fontSize: 12, color: "#6b7280" }}>{expanded ? "접기 ▲" : "더 보기 ▼"}</Text>
      </View>

      {/* 미리보기: 항상 2줄 표시 */}
      <Text
        numberOfLines={expanded ? undefined : 2}
        style={{ fontSize: 13, color: "#374151", lineHeight: 20 }}
      >
        {plainText}
      </Text>
    </Pressable>
  );
};

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

        {/* 자연어 요약 — 접기/펼치기 카드 */}
        {data.summary ? (
          <CollapsibleSummary summary={data.summary} />
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

        {/* ── 탭1: 유전병별 영양소 ── */}
        {activeTab === "nutrients" && (
          <View style={{ gap: 16 }}>
            {data.tab_nutrients && data.tab_nutrients.length > 0 ? (
              data.tab_nutrients.map((item, idx) => {
                const cats = categorizeIngredients(item.recommended_ingredients);
                const severityColor =
                  item.severity === "high" ? "#dc2626"
                  : item.severity === "medium" ? "#d97706"
                  : "#16a34a";
                const severityBg =
                  item.severity === "high" ? "#fef2f2"
                  : item.severity === "medium" ? "#fffbeb"
                  : "#f0fdf4";
                const severityLabel =
                  item.severity === "high" ? "고위험"
                  : item.severity === "medium" ? "중간"
                  : "낮음";

                return (
                  <View
                    key={idx}
                    style={{
                      backgroundColor: "#fff",
                      borderRadius: 18,
                      borderWidth: 1.5,
                      borderColor: "#e5e7eb",
                      overflow: "hidden",
                    }}
                  >
                    {/* 헤더: 유전병명 + 위험도 */}
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "space-between",
                        paddingHorizontal: 16,
                        paddingVertical: 14,
                        backgroundColor: "#fafafa",
                        borderBottomWidth: 1,
                        borderBottomColor: "#f0f0f0",
                      }}
                    >
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flex: 1 }}>
                        <View style={{
                          width: 8, height: 8, borderRadius: 4,
                          backgroundColor: severityColor, flexShrink: 0,
                        }} />
                        <Text style={{
                          fontSize: 15, fontWeight: "700", color: "#1f2937", flex: 1,
                        }}>
                          {item.disease_name_ko}
                        </Text>
                      </View>
                      <View style={{
                        backgroundColor: severityBg,
                        borderRadius: 20,
                        paddingHorizontal: 10,
                        paddingVertical: 4,
                      }}>
                        <Text style={{ fontSize: 11, fontWeight: "700", color: severityColor }}>
                          {severityLabel}
                        </Text>
                      </View>
                    </View>

                    {/* 카테고리 섹션 */}
                    <View style={{ padding: 14, gap: 10 }}>
                      {(Object.keys(CATEGORY_META) as IngredientCategory[]).map((cat) => {
                        const meta = CATEGORY_META[cat];
                        const items = cats[cat];
                        if (items.length === 0) return null;
                        return (
                          <View key={cat}>
                            {/* 카테고리 헤더 */}
                            <View style={{
                              flexDirection: "row",
                              alignItems: "center",
                              gap: 6,
                              marginBottom: 8,
                            }}>
                              <Text style={{ fontSize: 14 }}>{meta.emoji}</Text>
                              <Text style={{
                                fontSize: 12, fontWeight: "700", color: meta.color,
                              }}>
                                {meta.label}
                              </Text>
                              <View style={{ flex: 1, height: 1, backgroundColor: meta.bg, marginLeft: 4 }} />
                            </View>

                            {/* 재료 그리드 (2열) */}
                            <View style={{
                              flexDirection: "row",
                              flexWrap: "wrap",
                              gap: 8,
                            }}>
                              {items.map((ing) => (
                                <View
                                  key={ing.ingredient_id}
                                  style={{
                                    backgroundColor: meta.bg,
                                    borderRadius: 12,
                                    paddingHorizontal: 12,
                                    paddingVertical: 8,
                                    minWidth: "45%",
                                    flex: 1,
                                    maxWidth: "48%",
                                  }}
                                >
                                  <Text style={{
                                    fontSize: 13, fontWeight: "600", color: "#1f2937",
                                  }}>
                                    {ing.name_ko}
                                  </Text>
                                  {ing.effect_description ? (
                                    <Text style={{
                                      marginTop: 3,
                                      fontSize: 11,
                                      color: "#6b7280",
                                      lineHeight: 16,
                                    }} numberOfLines={2}>
                                      {ing.effect_description}
                                    </Text>
                                  ) : null}
                                </View>
                              ))}
                            </View>
                          </View>
                        );
                      })}

                      {item.recommended_ingredients.length === 0 && (
                        <Text style={{ fontSize: 13, color: "#9ca3af", textAlign: "center", paddingVertical: 8 }}>
                          권장 영양소 정보가 없습니다.
                        </Text>
                      )}
                    </View>
                  </View>
                );
              })
            ) : (
              <EmptyState message="영양소 데이터가 아직 준비되지 않았습니다." />
            )}
          </View>
        )}

        {/* ── 탭2: 추천 음식 카드 (tab_foods) ── */}
        {activeTab === "foods" && (
          <View style={{ gap: 14 }}>
            {data.tab_foods && data.tab_foods.length > 0 ? (
              data.tab_foods.map((food, index) => {
                const hasRecipe = food.recipe_ids.length > 0;
                const accent = index % 3 === 0 ? "#4361ee" : index % 3 === 1 ? "#CC1A1A" : "#7b2ff7";
                const accentBg = index % 3 === 0 ? "#eef1ff" : index % 3 === 1 ? "#fff0f0" : "#f3eeff";
                return (
                  <Pressable
                    key={food.food_id}
                    disabled={!hasRecipe}
                    onPress={() => {
                      navigation.navigate("RecipeDetail", {
                        recipeId: food.recipe_ids[0],
                        breedId,
                      });
                    }}
                    style={({ pressed }) => ({
                      backgroundColor: pressed ? accentBg : "#ffffff",
                      borderRadius: 20,
                      borderWidth: 1.5,
                      borderColor: hasRecipe ? accentBg : "#e5e7eb",
                      shadowColor: "#000",
                      shadowOffset: { width: 0, height: 2 },
                      shadowOpacity: 0.07,
                      shadowRadius: 8,
                      elevation: 3,
                      overflow: "hidden",
                      opacity: hasRecipe ? 1 : 0.5,
                    })}
                  >
                    {/* 좌측 컬러 바 */}
                    <View style={{ flexDirection: "row" }}>
                      <View style={{ width: 5, backgroundColor: accent }} />

                      <View style={{ flex: 1, padding: 16, gap: 12 }}>
                        {/* 1행: 번호 + 음식명 */}
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                          <View style={{
                            width: 32, height: 32, borderRadius: 10,
                            backgroundColor: accentBg,
                            alignItems: "center", justifyContent: "center", flexShrink: 0,
                          }}>
                            <Text style={{ fontSize: 14, fontWeight: "800", color: accent }}>
                              {index + 1}
                            </Text>
                          </View>
                          <Text style={{ flex: 1, fontSize: 16, fontWeight: "800", color: "#111827", letterSpacing: -0.3 }}>
                            {food.name_ko}
                          </Text>
                          {food.category && (
                            <View style={{
                              backgroundColor: accentBg, borderRadius: 8,
                              paddingHorizontal: 9, paddingVertical: 4,
                            }}>
                              <Text style={{ fontSize: 11, fontWeight: "700", color: accent }}>
                                {food.category}
                              </Text>
                            </View>
                          )}
                        </View>

                        {/* 2행: 관련 영양소 태그 */}
                        {food.related_ingredients.length > 0 && (
                          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                            {food.related_ingredients.map((ing, i) => (
                              <View key={i} style={{
                                backgroundColor: "#f9fafb",
                                borderWidth: 1, borderColor: "#e5e7eb",
                                borderRadius: 8,
                                paddingHorizontal: 9, paddingVertical: 4,
                                flexDirection: "row", alignItems: "center", gap: 4,
                              }}>
                                <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: accent }} />
                                <Text style={{ fontSize: 11, color: "#374151", fontWeight: "600" }}>
                                  {ing}
                                </Text>
                              </View>
                            ))}
                          </View>
                        )}

                        {/* 3행: 하단 */}
                        <View style={{
                          flexDirection: "row", alignItems: "center",
                          justifyContent: "space-between",
                          paddingTop: 10,
                          borderTopWidth: 1, borderTopColor: "#f3f4f6",
                        }}>
                          <Text style={{ fontSize: 12, color: "#9ca3af" }}>
                            {hasRecipe ? `레시피 ${food.recipe_ids.length}개 포함` : "레시피 준비 중"}
                          </Text>
                          {hasRecipe && (
                            <View style={{
                              flexDirection: "row", alignItems: "center", gap: 4,
                              backgroundColor: accent,
                              borderRadius: 10, paddingHorizontal: 14, paddingVertical: 7,
                            }}>
                              <Text style={{ fontSize: 12, fontWeight: "700", color: "#fff" }}>레시피 보기</Text>
                              <Text style={{ fontSize: 13, color: "#fff", fontWeight: "700" }}>→</Text>
                            </View>
                          )}
                        </View>
                      </View>
                    </View>
                  </Pressable>
                );
              })
            ) : (
              // fallback: recipes 배열 사용
              data.recipes && data.recipes.length > 0 ? (
                data.recipes.map((r, index) => {
                  const accent = index % 3 === 0 ? "#4361ee" : index % 3 === 1 ? "#CC1A1A" : "#7b2ff7";
                  const accentBg = index % 3 === 0 ? "#eef1ff" : index % 3 === 1 ? "#fff0f0" : "#f3eeff";
                  return (
                    <Pressable
                      key={r.recipe_id}
                      onPress={() =>
                        navigation.navigate("RecipeDetail", {
                          recipeId: r.recipe_id,
                          breedId,
                        })
                      }
                      style={({ pressed }) => ({
                        backgroundColor: pressed ? accentBg : "#ffffff",
                        borderRadius: 20,
                        borderWidth: 1.5,
                        borderColor: accentBg,
                        shadowColor: "#000",
                        shadowOffset: { width: 0, height: 2 },
                        shadowOpacity: 0.07,
                        shadowRadius: 8,
                        elevation: 3,
                        overflow: "hidden",
                      })}
                    >
                      <View style={{ flexDirection: "row" }}>
                        <View style={{ width: 5, backgroundColor: accent }} />

                        <View style={{ flex: 1, padding: 16, gap: 12 }}>
                          {/* 1행: 번호 + 제목 */}
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                            <View style={{
                              width: 32, height: 32, borderRadius: 10,
                              backgroundColor: accentBg,
                              alignItems: "center", justifyContent: "center", flexShrink: 0,
                            }}>
                              <Text style={{ fontSize: 14, fontWeight: "800", color: accent }}>
                                {index + 1}
                              </Text>
                            </View>
                            <Text style={{ flex: 1, fontSize: 16, fontWeight: "800", color: "#111827", letterSpacing: -0.3 }}>
                              {r.title}
                            </Text>
                          </View>

                          {/* 메타 정보 행 */}
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                            {r.difficulty && (
                              <View style={{
                                backgroundColor: r.difficulty === "easy" ? "#f0fdf4" : r.difficulty === "medium" ? "#fffbeb" : "#fef2f2",
                                borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4,
                              }}>
                                <Text style={{
                                  fontSize: 11, fontWeight: "700",
                                  color: r.difficulty === "easy" ? "#16a34a" : r.difficulty === "medium" ? "#d97706" : "#dc2626",
                                }}>
                                  {r.difficulty === "easy" ? "● 쉬움" : r.difficulty === "medium" ? "● 보통" : "● 어려움"}
                                </Text>
                              </View>
                            )}
                            {r.cook_time_min != null && (
                              <View style={{
                                backgroundColor: "#f9fafb", borderRadius: 8,
                                paddingHorizontal: 10, paddingVertical: 4,
                              }}>
                                <Text style={{ fontSize: 11, color: "#6b7280", fontWeight: "600" }}>⏱ {r.cook_time_min}분</Text>
                              </View>
                            )}
                          </View>

                          {/* 대상 유전병 태그 */}
                          {r.target_diseases.length > 0 && (
                            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                              {r.target_diseases.map((d, i) => (
                                <View key={i} style={{
                                  backgroundColor: "#fff0f0",
                                  borderWidth: 1, borderColor: "#fecaca",
                                  borderRadius: 8, paddingHorizontal: 9, paddingVertical: 4,
                                }}>
                                  <Text style={{ fontSize: 11, color: "#dc2626", fontWeight: "600" }}>{d}</Text>
                                </View>
                              ))}
                            </View>
                          )}

                          {/* 하단: 레시피 보기 버튼 */}
                          <View style={{
                            flexDirection: "row", justifyContent: "flex-end",
                            paddingTop: 10, borderTopWidth: 1, borderTopColor: "#f3f4f6",
                          }}>
                            <View style={{
                              flexDirection: "row", alignItems: "center", gap: 4,
                              backgroundColor: accent,
                              borderRadius: 10, paddingHorizontal: 14, paddingVertical: 7,
                            }}>
                              <Text style={{ fontSize: 12, fontWeight: "700", color: "#fff" }}>레시피 보기</Text>
                              <Text style={{ fontSize: 13, color: "#fff", fontWeight: "700" }}>→</Text>
                            </View>
                          </View>
                        </View>
                      </View>
                    </Pressable>
                  );
                })
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
