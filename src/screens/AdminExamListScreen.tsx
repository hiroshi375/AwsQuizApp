import { useCallback, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Pressable,
    RefreshControl,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import AppButton from "../components/AppButton";
import { client } from "../lib/client";
import type { RootStackParamList } from "../navigation/RootNavigator";

type Props = NativeStackScreenProps<RootStackParamList, "AdminExamList">;

type ExamItem = {
    id: string;
    code?: string | null;
    title?: string | null;
    description?: string | null;
    passScore?: number | null;
    totalQuestions?: number | null;
    timeLimitMinutes?: number | null;
    isPublished?: boolean | null;
    createdAt?: string | null;
    updatedAt?: string | null;
};

export default function AdminExamListScreen({ navigation }: Props) {
    const [exams, setExams] = useState<ExamItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const loadExams = useCallback(async (showLoading: boolean = true) => {
        try {
            if (showLoading) {
                setLoading(true);
            }

            const result = await client.models.Exam.list({
                limit: 1000,
            });

            if (result.errors) {
                console.error("Exam list errors:", result.errors);
                Alert.alert("エラー", "試験情報の取得に失敗しました。");
                return;
            }

            const items = ((result.data ?? []) as ExamItem[]).sort((a, b) => {
                const aCode = a.code ?? "";
                const bCode = b.code ?? "";

                return aCode.localeCompare(bCode);
            });

            setExams(items);
        } catch (error) {
            console.error("Exam list unexpected error:", error);
            Alert.alert("エラー", "試験情報の取得中にエラーが発生しました。");
        } finally {
            if (showLoading) {
                setLoading(false);
            }
        }
    }, []);

    useFocusEffect(
        useCallback(() => {
            void loadExams(true);
        }, [loadExams]),
    );

    const refreshExams = async () => {
        setRefreshing(true);

        try {
            await loadExams(false);
        } finally {
            setRefreshing(false);
        }
    };

    const togglePublished = async (exam: ExamItem) => {
        try {
            const nextPublished = !exam.isPublished;

            const result = await client.models.Exam.update({
                id: exam.id,
                isPublished: nextPublished,
            });

            if (result.errors) {
                console.error("Exam publish update errors:", result.errors);
                Alert.alert("エラー", "公開状態の更新に失敗しました。");
                return;
            }

            setExams((current) =>
                current.map((item) =>
                    item.id === exam.id
                        ? {
                              ...item,
                              isPublished: nextPublished,
                          }
                        : item,
                ),
            );
        } catch (error) {
            console.error("Exam publish update unexpected error:", error);
            Alert.alert("エラー", "公開状態の更新中にエラーが発生しました。");
        }
    };

    const renderExam = ({ item }: { item: ExamItem }) => {
        return (
            <View style={styles.card}>
                <View style={styles.cardHeader}>
                    <View style={styles.titleArea}>
                        <Text style={styles.examCode}>{item.code}</Text>
                        <Text style={styles.examTitle}>
                            {item.title ?? "試験名なし"}
                        </Text>
                    </View>

                    <View
                        style={[
                            styles.statusBadge,
                            item.isPublished
                                ? styles.publishedBadge
                                : styles.draftBadge,
                        ]}
                    >
                        <Text
                            style={[
                                styles.statusBadgeText,
                                item.isPublished
                                    ? styles.publishedBadgeText
                                    : styles.draftBadgeText,
                            ]}
                        >
                            {item.isPublished ? "公開" : "非公開"}
                        </Text>
                    </View>
                </View>

                {!!item.description && (
                    <Text style={styles.description}>{item.description}</Text>
                )}

                <View style={styles.metaRow}>
                    <Text style={styles.metaText}>
                        合格点: {item.passScore ?? "-"}
                    </Text>
                    <Text style={styles.metaText}>
                        問題数: {item.totalQuestions ?? "-"}
                    </Text>
                    <Text style={styles.metaText}>
                        制限時間: {item.timeLimitMinutes ?? "-"}分
                    </Text>
                </View>

                <View style={styles.actionRow}>
                    <Pressable
                        style={({ pressed }) => [
                            styles.smallButton,
                            pressed && styles.buttonPressed,
                        ]}
                        onPress={() => togglePublished(item)}
                    >
                        <Text style={styles.smallButtonText}>
                            {item.isPublished ? "非公開にする" : "公開する"}
                        </Text>
                    </Pressable>

                    <Pressable
                        style={({ pressed }) => [
                            styles.smallButton,
                            styles.editButton,
                            pressed && styles.buttonPressed,
                        ]}
                        onPress={() =>
                            navigation.navigate("AdminExamEdit", {
                                examId: item.id,
                            })
                        }
                    >
                        <Text style={styles.smallButtonText}>編集</Text>
                    </Pressable>
                </View>
            </View>
        );
    };

    if (loading) {
        return (
            <View style={styles.center}>
                <ActivityIndicator />
                <Text style={styles.loadingText}>試験情報を読み込み中...</Text>
            </View>
        );
    }

    return (
        <View style={styles.root}>
            <View style={styles.header}>
                <Text style={styles.screenTitle}>試験情報一覧</Text>

                <AppButton
                    onPress={() => navigation.navigate("AdminExamCreate")}
                >
                    試験情報を登録
                </AppButton>
            </View>

            <FlatList
                data={exams}
                keyExtractor={(item) => item.id}
                renderItem={renderExam}
                contentContainerStyle={[
                    styles.listContent,
                    exams.length === 0 && styles.emptyListContent,
                ]}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={refreshExams}
                    />
                }
                ListEmptyComponent={
                    <View style={styles.emptyBox}>
                        <Text style={styles.emptyTitle}>
                            試験情報がありません
                        </Text>
                        <Text style={styles.emptyText}>
                            「試験情報を登録」から Exam を作成してください。
                        </Text>
                    </View>
                }
            />
        </View>
    );
}

const styles = StyleSheet.create({
    root: {
        flex: 1,
        backgroundColor: "#ffffff",
    },
    header: {
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: "#e5e7eb",
        gap: 10,
    },
    screenTitle: {
        fontSize: 22,
        fontWeight: "bold",
        color: "#1f2937",
    },
    listContent: {
        padding: 16,
        gap: 12,
    },
    emptyListContent: {
        flexGrow: 1,
        justifyContent: "center",
    },
    card: {
        padding: 14,
        borderRadius: 12,
        backgroundColor: "#ffffff",
        borderWidth: 1,
        borderColor: "#d8dce8",
        gap: 10,
    },
    cardHeader: {
        flexDirection: "row",
        alignItems: "flex-start",
        justifyContent: "space-between",
        gap: 12,
    },
    titleArea: {
        flex: 1,
        gap: 4,
    },
    examCode: {
        fontSize: 13,
        fontWeight: "bold",
        color: "#4f5f6f",
    },
    examTitle: {
        fontSize: 17,
        fontWeight: "bold",
        color: "#1f2937",
        lineHeight: 24,
    },
    description: {
        fontSize: 14,
        color: "#4b5563",
        lineHeight: 20,
    },
    statusBadge: {
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 999,
        borderWidth: 1,
    },
    publishedBadge: {
        backgroundColor: "#eef9f2",
        borderColor: "#9fdcb7",
    },
    draftBadge: {
        backgroundColor: "#f3f4f6",
        borderColor: "#d1d5db",
    },
    statusBadgeText: {
        fontSize: 12,
        fontWeight: "bold",
    },
    publishedBadgeText: {
        color: "#166534",
    },
    draftBadgeText: {
        color: "#4b5563",
    },
    metaRow: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 8,
    },
    metaText: {
        fontSize: 13,
        color: "#374151",
        backgroundColor: "#f3f6f9",
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
    },
    actionRow: {
        flexDirection: "row",
        justifyContent: "flex-end",
        gap: 8,
        marginTop: 2,
    },
    smallButton: {
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 8,
        backgroundColor: "#4f5f6f",
    },
    editButton: {
        backgroundColor: "#2f3a46",
    },
    smallButtonText: {
        color: "#ffffff",
        fontSize: 13,
        fontWeight: "bold",
    },
    buttonPressed: {
        opacity: 0.75,
    },
    center: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#ffffff",
        gap: 8,
    },
    loadingText: {
        fontSize: 14,
        color: "#4b5563",
    },
    emptyBox: {
        alignItems: "center",
        gap: 8,
        paddingHorizontal: 24,
    },
    emptyTitle: {
        fontSize: 18,
        fontWeight: "bold",
        color: "#1f2937",
    },
    emptyText: {
        fontSize: 14,
        color: "#6b7280",
        textAlign: "center",
        lineHeight: 20,
    },
});
