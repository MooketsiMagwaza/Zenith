import { createFileRoute } from "@tanstack/react-router";
import { TogglZenApp } from "@/components/zen/TogglZenApp";

export const Route = createFileRoute("/")({
  component: TogglZenApp,
});
