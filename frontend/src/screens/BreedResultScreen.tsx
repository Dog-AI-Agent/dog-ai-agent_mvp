import { useEffect, useState } from "react";
import { View, Text, Image, ScrollView, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/RootStack";
import { getBreed } from "../api/breeds";
import LoadingSpinner from "../components/LoadingSpinner";
import EmptyState from "../components/EmptyState";
import DonutChart from "../components/DonutChart";
import type { BreedDetailResponse } from "../types";

type Props = NativeStackScreenProps<RootStackParamList, "BreedResult">;

const riskColor: Record<string, string> = {
  high: "bg-red-100 text-red-700",
  medium: "bg-yellow-100 text-yellow-700",
  low: "bg-green-100 text-green-700",
};

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

  const isMix = result.confidence < 0.5;
  const top3 = result.top_k_predictions.slice(0, 3);
  const displayName = isMix ? "믹스견 (추정)" : result.breed_name_ko;
  const displaySub = isMix
    ? top3.map((p) => p.breed).join(" + ")
    : result.breed_name_en;

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-white">
        <LoadingSpinner />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-white">
      <ScrollView contentContainerClassName="px-6 py-4 gap-4">
        <Text className="text-center text-2xl font-bold text-gray-800">
          품종 분석 결과
        </Text>

        {imageUri && (
          <Image
            source={{ uri: imageUri }}
            className="h-56 w-full rounded-2xl"
            resizeMode="cover"
          />
        )}

        <View className="rounded-2xl bg-card px-5 py-5 gap-2">
          <Text className="text-xl font-bold text-gray-900">
            {displayName}
            <Text className="text-base font-normal text-muted">
              {" "}({displaySub})
            </Text>
          </Text>

          {isMix && (
            <View className="rounded-lg bg-yellow-50 px-3 py-2">
              <Text className="text-xs text-yellow-700">
                믹스견 — Top 1 신뢰도가 50% 미만이어서 혼합견으로 판별되었습니다.
              </Text>
            </View>
          )}

          {result.top_k_predictions.length > 0 && (
            <DonutChart predictions={result.top_k_predictions} />
          )}
        </View>

        {breedDetail && breedDetail.diseases.length > 0 && (
          <View className="gap-2">
            <Text className="text-lg font-bold text-gray-800">유전병 위험</Text>
            {breedDetail.diseases.map((d) => (
              <View
                key={d.disease_id}
                className="flex-row items-center justify-between rounded-xl bg-card px-4 py-3"
              >
                <Text className="text-sm font-medium text-gray-800">
                  {d.name_ko}
                </Text>
                <View
                  className={`rounded-full px-3 py-1 ${riskColor[d.risk_level] || "bg-gray-100 text-gray-600"}`}
                >
                  <Text className="text-xs font-semibold">{d.risk_level}</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {breedDetail && breedDetail.diseases.length === 0 && (
          <EmptyState message="이 품종에 대한 유전병 데이터가 아직 없습니다." />
        )}

        <View className="mt-2 gap-3">
          {result.breed_id && (
            <Pressable
              className="rounded-xl bg-primary px-6 py-4 active:opacity-80"
              onPress={() =>
                navigation.navigate("Recommendation", {
                  breedId: result.breed_id!,
                  breedNameKo: displayName,
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

export default BreedResultScreen;
