import { redirect } from "next/navigation";

// interviews need a problem, and the picker is where you choose one
export default function InterviewIndex() {
  redirect("/practice");
}
