import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/RootStack";
import { useAuth } from "../context/AuthContext";
import { updateMe, getAnalyses, deleteAnalyses, togglePin } from "../api/users";
import type { AnalysisHistoryItem } from "../api/users";
import LoadingSpinner, { clearPinnedCache } from "../components/LoadingSpinner";

type Props = NativeStackScreenProps<RootStackParamList, "MyPage">;
type Tab = "user" | "dog";

const PRIMARY = "#4361EE";
const PRIMARY_LIGHT = "#eef0fd";
const PRIMARY_PRESSED = "#3451d1";
const PAGE_SIZE = 5;

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
    <Text style={{ fontSize: 12, color: "#6b7280", fontWeight: "600" }}>
      {label}
    </Text>
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
      <Field
        label="이름"
        value={form.name}
        onChangeText={set("name")}
        editable={editing}
      />
      <Field label="이메일" value={user?.email ?? ""} editable={false} />
      <Field
        label="닉네임"
        value={form.nickname}
        onChangeText={set("nickname")}
        editable={editing}
      />
      <Field
        label="생년월일"
        value={form.birth_date ?? ""}
        onChangeText={set("birth_date")}
        editable={editing}
        placeholder="YYYY-MM-DD"
      />
      <Field
        label="주소"
        value={form.address ?? ""}
        onChangeText={set("address")}
        editable={editing}
        placeholder="주소 입력"
      />
      {error ? (
        <Text style={{ color: "#ef4444", fontSize: 13 }}>{error}</Text>
      ) : null}
      {success ? (
        <Text style={{ color: "#22c55e", fontSize: 13 }}>{success}</Text>
      ) : null}
      {editing ? (
        <View style={{ flexDirection: "row", gap: 10 }}>
          <Pressable
            onPress={handleCancel}
            style={{
              flex: 1,
              borderWidth: 1,
              borderColor: "#d1d5db",
              borderRadius: 12,
              paddingVertical: 12,
              alignItems: "center",
            }}
          >
            <Text style={{ fontSize: 14, color: "#6b7280", fontWeight: "600" }}>
              취소
            </Text>
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
            {loading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={{ fontSize: 14, color: "#fff", fontWeight: "700" }}>
                저장
              </Text>
            )}
          </Pressable>
        </View>
      ) : (
        <Pressable
          onPress={() => {
            setEditing(true);
            setSuccess("");
          }}
          style={({ pressed }) => ({
            backgroundColor: pressed ? PRIMARY_PRESSED : PRIMARY,
            borderRadius: 12,
            paddingVertical: 12,
            alignItems: "center",
          })}
        >
          <Text style={{ fontSize: 14, color: "#fff", fontWeight: "700" }}>
            수정
          </Text>
        </Pressable>
      )}
    </View>
  );
};

// ── Dog History 탭 ──
const DogHistoryTab = () => {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [history, setHistory] = useState<AnalysisHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [page, setPage] = useState(0);
  const [selectionMode, setSelectionMode] = useState(false);

  // ref로 selectedIds 관리 → 클로저 문제 방지
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const totalPages = Math.ceil(history.length / PAGE_SIZE);
  const pageItems = history.slice(
    page * PAGE_SIZE,
    page * PAGE_SIZE + PAGE_SIZE,
  );
  const isAllPageSelected =
    pageItems.length > 0 &&
    pageItems.every((i) => selectedIds.includes(i.history_id));

  const load = async () => {
    try {
      setLoading(true);
      const data = await getAnalyses();
      setHistory(data);
    } catch (e: any) {
      console.log("[DogHistory] 로드 실패:", e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const enterSelectionMode = () => {
    console.log("[DogHistory] 선택 모드 진입");
    setSelectionMode(true);
    setSelectedIds([]);
    setDeleteError("");
  };

  const exitSelectionMode = () => {
    console.log("[DogHistory] 선택 모드 종료");
    setSelectionMode(false);
    setSelectedIds([]);
    setDeleteError("");
  };

  const toggleItem = (id: string) => {
    setSelectedIds((prev) => {
      const next = prev.includes(id)
        ? prev.filter((x) => x !== id)
        : [...prev, id];
      console.log("[DogHistory] 선택 변경:", next);
      return next;
    });
  };

  const toggleAllPage = () => {
    if (isAllPageSelected) {
      const pageIds = pageItems.map((i) => i.history_id);
      setSelectedIds((prev) => prev.filter((id) => !pageIds.includes(id)));
    } else {
      const pageIds = pageItems.map((i) => i.history_id);
      setSelectedIds((prev) => {
        const merged = [...prev];
        pageIds.forEach((id) => {
          if (!merged.includes(id)) merged.push(id);
        });
        return merged;
      });
    }
  };

  const handleDelete = () => {
    console.log("[DogHistory] 삭제 버튼 클릭, selectedIds:", selectedIds);

    if (selectedIds.length === 0) {
      if (Platform.OS === "web") {
        window.alert("삭제할 항목을 먼저 선택해주세요.");
      } else {
        Alert.alert("알림", "삭제할 항목을 먼저 선택해주세요.");
      }
      return;
    }

    if (Platform.OS === "web") {
      const confirmed = window.confirm(
        `선택한 ${selectedIds.length}개의 기록을 삭제할까요?`,
      );
      if (confirmed) {
        console.log("[DogHistory] 삭제 확인, IDs:", selectedIds);
        runDelete([...selectedIds]);
      } else {
        console.log("[DogHistory] 삭제 취소");
      }
    } else {
      Alert.alert(
        "삭제 확인",
        `선택한 ${selectedIds.length}개의 기록을 삭제할까요?`,
        [
          {
            text: "취소",
            style: "cancel",
            onPress: () => console.log("[DogHistory] 삭제 취소"),
          },
          {
            text: "삭제",
            style: "destructive",
            onPress: () => {
              console.log("[DogHistory] 삭제 확인, IDs:", selectedIds);
              runDelete([...selectedIds]);
            },
          },
        ],
        { cancelable: true },
      );
    }
  };

  const runDelete = async (ids: string[]) => {
    console.log("[DogHistory] runDelete 시작:", ids);
    setDeleting(true);
    setDeleteError("");
    try {
      const result = await deleteAnalyses(ids);
      console.log("[DogHistory] 삭제 성공:", result);
      exitSelectionMode();
      setPage(0);
      await load();
    } catch (e: any) {
      console.log("[DogHistory] 삭제 실패:", e.message);
      setDeleteError(e.message || "삭제에 실패했습니다.");
    } finally {
      setDeleting(false);
    }
  };

  const handleCardPress = (item: AnalysisHistoryItem) => {
    if (selectionMode) {
      toggleItem(item.history_id);
      return;
    }
    if (!item.breed_id) return;
    navigation.push("BreedResult", {
      result: {
        breed_id: item.breed_id,
        breed_name_ko: item.breed_name_ko,
        breed_name_en: item.breed_name_en ?? "",
        confidence: item.confidence ?? 0,
        top_k_predictions: [],
        inference_time_ms: 0,
        image_metadata: { width: 0, height: 0, format: "", size_bytes: 0 },
        model_version: "",
      },
      imageUri: item.image_url ?? "",
      historyId: item.history_id,
      illustrationUrl: item.illustration_url ?? undefined,
    });
  };

  const handleTogglePin = async (item: AnalysisHistoryItem) => {
    try {
      const updated = await togglePin(item.history_id);
      clearPinnedCache();
      setHistory((prev) =>
        prev
          .map((h) => (h.history_id === updated.history_id ? updated : h))
          .sort((a, b) => {
            if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1;
            return (
              new Date(b.created_at).getTime() -
              new Date(a.created_at).getTime()
            );
          }),
      );
    } catch (e: any) {
      console.log("[DogHistory] 핀 토글 실패:", e.message);
    }
  };

  const formatDate = (iso: string) => {
    try {
      const d = new Date(iso);
      return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
    } catch {
      return iso;
    }
  };

  if (loading) {
    return (
      <View style={{ height: 300 }}>
        <LoadingSpinner />
      </View>
    );
  }

  if (history.length === 0) {
    return (
      <View style={{ alignItems: "center", marginTop: 60, gap: 12 }}>
        <Text style={{ fontSize: 40 }}>🐾</Text>
        <Text style={{ fontSize: 16, fontWeight: "700", color: "#1f2937" }}>
          분석 기록이 없습니다
        </Text>
        <Text style={{ fontSize: 14, color: "#9ca3af", textAlign: "center" }}>
          강아지 사진을 분석하면{"\n"}여기에 기록이 남아요!
        </Text>
      </View>
    );
  }

  return (
    <View style={{ gap: 14 }}>
      {/* ── 상단 헤더 바 ── */}
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        {/* 왼쪽: 건수 or 선택 현황 */}
        {!selectionMode ? (
          <Text style={{ fontSize: 13, color: "#9ca3af" }}>
            총 {history.length}건의 분석 기록
          </Text>
        ) : (
          <Text style={{ fontSize: 13, fontWeight: "600", color: "#1f2937" }}>
            {selectedIds.length > 0
              ? `${selectedIds.length}개 선택됨`
              : "항목을 선택하세요"}
          </Text>
        )}

        {/* 오른쪽: 버튼들 */}
        <View style={{ flexDirection: "row", gap: 8 }}>
          {selectionMode && (
            // 삭제 버튼 (선택 모드일 때 항상 표시 — disabled 없음)
            <Pressable
              onPress={handleDelete}
              style={({ pressed }) => ({
                borderRadius: 20,
                paddingHorizontal: 14,
                paddingVertical: 6,
                backgroundColor:
                  selectedIds.length > 0
                    ? pressed
                      ? "#dc2626"
                      : "#ef4444"
                    : "#e5e7eb",
              })}
            >
              {deleting ? (
                <ActivityIndicator
                  color="#fff"
                  size="small"
                  style={{ width: 40 }}
                />
              ) : (
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: "700",
                    color: selectedIds.length > 0 ? "#fff" : "#9ca3af",
                  }}
                >
                  삭제{selectedIds.length > 0 ? ` (${selectedIds.length})` : ""}
                </Text>
              )}
            </Pressable>
          )}
          {/* 선택 / 취소 버튼 */}
          <Pressable
            onPress={selectionMode ? exitSelectionMode : enterSelectionMode}
            style={({ pressed }) => ({
              borderWidth: 1,
              borderColor: selectionMode ? "#d1d5db" : PRIMARY,
              borderRadius: 20,
              paddingHorizontal: 14,
              paddingVertical: 6,
              backgroundColor: pressed ? "#f3f4f6" : "#fff",
            })}
          >
            <Text
              style={{
                fontSize: 13,
                fontWeight: "600",
                color: selectionMode ? "#6b7280" : PRIMARY,
              }}
            >
              {selectionMode ? "취소" : "선택"}
            </Text>
          </Pressable>
        </View>
      </View>

      {/* ── 에러 메시지 ── */}
      {deleteError ? (
        <View
          style={{ backgroundColor: "#fef2f2", borderRadius: 10, padding: 10 }}
        >
          <Text style={{ fontSize: 13, color: "#ef4444" }}>
            ⚠️ {deleteError}
          </Text>
        </View>
      ) : null}

      {/* ── 현재 페이지 전체 선택 (선택 모드) ── */}
      {selectionMode && (
        <Pressable
          onPress={toggleAllPage}
          style={({ pressed }) => ({
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
            backgroundColor: pressed ? "#e8ebfd" : "#f8f9fa",
            borderRadius: 12,
            paddingHorizontal: 14,
            paddingVertical: 10,
          })}
        >
          <View
            style={{
              width: 22,
              height: 22,
              borderRadius: 4,
              borderWidth: 2,
              borderColor: isAllPageSelected ? PRIMARY : "#d1d5db",
              backgroundColor: isAllPageSelected ? PRIMARY : "#fff",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {isAllPageSelected && (
              <Text style={{ color: "#fff", fontSize: 12, fontWeight: "700" }}>
                ✓
              </Text>
            )}
          </View>
          <Text style={{ fontSize: 13, color: "#374151", fontWeight: "500" }}>
            현재 페이지 전체 선택 ({pageItems.length}개)
          </Text>
        </Pressable>
      )}

      {/* ── 카드 목록 ── */}
      {pageItems.map((item) => {
        const isSelected = selectedIds.includes(item.history_id);
        return (
          <Pressable
            key={item.history_id}
            onPress={() => handleCardPress(item)}
            style={({ pressed }) => ({
              backgroundColor: isSelected
                ? "#eef0fd"
                : pressed
                  ? "#f8f9fa"
                  : "#fff",
              borderRadius: 16,
              borderWidth: isSelected ? 2 : 1,
              borderColor: isSelected ? PRIMARY : "#e5e7eb",
              overflow: "hidden",
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.06,
              shadowRadius: 8,
              elevation: 2,
            })}
          >
            {/* 이미지 */}
            <View style={{ position: "relative" }}>
              {item.image_url ? (
                <Image
                  source={{ uri: item.image_url }}
                  style={{ width: "100%", aspectRatio: 4 / 3 }}
                  resizeMode="cover"
                />
              ) : (
                <View
                  style={{
                    width: "100%",
                    aspectRatio: 4 / 3,
                    backgroundColor: PRIMARY_LIGHT,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Text style={{ fontSize: 48 }}>🐶</Text>
                  <Text
                    style={{ fontSize: 12, color: "#9ca3af", marginTop: 6 }}
                  >
                    이미지 없음
                  </Text>
                </View>
              )}
              {/* My Dog 핀 배지 */}
              {item.is_pinned && !selectionMode && (
                <View
                  style={{
                    position: "absolute",
                    top: 10,
                    left: 10,
                    backgroundColor: "#f59e0b",
                    borderRadius: 12,
                    paddingHorizontal: 10,
                    paddingVertical: 4,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 11,
                      fontWeight: "700",
                      color: "#fff",
                    }}
                  >
                    My Dog
                  </Text>
                </View>
              )}
              {/* 체크 오버레이 */}
              {selectionMode && (
                <View
                  style={{
                    position: "absolute",
                    top: 10,
                    right: 10,
                    width: 28,
                    height: 28,
                    borderRadius: 14,
                    borderWidth: 2.5,
                    borderColor: isSelected ? PRIMARY : "#fff",
                    backgroundColor: isSelected ? PRIMARY : "rgba(0,0,0,0.25)",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {isSelected && (
                    <Text
                      style={{ color: "#fff", fontSize: 14, fontWeight: "800" }}
                    >
                      ✓
                    </Text>
                  )}
                </View>
              )}
            </View>

            {/* 정보 */}
            <View style={{ padding: 14, gap: 8 }}>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 8,
                    flexWrap: "wrap",
                    flex: 1,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 16,
                      fontWeight: "700",
                      color: "#1f2937",
                    }}
                  >
                    {item.breed_name_ko}
                  </Text>
                  {item.is_mixed_breed && (
                    <View
                      style={{
                        backgroundColor: "#fef3c7",
                        borderRadius: 20,
                        paddingHorizontal: 10,
                        paddingVertical: 3,
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 12,
                          color: "#d97706",
                          fontWeight: "600",
                        }}
                      >
                        믹스견
                      </Text>
                    </View>
                  )}
                </View>
                {!selectionMode && (
                  <Pressable
                    onPress={(e) => {
                      e.stopPropagation();
                      handleTogglePin(item);
                    }}
                    style={({ pressed }) => ({
                      paddingHorizontal: 10,
                      paddingVertical: 5,
                      borderRadius: 20,
                      borderWidth: 1,
                      borderColor: item.is_pinned ? "#f59e0b" : "#d1d5db",
                      backgroundColor: item.is_pinned
                        ? "#fffbeb"
                        : pressed
                          ? "#f9fafb"
                          : "#fff",
                    })}
                  >
                    <Text
                      style={{
                        fontSize: 12,
                        fontWeight: "600",
                        color: item.is_pinned ? "#d97706" : "#9ca3af",
                      }}
                    >
                      {item.is_pinned ? "My Dog" : "My Dog"}
                    </Text>
                  </Pressable>
                )}
              </View>
              {item.breed_name_en ? (
                <Text style={{ fontSize: 13, color: "#6b7280" }}>
                  {item.breed_name_en}
                </Text>
              ) : null}
              {item.illustration_url && (
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 10,
                    backgroundColor: "#faf5ff",
                    borderRadius: 12,
                    padding: 8,
                  }}
                >
                  <Image
                    source={{ uri: item.illustration_url }}
                    style={{
                      width: 56,
                      height: 56,
                      borderRadius: 10,
                    }}
                    resizeMode="cover"
                  />
                  <Text
                    style={{
                      fontSize: 12,
                      fontWeight: "600",
                      color: "#7c3aed",
                    }}
                  >
                    AI 일러스트
                  </Text>
                </View>
              )}
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                {item.confidence != null ? (
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <View
                      style={{
                        height: 6,
                        width: 80,
                        backgroundColor: "#e5e7eb",
                        borderRadius: 4,
                        overflow: "hidden",
                      }}
                    >
                      <View
                        style={{
                          height: "100%",
                          width: `${Math.round(item.confidence * 100)}%`,
                          backgroundColor: PRIMARY,
                          borderRadius: 4,
                        }}
                      />
                    </View>
                    <Text
                      style={{
                        fontSize: 13,
                        fontWeight: "700",
                        color: PRIMARY,
                      }}
                    >
                      {Math.round(item.confidence * 100)}%
                    </Text>
                  </View>
                ) : (
                  <View />
                )}
                <View
                  style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
                >
                  <Text style={{ fontSize: 12, color: "#9ca3af" }}>
                    {formatDate(item.created_at)}
                  </Text>
                  {!selectionMode && item.breed_id && (
                    <Text style={{ fontSize: 14, color: "#9ca3af" }}>›</Text>
                  )}
                </View>
              </View>
            </View>
          </Pressable>
        );
      })}

      {/* ── 페이지네이션 ── */}
      {totalPages > 1 && (
        <View
          style={{
            flexDirection: "row",
            justifyContent: "center",
            alignItems: "center",
            gap: 8,
            marginTop: 4,
          }}
        >
          <Pressable
            onPress={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              borderWidth: 1,
              borderColor: page === 0 ? "#e5e7eb" : PRIMARY,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: "#fff",
              opacity: page === 0 ? 0.4 : 1,
            }}
          >
            <Text
              style={{ fontSize: 16, color: page === 0 ? "#9ca3af" : PRIMARY }}
            >
              ‹
            </Text>
          </Pressable>
          {Array.from({ length: totalPages }, (_, i) => (
            <Pressable
              key={i}
              onPress={() => setPage(i)}
              style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: page === i ? PRIMARY : "#fff",
                borderWidth: 1,
                borderColor: page === i ? PRIMARY : "#e5e7eb",
              }}
            >
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: "600",
                  color: page === i ? "#fff" : "#6b7280",
                }}
              >
                {i + 1}
              </Text>
            </Pressable>
          ))}
          <Pressable
            onPress={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={page === totalPages - 1}
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              borderWidth: 1,
              borderColor: page === totalPages - 1 ? "#e5e7eb" : PRIMARY,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: "#fff",
              opacity: page === totalPages - 1 ? 0.4 : 1,
            }}
          >
            <Text
              style={{
                fontSize: 16,
                color: page === totalPages - 1 ? "#9ca3af" : PRIMARY,
              }}
            >
              ›
            </Text>
          </Pressable>
        </View>
      )}

      {/* ── 하단 삭제 버튼 (선택 모드 + 선택 항목 있을 때) ── */}
      {selectionMode && selectedIds.length > 0 && (
        <Pressable
          onPress={handleDelete}
          disabled={deleting}
          style={({ pressed }) => ({
            backgroundColor: pressed ? "#dc2626" : "#ef4444",
            borderRadius: 14,
            paddingVertical: 14,
            alignItems: "center",
            marginTop: 4,
          })}
        >
          {deleting ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={{ fontSize: 15, fontWeight: "700", color: "#fff" }}>
              선택 삭제 ({selectedIds.length}개)
            </Text>
          )}
        </Pressable>
      )}
    </View>
  );
};

// ── 메인 화면 ──
const MyPageScreen = ({ navigation }: Props) => {
  const [tab, setTab] = useState<Tab>("user");

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#fff" }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 20,
          paddingVertical: 14,
          borderBottomWidth: 1,
          borderBottomColor: "#f3f4f6",
        }}
      >
        <Pressable
          onPress={() => navigation.goBack()}
          style={{ marginRight: 12 }}
        >
          <Text style={{ fontSize: 22, color: "#6b7280" }}>←</Text>
        </Pressable>
        <Text style={{ fontSize: 18, fontWeight: "700", color: "#1f2937" }}>
          마이페이지
        </Text>
      </View>

      <View
        style={{
          flexDirection: "row",
          borderBottomWidth: 1,
          borderBottomColor: "#f3f4f6",
        }}
      >
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
            <Text
              style={{
                fontSize: 15,
                fontWeight: "600",
                color: tab === t ? PRIMARY : "#9ca3af",
              }}
            >
              {t === "user" ? "My Profile" : "Dog History"}
            </Text>
          </Pressable>
        ))}
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 20 }}
        keyboardShouldPersistTaps="handled"
      >
        {tab === "user" ? <UserInfoTab /> : <DogHistoryTab />}
      </ScrollView>
    </SafeAreaView>
  );
};

export default MyPageScreen;
