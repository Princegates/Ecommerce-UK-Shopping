import { STATUS_LABEL, type OrderStatus } from "@/lib/order-status";

const TONE: Record<OrderStatus, string> = {
  AWAITING_PAYMENT: "bg-gold text-ink border-ink",
  PAID: "bg-paper-3 text-ink border-ink",
  PURCHASING: "bg-paper-3 text-ink border-ink",
  PURCHASED: "bg-paper-3 text-ink border-ink",
  AT_UK_WAREHOUSE: "bg-paper-3 text-ink border-ink",
  SHIPPED_TO_GHANA: "bg-paper-3 text-ink border-ink",
  IN_CUSTOMS: "bg-paper-3 text-ink border-ink",
  OUT_FOR_DELIVERY: "bg-gold text-ink border-ink",
  DELIVERED: "bg-green text-paper border-green",
  CANCELLED: "bg-red text-white border-red",
  REFUNDED: "bg-red text-white border-red",
};

export default function StatusChip({ status }: { status: OrderStatus }) {
  return <span className={`tag ${TONE[status]}`}>{STATUS_LABEL[status]}</span>;
}
