import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/RootStack";
import { signup } from "../api/auth";

type Props = NativeStackScreenProps<RootStackParamList, "Signup">;

interface FormState {
  name: string;
  email: string;
  nickname: string;
  password: string;
  passwordConfirm: string;
  birth_date: string;
  zonecode: string;
  address: string;
  addressDetail: string;
}

interface BasicField {
  label: string;
  key: keyof FormState;
  placeholder: string;
  keyboardType?: "default" | "email-address";
  secureTextEntry?: boolean;
  autoCapitalize?: "none" | "words";
  required?: boolean;
}

const basicFields: BasicField[] = [
  { label: "이름", key: "name", placeholder: "홍길동", autoCapitalize: "words", required: true },
  { label: "이메일", key: "email", placeholder: "email@example.com", keyboardType: "email-address", autoCapitalize: "none", required: true },
  { label: "닉네임", key: "nickname", placeholder: "댕댕이주인", autoCapitalize: "none", required: true },
  { label: "비밀번호 (8자 이상)", key: "password", placeholder: "비밀번호 입력", secureTextEntry: true, autoCapitalize: "none", required: true },
  { label: "비밀번호 확인", key: "passwordConfirm", placeholder: "비밀번호 재입력", secureTextEntry: true, autoCapitalize: "none", required: true },
  { label: "생년월일", key: "birth_date", placeholder: "YYYY-MM-DD (예: 1990-01-15)" },
];

// 다음 우편번호 스크립트 동적 로드 (웹 전용)
function useDaumPostcode() {
  const loaded = useRef(false);

  useEffect(() => {
    if (Platform.OS !== "web" || loaded.current) return;
    const script = document.createElement("script");
    script.src = "https://t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js";
    script.async = true;
    script.onload = () => { loaded.current = true; };
    document.head.appendChild(script);
  }, []);

  const open = (onComplete: (data: { zonecode: string; roadAddress: string }) => void) => {
    if (Platform.OS !== "web") return;
    const w = window as any;
    if (!w.daum?.Postcode) {
      alert("주소 검색 스크립트를 불러오는 중입니다. 잠시 후 다시 시도해주세요.");
      return;
    }
    new w.daum.Postcode({
      oncomplete: (data: any) => {
        onComplete({
          zonecode: data.zonecode,
          roadAddress: data.roadAddress || data.jibunAddress,
        });
      },
    }).open();
  };

  return { open };
}

const SignupScreen = ({ navigation }: Props) => {
  const [form, setForm] = useState<FormState>({
    name: "",
    email: "",
    nickname: "",
    password: "",
    passwordConfirm: "",
    birth_date: "",
    zonecode: "",
    address: "",
    addressDetail: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { open: openPostcode } = useDaumPostcode();

  const set = (key: keyof FormState) => (val: string) =>
    setForm((prev) => ({ ...prev, [key]: val }));

  const handleAddressSearch = () => {
    openPostcode(({ zonecode, roadAddress }) => {
      setForm((prev) => ({ ...prev, zonecode, address: roadAddress, addressDetail: "" }));
    });
  };

  const handleSignup = async () => {
    setError("");

    if (!form.name.trim() || !form.email.trim() || !form.nickname.trim() || !form.password) {
      setError("필수 항목을 모두 입력해주세요.");
      return;
    }
    if (form.password.length < 8) {
      setError("비밀번호는 8자 이상이어야 합니다.");
      return;
    }
    if (form.password !== form.passwordConfirm) {
      setError("비밀번호가 일치하지 않습니다.");
      return;
    }
    if (form.birth_date && !/^\d{4}-\d{2}-\d{2}$/.test(form.birth_date)) {
      setError("생년월일 형식이 올바르지 않습니다. (YYYY-MM-DD)");
      return;
    }

    // 주소 조합: "우편번호 도로명주소 상세주소"
    const fullAddress = [form.zonecode, form.address, form.addressDetail]
      .filter(Boolean)
      .join(" ")
      .trim();

    setLoading(true);
    try {
      await signup({
        name: form.name.trim(),
        email: form.email.trim(),
        nickname: form.nickname.trim(),
        password: form.password,
        birth_date: form.birth_date || undefined,
        address: fullAddress || undefined,
      });
      navigation.navigate("Login");
    } catch (e: any) {
      setError(e.detail || e.message || "회원가입에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#fff" }}>
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 24, paddingVertical: 32 }}
        keyboardShouldPersistTaps="handled"
      >
        <View className="items-center gap-2 mb-8">
          <Text className="text-3xl font-bold text-primary">회원가입</Text>
          <Text className="text-sm text-muted">댕슐랭에 오신 것을 환영합니다!</Text>
        </View>

        <View className="gap-4">
          {/* 기본 필드 */}
          {basicFields.map((field) => (
            <View key={field.key} className="gap-1">
              <Text className="text-sm font-medium text-gray-700">
                {field.label}
                {field.required && <Text className="text-red-500"> *</Text>}
              </Text>
              <TextInput
                className="w-full rounded-xl border border-gray-200 bg-card px-4 py-3 text-base text-gray-900"
                placeholder={field.placeholder}
                placeholderTextColor="#9ca3af"
                keyboardType={field.keyboardType ?? "default"}
                secureTextEntry={field.secureTextEntry}
                autoCapitalize={field.autoCapitalize ?? "sentences"}
                value={form[field.key]}
                onChangeText={set(field.key)}
              />
            </View>
          ))}

          {/* 주소 검색 (카카오/다음 우편번호) */}
          <View className="gap-1">
            <Text className="text-sm font-medium text-gray-700">주소</Text>

            {/* 우편번호 + 검색 버튼 */}
            <View style={{ flexDirection: "row", gap: 8 }}>
              <TextInput
                className="rounded-xl border border-gray-200 bg-card px-4 py-3 text-base text-gray-900"
                style={{ flex: 1 }}
                placeholder="우편번호"
                placeholderTextColor="#9ca3af"
                value={form.zonecode}
                editable={false}
              />
              <Pressable
                onPress={handleAddressSearch}
                style={{
                  backgroundColor: "#f59e0b",
                  borderRadius: 12,
                  paddingHorizontal: 16,
                  paddingVertical: 12,
                  justifyContent: "center",
                }}
              >
                <Text style={{ color: "#fff", fontWeight: "700", fontSize: 14 }}>주소 검색</Text>
              </Pressable>
            </View>

            {/* 도로명 주소 (읽기 전용) */}
            <TextInput
              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-base text-gray-700"
              placeholder="도로명 주소 (주소 검색 후 자동 입력)"
              placeholderTextColor="#9ca3af"
              value={form.address}
              editable={false}
            />

            {/* 상세 주소 */}
            <TextInput
              className="w-full rounded-xl border border-gray-200 bg-card px-4 py-3 text-base text-gray-900"
              placeholder="상세주소 (동/호수 등)"
              placeholderTextColor="#9ca3af"
              value={form.addressDetail}
              onChangeText={set("addressDetail")}
            />
          </View>

          {error ? (
            <Text className="text-sm text-red-500">{error}</Text>
          ) : null}

          <Pressable
            className="mt-2 w-full rounded-xl bg-primary px-6 py-4 active:opacity-80"
            onPress={handleSignup}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text className="text-center text-base font-bold text-white">가입하기</Text>
            )}
          </Pressable>
        </View>

        <View className="mt-8 flex-row items-center justify-center gap-1">
          <Text className="text-sm text-muted">이미 계정이 있으신가요?</Text>
          <Pressable onPress={() => navigation.navigate("Login")}>
            <Text className="text-sm font-semibold text-primary">로그인</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default SignupScreen;
