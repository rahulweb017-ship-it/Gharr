import { PageHeader } from "./PageHeader";

/**
 * Shared shell for the static policy pages. The copy is a plain-language
 * working draft for the pilot and must be reviewed by counsel before launch.
 */
export function LegalPage({
  title,
  updated,
  sections,
}: {
  title: string;
  updated: string;
  sections: Array<{ heading: string; body: string[] }>;
}) {
  return (
    <div className="pb-10 md:mx-auto md:max-w-3xl">
      <PageHeader title={title} subtitle={`Last updated ${updated}`} backHref="/account" />
      <article className="px-4 md:px-0">
        <p className="rounded-xl bg-amber-50 p-3 text-xs text-amber-800">
          Working draft for the Hyderabad pilot. Subject to legal review before general launch.
        </p>
        {sections.map((section) => (
          <section key={section.heading} className="mt-6">
            <h2 className="text-base font-bold text-ink-900">{section.heading}</h2>
            {section.body.map((paragraph) => (
              <p key={paragraph} className="mt-2 text-sm leading-relaxed text-ink-600">
                {paragraph}
              </p>
            ))}
          </section>
        ))}
      </article>
    </div>
  );
}
