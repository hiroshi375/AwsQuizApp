// src/navigation/RootNavigator.tsx

import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import HomeScreen from "../screens/HomeScreen";
import ExamListScreen from "../screens/ExamListScreen";
import QuizScreen from "../screens/QuizScreen";
import ResultScreen from "../screens/ResultScreen";
import AdminQuestionCreateScreen from "../screens/AdminQuestionCreateScreen";

export type RootStackParamList = {
    Home: undefined;
    ExamList: undefined;
    Quiz: {
        examId: string;
    };
    Result: {
        sessionId: string;
    };
    AdminQuestionCreate: undefined;
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
            </Stack.Navigator>
        </NavigationContainer>
    );
}
