// src/screens/ExamListScreen.tsx

import { useCallback, useEffect, useState } from "react";
import { View, Text, FlatList, StyleSheet } from "react-native";
import AppButton from "../components/AppButton";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import { client } from "../lib/client";
import type { RootStackParamList } from "../navigation/RootNavigator";

type Props = NativeStackScreenProps<RootStackParamList, "ExamList">;

type ExamItem = {
    id: string;
    code?: string | null;
    title?: string | null;
    description?: string | null;
    passScore?: number | null;
    totalQuestions?: number | null;
};

export default function ExamListScreen({ navigation }: Props) {
    const [exams, setExams] = useState<ExamItem[]>([]);
    const [loading, setLoading] = useState(false);

    const loadExams = useCallback(async () => {
        setLoading(true);

        try {
            const result = await client.models.Exam.list({
                filter: {
                    isPublished: {
                        eq: true,
                    },
                },
            });

            setExams((result.data ?? []) as ExamItem[]);
        } catch (error) {
            console.error("Exam list error:", error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void loadExams();
    }, [loadExams]);

    return (
        <View style={styles.container}>
            <Text style={styles.title}>試験を選択</Text>

            {loading && <Text>読み込み中...</Text>}

            <FlatList
                data={exams}
                keyExtractor={(item) => item.id}
                ListEmptyComponent={
                    <Text>
                        公開済みの試験がありません。管理者画面から登録してください。
                    </Text>
                }
                renderItem={({ item }) => (
                    <View style={styles.card}>
                        <Text style={styles.examTitle}>
                            {item.code} - {item.title}
                        </Text>

                        <Text>{item.description}</Text>

                        <Text>
                            合格点: {item.passScore} / 問題数:{" "}
                            {item.totalQuestions}
                        </Text>

                        <AppButton
                            onPress={() =>
                                navigation.navigate("Quiz", {
                                    examId: item.id,
                                })
                            }
                        >
                            開始
                        </AppButton>
                    </View>
                )}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 16,
    },
    title: {
        fontSize: 22,
        fontWeight: "700",
        marginBottom: 16,
    },
    card: {
        padding: 16,
        borderWidth: 1,
        borderColor: "#ddd",
        borderRadius: 8,
        marginBottom: 12,
        gap: 8,
    },
    examTitle: {
        fontSize: 18,
        fontWeight: "700",
    },
});
