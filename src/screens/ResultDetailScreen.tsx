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

import { client } from "../lib/client";
import type { RootStackParamList } from "../navigation/RootNavigator";

type Props = NativeStackScreenProps<RootStackParamList, "ResultDetail">;

type QuizSessionItem = {
    id: string;
    examId?: string | null;
    startedAt?: string | null;
    submittedAt?: string | null;
    totalQuestions?: number | null;
    correctCount?: number | null;
    score?: number | null;
    passScore?: number | null;
    isPassed?: boolean | null;
    status?: string | null;
};

type QuizAnswerItem = {
    id: string;
    sessionId?: string | null;
    questionId?: string | null;
    selectedChoiceIds?: string[] | null;
    isCorrect?: boolean | null;
    score?: number | null;
    answeredAt?: string | null;
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
    score?: number | null;
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

type AnswerDetailItem = {
    answer: QuizAnswerItem;
    question: QuestionItem;
    choices: ChoiceItem[];
    correctChoiceIds: string[];
    explanationText: string | null;
};

export default function ResultDetailScreen({ route }: Props) {
    const { sessionId } = route.params;

    const [session, setSession] = useState<QuizSessionItem | null>(null);
    const [exam, setExam] = useState<ExamItem | null>(null);
    const [answerDetails, setAnswerDetails] = useState<AnswerDetailItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [expandedQuestionIds, setExpandedQuestionIds] = useState<string[]>(
        [],
    );

    const correctCount = useMemo(() => {
        return answerDetails.filter((item) => item.answer.isCorrect).length;
    }, [answerDetails]);

    const incorrectCount = answerDetails.length - correctCount;

    const loadResultDetail = useCallback(
        async (showLoading: boolean = true) => {
            try {
                if (showLoading) {
                    setLoading(true);
                }

                const sessionResult = await client.models.QuizSession.list({
                    filter: {
                        id: {
                            eq: sessionId,
                        },
                    },
                    limit: 1,
                });

                if (sessionResult.errors) {
                    console.error(
                        "QuizSession detail list errors:",
                        sessionResult.errors,
                    );
                    Alert.alert("エラー", "受験結果の取得に失敗しました。");
                    return;
                }

                const loadedSession = (sessionResult.data?.[0] ??
                    null) as QuizSessionItem | null;

                if (!loadedSession) {
                    Alert.alert("エラー", "受験結果が見つかりませんでした。");
                    return;
                }

                setSession(loadedSession);

                if (loadedSession.examId) {
                    const examResult = await client.models.Exam.list({
                        filter: {
                            id: {
                                eq: loadedSession.examId,
                            },
                        },
                        limit: 1,
                    });

                    if (examResult.errors) {
                        console.error("Exam detail errors:", examResult.errors);
                    }

                    setExam((examResult.data?.[0] ?? null) as ExamItem | null);
                } else {
                    setExam(null);
                }

                const answerResult = await client.models.QuizAnswer.list({
                    filter: {
                        sessionId: {
                            eq: sessionId,
                        },
                    },
                    limit: 1000,
                });

                if (answerResult.errors) {
                    console.error(
                        "QuizAnswer detail list errors:",
                        answerResult.errors,
                    );
                    Alert.alert("エラー", "回答結果の取得に失敗しました。");
                    return;
                }

                const answers = (
                    (answerResult.data ?? []) as QuizAnswerItem[]
                ).sort((a, b) => {
                    const aTime = new Date(a.answeredAt ?? 0).getTime();
                    const bTime = new Date(b.answeredAt ?? 0).getTime();

                    return aTime - bTime;
                });

                const details: AnswerDetailItem[] = [];

                for (const answer of answers) {
                    if (!answer.questionId) {
                        continue;
                    }

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
                            "Question detail errors:",
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
                        console.error(
                            "Choice detail errors:",
                            choiceResult.errors,
                        );
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
                            "QuestionSolution detail errors:",
                            solutionResult.errors,
                        );
                    }

                    const solution = (solutionResult.data?.[0] ??
                        null) as SolutionItem | null;

                    details.push({
                        answer,
                        question,
                        choices,
                        correctChoiceIds: solution?.correctChoiceIds ?? [],
                        explanationText: solution?.explanationText ?? null,
                    });
                }

                setAnswerDetails(details);
            } catch (error) {
                console.error("Result detail unexpected error:", error);
                Alert.alert(
                    "エラー",
                    "結果詳細の取得中にエラーが発生しました。",
                );
            } finally {
                if (showLoading) {
                    setLoading(false);
                }
            }
        },
        [sessionId],
    );

    useFocusEffect(
        useCallback(() => {
            void loadResultDetail(true);
        }, [loadResultDetail]),
    );

    const refreshResultDetail = async () => {
        setRefreshing(true);

        try {
            await loadResultDetail(false);
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

    const renderAnswerDetail = ({
        item,
        index,
    }: {
        item: AnswerDetailItem;
        index: number;
    }) => {
        const expanded = expandedQuestionIds.includes(item.question.id);
        const selectedChoiceIds = item.answer.selectedChoiceIds ?? [];
        const isCorrect = Boolean(item.answer.isCorrect);

        return (
            <View style={styles.card}>
                <View style={styles.cardHeader}>
                    <Text style={styles.questionNumber}>Q{index + 1}</Text>

                    <View
                        style={[
                            styles.resultBadge,
                            isCorrect
                                ? styles.correctBadge
                                : styles.incorrectBadge,
                        ]}
                    >
                        <Text
                            style={[
                                styles.resultBadgeText,
                                isCorrect
                                    ? styles.correctBadgeText
                                    : styles.incorrectBadgeText,
                            ]}
                        >
                            {isCorrect ? "正解" : "不正解"}
                        </Text>
                    </View>
                </View>

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

                <View style={styles.choiceList}>
                    {item.choices.map((choice) => {
                        const selected = selectedChoiceIds.includes(choice.id);
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

                                <View style={styles.choiceMarkArea}>
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

                                    {selected && correct && (
                                        <Text
                                            style={styles.selectedCorrectMark}
                                        >
                                            あなたの回答
                                        </Text>
                                    )}
                                </View>
                            </View>
                        );
                    })}
                </View>

                {expanded && (
                    <View style={styles.explanationBox}>
                        <Text style={styles.sectionTitle}>解説</Text>
                        <Text style={styles.explanationText}>
                            {item.explanationText || "解説は未登録です。"}
                        </Text>
                    </View>
                )}

                <Pressable
                    style={({ pressed }) => [
                        styles.detailButton,
                        pressed && styles.pressed,
                    ]}
                    onPress={() => toggleExpanded(item.question.id)}
                >
                    <Text style={styles.detailButtonText}>
                        {expanded ? "解説を閉じる" : "解説を見る"}
                    </Text>
                </Pressable>
            </View>
        );
    };

    if (loading) {
        return (
            <View style={styles.center}>
                <ActivityIndicator />
                <Text style={styles.loadingText}>結果詳細を読み込み中...</Text>
            </View>
        );
    }

    return (
        <View style={styles.root}>
            <View style={styles.header}>
                <Text style={styles.screenTitle}>結果詳細</Text>

                <Text style={styles.examTitle}>
                    {exam?.code ? `${exam.code} / ` : ""}
                    {exam?.title ?? "試験名なし"}
                </Text>

                <View style={styles.summaryRow}>
                    <View style={styles.summaryBox}>
                        <Text style={styles.summaryLabel}>スコア</Text>
                        <Text style={styles.summaryValue}>
                            {session?.score ?? "-"}点
                        </Text>
                    </View>

                    <View style={styles.summaryBox}>
                        <Text style={styles.summaryLabel}>正解</Text>
                        <Text style={styles.summaryValue}>
                            {correctCount}問
                        </Text>
                    </View>

                    <View style={styles.summaryBox}>
                        <Text style={styles.summaryLabel}>不正解</Text>
                        <Text style={styles.summaryValue}>
                            {incorrectCount}問
                        </Text>
                    </View>
                </View>
            </View>

            <FlatList
                data={answerDetails}
                keyExtractor={(item) => item.answer.id}
                renderItem={renderAnswerDetail}
                contentContainerStyle={[
                    styles.listContent,
                    answerDetails.length === 0 && styles.emptyListContent,
                ]}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={refreshResultDetail}
                    />
                }
                ListEmptyComponent={
                    <View style={styles.emptyBox}>
                        <Text style={styles.emptyTitle}>
                            回答詳細がありません
                        </Text>
                        <Text style={styles.emptyText}>
                            この受験結果に紐づく回答が見つかりませんでした。
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
    examTitle: {
        fontSize: 15,
        color: "#4b5563",
        fontWeight: "600",
        lineHeight: 21,
    },
    summaryRow: {
        flexDirection: "row",
        gap: 8,
    },
    summaryBox: {
        flex: 1,
        padding: 10,
        borderRadius: 8,
        backgroundColor: "#f3f6f9",
        gap: 4,
    },
    summaryLabel: {
        fontSize: 12,
        color: "#6b7280",
        fontWeight: "600",
    },
    summaryValue: {
        fontSize: 17,
        color: "#1f2937",
        fontWeight: "bold",
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
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
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
    resultBadge: {
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 999,
        borderWidth: 1,
    },
    resultBadgeText: {
        fontSize: 12,
        fontWeight: "bold",
    },
    correctBadge: {
        backgroundColor: "#eef9f2",
        borderColor: "#9fdcb7",
    },
    correctBadgeText: {
        color: "#166534",
    },
    incorrectBadge: {
        backgroundColor: "#fff1f2",
        borderColor: "#fecaca",
    },
    incorrectBadgeText: {
        color: "#7f1d1d",
    },
    choiceList: {
        gap: 8,
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
        width: 22,
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
    choiceMarkArea: {
        alignItems: "flex-end",
        gap: 2,
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
    selectedCorrectMark: {
        fontSize: 12,
        color: "#166534",
        fontWeight: "bold",
    },
    explanationBox: {
        gap: 6,
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
    },
    explanationText: {
        fontSize: 14,
        color: "#374151",
        lineHeight: 22,
    },
    detailButton: {
        alignSelf: "flex-end",
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 8,
        backgroundColor: "#4f5f6f",
    },
    detailButtonText: {
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
