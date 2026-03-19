import { View, Text, Pressable, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/RootStack";
import Disclaimer from "../components/Disclaimer";

type Props = NativeStackScreenProps<RootStackParamList, "Landing">;

const steps = [
  { num: "1", title: "사진 업로드", desc: "강아지 사진을 올려주세요" },
  { num: "2", title: "품종 분석", desc: "AI가 품종을 식별합니다" },
  { num: "3", title: "맞춤 레시피", desc: "건강에 좋은 집밥을 추천해요" },
];

const LandingScreen = ({ navigation }: Props) => (
  <SafeAreaView style={{ flex: 1, backgroundColor: "#fff" }}>
    <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: "center", paddingHorizontal: 24, paddingVertical: 32 }}>
      <View className="items-center gap-4">
        <Text className="text-4xl font-bold text-primary">댕슐랭</Text>
        <Text className="text-center text-lg text-gray-700">
          강아지 사진 한 장으로{"\n"}품종 식별부터 맞춤 레시피까지
        </Text>
        <Text className="text-center text-sm text-muted">
          AI가 우리 강아지의 품종을 분석하고,{"\n"}유전병 위험에 맞는 건강
          레시피를 추천해 드립니다.
        </Text>

        <Pressable
          className="mt-4 w-full rounded-xl bg-primary px-6 py-4 active:opacity-80"
          onPress={() => navigation.navigate("Upload")}
        >
          <Text className="text-center text-lg font-bold text-white">
            우리 강아지 분석하기
          </Text>
        </Pressable>
      </View>

      <View className="mt-10 gap-3">
        {steps.map((s) => (
          <View
            key={s.num}
            className="flex-row items-center gap-4 rounded-xl bg-card px-4 py-4"
          >
            <View className="h-10 w-10 items-center justify-center rounded-full bg-primary">
              <Text className="text-lg font-bold text-white">{s.num}</Text>
            </View>
            <View className="flex-1">
              <Text className="text-base font-semibold text-gray-800">
                {s.title}
              </Text>
              <Text className="text-sm text-muted">{s.desc}</Text>
            </View>
          </View>
        ))}
      </View>

      <Disclaimer />
    </ScrollView>
  </SafeAreaView>
);

export default LandingScreen;
