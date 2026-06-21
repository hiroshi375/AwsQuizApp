// src/components/AppButton.tsx

import type { ComponentProps } from "react";
import { Button as PaperButton } from "react-native-paper";

type AppButtonProps = ComponentProps<typeof PaperButton>;

export default function AppButton({
    children,
    mode = "contained",
    buttonColor = "#4f5f6f",
    textColor = "#ffffff",
    contentStyle,
    labelStyle,
    style,
    ...props
}: AppButtonProps) {
    return (
        <PaperButton
            mode={mode}
            buttonColor={buttonColor}
            textColor={textColor}
            contentStyle={[
                {
                    paddingVertical: 2,
                },
                contentStyle,
            ]}
            labelStyle={[
                {
                    fontSize: 16,
                    fontWeight: "bold",
                },
                labelStyle,
            ]}
            style={[
                {
                    marginTop: 8,
                    borderRadius: 12,
                },
                style,
            ]}
            {...props}
        >
            {children}
        </PaperButton>
    );
}
