import type { Metadata } from "next";
import { ReportContent } from "@/components/report/ReportContent";
import { ReportLoader } from "@/components/report/ReportLoader";
import { CheckIcon } from "@/components/ui/icons";
import { TopBar } from "@/components/ui/TopBar";
import { getMockReport } from "@/lib/mock-report";

export const metadata: Metadata = { title: "Feedback report · Rehearse" };

export default async function ReportPage(props: PageProps<"/report/[id]">) {
  const { id } = await props.params;

  return (
    <div className="flex min-h-dvh flex-col bg-bg">
      <TopBar
        actions={
          <p className="flex items-center gap-2 text-[13px] text-fg-2">
            <CheckIcon className="h-3.5 w-3.5 text-success" />
            Interview complete
          </p>
        }
      />
      <main className="mx-auto flex w-full max-w-[1200px] flex-col gap-8 px-6 pt-10 pb-16">
        {/* "demo" is the built-in sample from the design; every other id is a real interview */}
        {id === "demo" ? (
          <ReportContent report={getMockReport(id)} source={{ kind: "demo" }} />
        ) : (
          <ReportLoader id={id} />
        )}
      </main>
    </div>
  );
}
