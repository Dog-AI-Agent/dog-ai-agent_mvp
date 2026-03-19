// ============================================================
// S3 — 품종 결과
// 스토리보드: 썸네일 + 품종명 + confidence + 순종/믹스견 뱃지
//            + 2×2 기본 정보 + 유전병 리스트 + CTA
// ============================================================
import { useEffect, useState } from "react";
import { View, Text, Image, ScrollView, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/RootStack";
import { getBreed } from "../api/breeds";
import LoadingSpinner from "../components/LoadingSpinner";
import EmptyState from "../components/EmptyState";
import DonutChart from "../components/DonutChart";
import RiskBadge from "../components/RiskBadge";
import type { BreedDetailResponse } from "../types";

type Props = NativeStackScreenProps<RootStackParamList, "BreedResult">;

const InfoCard = ({ label, value }: { label: string; value: string }) => (
  <View className="flex-1 min-w-[45%] items-center rounded-xl bg-card px-3 py-3">
    <Text className="text-xs text-muted">{label}</Text>
    <Text className="mt-1 text-center text-sm font-semibold text-gray-800">{value}</Text>
  </View>
);

const BreedResultScreen = ({ navigation, route }: Props) => {
  const { result, imageUri } = route.params;
  const [breedDetail, setBreedDetail] = useState<BreedDetailResponse | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!result.breed_id) return;
    setLoading(true);
    getBreed(result.breed_id)
      .then(setBreedDetail)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [result.breed_id]);

  const isPurebred = result.confidence >= 0.5;
  const confidencePct = (result.confidence * 100).toFixed(1);

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-white">
        <LoadingSpinner />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-white">
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 24, paddingVertical: 16, gap: 16 }}
        showsVerticalScrollIndicator={false}
      >
        {/* 헤더 */}
        <Text className="text-center text-2xl font-bold text-gray-800">
          품종 분석 결과
        </Text>

        {/* 상단 썸네일 */}
        {imageUri && (
          <Image
            source={{ uri: imageUri }}
            className="w-full rounded-2xl"
            style={{ aspectRatio: 4 / 3 }}
            resizeMode="contain"
          />
        )}

        {/* 품종 정보 + confidence + 순종/믹스견 */}
        <View className="rounded-2xl bg-card px-5 py-5 gap-3">
          <View className="flex-row items-center gap-3">
            <View className="flex-1">
              <Text className="text-xl font-bold text-gray-900">
                {result.breed_name_ko}
              </Text>
              <Text className="text-sm text-muted">{result.breed_name_en}</Text>
            </View>
            <View className="items-end gap-1">
              <Text className="text-lg font-bold text-primary">{confidencePct}%</Text>
              {isPurebred ? (
                <View className="rounded-full bg-blue-100 px-3 py-1">
                  <Text className="text-xs font-semibold text-blue-700">순종</Text>
                </View>
              ) : (
                <View className="rounded-full bg-yellow-100 px-3 py-1">
                  <Text className="text-xs font-semibold text-yellow-700">믹스견 추정</Text>
                </View>
              )}
            </View>
          </View>

          {!isPurebred && (
            <View className="rounded-lg bg-yellow-50 px-3 py-2">
              <Text className="text-xs text-yellow-700">
                신뢰도가 기준값 미만이어서 믹스견으로 추정됩니다. Top-1 품종 기준으로 정보를 제공합니다.
              </Text>
            </View>
          )}

          {/* 도넛 차트 */}
          {result.top_k_predictions.length > 0 && (
            <DonutChart predictions={result.top_k_predictions} />
          )}
        </View>

        {/* 기본 정보 카드 (2×2 그리드) — 스토리보드 S3 */}
        {breedDetail && (
          <View className="flex-row flex-wrap gap-2">
            <InfoCard
              label="크기"
              value={
                breedDetail.size_category
                  ? { small: "소형", medium: "중형", large: "대형", giant: "초대형" }[breedDetail.size_category] || breedDetail.size_category
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
            <InfoCard
              label="성격"
              value={breedDetail.temperament || "—"}
            />
          </View>
        )}

        {/* 유전병 리스트 — 스토리보드: 이름 + risk_level 뱃지 */}
        {breedDetail && breedDetail.diseases.length > 0 && (
          <View className="gap-2">
            <Text className="text-lg font-bold text-gray-800">유전병 위험</Text>
            {breedDetail.diseases.map((d) => (
              <View
                key={d.disease_id}
                className="flex-row items-center justify-between rounded-xl bg-card px-4 py-3"
              >
                <Text className="flex-1 text-sm font-medium text-gray-800">
                  {d.name_ko}
                </Text>
                <RiskBadge level={d.risk_level} />
              </View>
            ))}
          </View>
        )}

        {breedDetail && breedDetail.diseases.length === 0 && (
          <EmptyState message="이 품종에 대한 유전병 데이터가 아직 없습니다." />
        )}

        {/* CTA 버튼들 */}
        <View className="gap-3 pb-4">
          {result.breed_id && (
            <Pressable
              className="rounded-2xl bg-primary px-6 py-4 active:opacity-80"
              onPress={() =>
                navigation.navigate("Recommendation", {
                  breedId: result.breed_id!,
                  breedNameKo: result.breed_name_ko,
                  imageUri,
                })
              }
            >
              <Text className="text-center text-lg font-bold text-white">
                맞춤 추천 보기
              </Text>
            </Pressable>
          )}
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

export default BreedResultScreen;
