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
import { createChatSession, sendChatMessage, getChatHistory } from "../api/chat";
import ChatBubble from "../components/ChatBubble";
import UserHeader from "../components/UserHeader";

type Props = NativeStackScreenProps<RootStackParamList, "Chat">;

const ChatScreen = ({ navigation, route }: Props) => {
  const { breedId, breedNameKo, sessionId: existingSessionId } = route.params;
  const [sessionId, setSessionId] = useState<string | null>(existingSessionId ?? null);
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
    setMessages((prev) => [...prev, userMsg]);

    try {
      const response = await sendChatMessage(sessionId, text);
      setMessages((prev) => [...prev, response]);
    } catch {
      const errorMsg: ChatMessage = {
        message_id: `error-${Date.now()}`,
        role: "assistant",
        content: "응답을 가져오지 못했습니다. 다시 시도해주세요.",
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setSending(false);
    }
  };

  if (initializing) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator size="large" color="#4361ee" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-white" edges={["top", "left", "right"]}>
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={0}
      >
        {/* 헤더 */}
        <View className="flex-row items-center border-b border-gray-100 px-4 py-3">
          <Pressable onPress={() => navigation.goBack()} className="mr-3 p-1">
            <Text className="text-2xl text-gray-400">←</Text>
          </Pressable>
          <View className="flex-1">
            <Text className="text-base font-bold text-gray-800">
              {breedNameKo} AI 상담
            </Text>
            <Text className="text-xs text-muted">
              이 품종에 대해 궁금한 점을 물어보세요
            </Text>
          </View>
          <UserHeader />
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
            <View className="flex-1 items-center justify-center">
              <Text className="text-sm text-muted">
                {breedNameKo}에 대해 궁금한 점을 물어보세요!
              </Text>
            </View>
          }
        />

        {/* 타이핑 인디케이터 */}
        {sending && (
          <View className="flex-row items-center gap-2 px-5 pb-1">
            <ActivityIndicator size="small" color="#4361ee" />
            <Text className="text-xs text-muted">답변 생성 중...</Text>
          </View>
        )}

        {/* 입력 영역 */}
        <View className="flex-row items-end gap-2 border-t border-gray-100 px-4 py-3">
          <TextInput
            className="flex-1 rounded-2xl bg-gray-100 px-4 py-3 text-sm text-gray-800"
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
            className={`items-center justify-center rounded-full px-4 py-3 ${
              input.trim() && !sending ? "bg-primary" : "bg-gray-200"
            }`}
            onPress={handleSend}
            disabled={!input.trim() || sending}
          >
            <Text
              className={`text-sm font-bold ${
                input.trim() && !sending ? "text-white" : "text-gray-400"
              }`}
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
