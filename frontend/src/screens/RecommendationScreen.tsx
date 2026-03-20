// ============================================================
// S4 — 맞춤 추천
// - 유전병별 영양소 카드 접기/펼치기
// - 하단 버튼 sticky 고정
// ============================================================
import { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  LayoutAnimation,
  Platform,
  UIManager,
} from "react-native";

if (
  Platform.OS === "android" &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

import { SafeAreaView } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/RootStack";
import { getRecommendations } from "../api/recommendations";
import { useBreed } from "../context/BreedContext";
import LoadingSpinner from "../components/LoadingSpinner";
import EmptyState from "../components/EmptyState";
import ErrorState from "../components/ErrorState";
import Disclaimer from "../components/Disclaimer";
import MarkdownRenderer from "../components/MarkdownRenderer";
import { extractReasonOnly } from "../utils/reorderSummary";
import {
  categorizeIngredients,
  CATEGORY_META,
} from "../utils/categorizeIngredients";
import type { IngredientCategory } from "../utils/categorizeIngredients";
import type { RecommendationResponse, NutrientItem } from "../types";

type Props = NativeStackScreenProps<RootStackParamList, "Recommendation">;
type TabKey = "nutrients" | "foods";

// ── AI 추천 이유 접기/펼치기 ──
const CollapsibleSummary = ({ summary }: { summary: string }) => {
  const [expanded, setExpanded] = useState(false);
  const reasonText = extractReasonOnly(summary);
  const plainText = reasonText
    .replace(/^#{1,4}\s*/gm, "")
    .replace(/\*\*/g, "")
    .replace(/^[-•*]\s*/gm, "")
    .trim();

  return (
    <Pressable
      onPress={() => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setExpanded((v) => !v);
      }}
      style={{
        backgroundColor: "#eef1ff",
        borderRadius: 16,
        padding: 16,
        gap: 8,
      }}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Text style={{ fontSize: 15 }}>💡</Text>
          <Text style={{ fontSize: 13, fontWeight: "700", color: "#4361ee" }}>
            AI 추천 이유
          </Text>
        </View>
        <Text style={{ fontSize: 12, color: "#6b7280" }}>
          {expanded ? "접기 ▲" : "더 보기 ▼"}
        </Text>
      </View>
      <Text
        numberOfLines={expanded ? undefined : 2}
        style={{ fontSize: 13, color: "#374151", lineHeight: 20 }}
      >
        {plainText}
      </Text>
    </Pressable>
  );
};

// ── 유전병 영양소 카드 (접기/펼치기) ──
const NutrientCard = ({
  item,
  defaultOpen,
}: {
  item: NutrientItem;
  defaultOpen: boolean;
}) => {
  const [expanded, setExpanded] = useState(defaultOpen);
  const cats = categorizeIngredients(item.recommended_ingredients);

  const severityColor =
    item.severity === "high"
      ? "#dc2626"
      : item.severity === "medium"
        ? "#d97706"
        : "#16a34a";
  const severityBg =
    item.severity === "high"
      ? "#fef2f2"
      : item.severity === "medium"
        ? "#fffbeb"
        : "#f0fdf4";
  const severityLabel =
    item.severity === "high"
      ? "고위험"
      : item.severity === "medium"
        ? "중간"
        : "낮음";

  return (
    <View
      style={{
        backgroundColor: "#fff",
        borderRadius: 18,
        borderWidth: 1.5,
        borderColor: "#e5e7eb",
        overflow: "hidden",
      }}
    >
      {/* 헤더 (터치로 접기/펼치기) */}
      <Pressable
        onPress={() => {
          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
          setExpanded((v) => !v);
        }}
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingHorizontal: 16,
          paddingVertical: 14,
          backgroundColor: "#fafafa",
          borderBottomWidth: expanded ? 1 : 0,
          borderBottomColor: "#f0f0f0",
        }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
            flex: 1,
          }}
        >
          <View
            style={{
              width: 8,
              height: 8,
              borderRadius: 4,
              backgroundColor: severityColor,
              flexShrink: 0,
            }}
          />
          <Text
            style={{
              fontSize: 15,
              fontWeight: "700",
              color: "#1f2937",
              flex: 1,
            }}
          >
            {item.disease_name_ko}
          </Text>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <View
            style={{
              backgroundColor: severityBg,
              borderRadius: 20,
              paddingHorizontal: 10,
              paddingVertical: 4,
            }}
          >
            <Text
              style={{ fontSize: 11, fontWeight: "700", color: severityColor }}
            >
              {severityLabel}
            </Text>
          </View>
          <Text style={{ fontSize: 12, color: "#9ca3af" }}>
            {expanded ? "▲" : "▼"}
          </Text>
        </View>
      </Pressable>

      {/* 카테고리별 재료 (펼쳐질 때만) */}
      {expanded && (
        <View style={{ padding: 14, gap: 10 }}>
          {(Object.keys(CATEGORY_META) as IngredientCategory[]).map((cat) => {
            const meta = CATEGORY_META[cat];
            const items = cats[cat];
            if (items.length === 0) return null;
            return (
              <View key={cat}>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 6,
                    marginBottom: 8,
                  }}
                >
                  <Text style={{ fontSize: 14 }}>{meta.emoji}</Text>
                  <Text
                    style={{
                      fontSize: 12,
                      fontWeight: "700",
                      color: meta.color,
                    }}
                  >
                    {meta.label}
                  </Text>
                  <View
                    style={{
                      flex: 1,
                      height: 1,
                      backgroundColor: meta.bg,
                      marginLeft: 4,
                    }}
                  />
                </View>
                <View
                  style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}
                >
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
                      <Text
                        style={{
                          fontSize: 13,
                          fontWeight: "600",
                          color: "#1f2937",
                        }}
                      >
                        {ing.name_ko}
                      </Text>
                      {ing.effect_description && (
                        <Text
                          style={{
                            marginTop: 3,
                            fontSize: 11,
                            color: "#6b7280",
                            lineHeight: 16,
                          }}
                          numberOfLines={2}
                        >
                          {ing.effect_description}
                        </Text>
                      )}
                    </View>
                  ))}
                </View>
              </View>
            );
          })}
          {item.recommended_ingredients.length === 0 && (
            <Text
              style={{
                fontSize: 13,
                color: "#9ca3af",
                textAlign: "center",
                paddingVertical: 8,
              }}
            >
              권장 영양소 정보가 없습니다.
            </Text>
          )}
        </View>
      )}
    </View>
  );
};

const RecommendationScreen = ({ navigation, route }: Props) => {
  const { breedId, breedNameKo } = route.params;
  const [data, setData] = useState<RecommendationResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>("nutrients");
  const { setBreed } = useBreed();

  useEffect(() => {
    setBreed(breedId, breedNameKo);
  }, [breedId, breedNameKo]);

  const fetchData = () => {
    setLoading(true);
    setError(null);
    getRecommendations({ breed_id: breedId })
      .then(setData)
      .catch((err: { detail?: string; message?: string }) =>
        setError(
          err.detail || err.message || "추천 정보를 불러오지 못했습니다.",
        ),
      )
      .finally(() => setLoading(false));
  };

  useEffect(fetchData, [breedId]);

  if (loading)
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: "#fff" }}>
        <LoadingSpinner />
      </SafeAreaView>
    );
  if (error)
    return (
      <SafeAreaView
        style={{
          flex: 1,
          backgroundColor: "#fff",
          padding: 24,
          justifyContent: "center",
        }}
      >
        <ErrorState message={error} onRetry={fetchData} />
      </SafeAreaView>
    );
  if (!data)
    return (
      <SafeAreaView
        style={{
          flex: 1,
          backgroundColor: "#fff",
          padding: 24,
          justifyContent: "center",
        }}
      >
        <EmptyState />
      </SafeAreaView>
    );

  const tabs: { key: TabKey; label: string }[] = [
    { key: "nutrients", label: "유전병별 영양소" },
    { key: "foods", label: "추천 음식" },
  ];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#fff" }}>
      {/* 스크롤 영역 */}
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingVertical: 16,
          gap: 16,
          paddingBottom: 24,
        }}
        showsVerticalScrollIndicator={false}
      >
        <Text
          style={{
            textAlign: "center",
            fontSize: 22,
            fontWeight: "800",
            color: "#1f2937",
          }}
        >
          {data.breed_name_ko} 맞춤 추천
        </Text>

        {data.summary ? <CollapsibleSummary summary={data.summary} /> : null}

        {/* 탭 바 */}
        <View
          style={{
            flexDirection: "row",
            backgroundColor: "#f3f4f6",
            borderRadius: 12,
            padding: 4,
          }}
        >
          {tabs.map((tab) => (
            <Pressable
              key={tab.key}
              style={{
                flex: 1,
                borderRadius: 10,
                paddingVertical: 10,
                backgroundColor: activeTab === tab.key ? "#fff" : "transparent",
              }}
              onPress={() => setActiveTab(tab.key)}
            >
              <Text
                style={{
                  textAlign: "center",
                  fontSize: 13,
                  fontWeight: "700",
                  color: activeTab === tab.key ? "#4361ee" : "#9ca3af",
                }}
              >
                {tab.label}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* ── 탭1: 유전병별 영양소 ── */}
        {activeTab === "nutrients" && (
          <View style={{ gap: 12 }}>
            {data.tab_nutrients && data.tab_nutrients.length > 0 ? (
              data.tab_nutrients.map((item, idx) => (
                <NutrientCard key={idx} item={item} defaultOpen={idx === 0} />
              ))
            ) : (
              <EmptyState message="영양소 데이터가 아직 준비되지 않았습니다." />
            )}
          </View>
        )}

        {/* ── 탭2: 추천 음식 ── */}
        {activeTab === "foods" && (
          <View style={{ gap: 10 }}>
            {data.tab_foods && data.tab_foods.length > 0
              ? data.tab_foods.map((food, index) => {
                  const hasRecipe = food.recipe_ids.length > 0;
                  const diffLabel =
                    food.difficulty === "easy"
                      ? "쉬움"
                      : food.difficulty === "medium"
                        ? "보통"
                        : food.difficulty === "hard"
                          ? "어려움"
                          : "쉬움";
                  const diffColor =
                    food.difficulty === "medium"
                      ? "#d97706"
                      : food.difficulty === "hard"
                        ? "#dc2626"
                        : "#16a34a";
                  return (
                    <Pressable
                      key={food.food_id}
                      disabled={!hasRecipe}
                      onPress={() =>
                        navigation.navigate("RecipeDetail", {
                          recipeId: food.recipe_ids[0],
                          breedId,
                        })
                      }
                      style={({ pressed }) => ({
                        backgroundColor: pressed ? "#f9fafb" : "#fff",
                        borderRadius: 16,
                        borderWidth: 1,
                        borderColor: "#e5e7eb",
                        padding: 14,
                        opacity: hasRecipe ? 1 : 0.5,
                      })}
                    >
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 12,
                        }}
                      >
                        <View
                          style={{
                            width: 30,
                            height: 30,
                            borderRadius: 8,
                            backgroundColor: "#f3f4f6",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <Text
                            style={{
                              fontSize: 13,
                              fontWeight: "800",
                              color: "#111827",
                            }}
                          >
                            {index + 1}
                          </Text>
                        </View>
                        <View style={{ flex: 1, gap: 4 }}>
                          <Text
                            style={{
                              fontSize: 15,
                              fontWeight: "700",
                              color: "#111827",
                            }}
                          >
                            {food.name_ko}
                          </Text>
                          <View
                            style={{
                              flexDirection: "row",
                              flexWrap: "wrap",
                              gap: 5,
                            }}
                          >
                            <View
                              style={{
                                flexDirection: "row",
                                alignItems: "center",
                                gap: 4,
                              }}
                            >
                              <View
                                style={{
                                  width: 6,
                                  height: 6,
                                  borderRadius: 3,
                                  backgroundColor: diffColor,
                                }}
                              />
                              <Text
                                style={{
                                  fontSize: 11,
                                  color: diffColor,
                                  fontWeight: "600",
                                }}
                              >
                                {diffLabel}
                              </Text>
                            </View>
                            {food.target_diseases?.map((d, i) => (
                              <View
                                key={i}
                                style={{
                                  backgroundColor: "#fef2f2",
                                  borderRadius: 6,
                                  paddingHorizontal: 7,
                                  paddingVertical: 2,
                                }}
                              >
                                <Text
                                  style={{
                                    fontSize: 11,
                                    color: "#dc2626",
                                    fontWeight: "600",
                                  }}
                                >
                                  {d}
                                </Text>
                              </View>
                            ))}
                          </View>
                        </View>
                        {hasRecipe && (
                          <View
                            style={{
                              flexDirection: "row",
                              alignItems: "center",
                            }}
                          >
                            <Text
                              style={{
                                fontSize: 11,
                                color: "#111827",
                                fontWeight: "600",
                              }}
                            >
                              레시피 보기
                            </Text>
                            <Text style={{ fontSize: 16, color: "#111827" }}>
                              ›
                            </Text>
                          </View>
                        )}
                      </View>
                    </Pressable>
                  );
                })
              : data.recipes && data.recipes.length > 0
                ? data.recipes.map((r, index) => {
                    const diffColor =
                      r.difficulty === "medium"
                        ? "#d97706"
                        : r.difficulty === "hard"
                          ? "#dc2626"
                          : "#16a34a";
                    const diffLabel =
                      r.difficulty === "easy"
                        ? "쉬움"
                        : r.difficulty === "medium"
                          ? "보통"
                          : r.difficulty === "hard"
                            ? "어려움"
                            : "쉬움";
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
                          backgroundColor: pressed ? "#f9fafb" : "#fff",
                          borderRadius: 16,
                          borderWidth: 1,
                          borderColor: "#e5e7eb",
                          padding: 14,
                        })}
                      >
                        <View
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 12,
                          }}
                        >
                          <View
                            style={{
                              width: 30,
                              height: 30,
                              borderRadius: 8,
                              backgroundColor: "#f3f4f6",
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          >
                            <Text
                              style={{
                                fontSize: 13,
                                fontWeight: "800",
                                color: "#111827",
                              }}
                            >
                              {index + 1}
                            </Text>
                          </View>
                          <View style={{ flex: 1, gap: 4 }}>
                            <Text
                              style={{
                                fontSize: 15,
                                fontWeight: "700",
                                color: "#111827",
                              }}
                            >
                              {r.title}
                            </Text>
                            <View
                              style={{
                                flexDirection: "row",
                                flexWrap: "wrap",
                                gap: 5,
                                alignItems: "center",
                              }}
                            >
                              <View
                                style={{
                                  flexDirection: "row",
                                  alignItems: "center",
                                  gap: 4,
                                }}
                              >
                                <View
                                  style={{
                                    width: 6,
                                    height: 6,
                                    borderRadius: 3,
                                    backgroundColor: diffColor,
                                  }}
                                />
                                <Text
                                  style={{
                                    fontSize: 11,
                                    color: diffColor,
                                    fontWeight: "600",
                                  }}
                                >
                                  {diffLabel}
                                </Text>
                              </View>
                              {r.cook_time_min != null && (
                                <Text
                                  style={{ fontSize: 11, color: "#9ca3af" }}
                                >
                                  ⏱ {r.cook_time_min}분
                                </Text>
                              )}
                              {r.target_diseases.map((d, i) => (
                                <View
                                  key={i}
                                  style={{
                                    backgroundColor: "#fef2f2",
                                    borderRadius: 6,
                                    paddingHorizontal: 7,
                                    paddingVertical: 2,
                                  }}
                                >
                                  <Text
                                    style={{
                                      fontSize: 11,
                                      color: "#dc2626",
                                      fontWeight: "600",
                                    }}
                                  >
                                    {d}
                                  </Text>
                                </View>
                              ))}
                            </View>
                          </View>
                          <View
                            style={{
                              flexDirection: "row",
                              alignItems: "center",
                            }}
                          >
                            <Text
                              style={{
                                fontSize: 11,
                                color: "#9ca3af",
                                fontWeight: "600",
                              }}
                            >
                              레시피 보기
                            </Text>
                            <Text style={{ fontSize: 16, color: "#9ca3af" }}>
                              ›
                            </Text>
                          </View>
                        </View>
                      </Pressable>
                    );
                  })
                : [<EmptyState key="empty" message="추천 음식이 없습니다." />]}
          </View>
        )}

        <Disclaimer />
      </ScrollView>

      {/* ── 하단 sticky 버튼 ── */}
      <View
        style={{
          paddingHorizontal: 20,
          paddingVertical: 12,
          paddingBottom: 20,
          gap: 8,
          backgroundColor: "#fff",
          borderTopWidth: 1,
          borderTopColor: "#f3f4f6",
        }}
      >
        <Pressable
          style={{
            backgroundColor: "#f3f4f6",
            borderRadius: 14,
            paddingVertical: 13,
          }}
          onPress={() => navigation.goBack()}
        >
          <Text
            style={{
              textAlign: "center",
              fontSize: 13,
              fontWeight: "600",
              color: "#6b7280",
            }}
          >
            뒤로가기
          </Text>
        </Pressable>
        <Pressable
          style={{
            backgroundColor: "#f3f4f6",
            borderRadius: 14,
            paddingVertical: 13,
          }}
          onPress={() =>
            navigation.reset({ index: 0, routes: [{ name: "Upload" }] })
          }
        >
          <Text
            style={{
              textAlign: "center",
              fontSize: 13,
              fontWeight: "600",
              color: "#6b7280",
            }}
          >
            다른 강아지 분석하기
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
};

export default RecommendationScreen;
