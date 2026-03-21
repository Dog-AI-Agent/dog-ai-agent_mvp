import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/RootStack";
import type { CommunityPost, CommunityCategory } from "../types";
import { getPosts } from "../api/community";
import UserHeader from "../components/UserHeader";

type Props = NativeStackScreenProps<RootStackParamList, "CommunityHome">;

const PRIMARY = "#4361EE";
const PAGE_SIZE = 20;

const CATEGORIES: { key: CommunityCategory | "all"; label: string }[] = [
  { key: "all", label: "전체" },
  { key: "recipe", label: "레시피 공유" },
  { key: "general_qna", label: "일반 Q&A" },
  { key: "health_qna", label: "건강 Q&A" },
  { key: "free", label: "자유" },
];

const CATEGORY_LABEL: Record<CommunityCategory, string> = {
  recipe: "레시피",
  general_qna: "일반 Q&A",
  health_qna: "건강 Q&A",
  free: "자유",
};

const formatDate = (iso: string) => {
  try {
    const d = new Date(iso);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    if (diff < 60000) return "방금 전";
    if (diff < 3600000) return `${Math.floor(diff / 60000)}분 전`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}시간 전`;
    return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
  } catch {
    return iso;
  }
};

const CommunityHomeScreen = ({ navigation }: Props) => {
  const [category, setCategory] = useState<CommunityCategory | "all">("all");
  const [sort, setSort] = useState<"latest" | "popular">("latest");
  const [search, setSearch] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [offset, setOffset] = useState(0);

  const fetchPosts = useCallback(
    async (reset = false) => {
      const newOffset = reset ? 0 : offset;
      if (reset) setLoading(true);
      else setLoadingMore(true);

      try {
        const cat = category === "all" ? undefined : category;
        const result = await getPosts(
          cat,
          sort,
          searchQuery || undefined,
          PAGE_SIZE,
          newOffset,
        );
        if (reset) {
          setPosts(result.posts);
        } else {
          setPosts((prev) => [...prev, ...result.posts]);
        }
        setTotal(result.total);
        setOffset(newOffset + result.posts.length);
      } catch (e: any) {
        console.log("[Community] 로드 실패:", e.message);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [category, sort, searchQuery, offset],
  );

  useEffect(() => {
    setOffset(0);
    fetchPosts(true);
  }, [category, sort, searchQuery]);

  const handleSearch = () => {
    setSearchQuery(search.trim());
  };

  const handleEndReached = () => {
    if (!loadingMore && posts.length < total) {
      fetchPosts(false);
    }
  };

  const renderPost = ({ item }: { item: CommunityPost }) => (
    <Pressable
      onPress={() =>
        navigation.navigate("CommunityPostDetail", { postId: item.post_id })
      }
      style={({ pressed }) => ({
        backgroundColor: pressed ? "#f9fafb" : "#fff",
        borderBottomWidth: 1,
        borderBottomColor: "#f3f4f6",
        paddingHorizontal: 20,
        paddingVertical: 16,
      })}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          marginBottom: 6,
        }}
      >
        <View
          style={{
            backgroundColor: "#eef0fd",
            borderRadius: 12,
            paddingHorizontal: 8,
            paddingVertical: 2,
          }}
        >
          <Text style={{ fontSize: 11, fontWeight: "600", color: PRIMARY }}>
            {CATEGORY_LABEL[item.category]}
          </Text>
        </View>
        <Text style={{ fontSize: 12, color: "#9ca3af" }}>{item.nickname}</Text>
        <Text style={{ fontSize: 12, color: "#d1d5db" }}>|</Text>
        <Text style={{ fontSize: 12, color: "#9ca3af" }}>
          {formatDate(item.created_at)}
        </Text>
      </View>

      <Text
        style={{
          fontSize: 15,
          fontWeight: "600",
          color: "#1f2937",
          marginBottom: 4,
        }}
        numberOfLines={2}
      >
        {item.title}
      </Text>
      <Text
        style={{ fontSize: 13, color: "#6b7280", marginBottom: 10 }}
        numberOfLines={2}
      >
        {item.content}
      </Text>

      <View style={{ flexDirection: "row", alignItems: "center", gap: 16 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
          <Text
            style={{
              fontSize: 13,
              color: item.is_liked ? "#ef4444" : "#9ca3af",
            }}
          >
            {item.is_liked ? "\u2764" : "\u2661"}
          </Text>
          <Text style={{ fontSize: 12, color: "#9ca3af" }}>
            {item.like_count}
          </Text>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
          <Text style={{ fontSize: 13, color: "#9ca3af" }}>
            {"\uD83D\uDCAC"}
          </Text>
          <Text style={{ fontSize: 12, color: "#9ca3af" }}>
            {item.comment_count}
          </Text>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
          <Text style={{ fontSize: 13, color: "#9ca3af" }}>
            {"\uD83D\uDC41"}
          </Text>
          <Text style={{ fontSize: 12, color: "#9ca3af" }}>
            {item.view_count}
          </Text>
        </View>
        {item.images.length > 0 && (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <Text style={{ fontSize: 13, color: "#9ca3af" }}>
              {"\uD83D\uDDBC"}
            </Text>
            <Text style={{ fontSize: 12, color: "#9ca3af" }}>
              {item.images.length}
            </Text>
          </View>
        )}
      </View>
    </Pressable>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#fff" }}>
      {/* 헤더 */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 20,
          paddingVertical: 14,
          borderBottomWidth: 1,
          borderBottomColor: "#f3f4f6",
        }}
      >
        <Pressable
          onPress={() => navigation.goBack()}
          style={{ marginRight: 12 }}
        >
          <Text style={{ fontSize: 22, color: "#6b7280" }}>{"\u2190"}</Text>
        </Pressable>
        <Text
          style={{ fontSize: 18, fontWeight: "700", color: "#1f2937", flex: 1 }}
        >
          커뮤니티
        </Text>
      </View>

      {/* 카테고리 탭 */}
      <View style={{ borderBottomWidth: 1, borderBottomColor: "#f3f4f6" }}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={CATEGORIES}
          keyExtractor={(item) => item.key}
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingVertical: 10,
            gap: 8,
          }}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => setCategory(item.key)}
              style={{
                paddingHorizontal: 16,
                paddingVertical: 8,
                borderRadius: 20,
                backgroundColor: category === item.key ? PRIMARY : "#f3f4f6",
              }}
            >
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: "600",
                  color: category === item.key ? "#fff" : "#6b7280",
                }}
              >
                {item.label}
              </Text>
            </Pressable>
          )}
        />
      </View>

      {/* 검색 + 정렬 */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 20,
          paddingVertical: 10,
          gap: 10,
          borderBottomWidth: 1,
          borderBottomColor: "#f3f4f6",
        }}
      >
        <View
          style={{
            flex: 1,
            flexDirection: "row",
            alignItems: "center",
            backgroundColor: "#f3f4f6",
            borderRadius: 12,
            paddingHorizontal: 12,
          }}
        >
          <TextInput
            value={search}
            onChangeText={setSearch}
            onSubmitEditing={handleSearch}
            placeholder="검색어를 입력하세요"
            placeholderTextColor="#9ca3af"
            returnKeyType="search"
            style={{
              flex: 1,
              fontSize: 14,
              paddingVertical: 10,
              color: "#1f2937",
            }}
          />
          {search.length > 0 && (
            <Pressable
              onPress={() => {
                setSearch("");
                setSearchQuery("");
              }}
            >
              <Text style={{ fontSize: 16, color: "#9ca3af" }}>{"\u2715"}</Text>
            </Pressable>
          )}
        </View>
        <Pressable
          onPress={() => setSort(sort === "latest" ? "popular" : "latest")}
          style={{
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: 12,
            paddingVertical: 10,
            borderRadius: 12,
            backgroundColor: "#f3f4f6",
          }}
        >
          <Text style={{ fontSize: 13, fontWeight: "600", color: "#374151" }}>
            {sort === "latest" ? "최신순" : "인기순"}
          </Text>
        </Pressable>
      </View>

      {/* 게시글 목록 */}
      {loading ? (
        <View
          style={{ flex: 1, justifyContent: "center", alignItems: "center" }}
        >
          <ActivityIndicator size="large" color={PRIMARY} />
        </View>
      ) : posts.length === 0 ? (
        <View
          style={{
            flex: 1,
            justifyContent: "center",
            alignItems: "center",
            gap: 12,
          }}
        >
          <Text style={{ fontSize: 40 }}>{"\uD83D\uDCDD"}</Text>
          <Text style={{ fontSize: 16, fontWeight: "700", color: "#1f2937" }}>
            게시글이 없습니다
          </Text>
          <Text style={{ fontSize: 14, color: "#9ca3af", textAlign: "center" }}>
            첫 번째 글을 작성해보세요!
          </Text>
        </View>
      ) : (
        <FlatList
          data={posts}
          keyExtractor={(item) => item.post_id}
          renderItem={renderPost}
          onEndReached={handleEndReached}
          onEndReachedThreshold={0.3}
          ListFooterComponent={
            loadingMore ? (
              <View style={{ paddingVertical: 20 }}>
                <ActivityIndicator size="small" color={PRIMARY} />
              </View>
            ) : null
          }
        />
      )}

      {/* 플로팅 글쓰기 버튼 */}
      <Pressable
        onPress={() =>
          navigation.navigate("CommunityPostCreate", {
            category: category === "all" ? undefined : category,
          })
        }
        style={({ pressed }) => ({
          position: "absolute",
          right: 20,
          bottom: 30,
          width: 56,
          height: 56,
          borderRadius: 28,
          backgroundColor: pressed ? "#3451d1" : PRIMARY,
          alignItems: "center",
          justifyContent: "center",
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.2,
          shadowRadius: 8,
          elevation: 6,
        })}
      >
        <Text style={{ fontSize: 28, color: "#fff", marginTop: -2 }}>+</Text>
      </Pressable>
    </SafeAreaView>
  );
};

export default CommunityHomeScreen;
