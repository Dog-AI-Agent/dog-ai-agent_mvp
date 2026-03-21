import { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/RootStack";
import type { ChatMessage } from "../types";
import {
  createChatSession,
  sendChatMessage,
  sendChatMessageStream,
  getChatHistory,
} from "../api/chat";
import ChatBubble from "../components/ChatBubble";
import UserHeader from "../components/UserHeader";

type Props = NativeStackScreenProps<RootStackParamList, "Chat">;

const ChatScreen = ({ navigation, route }: Props) => {
  const { breedId, breedNameKo, sessionId: existingSessionId } = route.params;
  const [sessionId, setSessionId] = useState<string | null>(
    existingSessionId ?? null,
  );
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const flatListRef = useRef<FlatList>(null);

  // 세션 초기화 또는 기존 세션 복원
  useEffect(() => {
    const init = async () => {
      try {
        if (existingSessionId) {
          const history = await getChatHistory(existingSessionId);
          setMessages(history.messages);
          setSessionId(existingSessionId);
        } else {
          const session = await createChatSession(breedId);
          setSessionId(session.session_id);
        }
      } catch {
        // 세션 생성 실패 시에도 화면은 표시
      } finally {
        setInitializing(false);
      }
    };
    init();
  }, [breedId, existingSessionId]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || !sessionId || sending) return;

    setInput("");
    setSending(true);

    // 낙관적 UI: 사용자 메시지 즉시 표시
    const userMsg: ChatMessage = {
      message_id: `temp-${Date.now()}`,
      role: "user",
      content: text,
      created_at: new Date().toISOString(),
    };

    // 빈 assistant 메시지 미리 추가 (스트리밍 토큰이 여기에 누적)
    const assistantMsg: ChatMessage = {
      message_id: `streaming-${Date.now()}`,
      role: "assistant",
      content: "",
      created_at: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMsg, assistantMsg]);

    sendChatMessageStream(
      sessionId,
      text,
      (token) => {
        setMessages((prev) => {
          const updated = [...prev];
          const last = updated[updated.length - 1];
          updated[updated.length - 1] = {
            ...last,
            content: last.content + token,
          };
          return updated;
        });
      },
      (data) => {
        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = {
            ...updated[updated.length - 1],
            message_id: data.message_id,
          };
          return updated;
        });
        setSending(false);
      },
      () => {
        setMessages((prev) => {
          const updated = [...prev];
          const last = updated[updated.length - 1];
          // 토큰이 하나도 안 왔으면 에러 메시지 표시
          if (!last.content) {
            updated[updated.length - 1] = {
              ...last,
              content: "응답을 가져오지 못했습니다. 다시 시도해주세요.",
            };
          }
          return updated;
        });
        setSending(false);
      },
    );
  };

  if (initializing) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator size="large" color="#4361ee" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: "#fff" }}
      edges={["top", "left", "right"]}
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={0}
      >
        {/* 헤더 */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            borderBottomWidth: 1,
            borderBottomColor: "#f3f4f6",
            paddingHorizontal: 16,
            paddingVertical: 12,
          }}
        >
          <Pressable
            onPress={() => navigation.goBack()}
            style={{ marginRight: 12, padding: 4 }}
          >
            <Text style={{ fontSize: 22, color: "#9ca3af" }}>←</Text>
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 15, fontWeight: "700", color: "#1f2937" }}>
              {breedNameKo} AI 상담
            </Text>
            <Text style={{ fontSize: 11, color: "#9ca3af", marginTop: 1 }}>
              이 품종에 대해 궁금한 점을 물어보세요
            </Text>
          </View>
        </View>

        {/* 메시지 목록 */}
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.message_id}
          renderItem={({ item }) => <ChatBubble message={item} />}
          contentContainerStyle={{ padding: 16, flexGrow: 1 }}
          onContentSizeChange={() =>
            flatListRef.current?.scrollToEnd({ animated: true })
          }
          ListEmptyComponent={
            <View
              style={{
                flex: 1,
                alignItems: "center",
                justifyContent: "center",
                paddingTop: 60,
              }}
            >
              <Text style={{ fontSize: 14, color: "#9ca3af" }}>
                {breedNameKo}에 대해 궁금한 점을 물어보세요!
              </Text>
            </View>
          }
        />

        {/* 타이핑 인디케이터 (첫 토큰 도착 전까지만 표시) */}
        {sending &&
          messages.length > 0 &&
          messages[messages.length - 1].content === "" && (
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
                paddingHorizontal: 20,
                paddingBottom: 4,
              }}
            >
              <ActivityIndicator size="small" color="#4361ee" />
              <Text style={{ fontSize: 12, color: "#9ca3af" }}>
                답변 생성 중...
              </Text>
            </View>
          )}

        {/* 입력 영역 */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "flex-end",
            gap: 8,
            borderTopWidth: 1,
            borderTopColor: "#f3f4f6",
            paddingHorizontal: 16,
            paddingVertical: 12,
          }}
        >
          <TextInput
            style={{
              flex: 1,
              borderRadius: 20,
              backgroundColor: "#f3f4f6",
              paddingHorizontal: 16,
              paddingVertical: 12,
              fontSize: 14,
              color: "#1f2937",
              maxHeight: 100,
            }}
            placeholder="메시지를 입력하세요..."
            placeholderTextColor="#9ca3af"
            value={input}
            onChangeText={setInput}
            onSubmitEditing={handleSend}
            multiline
            maxLength={500}
            editable={!sending}
          />
          <Pressable
            style={{
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 20,
              paddingHorizontal: 16,
              paddingVertical: 12,
              backgroundColor: input.trim() && !sending ? "#4361ee" : "#e5e7eb",
            }}
            onPress={handleSend}
            disabled={!input.trim() || sending}
          >
            <Text
              style={{
                fontSize: 14,
                fontWeight: "700",
                color: input.trim() && !sending ? "#fff" : "#9ca3af",
              }}
            >
              전송
            </Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default ChatScreen;
