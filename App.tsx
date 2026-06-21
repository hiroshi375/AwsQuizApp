// App.tsx

import "./src/lib/configureAmplify";

import { Authenticator, ThemeProvider } from "@aws-amplify/ui-react-native";
import { PaperProvider } from "react-native-paper";
import RootNavigator from "./src/navigation/RootNavigator";

export default function App() {
    return (
        <ThemeProvider>
            <PaperProvider>
                <Authenticator.Provider>
                    <Authenticator>
                        <RootNavigator />
                    </Authenticator>
                </Authenticator.Provider>
            </PaperProvider>
        </ThemeProvider>
    );
}
