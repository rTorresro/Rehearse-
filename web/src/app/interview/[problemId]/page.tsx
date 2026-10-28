import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getProblem, PROBLEMS, toPublicProblem } from "@rehearse/problems";
import { InterviewScreen } from "@/components/interview/InterviewScreen";

// one static page per problem. the bank is read here on the server, and only the public
// view (no hidden tests, hints, or interviewer notes) is handed to the client
export function generateStaticParams() {
  return PROBLEMS.map((p) => ({ problemId: p.id }));
}

export const dynamicParams = false;

export async function generateMetadata(
  props: PageProps<"/interview/[problemId]">,
): Promise<Metadata> {
  const { problemId } = await props.params;
  const problem = getProblem(problemId);
  return { title: problem ? `${problem.title} · Rehearse` : "Interview · Rehearse" };
}

export default async function InterviewPage(props: PageProps<"/interview/[problemId]">) {
  const { problemId } = await props.params;
  const problem = getProblem(problemId);
  if (!problem) notFound();
  return <InterviewScreen problem={toPublicProblem(problem)} />;
}
