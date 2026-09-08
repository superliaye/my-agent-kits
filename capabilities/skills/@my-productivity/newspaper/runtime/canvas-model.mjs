export const MAX_DOCUMENT_BYTES = 5 * 1024 * 1024;
export const MAX_NODES = 1000;

const NODE_TYPES = new Set(['story', 'code', 'table', 'metric', 'callout', 'media']);
const STRING_FIELDS = ['title', 'body', 'caption', 'alt', 'code', 'label', 'language', 'trend', 'status'];

export function serializedDocumentBytes(canvas) {
  return new TextEncoder().encode(JSON.stringify(canvas)).byteLength;
}

export function mergeCanvasPatch(target, patch) {
  assertSafePatchValue(patch, 'patch');
  return mergePlainObjects(target, patch);
}

export function validateCanvas(canvas, options = {}) {
  if (!plainObject(canvas)) return bad('schema', 'Canvas must be an object', 'canvas');
  const canvasKeyError = unknownKey(canvas, ['version', 'revision', 'title', 'focus', 'regions', 'nodes', 'edges'], 'canvas');
  if (canvasKeyError) return canvasKeyError;
  if (serializedDocumentBytes(canvas) > (options.maxDocumentBytes ?? MAX_DOCUMENT_BYTES)) {
    return bad('document_too_large', `canvas.json exceeds ${options.maxDocumentBytes ?? MAX_DOCUMENT_BYTES} bytes`, 'canvas');
  }
  if (canvas.version !== 1) return bad('schema', 'version must equal 1', 'version');
  if (!Number.isInteger(canvas.revision) || canvas.revision < 0) return bad('schema', 'revision must be a non-negative integer', 'revision');
  if (typeof canvas.title !== 'string') return bad('schema', 'title must be a string', 'title');
  if (!plainObject(canvas.regions) || Object.keys(canvas.regions).length === 0) return bad('schema', 'regions must be a non-empty keyed object', 'regions');
  if (!plainObject(canvas.nodes)) return bad('schema', 'nodes must be a keyed object', 'nodes');
  if (!plainObject(canvas.edges)) return bad('schema', 'edges must be a keyed object', 'edges');
  if (Object.keys(canvas.nodes).length > (options.maxNodes ?? MAX_NODES)) return bad('too_many_nodes', `nodes exceeds ${options.maxNodes ?? MAX_NODES}`, 'nodes');
  if (!Array.isArray(canvas.focus)) return bad('schema', 'focus must be an array', 'focus');

  for (const [id, region] of Object.entries(canvas.regions)) {
    if (!plainObject(region) || region.layout !== 'newspaper') return bad('schema', 'region layout must be newspaper', `regions.${id}.layout`, id);
    const regionKeyError = unknownKey(region, ['layout', 'origin', 'width', 'columns'], `regions.${id}`, id);
    if (regionKeyError) return regionKeyError;
    if (!Array.isArray(region.origin) || region.origin.length !== 2 || !region.origin.every(Number.isFinite)) return bad('schema', 'region origin must be [x,y]', `regions.${id}.origin`, id);
    if (!Number.isFinite(region.width) || region.width <= 0) return bad('schema', 'region width must be positive', `regions.${id}.width`, id);
    if (!Number.isInteger(region.columns) || region.columns < 1 || region.columns > 12) return bad('schema', 'region columns must be 1..12', `regions.${id}.columns`, id);
  }

  for (const [id, node] of Object.entries(canvas.nodes)) {
    if (!plainObject(node) || !NODE_TYPES.has(node.type)) return bad('schema', 'unsupported node type', `nodes.${id}.type`, id);
    const nodeKeyError = unknownKey(node, ['type', 'region', 'order', 'span', 'parent', 'frame', ...STRING_FIELDS, 'value', 'headers', 'rows', 'src'], `nodes.${id}`, id);
    if (nodeKeyError) return nodeKeyError;
    const region = canvas.regions[node.region];
    if (!region) return bad('missing_reference', `Node ${id} references missing region ${node.region}`, `nodes.${id}.region`, id);
    if (!Number.isFinite(node.order)) return bad('schema', 'order must be numeric', `nodes.${id}.order`, id);
    if (!Number.isInteger(node.span) || node.span < 1 || node.span > region.columns) return bad('schema', 'span must fit region columns', `nodes.${id}.span`, id);
    if (node.parent !== undefined && (!node.parent || (!canvas.nodes[node.parent] && !canvas.regions[node.parent]))) return bad('missing_reference', `Node ${id} references missing parent ${node.parent}`, `nodes.${id}.parent`, id);
    if (node.frame !== undefined && (!plainObject(node.frame) || !['x', 'y', 'width', 'height'].every((key) => Number.isFinite(node.frame[key])) || node.frame.width <= 0 || node.frame.height <= 0)) return bad('schema', 'frame must have positive numeric geometry', `nodes.${id}.frame`, id);
    for (const key of STRING_FIELDS) {
      if (node[key] !== undefined && typeof node[key] !== 'string') return bad('schema', `${key} must be a string`, `nodes.${id}.${key}`, id);
    }
    for (const key of ['title', 'body', 'caption', 'code', 'label']) {
      if (typeof node[key] === 'string' && /<\/?[a-z][^>]*>/i.test(node[key])) return bad('unsafe_html', `Node ${id} contains HTML`, `nodes.${id}.${key}`, id);
    }
    if (node.type === 'table') {
      if (!Array.isArray(node.headers) || !node.headers.every((value) => typeof value === 'string')) return bad('schema', 'table headers must be strings', `nodes.${id}.headers`, id);
      if (!Array.isArray(node.rows) || !node.rows.every((row) => Array.isArray(row) && row.length === node.headers.length && row.every((value) => typeof value === 'string'))) return bad('schema', 'table rows must match headers', `nodes.${id}.rows`, id);
    }
    if (node.type === 'metric' && !['string', 'number'].includes(typeof node.value)) return bad('schema', 'metric value must be a string or number', `nodes.${id}.value`, id);
    if (node.type === 'media') {
      if (typeof node.src !== 'string' || !node.src) return bad('schema', 'media src is required', `nodes.${id}.src`, id);
      const mediaError = options.validateMedia?.(node.src, id);
      if (mediaError) return { ok: false, error: mediaError };
    }
  }

  for (const target of canvas.focus) {
    if (typeof target !== 'string' || (!canvas.nodes[target] && !canvas.regions[target])) return bad('missing_reference', `Focus references missing item ${target}`, 'focus', target);
  }
  for (const [id, edge] of Object.entries(canvas.edges)) {
    if (!plainObject(edge) || !canvas.nodes[edge.source] || !canvas.nodes[edge.target]) return bad('missing_reference', `Edge ${id} has a missing endpoint`, `edges.${id}`, id);
    const edgeKeyError = unknownKey(edge, ['source', 'target', 'label'], `edges.${id}`, id);
    if (edgeKeyError) return edgeKeyError;
    if (edge.label !== undefined && typeof edge.label !== 'string') return bad('schema', 'edge label must be a string', `edges.${id}.label`, id);
  }
  return { ok: true, value: canvas };
}

export function layoutCanvas(canvas, measuredHeights = new Map()) {
  const nodes = new Map();
  const regions = new Map();
  const side = 28;
  const top = 90;
  const gap = 20;

  for (const [regionId, region] of Object.entries(canvas.regions)) {
    const [x, y] = region.origin;
    const contentWidth = region.width - side * 2;
    const columnWidth = (contentWidth - gap * (region.columns - 1)) / region.columns;
    const columns = Array.from({ length: region.columns }, () => y + top);
    let explicitBottom = y + top;
    const entries = Object.entries(canvas.nodes)
      .filter(([, node]) => node.region === regionId)
      .sort(([leftId, left], [rightId, right]) => left.order - right.order || leftId.localeCompare(rightId));

    for (const [nodeId, node] of entries) {
      if (node.frame) {
        const frame = { ...node.frame };
        nodes.set(nodeId, frame);
        explicitBottom = Math.max(explicitBottom, frame.y + frame.height + side);
        continue;
      }
      const span = Math.min(region.columns, node.span);
      let bestColumn = 0;
      let bestY = Number.POSITIVE_INFINITY;
      for (let column = 0; column <= region.columns - span; column += 1) {
        const candidateY = Math.max(...columns.slice(column, column + span));
        if (candidateY < bestY) {
          bestY = candidateY;
          bestColumn = column;
        }
      }
      const height = measuredHeights.get(nodeId) ?? defaultNodeHeight(node);
      const frame = {
        x: x + side + bestColumn * (columnWidth + gap),
        y: bestY,
        width: columnWidth * span + gap * (span - 1),
        height,
      };
      nodes.set(nodeId, frame);
      for (let column = bestColumn; column < bestColumn + span; column += 1) columns[column] = bestY + height + gap;
    }
    const recipeBottom = Math.max(y + top, ...columns);
    regions.set(regionId, { x, y, width: region.width, height: Math.max(310, recipeBottom - y + side, explicitBottom - y) });
  }
  return { nodes, regions };
}

export function settleFrame(nodeId, frame, layouts, gap = 20) {
  const settled = { ...frame };
  for (let attempts = 0; attempts < 80; attempts += 1) {
    const collision = [...layouts.entries()].find(([otherId, other]) => otherId !== nodeId
      && settled.x < other.x + other.width + gap
      && settled.x + settled.width + gap > other.x
      && settled.y < other.y + other.height + gap
      && settled.y + settled.height + gap > other.y);
    if (!collision) break;
    settled.y = collision[1].y + collision[1].height + gap;
  }
  return settled;
}

function defaultNodeHeight(node) {
  const bodyLength = String(node.body ?? node.code ?? '').length;
  if (node.type === 'metric') return 210;
  if (node.type === 'table') return 190 + Math.min(300, (node.rows?.length ?? 0) * 34);
  if (node.type === 'code') return 160 + Math.min(300, String(node.code ?? '').split('\n').length * 16);
  if (node.type === 'media') return 320;
  return 180 + Math.min(240, Math.ceil(bodyLength / 75) * 22);
}

function plainObject(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function assertSafePatchValue(value, field) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertSafePatchValue(item, `${field}[${index}]`));
    return;
  }
  if (value === null || typeof value !== 'object') return;
  if (!plainObject(value)) throw unsafePatch(field, 'Patch values must be plain objects');
  for (const [key, child] of Object.entries(value)) {
    if (['__proto__', 'prototype', 'constructor'].includes(key)) {
      throw unsafePatch(`${field}.${key}`, `Unsafe patch key ${key}`);
    }
    assertSafePatchValue(child, `${field}.${key}`);
  }
}

function mergePlainObjects(target, patch) {
  if (!plainObject(target) || !plainObject(patch)) throw unsafePatch('patch', 'Patch merge requires plain objects');
  for (const [key, value] of Object.entries(patch)) {
    if (value === null) {
      delete target[key];
      continue;
    }
    if (plainObject(value)) {
      const current = Object.prototype.hasOwnProperty.call(target, key) ? target[key] : undefined;
      target[key] = mergePlainObjects(plainObject(current) ? current : {}, value);
      continue;
    }
    target[key] = structuredClone(value);
  }
  return target;
}

function unsafePatch(field, message) {
  return Object.assign(new Error(message), { code: 'unsafe_patch', field });
}

function bad(code, message, field, id) {
  return { ok: false, error: { code, message, field, ...(id ? { id } : {}) } };
}

function unknownKey(value, allowed, field, id) {
  const key = Object.keys(value).find((candidate) => !allowed.includes(candidate));
  return key ? bad('schema', `Unsupported field ${key}`, `${field}.${key}`, id) : null;
}
