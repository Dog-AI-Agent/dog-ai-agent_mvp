import { View, Text } from "react-native";
import type { ChatMessage } from "../types";

interface Props {
  message: ChatMessage;
}

const ChatBubble = ({ message }: Props) => {
  const isUser = message.role === "user";

  return (
    <View className={`flex-row ${isUser ? "justify-end" : "justify-start"} mb-3`}>
      <View
        className={`max-w-[80%] rounded-2xl px-4 py-3 ${
          isUser
            ? "rounded-br-sm bg-primary"
            : "rounded-bl-sm bg-gray-100"
        }`}
      >
        <Text
          className={`text-sm leading-5 ${
            isUser ? "text-white" : "text-gray-800"
          }`}
        >
          {message.content}
        </Text>
      </View>
    </View>
  );
};

export default ChatBubble;
