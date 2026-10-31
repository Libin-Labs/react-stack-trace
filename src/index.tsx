import { type CSSProperties, type ReactNode } from 'react';

export interface StackFrame {
  id: string;
  raw: string;
  functionName: string;
  file?: string;
  line?: number;
  column?: number;
  native?: boolean;
}

export interface FrameGroup {
  name: string;
  frames: StackFrame[];
}

export function parseStackTrace(stack: string): StackFrame[] {
  const frames: StackFrame[] = [];
  stack.split(/\r?\n/).forEach((raw, index) => {
    const text = raw.trim();
    if (!text) return;
    let functionName = '<anonymous>';
    let location = text;
    if (text.startsWith('at ')) {
      location = text.slice(3).trim();
      const call = /^(.*?)\s+\((.*)\)$/.exec(location);
      if (call) {
        functionName = call[1] || '<anonymous>';
        location = call[2] ?? '';
      }
    } else if (text.includes('@')) {
      const at = text.indexOf('@');
      functionName = text.slice(0, at) || '<anonymous>';
      location = text.slice(at + 1);
    } else if (!/:\d+(?::\d+)?$/.test(text)) {
      return;
    }
    const native = location === 'native' || location === '[native code]';
    const match = /^(.*?):(\d+)(?::(\d+))?$/.exec(location);
    if (!native && !match && !text.startsWith('at ') && !text.includes('@')) return;
    const frame: StackFrame = { id: `frame-${index}`, raw, functionName };
    if (native) {
      frame.native = true;
    } else if (match) {
      frame.file = match[1] ?? '';
      frame.line = Number(match[2]);
      if (match[3] !== undefined) frame.column = Number(match[3]);
    } else {
      frame.file = location;
    }
    frames.push(frame);
  });
  return frames;
}

export function groupFrames(
  frames: readonly StackFrame[],
  groupBy: (frame: StackFrame) => string = (frame) => frame.file ?? 'Native / unknown',
): FrameGroup[] {
  const groups = new Map<string, StackFrame[]>();
  for (const frame of frames) {
    const name = groupBy(frame);
    const group = groups.get(name);
    if (group) group.push(frame);
    else groups.set(name, [frame]);
  }
  return Array.from(groups, ([name, values]) => ({ name, frames: values }));
}

export function safeSourceUrl(value: string | undefined): string | undefined {
  if (!value || /[\u0000-\u0020\u007f\\]/.test(value)) return undefined;
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password)
      return undefined;
    return url.href;
  } catch {
    return undefined;
  }
}

export interface StackTraceProps {
  stack?: string;
  frames?: readonly StackFrame[];
  groupBy?: (frame: StackFrame) => string;
  collapsedGroups?: readonly string[];
  onCollapsedGroupsChange?: (groups: string[]) => void;
  selectedFrameId?: string | null;
  onFrameSelect?: (frame: StackFrame) => void;
  sourceLink?: (frame: StackFrame) => string | undefined;
  renderFrame?: (frame: StackFrame) => ReactNode;
  className?: string;
  style?: CSSProperties;
  ariaLabel?: string;
}

export function StackTrace({
  stack = '',
  frames,
  groupBy,
  collapsedGroups = [],
  onCollapsedGroupsChange,
  selectedFrameId = null,
  onFrameSelect,
  sourceLink = (frame) => frame.file,
  renderFrame,
  className = '',
  style,
  ariaLabel = 'Stack trace',
}: StackTraceProps) {
  const resolved = frames ?? parseStackTrace(stack);
  const groups = groupFrames(resolved, groupBy);
  return (
    <section className={`lp-stack ${className}`} style={style} aria-label={ariaLabel}>
      {!resolved.length && <p>No stack frames.</p>}
      {groups.map((group) => {
        const collapsed = collapsedGroups.includes(group.name);
        return (
          <section key={group.name} className="lp-stack-group" aria-label={group.name}>
            <h3>
              <button
                type="button"
                aria-expanded={!collapsed}
                disabled={!onCollapsedGroupsChange}
                onClick={() =>
                  onCollapsedGroupsChange?.(
                    collapsed
                      ? collapsedGroups.filter((name) => name !== group.name)
                      : [...collapsedGroups, group.name],
                  )
                }
              >
                {group.name} ({group.frames.length})
              </button>
            </h3>
            {!collapsed && (
              <ol>
                {group.frames.map((frame) => {
                  const href = safeSourceUrl(sourceLink(frame));
                  return (
                    <li key={frame.id} data-selected={selectedFrameId === frame.id}>
                      {onFrameSelect && (
                        <button
                          type="button"
                          aria-label={`Select ${frame.functionName}`}
                          aria-pressed={selectedFrameId === frame.id}
                          onClick={() => onFrameSelect(frame)}
                        >
                          Select
                        </button>
                      )}
                      <div className="lp-stack-frame">
                        {renderFrame ? (
                          renderFrame(frame)
                        ) : (
                          <>
                            <strong>{frame.functionName}</strong>
                            <code>
                              {frame.native ? '[native]' : (frame.file ?? 'Unknown')}
                              {frame.line !== undefined ? `:${frame.line}` : ''}
                              {frame.column !== undefined ? `:${frame.column}` : ''}
                            </code>
                          </>
                        )}
                        {href && (
                          <a href={href} target="_blank" rel="noopener noreferrer">
                            Open source
                          </a>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </section>
        );
      })}
    </section>
  );
}
