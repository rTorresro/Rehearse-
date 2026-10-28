import * as z from "zod";
import {
  LANGUAGES,
  TECHNIQUE_TAGS,
  TOPICS,
  VALUE_TYPES,
  type Language,
  type Problem,
} from "@rehearse/shared";

const nonEmpty = z.string().trim().min(1);
const bigO = z.string().regex(/^O\(.+\)$/, 'expected big-O notation like "O(n log n)"');

const starterCode = z.strictObject(
  Object.fromEntries(LANGUAGES.map((l) => [l, nonEmpty])) as Record<Language, typeof nonEmpty>,
);

// runtime twin of the Problem type in @rehearse/shared. structural rules only;
// the validate script checks the rest (types of test values, solutions, starter code)
export const ProblemSchema = z.strictObject({
  id: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "id must be kebab-case"),
  title: nonEmpty,
  difficulty: z.enum(["easy", "medium", "hard"]),
  tags: z
    .array(z.enum([...TOPICS, ...TECHNIQUE_TAGS]))
    .min(1)
    .refine((tags) => tags.some((t) => (TOPICS as readonly string[]).includes(t)), {
      message: `needs at least one topic tag (${TOPICS.join(", ")})`,
    })
    .refine((tags) => new Set(tags).size === tags.length, { message: "duplicate tags" }),
  statement: z.array(nonEmpty).min(1),
  signature: z.strictObject({
    name: z.string().regex(/^[a-z][a-zA-Z0-9]*$/, "function name must be camelCase"),
    params: z.array(z.strictObject({ name: nonEmpty, type: z.enum(VALUE_TYPES) })).min(1),
    returns: z.enum(VALUE_TYPES),
  }),
  examples: z
    .array(z.strictObject({ input: nonEmpty, output: nonEmpty, explanation: nonEmpty.optional() }))
    .min(1),
  constraints: z.array(nonEmpty).min(1),
  starterCode,
  testCases: z.array(
    z.strictObject({ args: z.array(z.unknown()), expected: z.unknown(), hidden: z.boolean() }),
  ),
  hints: z.tuple([nonEmpty, nonEmpty, nonEmpty]),
  pitfalls: z.array(nonEmpty).min(1),
  complexity: z.strictObject({ time: bigO, space: bigO }),
  interviewerNotes: z.array(nonEmpty).min(2),
});

// fails to compile if the schema and the shared type ever drift apart
type Equals<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
const schemaMatchesType: Equals<z.infer<typeof ProblemSchema>, Problem> = true;
void schemaMatchesType;
