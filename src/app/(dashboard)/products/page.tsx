import { ProductsManager } from "@/components/ProductsManager";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";

export default async function ProductsPage() {
  await requireUser();
  const products = await db.product.findMany({ where: { archivedAt: null }, include: { assets: { where: { isPrimary: true }, take: 1 } }, orderBy: [{ category: "asc" }, { pnNormalized: "asc" }] });
  return <ProductsManager initialProducts={JSON.parse(JSON.stringify(products))} />;
}
