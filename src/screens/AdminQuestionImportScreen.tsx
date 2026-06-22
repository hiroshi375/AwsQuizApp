import * as DocumentPicker from "expo-document-picker";
import { File } from "expo-file-system";
import Papa from "papaparse";
import { useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";

import { client } from "../lib/client";

type ImportCsvRow = {
    examCode?: string;
    categoryName?: string;
    difficulty?: string;
    questionType?: string;
    questionText?: string;
    selectionMin?: string;
    selectionMax?: string;
    score?: string;
    status?: string;
    choiceA?: string;
    choiceB?: string;
    choiceC?: string;
    choiceD?: string;
    choiceE?: string;
    choiceF?: string;
    correctLabels?: string;
    explanationText?: string;
};

type ImportResult = {
    total: number;
    success: number;
    failed: number;
    errors: string[];
};

type ExamListResult = {
    data?: any[] | null;
    errors?: unknown;
};

type MutationResult = {
    data?: {
        id?: string | null;
    } | null;
    errors?: unknown;
};

const CHOICE_COLUMNS = [
    { label: "A", key: "choiceA" },
    { label: "B", key: "choiceB" },
    { label: "C", key: "choiceC" },
    { label: "D", key: "choiceD" },
    { label: "E", key: "choiceE" },
    { label: "F", key: "choiceF" },
] as const;

export default function AdminQuestionImportScreen() {
    const [importing, setImporting] = useState(false);
    const [result, setResult] = useState<ImportResult | null>(null);

    const handlePickCsv = async () => {
        try {
            setResult(null);

            const pickerResult = await DocumentPicker.getDocumentAsync({
                type: [
                    "text/csv",
                    "text/comma-separated-values",
                    "application/vnd.ms-excel",
                ],
                copyToCacheDirectory: true,
            });

            if (pickerResult.canceled) {
                return;
            }

            const asset = pickerResult.assets[0];

            if (!asset?.uri) {
                Alert.alert(
                    "CSV読込エラー",
                    "CSVファイルを取得できませんでした。",
                );
                return;
            }

            setImporting(true);

            const file = new File(asset.uri);
            const csvText = await file.text();

            const parsed = Papa.parse<ImportCsvRow>(csvText, {
                header: true,
                skipEmptyLines: true,
            });

            if (parsed.errors.length > 0) {
                console.error("CSV parse errors:", parsed.errors);
                Alert.alert("CSV解析エラー", "CSVの形式を確認してください。");
                return;
            }

            const rows = parsed.data.filter((row) => {
                return Object.values(row).some(
                    (value) =>
                        typeof value === "string" && value.trim().length > 0,
                );
            });

            const importResult = await importQuestions(rows);

            setResult(importResult);

            Alert.alert(
                "インポート完了",
                `成功: ${importResult.success}件 / 失敗: ${importResult.failed}件`,
            );
        } catch (error) {
            console.error("CSV import error:", error);
            Alert.alert(
                "インポートエラー",
                "CSVインポート中にエラーが発生しました。",
            );
        } finally {
            setImporting(false);
        }
    };

    return (
        <ScrollView contentContainerStyle={styles.container}>
            <Text style={styles.title}>問題CSVインポート</Text>

            <Text style={styles.description}>
                CSVから Question / Choice / QuestionSolution を一括作成します。
            </Text>

            <Pressable
                style={({ pressed }) => [
                    styles.importButton,
                    pressed && styles.buttonPressed,
                    importing && styles.disabledButton,
                ]}
                disabled={importing}
                onPress={handlePickCsv}
            >
                <Text style={styles.importButtonText}>
                    CSVファイルを選択してインポート
                </Text>
            </Pressable>

            {importing && (
                <View style={styles.loadingRow}>
                    <ActivityIndicator />
                    <Text style={styles.loadingText}>インポート中...</Text>
                </View>
            )}

            {result && (
                <View style={styles.resultBox}>
                    <Text style={styles.resultTitle}>インポート結果</Text>
                    <Text style={styles.resultText}>
                        対象: {result.total}件
                    </Text>
                    <Text style={styles.resultText}>
                        成功: {result.success}件
                    </Text>
                    <Text style={styles.resultText}>
                        失敗: {result.failed}件
                    </Text>

                    {result.errors.length > 0 && (
                        <View style={styles.errorBox}>
                            <Text style={styles.errorTitle}>エラー</Text>
                            {result.errors.map((error, index) => (
                                <Text
                                    key={`${error}-${index}`}
                                    style={styles.errorText}
                                >
                                    ・{error}
                                </Text>
                            ))}
                        </View>
                    )}
                </View>
            )}
        </ScrollView>
    );
}

async function importQuestions(rows: ImportCsvRow[]): Promise<ImportResult> {
    const result: ImportResult = {
        total: rows.length,
        success: 0,
        failed: 0,
        errors: [],
    };

    const examCache = new Map<string, string>();

    for (let index = 0; index < rows.length; index += 1) {
        const row = normalizeRow(rows[index]);
        const rowNumber = index + 2; // header行が1行目なのでCSV上の行番号に合わせる

        try {
            validateRow(row, rowNumber);

            const examId = await findExamIdByCode(row.examCode, examCache);

            if (!examId) {
                throw new Error(
                    `行${rowNumber}: examCode=${row.examCode} のExamが見つかりません。`,
                );
            }

            const questionType = row.questionType.toUpperCase();
            const correctLabels = parseCorrectLabels(row.correctLabels);

            const selectionMin = parseIntegerOrDefault(
                row.selectionMin,
                questionType === "MULTIPLE" ? correctLabels.length : 1,
            );

            const selectionMax = parseIntegerOrDefault(
                row.selectionMax,
                questionType === "MULTIPLE" ? correctLabels.length : 1,
            );

            const score = parseIntegerOrDefault(row.score, 1);

            const questionResult = (await client.models.Question.create({
                examId,
                categoryName: row.categoryName || undefined,
                questionText: row.questionText,
                questionType,
                difficulty: row.difficulty || undefined,
                selectionMin,
                selectionMax,
                score,
                status: row.status || "DRAFT",
                explanationSummary: row.explanationText
                    ? row.explanationText.slice(0, 80)
                    : undefined,
            })) as MutationResult;

            if (questionResult.errors) {
                console.error("Question create errors:", questionResult.errors);
                throw new Error(`行${rowNumber}: Question作成に失敗しました。`);
            }

            const questionId = questionResult.data?.id;

            if (!questionId) {
                throw new Error(
                    `行${rowNumber}: Question IDを取得できませんでした。`,
                );
            }

            const choiceIdByLabel = await createChoices(
                questionId,
                row,
                rowNumber,
            );

            const correctChoiceIds = correctLabels.map((label) => {
                const choiceId = choiceIdByLabel[label];

                if (!choiceId) {
                    throw new Error(
                        `行${rowNumber}: 正解ラベル ${label} に対応する選択肢がありません。`,
                    );
                }

                return choiceId;
            });

            const solutionResult = (await client.models.QuestionSolution.create(
                {
                    questionId,
                    correctChoiceIds,
                    explanationText: row.explanationText || undefined,
                },
            )) as MutationResult;

            if (solutionResult.errors) {
                console.error(
                    "QuestionSolution create errors:",
                    solutionResult.errors,
                );
                throw new Error(
                    `行${rowNumber}: QuestionSolution作成に失敗しました。`,
                );
            }

            result.success += 1;
        } catch (error) {
            result.failed += 1;

            const message =
                error instanceof Error
                    ? error.message
                    : `行${rowNumber}: 不明なエラー`;

            console.error("Import row error:", message);
            result.errors.push(message);
        }
    }

    return result;
}

function normalizeRow(row: ImportCsvRow): Required<ImportCsvRow> {
    return {
        examCode: normalizeText(row.examCode),
        categoryName: normalizeText(row.categoryName),
        difficulty: normalizeText(row.difficulty),
        questionType: normalizeText(row.questionType),
        questionText: normalizeText(row.questionText),
        selectionMin: normalizeText(row.selectionMin),
        selectionMax: normalizeText(row.selectionMax),
        score: normalizeText(row.score),
        status: normalizeText(row.status),
        choiceA: normalizeText(row.choiceA),
        choiceB: normalizeText(row.choiceB),
        choiceC: normalizeText(row.choiceC),
        choiceD: normalizeText(row.choiceD),
        choiceE: normalizeText(row.choiceE),
        choiceF: normalizeText(row.choiceF),
        correctLabels: normalizeText(row.correctLabels),
        explanationText: normalizeText(row.explanationText),
    };
}

function normalizeText(value: unknown) {
    if (typeof value !== "string") {
        return "";
    }

    return value.trim();
}

function validateRow(row: Required<ImportCsvRow>, rowNumber: number) {
    if (!row.examCode) {
        throw new Error(`行${rowNumber}: examCode が未入力です。`);
    }

    if (!row.questionText) {
        throw new Error(`行${rowNumber}: questionText が未入力です。`);
    }

    if (!row.questionType) {
        throw new Error(`行${rowNumber}: questionType が未入力です。`);
    }

    const questionType = row.questionType.toUpperCase();

    if (questionType !== "SINGLE" && questionType !== "MULTIPLE") {
        throw new Error(
            `行${rowNumber}: questionType は SINGLE または MULTIPLE にしてください。`,
        );
    }

    const choices = CHOICE_COLUMNS.filter(({ key }) => row[key]);

    if (choices.length < 2) {
        throw new Error(`行${rowNumber}: 選択肢は2つ以上必要です。`);
    }

    if (!row.correctLabels) {
        throw new Error(`行${rowNumber}: correctLabels が未入力です。`);
    }

    const correctLabels = parseCorrectLabels(row.correctLabels);

    if (questionType === "SINGLE" && correctLabels.length !== 1) {
        throw new Error(
            `行${rowNumber}: SINGLE の correctLabels は1つだけにしてください。`,
        );
    }

    for (const label of correctLabels) {
        const hasChoice = CHOICE_COLUMNS.some(
            ({ label: choiceLabel, key }) =>
                choiceLabel === label && Boolean(row[key]),
        );

        if (!hasChoice) {
            throw new Error(
                `行${rowNumber}: 正解ラベル ${label} に対応する選択肢がありません。`,
            );
        }
    }
}

async function findExamIdByCode(
    examCode: string,
    examCache: Map<string, string>,
) {
    const normalizedCode = examCode.toUpperCase();

    const cachedExamId = examCache.get(normalizedCode);

    if (cachedExamId) {
        return cachedExamId;
    }

    const examResult = (await client.models.Exam.list({
        filter: {
            code: {
                eq: normalizedCode,
            },
        },
        limit: 1,
    })) as ExamListResult;

    if (examResult.errors) {
        console.error("Exam list errors:", examResult.errors);
        return null;
    }

    const exam = examResult.data?.[0];

    if (!exam?.id) {
        return null;
    }

    examCache.set(normalizedCode, exam.id);

    return exam.id as string;
}

async function createChoices(
    questionId: string,
    row: Required<ImportCsvRow>,
    rowNumber: number,
) {
    const choiceIdByLabel: Record<string, string> = {};

    const validChoices = CHOICE_COLUMNS.filter(({ key }) => row[key]);

    for (let index = 0; index < validChoices.length; index += 1) {
        const { label, key } = validChoices[index];

        const choiceResult = (await client.models.Choice.create({
            questionId,
            label,
            choiceText: row[key],
            displayOrder: index + 1,
        })) as MutationResult;

        if (choiceResult.errors) {
            console.error("Choice create errors:", choiceResult.errors);
            throw new Error(
                `行${rowNumber}: Choice ${label} の作成に失敗しました。`,
            );
        }

        const choiceId = choiceResult.data?.id;

        if (!choiceId) {
            throw new Error(
                `行${rowNumber}: Choice ${label} のIDを取得できませんでした。`,
            );
        }

        choiceIdByLabel[label] = choiceId;
    }

    return choiceIdByLabel;
}

function parseCorrectLabels(value: string) {
    return value
        .split(/[,\s、|/]+/)
        .map((label) => label.trim().toUpperCase())
        .filter(Boolean);
}

function parseIntegerOrDefault(value: string, defaultValue: number) {
    const parsed = Number.parseInt(value, 10);

    if (!Number.isFinite(parsed)) {
        return defaultValue;
    }

    return parsed;
}

const styles = StyleSheet.create({
    container: {
        padding: 16,
        backgroundColor: "#ffffff",
    },
    title: {
        fontSize: 20,
        fontWeight: "bold",
        marginBottom: 8,
        color: "#222222",
    },
    description: {
        fontSize: 14,
        color: "#555555",
        marginBottom: 16,
    },
    importButton: {
        paddingVertical: 12,
        borderRadius: 12,
        backgroundColor: "#4f5f6f",
        alignItems: "center",
    },
    importButtonText: {
        color: "#ffffff",
        fontSize: 15,
        fontWeight: "bold",
    },
    buttonPressed: {
        opacity: 0.75,
    },
    disabledButton: {
        opacity: 0.5,
    },
    loadingRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        marginTop: 16,
    },
    loadingText: {
        color: "#555555",
    },
    resultBox: {
        marginTop: 20,
        padding: 14,
        borderRadius: 12,
        backgroundColor: "#f4f7fa",
        borderWidth: 1,
        borderColor: "#d5e0e8",
    },
    resultTitle: {
        fontSize: 16,
        fontWeight: "bold",
        marginBottom: 8,
        color: "#222222",
    },
    resultText: {
        fontSize: 14,
        color: "#333333",
        marginBottom: 4,
    },
    errorBox: {
        marginTop: 12,
        padding: 10,
        borderRadius: 8,
        backgroundColor: "#fff4f4",
        borderWidth: 1,
        borderColor: "#f2c7c7",
    },
    errorTitle: {
        fontSize: 14,
        fontWeight: "bold",
        color: "#a33",
        marginBottom: 6,
    },
    errorText: {
        fontSize: 12,
        color: "#a33",
        marginBottom: 4,
    },
});
