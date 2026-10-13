import { Card, PageHeader } from "@/components/ui";
import { DemoForm } from "./DemoForm";

export const metadata = { title: "New demo" };

export default function NewDemoPage() {
  return (
    <>
      <PageHeader title="New demo business" description="Build a branded quote page for a prospect. They take it over with the claim link, no setup needed." />
      <Card className="max-w-3xl">
        <DemoForm />
      </Card>
    </>
  );
}
