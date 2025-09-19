import Image from "next/image";

export default function Home() {
  return (
    <main className="min-h-screen px-8 py-16 sm:px-20 sm:py-24">
      <div className="mx-auto max-w-5xl">
        <div className="text-center">
          <Image
            className="mx-auto dark:invert"
            src="/next.svg"
            alt="Next.js logo"
            width={120}
            height={26}
            priority
          />
          <h1 className="mt-6 text-4xl font-bold tracking-tight sm:text-6xl">
            Build your app faster with
            {" "}
            <span className="bg-gradient-to-r from-sky-500 to-emerald-500 bg-clip-text text-transparent">
              Next.js
            </span>
          </h1>
          <p className="mt-6 text-base text-foreground/80 sm:text-lg">
            TypeScript, Tailwind CSS, and ESLint are preconfigured. Start building your product now.
          </p>
          <div className="mt-10 flex items-center justify-center gap-4">
            <a
              className="rounded-full border border-transparent bg-foreground px-5 py-3 text-sm font-medium text-background transition-colors hover:bg-[#383838] dark:hover:bg-[#ccc] sm:text-base"
              href="https://nextjs.org/docs"
              target="_blank"
              rel="noopener noreferrer"
            >
              Read Next.js docs
            </a>
            <a
              className="rounded-full border border-black/[.08] px-5 py-3 text-sm font-medium transition-colors hover:border-transparent hover:bg-[#f2f2f2] dark:border-white/[.145] dark:hover:bg-[#1a1a1a] sm:text-base"
              href="https://tailwindcss.com/docs"
              target="_blank"
              rel="noopener noreferrer"
            >
              Tailwind docs
            </a>
          </div>
        </div>

        <div className="mt-16 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-black/[.08] p-5 dark:border-white/[.145]">
            <h3 className="text-base font-semibold">TypeScript</h3>
            <p className="mt-2 text-sm text-foreground/80">Strict types for safer, maintainable code.</p>
          </div>
          <div className="rounded-xl border border-black/[.08] p-5 dark:border-white/[.145]">
            <h3 className="text-base font-semibold">Tailwind CSS</h3>
            <p className="mt-2 text-sm text-foreground/80">Rapid UI building with utility classes.</p>
          </div>
          <div className="rounded-xl border border-black/[.08] p-5 dark:border-white/[.145]">
            <h3 className="text-base font-semibold">App Router</h3>
            <p className="mt-2 text-sm text-foreground/80">File‑system routing, layouts, and streaming.</p>
          </div>
          <div className="rounded-xl border border-black/[.08] p-5 dark:border-white/[.145]">
            <h3 className="text-base font-semibold">ESLint</h3>
            <p className="mt-2 text-sm text-foreground/80">Lint rules for consistent, modern best practices.</p>
          </div>
        </div>

        <footer className="mt-24 text-center text-sm text-foreground/60">
          <p>
            Get started by editing
            {" "}
            <code className="rounded bg-black/[.05] px-1 py-0.5 font-mono font-semibold dark:bg-white/[.06]">
              src/app/page.tsx
            </code>
            . Save to see your changes instantly.
          </p>
        </footer>
      </div>
    </main>
  );
}
