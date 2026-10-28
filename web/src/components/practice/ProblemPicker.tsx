"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { TOPICS, type Difficulty, type ProblemSummary, type Topic } from "@rehearse/shared";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { TAG_LABELS } from "@/lib/tags";
import { ChoiceGroup, type Choice } from "./ChoiceGroup";

type Any = "any";
const DIFFICULTIES: Difficulty[] = ["easy", "medium", "hard"];
const CAPITALIZED: Record<Difficulty, string> = { easy: "Easy", medium: "Medium", hard: "Hard" };

function matches(p: ProblemSummary, difficulty: Difficulty | Any, topic: Topic | Any) {
  return (
    (difficulty === "any" || p.difficulty === difficulty) &&
    (topic === "any" || p.tags.includes(topic))
  );
}

// you pick the kind of problem, not the problem itself, so it still feels like a real interview
export function ProblemPicker({ problems }: { problems: ProblemSummary[] }) {
  const router = useRouter();
  const [difficulty, setDifficulty] = useState<Difficulty | Any>("any");
  const [topic, setTopic] = useState<Topic | Any>("any");
  const [starting, setStarting] = useState(false);

  const pool = problems.filter((p) => matches(p, difficulty, topic));
  const count = (d: Difficulty | Any, t: Topic | Any) =>
    problems.filter((p) => matches(p, d, t)).length;

  const difficultyChoices: Choice<Difficulty | Any>[] = [
    { value: "any", label: "Any", count: count("any", topic) },
    // only offer levels the bank actually has
    ...DIFFICULTIES.filter((d) => problems.some((p) => p.difficulty === d)).map((d) => ({
      value: d,
      label: CAPITALIZED[d],
      count: count(d, topic),
      disabled: count(d, topic) === 0,
    })),
  ];
  const topicChoices: Choice<Topic | Any>[] = [
    { value: "any", label: "Any topic", count: count(difficulty, "any") },
    ...TOPICS.map((t) => ({
      value: t,
      label: TAG_LABELS[t],
      count: count(difficulty, t),
      disabled: count(difficulty, t) === 0,
    })),
  ];

  function start() {
    const pick = pool[Math.floor(Math.random() * pool.length)];
    if (!pick) return;
    setStarting(true);
    router.push(`/interview/${pick.id}`);
  }

  return (
    <Card as="section" label="Interview setup" className="flex flex-col">
      <div className="flex flex-col gap-6 p-6">
        <ChoiceGroup
          legend="Difficulty"
          name="difficulty"
          choices={difficultyChoices}
          value={difficulty}
          onChange={setDifficulty}
        />
        <ChoiceGroup
          legend="Topic"
          name="topic"
          choices={topicChoices}
          value={topic}
          onChange={setTopic}
        />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-4 border-t border-line px-6 py-4">
        <p aria-live="polite" className="text-[13px] text-fg-2">
          {pool.length === 0
            ? "No problems match. Try another difficulty or topic."
            : `${pool.length} ${pool.length === 1 ? "problem matches" : "problems match"}. You'll get one at random.`}
        </p>
        <Button
          variant="primary"
          size="lg"
          pad="wide"
          onClick={start}
          disabled={pool.length === 0 || starting}
        >
          {starting ? "Starting..." : "Start interview"}
        </Button>
      </div>
    </Card>
  );
}
