import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/RootStack";
import { useAuth } from "../context/AuthContext";
import { useBreed } from "../context/BreedContext";
import { updateMe, getMyDog, createMyDog, updateMyDog } from "../api/users";
import type { DogInfo } from "../api/users";

type Props = NativeStackScreenProps<RootStackParamList, "MyPage">;
type Tab = "user" | "dog";

const PRIMARY = "#4361EE";
const PRIMARY_LIGHT = "#eef0fd";
const PRIMARY_PRESSED = "#3451d1";

// ── 입력 필드 공통 컴포넌트 ──
const Field = ({
  label,
  value,
  onChangeText,
  editable = true,
  placeholder,
  secureTextEntry,
}: {
  label: string;
  value: string;
  onChangeText?: (v: string) => void;
  editable?: boolean;
  placeholder?: string;
  secureTextEntry?: boolean;
}) => (
  <View style={{ gap: 4 }}>
    <Text style={{ fontSize: 12, color: "#6b7280", fontWeight: "600" }}>{label}</Text>
    <TextInput
      style={{
        borderWidth: 1,
        borderColor: editable ? "#d1d5db" : "#f3f4f6",
        borderRadius: 12,
        paddingHorizontal: 14,
        paddingVertical: 10,
        fontSize: 14,
        color: editable ? "#1f2937" : "#9ca3af",
        backgroundColor: editable ? "#ffffff" : "#f9fafb",
      }}
      value={value}
      onChangeText={onChangeText}
      editable={editable}
      placeholder={placeholder}
      placeholderTextColor="#9ca3af"
      secureTextEntry={secureTextEntry}
    />
  </View>
);

// ── My Profile 탭 ──
const UserInfoTab = () => {
  const { user, updateUser } = useAuth();
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [form, setForm] = useState({
    name: user?.name ?? "",
    nickname: user?.nickname ?? "",
    birth_date: user?.birth_date ?? "",
    address: user?.address ?? "",
  });

  const set = (key: keyof typeof form) => (val: string) =>
    setForm((prev) => ({ ...prev, [key]: val }));

  const handleSave = async () => {
    setError("");
    setSuccess("");
    setLoading(true);
    try {
      const updated = await updateMe({
        name: form.name || undefined,
        nickname: form.nickname || undefined,
        birth_date: form.birth_date || undefined,
        address: form.address || undefined,
      });
      updateUser(updated);
      setEditing(false);
      setSuccess("정보가 수정되었습니다.");
    } catch (e: any) {
      setError(e.detail || e.message || "수정에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setForm({
      name: user?.name ?? "",
      nickname: user?.nickname ?? "",
      birth_date: user?.birth_date ?? "",
      address: user?.address ?? "",
    });
    setEditing(false);
    setError("");
  };

  return (
    <View style={{ gap: 16 }}>
      <Field label="이름" value={form.name} onChangeText={set("name")} editable={editing} />
      <Field label="이메일" value={user?.email ?? ""} editable={false} />
      <Field label="닉네임" value={form.nickname} onChangeText={set("nickname")} editable={editing} />
      <Field label="생년월일" value={form.birth_date ?? ""} onChangeText={set("birth_date")} editable={editing} placeholder="YYYY-MM-DD" />
      <Field label="주소" value={form.address ?? ""} onChangeText={set("address")} editable={editing} placeholder="주소 입력" />

      {error ? <Text style={{ color: "#ef4444", fontSize: 13 }}>{error}</Text> : null}
      {success ? <Text style={{ color: "#22c55e", fontSize: 13 }}>{success}</Text> : null}

      {editing ? (
        <View style={{ flexDirection: "row", gap: 10 }}>
          <Pressable
            onPress={handleCancel}
            style={{ flex: 1, borderWidth: 1, borderColor: "#d1d5db", borderRadius: 12, paddingVertical: 12, alignItems: "center" }}
          >
            <Text style={{ fontSize: 14, color: "#6b7280", fontWeight: "600" }}>취소</Text>
          </Pressable>
          <Pressable
            onPress={handleSave}
            disabled={loading}
            style={({ pressed }) => ({
              flex: 2,
              backgroundColor: pressed ? PRIMARY_PRESSED : PRIMARY,
              borderRadius: 12,
              paddingVertical: 12,
              alignItems: "center",
            })}
          >
            {loading ? <ActivityIndicator color="#fff" size="small" /> : (
              <Text style={{ fontSize: 14, color: "#fff", fontWeight: "700" }}>저장</Text>
            )}
          </Pressable>
        </View>
      ) : (
        <Pressable
          onPress={() => { setEditing(true); setSuccess(""); }}
          style={({ pressed }) => ({
            backgroundColor: pressed ? PRIMARY_PRESSED : PRIMARY,
            borderRadius: 12,
            paddingVertical: 12,
            alignItems: "center",
          })}
        >
          <Text style={{ fontSize: 14, color: "#fff", fontWeight: "700" }}>수정</Text>
        </Pressable>
      )}
    </View>
  );
};

// ── Dog Profile 탭 ──
const DogInfoTab = () => {
  const { breedId, breedNameKo } = useBreed();
  const [dog, setDog] = useState<DogInfo | null>(null);
  const [editing, setEditing] = useState(false);
  const [isNew, setIsNew] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [ingredientInput, setIngredientInput] = useState("");
  const [form, setForm] = useState({
    name: "",
    birthday: "",
    breed_id: "",
    breed_name_ko: "",
    favorite_ingredients: [] as string[],
  });

  useEffect(() => {
    const load = async () => {
      try {
        const dogData = await getMyDog();
        if (dogData) {
          setDog(dogData);
          setForm({
            name: dogData.name,
            birthday: dogData.birthday ?? "",
            breed_id: dogData.breed_id ?? breedId ?? "",
            breed_name_ko: dogData.breed_name_ko ?? breedNameKo ?? "",
            favorite_ingredients: dogData.favorite_ingredients,
          });
        } else {
          setIsNew(true);
          setEditing(true);
          setForm((prev) => ({
            ...prev,
            breed_id: breedId ?? "",
            breed_name_ko: breedNameKo ?? "",
          }));
        }
      } catch {
        setError("정보를 불러오지 못했습니다.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  useEffect(() => {
    if (breedId && breedNameKo) {
      setForm((prev) => ({ ...prev, breed_id: breedId, breed_name_ko: breedNameKo }));
    }
  }, [breedId, breedNameKo]);

  const addIngredient = () => {
    const val = ingredientInput.trim();
    if (!val || form.favorite_ingredients.includes(val)) return;
    setForm((prev) => ({ ...prev, favorite_ingredients: [...prev.favorite_ingredients, val] }));
    setIngredientInput("");
  };

  const removeIngredient = (item: string) => {
    setForm((prev) => ({ ...prev, favorite_ingredients: prev.favorite_ingredients.filter((i) => i !== item) }));
  };

  const handleSave = async () => {
    setError("");
    setSuccess("");
    if (!form.name.trim()) { setError("강아지 이름을 입력해주세요."); return; }
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        birthday: form.birthday || undefined,
        breed_id: form.breed_id || undefined,
        favorite_ingredients: form.favorite_ingredients,
      };
      const result = isNew ? await createMyDog(payload) : await updateMyDog(payload);
      setDog(result);
      setIsNew(false);
      setEditing(false);
      setSuccess("반려견 정보가 저장되었습니다.");
    } catch (e: any) {
      setError(e.detail || e.message || "저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    if (dog) {
      setForm({
        name: dog.name,
        birthday: dog.birthday ?? "",
        breed_id: dog.breed_id ?? breedId ?? "",
        breed_name_ko: dog.breed_name_ko ?? breedNameKo ?? "",
        favorite_ingredients: dog.favorite_ingredients,
      });
    }
    setEditing(false);
    setError("");
  };

  if (loading) return <ActivityIndicator color={PRIMARY} style={{ marginTop: 40 }} />;

  const displayBreed = form.breed_name_ko || breedNameKo || "";

  return (
    <View style={{ gap: 16 }}>
      {!isNew && !editing && (
        <View style={{ backgroundColor: PRIMARY_LIGHT, borderRadius: 12, padding: 16, gap: 10 }}>
          <Row label="이름" value={form.name} />
          <Row label="생일" value={form.birthday || "—"} />
          <Row label="품종" value={displayBreed || "—"} />
          <View>
            <Text style={{ fontSize: 12, color: "#6b7280", fontWeight: "600", marginBottom: 6 }}>좋아하는 재료</Text>
            {form.favorite_ingredients.length === 0 ? (
              <Text style={{ fontSize: 14, color: "#9ca3af" }}>없음</Text>
            ) : (
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                {form.favorite_ingredients.map((i) => (
                  <View key={i} style={{ backgroundColor: "#dbeafe", borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 }}>
                    <Text style={{ fontSize: 13, color: PRIMARY }}>{i}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        </View>
      )}

      {editing && (
        <View style={{ gap: 16 }}>
          <Field
            label="강아지 이름 *"
            value={form.name}
            onChangeText={(v) => setForm((p) => ({ ...p, name: v }))}
            placeholder="예: 초코"
          />
          <Field
            label="생일"
            value={form.birthday}
            onChangeText={(v) => setForm((p) => ({ ...p, birthday: v }))}
            placeholder="YYYY-MM-DD"
          />

          {/* 품종 — 이미지 분류 자동 입력 (읽기 전용) */}
          <View style={{ gap: 4 }}>
            <Text style={{ fontSize: 12, color: "#6b7280", fontWeight: "600" }}>품종</Text>
            <View
              style={{
                borderWidth: 1,
                borderColor: "#f3f4f6",
                borderRadius: 12,
                paddingHorizontal: 14,
                paddingVertical: 10,
                backgroundColor: "#f9fafb",
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <Text style={{ fontSize: 14, color: displayBreed ? "#1f2937" : "#9ca3af" }}>
                {displayBreed || "품종 분류 후 자동 입력됩니다"}
              </Text>
              {displayBreed ? (
                <View style={{ backgroundColor: "#dbeafe", borderRadius: 20, paddingHorizontal: 8, paddingVertical: 2 }}>
                  <Text style={{ fontSize: 11, color: PRIMARY, fontWeight: "600" }}>자동 입력</Text>
                </View>
              ) : null}
            </View>
            <Text style={{ fontSize: 11, color: "#9ca3af" }}>
              홈 화면에서 강아지 사진을 분석하면 자동으로 입력됩니다.
            </Text>
          </View>

          {/* 좋아하는 재료 */}
          <View style={{ gap: 8 }}>
            <Text style={{ fontSize: 12, color: "#6b7280", fontWeight: "600" }}>좋아하는 재료</Text>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <TextInput
                style={{ flex: 1, borderWidth: 1, borderColor: "#d1d5db", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, color: "#1f2937" }}
                value={ingredientInput}
                onChangeText={setIngredientInput}
                placeholder="재료 입력 후 추가"
                placeholderTextColor="#9ca3af"
                onSubmitEditing={addIngredient}
              />
              <Pressable
                onPress={addIngredient}
                style={({ pressed }) => ({
                  backgroundColor: pressed ? PRIMARY_PRESSED : PRIMARY,
                  borderRadius: 12,
                  paddingHorizontal: 16,
                  justifyContent: "center",
                })}
              >
                <Text style={{ color: "#fff", fontWeight: "700", fontSize: 14 }}>추가</Text>
              </Pressable>
            </View>
            {form.favorite_ingredients.length > 0 && (
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                {form.favorite_ingredients.map((item) => (
                  <Pressable
                    key={item}
                    onPress={() => removeIngredient(item)}
                    style={{ backgroundColor: "#dbeafe", borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, flexDirection: "row", alignItems: "center", gap: 4 }}
                  >
                    <Text style={{ fontSize: 13, color: PRIMARY }}>{item}</Text>
                    <Text style={{ fontSize: 12, color: PRIMARY }}>✕</Text>
                  </Pressable>
                ))}
              </View>
            )}
          </View>
        </View>
      )}

      {error ? <Text style={{ color: "#ef4444", fontSize: 13 }}>{error}</Text> : null}
      {success ? <Text style={{ color: "#22c55e", fontSize: 13 }}>{success}</Text> : null}

      {editing ? (
        <View style={{ flexDirection: "row", gap: 10 }}>
          {!isNew && (
            <Pressable
              onPress={handleCancel}
              style={{ flex: 1, borderWidth: 1, borderColor: "#d1d5db", borderRadius: 12, paddingVertical: 12, alignItems: "center" }}
            >
              <Text style={{ fontSize: 14, color: "#6b7280", fontWeight: "600" }}>취소</Text>
            </Pressable>
          )}
          <Pressable
            onPress={handleSave}
            disabled={saving}
            style={({ pressed }) => ({
              flex: 2,
              backgroundColor: pressed ? PRIMARY_PRESSED : PRIMARY,
              borderRadius: 12,
              paddingVertical: 12,
              alignItems: "center",
            })}
          >
            {saving ? <ActivityIndicator color="#fff" size="small" /> : (
              <Text style={{ fontSize: 14, color: "#fff", fontWeight: "700" }}>저장</Text>
            )}
          </Pressable>
        </View>
      ) : (
        <Pressable
          onPress={() => { setEditing(true); setSuccess(""); }}
          style={({ pressed }) => ({
            backgroundColor: pressed ? PRIMARY_PRESSED : PRIMARY,
            borderRadius: 12,
            paddingVertical: 12,
            alignItems: "center",
          })}
        >
          <Text style={{ fontSize: 14, color: "#fff", fontWeight: "700" }}>수정</Text>
        </Pressable>
      )}
    </View>
  );
};

const Row = ({ label, value }: { label: string; value: string }) => (
  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
    <Text style={{ fontSize: 13, color: "#6b7280" }}>{label}</Text>
    <Text style={{ fontSize: 14, color: "#1f2937", fontWeight: "600" }}>{value}</Text>
  </View>
);

// ── 메인 화면 ──
const MyPageScreen = ({ navigation }: Props) => {
  const [tab, setTab] = useState<Tab>("user");

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#fff" }}>
      {/* 헤더 */}
      <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: "#f3f4f6" }}>
        <Pressable onPress={() => navigation.goBack()} style={{ marginRight: 12 }}>
          <Text style={{ fontSize: 22, color: "#6b7280" }}>←</Text>
        </Pressable>
        <Text style={{ fontSize: 18, fontWeight: "700", color: "#1f2937" }}>마이페이지</Text>
      </View>

      {/* 탭 */}
      <View style={{ flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#f3f4f6" }}>
        {(["user", "dog"] as Tab[]).map((t) => (
          <Pressable
            key={t}
            onPress={() => setTab(t)}
            style={{
              flex: 1,
              paddingVertical: 14,
              alignItems: "center",
              borderBottomWidth: 2,
              borderBottomColor: tab === t ? PRIMARY : "transparent",
            }}
          >
            <Text style={{ fontSize: 15, fontWeight: "600", color: tab === t ? PRIMARY : "#9ca3af" }}>
              {t === "user" ? "My Profile" : "Dog Profile"}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* 콘텐츠 */}
      <ScrollView contentContainerStyle={{ padding: 20 }} keyboardShouldPersistTaps="handled">
        {tab === "user" ? <UserInfoTab /> : <DogInfoTab />}
      </ScrollView>
    </SafeAreaView>
  );
};

export default MyPageScreen;
