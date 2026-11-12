import { useEffect, useState } from "react";
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, View, Pressable, Alert } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { api, formatPrice } from "../../lib/api";

type Product = {
  id: string; title: string; slug: string; description: string;
  priceCents: number; images: string[]; stock: number; ratingAvg?: number; ratingCount?: number;
};

export default function ProductScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const router = useRouter();
  const [product, setProduct] = useState<Product | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api.get<Product>(`/products/${slug}`).then(setProduct).catch((e) => setError(e.message));
  }, [slug]);

  if (error) return <Text style={styles.error}>{error}</Text>;
  if (!product) return <ActivityIndicator style={{ flex: 1 }} />;

  const addToCart = async () => {
    try {
      await api.post("/cart/items", { productId: product.id, quantity: 1 });
      Alert.alert("Added ✓", "Item added to your cart", [
        { text: "View cart", onPress: () => router.push("/cart") },
        { text: "Continue", style: "cancel" },
      ]);
    } catch (e: any) {
      Alert.alert("Failed", e.message);
    }
  };

  return (
    <ScrollView style={styles.container}>
      {product.images?.[0] && <Image source={{ uri: product.images[0] }} style={styles.hero} />}
      <View style={styles.body}>
        <Text style={styles.title}>{product.title}</Text>
        <Text style={styles.price}>{formatPrice(product.priceCents)}</Text>
        <Text style={styles.stock}>{product.stock > 0 ? `In stock (${product.stock})` : "Out of stock"}</Text>
        <Text style={styles.description}>{product.description}</Text>
        <Pressable style={styles.btn} onPress={addToCart}><Text style={styles.btnText}>Add to cart</Text></Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f9fafb" },
  hero: { width: "100%", aspectRatio: 1, backgroundColor: "#e5e7eb" },
  body: { padding: 16, gap: 6 },
  title: { fontSize: 22, fontWeight: "800" },
  price: { fontSize: 24, fontWeight: "800", marginTop: 4 },
  stock: { color: "#15803d", fontSize: 12, fontWeight: "600" },
  description: { color: "#374151", marginTop: 8, lineHeight: 20 },
  btn: { backgroundColor: "#2563eb", borderRadius: 10, paddingVertical: 14, alignItems: "center", marginTop: 12 },
  btnText: { color: "#fff", fontWeight: "800", fontSize: 15 },
  error: { textAlign: "center", color: "#dc2626", marginTop: 48 },
});
