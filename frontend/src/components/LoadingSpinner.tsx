import { useState, useEffect } from "react";
import { View, Text, ActivityIndicator } from "react-native";

const LoadingSpinner = () => {
  const [showExtraMsg, setShowExtraMsg] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setShowExtraMsg(true), 10000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <View className="flex-1 items-center justify-center gap-4">
      <ActivityIndicator size="large" color="#4361ee" />
      <Text className="text-base text-muted">분석 중...</Text>
      {showExtraMsg && (
        <Text className="text-sm text-muted">조금만 기다려주세요</Text>
      )}
    </View>
  );
};

export default LoadingSpinner;
