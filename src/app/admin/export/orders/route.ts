import { NextResponse } from "next/server";
import { can, getAdmin } from "@/lib/auth";
import { adminAudit } from "@/lib/audit";
import { csvCell } from "@/lib/csv";
import { listOrders } from "@/lib/orders";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const who = await getAdmin();
  if (!who) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (who.user?.mustChangePassword || !can(who, "orders.export")) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const url = new URL(req.url);
  const orders = listOrders({ status: url.searchParams.get("status") ?? undefined, q: url.searchParams.get("q") ?? undefined });
  const money = (m: number) => (m / 100).toFixed(2);
  const header = ["Order", "Placed (UTC)", "Status", "Payment", "Customer", "Phone", "Email", "Area", "Shipping", "Items GHS", "Service charge GHS", "Shipping GHS", "Delivery GHS", "Total GHS", "Rate GHS per GBP", "Chargeable grams"];
  const lines = [header.map(csvCell).join(",")];
  for (const o of orders) {
    lines.push(
      [
        o.number, o.createdAt, o.status, o.paymentStatus, o.customerName, o.phone, o.email, o.zoneName, o.shippingName,
        money(o.itemsGhsMinor), money(o.serviceFeeMinor), money(o.shippingMinor), money(o.deliveryMinor), money(o.totalMinor),
        (o.fxRate * (1 + o.fxMarkupPct / 100)).toFixed(4), o.chargeableGrams,
      ].map(csvCell).join(","),
    );
  }
  adminAudit(who, "orders.export", "orders", `${orders.length} row(s)`);
  return new NextResponse(`﻿${lines.join("\r\n")}\r\n`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="orders-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
