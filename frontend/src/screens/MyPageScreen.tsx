import { useCallback, useEffect, useState } from "react";
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
import { getMe, updateMe, getMyDog, createMyDog, updateMyDog } from "../api/users";
import { listBreeds } from "../api/breeds";
import type { DogInfo } from "../api/users";
import type { BreedListItem } from "../types";

type Props = NativeStackScreenProps<RootStackParamList, "MyPage">;
type Tab = "user" | "dog";

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

// ── 내 정보 탭 ──
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
            style={{ flex: 2, backgroundColor: "#CC1A1A", borderRadius: 12, paddingVertical: 12, alignItems: "center" }}
          >
            {loading ? <ActivityIndicator color="#fff" size="small" /> : (
              <Text style={{ fontSize: 14, color: "#fff", fontWeight: "700" }}>저장</Text>
            )}
          </Pressable>
        </View>
      ) : (
        <Pressable
          onPress={() => { setEditing(true); setSuccess(""); }}
          style={{ backgroundColor: "#CC1A1A", borderRadius: 12, paddingVertical: 12, alignItems: "center" }}
        >
          <Text style={{ fontSize: 14, color: "#fff", fontWeight: "700" }}>수정</Text>
        </Pressable>
      )}
    </View>
  );
};

// ── 내 개 정보 탭 ──
const DogInfoTab = () => {
  const [dog, setDog] = useState<DogInfo | null>(null);
  const [breeds, setBreeds] = useState<BreedListItem[]>([]);
  const [breedSearch, setBreedSearch] = useState("");
  const [showBreedList, setShowBreedList] = useState(false);
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
        const [dogData, breedsData] = await Promise.all([
          getMyDog(),
          listBreeds({ limit: 100 }),
        ]);
        setBreeds(breedsData.breeds);
        if (dogData) {
          setDog(dogData);
          setForm({
            name: dogData.name,
            birthday: dogData.birthday ?? "",
            breed_id: dogData.breed_id ?? "",
            breed_name_ko: dogData.breed_name_ko ?? "",
            favorite_ingredients: dogData.favorite_ingredients,
          });
          setBreedSearch(dogData.breed_name_ko ?? "");
        } else {
          setIsNew(true);
          setEditing(true);
        }
      } catch {
        setError("정보를 불러오지 못했습니다.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const filteredBreeds = breeds.filter((b) =>
    b.name_ko.includes(breedSearch) || b.name_en.toLowerCase().includes(breedSearch.toLowerCase())
  );

  const selectBreed = (breed: BreedListItem) => {
    setForm((prev) => ({ ...prev, breed_id: breed.breed_id, breed_name_ko: breed.name_ko }));
    setBreedSearch(breed.name_ko);
    setShowBreedList(false);
  };

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
        breed_id: dog.breed_id ?? "",
        breed_name_ko: dog.breed_name_ko ?? "",
        favorite_ingredients: dog.favorite_ingredients,
      });
      setBreedSearch(dog.breed_name_ko ?? "");
    }
    setEditing(false);
    setError("");
  };

  if (loading) return <ActivityIndicator color="#CC1A1A" style={{ marginTop: 40 }} />;

  return (
    <View style={{ gap: 16 }}>
      {!isNew && !editing && (
        <View style={{ backgroundColor: "#fff5f5", borderRadius: 12, padding: 16, gap: 10 }}>
          <Row label="이름" value={form.name} />
          <Row label="생일" value={form.birthday || "—"} />
          <Row label="품종" value={form.breed_name_ko || "—"} />
          <View>
            <Text style={{ fontSize: 12, color: "#6b7280", fontWeight: "600", marginBottom: 6 }}>좋아하는 재료</Text>
            {form.favorite_ingredients.length === 0 ? (
              <Text style={{ fontSize: 14, color: "#9ca3af" }}>없음</Text>
            ) : (
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                {form.favorite_ingredients.map((i) => (
                  <View key={i} style={{ backgroundColor: "#fee2e2", borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 }}>
                    <Text style={{ fontSize: 13, color: "#CC1A1A" }}>{i}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        </View>
      )}

      {editing && (
        <View style={{ gap: 16 }}>
          <Field label="강아지 이름 *" value={form.name} onChangeText={(v) => setForm((p) => ({ ...p, name: v }))} placeholder="예: 초코" />
          <Field label="생일" value={form.birthday} onChangeText={(v) => setForm((p) => ({ ...p, birthday: v }))} placeholder="YYYY-MM-DD" />

          {/* 품종 검색 */}
          <View style={{ gap: 4 }}>
            <Text style={{ fontSize: 12, color: "#6b7280", fontWeight: "600" }}>품종</Text>
            <TextInput
              style={{ borderWidth: 1, borderColor: "#d1d5db", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, color: "#1f2937" }}
              value={breedSearch}
              onChangeText={(v) => { setBreedSearch(v); setShowBreedList(true); setForm((p) => ({ ...p, breed_id: "", breed_name_ko: "" })); }}
              placeholder="품종 검색 (예: 골든리트리버)"
              placeholderTextColor="#9ca3af"
              onFocus={() => setShowBreedList(true)}
            />
            {showBreedList && breedSearch.length > 0 && (
              <View style={{ borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 12, maxHeight: 160, overflow: "hidden" }}>
                <ScrollView nestedScrollEnabled>
                  {filteredBreeds.slice(0, 20).map((b) => (
                    <Pressable
                      key={b.breed_id}
                      onPress={() => selectBreed(b)}
                      style={{ paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#f3f4f6" }}
                    >
                      <Text style={{ fontSize: 14, color: "#1f2937" }}>{b.name_ko}</Text>
                      <Text style={{ fontSize: 11, color: "#9ca3af" }}>{b.name_en}</Text>
                    </Pressable>
                  ))}
                  {filteredBreeds.length === 0 && (
                    <Text style={{ padding: 14, color: "#9ca3af", fontSize: 13 }}>검색 결과 없음</Text>
                  )}
                </ScrollView>
              </View>
            )}
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
                style={{ backgroundColor: "#CC1A1A", borderRadius: 12, paddingHorizontal: 16, justifyContent: "center" }}
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
                    style={{ backgroundColor: "#fee2e2", borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, flexDirection: "row", alignItems: "center", gap: 4 }}
                  >
                    <Text style={{ fontSize: 13, color: "#CC1A1A" }}>{item}</Text>
                    <Text style={{ fontSize: 12, color: "#CC1A1A" }}>✕</Text>
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
            style={{ flex: 2, backgroundColor: "#CC1A1A", borderRadius: 12, paddingVertical: 12, alignItems: "center" }}
          >
            {saving ? <ActivityIndicator color="#fff" size="small" /> : (
              <Text style={{ fontSize: 14, color: "#fff", fontWeight: "700" }}>저장</Text>
            )}
          </Pressable>
        </View>
      ) : (
        <Pressable
          onPress={() => { setEditing(true); setSuccess(""); }}
          style={{ backgroundColor: "#CC1A1A", borderRadius: 12, paddingVertical: 12, alignItems: "center" }}
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
              borderBottomColor: tab === t ? "#CC1A1A" : "transparent",
            }}
          >
            <Text style={{ fontSize: 15, fontWeight: "600", color: tab === t ? "#CC1A1A" : "#9ca3af" }}>
              {t === "user" ? "내 정보" : "내 개 정보"}
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
