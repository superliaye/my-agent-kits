import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Background,
  Controls,
  Handle,
  MiniMap,
  NodeResizer,
  Panel,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useNodesState,
  useReactFlow,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { layoutCanvas, settleFrame } from './canvas-model.mjs';

const pathParts = location.pathname.split('/').filter(Boolean);
const runId = pathParts[0] === 'r' ? decodeURIComponent(pathParts[1] ?? '') : '';
const fragmentToken = decodeURIComponent(location.hash.replace(/^#(?:token=)?/, ''));
const token = fragmentToken || history.state?.newspaperToken || '';
if (fragmentToken) history.replaceState({ ...history.state, newspaperToken: fragmentToken }, '', location.pathname + location.search);
const apiRoot = `/api/runs/${encodeURIComponent(runId)}`;
const authHeaders = { 'X-Newspaper-Token': token };

function App() {
  return <ReactFlowProvider><Newspaper /></ReactFlowProvider>;
}

function Newspaper() {
  const flow = useReactFlow();
  const [canvas, setCanvas] = useState(null);
  const canvasRef = useRef(null);
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [connection, setConnection] = useState({ kind: 'loading', label: 'Loading' });
  const [notice, setNotice] = useState(null);
  const [saving, setSaving] = useState(false);
  const [activeRegion, setActiveRegion] = useState(null);
  const pendingEdit = useRef(null);
  const socketRef = useRef(null);
  const reconnectAttempt = useRef(0);
  const reconnectTimer = useRef(0);
  const pollTimer = useRef(0);
  const focusKey = useRef('');
  const initialFit = useRef(false);
  const reflowFrame = useRef(0);

  const mutate = useCallback(async (patch, description) => {
    const current = canvasRef.current;
    if (!current) return;
    const pending = { patch, description };
    pendingEdit.current = pending;
    setSaving(true);
    try {
      const response = await fetch(`${apiRoot}/mutate`, {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ baseRevision: current.revision, patch }),
      });
      const body = await response.json().catch(() => ({}));
      if (response.status === 409) {
        if (body.canvas) applyCanvas(body.canvas, true);
        pendingEdit.current = pending;
        setNotice({
          kind: 'error',
          title: 'This edition changed first',
          message: `Your ${description} is preserved. Review the current edition, then retry it.`,
          action: 'Retry edit',
          onAction: () => mutate(pending.patch, pending.description),
        });
        return;
      }
      if (!response.ok) throw new Error(body.error || body.message || `Request failed (${response.status})`);
      pendingEdit.current = null;
      setNotice((currentNotice) => currentNotice?.kind === 'error' ? null : currentNotice);
      applyCanvas(body, true);
    } catch (error) {
      pendingEdit.current = pending;
      setConnection({ kind: 'error', label: 'Offline' });
      setNotice({
        kind: 'error', title: 'Edit not saved', message: error.message,
        action: 'Retry edit', onAction: () => mutate(pending.patch, pending.description),
      });
    } finally {
      setSaving(false);
    }
  }, []);

  const applyCanvas = useCallback((nextCanvas, keepCamera = false) => {
    if (!nextCanvas || typeof nextCanvas !== 'object') return;
    canvasRef.current = nextCanvas;
    setCanvas(nextCanvas);
    const layout = layoutCanvas(nextCanvas);
    const automaticLeads = new Set(Object.keys(nextCanvas.regions).map((regionId) => Object.entries(nextCanvas.nodes)
      .filter(([, node]) => node.region === regionId)
      .sort(([leftId, left], [rightId, right]) => left.order - right.order || leftId.localeCompare(rightId))[0]?.[0]).filter(Boolean));
    const regionNodes = Object.entries(nextCanvas.regions).map(([id, region]) => {
      const frame = layout.regions.get(id);
      return {
        id: `region:${id}`,
        type: 'region',
        position: { x: frame.x, y: frame.y },
        data: { id, region },
        style: { width: frame.width, height: frame.height },
        draggable: false,
        selectable: false,
        focusable: false,
        zIndex: -1,
      };
    });
    const contentNodes = Object.entries(nextCanvas.nodes).map(([id, node]) => {
      const frame = layout.nodes.get(id);
      return {
        id,
        type: 'article',
        position: { x: frame.x, y: frame.y },
        data: { node, mutate, automaticLead: automaticLeads.has(id), focused: nextCanvas.focus.includes(id) },
        style: { width: frame.width, ...(node.frame ? { height: frame.height } : {}) },
        dragHandle: '.card__header',
        zIndex: 2,
      };
    });
    setNodes([...regionNodes, ...contentNodes]);
    const nextFocusKey = JSON.stringify(nextCanvas.focus);
    requestAnimationFrame(() => {
      if (!initialFit.current) {
        initialFit.current = true;
        const primaryRegion = regionNodes[0];
        fitEdition(flow, primaryRegion ? [primaryRegion] : contentNodes);
      } else if (!keepCamera && focusKey.current !== nextFocusKey) {
        const focused = nextCanvas.focus.map((id) => id in nextCanvas.regions ? `region:${id}` : id);
        flow.fitView({ nodes: focused.map((id) => ({ id })), padding: 0.35, duration: 450, maxZoom: 1.05 });
      }
      if (!keepCamera) {
        const focusedRegion = nextCanvas.focus.map((id) => id in nextCanvas.regions ? id : nextCanvas.nodes[id]?.region).find(Boolean);
        setActiveRegion(focusedRegion ?? Object.keys(nextCanvas.regions)[0] ?? null);
      }
      focusKey.current = nextFocusKey;
    });
  }, [flow, mutate, setNodes]);

  const reflowMeasuredNodes = useCallback(() => {
    const current = canvasRef.current;
    if (!current) return;
    setNodes((items) => {
      const measuredHeights = new Map(items
        .filter((item) => !item.id.startsWith('region:') && !current.nodes[item.id]?.frame && item.measured?.height)
        .map((item) => [item.id, item.measured.height]));
      const layout = layoutCanvas(current, measuredHeights);
      return items.map((item) => {
        if (item.id.startsWith('region:')) {
          const frame = layout.regions.get(item.id.slice('region:'.length));
          return { ...item, position: { x: frame.x, y: frame.y }, style: { width: frame.width, height: frame.height } };
        }
        if (current.nodes[item.id]?.frame) return item;
        const frame = layout.nodes.get(item.id);
        return { ...item, position: { x: frame.x, y: frame.y }, style: { width: frame.width } };
      });
    });
  }, [setNodes]);

  const handleNodesChange = useCallback((changes) => {
    onNodesChange(changes);
    if (changes.some((change) => change.type === 'dimensions')) {
      cancelAnimationFrame(reflowFrame.current);
      reflowFrame.current = requestAnimationFrame(reflowMeasuredNodes);
    }
  }, [onNodesChange, reflowMeasuredNodes]);

  const fetchState = useCallback(async (keepCamera = false) => {
    const response = await fetch(`${apiRoot}/state`, { headers: authHeaders, cache: 'no-store' });
    if (!response.ok) throw new Error(`State request failed (${response.status})`);
    const validation = response.headers.get('X-Newspaper-Validation-Message');
    if (validation) setNotice({ kind: 'validation', title: 'Source needs attention', message: validation });
    else setNotice((current) => current?.kind === 'validation' ? null : current);
    applyCanvas(await response.json(), keepCamera);
  }, [applyCanvas]);

  const pollOnce = useCallback(async () => {
    if (document.visibilityState !== 'visible' || socketRef.current?.readyState === WebSocket.OPEN || !canvasRef.current) return;
    try {
      const response = await fetch(`${apiRoot}/poll?since=${canvasRef.current.revision}`, { headers: authHeaders, cache: 'no-store' });
      if (!response.ok) throw new Error();
      const validation = response.headers.get('X-Newspaper-Validation-Message');
      if (validation) setNotice({ kind: 'validation', title: 'Source needs attention', message: validation });
      else setNotice((current) => current?.kind === 'validation' ? null : current);
      const result = await response.json();
      if (result.changed) result.canvas ? applyCanvas(result.canvas) : await fetchState();
    } catch {
      setConnection({ kind: 'error', label: 'Offline' });
    }
  }, [applyCanvas, fetchState]);

  const startPolling = useCallback(() => {
    clearInterval(pollTimer.current);
    if (document.visibilityState !== 'visible') return;
    void pollOnce();
    pollTimer.current = setInterval(pollOnce, 2500);
  }, [pollOnce]);

  const connectSocket = useCallback(() => {
    clearTimeout(reconnectTimer.current);
    if (!runId || !token) return;
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    let socket;
    try {
      socket = new WebSocket(`${protocol}//${location.host}/ws/${encodeURIComponent(runId)}`, [token]);
    } catch {
      startPolling();
      return;
    }
    socketRef.current = socket;
    setConnection({ kind: 'loading', label: 'Connecting' });
    socket.addEventListener('open', async () => {
      if (socketRef.current !== socket) return;
      reconnectAttempt.current = 0;
      clearInterval(pollTimer.current);
      setConnection({ kind: 'connected', label: 'Live' });
      await fetchState(true);
    });
    socket.addEventListener('message', (event) => {
      if (socketRef.current !== socket) return;
      const message = JSON.parse(event.data);
      if (message.type === 'validation') {
        if (message.error) setNotice({ kind: 'validation', title: 'Source needs attention', message: message.error.message || 'canvas.json is invalid. The last valid edition remains visible.' });
        else setNotice((current) => current?.kind === 'validation' ? null : current);
      } else if (message.type === 'revision' && message.revision > (canvasRef.current?.revision ?? -1)) {
        void fetchState();
      }
    });
    socket.addEventListener('close', () => {
      if (socketRef.current !== socket) return;
      setConnection({ kind: 'disconnected', label: 'Polling' });
      startPolling();
      const delay = Math.min(12000, 500 * (2 ** reconnectAttempt.current));
      reconnectAttempt.current = Math.min(8, reconnectAttempt.current + 1);
      reconnectTimer.current = setTimeout(connectSocket, delay);
    });
  }, [fetchState, startPolling]);

  useEffect(() => {
    if (!runId || !token) {
      setConnection({ kind: 'error', label: 'No access' });
      setNotice({ kind: 'error', title: 'This link is incomplete', message: 'Open the full URL printed by newspaper start, including its fragment.' });
      return undefined;
    }
    fetchState().then(connectSocket).catch((error) => {
      setConnection({ kind: 'error', label: 'Offline' });
      setNotice({ kind: 'error', title: 'Edition unavailable', message: error.message });
      startPolling();
    });
    const onVisibility = () => socketRef.current?.readyState === WebSocket.OPEN
      ? clearInterval(pollTimer.current)
      : startPolling();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      clearInterval(pollTimer.current);
      clearTimeout(reconnectTimer.current);
      cancelAnimationFrame(reflowFrame.current);
      socketRef.current?.close();
    };
  }, [connectSocket, fetchState, startPolling]);

  const onNodeDragStop = useCallback((_, flowNode) => {
    if (flowNode.id.startsWith('region:')) return;
    const current = canvasRef.current;
    const layout = layoutCanvas(current).nodes;
    const frame = settleFrame(flowNode.id, {
      x: Math.round(flowNode.position.x),
      y: Math.round(flowNode.position.y),
      width: Math.round(flowNode.measured?.width ?? flowNode.width ?? 300),
      height: Math.round(flowNode.measured?.height ?? flowNode.height ?? 180),
    }, layout);
    setNodes((items) => items.map((item) => item.id === flowNode.id ? { ...item, position: { x: frame.x, y: frame.y } } : item));
    void mutate({ nodes: { [flowNode.id]: { frame } } }, `placement for ${flowNode.id}`);
  }, [mutate, setNodes]);

  const nodeTypes = useMemo(() => ({ article: ArticleNode, region: RegionNode }), []);
  const edges = useMemo(() => Object.entries(canvas?.edges ?? {}).map(([id, edge]) => ({
    id, source: edge.source, target: edge.target, label: edge.label, type: 'smoothstep', selectable: false,
  })), [canvas]);
  const resetPatch = useMemo(() => Object.fromEntries(Object.entries(canvas?.nodes ?? {})
    .filter(([, node]) => node.frame)
    .map(([id]) => [id, { frame: null }])), [canvas]);

  return <main className="app">
    <header className="masthead">
      <div className="masthead__name"><span className="edition">Working edition</span><h1>{canvas?.title ?? 'Newspaper'}</h1></div>
      <div className="masthead__meta" aria-live="polite">
        <span className="connection" data-state={connection.kind}><i aria-hidden="true" /><span>{connection.label}</span></span>
        <span className="revision">{saving ? 'Saving…' : `Edition ${canvas?.revision ?? '—'}`}</span>
      </div>
    </header>
    {notice && <section className={`notice notice--${notice.kind}`} aria-live="assertive">
      <div><strong>{notice.title}</strong><span>{notice.message}</span></div>
      {notice.action && <button type="button" onClick={notice.onAction}>{notice.action}</button>}
      <button className="notice__dismiss" type="button" aria-label="Dismiss message" onClick={() => setNotice(null)}>×</button>
    </section>}
    <section className="viewport" aria-label="Spatial newspaper canvas">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={handleNodesChange}
        onNodeDragStop={onNodeDragStop}
        minZoom={0.08}
        maxZoom={1.6}
        nodesConnectable={false}
        selectionOnDrag
        panOnScroll={false}
        elevateNodesOnSelect={false}
        fitView
        proOptions={{ hideAttribution: false }}
      >
        <Background gap={24} size={1} color="rgba(53, 58, 51, .16)" />
        <MiniMap pannable zoomable nodeStrokeWidth={4} position="bottom-left" />
        <Controls position="bottom-right" showInteractive={false} />
        <Panel position="top-left" className="region-nav">
          {Object.entries(canvas?.regions ?? {}).map(([id]) => <button key={id} type="button" data-active={activeRegion === id} aria-pressed={activeRegion === id} onClick={() => {
            setActiveRegion(id);
            flow.fitView({ nodes: [{ id: `region:${id}` }], padding: 0.1, duration: 450, maxZoom: 1.05 });
          }}>{humanize(id)}</button>)}
          {Object.keys(resetPatch).length > 0 && <button data-action="reset-layout" type="button" onClick={() => mutate({ nodes: resetPatch }, 'automatic layout')}>Reset layout</button>}
        </Panel>
      </ReactFlow>
    </section>
    <p className="canvas-hint">Drag the page to roam · scroll to zoom · drag cards to arrange</p>
  </main>;
}

const RegionNode = memo(function RegionNode({ data }) {
  return <section className="region">
    <span className="region__eyebrow">{data.region.layout} · {data.region.columns} columns</span>
    <h2>{humanize(data.id)}</h2>
  </section>;
});

const ArticleNode = memo(function ArticleNode({ id, data, selected }) {
  const { node, mutate, automaticLead, focused } = data;
  const [editing, setEditing] = useState(false);
  const [headline, setHeadline] = useState(node.title ?? '');
  const [headlineDirty, setHeadlineDirty] = useState(false);
  const [headlineError, setHeadlineError] = useState('');
  const lead = automaticLead && node.type === 'story' && node.span > 1;
  useEffect(() => {
    if (!editing || !headlineDirty) setHeadline(node.title ?? '');
  }, [editing, headlineDirty, node.title]);
  const beginHeadlineEdit = () => {
    setHeadline(node.title ?? '');
    setHeadlineDirty(false);
    setHeadlineError('');
    setEditing(true);
  };
  const cancelHeadlineEdit = () => {
    setHeadline(node.title ?? '');
    setHeadlineDirty(false);
    setHeadlineError('');
    setEditing(false);
  };
  const saveHeadline = (event) => {
    event.preventDefault();
    const title = headline.trim();
    if (!title) {
      setHeadlineError('Headline is required.');
      return;
    }
    if (title !== node.title) void mutate({ nodes: { [id]: { title } } }, `headline for ${id}`);
    setHeadlineDirty(false);
    setEditing(false);
  };
  const persistSize = (_, size) => {
    const current = data.node.frame ?? {};
    const frame = {
      x: Math.round(size.x ?? current.x ?? 0), y: Math.round(size.y ?? current.y ?? 0),
      width: Math.round(size.width), height: Math.round(size.height),
    };
    void mutate({ nodes: { [id]: { frame } } }, `size for ${id}`);
  };
  return <>
    <NodeResizer minWidth={190} minHeight={132} isVisible={selected} onResizeEnd={persistSize} />
    <article className={`card card--${node.type}${lead ? ' card--lead' : ''}`} data-status={(node.status ?? 'neutral').toLowerCase()} data-focused={focused} data-selected={selected} data-explicit-frame={Boolean(node.frame)}>
      <Handle type="target" position={Position.Left} className="edge-handle" />
      <header className="card__header">
        <span className="card__type">{humanize(node.type)}</span>
        {typeof node.title === 'string' && <button className="card__edit nodrag" type="button" aria-label={`Edit headline for ${node.title}`} onClick={beginHeadlineEdit}>✎</button>}
      </header>
      {editing ? <form className="headline-form nodrag" onSubmit={saveHeadline}>
        <input aria-label="Headline" aria-invalid={Boolean(headlineError)} aria-describedby={headlineError ? `headline-error-${id}` : undefined} value={headline} maxLength={300} autoFocus onChange={(event) => { setHeadline(event.target.value); setHeadlineDirty(true); setHeadlineError(''); }} onKeyDown={(event) => { if (event.key === 'Escape') cancelHeadlineEdit(); }} />
        {headlineError && <span id={`headline-error-${id}`} className="headline-form__error" role="alert">{headlineError}</span>}
        <div><button type="submit">Save headline</button><button type="button" onClick={cancelHeadlineEdit}>Cancel</button></div>
      </form> : node.type !== 'metric' && typeof node.title === 'string' && <h3 title="Double-click to edit" onDoubleClick={beginHeadlineEdit}>{node.title}</h3>}
      <NodeContent id={id} node={node} />
      {node.type !== 'metric' && (node.status || node.order !== undefined) && <footer className="card__footer">
        <span>#{id}</span>{node.status && <span className="status-pill">{humanize(node.status)}</span>}
      </footer>}
      <Handle type="source" position={Position.Right} className="edge-handle" />
    </article>
  </>;
});

function NodeContent({ id, node }) {
  if (node.type === 'code') return <div className="code-block nodrag nowheel"><span className="code__language">{node.language ?? 'text'}</span><pre><code>{String(node.code ?? '').split('\n').map((line, index) => <span key={index} className={`diff-line${diffClass(line)}`}>{line || ' '}</span>)}</code></pre></div>;
  if (node.type === 'table') return <div className="table-wrap nodrag nowheel"><table><thead><tr>{node.headers.map((header) => <th key={header}>{header}</th>)}</tr></thead><tbody>{node.rows.map((row, index) => <tr key={index}>{row.map((cell, cellIndex) => <td key={cellIndex}>{cell}</td>)}</tr>)}</tbody></table></div>;
  if (node.type === 'metric') return <><div className="metric__value">{node.value ?? '—'}</div><div className="metric__label">{node.label ?? node.title ?? 'Metric'}</div>{node.trend && <div className="metric__trend" data-direction={node.trend.trim().startsWith('-') ? 'down' : 'up'}>{node.trend}</div>}</>;
  if (node.type === 'media') return <Media id={id} node={node} />;
  return typeof node.body === 'string' ? <div className="card__body nodrag nowheel"><Markdown source={node.body} /></div> : null;
}

function Media({ node }) {
  const [source, setSource] = useState('');
  useEffect(() => {
    let objectUrl = '';
    fetch(`${apiRoot}/media?path=${encodeURIComponent(node.src)}`, { headers: authHeaders })
      .then((response) => response.ok ? response.blob() : Promise.reject(new Error('unavailable')))
      .then((blob) => { objectUrl = URL.createObjectURL(blob); setSource(objectUrl); })
      .catch(() => setSource(''));
    return () => { if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [node.src]);
  return <figure className="media-frame nodrag">{source ? <img src={source} alt={node.alt ?? node.caption ?? node.title ?? 'Local media'} /> : <div className="media-placeholder">Local media unavailable</div>}{node.caption && <figcaption>{node.caption}</figcaption>}</figure>;
}

function Markdown({ source }) {
  const blocks = source.split(/\n{2,}/);
  return blocks.map((block, index) => {
    const lines = block.split('\n');
    const unordered = lines.every((line) => /^[-*] /.test(line));
    const ordered = lines.every((line) => /^\d+\. /.test(line));
    if (unordered || ordered) {
      const List = ordered ? 'ol' : 'ul';
      return <List key={index}>{lines.map((line, item) => <li key={item}><Inline source={line.replace(ordered ? /^\d+\. / : /^[-*] /, '')} /></li>)}</List>;
    }
    return <p key={index}><Inline source={block.replace(/\n/g, ' ')} /></p>;
  });
}

function Inline({ source }) {
  const parts = source.split(/(\[[^\]]+\]\([^)]+\)|\*\*[^*]+\*\*|`[^`]+`)/g);
  return parts.map((part, index) => {
    const link = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (link && /^(https?:|mailto:)/.test(link[2])) return <a key={index} href={link[2]} target="_blank" rel="noreferrer">{link[1]}</a>;
    if (/^\*\*[^*]+\*\*$/.test(part)) return <strong key={index}>{part.slice(2, -2)}</strong>;
    if (/^`[^`]+`$/.test(part)) return <code key={index}>{part.slice(1, -1)}</code>;
    return <React.Fragment key={index}>{part}</React.Fragment>;
  });
}

function fitEdition(flow, nodes) {
  flow.fitView({ nodes: nodes.map(({ id }) => ({ id })), padding: innerWidth <= 680 ? 0.04 : 0.12, duration: 0, maxZoom: innerWidth <= 680 ? 0.42 : 0.9 });
}

function humanize(value) {
  return String(value).replace(/[-_]+/g, ' ').replace(/^./, (character) => character.toUpperCase());
}

function diffClass(line) {
  if (line.startsWith('+') && !line.startsWith('+++')) return ' diff-line--add';
  if (line.startsWith('-') && !line.startsWith('---')) return ' diff-line--remove';
  if (/^(@@|diff |\+\+\+|---)/.test(line)) return ' diff-line--meta';
  return '';
}

createRoot(document.getElementById('app')).render(<App />);
