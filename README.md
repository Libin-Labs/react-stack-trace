# @lp-labs/react-stack-trace

Parse and display supplied JavaScript stack traces with controlled grouping,
collapse state, frame selection and safe browser source links. React 18 or 19 is
the only peer; there are no runtime dependencies and no error interception.

## Installation

```sh
npm install @lp-labs/react-stack-trace react
```

```tsx
import { useState } from "react";
import { StackTrace, type StackFrame } from "@lp-labs/react-stack-trace";
import "@lp-labs/react-stack-trace/styles.css";

const stack = `TypeError: Cannot save
    at save (https://example.com/app.js:10:4)
    at submit (https://example.com/app.js:25:2)
load@https://example.com/vendor.js:8:1`;

export function ErrorDetails() {
  const [collapsedGroups, onCollapsedGroupsChange] = useState<string[]>([]);
  const [selectedFrameId, select] = useState<string | null>(null);
  return (
    <StackTrace
      stack={stack}
      groupBy={(frame) => frame.file?.includes("vendor") ? "Dependencies" : "Application"}
      collapsedGroups={collapsedGroups}
      onCollapsedGroupsChange={onCollapsedGroupsChange}
      selectedFrameId={selectedFrameId}
      onFrameSelect={(frame: StackFrame) => select(frame.id)}
      sourceLink={(frame) => frame.file ? `${frame.file}#L${frame.line ?? 1}` : undefined}
    />
  );
}
```

Named ESM and CommonJS exports have the same API:
`const { StackTrace } = require("@lp-labs/react-stack-trace")`.
There is no default export. Import CSS with a CSS-capable application bundler.
Module imports do not read browser globals.

## StackTrace props

The exported `StackTraceProps` interface describes these props.

| Prop | Type | Default / behavior |
| --- | --- | --- |
| `stack` | `string` | `""`; parsed when `frames` is absent |
| `frames` | `readonly StackFrame[]` | Absent; when supplied takes precedence, even `[]` |
| `groupBy` | `(frame: StackFrame) => string` | File, or `"Native / unknown"` |
| `collapsedGroups` | `readonly string[]` | `[]`; controlled group names |
| `onCollapsedGroupsChange` | `(groups: string[]) => void` | Absent; collapse buttons disabled |
| `selectedFrameId` | `string \| null` | `null`; controlled selection highlight |
| `onFrameSelect` | `(frame: StackFrame) => void` | Absent; selection controls omitted |
| `sourceLink` | `(frame: StackFrame) => string \| undefined` | `frame.file`; always safety-checked |
| `renderFrame` | `(frame: StackFrame) => ReactNode` | Absent; function name and location |
| `className` | `string` | `""`; appended to `lp-stack` |
| `style` | `CSSProperties` | Absent; outer section |
| `ariaLabel` | `string` | `"Stack trace"` |

Callbacks request changes; the parent must update controlled props. A group name
is its identity; choose stable grouping output. Duplicate frame IDs within a group
are not supported. Grouping collects all matching frames, not just adjacent runs.
Missing selection IDs do not select anything. Empty/unrecognized stacks show
`No stack frames.` No package-specific errors are thrown for parse failures;
consumer render, grouping and link callbacks may throw and should use your error boundary.

## Types

- `StackFrame`: required `id`, `raw`, `functionName` strings; optional `file`
  string, `line` and `column` numbers, `native` boolean. Line/column numbers are
  supplied source positions, normally one-based. Custom IDs should be stable.
- `FrameGroup`: `{ name: string; frames: StackFrame[] }`.
- `StackTraceProps`: component interface above.

## Pure helpers

### parseStackTrace(stack: string): StackFrame[]

Parses V8/Node/Chromium `at function (file:line:column)` and bare `at file:line:column`,
Firefox/Safari `function@file:line:column` and anonymous `@file:line` formats.
Windows paths, URL ports, `node:` paths, bare `file:line:column`, and native
`at function (native)` / `function@[native code]` are retained.

Blank lines and ordinary message lines are ignored. IDs are `frame-N`, where N is
the original zero-based line index; `raw` preserves that line. Missing names become
`"<anonymous>"`. Unknown `at ...` or `...@...` locations are retained as file text,
without line/column. Empty input returns `[]`. There is no source-map resolution,
eval expansion, async causality reconstruction or engine-complete grammar.
Error message lines that look like frames can be interpreted as frames.

### groupFrames(frames, groupBy?)

Accepts `readonly StackFrame[]` and optional `(frame: StackFrame) => string`.
Returns `FrameGroup[]`, ordered by first occurrence of each group; frame order
inside each group is retained. The default key is `frame.file ?? "Native / unknown"`.
Inputs are not mutated, frame references are preserved and `[]` returns `[]`.
Errors from a custom grouping function propagate.

### safeSourceUrl(value: string | undefined): string | undefined

Returns a normalized absolute HTTP(S) URL or `undefined`. Rejects all other
protocols, relative/protocol-relative URLs, credentials, backslashes, ASCII spaces
and control characters, and invalid URLs. Used on every default or custom source
link. No browser globals are required. It does not enforce a trusted host allowlist:
enforce that in `sourceLink` if your application requires one.

```ts
import {
  parseStackTrace, groupFrames, safeSourceUrl, type FrameGroup,
} from "@lp-labs/react-stack-trace";

const frames = parseStackTrace("at save (https://example.com/app.js:10:4)");
const groups: FrameGroup[] = groupFrames(frames, () => "Application");
const href = safeSourceUrl(frames[0]?.file);
console.log(groups, href);
```

## Custom frames and styling

```tsx
import { StackTrace, type StackFrame } from "@lp-labs/react-stack-trace";

const frames: StackFrame[] = [{
  id: "custom-1", raw: "save at app.ts", functionName: "save",
  file: "https://example.com/app.ts", line: 42, column: 7,
}];

<StackTrace
  frames={frames}
  className="my-stack"
  renderFrame={(frame) => <code>{frame.functionName} on line {frame.line}</code>}
/>;
```

The custom renderer replaces the frame text, not the selection control or safe
source link. It must not inject untrusted HTML. Override `--lp-stack-accent` and
`--lp-stack-border` on `.lp-stack`; `style` also applies to the outer section.

## Accessibility and limits

Groups use headings and native buttons with `aria-expanded`. Selection controls
use `aria-pressed`; frames are ordered lists; links open with
`rel="noopener noreferrer"`. Keyboard focus is visible. Without collapse callbacks
the groups remain static. No global keyboard shortcuts or focus trapping are used.

Parsing and grouping are linear in trace size, but every visible frame renders;
there is no virtualization. Bound very large traces in your application.
Local filesystem, editor and `node:` locations remain text, not clickable links.
HTTP(S) source links navigate only when the user clicks; no source files are fetched.
Untrusted error messages are text, not HTML. No errors are captured automatically.
Group-based display can change apparent global frame order; group into one group
to preserve a single ordered call list.

## License

[MIT](./LICENSE).

## Support

If this library is useful to you, consider supporting its maintenance with a [donation via PayPal](https://www.paypal.me/LibinPrasanth).

## Author

Created by [Libin Prasanth](https://www.linkedin.com/in/libinprasanth/). Connect on LinkedIn for updates and discussion.
