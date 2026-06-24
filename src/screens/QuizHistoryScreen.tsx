import { useCallback, useMemo, useState } from "react";
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
import { getCurrentUser } from "aws-amplify/auth";

import { client } from "../lib/client";
import type { RootStackParamList } from "../navigation/RootNavigator";

type Props = NativeStackScreenProps<RootStackParamList, "QuizHistory">;

type QuizSessionItem = {
    id: string;
    userId?: string | null;
    examId?: string | null;
    mode?: string | null;
    startedAt?: string | null;
    submittedAt?: string | null;
    totalQuestions?: number | null;
    correctCount?: number | null;
    score?: number | null;
    passScore?: number | null;
    isPassed?: boolean | null;
    status?: string | null;
    createdAt?: string | null;
};

type ExamItem = {
    id: string;
    code?: string | null;
    title?: string | null;
};

type HistoryItem = QuizSessionItem & {
    examCode?: string | null;
    examTitle?: string | null;
};

export default function QuizHistoryScreen({ navigation }: Props) {
    const [historyItems, setHistoryItems] = useState<HistoryItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const submittedItems = useMemo(() => {
        return historyItems.filter((item) => item.status === "SUBMITTED");
    }, [historyItems]);

    const inProgressItems = useMemo(() => {
        return historyItems.filter((item) => item.status !== "SUBMITTED");
    }, [historyItems]);

    const loadHistory = useCallback(async (showLoading: boolean = true) => {
        try {
            if (showLoading) {
                setLoading(true);
            }

            const currentUser = await getCurrentUser();

            const sessionResult = await client.models.QuizSession.list({
                filter: {
                    userId: {
                        eq: currentUser.userId,
                    },
                },
                limit: 1000,
            });

            if (sessionResult.errors) {
                console.error("QuizSession list errors:", sessionResult.errors);
                Alert.alert("エラー", "受験履歴の取得に失敗しました。");
                return;
            }

            const sessions = (
                (sessionResult.data ?? []) as QuizSessionItem[]
            ).sort((a, b) => {
                const aTime = new Date(
                    a.submittedAt ?? a.startedAt ?? a.createdAt ?? 0,
                ).getTime();
                const bTime = new Date(
                    b.submittedAt ?? b.startedAt ?? b.createdAt ?? 0,
                ).getTime();

                return bTime - aTime;
            });

            const examResult = await client.models.Exam.list({
                limit: 1000,
            });

            if (examResult.errors) {
                console.error("Exam list errors:", examResult.errors);
            }

            const exams = (examResult.data ?? []) as ExamItem[];

            const examById = new Map<string, ExamItem>();

            exams.forEach((exam) => {
                examById.set(exam.id, exam);
            });

            const items: HistoryItem[] = sessions.map((session) => {
                const exam = session.examId
                    ? examById.get(session.examId)
                    : null;

                return {
                    ...session,
                    examCode: exam?.code ?? null,
                    examTitle: exam?.title ?? null,
                };
            });

            setHistoryItems(items);
        } catch (error) {
            console.error("Quiz history load unexpected error:", error);
            Alert.alert("エラー", "受験履歴の取得中にエラーが発生しました。");
        } finally {
            if (showLoading) {
                setLoading(false);
            }
        }
    }, []);

    useFocusEffect(
        useCallback(() => {
            void loadHistory(true);
        }, [loadHistory]),
    );

    const refreshHistory = async () => {
        setRefreshing(true);

        try {
            await loadHistory(false);
        } finally {
            setRefreshing(false);
        }
    };

    const openResult = (sessionId: string, status?: string | null) => {
        if (status !== "SUBMITTED") {
            Alert.alert(
                "未提出の履歴です",
                "この履歴はまだ結果が確定していません。",
            );
            return;
        }

        navigation.navigate("Result", {
            sessionId,
        });
    };

    const renderHistoryItem = ({ item }: { item: HistoryItem }) => {
        const submitted = item.status === "SUBMITTED";
        const passed = Boolean(item.isPassed);
        const scoreText =
            typeof item.score === "number" ? `${item.score}点` : "-";
        const correctText =
            typeof item.correctCount === "number" &&
            typeof item.totalQuestions === "number"
                ? `${item.correctCount} / ${item.totalQuestions}`
                : "-";

        return (
            <Pressable
                style={({ pressed }) => [
                    styles.card,
                    pressed && styles.pressed,
                ]}
                onPress={() => openResult(item.id, item.status)}
            >
                <View style={styles.cardHeader}>
                    <View style={styles.titleArea}>
                        <Text style={styles.examCode}>
                            {item.examCode ?? "EXAM"}
                        </Text>
                        <Text style={styles.examTitle}>
                            {item.examTitle ?? "試験名なし"}
                        </Text>
                    </View>

                    <View
                        style={[
                            styles.statusBadge,
                            submitted
                                ? passed
                                    ? styles.passBadge
                                    : styles.failBadge
                                : styles.inProgressBadge,
                        ]}
                    >
                        <Text
                            style={[
                                styles.statusBadgeText,
                                submitted
                                    ? passed
                                        ? styles.passBadgeText
                                        : styles.failBadgeText
                                    : styles.inProgressBadgeText,
                            ]}
                        >
                            {submitted
                                ? passed
                                    ? "合格"
                                    : "不合格"
                                : "未提出"}
                        </Text>
                    </View>
                </View>

                <View style={styles.metaRow}>
                    <Text style={styles.metaText}>
                        受験日時: {formatDateTime(item.startedAt)}
                    </Text>
                    <Text style={styles.metaText}>
                        モード: {formatMode(item.mode)}
                    </Text>
                </View>

                <View style={styles.scoreRow}>
                    <View style={styles.scoreBox}>
                        <Text style={styles.scoreLabel}>スコア</Text>
                        <Text style={styles.scoreValue}>{scoreText}</Text>
                    </View>

                    <View style={styles.scoreBox}>
                        <Text style={styles.scoreLabel}>正答数</Text>
                        <Text style={styles.scoreValue}>{correctText}</Text>
                    </View>

                    <View style={styles.scoreBox}>
                        <Text style={styles.scoreLabel}>合格点</Text>
                        <Text style={styles.scoreValue}>
                            {item.passScore ?? "-"}
                        </Text>
                    </View>
                </View>

                {submitted && (
                    <Text style={styles.openResultText}>
                        タップして結果詳細を表示
                    </Text>
                )}
            </Pressable>
        );
    };

    if (loading) {
        return (
            <View style={styles.center}>
                <ActivityIndicator />
                <Text style={styles.loadingText}>受験履歴を読み込み中...</Text>
            </View>
        );
    }

    return (
        <View style={styles.root}>
            <View style={styles.header}>
                <Text style={styles.screenTitle}>受験履歴</Text>
                <Text style={styles.headerSummary}>
                    提出済み: {submittedItems.length}件 / 未提出:{" "}
                    {inProgressItems.length}件
                </Text>
            </View>

            <FlatList
                data={historyItems}
                keyExtractor={(item) => item.id}
                renderItem={renderHistoryItem}
                contentContainerStyle={[
                    styles.listContent,
                    historyItems.length === 0 && styles.emptyListContent,
                ]}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={refreshHistory}
                    />
                }
                ListEmptyComponent={
                    <View style={styles.emptyBox}>
                        <Text style={styles.emptyTitle}>
                            受験履歴がありません
                        </Text>
                        <Text style={styles.emptyText}>
                            問題を解くと、ここに結果が表示されます。
                        </Text>
                    </View>
                }
            />
        </View>
    );
}

function formatMode(mode?: string | null) {
    switch (mode) {
        case "PRACTICE":
            return "練習";
        case "EXAM":
            return "本番";
        default:
            return mode ?? "-";
    }
}

function formatDateTime(value?: string | null) {
    if (!value) {
        return "-";
    }

    const date = new Date(value);

    if (!Number.isFinite(date.getTime())) {
        return "-";
    }

    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const dd = String(date.getDate()).padStart(2, "0");
    const hh = String(date.getHours()).padStart(2, "0");
    const mi = String(date.getMinutes()).padStart(2, "0");

    return `${yyyy}-${mm}-${dd} ${hh}:${mi}`;
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
        gap: 6,
    },
    screenTitle: {
        fontSize: 22,
        fontWeight: "bold",
        color: "#1f2937",
    },
    headerSummary: {
        fontSize: 13,
        color: "#6b7280",
        fontWeight: "600",
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
    pressed: {
        opacity: 0.75,
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
    statusBadge: {
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 999,
        borderWidth: 1,
    },
    statusBadgeText: {
        fontSize: 12,
        fontWeight: "bold",
    },
    passBadge: {
        backgroundColor: "#eef9f2",
        borderColor: "#9fdcb7",
    },
    passBadgeText: {
        color: "#166534",
    },
    failBadge: {
        backgroundColor: "#fff1f2",
        borderColor: "#fecaca",
    },
    failBadgeText: {
        color: "#7f1d1d",
    },
    inProgressBadge: {
        backgroundColor: "#f3f4f6",
        borderColor: "#d1d5db",
    },
    inProgressBadgeText: {
        color: "#4b5563",
    },
    metaRow: {
        gap: 4,
    },
    metaText: {
        fontSize: 13,
        color: "#4b5563",
        lineHeight: 19,
    },
    scoreRow: {
        flexDirection: "row",
        gap: 8,
    },
    scoreBox: {
        flex: 1,
        padding: 10,
        borderRadius: 8,
        backgroundColor: "#f3f6f9",
        gap: 4,
    },
    scoreLabel: {
        fontSize: 12,
        color: "#6b7280",
        fontWeight: "600",
    },
    scoreValue: {
        fontSize: 16,
        color: "#1f2937",
        fontWeight: "bold",
    },
    openResultText: {
        marginTop: 2,
        fontSize: 13,
        color: "#4f5f6f",
        fontWeight: "bold",
        textAlign: "right",
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
