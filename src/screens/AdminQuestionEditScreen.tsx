import { useCallback, useEffect, useMemo, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import AppButton from "../components/AppButton";
import { client } from "../lib/client";
import type { RootStackParamList } from "../navigation/RootNavigator";

type Props = NativeStackScreenProps<RootStackParamList, "AdminQuestionEdit">;

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

type ChoiceFormItem = {
    id?: string | null;
    label: string;
    choiceText: string;
    displayOrder: number;
};

type QuestionForm = {
    categoryName: string;
    questionText: string;
    questionType: string;
    difficulty: string;
    selectionMin: string;
    selectionMax: string;
    score: string;
    status: string;
    explanationSummary: string;
    correctLabels: string;
    explanationText: string;
};

const CHOICE_LABELS = ["A", "B", "C", "D", "E", "F"] as const;

const initialForm: QuestionForm = {
    categoryName: "",
    questionText: "",
    questionType: "SINGLE",
    difficulty: "NORMAL",
    selectionMin: "1",
    selectionMax: "1",
    score: "1",
    status: "DRAFT",
    explanationSummary: "",
    correctLabels: "",
    explanationText: "",
};

function createInitialChoices(): ChoiceFormItem[] {
    return CHOICE_LABELS.map((label, index) => ({
        id: null,
        label,
        choiceText: "",
        displayOrder: index + 1,
    }));
}

export default function AdminQuestionEditScreen({ route, navigation }: Props) {
    const { questionId } = route.params;

    const [form, setForm] = useState<QuestionForm>(initialForm);
    const [choices, setChoices] = useState<ChoiceFormItem[]>(
        createInitialChoices(),
    );
    const [solutionId, setSolutionId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const selectedChoiceCount = useMemo(() => {
        return choices.filter((choice) => choice.choiceText.trim()).length;
    }, [choices]);

    const updateForm = (key: keyof QuestionForm, value: string) => {
        setForm((current) => ({
            ...current,
            [key]: value,
        }));
    };

    const updateChoiceText = (label: string, value: string) => {
        setChoices((current) =>
            current.map((choice) =>
                choice.label === label
                    ? {
                          ...choice,
                          choiceText: value,
                      }
                    : choice,
            ),
        );
    };

    const loadQuestion = useCallback(async () => {
        setLoading(true);

        try {
            const questionResult = await client.models.Question.list({
                filter: {
                    id: {
                        eq: questionId,
                    },
                },
                limit: 1,
            });

            if (questionResult.errors) {
                console.error("Question get errors:", questionResult.errors);
                Alert.alert("エラー", "問題情報の取得に失敗しました。");
                return;
            }

            const question = (questionResult.data?.[0] ??
                null) as QuestionItem | null;

            if (!question) {
                Alert.alert("エラー", "問題情報が見つかりませんでした。");
                return;
            }

            const choiceResult = await client.models.Choice.list({
                filter: {
                    questionId: {
                        eq: questionId,
                    },
                },
                limit: 1000,
            });

            if (choiceResult.errors) {
                console.error("Choice list errors:", choiceResult.errors);
                Alert.alert("エラー", "選択肢の取得に失敗しました。");
                return;
            }

            const loadedChoices = (
                (choiceResult.data ?? []) as ChoiceItem[]
            ).sort((a, b) => {
                return (a.displayOrder ?? 0) - (b.displayOrder ?? 0);
            });

            const solutionResult = await client.models.QuestionSolution.list({
                filter: {
                    questionId: {
                        eq: questionId,
                    },
                },
                limit: 1,
            });

            if (solutionResult.errors) {
                console.error(
                    "QuestionSolution list errors:",
                    solutionResult.errors,
                );
                Alert.alert("エラー", "正解・解説の取得に失敗しました。");
                return;
            }

            const solution = (solutionResult.data?.[0] ??
                null) as SolutionItem | null;

            const choiceFormItems = createInitialChoices().map((baseChoice) => {
                const loadedChoice = loadedChoices.find(
                    (choice) => choice.label === baseChoice.label,
                );

                if (!loadedChoice) {
                    return baseChoice;
                }

                return {
                    id: loadedChoice.id,
                    label: baseChoice.label,
                    choiceText: loadedChoice.choiceText ?? "",
                    displayOrder:
                        loadedChoice.displayOrder ?? baseChoice.displayOrder,
                };
            });

            const correctLabels =
                solution?.correctChoiceIds
                    ?.map((correctChoiceId) => {
                        const targetChoice = loadedChoices.find(
                            (choice) => choice.id === correctChoiceId,
                        );

                        return targetChoice?.label ?? "";
                    })
                    .filter(Boolean)
                    .join(",") ?? "";

            setForm({
                categoryName: question.categoryName ?? "",
                questionText: question.questionText ?? "",
                questionType: question.questionType ?? "SINGLE",
                difficulty: question.difficulty ?? "NORMAL",
                selectionMin: String(question.selectionMin ?? 1),
                selectionMax: String(question.selectionMax ?? 1),
                score: String(question.score ?? 1),
                status: question.status ?? "DRAFT",
                explanationSummary: question.explanationSummary ?? "",
                correctLabels,
                explanationText: solution?.explanationText ?? "",
            });

            setChoices(choiceFormItems);
            setSolutionId(solution?.id ?? null);
        } catch (error) {
            console.error("Question edit load unexpected error:", error);
            Alert.alert("エラー", "問題情報の取得中にエラーが発生しました。");
        } finally {
            setLoading(false);
        }
    }, [questionId]);

    useEffect(() => {
        void loadQuestion();
    }, [loadQuestion]);

    const validateForm = () => {
        const questionText = form.questionText.trim();

        if (!questionText) {
            Alert.alert("入力エラー", "問題文を入力してください。");
            return null;
        }

        const activeChoices = choices.filter((choice) =>
            choice.choiceText.trim(),
        );

        if (activeChoices.length < 2) {
            Alert.alert("入力エラー", "選択肢は最低2件以上入力してください。");
            return null;
        }

        const questionType = form.questionType.trim().toUpperCase();
        const difficulty = form.difficulty.trim().toUpperCase();
        const status = form.status.trim().toUpperCase();

        if (questionType !== "SINGLE" && questionType !== "MULTIPLE") {
            Alert.alert(
                "入力エラー",
                "問題種別は SINGLE または MULTIPLE を入力してください。",
            );
            return null;
        }

        if (status !== "DRAFT" && status !== "PUBLISHED") {
            Alert.alert(
                "入力エラー",
                "公開状態は DRAFT または PUBLISHED を入力してください。",
            );
            return null;
        }

        const selectionMin = Number(form.selectionMin);
        const selectionMax = Number(form.selectionMax);
        const score = Number(form.score);

        if (!Number.isInteger(selectionMin) || selectionMin <= 0) {
            Alert.alert(
                "入力エラー",
                "最小選択数は1以上の整数で入力してください。",
            );
            return null;
        }

        if (!Number.isInteger(selectionMax) || selectionMax <= 0) {
            Alert.alert(
                "入力エラー",
                "最大選択数は1以上の整数で入力してください。",
            );
            return null;
        }

        if (selectionMin > selectionMax) {
            Alert.alert(
                "入力エラー",
                "最小選択数は最大選択数以下にしてください。",
            );
            return null;
        }

        if (selectionMax > activeChoices.length) {
            Alert.alert("入力エラー", "最大選択数が選択肢数を超えています。");
            return null;
        }

        if (!Number.isInteger(score) || score <= 0) {
            Alert.alert("入力エラー", "点数は1以上の整数で入力してください。");
            return null;
        }

        const correctLabels = form.correctLabels
            .split(",")
            .map((label) => label.trim().toUpperCase())
            .filter(Boolean);

        if (correctLabels.length === 0) {
            Alert.alert("入力エラー", "正解ラベルを入力してください。");
            return null;
        }

        const activeChoiceLabels = activeChoices.map((choice) => choice.label);

        const invalidLabel = correctLabels.find(
            (label) => !activeChoiceLabels.includes(label),
        );

        if (invalidLabel) {
            Alert.alert(
                "入力エラー",
                `正解ラベル「${invalidLabel}」に対応する選択肢がありません。`,
            );
            return null;
        }

        if (questionType === "SINGLE" && correctLabels.length !== 1) {
            Alert.alert(
                "入力エラー",
                "SINGLE の場合、正解は1つだけにしてください。",
            );
            return null;
        }

        if (
            questionType === "MULTIPLE" &&
            correctLabels.length < selectionMin
        ) {
            Alert.alert(
                "入力エラー",
                "正解数が最小選択数より少なくなっています。",
            );
            return null;
        }

        if (
            questionType === "MULTIPLE" &&
            correctLabels.length > selectionMax
        ) {
            Alert.alert("入力エラー", "正解数が最大選択数を超えています。");
            return null;
        }

        return {
            categoryName: form.categoryName.trim(),
            questionText,
            questionType,
            difficulty,
            selectionMin,
            selectionMax,
            score,
            status,
            explanationSummary: form.explanationSummary.trim(),
            activeChoices,
            correctLabels,
            explanationText: form.explanationText.trim(),
        };
    };

    const saveQuestion = async () => {
        const validated = validateForm();

        if (!validated) {
            return;
        }

        setSaving(true);

        try {
            const questionUpdateResult = await client.models.Question.update({
                id: questionId,
                categoryName: validated.categoryName || null,
                questionText: validated.questionText,
                questionType: validated.questionType,
                difficulty: validated.difficulty || null,
                selectionMin: validated.selectionMin,
                selectionMax: validated.selectionMax,
                score: validated.score,
                status: validated.status,
                explanationSummary: validated.explanationSummary || null,
            });

            if (questionUpdateResult.errors) {
                console.error(
                    "Question update errors:",
                    questionUpdateResult.errors,
                );
                Alert.alert("エラー", "問題情報の更新に失敗しました。");
                return;
            }

            const savedChoiceIdByLabel = new Map<string, string>();

            for (const choice of choices) {
                const choiceText = choice.choiceText.trim();

                if (!choiceText) {
                    if (choice.id) {
                        const deleteResult = await client.models.Choice.delete({
                            id: choice.id,
                        });

                        if (deleteResult.errors) {
                            console.error(
                                "Choice delete errors:",
                                deleteResult.errors,
                            );
                            Alert.alert(
                                "エラー",
                                `選択肢${choice.label}の削除に失敗しました。`,
                            );
                            return;
                        }
                    }

                    continue;
                }

                if (choice.id) {
                    const updateResult = await client.models.Choice.update({
                        id: choice.id,
                        questionId,
                        label: choice.label,
                        choiceText,
                        displayOrder: choice.displayOrder,
                    });

                    if (updateResult.errors || !updateResult.data?.id) {
                        console.error(
                            "Choice update errors:",
                            updateResult.errors,
                        );
                        Alert.alert(
                            "エラー",
                            `選択肢${choice.label}の更新に失敗しました。`,
                        );
                        return;
                    }

                    savedChoiceIdByLabel.set(
                        choice.label,
                        updateResult.data.id,
                    );
                    continue;
                }

                const createResult = await client.models.Choice.create({
                    questionId,
                    label: choice.label,
                    choiceText,
                    displayOrder: choice.displayOrder,
                });

                if (createResult.errors || !createResult.data?.id) {
                    console.error("Choice create errors:", createResult.errors);
                    Alert.alert(
                        "エラー",
                        `選択肢${choice.label}の作成に失敗しました。`,
                    );
                    return;
                }

                savedChoiceIdByLabel.set(choice.label, createResult.data.id);
            }

            const correctChoiceIds = validated.correctLabels
                .map((label) => savedChoiceIdByLabel.get(label))
                .filter((id): id is string => Boolean(id));

            if (correctChoiceIds.length !== validated.correctLabels.length) {
                Alert.alert(
                    "エラー",
                    "正解に対応する選択肢IDを取得できませんでした。",
                );
                return;
            }

            if (solutionId) {
                const solutionUpdateResult =
                    await client.models.QuestionSolution.update({
                        id: solutionId,
                        questionId,
                        correctChoiceIds,
                        explanationText: validated.explanationText || null,
                    });

                if (solutionUpdateResult.errors) {
                    console.error(
                        "QuestionSolution update errors:",
                        solutionUpdateResult.errors,
                    );
                    Alert.alert("エラー", "正解・解説の更新に失敗しました。");
                    return;
                }
            } else {
                const solutionCreateResult =
                    await client.models.QuestionSolution.create({
                        questionId,
                        correctChoiceIds,
                        explanationText: validated.explanationText || null,
                    });

                if (
                    solutionCreateResult.errors ||
                    !solutionCreateResult.data?.id
                ) {
                    console.error(
                        "QuestionSolution create errors:",
                        solutionCreateResult.errors,
                    );
                    Alert.alert("エラー", "正解・解説の作成に失敗しました。");
                    return;
                }

                setSolutionId(solutionCreateResult.data.id);
            }

            Alert.alert("更新完了", "問題情報を更新しました。", [
                {
                    text: "OK",
                    onPress: () => navigation.goBack(),
                },
            ]);
        } catch (error) {
            console.error("Question edit save unexpected error:", error);
            Alert.alert("エラー", "問題情報の更新中にエラーが発生しました。");
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <View style={styles.center}>
                <ActivityIndicator />
                <Text style={styles.loadingText}>問題情報を読み込み中...</Text>
            </View>
        );
    }

    return (
        <KeyboardAvoidingView
            style={styles.root}
            behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
            <ScrollView contentContainerStyle={styles.container}>
                <Text style={styles.title}>問題を編集</Text>

                <View style={styles.formGroup}>
                    <Text style={styles.label}>カテゴリ</Text>
                    <TextInput
                        value={form.categoryName}
                        onChangeText={(value) =>
                            updateForm("categoryName", value)
                        }
                        placeholder="例: Storage"
                        style={styles.input}
                    />
                </View>

                <View style={styles.formGroup}>
                    <Text style={styles.label}>問題文</Text>
                    <TextInput
                        value={form.questionText}
                        onChangeText={(value) =>
                            updateForm("questionText", value)
                        }
                        placeholder="問題文を入力"
                        multiline
                        style={[styles.input, styles.questionInput]}
                    />
                </View>

                <View style={styles.row}>
                    <View style={styles.rowItem}>
                        <Text style={styles.label}>問題種別</Text>
                        <TextInput
                            value={form.questionType}
                            onChangeText={(value) =>
                                updateForm("questionType", value.toUpperCase())
                            }
                            placeholder="SINGLE / MULTIPLE"
                            autoCapitalize="characters"
                            style={styles.input}
                        />
                    </View>

                    <View style={styles.rowItem}>
                        <Text style={styles.label}>難易度</Text>
                        <TextInput
                            value={form.difficulty}
                            onChangeText={(value) =>
                                updateForm("difficulty", value.toUpperCase())
                            }
                            placeholder="EASY / NORMAL / HARD"
                            autoCapitalize="characters"
                            style={styles.input}
                        />
                    </View>
                </View>

                <View style={styles.row}>
                    <View style={styles.rowItem}>
                        <Text style={styles.label}>最小選択数</Text>
                        <TextInput
                            value={form.selectionMin}
                            onChangeText={(value) =>
                                updateForm("selectionMin", value)
                            }
                            keyboardType="number-pad"
                            style={styles.input}
                        />
                    </View>

                    <View style={styles.rowItem}>
                        <Text style={styles.label}>最大選択数</Text>
                        <TextInput
                            value={form.selectionMax}
                            onChangeText={(value) =>
                                updateForm("selectionMax", value)
                            }
                            keyboardType="number-pad"
                            style={styles.input}
                        />
                    </View>

                    <View style={styles.rowItem}>
                        <Text style={styles.label}>点数</Text>
                        <TextInput
                            value={form.score}
                            onChangeText={(value) => updateForm("score", value)}
                            keyboardType="number-pad"
                            style={styles.input}
                        />
                    </View>
                </View>

                <View style={styles.formGroup}>
                    <Text style={styles.label}>公開状態</Text>
                    <TextInput
                        value={form.status}
                        onChangeText={(value) =>
                            updateForm("status", value.toUpperCase())
                        }
                        placeholder="DRAFT / PUBLISHED"
                        autoCapitalize="characters"
                        style={styles.input}
                    />
                </View>

                <Text style={styles.sectionTitle}>
                    選択肢（入力済み: {selectedChoiceCount}件）
                </Text>

                {choices.map((choice) => (
                    <View key={choice.label} style={styles.formGroup}>
                        <Text style={styles.label}>選択肢 {choice.label}</Text>
                        <TextInput
                            value={choice.choiceText}
                            onChangeText={(value) =>
                                updateChoiceText(choice.label, value)
                            }
                            placeholder={`選択肢 ${choice.label}`}
                            multiline
                            style={[styles.input, styles.choiceInput]}
                        />
                    </View>
                ))}

                <View style={styles.formGroup}>
                    <Text style={styles.label}>正解ラベル</Text>
                    <TextInput
                        value={form.correctLabels}
                        onChangeText={(value) =>
                            updateForm("correctLabels", value.toUpperCase())
                        }
                        placeholder="例: A または A,C"
                        autoCapitalize="characters"
                        style={styles.input}
                    />
                    <Text style={styles.helpText}>
                        複数正解の場合は A,C
                        のようにカンマ区切りで入力してください。
                    </Text>
                </View>

                <View style={styles.formGroup}>
                    <Text style={styles.label}>解説要約</Text>
                    <TextInput
                        value={form.explanationSummary}
                        onChangeText={(value) =>
                            updateForm("explanationSummary", value)
                        }
                        placeholder="一覧や結果に表示する短い要約"
                        style={styles.input}
                    />
                </View>

                <View style={styles.formGroup}>
                    <Text style={styles.label}>解説本文</Text>
                    <TextInput
                        value={form.explanationText}
                        onChangeText={(value) =>
                            updateForm("explanationText", value)
                        }
                        placeholder="正解の理由や補足説明"
                        multiline
                        style={[styles.input, styles.explanationInput]}
                    />
                </View>

                <AppButton onPress={saveQuestion} disabled={saving}>
                    {saving ? "更新中..." : "問題を更新"}
                </AppButton>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    root: {
        flex: 1,
        backgroundColor: "#ffffff",
    },
    container: {
        padding: 16,
        gap: 14,
    },
    title: {
        fontSize: 22,
        fontWeight: "bold",
        color: "#1f2937",
        marginBottom: 8,
    },
    sectionTitle: {
        marginTop: 8,
        fontSize: 18,
        fontWeight: "bold",
        color: "#1f2937",
    },
    formGroup: {
        gap: 6,
    },
    label: {
        fontSize: 14,
        fontWeight: "700",
        color: "#374151",
    },
    input: {
        borderWidth: 1,
        borderColor: "#cfd7e2",
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 10,
        fontSize: 16,
        backgroundColor: "#ffffff",
        color: "#1f2937",
    },
    questionInput: {
        minHeight: 120,
        textAlignVertical: "top",
    },
    choiceInput: {
        minHeight: 72,
        textAlignVertical: "top",
    },
    explanationInput: {
        minHeight: 120,
        textAlignVertical: "top",
    },
    row: {
        flexDirection: "row",
        gap: 10,
    },
    rowItem: {
        flex: 1,
        gap: 6,
    },
    helpText: {
        fontSize: 12,
        color: "#6b7280",
        lineHeight: 18,
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
});
