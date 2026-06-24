import { defineStorage } from "@aws-amplify/backend";

export const storage = defineStorage({
    name: "awsQuizAppStorage",
    access: (allow) => ({
        "profile-icons/*": [
            allow.authenticated.to(["read", "write", "delete"]),
        ],
    }),
});
