# Rehearse

A LeetCode-style mock technical interview app. The user picks a problem, writes code in the browser, and talks out loud to a voice AI interviewer. The interviewer can see their code as they type, so it can ask about their approach, give hints, and push on complexity the way a real interviewer would.

## Layout

npm workspaces monorepo:

```
rehearse/
├── web/        Next.js (App Router), TypeScript, Tailwind v4. The UI: editor, mic, transcript.
│   └── src/
│       ├── app/          routes and layouts
│       ├── components/
│       │   ├── ui/          shared bits: Button, Card, Tag, TopBar, icons
│       │   ├── interview/   the live interview screen (/interview)
│       │   └── report/      the feedback report (/report/[id])
│       └── lib/          helpers, public config, mock data
│           ├── voice/       realtime voice session (WebRTC to OpenAI)
│           ├── code/        Monaco theme, useCodeSync (debounced snapshots), runCode
│           └── interview/   the shared /ws socket: code sync and hint state
├── server/     Node, TypeScript, Express 5, ws. Talks to the AI and speech providers.
│   └── src/
│       ├── index.ts      boots http + websocket on one port
│       ├── app.ts        express routes (REST, e.g. /health)
│       ├── realtime.ts   mints voice tokens, attaches the server to each call
│       ├── run.ts        POST /api/run: runs code against a problem's tests (bank only, never the client's)
│       ├── execution/    code runner: CodeRunner interface, Judge0 adapter, per-language harnesses, grading
│       ├── feedback/     end-of-interview reports: the recorded interview, rubric, Claude call,
│       │                 zod schema plus checks (real quotes, valid refs, score caps), retries
│       ├── interview/    the interviewer brain: phase state machine, prompt builder, tools,
│       │                 and the controller that drives a live call over OpenAI's sideband socket
│       ├── ws.ts         code sync websocket at /ws: joins an interview, receives editor snapshots
│       └── env.ts        all env reads live here
├── shared/     @rehearse/shared, types both apps import (websocket messages, Problem, etc.)
├── problems/   @rehearse/problems, the problem bank. Server-side only (Express, Next server components)
│   ├── data/         one JSON file per problem
│   ├── solutions/    a TypeScript reference solution per problem, run by the validator
│   ├── src/          zod schema (kept identical to the shared Problem type) and the bank API
│   └── scripts/validate.ts   schema + test value types + starter code + solutions pass their tests
├── docs/       DESIGN.md (UI spec) and design/ (reference mocks)
├── .claude/settings.json   project Claude Code settings
├── eslint.config.mjs       one flat config for the whole repo
└── tsconfig.base.json      base TS options each package extends
```

`shared` exports raw `.ts` with no build step. Next compiles it via `transpilePackages`, `tsx` runs it in server dev, and `tsup` bundles it into the server build. Keep it to types and plain constants.

The websocket protocol is the `ClientMessage` / `ServerMessage` unions in `shared/src/index.ts`. Change that file first when the protocol changes.

## Commands

Run from the repo root:

| Command                                                                              | What it does                                       |
| ------------------------------------------------------------------------------------ | -------------------------------------------------- |
| `npm install`                                                                        | install everything for all workspaces              |
| `npm run dev`                                                                        | run server (:4000) and web (:3000) together        |
| `npm run build`                                                                      | build server then web                              |
| `npm run lint`                                                                       | ESLint over the whole repo                         |
| `npm run typecheck`                                                                  | `tsc --noEmit` in every workspace                  |
| `npm test`                                                                           | unit tests, plus the problem bank validator        |
| `npm run validate:problems`                                                          | just the problem bank validator                    |
| `JUDGE0_LIVE=1 npx tsx --test src/execution/judge0.live.test.ts` (in `server/`)      | harnesses against a real Judge0                    |
| `ANTHROPIC_LIVE=1 npx tsx --test src/feedback/anthropic.live.test.ts` (in `server/`) | one real feedback report from Claude (costs money) |
| `npm run format`                                                                     | Prettier write                                     |
| `npm run format:check`                                                               | Prettier check                                     |

For one app only: `npm run dev -w web` or `npm run dev -w server`.

Env: copy `server/.env.example` to `server/.env` and `web/.env.example` to `web/.env.local`.

## Rules

- **`docs/DESIGN.md` is the source of truth for the UI. Read it before any UI work.** It points to the reference mocks in `docs/design/`; use them for sizes, colors, and copy, but don't copy their code. The `docs/` folder is excluded from Prettier, so leave those files as they are.
- **Problems never ship whole to the browser.** Only import `@rehearse/problems` from server code. Client components get `toPublicProblem()`, which drops hidden tests, hint text, pitfalls, and interviewer notes.
- **Adding a problem:** add `problems/data/<id>.json`, a reference solution at `problems/solutions/<id>.ts`, and an import in `problems/src/index.ts`, then run `npm run validate:problems`.
- **Hidden test cases stay hidden.** Code runs only against test cases from the bank. Responses for hidden cases carry status and runtime, never inputs, expected values, output, or errors.
- **No API keys in client code.** Secrets go in `server/.env` and are read only on the server. Nothing secret goes in `web/`, and nothing secret ever gets a `NEXT_PUBLIC_` prefix, since those get bundled into the browser. If the browser needs something that takes a key, proxy it through the server.
- **Comments are casual, short, and explain the why.** Skip comments that just repeat what the code does. Lowercase is fine.
- **Keep components small.** One job per component. If a component is getting long or juggling a lot of state, split it or pull the logic into a hook in `lib/`.
- **No Claude attribution in git.** Never add `Co-Authored-By` trailers, Claude session links, "Generated with Claude Code" lines, or any other Claude attribution to commit messages or PR descriptions.
