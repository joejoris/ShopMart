import { useCallback, useEffect, useState } from "react";
import { FlatList, Image, Pressable, StyleSheet, Text, View, ActivityIndicator } from "react-native";
import { Link, useFocusEffect } from "expo-router";
import { api, formatPrice } from "../../lib/api";

type Product = { id: string; title: string; slug: string; priceCents: number; images: string[] };

export default function HomeScreen() {
  const [featured, setFeatured] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      api.get<Product[]>("/products/featured")
        .then(setFeatured)
        .catch(() => {})
        .finally(() => setLoading(false));
    }, [])
  );

  if (loading) return <ActivityIndicator style={{ flex: 1 }} />;

  return (
    <FlatList
      contentContainerStyle={styles.container}
      data={featured}
      keyExtractor={(p) => p.id}
      numColumns={2}
      columnWrapperStyle={styles.row}
      ListHeaderComponent={
        <View style={styles.hero}>
          <Text style={styles.heroTitle}>Everything you love, delivered fast.</Text>
          <Text style={styles.heroSub}>Free shipping over $50 · 30-day returns</Text>
        </View>
      }
      renderItem={({ item }) => (
        <Link href={`/product/${item.slug}`} asChild>
          <Pressable style={styles.card}>
            {item.images?.[0] ? (
              <Image source={{ uri: item.images[0] }} style={styles.image} />
            ) : (
              <View style={[styles.image, styles.imageFallback]} />
            )}
            <Text numberOfLines={2} style={styles.title}>{item.title}</Text>
            <Text style={styles.price}>{formatPrice(item.priceCents)}</Text>
          </Pressable>
        </Link>
      )}
      ListFooterComponent={<Text style={styles.footer}>Showing featured items</Text>}
    />
  );
}

const styles = StyleSheet.create({
  container: { padding: 12, backgroundColor: "#f9fafb" },
  row: { gap: 12, marginBottom: 12 },
  hero: { backgroundColor: "#1e3a8a", borderRadius: 16, padding: 20, marginBottom: 16 },
  heroTitle: { color: "#fff", fontSize: 22, fontWeight: "800" },
  heroSub: { color: "#bfdbfe", marginTop: 6, fontSize: 12 },
  card: { flex: 1, backgroundColor: "#fff", borderRadius: 12, padding: 8, borderWidth: 1, borderColor: "#e5e7eb" },
  image: { width: "100%", aspectRatio: 1, borderRadius: 8, backgroundColor: "#e5e7eb" },
  imageFallback: { backgroundColor: "#e5e7eb" },
  title: { marginTop: 6, fontSize: 12, fontWeight: "600", minHeight: 32 },
  price: { marginTop: 2, fontSize: 14, fontWeight: "800" },
  footer: { textAlign: "center", color: "#9ca3af", fontSize: 12, marginTop: 8 },
});
