import type { FunctionSignature, Language } from "@rehearse/shared";
import { cppProgram } from "./cpp.js";
import { javaProgram } from "./java.js";
import { javascriptProgram } from "./javascript.js";
import { pythonProgram } from "./python.js";

const BUILDERS: Record<Language, (sig: FunctionSignature, code: string, marker: string) => string> =
  {
    python: pythonProgram,
    javascript: javascriptProgram,
    java: javaProgram,
    cpp: cppProgram,
  };

// a full program around the candidate's code: reads one test case's arguments as JSON on
// stdin, calls their function, and prints the return value as JSON after `marker`
export function buildProgram(
  language: Language,
  sig: FunctionSignature,
  code: string,
  marker: string,
) {
  return BUILDERS[language](sig, code, marker);
}

// what goes on stdin for one test case
export const stdinFor = (args: unknown[]) => JSON.stringify(args);
