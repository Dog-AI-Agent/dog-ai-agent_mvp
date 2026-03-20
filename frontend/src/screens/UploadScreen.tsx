// ============================================================
// S1 — 업로드 (Landing + Upload 통합)
// ============================================================
import { useState, useCallback } from "react";
import {
  View,
  Text,
  Pressable,
  Image,
  Alert,
  ScrollView,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/RootStack";
import { recognizeBreed, fetchGradcam } from "../api/ai";
import LoadingSpinner from "../components/LoadingSpinner";
import ErrorState from "../components/ErrorState";
import Disclaimer from "../components/Disclaimer";
import UserHeader from "../components/UserHeader";

type Props = NativeStackScreenProps<RootStackParamList, "Upload">;

// 로고 이미지 (assets/logo.png)
const LOGO = require("../../assets/logo.png") as number;

const UploadScreen = ({ navigation }: Props) => {
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [imageSize, setImageSize] = useState<{
    width: number;
    height: number;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { width: screenWidth } = useWindowDimensions();
  const previewWidth = screenWidth - 48;

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
      const asset = result.assets[0];
      setImageUri(asset.uri);
      if (asset.width && asset.height) {
        setImageSize({ width: asset.width, height: asset.height });
      } else {
        setImageSize(null);
      }
      setError(null);
    }
  }, []);

  const handleAnalyze = async () => {
    if (!imageUri) return;
    setLoading(true);
    setError(null);
    try {
      const [result, gradcamUri] = await Promise.all([
        recognizeBreed(imageUri),
        fetchGradcam(imageUri).catch(() => undefined),
      ]);
      navigation.navigate("BreedResult", { result, imageUri, gradcamUri });
    } catch (err: unknown) {
      const e = err as { status?: number; detail?: string; message?: string };
      if (e.status === 422) {
        setError(
          e.detail?.includes("BREED_MAPPING")
            ? "품종을 확인할 수 없습니다. 다른 사진을 시도해주세요."
            : "사진에서 강아지를 인식할 수 없습니다. 다른 사진을 시도해주세요.",
        );
      } else if (e.status === 400) {
        setError(
          "지원하지 않는 파일 형식입니다. JPEG, PNG, WebP, BMP, GIF, HEIC 형식을 사용해주세요.",
        );
      } else if (e.status === 413) {
        setError("파일 크기가 너무 큽니다. 10MB 이하 사진을 선택해주세요.");
      } else if (e.status === 429) {
        setError("요청이 너무 많습니다. 잠시 후 다시 시도해주세요.");
      } else {
        setError(
          e.detail ||
            e.message ||
            "분석 중 오류가 발생했습니다. 다시 시도해주세요.",
        );
      }
    } finally {
      setLoading(false);
    }
  };

  // ── 로딩 상태 ──
  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: "#fff" }}>
        <LoadingSpinner />
      </SafeAreaView>
    );
  }

  // 미리보기 크기 계산 (최대 320×320, 비율 유지)
  const MAX_PREVIEW = 320;
  const baseWidth = Math.min(previewWidth * 0.75, MAX_PREVIEW);
  const rawHeight = imageSize
    ? Math.round(baseWidth * (imageSize.height / imageSize.width))
    : Math.round(baseWidth * 0.75);
  const previewHeight = Math.min(rawHeight, MAX_PREVIEW);
  const finalWidth =
    rawHeight > MAX_PREVIEW
      ? Math.round(baseWidth * (MAX_PREVIEW / rawHeight))
      : baseWidth;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#fff" }}>
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
      >
        {/* ── 헤더: 닉네임 + 로고 ── */}
        <UserHeader />
        <View style={{ alignItems: "center" }}>
          <Image
            source={LOGO}
            style={{
              width: screenWidth * 0.3,
              height: screenWidth * 0.3 * (9 / 16),
            }}
            resizeMode="contain"
          />
          <Text
            style={{
              marginTop: 4,
              fontSize: 14,
              color: "#6b7280",
              letterSpacing: 0.5,
            }}
          >
            사진 한 장으로 우리 강아지 건강 체크
          </Text>
        </View>

        {/* ── 업로드 영역 ── */}
        <View style={{ paddingHorizontal: 24, marginTop: 24 }}>
          {imageUri ? (
            // ── 이미지 선택 후 ──
            <View style={{ gap: 16 }}>
              <Pressable
                style={{
                  borderRadius: 16,
                  overflow: "hidden",
                  backgroundColor: "#ffffff",
                  alignSelf: "center",
                  borderWidth: 1,
                  borderColor: "#e5e7eb",
                }}
                onPress={() => {
                  setImageUri(null);
                  setImageSize(null);
                }}
              >
                <Image
                  source={{ uri: imageUri }}
                  style={{
                    width: finalWidth,
                    height: previewHeight,
                    backgroundColor: "#ffffff",
                  }}
                  resizeMode="contain"
                />
                <View
                  style={{
                    position: "absolute",
                    bottom: 10,
                    right: 10,
                    backgroundColor: "rgba(0,0,0,0.5)",
                    borderRadius: 20,
                    paddingHorizontal: 12,
                    paddingVertical: 5,
                  }}
                >
                  <Text style={{ fontSize: 11, color: "#fff" }}>
                    탭하여 재선택
                  </Text>
                </View>
              </Pressable>

              {error && (
                <ErrorState
                  message={error}
                  onRetry={() => {
                    setError(null);
                    setImageUri(null);
                    setImageSize(null);
                  }}
                />
              )}

              <Pressable
                style={{
                  backgroundColor: "#CC1A1A",
                  borderRadius: 16,
                  paddingVertical: 16,
                  alignItems: "center",
                }}
                onPress={handleAnalyze}
              >
                <Text
                  style={{
                    fontSize: 17,
                    fontWeight: "800",
                    color: "#fff",
                    letterSpacing: 0.5,
                  }}
                >
                  🐾 분석하기
                </Text>
              </Pressable>
            </View>
          ) : (
            // ── idle: 업로드 버튼 ──
            <View style={{ gap: 12 }}>
              {/* 갤러리 */}
              <Pressable
                style={{
                  alignItems: "center",
                  borderRadius: 18,
                  borderWidth: 2,
                  borderStyle: "dashed",
                  borderColor: "#CC1A1A",
                  backgroundColor: "#fff5f5",
                  paddingVertical: 32,
                  paddingHorizontal: 24,
                }}
                onPress={() => pickImage("gallery")}
              >
                <Text style={{ fontSize: 40 }}>🖼️</Text>
                <Text
                  style={{
                    marginTop: 10,
                    fontSize: 16,
                    fontWeight: "700",
                    color: "#CC1A1A",
                  }}
                >
                  갤러리에서 선택
                </Text>
                <Text style={{ marginTop: 4, fontSize: 12, color: "#9ca3af" }}>
                  JPEG, PNG, WebP, BMP, GIF, HEIC · 최대 10MB
                </Text>
              </Pressable>

              {/* 카메라 */}
              <Pressable
                style={{
                  alignItems: "center",
                  borderRadius: 18,
                  borderWidth: 2,
                  borderStyle: "dashed",
                  borderColor: "#7b2ff7",
                  backgroundColor: "#faf5ff",
                  paddingVertical: 32,
                  paddingHorizontal: 24,
                }}
                onPress={() => pickImage("camera")}
              >
                <Text style={{ fontSize: 36 }}>📷</Text>
                <Text
                  style={{
                    marginTop: 8,
                    fontSize: 16,
                    fontWeight: "700",
                    color: "#7b2ff7",
                  }}
                >
                  카메라로 촬영
                </Text>
              </Pressable>

              {error && (
                <ErrorState message={error} onRetry={() => setError(null)} />
              )}
            </View>
          )}
        </View>

        {/* ── 사용 안내 (idle 상태) ── */}
        {!imageUri && (
          <View style={{ paddingHorizontal: 24, marginTop: 24, gap: 10 }}>
            {/* 섹션 헤더 */}
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
                marginBottom: 4,
              }}
            >
              <View
                style={{
                  width: 3,
                  height: 16,
                  backgroundColor: "#CC1A1A",
                  borderRadius: 2,
                }}
              />
              <Text
                style={{ fontSize: 13, fontWeight: "700", color: "#374151" }}
              >
                이용 방법
              </Text>
            </View>

            {[
              {
                icon: "📸",
                title: "사진 업로드",
                desc: "강아지 사진을 올려주세요",
                color: "#fff5f5",
                accent: "#CC1A1A",
              },
              {
                icon: "🔍",
                title: "AI 품종 분석",
                desc: "품종과 유전병 위험을 분석합니다",
                color: "#eff6ff",
                accent: "#3b82f6",
              },
              {
                icon: "🍲",
                title: "맞춤 레시피",
                desc: "건강에 좋은 집밥을 추천해요",
                color: "#f5f3ff",
                accent: "#7b2ff7",
              },
            ].map((s, i) => (
              <View
                key={i}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 14,
                  backgroundColor: s.color,
                  borderRadius: 14,
                  paddingHorizontal: 16,
                  paddingVertical: 13,
                }}
              >
                {/* 번호 뱃지 */}
                <View
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 16,
                    backgroundColor: s.accent,
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <Text
                    style={{ fontSize: 14, fontWeight: "800", color: "#fff" }}
                  >
                    {i + 1}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      fontSize: 13,
                      fontWeight: "700",
                      color: "#1f2937",
                    }}
                  >
                    {s.title}
                  </Text>
                  <Text
                    style={{ fontSize: 12, color: "#6b7280", marginTop: 1 }}
                  >
                    {s.desc}
                  </Text>
                </View>
                <Text style={{ fontSize: 20 }}>{s.icon}</Text>
              </View>
            ))}
          </View>
        )}

        {/* ── 하단 ── */}
        <View
          style={{ paddingHorizontal: 24, marginTop: "auto", paddingTop: 24 }}
        >
          <Disclaimer />
          <Text
            style={{
              marginTop: 8,
              textAlign: "center",
              fontSize: 11,
              color: "#9ca3af",
            }}
          >
            강정민 · 최동원 · 송진우 · 이민혜 · 장승우 · 김재현
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default UploadScreen;
