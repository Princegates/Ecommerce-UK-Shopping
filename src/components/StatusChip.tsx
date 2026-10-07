import { STATUS_LABEL, type OrderStatus } from "@/lib/order-status";

const TONE: Record<OrderStatus, string> = {
  AWAITING_PAYMENT: "bg-gold text-ink border-line",
  PAID: "bg-paper-3 text-ink border-line",
  PURCHASING: "bg-paper-3 text-ink border-line",
  PURCHASED: "bg-paper-3 text-ink border-line",
  AT_UK_WAREHOUSE: "bg-paper-3 text-ink border-line",
  SHIPPED_TO_GHANA: "bg-paper-3 text-ink border-line",
  IN_CUSTOMS: "bg-paper-3 text-ink border-line",
  OUT_FOR_DELIVERY: "bg-gold text-ink border-line",
  DELIVERED: "bg-green text-paper border-green",
  CANCELLED: "bg-red text-white border-red",
  REFUNDED: "bg-red text-white border-red",
};

export default function StatusChip({ status }: { status: OrderStatus }) {
  return <span className={`tag ${TONE[status]}`}>{STATUS_LABEL[status]}</span>;
}
