// ═══════════════════════════════════════════════════════════
//  graph.js — Lógica del grafo y algoritmo de Dijkstra
//  Sin dependencias de DOM/canvas. Solo datos y algoritmo.
//
//  TIPO DE GRAFO:
//  ┌─ Dirigido   → las aristas tienen dirección (A→B ≠ B→A)
//  ├─ Ponderado  → cada arista tiene un peso numérico positivo
//  ├─ No es árbol → puede tener ciclos y aristas libres
//  └─ No binario → un nodo puede conectarse con N vecinos
// ═══════════════════════════════════════════════════════════

const Graph = (() => {

  // ┌─────────────────────────────────────────────────────────┐
  // │  BLOQUE 1 — ESTADO INTERNO DEL GRAFO                   │
  // │  Aquí viven los datos. Nada más accede a esto          │
  // │  directamente desde fuera.                             │
  // └─────────────────────────────────────────────────────────┘
  let nodes   = [];       // Lista de nodos: { id, x, y, dist, visited, active }
  let edges   = [];       // Lista de aristas: { from, to, weight, use }
  let running = false;    // Bloquea edición mientras Dijkstra corre

  // ┌─────────────────────────────────────────────────────────┐
  // │  BLOQUE 2 — CALLBACKS (PUENTE HACIA LA UI)             │
  // │  graph.js no sabe nada de pantallas ni canvas.        │
  // │  Avisa a quien le escuche cuando algo cambia.         │
  // │  ui.js inyecta estas funciones al inicio.             │
  // └─────────────────────────────────────────────────────────┘
  let _onUpdate = () => {};   // Redibujar el canvas
  let _onStep   = () => {};   // Agregar línea al log paso a paso
  let _onTable  = () => {};   // Actualizar tabla de distancias
  let _onFinish = () => {};   // Desbloquear botones al terminar

  // ── API pública ───────────────────────────────────────────
  function setCallbacks({ onUpdate, onStep, onTable, onFinish }) {
    if (onUpdate) _onUpdate = onUpdate;
    if (onStep)   _onStep   = onStep;
    if (onTable)  _onTable  = onTable;
    if (onFinish) _onFinish = onFinish;
  }

  // ┌─────────────────────────────────────────────────────────┐
  // │  BLOQUE 3 — GESTIÓN DE NODOS                           │
  // │  Crear, eliminar y buscar nodos en el grafo.           │
  // │  Al eliminar se reasignan los IDs para mantener        │
  // │  la secuencia 0, 1, 2... sin huecos.                   │
  // └─────────────────────────────────────────────────────────┘
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

  // ┌─────────────────────────────────────────────────────────┐
  // │  BLOQUE 4 — GESTIÓN DE ARISTAS                         │
  // │  Conecta dos nodos con un peso.                        │
  // │  La arista es DIRIGIDA: solo va de fromNode → toNode.  │
  // │  Rechaza pesos negativos o cero (Dijkstra lo requiere).│
  // └─────────────────────────────────────────────────────────┘
  function addEdge(fromNode, toNode, weight) {
    if (running) return false;
    if (fromNode === toNode) return false;
    if (isNaN(weight) || weight <= 0) return false;
    edges.push({ from: fromNode, to: toNode, weight, use: false });
    _onUpdate();
    return true;
  }

  // ┌─────────────────────────────────────────────────────────┐
  // │  BLOQUE 5 — RESET                                      │
  // │  Dos niveles de limpieza:                              │
  // │  · reset()            → borra todo el grafo            │
  // │  · resetVisualState() → solo limpia colores/distancias │
  // │    para correr Dijkstra de nuevo sin borrar los nodos. │
  // └─────────────────────────────────────────────────────────┘
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

  // ┌─────────────────────────────────────────────────────────┐
  // │  BLOQUE 6 — GETTERS (API hacia la UI)                  │
  // │  La UI solo puede leer el estado, nunca modificarlo   │
  // │  directamente. Toda mutación pasa por las funciones   │
  // │  anteriores. Esto evita estados inconsistentes.       │
  // └─────────────────────────────────────────────────────────┘
  function getNodes()   { return nodes; }
  function getEdges()   { return edges; }
  function isRunning()  { return running; }

  // ┌─────────────────────────────────────────────────────────┐
  // │  BLOQUE 7 — ALGORITMO DE DIJKSTRA                      │
  // │                                                         │
  // │  Idea central en 3 pasos:                              │
  // │  1. Todos los nodos empiezan con distancia ∞           │
  // │     excepto el nodo inicial que vale 0.                │
  // │  2. En cada iteración tomamos el nodo no visitado      │
  // │     con menor distancia conocida.                      │
  // │  3. Revisamos sus vecinos: si llegar por aquí es       │
  // │     más barato, actualizamos su distancia.             │
  // │     Eso se llama RELAXACIÓN de aristas.                │
  // │                                                         │
  // │  Es async para pausar con await sleep() y que         │
  // │  la animación sea visible paso a paso.                 │
  // └─────────────────────────────────────────────────────────┘
  async function runDijkstra(startId) {
    if (running || nodes.length === 0) return;
    if (isNaN(startId) || startId < 0 || startId >= nodes.length) return;

    running = true;

    resetVisualState();
    const dist    = {};
    const visited = {};

    // PASO 1 — Inicialización: todos en ∞, el inicio en 0
    nodes.forEach(n => dist[n.id] = Infinity);
    dist[startId]       = 0;
    nodes[startId].dist = 0;

    _onUpdate();
    _onTable(dist, visited);

    for (let i = 0; i < nodes.length; i++) {
      // PASO 2 — Selección: nodo no visitado con menor distancia
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

      // PASO 3 — Relaxación: ¿es más barato llegar al vecino pasando por u?
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

  // ┌─────────────────────────────────────────────────────────┐
  // │  BLOQUE 8 — UTILIDAD Y EXPORT                          │
  // │  sleep() pausa la ejecución async sin bloquear         │
  // │  el hilo principal del navegador.                      │
  // │  El return final es lo único visible desde fuera:     │
  // │  todo lo demás queda encapsulado dentro del módulo.   │
  // └─────────────────────────────────────────────────────────┘
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