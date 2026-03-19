// S2 로딩 상태 — 스토리보드: 스피너 + "AI가 분석 중입니다..." + 10초 후 변경
import { useState, useEffect } from "react";
import { View, Text, ActivityIndicator } from "react-native";

const LoadingSpinner = () => {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setElapsed((p) => p + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  const message = elapsed < 10 ? "AI가 분석 중입니다..." : "조금만 기다려주세요";

  return (
    <View className="flex-1 items-center justify-center gap-5 px-6">
      <View className="h-20 w-20 items-center justify-center rounded-full bg-primary-light">
        <ActivityIndicator size="large" color="#4361ee" />
      </View>
      <Text className="text-base font-medium text-gray-700">{message}</Text>
      {elapsed >= 5 && (
        <View className="w-48 h-1.5 rounded-full bg-gray-200 overflow-hidden">
          <View
            className="h-full rounded-full bg-primary"
            style={{ width: `${Math.min(100, elapsed * 5)}%` }}
          />
        </View>
      )}
    </View>
  );
};

export default LoadingSpinner;
