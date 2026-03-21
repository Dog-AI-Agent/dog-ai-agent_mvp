import { useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/RootStack";
import type { CommunityCategory } from "../types";
import { createPost, uploadPostImages } from "../api/community";

type Props = NativeStackScreenProps<RootStackParamList, "CommunityPostCreate">;

const PRIMARY = "#4361EE";
const MAX_IMAGES = 5;

const CATEGORIES: { key: CommunityCategory; label: string }[] = [
  { key: "recipe", label: "레시피 공유" },
  { key: "general_qna", label: "일반 Q&A" },
  { key: "health_qna", label: "건강 Q&A" },
  { key: "free", label: "자유" },
];

const CommunityPostCreateScreen = ({ navigation, route }: Props) => {
  const defaultCategory = route.params?.category ?? "free";
  const [category, setCategory] = useState<CommunityCategory>(defaultCategory);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // 이미지
  const [imageUris, setImageUris] = useState<string[]>([]);

  // 레시피 데이터
  const [ingredients, setIngredients] = useState<
    { name: string; amount: string }[]
  >([]);
  const [steps, setSteps] = useState<string[]>([]);
  const [newIngName, setNewIngName] = useState("");
  const [newIngAmount, setNewIngAmount] = useState("");
  const [newStep, setNewStep] = useState("");

  const pickImages = async () => {
    if (imageUris.length >= MAX_IMAGES) {
      setError(`이미지는 최대 ${MAX_IMAGES}장까지 가능합니다.`);
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsMultipleSelection: true,
      selectionLimit: MAX_IMAGES - imageUris.length,
      quality: 0.5,
    });

    if (!result.canceled && result.assets) {
      const newUris = result.assets.map((a) => a.uri);
      setImageUris((prev) => [...prev, ...newUris].slice(0, MAX_IMAGES));
    }
  };

  const removeImage = (idx: number) => {
    setImageUris((prev) => prev.filter((_, i) => i !== idx));
  };

  const addIngredient = () => {
    if (!newIngName.trim() || !newIngAmount.trim()) return;
    setIngredients((prev) => [
      ...prev,
      { name: newIngName.trim(), amount: newIngAmount.trim() },
    ]);
    setNewIngName("");
    setNewIngAmount("");
  };

  const removeIngredient = (idx: number) => {
    setIngredients((prev) => prev.filter((_, i) => i !== idx));
  };

  const addStep = () => {
    if (!newStep.trim()) return;
    setSteps((prev) => [...prev, newStep.trim()]);
    setNewStep("");
  };

  const removeStep = (idx: number) => {
    setSteps((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = async () => {
    if (!title.trim()) {
      setError("제목을 입력해주세요.");
      return;
    }
    if (!content.trim()) {
      setError("내용을 입력해주세요.");
      return;
    }
    setError("");
    setSubmitting(true);

    try {
      const recipeData =
        category === "recipe" && (ingredients.length > 0 || steps.length > 0)
          ? { ingredients, steps }
          : null;

      const newPost = await createPost({
        category,
        title: title.trim(),
        content: content.trim(),
        recipe_data: recipeData,
      });

      // 이미지 업로드
      if (imageUris.length > 0) {
        await uploadPostImages(newPost.post_id, imageUris);
      }

      navigation.replace("CommunityPostDetail", { postId: newPost.post_id });
    } catch (e: any) {
      setError(e.detail || e.message || "게시글 작성에 실패했습니다.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#fff" }}>
      {/* 헤더 */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingHorizontal: 20,
          paddingVertical: 14,
          borderBottomWidth: 1,
          borderBottomColor: "#f3f4f6",
        }}
      >
        <Pressable onPress={() => navigation.goBack()}>
          <Text style={{ fontSize: 22, color: "#6b7280" }}>{"\u2190"}</Text>
        </Pressable>
        <Text style={{ fontSize: 16, fontWeight: "700", color: "#1f2937" }}>
          글쓰기
        </Text>
        <Pressable onPress={handleSubmit} disabled={submitting}>
          {submitting ? (
            <ActivityIndicator size="small" color={PRIMARY} />
          ) : (
            <Text style={{ fontSize: 15, fontWeight: "700", color: PRIMARY }}>
              등록
            </Text>
          )}
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 20, gap: 20 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* 카테고리 선택 */}
        <View style={{ gap: 8 }}>
          <Text style={{ fontSize: 13, fontWeight: "600", color: "#6b7280" }}>
            카테고리
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {CATEGORIES.map((cat) => (
              <Pressable
                key={cat.key}
                onPress={() => setCategory(cat.key)}
                style={{
                  paddingHorizontal: 16,
                  paddingVertical: 8,
                  borderRadius: 20,
                  backgroundColor: category === cat.key ? PRIMARY : "#f3f4f6",
                }}
              >
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: "600",
                    color: category === cat.key ? "#fff" : "#6b7280",
                  }}
                >
                  {cat.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* 제목 */}
        <View style={{ gap: 8 }}>
          <Text style={{ fontSize: 13, fontWeight: "600", color: "#6b7280" }}>
            제목
          </Text>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="제목을 입력하세요"
            placeholderTextColor="#9ca3af"
            style={{
              borderWidth: 1,
              borderColor: "#d1d5db",
              borderRadius: 12,
              paddingHorizontal: 14,
              paddingVertical: 12,
              fontSize: 15,
              color: "#1f2937",
            }}
          />
        </View>

        {/* 본문 */}
        <View style={{ gap: 8 }}>
          <Text style={{ fontSize: 13, fontWeight: "600", color: "#6b7280" }}>
            내용
          </Text>
          <TextInput
            value={content}
            onChangeText={setContent}
            placeholder="내용을 입력하세요"
            placeholderTextColor="#9ca3af"
            multiline
            textAlignVertical="top"
            style={{
              borderWidth: 1,
              borderColor: "#d1d5db",
              borderRadius: 12,
              paddingHorizontal: 14,
              paddingVertical: 12,
              fontSize: 15,
              color: "#1f2937",
              minHeight: 160,
            }}
          />
        </View>

        {/* 이미지 추가 */}
        <View style={{ gap: 8 }}>
          <Text style={{ fontSize: 13, fontWeight: "600", color: "#6b7280" }}>
            사진 ({imageUris.length}/{MAX_IMAGES})
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
            {imageUris.map((uri, idx) => (
              <View key={idx} style={{ position: "relative" }}>
                <Image
                  source={{ uri }}
                  style={{ width: 80, height: 80, borderRadius: 10 }}
                />
                <Pressable
                  onPress={() => removeImage(idx)}
                  style={{
                    position: "absolute",
                    top: -6,
                    right: -6,
                    width: 22,
                    height: 22,
                    borderRadius: 11,
                    backgroundColor: "#ef4444",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Text
                    style={{ color: "#fff", fontSize: 12, fontWeight: "700" }}
                  >
                    {"\u2715"}
                  </Text>
                </Pressable>
              </View>
            ))}
            {imageUris.length < MAX_IMAGES && (
              <Pressable
                onPress={pickImages}
                style={{
                  width: 80,
                  height: 80,
                  borderRadius: 10,
                  borderWidth: 2,
                  borderColor: "#d1d5db",
                  borderStyle: "dashed",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text style={{ fontSize: 28, color: "#9ca3af" }}>+</Text>
              </Pressable>
            )}
          </View>
        </View>

        {/* 레시피 데이터 (recipe 카테고리) */}
        {category === "recipe" && (
          <View style={{ gap: 16 }}>
            {/* 재료 */}
            <View
              style={{
                backgroundColor: "#faf5ff",
                borderRadius: 16,
                padding: 16,
                gap: 12,
              }}
            >
              <Text
                style={{ fontSize: 14, fontWeight: "700", color: "#7c3aed" }}
              >
                재료
              </Text>
              {ingredients.map((ing, idx) => (
                <View
                  key={idx}
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    alignItems: "center",
                    backgroundColor: "#fff",
                    borderRadius: 10,
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                  }}
                >
                  <Text style={{ fontSize: 14, color: "#374151" }}>
                    {ing.name} - {ing.amount}
                  </Text>
                  <Pressable onPress={() => removeIngredient(idx)}>
                    <Text style={{ fontSize: 14, color: "#ef4444" }}>
                      {"\u2715"}
                    </Text>
                  </Pressable>
                </View>
              ))}
              <View style={{ flexDirection: "row", gap: 8 }}>
                <TextInput
                  value={newIngName}
                  onChangeText={setNewIngName}
                  placeholder="재료명"
                  placeholderTextColor="#9ca3af"
                  style={{
                    flex: 2,
                    borderWidth: 1,
                    borderColor: "#d8b4fe",
                    borderRadius: 10,
                    paddingHorizontal: 10,
                    paddingVertical: 8,
                    fontSize: 14,
                    color: "#1f2937",
                  }}
                />
                <TextInput
                  value={newIngAmount}
                  onChangeText={setNewIngAmount}
                  placeholder="양"
                  placeholderTextColor="#9ca3af"
                  style={{
                    flex: 1,
                    borderWidth: 1,
                    borderColor: "#d8b4fe",
                    borderRadius: 10,
                    paddingHorizontal: 10,
                    paddingVertical: 8,
                    fontSize: 14,
                    color: "#1f2937",
                  }}
                />
                <Pressable
                  onPress={addIngredient}
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 10,
                    backgroundColor: "#7c3aed",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Text style={{ fontSize: 20, color: "#fff" }}>+</Text>
                </Pressable>
              </View>
            </View>

            {/* 조리 단계 */}
            <View
              style={{
                backgroundColor: "#faf5ff",
                borderRadius: 16,
                padding: 16,
                gap: 12,
              }}
            >
              <Text
                style={{ fontSize: 14, fontWeight: "700", color: "#7c3aed" }}
              >
                조리 단계
              </Text>
              {steps.map((step, idx) => (
                <View
                  key={idx}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 8,
                    backgroundColor: "#fff",
                    borderRadius: 10,
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                  }}
                >
                  <View
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: 11,
                      backgroundColor: "#7c3aed",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Text
                      style={{ fontSize: 11, fontWeight: "700", color: "#fff" }}
                    >
                      {idx + 1}
                    </Text>
                  </View>
                  <Text style={{ flex: 1, fontSize: 14, color: "#374151" }}>
                    {step}
                  </Text>
                  <Pressable onPress={() => removeStep(idx)}>
                    <Text style={{ fontSize: 14, color: "#ef4444" }}>
                      {"\u2715"}
                    </Text>
                  </Pressable>
                </View>
              ))}
              <View style={{ flexDirection: "row", gap: 8 }}>
                <TextInput
                  value={newStep}
                  onChangeText={setNewStep}
                  placeholder="조리 단계를 입력하세요"
                  placeholderTextColor="#9ca3af"
                  style={{
                    flex: 1,
                    borderWidth: 1,
                    borderColor: "#d8b4fe",
                    borderRadius: 10,
                    paddingHorizontal: 10,
                    paddingVertical: 8,
                    fontSize: 14,
                    color: "#1f2937",
                  }}
                />
                <Pressable
                  onPress={addStep}
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 10,
                    backgroundColor: "#7c3aed",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Text style={{ fontSize: 20, color: "#fff" }}>+</Text>
                </Pressable>
              </View>
            </View>
          </View>
        )}

        {/* 에러 메시지 */}
        {error ? (
          <Text style={{ color: "#ef4444", fontSize: 13 }}>{error}</Text>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
};

export default CommunityPostCreateScreen;
