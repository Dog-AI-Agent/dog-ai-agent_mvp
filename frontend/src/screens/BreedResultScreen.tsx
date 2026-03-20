// ============================================================
// S3 — 품종 결과
// - 유전병 높음/중간 섹션별 접기/펼치기
// - 맞춤추천보기 + 다른강아지분석하기 하단 sticky
// - AI챗봇은 FloatingChatButton으로 분리
// ============================================================
import { useEffect, useState } from "react";
import { View, Text, Image, ScrollView, Pressable, LayoutAnimation, Platform, UIManager } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/RootStack";
import { getBreed } from "../api/breeds";
import LoadingSpinner from "../components/LoadingSpinner";
import EmptyState from "../components/EmptyState";
import DonutChart from "../components/DonutChart";
import RiskBadge from "../components/RiskBadge";
import UserHeader from "../components/UserHeader";
import { useBreed } from "../context/BreedContext";
import type { BreedDetailResponse, DiseaseInBreed } from "../types";

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type Props = NativeStackScreenProps<RootStackParamList, "BreedResult">;

const InfoCard = ({ label, value }: { label: string; value: string }) => (
  <View className="flex-1 min-w-[45%] items-center rounded-xl bg-card px-3 py-3">
    <Text className="text-xs text-muted">{label}</Text>
    <Text className="mt-1 text-center text-sm font-semibold text-gray-800">{value}</Text>
  </View>
);

// 유전병 섹션 (접기/펼치기)
const DiseaseSection = ({
  title,
  diseases,
  color,
  defaultOpen,
}: {
  title: string;
  diseases: DiseaseInBreed[];
  color: string;
  defaultOpen: boolean;
}) => {
  const [open, setOpen] = useState(defaultOpen);

  if (diseases.length === 0) return null;

  const toggle = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpen((v) => !v);
  };

  return (
    <View style={{ marginBottom: 8 }}>
      {/* 섹션 헤더 */}
      <Pressable
        onPress={toggle}
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

      {/* 질환 목록 */}
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
              <Text style={{ flex: 1, fontSize: 13, fontWeight: "500", color: "#1f2937" }}>
                {d.name_ko}
              </Text>
              <RiskBadge level={d.risk_level} />
            </View>
          ))}
        </View>
      )}
    </View>
  );
};

const BreedResultScreen = ({ navigation, route }: Props) => {
  const { result, imageUri, gradcamUri } = route.params;
  const [breedDetail, setBreedDetail] = useState<BreedDetailResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const { setBreed } = useBreed();

  useEffect(() => {
    if (!result.breed_id) return;
    // FloatingChatButton용 전역 breed 설정
    setBreed(result.breed_id, result.breed_name_ko);

    setLoading(true);
    getBreed(result.breed_id)
      .then(setBreedDetail)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [result.breed_id]);

  const isPurebred = result.confidence >= 0.5;
  const confidencePct = (result.confidence * 100).toFixed(1);

  // 유전병 위험 단계별 분류
  const highRisk = breedDetail?.diseases.filter((d) => d.risk_level === "high") ?? [];
  const mediumRisk = breedDetail?.diseases.filter((d) => d.risk_level === "medium") ?? [];
  const lowRisk = breedDetail?.diseases.filter((d) => d.risk_level === "low") ?? [];

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: "#fff" }}>
        <LoadingSpinner />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#fff" }}>
      {/* 스크롤 영역 */}
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingVertical: 16, gap: 16, paddingBottom: 24 }}
        showsVerticalScrollIndicator={false}
      >
        <Text style={{ textAlign: "center", fontSize: 22, fontWeight: "800", color: "#1f2937" }}>
          품종 분석 결과
        </Text>

        {/* 상단 썸네일 — GradCAM 우선, 없으면 원본 */}
        {(gradcamUri || imageUri) && (
          <Image
            source={{ uri: gradcamUri ?? imageUri }}
            className="w-full rounded-2xl"
            style={{ width: "100%", borderRadius: 16, aspectRatio: 4 / 3 }}
            resizeMode="contain"
          />
        )}

        {/* 품종 정보 카드 */}
        <View style={{ backgroundColor: "#f8f9fa", borderRadius: 16, padding: 18, gap: 12 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 20, fontWeight: "800", color: "#1f2937" }}>
                {result.breed_name_ko}
              </Text>
              <Text style={{ fontSize: 13, color: "#6b7280" }}>{result.breed_name_en}</Text>
            </View>
            <View style={{ alignItems: "flex-end", gap: 4 }}>
              <Text style={{ fontSize: 18, fontWeight: "700", color: "#4361ee" }}>{confidencePct}%</Text>
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
            <View style={{ backgroundColor: "#fef9c3", borderRadius: 10, padding: 10 }}>
              <Text style={{ fontSize: 12, color: "#a16207" }}>
                신뢰도가 기준값 미만이어서 믹스견으로 추정됩니다. Top-1 품종 기준으로 정보를 제공합니다.
              </Text>
            </View>
          )}

          {result.top_k_predictions.length > 0 && (
            <DonutChart predictions={result.top_k_predictions} />
          )}
        </View>

        {/* 기본 정보 2×2 */}
        {breedDetail && (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            <InfoCard
              label="크기"
              value={
                breedDetail.size_category
                  ? ({ small: "소형", medium: "중형", large: "대형", giant: "초대형" } as Record<string, string>)[breedDetail.size_category] || breedDetail.size_category
                  : "—"
              }
            />
            <InfoCard
              label="평균 체중"
              value={breedDetail.avg_weight_kg ? `${breedDetail.avg_weight_kg}kg` : "—"}
            />
            <InfoCard
              label="평균 수명"
              value={breedDetail.avg_life_span_years ? `${breedDetail.avg_life_span_years}년` : "—"}
            />
            <InfoCard
              label="성격"
              value={breedDetail.temperament || "—"}
            />
          </View>
        )}

        {/* 유전병 위험 — 단계별 접기/펼치기 */}
        {breedDetail && breedDetail.diseases.length > 0 && (
          <View style={{ gap: 4 }}>
            <Text style={{ fontSize: 16, fontWeight: "800", color: "#1f2937", marginBottom: 6 }}>
              유전병 위험
            </Text>
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
              defaultOpen={false}
            />
            <DiseaseSection
              title="낮음"
              diseases={lowRisk}
              color="#10b981"
              defaultOpen={false}
            />
          </View>
        )}

        {breedDetail && breedDetail.diseases.length === 0 && (
          <EmptyState message="이 품종에 대한 유전병 데이터가 아직 없습니다." />
        )}
      </ScrollView>

      {/* 하단 sticky 버튼 */}
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
            <Text style={{ textAlign: "center", fontSize: 15, fontWeight: "700", color: "#fff" }}>
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
          <Text style={{ textAlign: "center", fontSize: 13, fontWeight: "600", color: "#6b7280" }}>
            다른 강아지 분석하기
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
};

export default BreedResultScreen;
