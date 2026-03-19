// MarkdownRenderer.tsx
// LLM이 반환한 마크다운 텍스트를 구조화된 UI로 렌더링
import { View, Text } from "react-native";

interface Props {
  content: string;
}

type Block =
  | { type: "h3"; text: string }
  | { type: "h4"; text: string }
  | { type: "bullet"; text: string }
  | { type: "numbered"; num: number; text: string }
  | { type: "paragraph"; text: string }
  | { type: "spacer" };

/** **bold** 구문을 파싱해서 Text 컴포넌트 배열로 변환 */
const renderInline = (raw: string, baseStyle?: object) => {
  const parts = raw.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <Text key={i} style={[{ fontWeight: "700", color: "#1f2937" }, baseStyle]}>
          {part.slice(2, -2)}
        </Text>
      );
    }
    return (
      <Text key={i} style={baseStyle}>
        {part}
      </Text>
    );
  });
};

const parseLine = (line: string): Block | null => {
  const trimmed = line.trim();
  if (!trimmed) return { type: "spacer" };

  // ### 헤더
  if (/^###\s+/.test(trimmed)) {
    return { type: "h3", text: trimmed.replace(/^###\s+/, "").replace(/\*\*/g, "") };
  }
  // #### 헤더
  if (/^####\s+/.test(trimmed)) {
    return { type: "h4", text: trimmed.replace(/^####\s+/, "").replace(/\*\*/g, "") };
  }
  // ## 헤더 (혹시 있을 경우)
  if (/^##\s+/.test(trimmed)) {
    return { type: "h3", text: trimmed.replace(/^##\s+/, "").replace(/\*\*/g, "") };
  }
  // 불릿 리스트
  if (/^[-•*]\s+/.test(trimmed)) {
    return { type: "bullet", text: trimmed.replace(/^[-•*]\s+/, "") };
  }
  // 번호 리스트
  const numberedMatch = trimmed.match(/^(\d+)\.\s+(.+)/);
  if (numberedMatch) {
    return { type: "numbered", num: parseInt(numberedMatch[1]), text: numberedMatch[2] };
  }
  // 일반 문단
  return { type: "paragraph", text: trimmed };
};

export default function MarkdownRenderer({ content }: Props) {
  const lines = content.split("\n");
  const blocks: Block[] = [];

  for (const line of lines) {
    const block = parseLine(line);
    if (!block) continue;

    // 연속 spacer 제거
    if (block.type === "spacer") {
      if (blocks.length === 0 || blocks[blocks.length - 1].type === "spacer") continue;
    }

    blocks.push(block);
  }

  // 마지막 spacer 제거
  while (blocks.length > 0 && blocks[blocks.length - 1].type === "spacer") {
    blocks.pop();
  }

  return (
    <View style={{ gap: 4 }}>
      {blocks.map((block, i) => {
        switch (block.type) {
          case "h3":
            return (
              <View key={i} style={{ marginTop: i === 0 ? 0 : 12, marginBottom: 2 }}>
                <Text
                  style={{
                    fontSize: 15,
                    fontWeight: "700",
                    color: "#4361ee",
                    letterSpacing: -0.2,
                  }}
                >
                  {block.text}
                </Text>
                {/* 구분선 */}
                <View
                  style={{
                    marginTop: 3,
                    height: 1.5,
                    backgroundColor: "#eef1ff",
                    borderRadius: 1,
                  }}
                />
              </View>
            );

          case "h4":
            return (
              <Text
                key={i}
                style={{
                  marginTop: 8,
                  marginBottom: 2,
                  fontSize: 13,
                  fontWeight: "700",
                  color: "#374151",
                }}
              >
                {block.text}
              </Text>
            );

          case "bullet":
            return (
              <View
                key={i}
                style={{ flexDirection: "row", alignItems: "flex-start", gap: 8, paddingLeft: 4 }}
              >
                <View
                  style={{
                    width: 5,
                    height: 5,
                    borderRadius: 3,
                    backgroundColor: "#4361ee",
                    marginTop: 6,
                    flexShrink: 0,
                  }}
                />
                <Text
                  style={{ flex: 1, fontSize: 13, color: "#374151", lineHeight: 20 }}
                >
                  {renderInline(block.text, { fontSize: 13, color: "#374151", lineHeight: 20 })}
                </Text>
              </View>
            );

          case "numbered":
            return (
              <View
                key={i}
                style={{ flexDirection: "row", alignItems: "flex-start", gap: 8, paddingLeft: 4 }}
              >
                <View
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: 10,
                    backgroundColor: "#4361ee",
                    alignItems: "center",
                    justifyContent: "center",
                    marginTop: 1,
                    flexShrink: 0,
                  }}
                >
                  <Text style={{ fontSize: 11, fontWeight: "700", color: "#fff" }}>
                    {block.num}
                  </Text>
                </View>
                <Text
                  style={{ flex: 1, fontSize: 13, color: "#374151", lineHeight: 20 }}
                >
                  {renderInline(block.text, { fontSize: 13, color: "#374151", lineHeight: 20 })}
                </Text>
              </View>
            );

          case "paragraph":
            return (
              <Text
                key={i}
                style={{ fontSize: 13, color: "#4b5563", lineHeight: 20 }}
              >
                {renderInline(block.text, { fontSize: 13, color: "#4b5563", lineHeight: 20 })}
              </Text>
            );

          case "spacer":
            return <View key={i} style={{ height: 6 }} />;

          default:
            return null;
        }
      })}
    </View>
  );
}
