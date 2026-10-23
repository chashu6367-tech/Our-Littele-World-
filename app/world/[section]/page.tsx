import { notFound } from "next/navigation";
import { NAV } from "@/lib/nav";
import { StateCard } from "@/components/StateCard";

export default async function SectionPage({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  const item = NAV.find((n) => n.slug === section && n.slug !== "home");
  if (!item) notFound();
  return (
    <div className="pt-6 md:pt-16">
      <StateCard icon={item.icon} title={`${item.label} is on its way`} body={`${item.blurb} It isn't ready yet, but it's coming.`} />
    </div>
  );
}
