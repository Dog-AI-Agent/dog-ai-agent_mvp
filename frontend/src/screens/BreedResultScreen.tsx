// ============================================================
// S3 — 품종 결과
// - 유전병 높음/중간 섹션별 접기/펼치기
// - 믹스견: 위험도 한 단계 하향 (높음→중간, 중간→낮음, 낮음→낮음)
// - 유전병 정렬: Top-1 품종 원래 위험도 기준 내림차순
// - 맞춤추천보기 + 다른강아지분석하기 하단 sticky
// ============================================================
import { useEffect, useState } from "react";
import {
  View,
  Text,
  Image,
  ScrollView,
  Pressable,
  ActivityIndicator,
  LayoutAnimation,
  Platform,
  UIManager,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/RootStack";
import { getBreed } from "../api/breeds";
import {
  updateMyDog,
  saveAnalysis,
  createMyDog,
  generateIllustration,
} from "../api/users";
import LoadingSpinner from "../components/LoadingSpinner";
import EmptyState from "../components/EmptyState";
import DonutChart from "../components/DonutChart";
import RiskBadge from "../components/RiskBadge";
import UserHeader from "../components/UserHeader";
import { useBreed } from "../context/BreedContext";
import type { BreedDetailResponse, DiseaseInBreed } from "../types";

if (
  Platform.OS === "android" &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type Props = NativeStackScreenProps<RootStackParamList, "BreedResult">;

// 표시용 위험도가 추가된 질병 타입
type DisplayDisease = DiseaseInBreed & { display_risk: string };

// 위험도 한 단계 하향 (믹스견 전용)
const downgradeRisk = (level: string): string => {
  if (level === "high") return "medium";
  if (level === "medium") return "low";
  return "low";
};

// 위험도 정렬 순서 (높음 → 중간 → 낮음)
const RISK_ORDER: Record<string, number> = { high: 0, medium: 1, low: 2 };

const InfoCard = ({ label, value }: { label: string; value: string }) => (
  <View className="flex-1 min-w-[45%] items-center rounded-xl bg-card px-3 py-3">
    <Text className="text-xs text-muted">{label}</Text>
    <Text className="mt-1 text-center text-sm font-semibold text-gray-800">
      {value}
    </Text>
  </View>
);

const DiseaseSection = ({
  title,
  diseases,
  color,
  defaultOpen,
}: {
  title: string;
  diseases: DisplayDisease[];
  color: string;
  defaultOpen: boolean;
}) => {
  const [open, setOpen] = useState(defaultOpen);
  if (diseases.length === 0) return null;

  return (
    <View style={{ marginBottom: 8 }}>
      <Pressable
        onPress={() => {
          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
          setOpen((v) => !v);
        }}
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          backgroundColor: color + "18",
          borderRadius: 12,
          paddingHorizontal: 14,
          paddingVertical: 11,
          borderLeftWidth: 4,
          borderLeftColor: color,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Text style={{ fontSize: 13, fontWeight: "700", color }}>
            {title}
          </Text>
          <View
            style={{
              backgroundColor: color,
              borderRadius: 20,
              paddingHorizontal: 8,
              paddingVertical: 2,
            }}
          >
            <Text style={{ fontSize: 11, fontWeight: "700", color: "#fff" }}>
              {diseases.length}개
            </Text>
          </View>
        </View>
        <Text style={{ fontSize: 12, color: "#6b7280" }}>
          {open ? "접기 ▲" : "펼치기 ▼"}
        </Text>
      </Pressable>

      {open && (
        <View style={{ gap: 6, marginTop: 6 }}>
          {diseases.map((d) => (
            <View
              key={d.disease_id}
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                backgroundColor: "#f8f9fa",
                borderRadius: 10,
                paddingHorizontal: 14,
                paddingVertical: 11,
              }}
            >
              <Text
                style={{
                  flex: 1,
                  fontSize: 13,
                  fontWeight: "500",
                  color: "#1f2937",
                }}
              >
                {d.name_ko}
              </Text>
              {/* 표시 위험도(하향 적용) 기준으로 뱃지 표시 */}
              <RiskBadge level={d.display_risk} />
            </View>
          ))}
        </View>
      )}
    </View>
  );
};

const BreedResultScreen = ({ navigation, route }: Props) => {
  const {
    result,
    imageUri,
    gradcamUri,
    historyId,
    illustrationUrl: paramIllustrationUrl,
  } = route.params;
  const isFromHistory = !!historyId;
  const [breedDetail, setBreedDetail] = useState<BreedDetailResponse | null>(
    null,
  );
  const [loading, setLoading] = useState(false);
  const [analysisId, setAnalysisId] = useState<string | null>(
    historyId ?? null,
  );
  const [illustrationUrl, setIllustrationUrl] = useState<string | null>(
    paramIllustrationUrl ?? null,
  );
  const [illustrationLoading, setIllustrationLoading] = useState(false);
  const { setBreed } = useBreed();

  useEffect(() => {
    if (!result.breed_id) return;

    setBreed(result.breed_id, result.breed_name_ko);

    if (!isFromHistory) {
      // 새 분석일 때만 프로필 저장 + 히스토리 저장
      updateMyDog({ breed_id: result.breed_id }).catch(() => {
        createMyDog({ name: "내 강아지", breed_id: result.breed_id! }).catch(
          () => {},
        );
      });

      saveAnalysis({
        breed_id: result.breed_id,
        breed_name_ko: result.breed_name_ko,
        breed_name_en: result.breed_name_en,
        confidence: result.confidence,
        is_mixed_breed: result.confidence < 0.5,
        imageUri: imageUri,
      })
        .then((saved) => setAnalysisId(saved.history_id))
        .catch(() => {});
    }

    setLoading(true);
    getBreed(result.breed_id)
      .then(setBreedDetail)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [result.breed_id]);

  const isPurebred = result.confidence >= 0.5;
  const confidencePct = (result.confidence * 100).toFixed(1);

  const handleGenerateIllustration = async () => {
    if (!analysisId || illustrationLoading) return;
    setIllustrationLoading(true);
    try {
      const res = await generateIllustration(analysisId);
      setIllustrationUrl(res.illustration_url);
    } catch (e) {
      console.warn("일러스트 생성 실패:", e);
    } finally {
      setIllustrationLoading(false);
    }
  };

  // ── 유전병 목록 처리 ──
  // 1) Top-1 품종 원래 위험도 기준 내림차순 정렬
  const sortedDiseases: DisplayDisease[] = [...(breedDetail?.diseases ?? [])]
    .sort(
      (a, b) =>
        (RISK_ORDER[a.risk_level] ?? 3) - (RISK_ORDER[b.risk_level] ?? 3),
    )
    .map((d) => ({
      ...d,
      // 2) 믹스견이면 위험도 한 단계 하향, 순종은 그대로
      display_risk: isPurebred ? d.risk_level : downgradeRisk(d.risk_level),
    }));

  const highRisk = sortedDiseases.filter((d) => d.display_risk === "high");
  const mediumRisk = sortedDiseases.filter((d) => d.display_risk === "medium");
  const lowRisk = sortedDiseases.filter((d) => d.display_risk === "low");

  const canGoBack = navigation.canGoBack();

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: "#fff" }}>
        <UserHeader />
        {canGoBack && (
          <Pressable
            onPress={() => navigation.goBack()}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 4,
              paddingHorizontal: 20,
              paddingVertical: 10,
            }}
          >
            <Text style={{ fontSize: 20, color: "#6b7280" }}>←</Text>
            <Text style={{ fontSize: 14, color: "#6b7280" }}>뒤로가기</Text>
          </Pressable>
        )}
        <LoadingSpinner />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#fff" }}>
      <UserHeader />
      {canGoBack && (
        <Pressable
          onPress={() => navigation.goBack()}
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 4,
            paddingHorizontal: 20,
            paddingVertical: 10,
            borderBottomWidth: 1,
            borderBottomColor: "#f3f4f6",
          }}
        >
          <Text style={{ fontSize: 20, color: "#6b7280" }}>←</Text>
          <Text style={{ fontSize: 14, color: "#6b7280" }}>뒤로가기</Text>
        </Pressable>
      )}
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
          품종 분석 결과
        </Text>

        {(gradcamUri || imageUri) && (
          <Image
            source={{ uri: gradcamUri ?? imageUri }}
            style={{ width: "100%", borderRadius: 16, aspectRatio: 1 }}
            resizeMode="cover"
          />
        )}

        <View
          style={{
            backgroundColor: "#f8f9fa",
            borderRadius: 16,
            padding: 18,
            gap: 12,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <View style={{ flex: 1 }}>
              <Text
                style={{ fontSize: 20, fontWeight: "800", color: "#1f2937" }}
              >
                {result.breed_name_ko}
              </Text>
              <Text style={{ fontSize: 13, color: "#6b7280" }}>
                {result.breed_name_en}
              </Text>
            </View>
            <View style={{ alignItems: "flex-end", gap: 4 }}>
              <Text
                style={{ fontSize: 18, fontWeight: "700", color: "#4361ee" }}
              >
                {confidencePct}%
              </Text>
              <View
                style={{
                  borderRadius: 20,
                  backgroundColor: isPurebred ? "#dbeafe" : "#fef9c3",
                  paddingHorizontal: 10,
                  paddingVertical: 3,
                }}
              >
                <Text
                  style={{
                    fontSize: 11,
                    fontWeight: "700",
                    color: isPurebred ? "#1d4ed8" : "#a16207",
                  }}
                >
                  {isPurebred ? "순종" : "믹스견 추정"}
                </Text>
              </View>
            </View>
          </View>

          {!isPurebred && (
            <View
              style={{
                backgroundColor: "#fef9c3",
                borderRadius: 10,
                padding: 10,
              }}
            >
              <Text style={{ fontSize: 12, color: "#a16207" }}>
                신뢰도가 기준값 미만이어서 믹스견으로 추정됩니다. Top-1 품종
                기준으로 정보를 제공합니다.
              </Text>
            </View>
          )}

          {result.top_k_predictions.length > 0 && (
            <DonutChart predictions={result.top_k_predictions} />
          )}
        </View>

        {breedDetail && (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            <InfoCard
              label="크기"
              value={
                breedDetail.size_category
                  ? (
                      {
                        small: "소형",
                        medium: "중형",
                        large: "대형",
                        giant: "초대형",
                      } as Record<string, string>
                    )[breedDetail.size_category] || breedDetail.size_category
                  : "—"
              }
            />
            <InfoCard
              label="평균 체중"
              value={
                breedDetail.avg_weight_kg
                  ? `${breedDetail.avg_weight_kg}kg`
                  : "—"
              }
            />
            <InfoCard
              label="평균 수명"
              value={
                breedDetail.avg_life_span_years
                  ? `${breedDetail.avg_life_span_years}년`
                  : "—"
              }
            />
            <InfoCard label="성격" value={breedDetail.temperament || "—"} />
          </View>
        )}

        {/* ── 일러스트 생성 섹션 ── */}
        {analysisId && result.breed_name_en && (
          <View
            style={{
              backgroundColor: "#faf5ff",
              borderRadius: 16,
              padding: 18,
              alignItems: "center",
              gap: 12,
            }}
          >
            <Text style={{ fontSize: 15, fontWeight: "700", color: "#7c3aed" }}>
              AI 일러스트
            </Text>
            {illustrationUrl ? (
              <Image
                source={{ uri: illustrationUrl }}
                style={{
                  width: "100%",
                  aspectRatio: 1,
                  borderRadius: 14,
                }}
                resizeMode="cover"
              />
            ) : illustrationLoading ? (
              <View
                style={{ alignItems: "center", gap: 8, paddingVertical: 20 }}
              >
                <ActivityIndicator size="large" color="#7c3aed" />
                <Text style={{ fontSize: 13, color: "#7c3aed" }}>
                  AI가 그리고 있어요... (15~30초)
                </Text>
              </View>
            ) : (
              <Pressable
                onPress={handleGenerateIllustration}
                style={{
                  backgroundColor: "#7c3aed",
                  borderRadius: 12,
                  paddingVertical: 12,
                  paddingHorizontal: 24,
                }}
              >
                <Text
                  style={{ fontSize: 14, fontWeight: "600", color: "#fff" }}
                >
                  귀여운 일러스트 생성하기
                </Text>
              </Pressable>
            )}
          </View>
        )}

        {breedDetail && sortedDiseases.length > 0 && (
          <View style={{ gap: 4 }}>
            <Text
              style={{
                fontSize: 16,
                fontWeight: "800",
                color: "#1f2937",
                marginBottom: 6,
              }}
            >
              유전병 위험
            </Text>
            {!isPurebred && (
              <View
                style={{
                  backgroundColor: "#f0f9ff",
                  borderRadius: 10,
                  padding: 10,
                  marginBottom: 4,
                }}
              >
                <Text style={{ fontSize: 12, color: "#0369a1" }}>
                  믹스견 추정으로 유전병 위험도가 한 단계 낮게 조정되었습니다.
                </Text>
              </View>
            )}
            <DiseaseSection
              title="높음"
              diseases={highRisk}
              color="#dc2626"
              defaultOpen={true}
            />
            <DiseaseSection
              title="중간"
              diseases={mediumRisk}
              color="#f59e0b"
              defaultOpen={!isPurebred}
            />
            <DiseaseSection
              title="낮음"
              diseases={lowRisk}
              color="#10b981"
              defaultOpen={false}
            />
          </View>
        )}

        {breedDetail && sortedDiseases.length === 0 && (
          <EmptyState message="이 품종에 대한 유전병 데이터가 아직 없습니다." />
        )}
      </ScrollView>

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
        {result.breed_id && (
          <Pressable
            style={{
              backgroundColor: "#4361ee",
              borderRadius: 14,
              paddingVertical: 14,
            }}
            onPress={() =>
              navigation.navigate("Recommendation", {
                breedId: result.breed_id!,
                breedNameKo: result.breed_name_ko,
                imageUri,
              })
            }
          >
            <Text
              style={{
                textAlign: "center",
                fontSize: 15,
                fontWeight: "700",
                color: "#fff",
              }}
            >
              맞춤 추천 보기
            </Text>
          </Pressable>
        )}
        <Pressable
          style={{
            backgroundColor: "#f3f4f6",
            borderRadius: 14,
            paddingVertical: 12,
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

export default BreedResultScreen;
