import { type ClientSchema, a, defineData } from "@aws-amplify/backend";

/*== STEP 1 ===============================================================
The section below creates a Todo database table with a "content" field. Try
adding a new "isDone" field as a boolean. The authorization rule below
specifies that any unauthenticated user can "create", "read", "update",
and "delete" any "Todo" records.
=========================================================================*/
const schema = a.schema({
    Exam: a
        .model({
            code: a.string().required(), // SAA, SAP
            title: a.string().required(),
            description: a.string(),
            passScore: a.integer().required(),
            totalQuestions: a.integer().required(),
            timeLimitMinutes: a.integer(),
            isPublished: a.boolean().default(false),
        })
        .authorization((allow) => [
            allow.authenticated().to(["read"]),
            allow.groups(["Admin"]),
        ]),

    Question: a
        .model({
            examId: a.string().required(),
            categoryName: a.string(),
            questionText: a.string().required(),
            questionType: a.string().required(), // SINGLE / MULTIPLE
            difficulty: a.string(), // EASY / NORMAL / HARD
            selectionMin: a.integer().default(1),
            selectionMax: a.integer().default(1),
            score: a.integer().default(1),
            status: a.string().default("DRAFT"), // DRAFT / PUBLISHED
            explanationSummary: a.string(),
            createdBy: a.string(),
            updatedBy: a.string(),
        })
        .authorization((allow) => [
            allow.authenticated().to(["read"]),
            allow.groups(["Admin"]),
        ]),

    Choice: a
        .model({
            questionId: a.string().required(),
            label: a.string().required(), // A, B, C, D
            choiceText: a.string().required(),
            displayOrder: a.integer().required(),
        })
        .authorization((allow) => [
            allow.authenticated().to(["read"]),
            allow.groups(["Admin"]),
        ]),

    QuestionSolution: a
        .model({
            questionId: a.string().required(),
            correctChoiceIds: a.string().array().required(),
            explanationText: a.string(),
            choiceExplanationsJson: a.json(),
        })
        .authorization((allow) => [
            // MVPでは解説表示のため authenticated read を許可
            // 本番では backend function 経由で採点・解説返却にするのがおすすめ
            allow.authenticated().to(["read"]),
            allow.groups(["Admin"]),
        ]),

    QuizSession: a
        .model({
            userId: a.string().required(),
            examId: a.string().required(),
            mode: a.string().required(), // PRACTICE / EXAM
            startedAt: a.datetime().required(),
            submittedAt: a.datetime(),
            totalQuestions: a.integer().required(),
            correctCount: a.integer(),
            score: a.integer(),
            passScore: a.integer(),
            isPassed: a.boolean(),
            status: a.string().required(), // IN_PROGRESS / SUBMITTED
        })
        .authorization((allow) => [allow.owner(), allow.groups(["Admin"])]),

    QuizAnswer: a
        .model({
            sessionId: a.string().required(),
            questionId: a.string().required(),
            selectedChoiceIds: a.string().array().required(),
            isCorrect: a.boolean(),
            score: a.integer(),
            answeredAt: a.datetime(),
            explanationShown: a.boolean().default(false),
        })
        .authorization((allow) => [allow.owner(), allow.groups(["Admin"])]),

    UserProfile: a
        .model({
            userId: a.string().required(),
            email: a.email(),
            displayName: a.string(),
            role: a.string().default("USER"),
            iconPath: a.string(),
        })
        .authorization((allow) => [allow.owner(), allow.groups(["Admin"])]),
});

export type Schema = ClientSchema<typeof schema>;

export const data = defineData({
    schema,
    authorizationModes: {
        defaultAuthorizationMode: "userPool",
    },
});

/*== STEP 2 ===============================================================
Go to your frontend source code. From your client-side code, generate a
Data client to make CRUDL requests to your table. (THIS SNIPPET WILL ONLY
WORK IN THE FRONTEND CODE FILE.)

Using JavaScript or Next.js React Server Components, Middleware, Server
Actions or Pages Router? Review how to generate Data clients for those use
cases: https://docs.amplify.aws/gen2/build-a-backend/data/connect-to-API/
=========================================================================*/

/*
"use client"
import { generateClient } from "aws-amplify/data";
import type { Schema } from "@/amplify/data/resource";

const client = generateClient<Schema>() // use this Data client for CRUDL requests
*/

/*== STEP 3 ===============================================================
Fetch records from the database and use them in your frontend component.
(THIS SNIPPET WILL ONLY WORK IN THE FRONTEND CODE FILE.)
=========================================================================*/

/* For example, in a React component, you can use this snippet in your
  function's RETURN statement */
// const { data: todos } = await client.models.Todo.list()

// return <ul>{todos.map(todo => <li key={todo.id}>{todo.content}</li>)}</ul>
