import type { Metadata } from "next";
import RequestForm from "@/components/RequestForm";

export const metadata: Metadata = { title: "Request an item by link" };

export default function RequestPage() {
  return <RequestForm />;
}
