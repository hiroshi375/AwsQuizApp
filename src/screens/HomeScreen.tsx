import { useEffect, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import AppButton from "../components/AppButton";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { fetchAuthSession, getCurrentUser } from "aws-amplify/auth";
import { useAuthenticator } from "@aws-amplify/ui-react-native";

import type { RootStackParamList } from "../navigation/RootNavigator";

type Props = NativeStackScreenProps<RootStackParamList, "Home">;

//const ADMIN_BUTTON_COLOR = "#2f3a46";
const ADMIN_BUTTON_COLOR = "#1f2933";
//const ADMIN_BUTTON_COLOR = "#2f4f66";
const ADMIN_BUTTON_TEXT_COLOR = "#ffffff";

export default function HomeScreen({ navigation }: Props) {
    const { signOut } = useAuthenticator();
    const [email, setEmail] = useState("");
    const [isAdmin, setIsAdmin] = useState(false);

    useEffect(() => {
        const loadUser = async () => {
            const user = await getCurrentUser();
            setEmail(user.signInDetails?.loginId ?? user.username);

            const session = await fetchAuthSession();
            const groups = session.tokens?.accessToken.payload[
                "cognito:groups"
            ] as string[] | undefined;

            setIsAdmin(groups?.includes("Admin") ?? false);
        };

        void loadUser();
    }, []);

    return (
        <View style={styles.container}>
            <Text style={styles.title}>AWS問題集アプリ</Text>
            <Text style={styles.email}>ログイン中: {email}</Text>

            <View style={styles.button}>
                <AppButton onPress={() => navigation.navigate("ExamList")}>
                    問題を解く
                </AppButton>
            </View>

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
