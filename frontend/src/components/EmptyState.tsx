import { View, Text } from "react-native";

interface Props {
  message?: string;
}

const EmptyState = ({ message }: Props) => (
  <View className="items-center gap-2 rounded-xl bg-gray-50 px-6 py-8">
    <Text className="text-lg font-bold text-gray-600">데이터가 없습니다</Text>
    <Text className="text-center text-sm text-muted">
      {message || "해당 품종에 대한 정보가 아직 준비되지 않았습니다."}
    </Text>
  </View>
);

export default EmptyState;
