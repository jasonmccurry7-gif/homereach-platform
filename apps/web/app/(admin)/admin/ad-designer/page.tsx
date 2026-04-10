import type { Metadata } from "next";
import { getAllCategories } from "@/lib/ad-engine";
import { AdDesignerClient } from "./ad-designer-client";

export const metadata: Metadata = { title: "Ad Designer — HomeReach Admin" };

export default function AdDesignerPage() {
  const categories = getAllCategories();
  return <AdDesignerClient categories={categories} />;
}
