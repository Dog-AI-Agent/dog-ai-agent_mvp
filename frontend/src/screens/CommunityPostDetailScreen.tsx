import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/RootStack";
import type {
  CommunityPost,
  CommunityComment,
  CommunityCategory,
} from "../types";
import { useAuth } from "../context/AuthContext";
import {
  getPost,
  toggleLike,
  getComments,
  createComment,
  deleteComment,
  deletePost,
} from "../api/community";

type Props = NativeStackScreenProps<RootStackParamList, "CommunityPostDetail">;

const PRIMARY = "#4361EE";

const CATEGORY_LABEL: Record<CommunityCategory, string> = {
  recipe: "레시피 공유",
  general_qna: "일반 Q&A",
  health_qna: "건강 Q&A",
  free: "자유 게시판",
};

const formatDate = (iso: string) => {
  try {
    const d = new Date(iso);
    return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  } catch {
    return iso;
  }
};

const CommunityPostDetailScreen = ({ navigation, route }: Props) => {
  const { postId } = route.params;
  const { user } = useAuth();
  const [post, setPost] = useState<CommunityPost | null>(null);
  const [comments, setComments] = useState<CommunityComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [commentText, setCommentText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [liking, setLiking] = useState(false);

  const load = useCallback(async () => {
    try {
      const [postData, commentsData] = await Promise.all([
        getPost(postId),
        getComments(postId),
      ]);
      setPost(postData);
      setComments(commentsData);
    } catch (e: any) {
      console.log("[PostDetail] 로드 실패:", e.message);
    } finally {
      setLoading(false);
    }
  }, [postId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleLike = async () => {
    if (liking || !post) return;
    setLiking(true);
    try {
      const result = await toggleLike(postId);
      setPost((prev) =>
        prev
          ? { ...prev, is_liked: result.liked, like_count: result.like_count }
          : prev,
      );
    } catch (e: any) {
      console.log("[PostDetail] 좋아요 실패:", e.message);
    } finally {
      setLiking(false);
    }
  };

  const handleCommentSubmit = async () => {
    if (!commentText.trim() || submitting) return;
    setSubmitting(true);
    try {
      const newComment = await createComment(postId, commentText.trim());
      setComments((prev) => [...prev, newComment]);
      setCommentText("");
      setPost((prev) =>
        prev ? { ...prev, comment_count: prev.comment_count + 1 } : prev,
      );
    } catch (e: any) {
      console.log("[PostDetail] 댓글 작성 실패:", e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteComment = (commentId: string) => {
    const doDelete = async () => {
      try {
        await deleteComment(commentId);
        setComments((prev) => prev.filter((c) => c.comment_id !== commentId));
        setPost((prev) =>
          prev
            ? { ...prev, comment_count: Math.max(0, prev.comment_count - 1) }
            : prev,
        );
      } catch (e: any) {
        console.log("[PostDetail] 댓글 삭제 실패:", e.message);
      }
    };

    if (Platform.OS === "web") {
      if (window.confirm("댓글을 삭제할까요?")) doDelete();
    } else {
      Alert.alert("삭제 확인", "댓글을 삭제할까요?", [
        { text: "취소", style: "cancel" },
        { text: "삭제", style: "destructive", onPress: doDelete },
      ]);
    }
  };

  const handleDeletePost = () => {
    const doDelete = async () => {
      try {
        await deletePost(postId);
        navigation.goBack();
      } catch (e: any) {
        console.log("[PostDetail] 게시글 삭제 실패:", e.message);
      }
    };

    if (Platform.OS === "web") {
      if (window.confirm("게시글을 삭제할까요?")) doDelete();
    } else {
      Alert.alert("삭제 확인", "게시글을 삭제할까요?", [
        { text: "취소", style: "cancel" },
        { text: "삭제", style: "destructive", onPress: doDelete },
      ]);
    }
  };

  if (loading) {
    return (
      <SafeAreaView
        style={{
          flex: 1,
          backgroundColor: "#fff",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <ActivityIndicator size="large" color={PRIMARY} />
      </SafeAreaView>
    );
  }

  if (!post) {
    return (
      <SafeAreaView
        style={{
          flex: 1,
          backgroundColor: "#fff",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <Text style={{ fontSize: 16, color: "#6b7280" }}>
          게시글을 찾을 수 없습니다.
        </Text>
        <Pressable
          onPress={() => navigation.goBack()}
          style={{ marginTop: 16 }}
        >
          <Text style={{ fontSize: 14, color: PRIMARY, fontWeight: "600" }}>
            돌아가기
          </Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const isOwner = user?.user_id === post.user_id;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#fff" }}>
      {/* 헤더 */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingHorizontal: 20,
          paddingVertical: 14,
          borderBottomWidth: 1,
          borderBottomColor: "#f3f4f6",
        }}
      >
        <Pressable onPress={() => navigation.goBack()}>
          <Text style={{ fontSize: 22, color: "#6b7280" }}>{"\u2190"}</Text>
        </Pressable>
        {isOwner && (
          <View style={{ flexDirection: "row", gap: 12 }}>
            <Pressable
              onPress={() =>
                navigation.navigate("CommunityPostEdit", { postId })
              }
            >
              <Text style={{ fontSize: 14, color: PRIMARY, fontWeight: "600" }}>
                수정
              </Text>
            </Pressable>
            <Pressable onPress={handleDeletePost}>
              <Text
                style={{ fontSize: 14, color: "#ef4444", fontWeight: "600" }}
              >
                삭제
              </Text>
            </Pressable>
          </View>
        )}
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 80 }}>
        {/* 게시글 본문 */}
        <View style={{ padding: 20 }}>
          {/* 카테고리 + 메타 */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
              marginBottom: 12,
            }}
          >
            <View
              style={{
                backgroundColor: "#eef0fd",
                borderRadius: 12,
                paddingHorizontal: 10,
                paddingVertical: 4,
              }}
            >
              <Text style={{ fontSize: 12, fontWeight: "600", color: PRIMARY }}>
                {CATEGORY_LABEL[post.category]}
              </Text>
            </View>
          </View>

          <Text
            style={{
              fontSize: 20,
              fontWeight: "700",
              color: "#1f2937",
              marginBottom: 8,
            }}
          >
            {post.title}
          </Text>

          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
              marginBottom: 20,
            }}
          >
            <Text style={{ fontSize: 14, fontWeight: "500", color: "#374151" }}>
              {post.nickname}
            </Text>
            <Text style={{ fontSize: 13, color: "#9ca3af" }}>
              {formatDate(post.created_at)}
            </Text>
            <Text style={{ fontSize: 12, color: "#d1d5db" }}>
              조회 {post.view_count}
            </Text>
          </View>

          {/* 이미지 갤러리 */}
          {post.images.length > 0 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{ marginBottom: 20 }}
              contentContainerStyle={{ gap: 10 }}
            >
              {post.images.map((img, idx) => (
                <Image
                  key={img.id}
                  source={{ uri: img.image_url }}
                  style={{ width: 280, height: 200, borderRadius: 12 }}
                  resizeMode="cover"
                />
              ))}
            </ScrollView>
          )}

          {/* 본문 */}
          <Text
            style={{
              fontSize: 15,
              lineHeight: 24,
              color: "#374151",
              marginBottom: 20,
            }}
          >
            {post.content}
          </Text>

          {/* 레시피 데이터 (recipe 카테고리) */}
          {post.category === "recipe" && post.recipe_data && (
            <View
              style={{
                backgroundColor: "#faf5ff",
                borderRadius: 16,
                padding: 16,
                marginBottom: 20,
                gap: 16,
              }}
            >
              {/* 재료 */}
              {post.recipe_data.ingredients &&
                post.recipe_data.ingredients.length > 0 && (
                  <View>
                    <Text
                      style={{
                        fontSize: 15,
                        fontWeight: "700",
                        color: "#7c3aed",
                        marginBottom: 10,
                      }}
                    >
                      재료
                    </Text>
                    {post.recipe_data.ingredients.map((ing, idx) => (
                      <View
                        key={idx}
                        style={{
                          flexDirection: "row",
                          justifyContent: "space-between",
                          paddingVertical: 6,
                          borderBottomWidth:
                            idx < post.recipe_data!.ingredients.length - 1
                              ? 1
                              : 0,
                          borderBottomColor: "#ede9fe",
                        }}
                      >
                        <Text style={{ fontSize: 14, color: "#374151" }}>
                          {ing.name}
                        </Text>
                        <Text style={{ fontSize: 14, color: "#6b7280" }}>
                          {ing.amount}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}

              {/* 조리단계 */}
              {post.recipe_data.steps && post.recipe_data.steps.length > 0 && (
                <View>
                  <Text
                    style={{
                      fontSize: 15,
                      fontWeight: "700",
                      color: "#7c3aed",
                      marginBottom: 10,
                    }}
                  >
                    조리 단계
                  </Text>
                  {post.recipe_data.steps.map((step, idx) => (
                    <View
                      key={idx}
                      style={{ flexDirection: "row", gap: 10, marginBottom: 8 }}
                    >
                      <View
                        style={{
                          width: 24,
                          height: 24,
                          borderRadius: 12,
                          backgroundColor: "#7c3aed",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <Text
                          style={{
                            fontSize: 12,
                            fontWeight: "700",
                            color: "#fff",
                          }}
                        >
                          {idx + 1}
                        </Text>
                      </View>
                      <Text
                        style={{
                          flex: 1,
                          fontSize: 14,
                          color: "#374151",
                          lineHeight: 22,
                        }}
                      >
                        {step}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}

          {/* 좋아요 버튼 */}
          <Pressable
            onPress={handleLike}
            disabled={liking}
            style={({ pressed }) => ({
              flexDirection: "row",
              alignItems: "center",
              alignSelf: "flex-start",
              gap: 6,
              paddingHorizontal: 16,
              paddingVertical: 10,
              borderRadius: 24,
              borderWidth: 1,
              borderColor: post.is_liked ? "#ef4444" : "#e5e7eb",
              backgroundColor: pressed
                ? "#fef2f2"
                : post.is_liked
                  ? "#fff5f5"
                  : "#fff",
            })}
          >
            <Text style={{ fontSize: 18 }}>
              {post.is_liked ? "\u2764\uFE0F" : "\uD83E\uDD0D"}
            </Text>
            <Text
              style={{
                fontSize: 14,
                fontWeight: "600",
                color: post.is_liked ? "#ef4444" : "#6b7280",
              }}
            >
              {post.like_count}
            </Text>
          </Pressable>
        </View>

        {/* 댓글 영역 */}
        <View
          style={{
            borderTopWidth: 8,
            borderTopColor: "#f3f4f6",
            padding: 20,
          }}
        >
          <Text
            style={{
              fontSize: 15,
              fontWeight: "700",
              color: "#1f2937",
              marginBottom: 16,
            }}
          >
            댓글 {comments.length}
          </Text>

          {comments.length === 0 ? (
            <Text
              style={{
                fontSize: 14,
                color: "#9ca3af",
                textAlign: "center",
                paddingVertical: 20,
              }}
            >
              아직 댓글이 없습니다. 첫 댓글을 남겨보세요!
            </Text>
          ) : (
            comments.map((comment) => (
              <View
                key={comment.comment_id}
                style={{
                  paddingVertical: 12,
                  borderBottomWidth: 1,
                  borderBottomColor: "#f3f4f6",
                }}
              >
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 6,
                  }}
                >
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 13,
                        fontWeight: "600",
                        color: "#374151",
                      }}
                    >
                      {comment.nickname}
                    </Text>
                    <Text style={{ fontSize: 12, color: "#9ca3af" }}>
                      {formatDate(comment.created_at)}
                    </Text>
                  </View>
                  {user?.user_id === comment.user_id && (
                    <Pressable
                      onPress={() => handleDeleteComment(comment.comment_id)}
                    >
                      <Text style={{ fontSize: 12, color: "#ef4444" }}>
                        삭제
                      </Text>
                    </Pressable>
                  )}
                </View>
                <Text
                  style={{ fontSize: 14, color: "#374151", lineHeight: 20 }}
                >
                  {comment.content}
                </Text>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      {/* 댓글 입력 (하단 고정) */}
      <View
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 16,
          paddingVertical: 10,
          backgroundColor: "#fff",
          borderTopWidth: 1,
          borderTopColor: "#e5e7eb",
          gap: 10,
        }}
      >
        <TextInput
          value={commentText}
          onChangeText={setCommentText}
          placeholder="댓글을 입력하세요..."
          placeholderTextColor="#9ca3af"
          style={{
            flex: 1,
            fontSize: 14,
            paddingHorizontal: 14,
            paddingVertical: 10,
            borderRadius: 24,
            backgroundColor: "#f3f4f6",
            color: "#1f2937",
          }}
          onSubmitEditing={handleCommentSubmit}
          returnKeyType="send"
        />
        <Pressable
          onPress={handleCommentSubmit}
          disabled={!commentText.trim() || submitting}
          style={({ pressed }) => ({
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor:
              !commentText.trim() || submitting
                ? "#e5e7eb"
                : pressed
                  ? "#3451d1"
                  : PRIMARY,
            alignItems: "center",
            justifyContent: "center",
          })}
        >
          {submitting ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={{ fontSize: 16, color: "#fff", fontWeight: "700" }}>
              {"\u2191"}
            </Text>
          )}
        </Pressable>
      </View>
    </SafeAreaView>
  );
};

export default CommunityPostDetailScreen;
