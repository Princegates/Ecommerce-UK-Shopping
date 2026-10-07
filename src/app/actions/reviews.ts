"use server";

import { revalidatePath } from "next/cache";
import { getProductById } from "@/lib/catalog";
import { requireCustomer } from "@/lib/customer-session";
import { addReview } from "@/lib/reviews";

export type ReviewState = { error?: string; done?: boolean };

export async function addReviewAction(_prev: ReviewState, f: FormData): Promise<ReviewState> {
  const productId = Number(f.get("productId"));
  const product = getProductById(productId);
  if (!product) return { error: "This item is no longer available." };
  const customer = await requireCustomer(`/products/${product.slug}`);
  const res = addReview(customer.id, customer.name, productId, {
    rating: Number(f.get("rating")),
    title: String(f.get("title") ?? ""),
    body: String(f.get("body") ?? ""),
  });
  if (!res.ok) return { error: res.error };
  revalidatePath(`/products/${product.slug}`);
  return { done: true };
}
