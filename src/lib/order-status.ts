/**
 * Order lifecycle. Payment is confirmed only by the payment flow, never by staff,
 * and staff can only move an order one step forward or cancel it before it ships.
 */

export const ORDER_STATUSES = [
  "AWAITING_PAYMENT",
  "PAID",
  "PURCHASING",
  "PURCHASED",
  "AT_UK_WAREHOUSE",
  "SHIPPED_TO_GHANA",
  "IN_CUSTOMS",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
  "CANCELLED",
  "REFUNDED",
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const STATUS_LABEL: Record<OrderStatus, string> = {
  AWAITING_PAYMENT: "Awaiting payment",
  PAID: "Payment received",
  PURCHASING: "Buying from the UK shop",
  PURCHASED: "Bought from the UK shop",
  AT_UK_WAREHOUSE: "Received at our UK address",
  SHIPPED_TO_GHANA: "On its way to Ghana",
  IN_CUSTOMS: "Clearing customs in Ghana",
  OUT_FOR_DELIVERY: "Out for delivery",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
  REFUNDED: "Refunded",
};

export const STATUS_HELP: Record<OrderStatus, string> = {
  AWAITING_PAYMENT: "We start buying as soon as your payment is confirmed.",
  PAID: "Your payment is confirmed and your items are queued for buying.",
  PURCHASING: "Our team is placing your order with the UK shop.",
  PURCHASED: "The UK shop has accepted the order and will send it to us.",
  AT_UK_WAREHOUSE: "Your parcel has reached our UK address and is being prepared for export.",
  SHIPPED_TO_GHANA: "Your parcel has left the UK.",
  IN_CUSTOMS: "Your parcel has arrived in Ghana and is being cleared.",
  OUT_FOR_DELIVERY: "A rider is bringing your order to your address.",
  DELIVERED: "Your order has been delivered. Enjoy!",
  CANCELLED: "This order was cancelled.",
  REFUNDED: "Your payment has been refunded.",
};

/** The happy path, in order. */
export const PROGRESS: OrderStatus[] = [
  "PAID",
  "PURCHASING",
  "PURCHASED",
  "AT_UK_WAREHOUSE",
  "SHIPPED_TO_GHANA",
  "IN_CUSTOMS",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
];

const CANCELLABLE: OrderStatus[] = ["AWAITING_PAYMENT", "PAID", "PURCHASING"];

export function isOrderStatus(value: string): value is OrderStatus {
  return (ORDER_STATUSES as readonly string[]).includes(value);
}

/** Statuses staff may move an order to from `from`. PAID is excluded: only a confirmed payment sets it. */
export function staffNextStatuses(from: OrderStatus, paymentStatus: string): OrderStatus[] {
  const out: OrderStatus[] = [];
  const i = PROGRESS.indexOf(from);
  if (i >= 0 && i < PROGRESS.length - 1) out.push(PROGRESS[i + 1]);
  if (CANCELLABLE.includes(from)) out.push("CANCELLED");
  if (from === "CANCELLED" && paymentStatus === "PAID") out.push("REFUNDED");
  return out;
}

export function canStaffTransition(from: OrderStatus, to: OrderStatus, paymentStatus: string): boolean {
  return staffNextStatuses(from, paymentStatus).includes(to);
}
