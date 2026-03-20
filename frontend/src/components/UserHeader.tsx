import { View, Text, Pressable } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useAuth } from "../context/AuthContext";
import type { RootStackParamList } from "../navigation/RootStack";

type Nav = NativeStackNavigationProp<RootStackParamList>;

const UserHeader = () => {
  const { user, logout } = useAuth();
  const navigation = useNavigation<Nav>();
  if (!user) return null;

  return (
    <View style={{
      paddingHorizontal: 20,
      paddingVertical: 10,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "flex-end",
      gap: 8,
    }}>
      <Pressable
        onPress={() => navigation.navigate("MyPage")}
        style={({ pressed }) => ({
          paddingHorizontal: 10,
          paddingVertical: 4,
          borderRadius: 8,
          borderWidth: 1,
          borderColor: "#d1d5db",
          backgroundColor: pressed ? "#f3f4f6" : "#ffffff",
        })}
      >
        <Text style={{ fontSize: 12, color: "#6b7280" }}>마이페이지</Text>
      </Pressable>

      <Text style={{ fontSize: 13, color: "#6b7280" }}>
        <Text style={{ fontWeight: "700", color: "#1f2937" }}>{user.nickname}</Text>
        {" "}님
      </Text>

      <Pressable
        onPress={logout}
        style={({ pressed }) => ({
          paddingHorizontal: 10,
          paddingVertical: 4,
          borderRadius: 8,
          borderWidth: 1,
          borderColor: "#d1d5db",
          backgroundColor: pressed ? "#f3f4f6" : "#ffffff",
        })}
      >
        <Text style={{ fontSize: 12, color: "#6b7280" }}>로그아웃</Text>
      </Pressable>
    </View>
  );
};

export default UserHeader;
