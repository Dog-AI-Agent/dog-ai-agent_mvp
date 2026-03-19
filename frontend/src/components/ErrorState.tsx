import { View, Text, Pressable } from "react-native";

interface Props {
  message?: string;
  onRetry?: () => void;
}

const ErrorState = ({ message, onRetry }: Props) => (
  <View className="items-center gap-3 rounded-xl bg-red-50 px-6 py-8">
    <Text className="text-lg font-bold text-danger">오류가 발생했습니다</Text>
    <Text className="text-center text-sm text-muted">
      {message || "잠시 후 다시 시도해주세요."}
    </Text>
    {onRetry && (
      <Pressable
        className="mt-2 rounded-lg bg-primary px-6 py-3 active:opacity-80"
        onPress={onRetry}
      >
        <Text className="text-center font-semibold text-white">다시 시도</Text>
      </Pressable>
    )}
  </View>
);

export default ErrorState;
