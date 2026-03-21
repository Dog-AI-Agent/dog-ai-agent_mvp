import { useState, useEffect, useRef } from "react";
import { View, Text, Animated, Image, Easing } from "react-native";
import { getAnalyses } from "../api/users";

// ── Module-level cache for pinned dog illustration ──
let _cachedPinnedUrl: string | null = null;
let _fetchPromise: Promise<string | null> | null = null;

const fetchPinnedUrl = (): Promise<string | null> => {
  if (_cachedPinnedUrl !== null)
    return Promise.resolve(_cachedPinnedUrl || null);
  if (_fetchPromise) return _fetchPromise;
  _fetchPromise = getAnalyses()
    .then((data) => {
      const pinned = data.find((a) => a.is_pinned && a.illustration_url);
      _cachedPinnedUrl = pinned?.illustration_url ?? "";
      return _cachedPinnedUrl || null;
    })
    .catch(() => {
      _cachedPinnedUrl = "";
      return null;
    });
  return _fetchPromise;
};

/** 핀 변경 시 캐시 무효화 */
export const clearPinnedCache = () => {
  _cachedPinnedUrl = null;
  _fetchPromise = null;
};

// ── Constants ──
const BAR_WIDTH = 260;
const DOG_SIZE = 52;

const LoadingSpinner = () => {
  const [elapsed, setElapsed] = useState(0);
  const [illustrationUrl, setIllustrationUrl] = useState<string | null>(
    _cachedPinnedUrl || null,
  );
  const progressAnim = useRef(new Animated.Value(0)).current;

  // Fetch pinned illustration (cached)
  useEffect(() => {
    fetchPinnedUrl().then((url) => {
      if (url) setIllustrationUrl(url);
    });
  }, []);

  // Elapsed timer for message change
  useEffect(() => {
    const timer = setInterval(() => setElapsed((p) => p + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  // Smooth progress: 0 → 90% over 20 seconds (easing out)
  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: 90,
      duration: 20000,
      useNativeDriver: false,
      easing: Easing.out(Easing.quad),
    }).start();
  }, []);

  const message =
    elapsed < 10 ? "AI가 분석 중입니다..." : "조금만 기다려주세요";

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 100],
    outputRange: ["0%", "100%"],
  });

  const dogTranslateX = progressAnim.interpolate({
    inputRange: [0, 100],
    outputRange: [0, BAR_WIDTH - DOG_SIZE],
  });

  return (
    <View
      style={{
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: 24,
        gap: 16,
      }}
    >
      <Text style={{ fontSize: 16, fontWeight: "500", color: "#374151" }}>
        {message}
      </Text>

      {/* Dog + Progress bar */}
      <View style={{ width: BAR_WIDTH, alignItems: "flex-start" }}>
        {/* Dog illustration walking along the bar */}
        <Animated.View
          style={{
            transform: [{ translateX: dogTranslateX }],
            marginBottom: 8,
            alignItems: "center",
          }}
        >
          {illustrationUrl ? (
            <Image
              source={{ uri: illustrationUrl }}
              style={{
                width: DOG_SIZE,
                height: DOG_SIZE,
                borderRadius: DOG_SIZE / 2,
              }}
              resizeMode="cover"
            />
          ) : (
            <Text style={{ fontSize: 36, lineHeight: DOG_SIZE }}>🐕</Text>
          )}
        </Animated.View>

        {/* Progress bar */}
        <View
          style={{
            width: "100%",
            height: 8,
            borderRadius: 4,
            backgroundColor: "#e5e7eb",
            overflow: "hidden",
          }}
        >
          <Animated.View
            style={{
              height: "100%",
              borderRadius: 4,
              backgroundColor: "#4361ee",
              width: progressWidth,
            }}
          />
        </View>
      </View>

      {elapsed >= 15 && (
        <Text style={{ fontSize: 13, color: "#9ca3af" }}>
          네트워크 상태에 따라 시간이 걸릴 수 있어요
        </Text>
      )}
    </View>
  );
};

export default LoadingSpinner;
