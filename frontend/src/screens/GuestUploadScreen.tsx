// 비회원 업로드 화면 - 로그인 없이 사진 분석 (하루 3회)
import { useState, useCallback } from "react";
import { View, Text, Pressable, Image, Alert, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/RootStack";
import { recognizeBreedGuest, fetchGradcam } from "../api/ai";
import LoadingSpinner from "../components/LoadingSpinner";
import ErrorState from "../components/ErrorState";

type Props = NativeStackScreenProps<RootStackParamList, "GuestUpload">;

const LOGO = require("../../assets/logo.png") as number;

const GuestUploadScreen = ({ navigation }: Props) => {
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

    const result = await launchFn({ mediaTypes: ["images"], quality: 0.8 });
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
      const [result, gradcamUri] = await Promise.all([
        recognizeBreedGuest(imageUri),
        fetchGradcam(imageUri).catch(() => undefined),
      ]);
      navigation.navigate("BreedResult", {
        result,
        imageUri,
        gradcamUri,
        isGuest: true,
      });
    } catch (err: any) {
      if (err.status === 429) {
        setError("하루 3회 무료 분석 횟수를 초과했습니다. 로그인 후 이용해주세요.");
      } else {
        setError(err.detail || err.message || "분석 중 오류가 발생했습니다.");
      }
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: "#fff" }}>
        <LoadingSpinner />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#fff" }}>
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
      >
        {/* 로고 */}
        <View style={{ width: "100%" }}>
          <Image source={LOGO} style={{ width: "100%", height: 220 }} resizeMode="cover" />
        </View>

        {/* 비회원 안내 배너 */}
        <View style={{
          marginHorizontal: 20,
          marginTop: 16,
          backgroundColor: "#fef9c3",
          borderRadius: 12,
          padding: 14,
          borderLeftWidth: 4,
          borderLeftColor: "#f59e0b",
        }}>
          <Text style={{ fontSize: 13, fontWeight: "700", color: "#a16207" }}>
            🐾 비회원 체험 모드
          </Text>
          <Text style={{ fontSize: 12, color: "#a16207", marginTop: 4 }}>
            하루 3회 무료로 품종 분석이 가능합니다.{"\n"}
            맞춤 추천·AI 챗봇은 로그인 후 이용 가능해요!
          </Text>
          <Pressable
            style={{ marginTop: 8 }}
            onPress={() => navigation.navigate("Login")}
          >
            <Text style={{ fontSize: 12, fontWeight: "700", color: "#4361ee" }}>
              → 로그인하고 전체 기능 이용하기
            </Text>
          </Pressable>
        </View>

        {/* 업로드 영역 */}
        <View style={{ paddingHorizontal: 20, marginTop: 20 }}>
          {imageUri ? (
            <View style={{ gap: 16 }}>
              <Pressable
                style={{
                  borderRadius: 16, overflow: "hidden",
                  backgroundColor: "#fff", alignSelf: "center",
                  borderWidth: 1, borderColor: "#e5e7eb",
                }}
                onPress={() => setImageUri(null)}
              >
                <Image
                  source={{ uri: imageUri }}
                  style={{ width: 280, height: 280 }}
                  resizeMode="contain"
                />
                <View style={{
                  position: "absolute", bottom: 10, right: 10,
                  backgroundColor: "rgba(0,0,0,0.5)",
                  borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5,
                }}>
                  <Text style={{ fontSize: 11, color: "#fff" }}>탭하여 재선택</Text>
                </View>
              </Pressable>

              {error && <ErrorState message={error} onRetry={() => setError(null)} />}

              <Pressable
                style={{ backgroundColor: "#CC1A1A", borderRadius: 16, paddingVertical: 16, alignItems: "center" }}
                onPress={handleAnalyze}
              >
                <Text style={{ fontSize: 17, fontWeight: "800", color: "#fff" }}>🐾 분석하기</Text>
              </Pressable>
            </View>
          ) : (
            <View style={{ gap: 12 }}>
              <Pressable
                style={{
                  alignItems: "center", borderRadius: 18,
                  borderWidth: 2, borderStyle: "dashed", borderColor: "#CC1A1A",
                  backgroundColor: "#fff5f5", paddingVertical: 32,
                }}
                onPress={() => pickImage("gallery")}
              >
                <Text style={{ fontSize: 40 }}>🖼️</Text>
                <Text style={{ marginTop: 10, fontSize: 16, fontWeight: "700", color: "#CC1A1A" }}>
                  갤러리에서 선택
                </Text>
                <Text style={{ marginTop: 4, fontSize: 12, color: "#9ca3af" }}>
                  JPEG, PNG, WebP · 최대 10MB
                </Text>
              </Pressable>

              <Pressable
                style={{
                  alignItems: "center", borderRadius: 18,
                  borderWidth: 2, borderStyle: "dashed", borderColor: "#7b2ff7",
                  backgroundColor: "#faf5ff", paddingVertical: 32,
                }}
                onPress={() => pickImage("camera")}
              >
                <Text style={{ fontSize: 36 }}>📷</Text>
                <Text style={{ marginTop: 8, fontSize: 16, fontWeight: "700", color: "#7b2ff7" }}>
                  카메라로 촬영
                </Text>
              </Pressable>

              {error && <ErrorState message={error} onRetry={() => setError(null)} />}
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default GuestUploadScreen;
