import { useState } from "react";
import {
    Alert,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";

import AppButton from "../components/AppButton";
import { client } from "../lib/client";

type ExamForm = {
    code: string;
    title: string;
    description: string;
    passScore: string;
    totalQuestions: string;
    timeLimitMinutes: string;
};

const initialForm: ExamForm = {
    code: "",
    title: "",
    description: "",
    passScore: "72",
    totalQuestions: "10",
    timeLimitMinutes: "30",
};

export default function AdminExamCreateScreen() {
    const [form, setForm] = useState<ExamForm>(initialForm);
    const [isPublished, setIsPublished] = useState(true);
    const [saving, setSaving] = useState(false);

    const updateForm = (key: keyof ExamForm, value: string) => {
        setForm((current) => ({
            ...current,
            [key]: value,
        }));
    };

    const validateForm = () => {
        const code = form.code.trim().toUpperCase();
        const title = form.title.trim();

        if (!code) {
            Alert.alert("入力エラー", "試験コードを入力してください。");
            return null;
        }

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
            code,
            title,
            description: form.description.trim(),
            passScore,
            totalQuestions,
            timeLimitMinutes,
            isPublished,
        };
    };

    const createExam = async () => {
        const validated = validateForm();

        if (!validated) {
            return;
        }

        setSaving(true);

        try {
            const existingResult = await client.models.Exam.list({
                filter: {
                    code: {
                        eq: validated.code,
                    },
                },
                limit: 1,
            });

            if (existingResult.errors) {
                console.error("Exam list errors:", existingResult.errors);
                Alert.alert("エラー", "既存の試験情報確認に失敗しました。");
                return;
            }

            const existingExam = existingResult.data?.[0];

            if (existingExam?.id) {
                Alert.alert(
                    "登録済み",
                    `試験コード「${validated.code}」はすでに登録されています。`,
                );
                return;
            }

            const createdResult = await client.models.Exam.create({
                code: validated.code,
                title: validated.title,
                description: validated.description || null,
                passScore: validated.passScore,
                totalQuestions: validated.totalQuestions,
                timeLimitMinutes: validated.timeLimitMinutes,
                isPublished: validated.isPublished,
            });

            if (createdResult.errors || !createdResult.data?.id) {
                console.error("Exam create errors:", createdResult.errors);
                Alert.alert("エラー", "試験情報の作成に失敗しました。");
                return;
            }

            Alert.alert("登録完了", "試験情報を登録しました。");

            setForm(initialForm);
            setIsPublished(true);
        } catch (error) {
            console.error("Exam create unexpected error:", error);
            Alert.alert("エラー", "試験情報の作成中にエラーが発生しました。");
        } finally {
            setSaving(false);
        }
    };

    return (
        <KeyboardAvoidingView
            style={styles.root}
            behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
            <ScrollView contentContainerStyle={styles.container}>
                <Text style={styles.title}>試験情報を登録</Text>

                <View style={styles.formGroup}>
                    <Text style={styles.label}>試験コード</Text>
                    <TextInput
                        value={form.code}
                        onChangeText={(value) =>
                            updateForm("code", value.toUpperCase())
                        }
                        placeholder="例: SAA"
                        autoCapitalize="characters"
                        style={styles.input}
                    />
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
                            placeholder="72"
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
                            placeholder="10"
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
                        placeholder="30"
                        style={styles.input}
                    />
                </View>

                <AppButton
                    mode={isPublished ? "contained" : "outlined"}
                    onPress={() => setIsPublished((current) => !current)}
                >
                    公開状態: {isPublished ? "公開" : "非公開"}
                </AppButton>

                <AppButton onPress={createExam} disabled={saving}>
                    {saving ? "登録中..." : "試験情報を登録"}
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
    multilineInput: {
        minHeight: 84,
        textAlignVertical: "top",
    },
    row: {
        flexDirection: "row",
        gap: 12,
    },
    rowItem: {
        flex: 1,
        gap: 6,
    },
});
