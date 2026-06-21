import { useCallback, useEffect, useMemo, useState } from "react";
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    Alert,
    Pressable,
} from "react-native";
import AppButton from "../components/AppButton";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { getCurrentUser } from "aws-amplify/auth";

import { client } from "../lib/client";
import type { RootStackParamList } from "../navigation/RootNavigator";

type Props = NativeStackScreenProps<RootStackParamList, "Quiz">;

type QuestionItem = {
    id: string;
    questionText?: string | null;
    questionType?: string | null;
    selectionMax?: number | null;
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

export default function QuizScreen({ route, navigation }: Props) {
    const { examId } = route.params;

    const [questions, setQuestions] = useState<QuestionItem[]>([]);
    const [choices, setChoices] = useState<ChoiceItem[]>([]);
    const [solutions, setSolutions] = useState<SolutionItem[]>([]);

    const [currentIndex, setCurrentIndex] = useState(0);
    const [selectedChoiceIds, setSelectedChoiceIds] = useState<string[]>([]);
    const [answered, setAnswered] = useState(false);
    const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
    const [correctCount, setCorrectCount] = useState(0);
    const [sessionId, setSessionId] = useState<string | null>(null);

    const currentQuestion = questions[currentIndex];

    const currentChoices = useMemo(() => {
        if (!currentQuestion) {
            return [];
        }

        return choices
            .filter((choice) => choice.questionId === currentQuestion.id)
            .sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0));
    }, [choices, currentQuestion]);

    const currentSolution = useMemo(() => {
        if (!currentQuestion) {
            return null;
        }

        return solutions.find(
            (solution) => solution.questionId === currentQuestion.id,
        );
    }, [solutions, currentQuestion]);

    const loadQuiz = useCallback(async () => {
        try {
            const user = await getCurrentUser();

            const sessionResult = await client.models.QuizSession.create({
                userId: user.userId,
                examId,
                mode: "PRACTICE",
                startedAt: new Date().toISOString(),
                totalQuestions: 0,
                correctCount: 0,
                score: 0,
                passScore: 72,
                isPassed: false,
                status: "IN_PROGRESS",
            });

            if (sessionResult.errors || !sessionResult.data?.id) {
                console.error("Session create errors:", sessionResult.errors);
                Alert.alert("エラー", "セッション作成に失敗しました。");
                return;
            }

            setSessionId(sessionResult.data.id);

            const questionResult = await client.models.Question.list({
                filter: {
                    examId: {
                        eq: examId,
                    },
                    status: {
                        eq: "PUBLISHED",
                    },
                },
            });

            const questionData = (questionResult.data ?? []) as QuestionItem[];

            setQuestions(questionData);

            const questionIds = questionData.map((question) => question.id);

            const allChoices: ChoiceItem[] = [];
            const allSolutions: SolutionItem[] = [];

            for (const questionId of questionIds) {
                const choiceResult = await client.models.Choice.list({
                    filter: {
                        questionId: {
                            eq: questionId,
                        },
                    },
                });

                allChoices.push(...((choiceResult.data ?? []) as ChoiceItem[]));

                const solutionResult =
                    await client.models.QuestionSolution.list({
                        filter: {
                            questionId: {
                                eq: questionId,
                            },
                        },
                    });

                allSolutions.push(
                    ...((solutionResult.data ?? []) as SolutionItem[]),
                );
            }

            setChoices(allChoices);
            setSolutions(allSolutions);
        } catch (error) {
            console.error("Load quiz error:", error);
            Alert.alert("エラー", "問題の読み込みに失敗しました。");
        }
    }, [examId]);

    useEffect(() => {
        void loadQuiz();
    }, [loadQuiz]);

    const toggleChoice = (choiceId: string) => {
        if (answered || !currentQuestion) {
            return;
        }

        const questionType = currentQuestion.questionType ?? "SINGLE";

        if (questionType === "SINGLE") {
            setSelectedChoiceIds([choiceId]);
            return;
        }

        setSelectedChoiceIds((prev) => {
            if (prev.includes(choiceId)) {
                return prev.filter((id) => id !== choiceId);
            }

            const max = currentQuestion.selectionMax ?? 1;

            if (prev.length >= max) {
                return prev;
            }

            return [...prev, choiceId];
        });
    };

    const checkAnswer = async () => {
        if (!currentQuestion || !currentSolution || !sessionId) {
            return;
        }

        if (selectedChoiceIds.length === 0) {
            Alert.alert("未選択", "回答を選択してください。");
            return;
        }

        const correctChoiceIds = currentSolution.correctChoiceIds ?? [];

        const sortedSelected = [...selectedChoiceIds].sort();
        const sortedCorrect = [...correctChoiceIds].sort();

        const correct =
            sortedSelected.length === sortedCorrect.length &&
            sortedSelected.every((id, index) => id === sortedCorrect[index]);

        setIsCorrect(correct);
        setAnswered(true);

        if (correct) {
            setCorrectCount((prev) => prev + 1);
        }

        await client.models.QuizAnswer.create({
            sessionId,
            questionId: currentQuestion.id,
            selectedChoiceIds,
            isCorrect: correct,
            score: correct ? (currentQuestion.score ?? 1) : 0,
            answeredAt: new Date().toISOString(),
            explanationShown: true,
        });
    };

    const goNext = async () => {
        if (currentIndex + 1 < questions.length) {
            setCurrentIndex((prev) => prev + 1);
            setSelectedChoiceIds([]);
            setAnswered(false);
            setIsCorrect(null);
            return;
        }

        if (!sessionId) {
            return;
        }

        const finalCorrectCount = correctCount + (isCorrect ? 1 : 0);

        const score =
            questions.length > 0
                ? Math.round((finalCorrectCount / questions.length) * 100)
                : 0;

        const isPassed = score >= 72;

        await client.models.QuizSession.update({
            id: sessionId,
            submittedAt: new Date().toISOString(),
            totalQuestions: questions.length,
            correctCount: finalCorrectCount,
            score,
            passScore: 72,
            isPassed,
            status: "SUBMITTED",
        });

        navigation.replace("Result", {
            sessionId,
        });
    };

    if (!currentQuestion) {
        return (
            <View style={styles.container}>
                <Text>問題がありません。</Text>
            </View>
        );
    }

    return (
        <ScrollView contentContainerStyle={styles.container}>
            <Text style={styles.progress}>
                {currentIndex + 1} / {questions.length}
            </Text>

            <Text style={styles.question}>{currentQuestion.questionText}</Text>

            {currentChoices.map((choice) => {
                const selected = selectedChoiceIds.includes(choice.id);

                return (
                    <Pressable
                        key={choice.id}
                        onPress={() => toggleChoice(choice.id)}
                        style={[
                            styles.choice,
                            selected && styles.choiceSelected,
                        ]}
                    >
                        <Text style={styles.choiceText}>
                            {choice.label}. {choice.choiceText}
                        </Text>
                    </Pressable>
                );
            })}

            {!answered ? (
                <AppButton onPress={checkAnswer}>回答する</AppButton>
            ) : (
                <View style={styles.resultBox}>
                    <Text style={isCorrect ? styles.correct : styles.incorrect}>
                        {isCorrect ? "正解" : "不正解"}
                    </Text>

                    <Text style={styles.explanation}>
                        {currentSolution?.explanationText}
                    </Text>

                    <AppButton onPress={goNext}>
                        {currentIndex + 1 < questions.length
                            ? "次の問題へ"
                            : "結果を見る"}
                    </AppButton>
                </View>
            )}
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        padding: 16,
        gap: 12,
    },
    progress: {
        fontSize: 14,
        color: "#666",
    },
    question: {
        fontSize: 18,
        fontWeight: "700",
        marginBottom: 12,
    },
    choice: {
        borderWidth: 1,
        borderColor: "#ccc",
        borderRadius: 8,
        padding: 12,
        backgroundColor: "#fff",
    },
    choiceSelected: {
        borderColor: "#4b6f8f",
        backgroundColor: "#e8f1f8",
    },
    choiceText: {
        fontSize: 16,
    },
    resultBox: {
        marginTop: 16,
        padding: 16,
        borderRadius: 8,
        backgroundColor: "#f5f5f5",
        gap: 8,
    },
    correct: {
        color: "green",
        fontSize: 20,
        fontWeight: "700",
    },
    incorrect: {
        color: "red",
        fontSize: 20,
        fontWeight: "700",
    },
    explanation: {
        fontSize: 15,
        lineHeight: 22,
    },
});
