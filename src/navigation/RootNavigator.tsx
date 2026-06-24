// src/navigation/RootNavigator.tsx

import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import HomeScreen from "../screens/HomeScreen";
import ExamListScreen from "../screens/ExamListScreen";
import QuizScreen from "../screens/QuizScreen";
import ResultScreen from "../screens/ResultScreen";
import AdminQuestionCreateScreen from "../screens/AdminQuestionCreateScreen";
import AdminQuestionImportScreen from "../screens/AdminQuestionImportScreen";
import AdminExamCreateScreen from "../screens/AdminExamCreateScreen";
import AdminExamListScreen from "../screens/AdminExamListScreen";
import AdminExamEditScreen from "../screens/AdminExamEditScreen";
import AdminQuestionListScreen from "../screens/AdminQuestionListScreen";
import AdminQuestionEditScreen from "../screens/AdminQuestionEditScreen";
import QuizHistoryScreen from "../screens/QuizHistoryScreen";
import ReviewScreen from "../screens/ReviewScreen";
import ResultDetailScreen from "../screens/ResultDetailScreen";
import ExamStartScreen from "../screens/ExamStartScreen";
import ProfileScreen from "../screens/ProfileScreen";
import StudyStatsScreen from "../screens/StudyStatsScreen";

export type RootStackParamList = {
    Home: undefined;
    ExamList: undefined;
    ExamStart: {
        examId: string;
    };

    Quiz: {
        examId: string;
        mode?: "PRACTICE" | "EXAM";
    };
    Result: {
        sessionId: string;
    };
    AdminQuestionCreate: undefined;
    AdminQuestionImport: undefined;
    AdminExamCreate: undefined;
    AdminExamList: undefined;
    AdminExamEdit: {
        examId: string;
    };
    AdminQuestionList: undefined;
    AdminQuestionEdit: {
        questionId: string;
    };
    QuizHistory: undefined;
    Review: undefined;
    ResultDetail: {
        sessionId: string;
    };
    Profile: undefined;
    StudyStats: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootNavigator() {
    return (
        <NavigationContainer>
            <Stack.Navigator initialRouteName="Home">
                <Stack.Screen
                    name="Home"
                    component={HomeScreen}
                    options={{
                        title: "AWS問題集",
                    }}
                />

                <Stack.Screen
                    name="ExamList"
                    component={ExamListScreen}
                    options={{
                        title: "試験選択",
                    }}
                />

                <Stack.Screen
                    name="Quiz"
                    component={QuizScreen}
                    options={{
                        title: "問題回答",
                    }}
                />

                <Stack.Screen
                    name="Result"
                    component={ResultScreen}
                    options={{
                        title: "結果",
                    }}
                />

                <Stack.Screen
                    name="AdminQuestionCreate"
                    component={AdminQuestionCreateScreen}
                    options={{
                        title: "問題登録",
                    }}
                />
                <Stack.Screen
                    name="AdminQuestionImport"
                    component={AdminQuestionImportScreen}
                    options={{ title: "CSVインポート" }}
                />

                <Stack.Screen
                    name="AdminExamCreate"
                    component={AdminExamCreateScreen}
                    options={{ title: "試験情報登録" }}
                />

                <Stack.Screen
                    name="AdminExamList"
                    component={AdminExamListScreen}
                    options={{ title: "試験情報一覧" }}
                />

                <Stack.Screen
                    name="AdminExamEdit"
                    component={AdminExamEditScreen}
                    options={{ title: "試験情報編集" }}
                />

                <Stack.Screen
                    name="AdminQuestionList"
                    component={AdminQuestionListScreen}
                    options={{ title: "問題一覧" }}
                />

                <Stack.Screen
                    name="AdminQuestionEdit"
                    component={AdminQuestionEditScreen}
                    options={{ title: "問題編集" }}
                />

                <Stack.Screen
                    name="QuizHistory"
                    component={QuizHistoryScreen}
                    options={{ title: "受験履歴" }}
                />

                <Stack.Screen
                    name="Review"
                    component={ReviewScreen}
                    options={{ title: "復習" }}
                />

                <Stack.Screen
                    name="ResultDetail"
                    component={ResultDetailScreen}
                    options={{ title: "結果詳細" }}
                />

                <Stack.Screen
                    name="ExamStart"
                    component={ExamStartScreen}
                    options={{ title: "試験開始" }}
                />

                <Stack.Screen
                    name="Profile"
                    component={ProfileScreen}
                    options={{ title: "プロフィール" }}
                />

                <Stack.Screen
                    name="StudyStats"
                    component={StudyStatsScreen}
                    options={{ title: "学習統計" }}
                />
            </Stack.Navigator>
        </NavigationContainer>
    );
}
