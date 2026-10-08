import type { ReactNode } from "react";
import { APP_URL } from "../site";

export function Container({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`mx-auto w-full max-w-6xl px-5 sm:px-8 ${className}`}>{children}</div>;
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return <p className="micro-caps text-gold">{children}</p>;
}

export function PageHeader({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: ReactNode;
  children?: ReactNode;
}) {
  return (
    <header className="glow">
      <Container className="pt-16 pb-12 sm:pt-24 sm:pb-16">
        <Eyebrow>{eyebrow}</Eyebrow>
        <h1 className="mt-4 max-w-3xl text-4xl leading-[1.08] font-extralight tracking-tight text-balance sm:text-6xl">
          {title}
        </h1>
        {children ? (
          <div className="mt-6 max-w-2xl text-lg leading-relaxed font-light text-ink">{children}</div>
        ) : null}
      </Container>
    </header>
  );
}

type ButtonProps = { href: string; children: ReactNode; variant?: "gold" | "quiet" };

export function Button({ href, children, variant = "gold" }: ButtonProps) {
  const base =
    "inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-6 text-sm font-medium tracking-wide transition-colors";
  const look =
    variant === "gold"
      ? "bg-gold text-black hover:bg-[#d8b95e]"
      : "border border-line-strong text-fg hover:border-gold-dim hover:text-gold";
  return (
    <a href={href} className={`${base} ${look}`}>
      {children}
    </a>
  );
}

/** "Open the app" when the app has a public address, otherwise a pointer to the download page. */
export function OpenAppButton({ variant = "gold" }: { variant?: "gold" | "quiet" }) {
  return APP_URL ? (
    <Button href={APP_URL} variant={variant}>
      Open the app
    </Button>
  ) : (
    <Button href="/download/" variant={variant}>
      Get Zenith
    </Button>
  );
}

export function Section({
  id,
  eyebrow,
  title,
  intro,
  children,
}: {
  id?: string;
  eyebrow?: string;
  title: ReactNode;
  intro?: ReactNode;
  children?: ReactNode;
}) {
  const headingId = id ? `${id}-title` : undefined;
  return (
    <section id={id} aria-labelledby={headingId} className="scroll-mt-24 py-16 sm:py-24">
      <Container>
        {eyebrow ? <Eyebrow>{eyebrow}</Eyebrow> : null}
        <h2
          id={headingId}
          className="mt-3 max-w-3xl text-3xl leading-tight font-extralight tracking-tight text-balance sm:text-4xl"
        >
          {title}
        </h2>
        {intro ? (
          <div className="mt-5 max-w-2xl text-base leading-relaxed font-light text-ink sm:text-lg">{intro}</div>
        ) : null}
        {children ? <div className="mt-10 sm:mt-14">{children}</div> : null}
      </Container>
    </section>
  );
}

export function Card({ title, children, label }: { title: string; children: ReactNode; label?: string }) {
  return (
    <div className="card-soft p-6 sm:p-7">
      {label ? <p className="micro-caps mb-3">{label}</p> : null}
      <h3 className="text-lg font-normal text-fg">{title}</h3>
      <div className="mt-3 text-[15px] leading-relaxed font-light text-ink">{children}</div>
    </div>
  );
}

/** A real capture of the app (apps/marketing/README.md says how each was taken). */
export function Shot({ src, alt, width, height }: { src: string; alt: string; width: number; height: number }) {
  return (
    <img
      src={src}
      alt={alt}
      width={width}
      height={height}
      loading="lazy"
      decoding="async"
      className="shot h-auto w-full bg-surface-1"
    />
  );
}

export function Rule() {
  return (
    <Container>
      <div className="gold-rule" />
    </Container>
  );
}

export function Status({ tone, children }: { tone: "ready" | "building" | "planned" | "none"; children: ReactNode }) {
  const dot = {
    ready: "bg-gold",
    building: "bg-gold-dim",
    planned: "bg-dim",
    none: "bg-transparent border border-dim",
  }[tone];
  return (
    <span className="inline-flex items-center gap-2 text-sm text-fg">
      <span aria-hidden="true" className={`inline-block h-1.5 w-1.5 rounded-full ${dot}`} />
      {children}
    </span>
  );
}
