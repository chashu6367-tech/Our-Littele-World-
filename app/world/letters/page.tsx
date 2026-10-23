import { getWorldContext } from "@/lib/data/world";
import { getLetters } from "@/lib/data/letters";
import { LettersView } from "@/features/letters/LettersView";

export default async function LettersPage() {
  const ctx = await getWorldContext();
  const letters = await getLetters(ctx.me.id);
  return <LettersView letters={letters} partner={ctx.partner?.displayName ?? "your partner"} />;
}
