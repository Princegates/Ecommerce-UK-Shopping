import type { Metadata } from "next";
import TrackForm from "@/components/TrackForm";

export const metadata: Metadata = { title: "Track an order" };

export default function TrackPage() {
  return <TrackForm />;
}
