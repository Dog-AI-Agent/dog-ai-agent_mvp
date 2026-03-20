// 스토리보드: risk_level 뱃지 (높음: 빨강 / 중간: 주황 / 낮음: 초록)
import { View, Text } from "react-native";

interface Props {
  level: string; // "high" | "medium" | "low"
}

const config: Record<string, { bg: string; text: string; label: string }> = {
  high: { bg: "bg-risk-high", text: "text-risk-high-text", label: "높음" },
  medium: {
    bg: "bg-risk-medium",
    text: "text-risk-medium-text",
    label: "중간",
  },
  low: { bg: "bg-risk-low", text: "text-risk-low-text", label: "낮음" },
};

const RiskBadge = ({ level }: Props) => {
  const c = config[level] || config.medium;
  return (
    <View className={`rounded-full px-3 py-1 ${c.bg}`}>
      <Text className={`text-xs font-semibold ${c.text}`}>{c.label}</Text>
    </View>
  );
};

export default RiskBadge;
