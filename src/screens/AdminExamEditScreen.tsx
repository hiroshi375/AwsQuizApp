import { useCallback, useEffect, useState } from "react";
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

type Props = NativeStackScreenProps<RootStackParamList, "AdminExamEdit">;

type ExamForm = {
    code: string;
    title: string;
    description: string;
    passScore: string;
    totalQuestions: string;
    timeLimitMinutes: string;
};

type ExamItem = {
    id: string;
    code?: string | null;
    title?: string | null;
    description?: string | null;
    passScore?: number | null;
    totalQuestions?: number | null;
    timeLimitMinutes?: number | null;
    isPublished?: boolean | null;
};

export default function AdminExamEditScreen({ route, navigation }: Props) {
    const { examId } = route.params;

    const [form, setForm] = useState<ExamForm>({
        code: "",
        title: "",
        description: "",
        passScore: "72",
        totalQuestions: "10",
        timeLimitMinutes: "30",
    });

    const [isPublished, setIsPublished] = useState(true);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const updateForm = (key: keyof ExamForm, value: string) => {
        setForm((current) => ({
            ...current,
            [key]: value,
        }));
    };

    const loadExam = useCallback(async () => {
        setLoading(true);

        try {
            const result = await client.models.Exam.get({
                id: examId,
            });

            if (result.errors) {
                console.error("Exam get errors:", result.errors);
                Alert.alert("エラー", "試験情報の取得に失敗しました。");
                return;
            }

            const exam = result.data as ExamItem | null;

            if (!exam) {
                Alert.alert("エラー", "試験情報が見つかりませんでした。");
                return;
            }

            setForm({
                code: exam.code ?? "",
                title: exam.title ?? "",
                description: exam.description ?? "",
                passScore: String(exam.passScore ?? 72),
                totalQuestions: String(exam.totalQuestions ?? 10),
                timeLimitMinutes: String(exam.timeLimitMinutes ?? 30),
            });

            setIsPublished(Boolean(exam.isPublished));
        } catch (error) {
            console.error("Exam get unexpected error:", error);
            Alert.alert("エラー", "試験情報の取得中にエラーが発生しました。");
        } finally {
            setLoading(false);
        }
    }, [examId]);

    useEffect(() => {
        void loadExam();
    }, [loadExam]);

    const validateForm = () => {
        const title = form.title.trim();

        if (!title) {
            Alert.alert("入力エラー", "試験名を入力してください。");
            return null;
        }

        const passScore = Number(form.passScore);
        const totalQuestions = Number(form.totalQuestions);
        const timeLimitMinutes = Number(form.timeLimitMinutes);

        if (!Number.isInteger(passScore) || passScore < 0 || passScore > 100) {
            Alert.alert(
                "入力エラー",
                "合格点は0〜100の整数で入力してください。",
            );
            return null;
        }

        if (!Number.isInteger(totalQuestions) || totalQuestions <= 0) {
            Alert.alert(
                "入力エラー",
                "問題数は1以上の整数で入力してください。",
            );
            return null;
        }

        if (!Number.isInteger(timeLimitMinutes) || timeLimitMinutes <= 0) {
            Alert.alert(
                "入力エラー",
                "制限時間は1分以上の整数で入力してください。",
            );
            return null;
        }

        return {
            title,
            description: form.description.trim(),
            passScore,
            totalQuestions,
            timeLimitMinutes,
            isPublished,
        };
    };

    const updateExam = async () => {
        const validated = validateForm();

        if (!validated) {
            return;
        }

        setSaving(true);

        try {
            const result = await client.models.Exam.update({
                id: examId,
                title: validated.title,
                description: validated.description || null,
                passScore: validated.passScore,
                totalQuestions: validated.totalQuestions,
                timeLimitMinutes: validated.timeLimitMinutes,
                isPublished: validated.isPublished,
            });

            if (result.errors) {
                console.error("Exam update errors:", result.errors);
                Alert.alert("エラー", "試験情報の更新に失敗しました。");
                return;
            }

            Alert.alert("更新完了", "試験情報を更新しました。", [
                {
                    text: "OK",
                    onPress: () => navigation.goBack(),
                },
            ]);
        } catch (error) {
            console.error("Exam update unexpected error:", error);
            Alert.alert("エラー", "試験情報の更新中にエラーが発生しました。");
        } finally {
            setSaving(false);
        }
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
        <KeyboardAvoidingView
            style={styles.root}
            behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
            <ScrollView contentContainerStyle={styles.container}>
                <Text style={styles.title}>試験情報を編集</Text>

                <View style={styles.formGroup}>
                    <Text style={styles.label}>試験コード</Text>
                    <TextInput
                        value={form.code}
                        editable={false}
                        style={[styles.input, styles.disabledInput]}
                    />
                    <Text style={styles.helpText}>
                        試験コードは問題・CSVインポートと紐づくため編集不可です。
                    </Text>
                </View>

                <View style={styles.formGroup}>
                    <Text style={styles.label}>試験名</Text>
                    <TextInput
                        value={form.title}
                        onChangeText={(value) => updateForm("title", value)}
                        placeholder="例: AWS SAA 模擬試験"
                        style={styles.input}
                    />
                </View>

                <View style={styles.formGroup}>
                    <Text style={styles.label}>説明</Text>
                    <TextInput
                        value={form.description}
                        onChangeText={(value) =>
                            updateForm("description", value)
                        }
                        placeholder="例: SAA 模擬問題"
                        multiline
                        style={[styles.input, styles.multilineInput]}
                    />
                </View>

                <View style={styles.row}>
                    <View style={styles.rowItem}>
                        <Text style={styles.label}>合格点</Text>
                        <TextInput
                            value={form.passScore}
                            onChangeText={(value) =>
                                updateForm("passScore", value)
                            }
                            keyboardType="number-pad"
                            style={styles.input}
                        />
                    </View>

                    <View style={styles.rowItem}>
                        <Text style={styles.label}>問題数</Text>
                        <TextInput
                            value={form.totalQuestions}
                            onChangeText={(value) =>
                                updateForm("totalQuestions", value)
                            }
                            keyboardType="number-pad"
                            style={styles.input}
                        />
                    </View>
                </View>

                <View style={styles.formGroup}>
                    <Text style={styles.label}>制限時間 分</Text>
                    <TextInput
                        value={form.timeLimitMinutes}
                        onChangeText={(value) =>
                            updateForm("timeLimitMinutes", value)
                        }
                        keyboardType="number-pad"
                        style={styles.input}
                    />
                </View>

                <AppButton
                    mode={isPublished ? "contained" : "outlined"}
                    onPress={() => setIsPublished((current) => !current)}
                >
                    公開状態: {isPublished ? "公開" : "非公開"}
                </AppButton>

                <AppButton onPress={updateExam} disabled={saving}>
                    {saving ? "更新中..." : "試験情報を更新"}
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
    disabledInput: {
        backgroundColor: "#f3f4f6",
        color: "#6b7280",
    },
    multilineInput: {
        minHeight: 84,
        textAlignVertical: "top",
    },
    helpText: {
        fontSize: 12,
        color: "#6b7280",
        lineHeight: 18,
    },
    row: {
        flexDirection: "row",
        gap: 12,
    },
    rowItem: {
        flex: 1,
        gap: 6,
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
