import { useState } from "react";
import {
    View,
    Text,
    TextInput,
    StyleSheet,
    ScrollView,
    Alert,
} from "react-native";
import AppButton from "../components/AppButton";
import { getCurrentUser } from "aws-amplify/auth";

import { client } from "../lib/client";

export default function AdminQuestionCreateScreen() {
    const [examCode, setExamCode] = useState("SAA");
    const [examTitle, setExamTitle] = useState(
        "AWS Solutions Architect Associate",
    );

    const [questionText, setQuestionText] = useState("");
    const [questionType, setQuestionType] = useState<"SINGLE" | "MULTIPLE">(
        "MULTIPLE",
    );
    const [selectionMax, setSelectionMax] = useState("2");

    const [choiceA, setChoiceA] = useState("");
    const [choiceB, setChoiceB] = useState("");
    const [choiceC, setChoiceC] = useState("");
    const [choiceD, setChoiceD] = useState("");

    const [correctLabels, setCorrectLabels] = useState("A,D");
    const [explanationText, setExplanationText] = useState("");

    const createQuestion = async () => {
        if (!questionText.trim()) {
            Alert.alert("入力エラー", "問題文を入力してください。");
            return;
        }

        if (!choiceA || !choiceB || !choiceC || !choiceD) {
            Alert.alert("入力エラー", "A〜Dの選択肢を入力してください。");
            return;
        }

        try {
            const user = await getCurrentUser();

            let examId: string;

            const examResult = await client.models.Exam.list({
                filter: {
                    code: {
                        eq: examCode,
                    },
                },
            });

            const existingExam = examResult.data?.[0];

            if (existingExam?.id) {
                examId = existingExam.id;
            } else {
                const createdExam = await client.models.Exam.create({
                    code: examCode,
                    title: examTitle,
                    description: `${examCode} 模擬問題`,
                    passScore: 72,
                    totalQuestions: 10,
                    timeLimitMinutes: 30,
                    isPublished: true,
                });

                if (createdExam.errors || !createdExam.data?.id) {
                    console.error("Exam create errors:", createdExam.errors);
                    Alert.alert("エラー", "試験情報の作成に失敗しました。");
                    return;
                }

                examId = createdExam.data.id;
            }

            const questionResult = await client.models.Question.create({
                examId,
                categoryName: "未分類",
                questionText,
                questionType,
                difficulty: "NORMAL",
                selectionMin:
                    questionType === "MULTIPLE" ? Number(selectionMax) : 1,
                selectionMax:
                    questionType === "MULTIPLE" ? Number(selectionMax) : 1,
                score: 1,
                status: "PUBLISHED",
                explanationSummary: explanationText.slice(0, 100),
                createdBy: user.userId,
                updatedBy: user.userId,
            });

            if (questionResult.errors || !questionResult.data?.id) {
                console.error("Question create errors:", questionResult.errors);
                Alert.alert("エラー", "問題の作成に失敗しました。");
                return;
            }

            const questionId = questionResult.data.id;

            const choices = [
                { label: "A", text: choiceA, order: 1 },
                { label: "B", text: choiceB, order: 2 },
                { label: "C", text: choiceC, order: 3 },
                { label: "D", text: choiceD, order: 4 },
            ];

            const createdChoices = [];

            for (const choice of choices) {
                const result = await client.models.Choice.create({
                    questionId,
                    label: choice.label,
                    choiceText: choice.text,
                    displayOrder: choice.order,
                });

                if (result.errors || !result.data?.id) {
                    console.error("Choice create errors:", result.errors);
                    Alert.alert("エラー", "選択肢の作成に失敗しました。");
                    return;
                }

                createdChoices.push({
                    id: result.data.id,
                    label: choice.label,
                });
            }

            const correctLabelList = correctLabels
                .split(",")
                .map((item) => item.trim().toUpperCase())
                .filter(Boolean);

            const correctChoiceIds = createdChoices
                .filter((choice) => correctLabelList.includes(choice.label))
                .map((choice) => choice.id);

            if (correctChoiceIds.length === 0) {
                Alert.alert("入力エラー", "正解の選択肢を指定してください。");
                return;
            }

            const solutionResult = await client.models.QuestionSolution.create({
                questionId,
                correctChoiceIds,
                explanationText,
                choiceExplanationsJson: JSON.stringify({}),
            });

            if (solutionResult.errors) {
                console.error("Solution create errors:", solutionResult.errors);
                Alert.alert("エラー", "正解・解説の作成に失敗しました。");
                return;
            }

            Alert.alert("登録完了", "問題を登録しました。");

            setQuestionText("");
            setChoiceA("");
            setChoiceB("");
            setChoiceC("");
            setChoiceD("");
            setCorrectLabels("A,D");
            setExplanationText("");
        } catch (error) {
            console.error("Create question error:", error);
            Alert.alert("エラー", "問題登録中にエラーが発生しました。");
        }
    };

    return (
        <ScrollView contentContainerStyle={styles.container}>
            <Text style={styles.title}>問題登録</Text>

            <Text style={styles.label}>試験コード</Text>
            <TextInput
                value={examCode}
                onChangeText={setExamCode}
                style={styles.input}
            />

            <Text style={styles.label}>試験名</Text>
            <TextInput
                value={examTitle}
                onChangeText={setExamTitle}
                style={styles.input}
            />

            <Text style={styles.label}>問題文</Text>
            <TextInput
                value={questionText}
                onChangeText={setQuestionText}
                style={[styles.input, styles.textArea]}
                multiline
            />

            <Text style={styles.label}>問題タイプ</Text>
            <View style={styles.row}>
                <AppButton
                    onPress={() => setQuestionType("SINGLE")}
                    style={styles.halfButton}
                    buttonColor={
                        questionType === "SINGLE" ? "#4f5f6f" : "#8a96a3"
                    }
                    labelStyle={styles.smallButtonLabel}
                >
                    単一選択
                </AppButton>

                <AppButton
                    onPress={() => setQuestionType("MULTIPLE")}
                    style={styles.halfButton}
                    buttonColor={
                        questionType === "MULTIPLE" ? "#4f5f6f" : "#8a96a3"
                    }
                    labelStyle={styles.smallButtonLabel}
                >
                    複数選択
                </AppButton>
            </View>
            <Text>現在: {questionType}</Text>

            <Text style={styles.label}>選択数</Text>
            <TextInput
                value={selectionMax}
                onChangeText={setSelectionMax}
                keyboardType="number-pad"
                style={styles.input}
            />

            <Text style={styles.label}>選択肢 A</Text>
            <TextInput
                value={choiceA}
                onChangeText={setChoiceA}
                style={styles.input}
            />

            <Text style={styles.label}>選択肢 B</Text>
            <TextInput
                value={choiceB}
                onChangeText={setChoiceB}
                style={styles.input}
            />

            <Text style={styles.label}>選択肢 C</Text>
            <TextInput
                value={choiceC}
                onChangeText={setChoiceC}
                style={styles.input}
            />

            <Text style={styles.label}>選択肢 D</Text>
            <TextInput
                value={choiceD}
                onChangeText={setChoiceD}
                style={styles.input}
            />

            <Text style={styles.label}>正解ラベル</Text>
            <TextInput
                value={correctLabels}
                onChangeText={setCorrectLabels}
                placeholder="例: A,D"
                style={styles.input}
            />

            <Text style={styles.label}>解説</Text>
            <TextInput
                value={explanationText}
                onChangeText={setExplanationText}
                style={[styles.input, styles.textArea]}
                multiline
            />

            <AppButton onPress={createQuestion}>登録</AppButton>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        padding: 16,
        gap: 8,
    },
    title: {
        fontSize: 22,
        fontWeight: "700",
        marginBottom: 16,
    },
    label: {
        fontWeight: "700",
        marginTop: 8,
    },
    input: {
        borderWidth: 1,
        borderColor: "#ccc",
        borderRadius: 8,
        padding: 10,
        backgroundColor: "#fff",
    },
    textArea: {
        minHeight: 100,
        textAlignVertical: "top",
    },
    row: {
        flexDirection: "row",
        gap: 8,
        alignItems: "center",
    },

    halfButton: {
        flex: 1,
        borderRadius: 12,
    },

    smallButtonLabel: {
        fontSize: 14,
        fontWeight: "bold",
    },
});
