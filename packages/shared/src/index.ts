import { z } from "zod";

export const SHIPPING_FLAT_CENTS = 20000; // KES 200
export const FREE_SHIPPING_THRESHOLD_CENTS = 500000; // KES 5,000
export const TAX_RATE = 0.16; // Kenya VAT 16%
export const KES_PER_USD = 130; // for seed conversion convenience (approx)

export const RegisterSchema = z.object({
  name: z.string().min(1).max(120),
  email: z.string().email(),
  password: z.string().min(8).max(100),
});
export type RegisterInput = z.infer<typeof RegisterSchema>;

export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
export type LoginInput = z.infer<typeof LoginSchema>;

export const AddressSchema = z.object({
  fullName: z.string().min(1).max(120),
  line1: z.string().min(1).max(200),
  line2: z.string().max(200).optional().nullable(),
  city: z.string().min(1).max(120),
  county: z.string().min(1).max(120),
  postalCode: z.string().max(20).optional().nullable(),
  country: z.string().min(1).max(2).default("KE"),
  phone: z.string().regex(/^(\+2547\d{8}|\+2541\d{8}|07\d{8}|01\d{8})$/, "Enter a valid Kenyan phone (e.g. +254712345678 or 0712345678)").optional().nullable(),
});
export type AddressInput = z.infer<typeof AddressSchema>;

export const CreateProductSchema = z.object({
  title: z.string().min(1).max(200),
  slug: z.string().min(1).max(200).regex(/^[a-z0-9-]+$/),
  description: z.string().min(1),
  priceCents: z.number().int().nonnegative(),
  compareAtPriceCents: z.number().int().nonnegative().optional().nullable(),
  sku: z.string().min(1).max(64),
  stock: z.number().int().nonnegative(),
  categoryId: z.string().min(1),
  status: z.enum(["draft", "active", "archived"]).default("draft"),
  images: z.array(z.string().url()).default([]),
});
export type CreateProductInput = z.infer<typeof CreateProductSchema>;

export const UpdateProductSchema = CreateProductSchema.partial();
export type UpdateProductInput = z.infer<typeof UpdateProductSchema>;

export const AddToCartSchema = z.object({
  productId: z.string().min(1),
  quantity: z.number().int().min(1).max(99),
});

export const UpdateCartItemSchema = z.object({
  quantity: z.number().int().min(0).max(99),
});

export const CreateOrderSchema = z.object({
  addressId: z.string().min(1),
  couponCode: z.string().optional().nullable(),
  shippingMethod: z.enum(["standard", "express"]).default("standard"),
});
export type CreateOrderInput = z.infer<typeof CreateOrderSchema>;

export const CreateReviewSchema = z.object({
  productId: z.string().min(1),
  rating: z.number().int().min(1).max(5),
  comment: z.string().min(1).max(2000),
});
export type CreateReviewInput = z.infer<typeof CreateReviewSchema>;

export const CouponSchema = z.object({
  code: z.string().min(3).max(40).regex(/^[A-Z0-9_-]+$/),
  type: z.enum(["percent", "fixed"]),
  value: z.number().nonnegative(),
  minOrderCents: z.number().int().nonnegative().default(0),
  expiresAt: z.string().datetime().optional().nullable(),
  usageLimit: z.number().int().nonnegative().optional().nullable(),
});
export type CouponInput = z.infer<typeof CouponSchema>;
