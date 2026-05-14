// ═══════════════════════════════════════════════════════════
//  graph.js — Lógica del grafo y algoritmo de Dijkstra
//  Sin dependencias de DOM/canvas. Solo datos y algoritmo.
// ═══════════════════════════════════════════════════════════

const Graph = (() => {

  // ── Estado del grafo ──────────────────────────────────────
  let nodes   = [];
  let edges   = [];
  let running = false;

  // ── Callbacks hacia la UI (inyectados desde ui.js) ────────
  let _onUpdate   = () => {};   // se llama tras cualquier mutación
  let _onStep     = () => {};   // log de paso
  let _onTable    = () => {};   // actualizar tabla de distancias
  let _onFinish   = () => {};   // algoritmo terminó

  // ── API pública ───────────────────────────────────────────
  function setCallbacks({ onUpdate, onStep, onTable, onFinish }) {
    if (onUpdate) _onUpdate = onUpdate;
    if (onStep)   _onStep   = onStep;
    if (onTable)  _onTable  = onTable;
    if (onFinish) _onFinish = onFinish;
  }

  // ── Nodos ─────────────────────────────────────────────────
  function addNode(x, y) {
    if (running) return null;
    const node = { x, y, id: nodes.length, dist: '∞', visited: false, active: false };
    nodes.push(node);
    _onUpdate();
    return node;
  }

  function deleteNode(node) {
    if (running) return;
    nodes = nodes.filter(n => n !== node);
    edges = edges.filter(e => e.from !== node && e.to !== node);
    nodes.forEach((n, i) => n.id = i);
    _onUpdate();
  }

  function findNodeAt(x, y, radius = 22) {
    return nodes.find(n => Math.hypot(n.x - x, n.y - y) < radius) || null;
  }

  // ── Aristas ───────────────────────────────────────────────
  function addEdge(fromNode, toNode, weight) {
    if (running) return false;
    if (fromNode === toNode) return false;
    if (isNaN(weight) || weight <= 0) return false;
    edges.push({ from: fromNode, to: toNode, weight, use: false });
    _onUpdate();
    return true;
  }

  // ── Reset ─────────────────────────────────────────────────
  function reset() {
    if (running) return;
    nodes   = [];
    edges   = [];
    _onUpdate();
  }

  // ── Resetea estados visuales sin borrar el grafo ──────────
  function resetVisualState() {
    nodes.forEach(n => {
      n.dist    = '∞';
      n.visited = false;
      n.active  = false;
    });
    edges.forEach(e => e.use = false);
  }

  // ── Getters (inmutables para la UI) ───────────────────────
  function getNodes()   { return nodes; }
  function getEdges()   { return edges; }
  function isRunning()  { return running; }

  // ── Dijkstra ──────────────────────────────────────────────
  async function runDijkstra(startId) {
    if (running || nodes.length === 0) return;
    if (isNaN(startId) || startId < 0 || startId >= nodes.length) return;

    running = true;

    resetVisualState();
    const dist    = {};
    const visited = {};

    nodes.forEach(n => dist[n.id] = Infinity);
    dist[startId]       = 0;
    nodes[startId].dist = 0;

    _onUpdate();
    _onTable(dist, visited);

    for (let i = 0; i < nodes.length; i++) {
      // Nodo no visitado con menor distancia
      const u = Object.keys(dist)
        .filter(id => !visited[id])
        .reduce((a, b) => dist[a] < dist[b] ? a : b);

      visited[u] = true;
      const node = nodes[u];
      node.active = true;

      _onStep('▶ Visitando nodo ' + u, 'visit');
      _onUpdate();
      _onTable(dist, visited);
      await sleep(700);

      // Relaxación de aristas
      edges.forEach(e => {
        if (e.from.id == u && !visited[e.to.id]) {
          const alt = dist[u] + e.weight;
          if (alt < dist[e.to.id]) {
            dist[e.to.id] = alt;
            e.to.dist      = alt;
            e.use          = true;
            _onStep(`  ↳ Actualiza nodo ${e.to.id} → ${alt}`, 'update');
          }
        }
      });

      node.active  = false;
      node.visited = true;
      _onUpdate();
      _onTable(dist, visited);
      await sleep(500);
    }

    _onStep('✔ Dijkstra completado.', 'visit');
    running = false;
    _onFinish();
  }

  // ── Utilidad ──────────────────────────────────────────────
  function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

  // ── Export ────────────────────────────────────────────────
  return {
    setCallbacks,
    addNode,
    deleteNode,
    findNodeAt,
    addEdge,
    reset,
    getNodes,
    getEdges,
    isRunning,
    runDijkstra,
  };

})();