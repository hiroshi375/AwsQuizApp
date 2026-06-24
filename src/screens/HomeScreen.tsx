import { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import AppButton from "../components/AppButton";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useFocusEffect } from "@react-navigation/native";
import { fetchAuthSession, getCurrentUser } from "aws-amplify/auth";
import { useAuthenticator } from "@aws-amplify/ui-react-native";
import { client } from "../lib/client";
import type { RootStackParamList } from "../navigation/RootNavigator";

type Props = NativeStackScreenProps<RootStackParamList, "Home">;

//const ADMIN_BUTTON_COLOR = "#2f3a46";
const ADMIN_BUTTON_COLOR = "#1f2933";
//const ADMIN_BUTTON_COLOR = "#2f4f66";
const ADMIN_BUTTON_TEXT_COLOR = "#ffffff";

export default function HomeScreen({ navigation }: Props) {
    const { signOut } = useAuthenticator();
    const [email, setEmail] = useState("");
    const [displayName, setDisplayName] = useState("");
    const [isAdmin, setIsAdmin] = useState(false);

    useFocusEffect(
        useCallback(() => {
            const loadUser = async () => {
                try {
                    const user = await getCurrentUser();

                    const loginEmail =
                        user.signInDetails?.loginId ?? user.username ?? "";

                    setEmail(loginEmail);

                    const profileResult = await client.models.UserProfile.list({
                        filter: {
                            userId: {
                                eq: user.userId,
                            },
                        },
                        limit: 1,
                    });

                    if (profileResult.errors) {
                        console.error(
                            "UserProfile list errors:",
                            profileResult.errors,
                        );
                    }

                    const profile = profileResult.data?.[0];

                    setDisplayName(profile?.displayName?.trim() ?? "");

                    const session = await fetchAuthSession();
                    const groups = session.tokens?.accessToken.payload[
                        "cognito:groups"
                    ] as string[] | undefined;

                    setIsAdmin(groups?.includes("Admin") ?? false);
                } catch (error) {
                    console.error("Load user error:", error);
                    setIsAdmin(false);
                }
            };

            void loadUser();
        }, []),
    );

    return (
        <View style={styles.container}>
            <Text style={styles.title}>AWS問題集アプリ</Text>
            <Text style={styles.email}>ログイン中: {displayName || email}</Text>

            <View style={styles.button}>
                <AppButton onPress={() => navigation.navigate("ExamList")}>
                    問題を解く
                </AppButton>
            </View>

            <AppButton onPress={() => navigation.navigate("QuizHistory")}>
                受験履歴を見る
            </AppButton>

            <AppButton onPress={() => navigation.navigate("Review")}>
                間違えた問題を復習
            </AppButton>

            {isAdmin && (
                <View style={styles.button}>
                    <AppButton
                        buttonColor="#2f3a46"
                        textColor="#ffffff"
                        onPress={() => navigation.navigate("AdminExamCreate")}
                    >
                        管理者: 試験情報を登録
                    </AppButton>
                    <AppButton
                        buttonColor="#2f3a46"
                        textColor="#ffffff"
                        onPress={() => navigation.navigate("AdminExamList")}
                    >
                        管理者: 試験情報一覧
                    </AppButton>
                    <AppButton
                        buttonColor={ADMIN_BUTTON_COLOR}
                        textColor={ADMIN_BUTTON_TEXT_COLOR}
                        onPress={() =>
                            navigation.navigate("AdminQuestionCreate")
                        }
                    >
                        管理者: 問題を登録
                    </AppButton>
                    <AppButton
                        buttonColor="#2f3a46"
                        textColor="#ffffff"
                        onPress={() => navigation.navigate("AdminQuestionList")}
                    >
                        管理者: 問題一覧
                    </AppButton>
                    <AppButton
                        buttonColor={ADMIN_BUTTON_COLOR}
                        textColor={ADMIN_BUTTON_TEXT_COLOR}
                        onPress={() =>
                            navigation.navigate("AdminQuestionImport")
                        }
                    >
                        管理者: 問題CSVインポート
                    </AppButton>
                </View>
            )}

            <AppButton onPress={() => navigation.navigate("Profile")}>
                プロフィール
            </AppButton>
            <View style={styles.button}>
                <AppButton onPress={signOut}>サインアウト</AppButton>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 20,
        gap: 12,
        justifyContent: "center",
    },
    title: {
        fontSize: 24,
        fontWeight: "700",
        marginBottom: 12,
    },
    email: {
        fontSize: 14,
        marginBottom: 20,
    },
    button: {
        marginVertical: 6,
    },
});
