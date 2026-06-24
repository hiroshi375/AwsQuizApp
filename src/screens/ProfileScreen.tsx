import { useCallback, useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Image,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { fetchUserAttributes, getCurrentUser } from "aws-amplify/auth";
import { getUrl, uploadData } from "aws-amplify/storage";
import * as ImagePicker from "expo-image-picker";

import AppButton from "../components/AppButton";
import { client } from "../lib/client";
import type { RootStackParamList } from "../navigation/RootNavigator";

type Props = NativeStackScreenProps<RootStackParamList, "Profile">;

type UserProfileItem = {
    id: string;
    userId?: string | null;
    email?: string | null;
    displayName?: string | null;
    iconPath?: string | null;
};

export default function ProfileScreen({ navigation }: Props) {
    const [profileId, setProfileId] = useState<string | null>(null);
    const [userId, setUserId] = useState("");
    const [email, setEmail] = useState("");
    const [displayName, setDisplayName] = useState("");
    const [iconPath, setIconPath] = useState<string | null>(null);
    const [iconUrl, setIconUrl] = useState<string | null>(null);

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [uploading, setUploading] = useState(false);

    const loadIconUrl = useCallback(async (path: string | null) => {
        if (!path) {
            setIconUrl(null);
            return;
        }

        try {
            const result = await getUrl({
                path,
            });

            setIconUrl(result.url.toString());
        } catch (error) {
            console.error("Profile icon getUrl error:", error);
            setIconUrl(null);
        }
    }, []);

    const loadProfile = useCallback(async () => {
        setLoading(true);

        try {
            const currentUser = await getCurrentUser();
            const attributes = await fetchUserAttributes();

            const currentUserId = currentUser.userId;
            const currentEmail =
                attributes.email ?? currentUser.signInDetails?.loginId ?? "";

            setUserId(currentUserId);
            setEmail(currentEmail);

            const result = await client.models.UserProfile.list({
                filter: {
                    userId: {
                        eq: currentUserId,
                    },
                },
                limit: 1,
            });

            if (result.errors) {
                console.error("UserProfile list errors:", result.errors);
                Alert.alert("エラー", "プロフィールの取得に失敗しました。");
                return;
            }

            const existingProfile = (result.data?.[0] ??
                null) as UserProfileItem | null;

            if (existingProfile) {
                setProfileId(existingProfile.id);
                setDisplayName(
                    existingProfile.displayName ??
                        currentEmail ??
                        currentUser.username,
                );
                setIconPath(existingProfile.iconPath ?? null);
                await loadIconUrl(existingProfile.iconPath ?? null);
                return;
            }

            const defaultDisplayName = currentEmail || currentUser.username;

            const createResult = await client.models.UserProfile.create({
                userId: currentUserId,
                email: currentEmail,
                displayName: defaultDisplayName,
                iconPath: null,
            });

            if (createResult.errors || !createResult.data?.id) {
                console.error(
                    "UserProfile create errors:",
                    createResult.errors,
                );
                Alert.alert("エラー", "プロフィールの作成に失敗しました。");
                return;
            }

            const createdProfile = createResult.data as UserProfileItem;

            setProfileId(createdProfile.id);
            setDisplayName(defaultDisplayName);
            setIconPath(null);
            setIconUrl(null);
        } catch (error) {
            console.error("Profile load unexpected error:", error);
            Alert.alert("エラー", "プロフィール取得中にエラーが発生しました。");
        } finally {
            setLoading(false);
        }
    }, [loadIconUrl]);

    useEffect(() => {
        void loadProfile();
    }, [loadProfile]);

    const saveProfile = async () => {
        if (!profileId) {
            Alert.alert("エラー", "プロフィール情報が読み込まれていません。");
            return;
        }

        const trimmedDisplayName = displayName.trim();

        if (!trimmedDisplayName) {
            Alert.alert("入力エラー", "表示名を入力してください。");
            return;
        }

        setSaving(true);

        try {
            const result = await client.models.UserProfile.update({
                id: profileId,
                userId,
                email,
                displayName: trimmedDisplayName,
                iconPath,
            });

            if (result.errors) {
                console.error("UserProfile update errors:", result.errors);
                Alert.alert("エラー", "プロフィールの保存に失敗しました。");
                return;
            }

            Alert.alert("保存完了", "プロフィールを保存しました。", [
                {
                    text: "OK",
                    onPress: () => navigation.navigate("Home"),
                },
            ]);
        } catch (error) {
            console.error("Profile save unexpected error:", error);
            Alert.alert("エラー", "プロフィール保存中にエラーが発生しました。");
        } finally {
            setSaving(false);
        }
    };

    const pickIconImage = async () => {
        if (!profileId || !userId) {
            Alert.alert("エラー", "プロフィール情報が読み込まれていません。");
            return;
        }

        try {
            const permission =
                await ImagePicker.requestMediaLibraryPermissionsAsync();

            if (!permission.granted) {
                Alert.alert(
                    "権限が必要です",
                    "アイコン画像を選択するには写真ライブラリへのアクセス許可が必要です。",
                );
                return;
            }

            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ["images"],
                allowsEditing: true,
                aspect: [1, 1],
                quality: 0.8,
            });

            if (result.canceled) {
                return;
            }

            const asset = result.assets[0];

            if (!asset?.uri) {
                Alert.alert("エラー", "画像を取得できませんでした。");
                return;
            }

            setUploading(true);

            const response = await fetch(asset.uri);
            const blob = await response.blob();

            const extension = getFileExtension(asset.uri);
            const path = `profile-icons/${userId}/icon.${extension}`;

            await uploadData({
                path,
                data: blob,
                options: {
                    contentType: asset.mimeType ?? `image/${extension}`,
                },
            }).result;

            const updateResult = await client.models.UserProfile.update({
                id: profileId,
                userId,
                email,
                displayName: displayName.trim() || email,
                iconPath: path,
            });

            if (updateResult.errors) {
                console.error(
                    "UserProfile icon update errors:",
                    updateResult.errors,
                );
                Alert.alert("エラー", "アイコン情報の保存に失敗しました。");
                return;
            }

            setIconPath(path);
            await loadIconUrl(path);

            Alert.alert("更新完了", "アイコン画像を更新しました。");
        } catch (error) {
            console.error("Profile icon upload unexpected error:", error);
            Alert.alert(
                "エラー",
                "アイコン画像の更新中にエラーが発生しました。",
            );
        } finally {
            setUploading(false);
        }
    };

    if (loading) {
        return (
            <View style={styles.center}>
                <ActivityIndicator />
                <Text style={styles.loadingText}>
                    プロフィールを読み込み中...
                </Text>
            </View>
        );
    }

    return (
        <ScrollView contentContainerStyle={styles.container}>
            <Text style={styles.title}>プロフィール</Text>

            <View style={styles.iconArea}>
                {iconUrl ? (
                    <Image source={{ uri: iconUrl }} style={styles.iconImage} />
                ) : (
                    <View style={styles.iconPlaceholder}>
                        <Text style={styles.iconPlaceholderText}>
                            {getInitial(displayName || email)}
                        </Text>
                    </View>
                )}

                <AppButton onPress={pickIconImage} disabled={uploading}>
                    {uploading ? "アップロード中..." : "アイコン画像を変更"}
                </AppButton>
            </View>

            <View style={styles.formGroup}>
                <Text style={styles.label}>メールアドレス</Text>
                <TextInput
                    value={email}
                    editable={false}
                    style={[styles.input, styles.disabledInput]}
                />
            </View>

            <View style={styles.formGroup}>
                <Text style={styles.label}>表示名</Text>
                <TextInput
                    value={displayName}
                    onChangeText={setDisplayName}
                    placeholder="表示名を入力"
                    style={styles.input}
                />
            </View>

            <AppButton onPress={saveProfile} disabled={saving}>
                {saving ? "保存中..." : "プロフィールを保存"}
            </AppButton>

            <AppButton mode="outlined" onPress={() => navigation.goBack()}>
                戻る
            </AppButton>
        </ScrollView>
    );
}

function getInitial(value: string) {
    const trimmedValue = value.trim();

    if (!trimmedValue) {
        return "?";
    }

    return trimmedValue.slice(0, 1).toUpperCase();
}

function getFileExtension(uri: string) {
    const extension = uri.split(".").pop()?.toLowerCase();

    if (!extension) {
        return "jpg";
    }

    if (extension.includes("?")) {
        return extension.split("?")[0] || "jpg";
    }

    if (extension === "jpeg") {
        return "jpg";
    }

    if (extension === "png" || extension === "jpg" || extension === "webp") {
        return extension;
    }

    return "jpg";
}

const styles = StyleSheet.create({
    container: {
        flexGrow: 1,
        padding: 20,
        gap: 18,
        backgroundColor: "#ffffff",
    },
    title: {
        fontSize: 24,
        fontWeight: "bold",
        color: "#1f2937",
    },
    iconArea: {
        alignItems: "center",
        gap: 14,
        marginVertical: 8,
    },
    iconImage: {
        width: 120,
        height: 120,
        borderRadius: 60,
        backgroundColor: "#e5e7eb",
    },
    iconPlaceholder: {
        width: 120,
        height: 120,
        borderRadius: 60,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#4f5f6f",
    },
    iconPlaceholderText: {
        fontSize: 42,
        color: "#ffffff",
        fontWeight: "bold",
    },
    formGroup: {
        gap: 6,
    },
    label: {
        fontSize: 14,
        color: "#374151",
        fontWeight: "700",
    },
    input: {
        borderWidth: 1,
        borderColor: "#cfd7e2",
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 10,
        fontSize: 16,
        color: "#1f2937",
        backgroundColor: "#ffffff",
    },
    disabledInput: {
        backgroundColor: "#f3f4f6",
        color: "#6b7280",
    },
    center: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#ffffff",
        gap: 8,
    },
    loadingText: {
        fontSize: 14,
        color: "#4b5563",
    },
});
