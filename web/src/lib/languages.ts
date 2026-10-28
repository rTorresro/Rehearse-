import type { Language } from "@rehearse/shared";

// display order matches the design mock's language select
export const LANGUAGE_OPTIONS: { id: Language; label: string; fileName: string }[] = [
  { id: "python", label: "Python 3", fileName: "solution.py" },
  { id: "java", label: "Java", fileName: "Solution.java" },
  { id: "cpp", label: "C++", fileName: "solution.cpp" },
  { id: "javascript", label: "JavaScript", fileName: "solution.js" },
];
