// ============================================================
// S5 — 레시피 상세
// 우선순위: 재료(양 포함) → 조리 단계 → AI 추천 이유(접기)
// ============================================================
import { useEffect, useState } from "react";
import { View, Text, ScrollView, Pressable, LayoutAnimation, Platform, UIManager } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/RootStack";
import { getRecipe } from "../api/recipes";
import LoadingSpinner from "../components/LoadingSpinner";
import ErrorState from "../components/ErrorState";
import MarkdownRenderer from "../components/MarkdownRenderer";
import { extractReasonOnly } from "../utils/reorderSummary";
import type { RecipeDetailResponse } from "../types";

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type Props = NativeStackScreenProps<RootStackParamList, "RecipeDetail">;

// ── 메타 카드 ──
const MetaItem = ({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: string;
}) => (
  <View
    style={{
      flex: 1,
      alignItems: "center",
      backgroundColor: "#f8f9fa",
      borderRadius: 12,
      paddingVertical: 12,
      paddingHorizontal: 4,
    }}
  >
    <Text style={{ fontSize: 18 }}>{icon}</Text>
    <Text style={{ marginTop: 4, fontSize: 11, color: "#6b7280" }}>{label}</Text>
    <Text style={{ fontSize: 13, fontWeight: "700", color: "#1f2937", marginTop: 2 }}>
      {value}
    </Text>
  </View>
);

const difficultyLabel = (d?: string | null) =>
  d === "easy" ? "쉬움" : d === "medium" ? "보통" : d === "hard" ? "어려움" : "—";

// ── AI 가이드 (접기/펼치기) ──
// hasDbSteps=true  → 추천 이유 섹션만 접어서 표시
// hasDbSteps=false → LLM 전체(재료+조리법+추천이유) 표시
const CollapsibleAiGuide = ({
  summary,
  hasDbSteps,
}: {
  summary: string;
  hasDbSteps: boolean;
}) => {
  const [expanded, setExpanded] = useState(!hasDbSteps); // DB steps 없으면 기본 펼침

  // DB steps가 있으면 추천이유 섹션만, 없으면 전체 LLM 출력
  const displayContent = hasDbSteps ? extractReasonOnly(summary) : summary;

  const toggle = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded((v) => !v);
  };

  const label = hasDbSteps ? "💡 AI 추천 이유" : "🍳 AI 레시피 가이드";

  return (
    <View style={{ backgroundColor: "#eef1ff", borderRadius: 16, overflow: "hidden" }}>
      {/* 헤더 탭 */}
      <Pressable
        onPress={toggle}
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingHorizontal: 16,
          paddingVertical: 14,
        }}
      >
        <Text style={{ fontSize: 13, fontWeight: "700", color: "#4361ee" }}>{label}</Text>
        <Text style={{ fontSize: 12, color: "#6b7280" }}>
          {expanded ? "접기 ▲" : "펼치기 ▼"}
        </Text>
      </Pressable>

      {/* 본문 */}
      {expanded && (
        <View style={{ paddingHorizontal: 16, paddingBottom: 16 }}>
          <MarkdownRenderer content={displayContent} />
        </View>
      )}
    </View>
  );
};

// ── 메인 화면 ──
const RecipeDetailScreen = ({ navigation, route }: Props) => {
  const { recipeId, breedId } = route.params;
  const [recipe, setRecipe] = useState<RecipeDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);


  useEffect(() => {
    setLoading(true);
    getRecipe(recipeId, breedId)
      .then(setRecipe)
      .catch((err: { detail?: string; message?: string }) =>
        setError(err.detail || err.message || "레시피를 불러오지 못했습니다.")
      )
      .finally(() => setLoading(false));
  }, [recipeId, breedId]);

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

  return (
    <SafeAreaView className="flex-1 bg-white">
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingVertical: 20, gap: 20 }}
        showsVerticalScrollIndicator={false}
      >

        {/* ① 제목 + 유전병 태그 */}
        <View style={{ gap: 8, alignItems: "center" }}>
          <Text style={{ fontSize: 22, fontWeight: "800", color: "#1f2937", textAlign: "center" }}>
            {recipe.title}
          </Text>
          {recipe.target_diseases.length > 0 && (
            <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 6 }}>
              {recipe.target_diseases.map((d, i) => (
                <View
                  key={i}
                  style={{
                    backgroundColor: "#fef2f2",
                    borderRadius: 20,
                    paddingHorizontal: 10,
                    paddingVertical: 4,
                  }}
                >
                  <Text style={{ fontSize: 11, fontWeight: "600", color: "#dc2626" }}>{d}</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* ② 메타 정보 (조리시간 · 칼로리 · 난이도 · 인분) */}
        <View style={{ flexDirection: "row", gap: 8 }}>
          <MetaItem
            icon="⏱"
            label="조리시간"
            value={recipe.cook_time_min != null ? `${recipe.cook_time_min}분` : "—"}
          />
          <MetaItem
            icon="🔥"
            label="칼로리"
            value={
              recipe.calories_per_serving != null
                ? `${recipe.calories_per_serving}kcal`
                : "—"
            }
          />
          <MetaItem icon="📊" label="난이도" value={difficultyLabel(recipe.difficulty)} />
          <MetaItem icon="🍽" label="인분" value={`${recipe.servings}인분`} />
        </View>

        {/* ③ 재료 */}
        {recipe.ingredients.length > 0 && (
          <View style={{ gap: 10 }}>
            {/* 섹션 헤더 */}
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Text style={{ fontSize: 16, fontWeight: "800", color: "#1f2937" }}>재료</Text>
              <View style={{ flex: 1, height: 1.5, backgroundColor: "#e5e7eb", borderRadius: 1 }} />
            </View>

            <View style={{ gap: 6 }}>
              {recipe.ingredients
                .slice()
                .sort((a, b) => a.sort_order - b.sort_order)
                .map((ing, i) => (
                  <View
                    key={i}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      backgroundColor: "#f8f9fa",
                      borderRadius: 12,
                      paddingHorizontal: 14,
                      paddingVertical: 12,
                    }}
                  >
                    {/* 불릿 */}
                    <View style={{
                      width: 6, height: 6, borderRadius: 3,
                      backgroundColor: "#4361ee", marginRight: 12, flexShrink: 0,
                    }} />

                    {/* 재료명 */}
                    <Text style={{ flex: 1, fontSize: 14, fontWeight: "600", color: "#1f2937" }}>
                      {ing.name}
                    </Text>

                    {/* 양 — 오른쪽 강조 */}
                    {ing.amount && (
                      <View style={{
                        backgroundColor: "#eef1ff", borderRadius: 8,
                        paddingHorizontal: 10, paddingVertical: 4,
                      }}>
                        <Text style={{ fontSize: 13, fontWeight: "700", color: "#4361ee" }}>
                          {ing.amount}
                        </Text>
                      </View>
                    )}
                  </View>
                ))}
            </View>
          </View>
        )}

        {/* ④ 조리 단계 */}
        {recipe.steps.length > 0 && (
          <View style={{ gap: 10 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Text style={{ fontSize: 16, fontWeight: "800", color: "#1f2937" }}>조리 순서</Text>
              <View style={{ flex: 1, height: 1.5, backgroundColor: "#e5e7eb", borderRadius: 1 }} />
            </View>

            <View style={{ gap: 8 }}>
              {recipe.steps
                .slice()
                .sort((a, b) => a.step_number - b.step_number)
                .map((step) => (
                  <View
                    key={step.step_number}
                    style={{
                      flexDirection: "row",
                      gap: 12,
                      backgroundColor: "#f8f9fa",
                      borderRadius: 14,
                      paddingHorizontal: 14,
                      paddingVertical: 14,
                    }}
                  >
                    {/* 번호 뱃지 */}
                    <View
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 14,
                        backgroundColor: "#4361ee",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                        marginTop: 1,
                      }}
                    >
                      <Text style={{ fontSize: 12, fontWeight: "800", color: "#fff" }}>
                        {step.step_number}
                      </Text>
                    </View>

                    {/* 조리 설명 */}
                    <Text
                      style={{
                        flex: 1,
                        fontSize: 14,
                        color: "#374151",
                        lineHeight: 22,
                      }}
                    >
                      {step.instruction}
                    </Text>
                  </View>
                ))}
            </View>
          </View>
        )}

        {/* ⑤ AI 가이드 (DB steps 있으면 추천이유만, 없으면 전체 레시피) */}
        {recipe.summary && (
          <CollapsibleAiGuide
            summary={recipe.summary}
            hasDbSteps={recipe.steps.length > 0}
          />
        )}

        {/* ⑥ 하단 버튼 */}
        <View style={{ gap: 10, paddingBottom: 8 }}>
          <Pressable
            style={{
              backgroundColor: "#f3f4f6",
              borderRadius: 14,
              paddingVertical: 14,
            }}
            onPress={() => navigation.goBack()}
          >
            <Text style={{ textAlign: "center", fontSize: 14, fontWeight: "600", color: "#6b7280" }}>
              뒤로가기
            </Text>
          </Pressable>
          <Pressable
            style={{
              backgroundColor: "#f3f4f6",
              borderRadius: 14,
              paddingVertical: 14,
            }}
            onPress={() =>
              navigation.reset({ index: 0, routes: [{ name: "Upload" }] })
            }
          >
            <Text style={{ textAlign: "center", fontSize: 14, fontWeight: "600", color: "#6b7280" }}>
              다른 강아지 분석하기
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default RecipeDetailScreen;
