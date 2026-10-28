import type { FunctionSignature } from "@rehearse/shared";

export const snakeCase = (name: string) => name.replace(/[A-Z]/g, (c) => "_" + c.toLowerCase());

export const usesTree = (sig: FunctionSignature) =>
  sig.params.some((p) => p.type === "tree") || sig.returns === "tree";
