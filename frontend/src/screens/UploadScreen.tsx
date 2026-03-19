import { useState, useCallback } from "react";
import { View, Text, Pressable, Image, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/RootStack";
import { recognizeBreed } from "../api/ai";
import LoadingSpinner from "../components/LoadingSpinner";
import ErrorState from "../components/ErrorState";

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
        setError("강아지가 감지되지 않았습니다. 다른 사진을 시도해주세요.");
      } else {
        setError(e.detail || e.message || "분석에 실패했습니다.");
      }
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-white">
        <LoadingSpinner />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-white px-6 py-4">
      <Text className="mb-6 text-center text-2xl font-bold text-gray-800">
        강아지 사진 업로드
      </Text>

      {imageUri ? (
        <Pressable
          className="mb-4 items-center overflow-hidden rounded-2xl"
          onPress={() => setImageUri(null)}
        >
          <Image
            source={{ uri: imageUri }}
            className="h-72 w-full rounded-2xl"
            resizeMode="cover"
          />
          <Text className="mt-2 text-xs text-muted">탭하여 다시 선택</Text>
        </Pressable>
      ) : (
        <View className="mb-4 gap-3">
          <Pressable
            className="items-center rounded-2xl border-2 border-dashed border-primary bg-blue-50 px-6 py-12 active:opacity-80"
            onPress={() => pickImage("gallery")}
          >
            <Text className="text-3xl">🖼️</Text>
            <Text className="mt-2 text-base font-semibold text-primary">
              갤러리에서 선택
            </Text>
            <Text className="mt-1 text-xs text-muted">
              JPEG, PNG (최대 10MB)
            </Text>
          </Pressable>

          <Pressable
            className="items-center rounded-2xl border-2 border-dashed border-secondary bg-purple-50 px-6 py-12 active:opacity-80"
            onPress={() => pickImage("camera")}
          >
            <Text className="text-3xl">📷</Text>
            <Text className="mt-2 text-base font-semibold text-secondary">
              카메라로 촬영
            </Text>
          </Pressable>
        </View>
      )}

      {error && (
        <ErrorState message={error} onRetry={() => setError(null)} />
      )}

      {imageUri && !error && (
        <Pressable
          className="mt-2 rounded-xl bg-primary px-6 py-4 active:opacity-80"
          onPress={handleAnalyze}
        >
          <Text className="text-center text-lg font-bold text-white">
            분석하기
          </Text>
        </Pressable>
      )}

      <Pressable
        className="mt-3 rounded-xl bg-gray-100 px-6 py-3 active:opacity-80"
        onPress={() => navigation.goBack()}
      >
        <Text className="text-center font-semibold text-muted">돌아가기</Text>
      </Pressable>
    </SafeAreaView>
  );
};

export default UploadScreen;
