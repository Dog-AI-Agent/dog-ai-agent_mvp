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
import {
  getRecommendations,
  getRecommendationSummary,
  getRecommendationSummaryStream,
} from "../api/recommendations";
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
import type {
  RecommendationResponse,
  FoodCard,
  RecipeCard,
  NutrientItem,
} from "../types";
import UserHeader from "../components/UserHeader";

type Props = NativeStackScreenProps<RootStackParamList, "Recommendation">;
type TabKey = "nutrients" | "foods";

const ACCENT_COLORS = ["#818cf8", "#38bdf8", "#a78bfa", "#34d399", "#fbbf24"];

const FoodCardItem = ({
  food,
  index,
  onPress,
}: {
  food: FoodCard;
  index: number;
  onPress: () => void;
}) => {
  const [hovered, setHovered] = useState(false);
  const accent = ACCENT_COLORS[index % ACCENT_COLORS.length];
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
  const diffBg =
    food.difficulty === "medium"
      ? "#fef3c7"
      : food.difficulty === "hard"
        ? "#fee2e2"
        : "#dcfce7";

  return (
    <Pressable
      disabled={!hasRecipe}
      onPress={onPress}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      style={({ pressed }) => ({
        backgroundColor: pressed || hovered ? "#fafafa" : "#fff",
        borderRadius: 14,
        borderWidth: 1,
        borderColor: "#e5e7eb",
        overflow: "hidden",
        opacity: hasRecipe ? 1 : 0.5,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 3,
        elevation: 1,
      })}
    >
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        {/* 왼쪽 accent bar */}
        <View
          style={{
            width: 4,
            alignSelf: "stretch",
            backgroundColor: accent,
            opacity: 0.7,
          }}
        />

        {/* 번호 배지 */}
        <View
          style={{
            width: 28,
            height: 28,
            borderRadius: 14,
            backgroundColor: "#fff",
            borderWidth: 1.5,
            borderColor: accent,
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            marginLeft: 12,
          }}
        >
          <Text style={{ fontSize: 12, fontWeight: "800", color: accent }}>
            {index + 1}
          </Text>
        </View>

        {/* 음식명 + 태그 */}
        <View
          style={{
            flex: 1,
            paddingVertical: 14,
            paddingHorizontal: 10,
            gap: 6,
          }}
        >
          <Text
            style={{
              fontSize: 15,
              fontWeight: "700",
              color: "#111827",
              lineHeight: 21,
            }}
          >
            {food.name_ko}
          </Text>
          {/* 1줄: 난이도 + 시간 */}
          <View style={{ flexDirection: "row", gap: 5, alignItems: "center" }}>
            <View
              style={{
                backgroundColor: diffBg,
                borderRadius: 20,
                paddingHorizontal: 8,
                paddingVertical: 3,
                flexDirection: "row",
                alignItems: "center",
                gap: 3,
              }}
            >
              <View
                style={{
                  width: 5,
                  height: 5,
                  borderRadius: 2.5,
                  backgroundColor: diffColor,
                }}
              />
              <Text
                style={{ fontSize: 11, color: diffColor, fontWeight: "600" }}
              >
                {diffLabel}
              </Text>
            </View>
            {food.cook_time_min != null && (
              <View
                style={{
                  backgroundColor: "#f1f5f9",
                  borderRadius: 20,
                  paddingHorizontal: 8,
                  paddingVertical: 3,
                }}
              >
                <Text
                  style={{ fontSize: 11, color: "#475569", fontWeight: "600" }}
                >
                  ⏱ {food.cook_time_min}분
                </Text>
              </View>
            )}
          </View>
          {/* 2줄: 예상 병명 태그 */}
          {food.target_diseases && food.target_diseases.length > 0 && (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 5 }}>
              {food.target_diseases.map((d, i) => (
                <View
                  key={i}
                  style={{
                    backgroundColor: "#fff1f2",
                    borderRadius: 20,
                    paddingHorizontal: 8,
                    paddingVertical: 3,
                    borderWidth: 1,
                    borderColor: "#fecdd3",
                  }}
                >
                  <Text
                    style={{
                      fontSize: 11,
                      color: "#e11d48",
                      fontWeight: "600",
                    }}
                  >
                    {d}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* 레시피 버튼 */}
        {hasRecipe && (
          <View
            style={{
              marginRight: 12,
              backgroundColor: hovered ? accent : "transparent",
              borderRadius: 8,
              borderWidth: 1.5,
              borderColor: accent,
              paddingHorizontal: 10,
              paddingVertical: 6,
              opacity: hovered ? 1 : 0.55,
            }}
          >
            <Text
              style={{
                fontSize: 12,
                color: hovered ? "#fff" : accent,
                fontWeight: "700",
              }}
            >
              레시피 →
            </Text>
          </View>
        )}
      </View>
    </Pressable>
  );
};

const RecipeCardItem = ({
  recipe,
  index,
  onPress,
}: {
  recipe: RecipeCard;
  index: number;
  onPress: () => void;
}) => {
  const [hovered, setHovered] = useState(false);
  const accent = ACCENT_COLORS[index % ACCENT_COLORS.length];
  const diffLabel =
    recipe.difficulty === "easy"
      ? "쉬움"
      : recipe.difficulty === "medium"
        ? "보통"
        : recipe.difficulty === "hard"
          ? "어려움"
          : "쉬움";
  const diffColor =
    recipe.difficulty === "medium"
      ? "#d97706"
      : recipe.difficulty === "hard"
        ? "#dc2626"
        : "#16a34a";
  const diffBg =
    recipe.difficulty === "medium"
      ? "#fef3c7"
      : recipe.difficulty === "hard"
        ? "#fee2e2"
        : "#dcfce7";

  return (
    <Pressable
      onPress={onPress}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      style={({ pressed }) => ({
        backgroundColor: pressed || hovered ? "#fafafa" : "#fff",
        borderRadius: 14,
        borderWidth: 1,
        borderColor: "#e5e7eb",
        overflow: "hidden",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 3,
        elevation: 1,
      })}
    >
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        {/* 왼쪽 accent bar */}
        <View
          style={{
            width: 4,
            alignSelf: "stretch",
            backgroundColor: accent,
            opacity: 0.7,
          }}
        />

        {/* 번호 배지 */}
        <View
          style={{
            width: 28,
            height: 28,
            borderRadius: 14,
            backgroundColor: "#fff",
            borderWidth: 1.5,
            borderColor: accent,
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            marginLeft: 12,
          }}
        >
          <Text style={{ fontSize: 12, fontWeight: "800", color: accent }}>
            {index + 1}
          </Text>
        </View>

        {/* 제목 + 태그 */}
        <View
          style={{
            flex: 1,
            paddingVertical: 14,
            paddingHorizontal: 10,
            gap: 6,
          }}
        >
          <Text
            style={{
              fontSize: 15,
              fontWeight: "700",
              color: "#111827",
              lineHeight: 21,
            }}
          >
            {recipe.title}
          </Text>
          {/* 1줄: 난이도 + 시간 */}
          <View style={{ flexDirection: "row", gap: 5, alignItems: "center" }}>
            <View
              style={{
                backgroundColor: diffBg,
                borderRadius: 20,
                paddingHorizontal: 8,
                paddingVertical: 3,
                flexDirection: "row",
                alignItems: "center",
                gap: 3,
              }}
            >
              <View
                style={{
                  width: 5,
                  height: 5,
                  borderRadius: 2.5,
                  backgroundColor: diffColor,
                }}
              />
              <Text
                style={{ fontSize: 11, color: diffColor, fontWeight: "600" }}
              >
                {diffLabel}
              </Text>
            </View>
            {recipe.cook_time_min != null && (
              <View
                style={{
                  backgroundColor: "#f1f5f9",
                  borderRadius: 20,
                  paddingHorizontal: 8,
                  paddingVertical: 3,
                }}
              >
                <Text
                  style={{ fontSize: 11, color: "#475569", fontWeight: "600" }}
                >
                  ⏱ {recipe.cook_time_min}분
                </Text>
              </View>
            )}
          </View>
          {/* 2줄: 예상 병명 태그 */}
          {recipe.target_diseases && recipe.target_diseases.length > 0 && (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 5 }}>
              {recipe.target_diseases.map((d, i) => (
                <View
                  key={i}
                  style={{
                    backgroundColor: "#fff1f2",
                    borderRadius: 20,
                    paddingHorizontal: 8,
                    paddingVertical: 3,
                    borderWidth: 1,
                    borderColor: "#fecdd3",
                  }}
                >
                  <Text
                    style={{
                      fontSize: 11,
                      color: "#e11d48",
                      fontWeight: "600",
                    }}
                  >
                    {d}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* 레시피 버튼 */}
        <View
          style={{
            marginRight: 12,
            backgroundColor: hovered ? accent : "transparent",
            borderRadius: 8,
            borderWidth: 1.5,
            borderColor: accent,
            paddingHorizontal: 10,
            paddingVertical: 6,
            opacity: hovered ? 1 : 0.55,
          }}
        >
          <Text
            style={{
              fontSize: 12,
              color: hovered ? "#fff" : accent,
              fontWeight: "700",
            }}
          >
            레시피 →
          </Text>
        </View>
      </View>
    </Pressable>
  );
};

// ── AI 추천 이유 (lazy 로딩 - 펼칠 때만 스트리밍 fetch) ──
const CollapsibleSummary = ({ breedId }: { breedId: string }) => {
  const [expanded, setExpanded] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [finalSummary, setFinalSummary] = useState<string | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [fetched, setFetched] = useState(false);

  const handleToggle = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    const next = !expanded;
    setExpanded(next);
    if (next && !fetched) {
      setFetched(true);
      setSummaryLoading(true);
      getRecommendationSummaryStream(
        breedId,
        (token) => {
          setSummaryLoading(false);
          setStreamingText((prev) => prev + token);
        },
        (summary) => {
          setFinalSummary(summary);
          setSummaryLoading(false);
        },
        () => {
          setSummaryLoading(false);
          setStreamingText((prev) => prev || "AI 요약을 불러오지 못했습니다.");
        },
      );
    }
  };

  const displayText = finalSummary ?? streamingText;
  const plainText = displayText
    ? extractReasonOnly(displayText)
        .replace(/^#{1,4}\s*/gm, "")
        .replace(/\*\*/g, "")
        .replace(/^[-•*]\s*/gm, "")
        .trim()
    : "";

  return (
    <Pressable
      onPress={handleToggle}
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
      {!expanded && (
        <Text style={{ fontSize: 12, color: "#9ca3af", fontStyle: "italic" }}>
          누르면 AI 요약을 불러옵니다
        </Text>
      )}
      {expanded && summaryLoading && (
        <Text
          style={{
            fontSize: 13,
            color: "#9ca3af",
            textAlign: "center",
            paddingVertical: 8,
          }}
        >
          🤖 AI 분석 중...
        </Text>
      )}
      {expanded && !summaryLoading && plainText ? (
        <Text style={{ fontSize: 13, color: "#374151", lineHeight: 20 }}>
          {plainText}
        </Text>
      ) : null}
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
      <UserHeader />
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

        <CollapsibleSummary breedId={breedId} />

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
          <View style={{ gap: 12 }}>
            {/* 섹션 헤더 */}
            {((data.tab_foods && data.tab_foods.length > 0) ||
              (data.recipes && data.recipes.length > 0)) && (
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 8,
                  paddingHorizontal: 2,
                }}
              >
                <Text style={{ fontSize: 18 }}>🍽</Text>
                <Text
                  style={{ fontSize: 14, fontWeight: "700", color: "#374151" }}
                >
                  추천 음식{" "}
                  <Text style={{ color: "#4f46e5" }}>
                    {data.tab_foods && data.tab_foods.length > 0
                      ? data.tab_foods.length
                      : (data.recipes?.length ?? 0)}
                    개
                  </Text>
                </Text>
              </View>
            )}

            {data.tab_foods && data.tab_foods.length > 0
              ? data.tab_foods.map((food, index) => (
                  <FoodCardItem
                    key={food.food_id}
                    food={food}
                    index={index}
                    onPress={() =>
                      navigation.navigate("RecipeDetail", {
                        recipeId: food.recipe_ids[0],
                        breedId,
                      })
                    }
                  />
                ))
              : data.recipes && data.recipes.length > 0
                ? data.recipes.map((r, index) => (
                    <RecipeCardItem
                      key={r.recipe_id}
                      recipe={r}
                      index={index}
                      onPress={() =>
                        navigation.navigate("RecipeDetail", {
                          recipeId: r.recipe_id,
                          breedId,
                        })
                      }
                    />
                  ))
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
          style={({ pressed }) => ({
            backgroundColor: pressed ? "#e5e7eb" : "#f3f4f6",
            borderRadius: 14,
            paddingVertical: 13,
          })}
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
          style={({ pressed }) => ({
            backgroundColor: pressed ? "#3451d1" : "#4361EE",
            borderRadius: 14,
            paddingVertical: 13,
          })}
          onPress={() =>
            navigation.reset({ index: 0, routes: [{ name: "Upload" }] })
          }
        >
          <Text
            style={{
              textAlign: "center",
              fontSize: 13,
              fontWeight: "600",
              color: "#ffffff",
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
