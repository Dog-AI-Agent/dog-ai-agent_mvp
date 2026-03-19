// 스토리보드: "본 서비스는 수의사 상담을 대체하지 않습니다." — S1, S4 하단
import { View, Text } from "react-native";

const Disclaimer = () => (
  <View className="rounded-xl bg-gray-50 px-4 py-3">
    <Text className="text-center text-xs text-muted">
      ⚠ 본 서비스는 수의사 상담을 대체하지 않습니다.
    </Text>
  </View>
);

export default Disclaimer;
