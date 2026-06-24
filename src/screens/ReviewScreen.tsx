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

import AppButton from "../components/AppButton";
import { client } from "../lib/client";
import type { RootStackParamList } from "../navigation/RootNavigator";

type Props = NativeStackScreenProps<RootStackParamList, "Review">;

type QuizAnswerItem = {
    id: string;
    sessionId?: string | null;
    questionId?: string | null;
    selectedChoiceIds?: string[] | null;
    isCorrect?: boolean | null;
    answeredAt?: string | null;
};

type QuizSessionItem = {
    id: string;
    userId?: string | null;
    examId?: string | null;
    status?: string | null;
    startedAt?: string | null;
    submittedAt?: string | null;
};

type ExamItem = {
    id: string;
    code?: string | null;
    title?: string | null;
};

type QuestionItem = {
    id: string;
    examId?: string | null;
    categoryName?: string | null;
    questionText?: string | null;
    questionType?: string | null;
    difficulty?: string | null;
    selectionMin?: number | null;
    selectionMax?: number | null;
    score?: number | null;
    status?: string | null;
};

type ChoiceItem = {
    id: string;
    questionId?: string | null;
    label?: string | null;
    choiceText?: string | null;
    displayOrder?: number | null;
};

type SolutionItem = {
    id: string;
    questionId?: string | null;
    correctChoiceIds?: string[] | null;
    explanationText?: string | null;
};

type ReviewItem = {
    answerId: string;
    sessionId: string;
    examId: string | null;
    examCode: string | null;
    examTitle: string | null;
    question: QuestionItem;
    choices: ChoiceItem[];
    selectedChoiceIds: string[];
    correctChoiceIds: string[];
    explanationText: string | null;
    answeredAt: string | null;
};

export default function ReviewScreen({ navigation }: Props) {
    const [reviewItems, setReviewItems] = useState<ReviewItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [expandedQuestionIds, setExpandedQuestionIds] = useState<string[]>(
        [],
    );

    const incorrectCount = reviewItems.length;

    const examCount = useMemo(() => {
        const examIds = new Set(
            reviewItems
                .map((item) => item.examId)
                .filter((examId): examId is string => Boolean(examId)),
        );

        return examIds.size;
    }, [reviewItems]);

    const loadReviewItems = useCallback(async (showLoading: boolean = true) => {
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
                    status: {
                        eq: "SUBMITTED",
                    },
                },
                limit: 1000,
            });

            if (sessionResult.errors) {
                console.error("QuizSession list errors:", sessionResult.errors);
                Alert.alert("エラー", "受験履歴の取得に失敗しました。");
                return;
            }

            const sessions = (sessionResult.data ?? []) as QuizSessionItem[];

            const sessionById = new Map<string, QuizSessionItem>();

            sessions.forEach((session) => {
                sessionById.set(session.id, session);
            });

            if (sessions.length === 0) {
                setReviewItems([]);
                return;
            }

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

            const allIncorrectAnswers: QuizAnswerItem[] = [];

            for (const session of sessions) {
                const answerResult = await client.models.QuizAnswer.list({
                    filter: {
                        sessionId: {
                            eq: session.id,
                        },
                        isCorrect: {
                            eq: false,
                        },
                    },
                    limit: 1000,
                });

                if (answerResult.errors) {
                    console.error(
                        "QuizAnswer list errors:",
                        answerResult.errors,
                    );
                    continue;
                }

                allIncorrectAnswers.push(
                    ...((answerResult.data ?? []) as QuizAnswerItem[]),
                );
            }

            const uniqueIncorrectByQuestionId = new Map<
                string,
                QuizAnswerItem
            >();

            allIncorrectAnswers
                .sort((a, b) => {
                    const aTime = new Date(a.answeredAt ?? 0).getTime();
                    const bTime = new Date(b.answeredAt ?? 0).getTime();

                    return bTime - aTime;
                })
                .forEach((answer) => {
                    if (!answer.questionId) {
                        return;
                    }

                    if (!uniqueIncorrectByQuestionId.has(answer.questionId)) {
                        uniqueIncorrectByQuestionId.set(
                            answer.questionId,
                            answer,
                        );
                    }
                });

            const reviewList: ReviewItem[] = [];

            for (const answer of uniqueIncorrectByQuestionId.values()) {
                if (!answer.questionId || !answer.sessionId) {
                    continue;
                }

                const session = sessionById.get(answer.sessionId) ?? null;

                const questionResult = await client.models.Question.list({
                    filter: {
                        id: {
                            eq: answer.questionId,
                        },
                    },
                    limit: 1,
                });

                if (questionResult.errors) {
                    console.error(
                        "Question list errors:",
                        questionResult.errors,
                    );
                    continue;
                }

                const question = (questionResult.data?.[0] ??
                    null) as QuestionItem | null;

                if (!question) {
                    continue;
                }

                const choiceResult = await client.models.Choice.list({
                    filter: {
                        questionId: {
                            eq: question.id,
                        },
                    },
                    limit: 1000,
                });

                if (choiceResult.errors) {
                    console.error("Choice list errors:", choiceResult.errors);
                    continue;
                }

                const choices = (
                    (choiceResult.data ?? []) as ChoiceItem[]
                ).sort((a, b) => {
                    return (a.displayOrder ?? 0) - (b.displayOrder ?? 0);
                });

                const solutionResult =
                    await client.models.QuestionSolution.list({
                        filter: {
                            questionId: {
                                eq: question.id,
                            },
                        },
                        limit: 1,
                    });

                if (solutionResult.errors) {
                    console.error(
                        "QuestionSolution list errors:",
                        solutionResult.errors,
                    );
                }

                const solution = (solutionResult.data?.[0] ??
                    null) as SolutionItem | null;

                const examId = session?.examId ?? question.examId ?? null;
                const exam = examId ? examById.get(examId) : null;

                reviewList.push({
                    answerId: answer.id,
                    sessionId: answer.sessionId,
                    examId,
                    examCode: exam?.code ?? null,
                    examTitle: exam?.title ?? null,
                    question,
                    choices,
                    selectedChoiceIds: answer.selectedChoiceIds ?? [],
                    correctChoiceIds: solution?.correctChoiceIds ?? [],
                    explanationText: solution?.explanationText ?? null,
                    answeredAt: answer.answeredAt ?? null,
                });
            }

            reviewList.sort((a, b) => {
                const aTime = new Date(a.answeredAt ?? 0).getTime();
                const bTime = new Date(b.answeredAt ?? 0).getTime();

                return bTime - aTime;
            });

            setReviewItems(reviewList);
        } catch (error) {
            console.error("Review load unexpected error:", error);
            Alert.alert("エラー", "復習問題の取得中にエラーが発生しました。");
        } finally {
            if (showLoading) {
                setLoading(false);
            }
        }
    }, []);

    useFocusEffect(
        useCallback(() => {
            void loadReviewItems(true);
        }, [loadReviewItems]),
    );

    const refreshReviewItems = async () => {
        setRefreshing(true);

        try {
            await loadReviewItems(false);
        } finally {
            setRefreshing(false);
        }
    };

    const toggleExpanded = (questionId: string) => {
        setExpandedQuestionIds((current) => {
            if (current.includes(questionId)) {
                return current.filter((id) => id !== questionId);
            }

            return [...current, questionId];
        });
    };

    const retryExam = (examId: string | null) => {
        if (!examId) {
            Alert.alert("エラー", "試験情報が見つかりません。");
            return;
        }

        navigation.navigate("Quiz", {
            examId,
        });
    };

    const renderReviewItem = ({
        item,
        index,
    }: {
        item: ReviewItem;
        index: number;
    }) => {
        const expanded = expandedQuestionIds.includes(item.question.id);

        return (
            <View style={styles.card}>
                <View style={styles.cardHeader}>
                    <View style={styles.titleArea}>
                        <Text style={styles.examCode}>
                            {item.examCode ?? "EXAM"}
                        </Text>
                        <Text style={styles.examTitle}>
                            {item.examTitle ?? "試験名なし"}
                        </Text>
                    </View>

                    <View style={styles.incorrectBadge}>
                        <Text style={styles.incorrectBadgeText}>復習対象</Text>
                    </View>
                </View>

                <Text style={styles.questionNumber}>Q{index + 1}</Text>

                <Text
                    style={styles.questionText}
                    numberOfLines={expanded ? undefined : 4}
                >
                    {item.question.questionText ?? "問題文なし"}
                </Text>

                <View style={styles.metaRow}>
                    <Text style={styles.metaText}>
                        カテゴリ: {item.question.categoryName ?? "-"}
                    </Text>
                    <Text style={styles.metaText}>
                        種別: {item.question.questionType ?? "-"}
                    </Text>
                    <Text style={styles.metaText}>
                        難易度: {item.question.difficulty ?? "-"}
                    </Text>
                </View>

                {expanded && (
                    <View style={styles.detailBox}>
                        <Text style={styles.sectionTitle}>選択肢</Text>

                        {item.choices.map((choice) => {
                            const selected = item.selectedChoiceIds.includes(
                                choice.id,
                            );
                            const correct = item.correctChoiceIds.includes(
                                choice.id,
                            );

                            return (
                                <View
                                    key={choice.id}
                                    style={[
                                        styles.choiceRow,
                                        correct && styles.correctChoiceRow,
                                        selected &&
                                            !correct &&
                                            styles.incorrectChoiceRow,
                                    ]}
                                >
                                    <Text style={styles.choiceLabel}>
                                        {choice.label}.
                                    </Text>
                                    <Text style={styles.choiceText}>
                                        {choice.choiceText}
                                    </Text>

                                    {correct && (
                                        <Text style={styles.correctMark}>
                                            正解
                                        </Text>
                                    )}

                                    {selected && !correct && (
                                        <Text style={styles.incorrectMark}>
                                            あなたの回答
                                        </Text>
                                    )}
                                </View>
                            );
                        })}

                        <Text style={styles.sectionTitle}>解説</Text>
                        <Text style={styles.explanationText}>
                            {item.explanationText || "解説は未登録です。"}
                        </Text>
                    </View>
                )}

                <View style={styles.actionRow}>
                    <Pressable
                        style={({ pressed }) => [
                            styles.smallButton,
                            pressed && styles.pressed,
                        ]}
                        onPress={() => toggleExpanded(item.question.id)}
                    >
                        <Text style={styles.smallButtonText}>
                            {expanded ? "閉じる" : "解説を見る"}
                        </Text>
                    </Pressable>

                    <Pressable
                        style={({ pressed }) => [
                            styles.smallButton,
                            styles.retryButton,
                            pressed && styles.pressed,
                        ]}
                        onPress={() => retryExam(item.examId)}
                    >
                        <Text style={styles.smallButtonText}>再挑戦</Text>
                    </Pressable>
                </View>
            </View>
        );
    };

    if (loading) {
        return (
            <View style={styles.center}>
                <ActivityIndicator />
                <Text style={styles.loadingText}>復習問題を読み込み中...</Text>
            </View>
        );
    }

    return (
        <View style={styles.root}>
            <View style={styles.header}>
                <Text style={styles.screenTitle}>復習</Text>
                <Text style={styles.headerSummary}>
                    間違えた問題: {incorrectCount}件 / 対象試験: {examCount}件
                </Text>
            </View>

            <FlatList
                data={reviewItems}
                keyExtractor={(item) => item.question.id}
                renderItem={renderReviewItem}
                contentContainerStyle={[
                    styles.listContent,
                    reviewItems.length === 0 && styles.emptyListContent,
                ]}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={refreshReviewItems}
                    />
                }
                ListEmptyComponent={
                    <View style={styles.emptyBox}>
                        <Text style={styles.emptyTitle}>
                            復習対象の問題はありません
                        </Text>
                        <Text style={styles.emptyText}>
                            間違えた問題があると、ここに表示されます。
                        </Text>

                        <AppButton
                            onPress={() => navigation.navigate("ExamList")}
                        >
                            試験を選ぶ
                        </AppButton>
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
    incorrectBadge: {
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 999,
        backgroundColor: "#fff1f2",
        borderWidth: 1,
        borderColor: "#fecaca",
    },
    incorrectBadgeText: {
        fontSize: 12,
        fontWeight: "bold",
        color: "#7f1d1d",
    },
    questionNumber: {
        fontSize: 13,
        color: "#4f5f6f",
        fontWeight: "bold",
    },
    questionText: {
        fontSize: 16,
        color: "#1f2937",
        fontWeight: "700",
        lineHeight: 24,
    },
    metaRow: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 8,
    },
    metaText: {
        fontSize: 12,
        color: "#374151",
        backgroundColor: "#f3f6f9",
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
    },
    detailBox: {
        gap: 8,
        padding: 12,
        borderRadius: 10,
        backgroundColor: "#f8fafc",
        borderWidth: 1,
        borderColor: "#e5e7eb",
    },
    sectionTitle: {
        fontSize: 14,
        fontWeight: "bold",
        color: "#1f2937",
        marginTop: 4,
    },
    choiceRow: {
        flexDirection: "row",
        alignItems: "flex-start",
        gap: 8,
        padding: 10,
        borderRadius: 8,
        backgroundColor: "#ffffff",
        borderWidth: 1,
        borderColor: "#e5e7eb",
    },
    correctChoiceRow: {
        backgroundColor: "#eef9f2",
        borderColor: "#9fdcb7",
    },
    incorrectChoiceRow: {
        backgroundColor: "#fff1f2",
        borderColor: "#fecaca",
    },
    choiceLabel: {
        width: 20,
        fontSize: 14,
        color: "#374151",
        fontWeight: "bold",
    },
    choiceText: {
        flex: 1,
        fontSize: 14,
        color: "#1f2937",
        lineHeight: 20,
        fontWeight: "600",
    },
    correctMark: {
        fontSize: 12,
        color: "#166534",
        fontWeight: "bold",
    },
    incorrectMark: {
        fontSize: 12,
        color: "#7f1d1d",
        fontWeight: "bold",
    },
    explanationText: {
        fontSize: 14,
        color: "#374151",
        lineHeight: 22,
    },
    actionRow: {
        flexDirection: "row",
        justifyContent: "flex-end",
        gap: 8,
    },
    smallButton: {
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 8,
        backgroundColor: "#4f5f6f",
    },
    retryButton: {
        backgroundColor: "#2f3a46",
    },
    smallButtonText: {
        color: "#ffffff",
        fontSize: 13,
        fontWeight: "bold",
    },
    pressed: {
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
        gap: 10,
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
