import { useCallback, useState } from "react";
import { ActivityIndicator, FlatList, Image, Pressable, StyleSheet, Text, View, Alert } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { api, formatPrice } from "../../lib/api";

type CartItem = { id: string; quantity: number; product: { id: string; title: string; priceCents: number; images: string[] }; lineTotalCents: number };
type Cart = { items: CartItem[]; subtotalCents: number; itemCount: number };

export default function CartScreen() {
  const router = useRouter();
  const [cart, setCart] = useState<Cart | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      setCart(await api.get<Cart>("/cart"));
    } catch {
      setCart(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { setLoading(true); refresh(); }, [refresh]));

  const updateQty = async (itemId: string, quantity: number) => {
    setCart(await api.put<Cart>(`/cart/items/${itemId}`, { quantity }).catch(() => cart));
    refresh();
  };

  const checkout = async () => {
    try {
      const cartData = cart!;
      const addresses = await api.get<Array<{ id: string }>>("/users/addresses");
      if (!addresses.length) {
        Alert.alert("Add an address", "Please sign in and add a delivery address on the web app first.");
        router.push("/auth");
        return;
      }
      const order = await api.post<{ id: string }>("/orders", {
        addressId: addresses[0].id,
        shippingMethod: "standard",
      });
      await api.post(`/payments/orders/${order.id}/mock-pay`);
      Alert.alert("Order placed ✓", `Total ${formatPrice(cartData.subtotalCents)}`);
      refresh();
    } catch (e: any) {
      Alert.alert("Checkout failed", e.message ?? "Please sign in first.");
      router.push("/auth");
    }
  };

  if (loading) return <ActivityIndicator style={{ flex: 1 }} />;
  const items = cart?.items ?? [];

  return (
    <View style={styles.container}>
      <FlatList
        data={items}
        keyExtractor={(i) => i.id}
        renderItem={({ item }) => (
          <View style={styles.item}>
            {item.product.images?.[0] && <Image source={{ uri: item.product.images[0] }} style={styles.image} />}
            <View style={{ flex: 1 }}>
              <Text numberOfLines={2} style={styles.title}>{item.product.title}</Text>
              <Text style={styles.price}>{formatPrice(item.product.priceCents)}</Text>
              <View style={styles.qtyRow}>
                <Pressable style={styles.qtyBtn} onPress={() => updateQty(item.id, item.quantity - 1)}><Text>−</Text></Pressable>
                <Text style={styles.qty}>{item.quantity}</Text>
                <Pressable style={styles.qtyBtn} onPress={() => updateQty(item.id, item.quantity + 1)}><Text>+</Text></Pressable>
              </View>
            </View>
            <Text style={styles.lineTotal}>{formatPrice(item.lineTotalCents)}</Text>
          </View>
        )}
        ListEmptyComponent={<Text style={styles.empty}>Your cart is empty.</Text>}
      />
      {items.length > 0 && (
        <View style={styles.footer}>
          <View style={styles.totalRow}><Text style={styles.totalLabel}>Subtotal</Text><Text style={styles.totalValue}>{formatPrice(cart!.subtotalCents)}</Text></View>
          <Pressable style={styles.checkoutBtn} onPress={checkout}><Text style={styles.checkoutText}>Checkout</Text></Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f9fafb" },
  item: { flexDirection: "row", gap: 12, backgroundColor: "#fff", padding: 12, borderBottomWidth: 1, borderColor: "#e5e7eb" },
  image: { width: 84, height: 84, borderRadius: 8, backgroundColor: "#e5e7eb" },
  title: { fontSize: 13, fontWeight: "600" },
  price: { color: "#4b5563", marginTop: 2 },
  qtyRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 6 },
  qtyBtn: { width: 28, height: 28, borderRadius: 6, borderWidth: 1, borderColor: "#d1d5db", alignItems: "center", justifyContent: "center" },
  qty: { width: 24, textAlign: "center" },
  lineTotal: { fontWeight: "800" },
  empty: { textAlign: "center", color: "#6b7280", marginTop: 48 },
  footer: { backgroundColor: "#fff", padding: 16, borderTopWidth: 1, borderColor: "#e5e7eb" },
  totalRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 10 },
  totalLabel: { fontSize: 16, fontWeight: "600" },
  totalValue: { fontSize: 16, fontWeight: "800" },
  checkoutBtn: { backgroundColor: "#2563eb", borderRadius: 10, paddingVertical: 14, alignItems: "center" },
  checkoutText: { color: "#fff", fontWeight: "800", fontSize: 16 },
});
