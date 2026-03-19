// ============================================================
// S1 — 업로드 (Landing + Upload 통합)
// 스토리보드: 서비스 랜딩 겸 사진 업로드 화면
// ============================================================
import { useState, useCallback } from "react";
import { View, Text, Pressable, Image, Alert, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/RootStack";
import { recognizeBreed } from "../api/ai";
import LoadingSpinner from "../components/LoadingSpinner";
import ErrorState from "../components/ErrorState";
import Disclaimer from "../components/Disclaimer";

type Props = NativeStackScreenProps<RootStackParamList, "Upload">;

const UploadScreen = ({ navigation }: Props) => {
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pickImage = useCallback(async (source: "gallery" | "camera") => {
    const launchFn =
      source === "gallery"
        ? ImagePicker.launchImageLibraryAsync
        : ImagePicker.launchCameraAsync;

    if (source === "camera") {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("권한 필요", "카메라 권한을 허용해주세요.");
        return;
      }
    }

    const result = await launchFn({
      mediaTypes: ["images"],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setImageUri(result.assets[0].uri);
      setError(null);
    }
  }, []);

  const handleAnalyze = async () => {
    if (!imageUri) return;
    setLoading(true);
    setError(null);
    try {
      const result = await recognizeBreed(imageUri);
      navigation.navigate("BreedResult", { result, imageUri });
    } catch (err: unknown) {
      const e = err as { status?: number; detail?: string; message?: string };
      if (e.status === 422) {
        setError(
          e.detail?.includes("BREED_MAPPING")
            ? "품종을 확인할 수 없습니다. 다른 사진을 시도해주세요."
            : "사진에서 강아지를 인식할 수 없습니다. 다른 사진을 시도해주세요."
        );
      } else if (e.status === 400) {
        setError("지원하지 않는 파일 형식입니다. JPEG 또는 PNG를 업로드해주세요.");
      } else if (e.status === 413) {
        setError("파일 크기가 너무 큽니다. 10MB 이하 사진을 선택해주세요.");
      } else if (e.status === 429) {
        setError("요청이 너무 많습니다. 잠시 후 다시 시도해주세요.");
      } else {
        setError(e.detail || e.message || "분석 중 오류가 발생했습니다. 다시 시도해주세요.");
      }
    } finally {
      setLoading(false);
    }
  };

  // ── S2 로딩 상태 ──
  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-white">
        <LoadingSpinner />
      </SafeAreaView>
    );
  }

  // ── S1 메인 ──
  return (
    <SafeAreaView className="flex-1 bg-white">
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 24, paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
      >
        {/* 헤더 + 소개 */}
        <View className="mt-10 items-center gap-2">
          <Text className="text-4xl font-bold text-primary">🐶 댕슐랭</Text>
          <Text className="text-center text-base text-gray-700">
            사진 한 장으로 우리 강아지 건강 체크
          </Text>
        </View>

        {/* 업로드 영역 */}
        <View className="mt-8">
          {imageUri ? (
            // ── file_selected 상태: 미리보기 + 분석하기 ──
            <View className="gap-4">
              <Pressable
                className="overflow-hidden rounded-2xl"
                onPress={() => setImageUri(null)}
              >
                <Image
                  source={{ uri: imageUri }}
                  className="h-72 w-full rounded-2xl"
                  resizeMode="cover"
                />
                <View className="absolute bottom-3 right-3 rounded-full bg-black/50 px-3 py-1">
                  <Text className="text-xs text-white">탭하여 재선택</Text>
                </View>
              </Pressable>

              {error && (
                <ErrorState
                  message={error}
                  onRetry={() => {
                    setError(null);
                    setImageUri(null);
                  }}
                />
              )}

              <Pressable
                className="rounded-2xl bg-primary px-6 py-4 active:opacity-80"
                onPress={handleAnalyze}
              >
                <Text className="text-center text-lg font-bold text-white">
                  분석하기
                </Text>
              </Pressable>
            </View>
          ) : (
            // ── idle 상태: 업로드 버튼들 ──
            <View className="gap-3">
              <Pressable
                className="items-center rounded-2xl border-2 border-dashed border-primary/40 bg-primary-light px-6 py-14 active:opacity-80"
                onPress={() => pickImage("gallery")}
              >
                <Text className="text-4xl">🖼️</Text>
                <Text className="mt-3 text-base font-semibold text-primary">
                  갤러리에서 선택
                </Text>
                <Text className="mt-1 text-xs text-muted">
                  JPEG, PNG · 최대 10MB · 최소 224×224px
                </Text>
              </Pressable>

              <Pressable
                className="items-center rounded-2xl border-2 border-dashed border-secondary/40 bg-purple-50 px-6 py-10 active:opacity-80"
                onPress={() => pickImage("camera")}
              >
                <Text className="text-3xl">📷</Text>
                <Text className="mt-2 text-base font-semibold text-secondary">
                  카메라로 촬영
                </Text>
              </Pressable>

              {error && (
                <ErrorState
                  message={error}
                  onRetry={() => setError(null)}
                />
              )}
            </View>
          )}
        </View>

        {/* 사용 안내 (idle 상태에서만) */}
        {!imageUri && (
          <View className="mt-8 gap-3">
            {[
              { icon: "📸", title: "사진 업로드", desc: "강아지 사진을 올려주세요" },
              { icon: "🔍", title: "AI 품종 분석", desc: "품종과 유전병 위험을 분석합니다" },
              { icon: "🍲", title: "맞춤 레시피", desc: "건강에 좋은 집밥을 추천해요" },
            ].map((s, i) => (
              <View
                key={i}
                className="flex-row items-center gap-4 rounded-xl bg-card px-4 py-3"
              >
                <Text className="text-2xl">{s.icon}</Text>
                <View className="flex-1">
                  <Text className="text-sm font-semibold text-gray-800">{s.title}</Text>
                  <Text className="text-xs text-muted">{s.desc}</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* 하단 디스클레이머 + 크레딧 */}
        <View className="mt-auto pt-6">
          <Disclaimer />
          <Text className="mt-2 text-center text-xs text-gray-400">
            강정민 · 최동원 · 송진우 · 이민혜 · 장승우 · 김재현
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default UploadScreen;
