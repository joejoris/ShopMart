import { useEffect, useState } from "react";
import { FlatList, Image, Pressable, StyleSheet, Text, TextInput, View, ActivityIndicator } from "react-native";
import { Link } from "expo-router";
import { api, formatPrice } from "../../lib/api";

type Product = { id: string; title: string; slug: string; priceCents: number; images: string[] };

export default function SearchScreen() {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!q.trim()) { setResults([]); return; }
    setLoading(true);
    const t = setTimeout(() => {
      api.get<{ items: Product[] }>(`/products?q=${encodeURIComponent(q.trim())}`)
        .then((r) => setResults(r.items))
        .catch(() => setResults([]))
        .finally(() => setLoading(false));
    }, 400);
    return () => clearTimeout(t);
  }, [q]);

  return (
    <View style={styles.container}>
      <TextInput
        value={q}
        onChangeText={setQ}
        placeholder="Search products…"
        style={styles.input}
        autoCapitalize="none"
        autoCorrect={false}
      />
      {loading && <ActivityIndicator style={{ marginTop: 12 }} />}
      <FlatList
        data={results}
        keyExtractor={(p) => p.id}
        numColumns={2}
        columnWrapperStyle={styles.row}
        contentContainerStyle={{ gap: 12 }}
        renderItem={({ item }) => (
          <Link href={`/product/${item.slug}`} asChild>
            <Pressable style={styles.card}>
              {item.images?.[0] && <Image source={{ uri: item.images[0] }} style={styles.image} />}
              <Text numberOfLines={2} style={styles.title}>{item.title}</Text>
              <Text style={styles.price}>{formatPrice(item.priceCents)}</Text>
            </Pressable>
          </Link>
        )}
        ListEmptyComponent={!loading && q ? <Text style={styles.empty}>No results for “{q}”</Text> : null}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f9fafb", padding: 12 },
  input: { backgroundColor: "#fff", borderRadius: 10, borderWidth: 1, borderColor: "#e5e7eb", paddingHorizontal: 12, paddingVertical: 10, fontSize: 14 },
  row: { gap: 12 },
  card: { flex: 1, backgroundColor: "#fff", borderRadius: 12, padding: 8, borderWidth: 1, borderColor: "#e5e7eb" },
  image: { width: "100%", aspectRatio: 1, borderRadius: 8, backgroundColor: "#e5e7eb" },
  title: { marginTop: 6, fontSize: 12, fontWeight: "600", minHeight: 32 },
  price: { marginTop: 2, fontSize: 14, fontWeight: "800" },
  empty: { textAlign: "center", color: "#6b7280", marginTop: 32 },
});
