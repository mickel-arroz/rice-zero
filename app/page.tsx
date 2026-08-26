import { ThemeToggle } from "@/components/theme/theme-toggle";
import { APP_DESCRIPTION, APP_NAME } from "@/lib/constants";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col">
      <header className="flex items-center justify-between border-b border-border px-6 py-4">
        <span className="font-mono text-lg font-semibold">{APP_NAME}</span>
        <ThemeToggle />
      </header>
      <main className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
        <h1 className="text-4xl font-bold tracking-tight">{APP_NAME}</h1>
        <p className="max-w-md text-muted-foreground">{APP_DESCRIPTION}</p>
      </main>
    </div>
  );
}
