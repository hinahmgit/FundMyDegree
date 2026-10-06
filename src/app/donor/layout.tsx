import { requireRole } from "@/lib/auth";

export default async function DonorLayout({ children }: { children: React.ReactNode }) {
  await requireRole("donor");
  return children;
}
