// 드래그 가능한 플로팅 AI 챗봇 버튼
// 웹: mouse event / 네이티브: PanResponder
import { useRef, useState, useEffect } from "react";
import {
  Animated,
  PanResponder,
  Pressable,
  Text,
  View,
  Platform,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/RootStack";
import { useBreed } from "../context/BreedContext";

const BUTTON_SIZE = 56;

// ── 웹 전용 드래그 버튼 ──
const WebFloatingButton = ({ onPress }: { onPress: () => void }) => {
  const [pos, setPos] = useState({ x: 380, y: 600 });
  const dragging = useRef(false);
  const startMouse = useRef({ x: 0, y: 0 });
  const startPos = useRef({ x: 380, y: 600 });
  const moved = useRef(false);

  const onMouseDown = (e: any) => {
    dragging.current = true;
    moved.current = false;
    startMouse.current = { x: e.clientX, y: e.clientY };
    startPos.current = { ...pos };
    e.preventDefault();
  };

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!dragging.current) return;
      const dx = e.clientX - startMouse.current.x;
      const dy = e.clientY - startMouse.current.y;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) moved.current = true;
      setPos({
        x: Math.max(0, Math.min(420, startPos.current.x + dx)),
        y: Math.max(60, Math.min(window.innerHeight - 80, startPos.current.y + dy)),
      });
    };
    const onMouseUp = () => {
      if (dragging.current && !moved.current) onPress();
      dragging.current = false;
    };
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [pos, onPress]);

  return (
    <div
      onMouseDown={onMouseDown}
      style={{
        position: "absolute",
        left: pos.x,
        top: pos.y,
        width: BUTTON_SIZE,
        height: BUTTON_SIZE,
        borderRadius: BUTTON_SIZE / 2,
        backgroundColor: "#4361ee",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "grab",
        zIndex: 9999,
        boxShadow: "0 4px 16px rgba(67,97,238,0.45)",
        userSelect: "none",
      }}
    >
      <span style={{ fontSize: 26 }}>🤖</span>
    </div>
  );
};

// ── 네이티브 전용 드래그 버튼 ──
const NativeFloatingButton = ({ onPress }: { onPress: () => void }) => {
  const pan = useRef(new Animated.ValueXY({ x: 300, y: 600 })).current;
  const lastPos = useRef({ x: 300, y: 600 });
  const isDragging = useRef(false);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gs) =>
        Math.abs(gs.dx) > 3 || Math.abs(gs.dy) > 3,
      onPanResponderGrant: () => {
        pan.setOffset({ x: lastPos.current.x, y: lastPos.current.y });
        pan.setValue({ x: 0, y: 0 });
        isDragging.current = false;
      },
      onPanResponderMove: (_, gs) => {
        if (Math.abs(gs.dx) > 5 || Math.abs(gs.dy) > 5) isDragging.current = true;
        Animated.event([null, { dx: pan.x, dy: pan.y }], { useNativeDriver: false })(_, gs);
      },
      onPanResponderRelease: (_, gs) => {
        pan.flattenOffset();
        const newX = Math.max(0, lastPos.current.x + gs.dx);
        const newY = Math.max(80, lastPos.current.y + gs.dy);
        lastPos.current = { x: newX, y: newY };
        pan.setValue({ x: newX, y: newY });
        if (!isDragging.current) onPress();
      },
    })
  ).current;

  return (
    <Animated.View
      style={{ position: "absolute", left: pan.x, top: pan.y, zIndex: 9999 }}
      {...panResponder.panHandlers}
    >
      <View
        style={{
          width: BUTTON_SIZE,
          height: BUTTON_SIZE,
          borderRadius: BUTTON_SIZE / 2,
          backgroundColor: "#4361ee",
          alignItems: "center",
          justifyContent: "center",
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.3,
          shadowRadius: 8,
          elevation: 10,
        }}
      >
        <Text style={{ fontSize: 26 }}>🤖</Text>
      </View>
    </Animated.View>
  );
};

// ── 메인 컴포넌트 ──
const FloatingChatButton = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { breedId, breedNameKo } = useBreed();

  const handlePress = () => {
    if (breedId && breedNameKo) {
      navigation.navigate("Chat", { breedId, breedNameKo });
    }
  };

  if (!breedId || !breedNameKo) return null;

  if (Platform.OS === "web") {
    return <WebFloatingButton onPress={handlePress} />;
  }

  return <NativeFloatingButton onPress={handlePress} />;
};

export default FloatingChatButton;
