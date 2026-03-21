import { useState } from "react";
import {
  ActivityIndicator,
  Image,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, { G, Path, Circle } from "react-native-svg";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/RootStack";
import { login } from "../api/auth";
import { useAuth } from "../context/AuthContext";

type Props = NativeStackScreenProps<RootStackParamList, "Login">;

const API_BASE = "http://localhost:8000/api/v1";

/* ── 소셜 아이콘 ── */

const GoogleIcon = () => (
  <Svg width={20} height={20} viewBox="0 0 24 24">
    <Path
      fill="#4285F4"
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
    />
    <Path
      fill="#34A853"
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
    />
    <Path
      fill="#FBBC05"
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
    />
    <Path
      fill="#EA4335"
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
    />
  </Svg>
);

const NaverIcon = () => (
  <Svg width={20} height={20} viewBox="0 0 24 24">
    <Path
      fill="#ffffff"
      d="M16.273 12.845L7.376 0H0v24h7.727V11.155L16.624 24H24V0h-7.727z"
    />
  </Svg>
);

const KakaoIcon = () => (
  <Svg width={20} height={20} viewBox="0 0 24 24">
    <Path
      fill="#191919"
      d="M12 3C6.477 3 2 6.686 2 11.19c0 2.875 1.74 5.4 4.373 6.892l-1.045 3.815c-.094.343.285.62.59.424l4.41-2.916c.55.075 1.112.114 1.672.114 5.523 0 10-3.686 10-8.19C22 6.686 17.523 3 12 3z"
    />
  </Svg>
);

/* ── 소셜 버튼 ── */

const SocialButton = ({
  label,
  backgroundColor,
  textColor,
  borderColor,
  icon,
  onPress,
}: {
  label: string;
  backgroundColor: string;
  textColor: string;
  borderColor?: string;
  icon: React.ReactNode;
  onPress: () => void;
}) => (
  <Pressable
    onPress={onPress}
    style={({ pressed }) => ({
      backgroundColor,
      borderRadius: 12,
      paddingVertical: 14,
      paddingHorizontal: 20,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 10,
      opacity: pressed ? 0.8 : 1,
      marginBottom: 10,
      borderWidth: borderColor ? 1 : 0,
      borderColor: borderColor ?? "transparent",
    })}
  >
    {icon}
    <Text style={{ color: textColor, fontSize: 15, fontWeight: "600" }}>
      {label}
    </Text>
  </Pressable>
);

/* ── 메인 화면 ── */

const LoginScreen = ({ navigation }: Props) => {
  const { login: saveAuth } = useAuth();
  const { width: screenWidth } = useWindowDimensions();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setError("");
    if (!email.trim() || !password) {
      setError("이메일과 비밀번호를 입력해주세요.");
      return;
    }
    setLoading(true);
    try {
      const res = await login({ email: email.trim(), password });
      saveAuth(res.access_token, res.user);
    } catch (e: any) {
      setError(e.detail || e.message || "로그인에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const handleSocialLogin = (provider: "google" | "naver" | "kakao") => {
    if (Platform.OS === "web" && typeof window !== "undefined") {
      window.location.href = `${API_BASE}/auth/${provider}`;
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#fff" }}>
      <View style={{ width: "100%" }}>
        <Image
          source={require("../../assets/logo.png")}
          style={{ width: "100%", height: 220 }}
          resizeMode="cover"
        />
      </View>

      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          paddingHorizontal: 24,
          paddingVertical: 32,
        }}
        keyboardShouldPersistTaps="handled"
      >
        <View className="gap-4">
          <View className="gap-1">
            <Text className="text-sm font-medium text-gray-700">이메일</Text>
            <TextInput
              className="w-full rounded-xl border border-gray-200 bg-card px-4 py-3 text-base text-gray-900"
              placeholder="email@example.com"
              placeholderTextColor="#9ca3af"
              keyboardType="email-address"
              autoCapitalize="none"
              value={email}
              onChangeText={setEmail}
            />
          </View>

          <View className="gap-1">
            <Text className="text-sm font-medium text-gray-700">비밀번호</Text>
            <TextInput
              className="w-full rounded-xl border border-gray-200 bg-card px-4 py-3 text-base text-gray-900"
              placeholder="비밀번호 입력"
              placeholderTextColor="#9ca3af"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
            />
          </View>

          {error ? <Text className="text-sm text-red-500">{error}</Text> : null}

          <Pressable
            className="mt-2 w-full rounded-xl bg-primary px-6 py-4 active:opacity-80"
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text className="text-center text-base font-bold text-white">
                로그인
              </Text>
            )}
          </Pressable>
        </View>

        {/* 구분선 */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            marginVertical: 24,
            gap: 10,
          }}
        >
          <View style={{ flex: 1, height: 1, backgroundColor: "#e5e7eb" }} />
          <Text style={{ color: "#9ca3af", fontSize: 13 }}>또는</Text>
          <View style={{ flex: 1, height: 1, backgroundColor: "#e5e7eb" }} />
        </View>

        {/* 소셜 로그인 버튼 */}
        <SocialButton
          label="구글로 로그인"
          backgroundColor="#ffffff"
          textColor="#374151"
          borderColor="#e5e7eb"
          icon={<GoogleIcon />}
          onPress={() => handleSocialLogin("google")}
        />

        <SocialButton
          label="네이버로 로그인"
          backgroundColor="#03C75A"
          textColor="#ffffff"
          icon={<NaverIcon />}
          onPress={() => handleSocialLogin("naver")}
        />

        <SocialButton
          label="카카오로 로그인"
          backgroundColor="#FEE500"
          textColor="#191919"
          icon={<KakaoIcon />}
          onPress={() => handleSocialLogin("kakao")}
        />

        <View style={{ marginTop: 16, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4 }}>
          <Text style={{ fontSize: 13, color: "#6b7280" }}>계정이 없으신가요?</Text>
          <Pressable onPress={() => navigation.navigate("Signup")}>
            <Text style={{ fontSize: 13, fontWeight: "700", color: "#4361ee" }}>회원가입</Text>
          </Pressable>
        </View>

        {/* 비회원 체험 */}
        <Pressable
          style={{
            marginTop: 12,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: "#e5e7eb",
            paddingVertical: 12,
            alignItems: "center",
          }}
          onPress={() => navigation.navigate("GuestUpload")}
        >
          <Text style={{ fontSize: 13, color: "#6b7280" }}>🐾 로그인 없이 체험하기 (하루 3회)</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
};

export default LoginScreen;
