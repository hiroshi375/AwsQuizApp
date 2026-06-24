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

import AppButton from "../components/AppButton";
import { client } from "../lib/client";
import type { RootStackParamList } from "../navigation/RootNavigator";

type Props = NativeStackScreenProps<RootStackParamList, "AdminQuestionList">;

type ExamItem = {
    id: string;
    code?: string | null;
    title?: string | null;
    isPublished?: boolean | null;
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
    explanationSummary?: string | null;
    createdAt?: string | null;
    updatedAt?: string | null;
};

type ChoiceItem = {
    id: string;
    questionId?: string | null;
};

type SolutionItem = {
    id: string;
    questionId?: string | null;
    correctChoiceIds?: string[] | null;
    explanationText?: string | null;
};

type QuestionListItem = QuestionItem & {
    choiceCount: number;
    hasSolution: boolean;
};

export default function AdminQuestionListScreen({ navigation }: Props) {
    const [exams, setExams] = useState<ExamItem[]>([]);
    const [selectedExamId, setSelectedExamId] = useState<string | null>(null);

    const [questions, setQuestions] = useState<QuestionListItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [questionLoading, setQuestionLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);

    const selectedExam = useMemo(() => {
        return exams.find((exam) => exam.id === selectedExamId) ?? null;
    }, [exams, selectedExamId]);

    const loadExams = useCallback(async () => {
        const result = await client.models.Exam.list({
            limit: 1000,
        });

        if (result.errors) {
            console.error("Exam list errors:", result.errors);
            Alert.alert("エラー", "試験情報の取得に失敗しました。");
            return [];
        }

        const items = ((result.data ?? []) as ExamItem[]).sort((a, b) => {
            const aCode = a.code ?? "";
            const bCode = b.code ?? "";

            return aCode.localeCompare(bCode);
        });

        setExams(items);

        return items;
    }, []);

    const loadQuestions = useCallback(async (examId: string) => {
        setQuestionLoading(true);

        try {
            const questionResult = await client.models.Question.list({
                filter: {
                    examId: {
                        eq: examId,
                    },
                },
                limit: 1000,
            });

            if (questionResult.errors) {
                console.error("Question list errors:", questionResult.errors);
                Alert.alert("エラー", "問題情報の取得に失敗しました。");
                return;
            }

            const questionItems = (
                (questionResult.data ?? []) as QuestionItem[]
            ).sort((a, b) => {
                const aTime = new Date(a.createdAt ?? 0).getTime();
                const bTime = new Date(b.createdAt ?? 0).getTime();

                return bTime - aTime;
            });

            const listItems: QuestionListItem[] = [];

            for (const question of questionItems) {
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
                }

                const solutionResult =
                    await client.models.QuestionSolution.list({
                        filter: {
                            questionId: {
                                eq: question.id,
                            },
                        },
                        limit: 1000,
                    });

                if (solutionResult.errors) {
                    console.error(
                        "QuestionSolution list errors:",
                        solutionResult.errors,
                    );
                }

                const choices = (choiceResult.data ?? []) as ChoiceItem[];
                const solutions = (solutionResult.data ?? []) as SolutionItem[];

                const hasSolution = solutions.some((solution) => {
                    const correctChoiceIds = solution.correctChoiceIds ?? [];

                    return (
                        correctChoiceIds.length > 0 ||
                        !!solution.explanationText
                    );
                });

                listItems.push({
                    ...question,
                    choiceCount: choices.length,
                    hasSolution,
                });
            }

            setQuestions(listItems);
        } catch (error) {
            console.error("Question list unexpected error:", error);
            Alert.alert("エラー", "問題情報の取得中にエラーが発生しました。");
        } finally {
            setQuestionLoading(false);
        }
    }, []);

    const loadScreen = useCallback(
        async (showLoading: boolean = true) => {
            try {
                if (showLoading) {
                    setLoading(true);
                }

                const examItems = await loadExams();

                const nextExamId = selectedExamId ?? examItems[0]?.id ?? null;

                setSelectedExamId(nextExamId);

                if (nextExamId) {
                    await loadQuestions(nextExamId);
                } else {
                    setQuestions([]);
                }
            } catch (error) {
                console.error("AdminQuestionList load error:", error);
                Alert.alert(
                    "エラー",
                    "画面の読み込み中にエラーが発生しました。",
                );
            } finally {
                if (showLoading) {
                    setLoading(false);
                }
            }
        },
        [loadExams, loadQuestions, selectedExamId],
    );

    useFocusEffect(
        useCallback(() => {
            void loadScreen(true);
        }, [loadScreen]),
    );

    const refreshScreen = async () => {
        setRefreshing(true);

        try {
            await loadScreen(false);
        } finally {
            setRefreshing(false);
        }
    };

    const selectExam = async (examId: string) => {
        setSelectedExamId(examId);
        await loadQuestions(examId);
    };

    const toggleQuestionStatus = async (question: QuestionListItem) => {
        const currentStatus = question.status ?? "DRAFT";
        const nextStatus =
            currentStatus === "PUBLISHED" ? "DRAFT" : "PUBLISHED";

        try {
            const result = await client.models.Question.update({
                id: question.id,
                status: nextStatus,
            });

            if (result.errors) {
                console.error("Question status update errors:", result.errors);
                Alert.alert("エラー", "公開状態の更新に失敗しました。");
                return;
            }

            setQuestions((current) =>
                current.map((item) =>
                    item.id === question.id
                        ? {
                              ...item,
                              status: nextStatus,
                          }
                        : item,
                ),
            );
        } catch (error) {
            console.error("Question status update unexpected error:", error);
            Alert.alert("エラー", "公開状態の更新中にエラーが発生しました。");
        }
    };

    const renderExamTab = ({ item }: { item: ExamItem }) => {
        const active = item.id === selectedExamId;

        return (
            <Pressable
                style={({ pressed }) => [
                    styles.examTab,
                    active && styles.examTabActive,
                    pressed && styles.pressed,
                ]}
                onPress={() => {
                    void selectExam(item.id);
                }}
            >
                <Text
                    style={[
                        styles.examTabCode,
                        active && styles.examTabTextActive,
                    ]}
                >
                    {item.code ?? "-"}
                </Text>
                <Text
                    numberOfLines={1}
                    style={[
                        styles.examTabTitle,
                        active && styles.examTabTextActive,
                    ]}
                >
                    {item.title ?? "試験名なし"}
                </Text>
            </Pressable>
        );
    };

    const renderQuestion = ({
        item,
        index,
    }: {
        item: QuestionListItem;
        index: number;
    }) => {
        const published = item.status === "PUBLISHED";

        return (
            <View style={styles.questionCard}>
                <View style={styles.questionHeader}>
                    <Text style={styles.questionNumber}>Q{index + 1}</Text>

                    <View
                        style={[
                            styles.statusBadge,
                            published
                                ? styles.publishedBadge
                                : styles.draftBadge,
                        ]}
                    >
                        <Text
                            style={[
                                styles.statusBadgeText,
                                published
                                    ? styles.publishedBadgeText
                                    : styles.draftBadgeText,
                            ]}
                        >
                            {published ? "公開" : "下書き"}
                        </Text>
                    </View>
                </View>

                <Text style={styles.questionText} numberOfLines={4}>
                    {item.questionText ?? "問題文なし"}
                </Text>

                <View style={styles.metaRow}>
                    <Text style={styles.metaText}>
                        カテゴリ: {item.categoryName ?? "-"}
                    </Text>
                    <Text style={styles.metaText}>
                        種別: {item.questionType ?? "-"}
                    </Text>
                    <Text style={styles.metaText}>
                        難易度: {item.difficulty ?? "-"}
                    </Text>
                </View>

                <View style={styles.metaRow}>
                    <Text style={styles.metaText}>
                        選択肢: {item.choiceCount}件
                    </Text>
                    <Text
                        style={[
                            styles.metaText,
                            item.hasSolution
                                ? styles.solutionOk
                                : styles.solutionNg,
                        ]}
                    >
                        正解・解説: {item.hasSolution ? "登録済み" : "未登録"}
                    </Text>
                    <Text style={styles.metaText}>点数: {item.score ?? 1}</Text>
                </View>

                <View style={styles.actionRow}>
                    <Pressable
                        style={({ pressed }) => [
                            styles.smallButton,
                            pressed && styles.pressed,
                        ]}
                        onPress={() => toggleQuestionStatus(item)}
                    >
                        <Text style={styles.smallButtonText}>
                            {published ? "下書きに戻す" : "公開する"}
                        </Text>
                    </Pressable>

                    {/*
                      AdminQuestionEditScreen を作成後に有効化してください。

                    <Pressable
                        style={({ pressed }) => [
                            styles.smallButton,
                            styles.editButton,
                            pressed && styles.pressed,
                        ]}
                        onPress={() =>
                            navigation.navigate("AdminQuestionEdit", {
                                questionId: item.id,
                            })
                        }
                    >
                        <Text style={styles.smallButtonText}>編集</Text>
                    </Pressable>
                    */}
                </View>
            </View>
        );
    };

    if (loading) {
        return (
            <View style={styles.center}>
                <ActivityIndicator />
                <Text style={styles.loadingText}>問題一覧を読み込み中...</Text>
            </View>
        );
    }

    return (
        <View style={styles.root}>
            <View style={styles.header}>
                <Text style={styles.screenTitle}>問題一覧</Text>

                <View style={styles.headerButtonRow}>
                    <AppButton
                        onPress={() =>
                            navigation.navigate("AdminQuestionCreate")
                        }
                    >
                        問題を登録
                    </AppButton>

                    <AppButton
                        onPress={() =>
                            navigation.navigate("AdminQuestionImport")
                        }
                    >
                        CSVインポート
                    </AppButton>
                </View>
            </View>

            {exams.length > 0 ? (
                <View style={styles.examTabArea}>
                    <FlatList
                        horizontal
                        data={exams}
                        keyExtractor={(item) => item.id}
                        renderItem={renderExamTab}
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.examTabList}
                    />
                </View>
            ) : (
                <View style={styles.emptyExamBox}>
                    <Text style={styles.emptyTitle}>試験情報がありません</Text>
                    <Text style={styles.emptyText}>
                        先に「試験情報登録」から Exam を作成してください。
                    </Text>
                </View>
            )}

            {selectedExam && (
                <View style={styles.selectedExamBox}>
                    <Text style={styles.selectedExamText}>
                        表示中: {selectedExam.code} /{" "}
                        {selectedExam.title ?? "試験名なし"}
                    </Text>
                </View>
            )}

            {questionLoading ? (
                <View style={styles.questionLoadingBox}>
                    <ActivityIndicator />
                    <Text style={styles.loadingText}>問題を読み込み中...</Text>
                </View>
            ) : (
                <FlatList
                    data={questions}
                    keyExtractor={(item) => item.id}
                    renderItem={renderQuestion}
                    contentContainerStyle={[
                        styles.listContent,
                        questions.length === 0 && styles.emptyListContent,
                    ]}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={refreshScreen}
                        />
                    }
                    ListEmptyComponent={
                        <View style={styles.emptyBox}>
                            <Text style={styles.emptyTitle}>
                                問題がありません
                            </Text>
                            <Text style={styles.emptyText}>
                                問題登録またはCSVインポートを行ってください。
                            </Text>
                        </View>
                    }
                />
            )}
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
    headerButtonRow: {
        gap: 8,
    },
    examTabArea: {
        borderBottomWidth: 1,
        borderBottomColor: "#e5e7eb",
    },
    examTabList: {
        paddingHorizontal: 12,
        paddingVertical: 10,
        gap: 8,
    },
    examTab: {
        minWidth: 120,
        maxWidth: 180,
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderRadius: 10,
        backgroundColor: "#f3f6f9",
        borderWidth: 1,
        borderColor: "#d8dce8",
    },
    examTabActive: {
        backgroundColor: "#4f5f6f",
        borderColor: "#4f5f6f",
    },
    examTabCode: {
        fontSize: 13,
        fontWeight: "bold",
        color: "#4f5f6f",
    },
    examTabTitle: {
        marginTop: 2,
        fontSize: 12,
        color: "#4b5563",
    },
    examTabTextActive: {
        color: "#ffffff",
    },
    selectedExamBox: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        backgroundColor: "#f8fafc",
        borderBottomWidth: 1,
        borderBottomColor: "#e5e7eb",
    },
    selectedExamText: {
        fontSize: 13,
        color: "#374151",
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
    questionCard: {
        padding: 14,
        borderRadius: 12,
        backgroundColor: "#ffffff",
        borderWidth: 1,
        borderColor: "#d8dce8",
        gap: 10,
    },
    questionHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 12,
    },
    questionNumber: {
        fontSize: 13,
        fontWeight: "bold",
        color: "#4f5f6f",
    },
    questionText: {
        fontSize: 16,
        fontWeight: "700",
        color: "#1f2937",
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
    solutionOk: {
        color: "#166534",
        backgroundColor: "#eef9f2",
    },
    solutionNg: {
        color: "#7f1d1d",
        backgroundColor: "#fff1f2",
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
    questionLoadingBox: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
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
    emptyExamBox: {
        padding: 16,
        gap: 8,
        borderBottomWidth: 1,
        borderBottomColor: "#e5e7eb",
    },
    emptyTitle: {
        fontSize: 18,
        fontWeight: "bold",
        color: "#1f2937",
    },
    emptyText: {
        fontSize: 14,
        color: "#6b7280",
        lineHeight: 20,
    },
});
