// ============================================================
// S5 — 레시피 상세
// - 재료 중복 제거
// - 재료/조리순서 섹션 접기/펼치기
// - 하단 버튼 sticky 고정
// ============================================================
import { useEffect, useState, useRef } from "react";
import { View, Text, ScrollView, Pressable, LayoutAnimation, Platform, UIManager } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/RootStack";
import { getRecipe } from "../api/recipes";
import LoadingSpinner from "../components/LoadingSpinner";
import ErrorState from "../components/ErrorState";
import MarkdownRenderer from "../components/MarkdownRenderer";
import UserHeader from "../components/UserHeader";
import { extractReasonOnly } from "../utils/reorderSummary";
import type { RecipeDetailResponse } from "../types";

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type Props = NativeStackScreenProps<RootStackParamList, "RecipeDetail">;

const difficultyLabel = (d?: string | null) =>
  d === "easy" ? "쉬움" : d === "medium" ? "보통" : d === "hard" ? "어려움" : "—";

// ── 메타 카드 ──
const MetaItem = ({ label, value, icon }: { label: string; value: string; icon: string }) => (
  <View style={{
    flex: 1,
    alignItems: "center",
    backgroundColor: "#f8f9fa",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 4,
  }}>
    <Text style={{ fontSize: 18 }}>{icon}</Text>
    <Text style={{ marginTop: 4, fontSize: 11, color: "#6b7280" }}>{label}</Text>
    <Text style={{ fontSize: 13, fontWeight: "700", color: "#1f2937", marginTop: 2 }}>{value}</Text>
  </View>
);

// ── 접기/펼치기 섹션 ──
const CollapsibleSection = ({
  title,
  defaultOpen = true,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) => {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <View>
      <Pressable
        onPress={() => {
          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
          setOpen((v) => !v);
        }}
        style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: open ? 10 : 0 }}
      >
        <Text style={{ fontSize: 16, fontWeight: "800", color: "#1f2937" }}>{title}</Text>
        <View style={{ flex: 1, height: 1.5, backgroundColor: "#e5e7eb", borderRadius: 1 }} />
        <Text style={{ fontSize: 12, color: "#9ca3af" }}>{open ? "접기 ▲" : "펼치기 ▼"}</Text>
      </Pressable>
      {open && children}
    </View>
  );
};

// ── AI 가이드 - 진입 즉시 프리패치 + 캐시 히트 시 즉시 표시 ──
const StreamingAiGuide = ({
  recipeId,
  breedId,
  hasDbSteps,
}: {
  recipeId: string;
  breedId?: string;
  hasDbSteps: boolean;
}) => {
  const [expanded, setExpanded] = useState(!hasDbSteps);
  const [streamText, setStreamText] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [prefetchDone, setPrefetchDone] = useState(false);

  const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";
  const API_BASE = BASE_URL.replace(/\/api\/v1$/, "");
  const url = `${API_BASE}/api/v1/recipes/${recipeId}/stream${breedId ? `?breed_id=${breedId}` : ""}`;

  // 페이지 진입 즉시 프리패치 (expandable 전에 미리 fetch 시작)
  useEffect(() => {
    let cancelled = false;
    setStreaming(true);

    const run = async () => {
      const t0 = Date.now();
      try {
        const res = await fetch(url, {
          headers: { "ngrok-skip-browser-warning": "true" },
        });
        const contentType = res.headers.get("content-type") || "";

        // 캐시 히트: JSON 즉시 반환
        if (contentType.includes("application/json")) {
          const data = await res.json();
          if (!cancelled) {
            console.log(`[TIMING] cache hit: ${Date.now() - t0}ms`);
            setStreamText(data.summary || "");
            setStreaming(false);
            setPrefetchDone(true);
          }
          return;
        }

        // SSE 스트리밍: 이벤트 경계(\n\n) 기준 올바른 파싱
        const reader = res.body?.getReader();
        const decoder = new TextDecoder();
        if (!reader) return;

        let sseBuffer = "";
        let firstToken = true;
        while (true) {
          const { done, value } = await reader.read();
          if (done || cancelled) break;
          sseBuffer += decoder.decode(value, { stream: true });

          // SSE 이벤트는 \n\n 으로 구분
          const events = sseBuffer.split("\n\n");
          sseBuffer = events.pop() ?? "";

          for (const event of events) {
            const line = event.trim();
            if (!line.startsWith("data: ")) continue;
            const token = line.slice(6);
            if (token === "[DONE]") break;
            if (firstToken) {
              console.log(`[TIMING] first token: ${Date.now() - t0}ms`);
              firstToken = false;
            }
            setStreamText((prev) => prev + token.replace(/\\n/g, "\n"));
          }
        }
      } catch (e) {
        if (!cancelled) setStreamText("AI 요약을 불러오지 못했습니다.");
      } finally {
        if (!cancelled) {
          setStreaming(false);
          setPrefetchDone(true);
          console.log(`[TIMING] prefetch total: ${Date.now() - t0}ms`);
        }
      }
    };

    run();
    return () => { cancelled = true; };
  }, [url]);

  const handleToggle = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded((v) => !v);
  };

  const label = hasDbSteps ? "💡 AI 추천 이유" : "🍳 AI 레시피 가이드";

  return (
    <View style={{ backgroundColor: "#eef1ff", borderRadius: 16, overflow: "hidden" }}>
      <Pressable
        onPress={handleToggle}
        style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 14 }}
      >
        <Text style={{ fontSize: 13, fontWeight: "700", color: "#4361ee" }}>{label}</Text>
        <Text style={{ fontSize: 12, color: "#6b7280" }}>{expanded ? "접기 ▲" : "펼치기 ▼"}</Text>
      </Pressable>
      {/* 프리패치 진행 중 헤더에 작은 스피너 표시 */}
      {streaming && !expanded && streamText === "" && (
        <View style={{ paddingHorizontal: 16, paddingBottom: 8, alignItems: "flex-end" }}>
          <Text style={{ fontSize: 10, color: "#c7d2fe" }}>🤖 준비 중...</Text>
        </View>
      )}
      {expanded && (
        <View style={{ paddingHorizontal: 16, paddingBottom: 16 }}>
          {streaming && streamText === "" && (
            <Text style={{ fontSize: 13, color: "#9ca3af", textAlign: "center", paddingVertical: 12 }}>
              🤖 AI 분석 중...
            </Text>
          )}
          {streamText ? (
            <View>
              <MarkdownRenderer content={
                hasDbSteps ? extractReasonOnly(streamText) : streamText
              } />
              {streaming && (
                <Text style={{ fontSize: 12, color: "#9ca3af", marginTop: 4 }}>▋</Text>
              )}
            </View>
          ) : null}
        </View>
      )}
    </View>
  );
};

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

  if (loading) return <SafeAreaView style={{ flex: 1, backgroundColor: "#fff" }}><LoadingSpinner /></SafeAreaView>;

  if (error) return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#fff", padding: 24, justifyContent: "center" }}>
      <ErrorState message={error} />
      <Pressable style={{ marginTop: 16, backgroundColor: "#f3f4f6", borderRadius: 14, paddingVertical: 14 }} onPress={() => navigation.goBack()}>
        <Text style={{ textAlign: "center", fontWeight: "600", color: "#6b7280" }}>뒤로가기</Text>
      </Pressable>
    </SafeAreaView>
  );

  if (!recipe) return null;

  // ✅ 재료 중복 제거 (이름 기준)
  const uniqueIngredients = recipe.ingredients.filter(
    (ing, idx, self) => self.findIndex((i) => i.name === ing.name) === idx
  ).sort((a, b) => a.sort_order - b.sort_order);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#fff" }}>
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingVertical: 20, gap: 20, paddingBottom: 24 }}
        showsVerticalScrollIndicator={false}
      >
        {/* ① 제목 + 유전병 태그 */}
        <View style={{ gap: 8, alignItems: "center" }}>
          <Text style={{ fontSize: 22, fontWeight: "800", color: "#1f2937", textAlign: "center" }}>
            {recipe.title}
          </Text>
        </View>

        {/* ② 메타 정보 */}
        <View style={{ flexDirection: "row", gap: 8 }}>
          <MetaItem icon="⏱" label="조리시간" value={recipe.cook_time_min != null ? `${recipe.cook_time_min}분` : "—"} />
          <MetaItem icon="🔥" label="칼로리" value={recipe.calories_per_serving != null ? `${recipe.calories_per_serving}kcal` : "—"} />
          <MetaItem icon="📊" label="난이도" value={difficultyLabel(recipe.difficulty)} />
          <MetaItem icon="🍽" label="인분" value={`${recipe.servings}인분`} />
        </View>

        {/* ③ 재료 (접기/펼치기, 중복 제거) */}
        {uniqueIngredients.length > 0 && (
          <CollapsibleSection title="재료" defaultOpen={true}>
            <View style={{ gap: 6 }}>
              {uniqueIngredients.map((ing, i) => (
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
                  <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: "#4361ee", marginRight: 12, flexShrink: 0 }} />
                  <Text style={{ flex: 1, fontSize: 14, fontWeight: "600", color: "#1f2937" }}>{ing.name}</Text>
                  {ing.amount && (
                    <View style={{ backgroundColor: "#eef1ff", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 }}>
                      <Text style={{ fontSize: 13, fontWeight: "700", color: "#4361ee" }}>{ing.amount}</Text>
                    </View>
                  )}
                </View>
              ))}
            </View>
          </CollapsibleSection>
        )}

        {/* ④ 조리 순서 (접기/펼치기) */}
        {recipe.steps.length > 0 && (
          <CollapsibleSection title="조리 순서" defaultOpen={true}>
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
                    <View style={{
                      width: 28, height: 28, borderRadius: 14,
                      backgroundColor: "#4361ee",
                      alignItems: "center", justifyContent: "center",
                      flexShrink: 0, marginTop: 1,
                    }}>
                      <Text style={{ fontSize: 12, fontWeight: "800", color: "#fff" }}>{step.step_number}</Text>
                    </View>
                    <Text style={{ flex: 1, fontSize: 14, color: "#374151", lineHeight: 22 }}>
                      {step.instruction}
                    </Text>
                  </View>
                ))}
            </View>
          </CollapsibleSection>
        )}

        {/* ⑤ AI 가이드 - 스트리밍 */}
        <StreamingAiGuide
          recipeId={recipeId}
          breedId={breedId}
          hasDbSteps={recipe.steps.length > 0}
        />
      </ScrollView>

      {/* ── 하단 sticky 버튼 ── */}
      <View style={{
        paddingHorizontal: 20,
        paddingVertical: 12,
        paddingBottom: 20,
        gap: 8,
        backgroundColor: "#fff",
        borderTopWidth: 1,
        borderTopColor: "#f3f4f6",
      }}>
        <Pressable
          style={{ backgroundColor: "#f3f4f6", borderRadius: 14, paddingVertical: 13 }}
          onPress={() => navigation.goBack()}
        >
          <Text style={{ textAlign: "center", fontSize: 13, fontWeight: "600", color: "#6b7280" }}>뒤로가기</Text>
        </Pressable>
        <Pressable
          style={{ backgroundColor: "#f3f4f6", borderRadius: 14, paddingVertical: 13 }}
          onPress={() => navigation.reset({ index: 0, routes: [{ name: "Upload" }] })}
        >
          <Text style={{ textAlign: "center", fontSize: 13, fontWeight: "600", color: "#6b7280" }}>다른 강아지 분석하기</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
};

export default RecipeDetailScreen;
