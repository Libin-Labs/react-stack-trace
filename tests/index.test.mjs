import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { createRequire } from 'node:module';
import { JSDOM } from 'jsdom';
import React, { act, useState } from 'react';
import * as api from '../dist/esm/index.js';

const dom = new JSDOM('<!doctype html><html><body></body></html>');
globalThis.window = dom.window;
globalThis.document = dom.window.document;
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });
globalThis.HTMLElement = dom.window.HTMLElement;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const { createRoot } = await import('react-dom/client');
after(() => dom.window.close());

test('parses V8, Firefox, Safari, Windows, node and native frames', () => {
  const frames = api.parseStackTrace(
    [
      'TypeError: broken',
      '    at save (https://example.test:8080/app.js:10:4)',
      '    at C:\\work\\main.js:20:3',
      'load@https://example.test/other.js:8:2',
      '@https://example.test/other.js:9',
      '    at process (node:internal/task:12:5)',
      '    at nativeCall (native)',
      'https://example.test/bare.js:2:1',
    ].join('\r\n'),
  );
  assert.equal(frames.length, 7);
  assert.deepEqual(
    [frames[0].functionName, frames[0].file, frames[0].line, frames[0].column],
    ['save', 'https://example.test:8080/app.js', 10, 4],
  );
  assert.equal(frames[1].file, 'C:\\work\\main.js');
  assert.equal(frames[3].line, 9);
  assert.equal(frames[4].file, 'node:internal/task');
  assert.equal(frames[5].native, true);
  assert.deepEqual(api.parseStackTrace('Error: nope\n\nnot a frame'), []);
});

test('grouping preserves frame and first group order without mutation', () => {
  const frames = api.parseStackTrace(
    'at a (https://a.test/x:1:1)\nat b (https://b.test/x:2:1)\nat c (https://a.test/x:3:1)',
  );
  const groups = api.groupFrames(frames);
  assert.deepEqual(
    groups.map((group) => group.frames.length),
    [2, 1],
  );
  assert.equal(groups[0].frames[1], frames[2]);
  assert.equal(api.groupFrames(frames, () => 'All').length, 1);
  assert.equal(frames.length, 3);
});

test('safe links reject executable, relative, credentialed and obfuscated URLs', () => {
  for (const url of [
    'javascript:alert(1)',
    'data:text/html,x',
    'file:///x',
    '/relative',
    '//host/x',
    'https://user:pass@host/x',
    'https://host/\\x',
    'https://host/\nx',
    undefined,
  ]) {
    assert.equal(api.safeSourceUrl(url), undefined);
  }
  assert.equal(api.safeSourceUrl('https://example.test/a.js#L10'), 'https://example.test/a.js#L10');
});

test('controlled collapsing, selection, custom frames and safe custom links', async () => {
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  const frames = api.parseStackTrace(
    'at first (https://example.test/x:1:2)\nat second (https://example.test/x:2:3)',
  );
  function App() {
    const [collapsedGroups, onCollapsedGroupsChange] = useState([]);
    const [selectedFrameId, select] = useState(null);
    return React.createElement(api.StackTrace, {
      frames,
      groupBy: () => 'Application',
      collapsedGroups,
      onCollapsedGroupsChange,
      selectedFrameId,
      onFrameSelect: (frame) => select(frame.id),
      renderFrame: (frame) => React.createElement('em', null, frame.functionName),
      sourceLink: (frame) => (frame.functionName === 'first' ? 'javascript:alert(1)' : frame.file),
    });
  }
  try {
    await act(async () => root.render(React.createElement(App)));
    assert.equal(host.querySelectorAll('em').length, 2);
    assert.equal(host.querySelectorAll('a').length, 1);
    assert.equal(host.querySelector('a').rel, 'noopener noreferrer');
    await act(async () => host.querySelector('button[aria-label="Select first"]').click());
    assert.equal(host.querySelector('li[data-selected="true"] em').textContent, 'first');
    await act(async () => host.querySelector('h3 button').click());
    assert.equal(host.querySelector('ol'), null);
    assert.equal(host.querySelector('h3 button').getAttribute('aria-expanded'), 'false');
    await act(async () => host.querySelector('h3 button').click());
    assert.equal(host.querySelectorAll('li').length, 2);
    await act(async () =>
      root.render(React.createElement(api.StackTrace, { stack: 'Error: empty' })),
    );
    assert.match(host.textContent, /No stack frames/);
  } finally {
    await act(async () => root.unmount());
    host.remove();
  }
});

test('CommonJS exports match ESM', () => {
  const cjs = createRequire(import.meta.url)('../dist/cjs/index.js');
  assert.deepEqual(Object.keys(cjs).sort(), Object.keys(api).sort());
  assert.equal(cjs.parseStackTrace('at x (https://a.test/x:1:2)')[0].line, 1);
});
