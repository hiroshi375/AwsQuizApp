import { useEffect, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import AppButton from "../components/AppButton";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import { client } from "../lib/client";
import type { RootStackParamList } from "../navigation/RootNavigator";

type Props = NativeStackScreenProps<RootStackParamList, "Result">;

type QuizSessionItem = {
    id: string;
    totalQuestions?: number | null;
    correctCount?: number | null;
    score?: number | null;
    passScore?: number | null;
    isPassed?: boolean | null;
};

export default function ResultScreen({ route, navigation }: Props) {
    const { sessionId } = route.params;
    const [session, setSession] = useState<QuizSessionItem | null>(null);

    useEffect(() => {
        const load = async () => {
            const result = await client.models.QuizSession.get({
                id: sessionId,
            });

            setSession(result.data as QuizSessionItem | null);
        };

        void load();
    }, [sessionId]);

    if (!session) {
        return (
            <View style={styles.container}>
                <Text>結果を読み込み中...</Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <Text style={styles.title}>結果</Text>

            <Text style={styles.score}>{session.score} 点</Text>

            <Text>
                正解数: {session.correctCount} / {session.totalQuestions}
            </Text>

            <Text>合格点: {session.passScore}</Text>

            <Text style={session.isPassed ? styles.pass : styles.fail}>
                {session.isPassed ? "合格" : "不合格"}
            </Text>

            <AppButton onPress={() => navigation.navigate("Home")}>
                ホームへ戻る
            </AppButton>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 20,
        gap: 16,
        justifyContent: "center",
    },
    title: {
        fontSize: 24,
        fontWeight: "700",
    },
    score: {
        fontSize: 36,
        fontWeight: "700",
    },
    pass: {
        fontSize: 24,
        color: "green",
        fontWeight: "700",
    },
    fail: {
        fontSize: 24,
        color: "red",
        fontWeight: "700",
    },
});
