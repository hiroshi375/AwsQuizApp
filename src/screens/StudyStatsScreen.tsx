import { useCallback, useMemo, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    FlatList,
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

type Props = NativeStackScreenProps<RootStackParamList, "StudyStats">;

type QuizSessionItem = {
    id: string;
    userId?: string | null;
    examId?: string | null;
    totalQuestions?: number | null;
    correctCount?: number | null;
    score?: number | null;
    passScore?: number | null;
    isPassed?: boolean | null;
    status?: string | null;
    startedAt?: string | null;
    submittedAt?: string | null;
};

type QuizAnswerItem = {
    id: string;
    sessionId?: string | null;
    questionId?: string | null;
    selectedChoiceIds?: string[] | null;
    isCorrect?: boolean | null;
    answeredAt?: string | null;
};

type QuestionItem = {
    id: string;
    categoryName?: string | null;
};

type CategoryStatsItem = {
    categoryName: string;
    totalAnswers: number;
    correctAnswers: number;
    accuracyRate: number;
};

type StudyStats = {
    submittedSessionCount: number;
    passedSessionCount: number;
    averageScore: number;
    highestScore: number;
    passRate: number;
    totalAnswers: number;
    correctAnswers: number;
    accuracyRate: number;
    categoryStats: CategoryStatsItem[];
};

const emptyStats: StudyStats = {
    submittedSessionCount: 0,
    passedSessionCount: 0,
    averageScore: 0,
    highestScore: 0,
    passRate: 0,
    totalAnswers: 0,
    correctAnswers: 0,
    accuracyRate: 0,
    categoryStats: [],
};

export default function StudyStatsScreen({}: Props) {
    const [stats, setStats] = useState<StudyStats>(emptyStats);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const weakCategories = useMemo(() => {
        return stats.categoryStats
            .filter((item) => item.totalAnswers >= 1)
            .sort((a, b) => a.accuracyRate - b.accuracyRate)
            .slice(0, 3);
    }, [stats.categoryStats]);

    const loadStats = useCallback(async (showLoading: boolean = true) => {
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
                console.error(
                    "QuizSession stats list errors:",
                    sessionResult.errors,
                );
                Alert.alert("エラー", "学習統計の取得に失敗しました。");
                return;
            }

            const submittedSessions = (sessionResult.data ??
                []) as QuizSessionItem[];

            if (submittedSessions.length === 0) {
                setStats(emptyStats);
                return;
            }

            const scores = submittedSessions
                .map((session) => session.score)
                .filter((score): score is number => typeof score === "number");

            const totalScore = scores.reduce((sum, score) => sum + score, 0);
            const averageScore =
                scores.length > 0 ? Math.round(totalScore / scores.length) : 0;
            const highestScore = scores.length > 0 ? Math.max(...scores) : 0;

            const passedSessionCount = submittedSessions.filter(
                (session) => session.isPassed,
            ).length;

            const passRate = calculateRate(
                passedSessionCount,
                submittedSessions.length,
            );

            const answers: QuizAnswerItem[] = [];

            for (const session of submittedSessions) {
                const answerResult = await client.models.QuizAnswer.list({
                    filter: {
                        sessionId: {
                            eq: session.id,
                        },
                    },
                    limit: 1000,
                });

                if (answerResult.errors) {
                    console.error(
                        "QuizAnswer stats list errors:",
                        answerResult.errors,
                    );
                    continue;
                }

                answers.push(
                    ...((answerResult.data ?? []) as QuizAnswerItem[]),
                );
            }

            const totalAnswers = answers.length;
            const correctAnswers = answers.filter(
                (answer) => answer.isCorrect,
            ).length;
            const accuracyRate = calculateRate(correctAnswers, totalAnswers);

            const questionIds = Array.from(
                new Set(
                    answers
                        .map((answer) => answer.questionId)
                        .filter((questionId): questionId is string =>
                            Boolean(questionId),
                        ),
                ),
            );

            const questionById = new Map<string, QuestionItem>();

            for (const questionId of questionIds) {
                const questionResult = await client.models.Question.list({
                    filter: {
                        id: {
                            eq: questionId,
                        },
                    },
                    limit: 1,
                });

                if (questionResult.errors) {
                    console.error(
                        "Question stats list errors:",
                        questionResult.errors,
                    );
                    continue;
                }

                const question = (questionResult.data?.[0] ??
                    null) as QuestionItem | null;

                if (question) {
                    questionById.set(question.id, question);
                }
            }

            const categoryMap = new Map<
                string,
                {
                    totalAnswers: number;
                    correctAnswers: number;
                }
            >();

            answers.forEach((answer) => {
                if (!answer.questionId) {
                    return;
                }

                const question = questionById.get(answer.questionId);
                const categoryName = question?.categoryName?.trim() || "未分類";

                const current = categoryMap.get(categoryName) ?? {
                    totalAnswers: 0,
                    correctAnswers: 0,
                };

                categoryMap.set(categoryName, {
                    totalAnswers: current.totalAnswers + 1,
                    correctAnswers:
                        current.correctAnswers + (answer.isCorrect ? 1 : 0),
                });
            });

            const categoryStats: CategoryStatsItem[] = Array.from(
                categoryMap.entries(),
            )
                .map(([categoryName, value]) => ({
                    categoryName,
                    totalAnswers: value.totalAnswers,
                    correctAnswers: value.correctAnswers,
                    accuracyRate: calculateRate(
                        value.correctAnswers,
                        value.totalAnswers,
                    ),
                }))
                .sort((a, b) => b.totalAnswers - a.totalAnswers);

            setStats({
                submittedSessionCount: submittedSessions.length,
                passedSessionCount,
                averageScore,
                highestScore,
                passRate,
                totalAnswers,
                correctAnswers,
                accuracyRate,
                categoryStats,
            });
        } catch (error) {
            console.error("Study stats unexpected error:", error);
            Alert.alert("エラー", "学習統計の取得中にエラーが発生しました。");
        } finally {
            if (showLoading) {
                setLoading(false);
            }
        }
    }, []);

    useFocusEffect(
        useCallback(() => {
            void loadStats(true);
        }, [loadStats]),
    );

    const refreshStats = async () => {
        setRefreshing(true);

        try {
            await loadStats(false);
        } finally {
            setRefreshing(false);
        }
    };

    const renderCategoryStats = ({ item }: { item: CategoryStatsItem }) => {
        return (
            <View style={styles.categoryCard}>
                <View style={styles.categoryHeader}>
                    <Text style={styles.categoryName}>{item.categoryName}</Text>
                    <Text style={styles.categoryRate}>
                        {item.accuracyRate}%
                    </Text>
                </View>

                <View style={styles.progressBarBackground}>
                    <View
                        style={[
                            styles.progressBar,
                            {
                                width: `${item.accuracyRate}%`,
                            },
                        ]}
                    />
                </View>

                <Text style={styles.categoryDetail}>
                    正解 {item.correctAnswers} / 回答 {item.totalAnswers}
                </Text>
            </View>
        );
    };

    if (loading) {
        return (
            <View style={styles.center}>
                <ActivityIndicator />
                <Text style={styles.loadingText}>学習統計を読み込み中...</Text>
            </View>
        );
    }

    return (
        <View style={styles.root}>
            <FlatList
                data={stats.categoryStats}
                keyExtractor={(item) => item.categoryName}
                renderItem={renderCategoryStats}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={refreshStats}
                    />
                }
                contentContainerStyle={[
                    styles.container,
                    stats.submittedSessionCount === 0 && styles.emptyContainer,
                ]}
                ListHeaderComponent={
                    <>
                        <Text style={styles.title}>学習統計</Text>

                        {stats.submittedSessionCount === 0 ? (
                            <View style={styles.emptyBox}>
                                <Text style={styles.emptyTitle}>
                                    まだ統計データがありません
                                </Text>
                                <Text style={styles.emptyText}>
                                    試験を受けると、ここにスコアや正答率が表示されます。
                                </Text>
                            </View>
                        ) : (
                            <>
                                <View style={styles.summaryGrid}>
                                    <StatsBox
                                        label="受験回数"
                                        value={`${stats.submittedSessionCount}回`}
                                    />
                                    <StatsBox
                                        label="平均スコア"
                                        value={`${stats.averageScore}点`}
                                    />
                                    <StatsBox
                                        label="最高スコア"
                                        value={`${stats.highestScore}点`}
                                    />
                                    <StatsBox
                                        label="合格率"
                                        value={`${stats.passRate}%`}
                                    />
                                    <StatsBox
                                        label="総回答数"
                                        value={`${stats.totalAnswers}問`}
                                    />
                                    <StatsBox
                                        label="正答率"
                                        value={`${stats.accuracyRate}%`}
                                    />
                                </View>

                                <View style={styles.section}>
                                    <Text style={styles.sectionTitle}>
                                        苦手カテゴリ
                                    </Text>

                                    {weakCategories.length > 0 ? (
                                        weakCategories.map((item) => (
                                            <View
                                                key={item.categoryName}
                                                style={styles.weakCategoryRow}
                                            >
                                                <Text
                                                    style={
                                                        styles.weakCategoryName
                                                    }
                                                >
                                                    {item.categoryName}
                                                </Text>
                                                <Text
                                                    style={
                                                        styles.weakCategoryRate
                                                    }
                                                >
                                                    {item.accuracyRate}%
                                                </Text>
                                            </View>
                                        ))
                                    ) : (
                                        <Text style={styles.sectionText}>
                                            苦手カテゴリはまだ判定できません。
                                        </Text>
                                    )}
                                </View>

                                <View style={styles.section}>
                                    <Text style={styles.sectionTitle}>
                                        カテゴリ別正答率
                                    </Text>
                                </View>
                            </>
                        )}
                    </>
                }
                ListEmptyComponent={
                    stats.submittedSessionCount > 0 ? (
                        <View style={styles.emptyBox}>
                            <Text style={styles.emptyText}>
                                カテゴリ別データがありません。
                            </Text>
                        </View>
                    ) : null
                }
            />
        </View>
    );
}

function StatsBox({ label, value }: { label: string; value: string }) {
    return (
        <View style={styles.statsBox}>
            <Text style={styles.statsLabel}>{label}</Text>
            <Text style={styles.statsValue}>{value}</Text>
        </View>
    );
}

function calculateRate(numerator: number, denominator: number) {
    if (denominator <= 0) {
        return 0;
    }

    return Math.round((numerator / denominator) * 100);
}

const styles = StyleSheet.create({
    root: {
        flex: 1,
        backgroundColor: "#ffffff",
    },
    container: {
        padding: 20,
        gap: 14,
        backgroundColor: "#ffffff",
    },
    emptyContainer: {
        flexGrow: 1,
        justifyContent: "center",
    },
    title: {
        fontSize: 24,
        fontWeight: "bold",
        color: "#1f2937",
        marginBottom: 4,
    },
    summaryGrid: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 10,
    },
    statsBox: {
        width: "48%",
        padding: 14,
        borderRadius: 12,
        backgroundColor: "#f3f6f9",
        borderWidth: 1,
        borderColor: "#d8dce8",
        gap: 6,
    },
    statsLabel: {
        fontSize: 12,
        color: "#6b7280",
        fontWeight: "700",
    },
    statsValue: {
        fontSize: 22,
        color: "#1f2937",
        fontWeight: "bold",
    },
    section: {
        marginTop: 10,
        gap: 8,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: "bold",
        color: "#1f2937",
    },
    sectionText: {
        fontSize: 14,
        color: "#6b7280",
        lineHeight: 20,
    },
    weakCategoryRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        padding: 12,
        borderRadius: 10,
        backgroundColor: "#fff7ed",
        borderWidth: 1,
        borderColor: "#fed7aa",
    },
    weakCategoryName: {
        fontSize: 14,
        color: "#7c2d12",
        fontWeight: "700",
    },
    weakCategoryRate: {
        fontSize: 14,
        color: "#7c2d12",
        fontWeight: "bold",
    },
    categoryCard: {
        padding: 14,
        borderRadius: 12,
        backgroundColor: "#ffffff",
        borderWidth: 1,
        borderColor: "#d8dce8",
        gap: 8,
    },
    categoryHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        gap: 10,
    },
    categoryName: {
        flex: 1,
        fontSize: 15,
        color: "#1f2937",
        fontWeight: "bold",
    },
    categoryRate: {
        fontSize: 15,
        color: "#4f5f6f",
        fontWeight: "bold",
    },
    progressBarBackground: {
        height: 8,
        borderRadius: 999,
        backgroundColor: "#e5e7eb",
        overflow: "hidden",
    },
    progressBar: {
        height: 8,
        borderRadius: 999,
        backgroundColor: "#4f5f6f",
    },
    categoryDetail: {
        fontSize: 12,
        color: "#6b7280",
        fontWeight: "600",
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
        textAlign: "center",
    },
    emptyText: {
        fontSize: 14,
        color: "#6b7280",
        textAlign: "center",
        lineHeight: 20,
    },
});
