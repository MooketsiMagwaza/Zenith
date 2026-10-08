import { Button } from "../components/ui";
import { PageHeader } from "../components/ui";

export function NotFound() {
  return (
    <PageHeader eyebrow="404" title="This page is not here.">
      <p>The address may be mistyped, or the page may have moved.</p>
      <div className="mt-8">
        <Button href="/">Back to the start</Button>
      </div>
    </PageHeader>
  );
}
