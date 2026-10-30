import { RelayLogo } from "@/components/brand/relay-brand";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="grid flex-1 lg:grid-cols-[1.1fr_1fr]">
      <section className="relative hidden flex-col justify-between border-r border-border bg-secondary p-12 lg:flex">
        <RelayLogo className="h-9 self-start" />
        <div className="max-w-md">
          <h2 className="text-5xl leading-[1.08] font-light tracking-[-0.02em] text-balance">Every client message, tracked.</h2>
          <p className="mt-5 text-lg leading-relaxed text-muted-foreground">Nothing forgotten. One calm place for the whole team to see what the client asked, who owns it, and what still needs a reply.</p>
        </div>
        <dl className="grid max-w-md grid-cols-3 gap-6 border-t border-border pt-6 text-sm">
          {[
            ["Thread by thread", "Slack to table"],
            ["Reply debt", "never hidden"],
            ["Role aware", "4 access levels"],
          ].map(([term, detail]) => (
            <div key={term}>
              <dt className="font-medium">{term}</dt>
              <dd className="mt-0.5 text-muted-foreground">{detail}</dd>
            </div>
          ))}
        </dl>
      </section>
      <section className="flex items-center justify-center px-6 py-16">
        <div className="w-full max-w-sm animate-page-in">
          <RelayLogo className="mb-10 h-8 lg:hidden" />
          {children}
        </div>
      </section>
    </main>
  );
}
