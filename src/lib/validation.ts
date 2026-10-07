import { z } from "zod";

const text = (max: number) => z.string().trim().max(max);

export const checkoutSchema = z.object({
  customerName: text(80).min(2, "Enter your full name."),
  phone: text(25).refine((v) => v.replace(/\D/g, "").length >= 9, "Enter a phone number we can reach you on."),
  email: text(120).refine((v) => v === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), "Enter a valid email address or leave it blank."),
  zoneId: z.coerce.number().int().positive("Choose your delivery area."),
  address: text(300).min(5, "Enter your delivery address."),
  landmark: text(150),
  notes: text(300),
  shippingCode: text(40).min(1, "Choose a shipping method."),
});

export const linkRequestSchema = z.object({
  url: text(500).refine((v) => {
    try {
      const u = new URL(v);
      return u.protocol === "https:" || u.protocol === "http:";
    } catch {
      return false;
    }
  }, "Paste the full product link, starting with https://"),
  title: text(150),
  details: text(300),
  quantity: z.coerce.number().int().min(1).max(20),
  priceSeen: text(40),
  itemType: text(40),
  name: text(80).min(2, "Enter your name."),
  phone: text(25).refine((v) => v.replace(/\D/g, "").length >= 9, "Enter a phone number we can reach you on."),
  email: text(120).refine((v) => v === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), "Enter a valid email address or leave it blank."),
});

export const trackSchema = z.object({
  number: text(30).min(5, "Enter your order number."),
  contact: text(120).min(5, "Enter the phone number or email you used."),
});

export function firstError(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Please check the form and try again.";
}
