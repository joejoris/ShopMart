import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View, Alert } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { api, setToken } from "../../lib/api";

export default function AccountScreen() {
  const router = useRouter();
  const [me, setMe] = useState<{ name: string; email: string; role: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("demo@example.com");
  const [password, setPassword] = useState("demo1234");

  const load = useCallback(async () => {
    try {
      setMe(await api.get("/users/me"));
    } catch {
      setMe(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const login = async () => {
    try {
      const res = await api.post<{ accessToken: string; user: any }>("/auth/login", { email, password });
      setToken(res.accessToken);
      setMe(res.user);
    } catch (e: any) {
      Alert.alert("Sign in failed", e.message);
    }
  };

  const logout = () => { setToken(null); setMe(null); };

  if (loading) return <ActivityIndicator style={{ flex: 1 }} />;

  if (me) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={{ padding: 16, gap: 12 }}>
        <View style={styles.card}>
          <Text style={styles.name}>{me.name}</Text>
          <Text style={styles.email}>{me.email}</Text>
          <Text style={styles.role}>{me.role.toUpperCase()}</Text>
        </View>
        <Pressable style={styles.btn} onPress={() => Alert.alert("Orders", "Open the web app at localhost:3000/account/orders — order history UI is there.")}>
          <Text style={styles.btnText}>View my orders</Text>
        </Pressable>
        <Pressable style={[styles.btn, styles.btnOutline]} onPress={logout}>
          <Text style={[styles.btnText, { color: "#1d4ed8" }]}>Sign out</Text>
        </Pressable>
      </ScrollView>
    );
  }

  return (
    <View style={[styles.container, { padding: 16 }]}>
      <Text style={styles.heading}>Sign in</Text>
      <Text style={styles.hint}>Use demo@example.com / demo1234</Text>
      <TextInput style={styles.input} autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} placeholder="Email" />
      <TextInput style={styles.input} secureTextEntry value={password} onChangeText={setPassword} placeholder="Password" />
      <Pressable style={styles.btn} onPress={login}><Text style={styles.btnText}>Sign in</Text></Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f9fafb" },
  card: { backgroundColor: "#fff", padding: 20, borderRadius: 16, borderWidth: 1, borderColor: "#e5e7eb" },
  name: { fontSize: 20, fontWeight: "800" },
  email: { color: "#6b7280", marginTop: 4 },
  role: { marginTop: 8, fontSize: 11, color: "#2563eb", fontWeight: "800", letterSpacing: 1 },
  heading: { fontSize: 22, fontWeight: "800", marginTop: 8 },
  hint: { color: "#6b7280", marginTop: 4, marginBottom: 12 },
  input: { backgroundColor: "#fff", borderRadius: 10, borderWidth: 1, borderColor: "#e5e7eb", padding: 12, marginBottom: 10 },
  btn: { backgroundColor: "#2563eb", borderRadius: 10, paddingVertical: 14, alignItems: "center" },
  btnOutline: { backgroundColor: "transparent", borderWidth: 1, borderColor: "#2563eb" },
  btnText: { color: "#fff", fontWeight: "800", fontSize: 15 },
});
