// S2 에러 상태 — 스토리보드: 에러 유형별 메시지 + "다시 촬영하기" CTA
import { View, Text, Pressable } from "react-native";

interface Props {
  message?: string;
  onRetry?: () => void;
  retryLabel?: string;
}

const ErrorState = ({ message, onRetry, retryLabel }: Props) => (
  <View className="items-center gap-3 rounded-xl bg-risk-high px-6 py-6">
    <Text className="text-3xl">😢</Text>
    <Text className="text-base font-bold text-risk-high-text">
      오류가 발생했습니다
    </Text>
    <Text className="text-center text-sm text-muted">
      {message || "잠시 후 다시 시도해주세요."}
    </Text>
    {onRetry && (
      <Pressable
        className="mt-1 rounded-xl bg-primary px-6 py-3 active:opacity-80"
        onPress={onRetry}
      >
        <Text className="text-center text-sm font-semibold text-white">
          {retryLabel || "다시 시도"}
        </Text>
      </Pressable>
    )}
  </View>
);

export default ErrorState;
