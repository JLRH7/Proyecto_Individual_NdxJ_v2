// ═══════════════════════════════════════════════════════════
//  ui.js — Capa dinámica: canvas, DOM, interacciones, CSS
//  Depende de graph.js (Graph). No contiene lógica de grafo.
// ═══════════════════════════════════════════════════════════

(() => {

  // ── Referencias DOM ───────────────────────────────────────
  const canvas      = document.getElementById('canvas');
  const ctx         = canvas.getContext('2d');
  const stepsEl     = document.getElementById('steps');
  const tableEl     = document.getElementById('table');
  const nodeCountEl = document.getElementById('node-count');
  const edgeCountEl = document.getElementById('edge-count');
  const modeEl      = document.getElementById('mode-indicator');
  const hintEl      = document.getElementById('canvas-hint');
  const btnRun      = document.getElementById('btn-run');

  // ── Estado de UI ─────────────────────────────────────────
  let mode     = 'add';
  let selected = null;   // nodo seleccionado en modo edge

  // ── Paleta visual ─────────────────────────────────────────
  const COLOR = {
    nodeDefault:       '#3a3a3a',
    nodeStroke:        '#606060',
    nodeActive:        '#d4d4d4',
    nodeActiveStroke:  '#ffffff',
    nodeVisited:       '#555555',
    nodeVisitedStroke: '#888888',
    nodeSelected:      '#888888',
    nodeSelectedStroke:'#cccccc',
    labelId:           '#f0f0f0',
    labelDist:         '#888888',
    edgeDefaultStroke: '#404040',
    edgePath:          '#cc2222',
    edgeWeight:        '#666666',
  };

  // ── Conectar callbacks con Graph ──────────────────────────
  Graph.setCallbacks({
    onUpdate: () => { draw(); updateCounts(); },
    onStep:   addStep,
    onTable:  updateTable,
    onFinish: () => setRunButtonActive(true),
  });

  // ── Gestión de modo activo ────────────────────────────────
  function setMode(m) {
    mode     = m;
    selected = null;

    document.querySelectorAll('.btn-mode').forEach(b => b.classList.remove('active'));

    const map = { add: 'btn-add', edge: 'btn-edge', delete: 'btn-delete' };
    if (map[m]) document.getElementById(map[m]).classList.add('active');

    const labels = { add: 'CREAR NODO', edge: 'CONECTAR', delete: 'ELIMINAR' };
    modeEl.innerHTML = `MODO: <strong>${labels[m] || m.toUpperCase()}</strong>`;

    // CSS dinámico: cursor del canvas según modo
    const cursors = { add: 'crosshair', edge: 'pointer', delete: 'not-allowed' };
    canvas.style.cursor = cursors[m] || 'crosshair';

    draw();
  }

  // ── Botón Ejecutar: estado activo/bloqueado ────────────────
  function setRunButtonActive(active) {
    if (active) {
      btnRun.classList.remove('btn-ghost');
      btnRun.style.opacity = '';
      btnRun.disabled = false;
    } else {
      btnRun.classList.add('btn-ghost');
      btnRun.style.opacity = '0.4';
      btnRun.disabled = true;
    }
  }

  // ── Contadores status bar ─────────────────────────────────
  function updateCounts() {
    const nodes = Graph.getNodes();
    const edges = Graph.getEdges();
    nodeCountEl.textContent = `Nodos: ${nodes.length}`;
    edgeCountEl.textContent = `Aristas: ${edges.length}`;

    // Oculta/muestra hint del canvas
    hintEl.style.opacity = nodes.length === 0 ? '1' : '0';
  }

  // ── Click en canvas ───────────────────────────────────────
  canvas.onclick = (e) => {
    if (Graph.isRunning()) return;

    const r = canvas.getBoundingClientRect();
    const x = e.clientX - r.left;
    const y = e.clientY - r.top;
    const n = Graph.findNodeAt(x, y);

    if (mode === 'add' && !n) {
      Graph.addNode(x, y);
    }
    else if (mode === 'delete' && n) {
      Graph.deleteNode(n);
    }
    else if (mode === 'edge' && n) {
      if (!selected) {
        selected = n;
        draw();   // dibuja el anillo de selección
      } else {
        if (selected !== n) {
          const w = parseInt(prompt('Peso de la arista:', 1));
          Graph.addEdge(selected, n, w);
        }
        selected = null;
        draw();
      }
    }
  };

  // ── Dibujo del grafo ──────────────────────────────────────
  function draw() {
    const nodes = Graph.getNodes();
    const edges = Graph.getEdges();

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Grid sutil de fondo
    ctx.strokeStyle = 'rgba(255,255,255,0.025)';
    ctx.lineWidth   = 1;
    for (let x = 0; x < canvas.width; x += 40) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
    }
    for (let y = 0; y < canvas.height; y += 40) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
    }

    // ── Aristas ──
    edges.forEach(e => {
      const isPath = e.use;

      if (isPath) { ctx.shadowColor = COLOR.edgePath; ctx.shadowBlur = 8; }

      ctx.strokeStyle = isPath ? COLOR.edgePath : COLOR.edgeDefaultStroke;
      ctx.lineWidth   = isPath ? 2.5 : 1.5;
      ctx.setLineDash(isPath ? [] : [4, 4]);
      ctx.beginPath();
      ctx.moveTo(e.from.x, e.from.y);
      ctx.lineTo(e.to.x, e.to.y);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.shadowBlur = 0;

      // Peso
      const mx = (e.from.x + e.to.x) / 2;
      const my = (e.from.y + e.to.y) / 2;
      ctx.font      = 'bold 11px JetBrains Mono, monospace';
      ctx.fillStyle = isPath ? '#dd3333' : COLOR.edgeWeight;
      ctx.fillText(e.weight, mx + 4, my - 4);
    });

    // ── Nodos ──
    nodes.forEach(n => {
      const isSel = (selected === n);
      let fill, stroke, shadowC = 'transparent', shadowB = 0;

      if (n.active) {
        fill = COLOR.nodeActive; stroke = COLOR.nodeActiveStroke;
        shadowC = 'rgba(255,255,255,0.3)'; shadowB = 14;
      } else if (n.visited) {
        fill = COLOR.nodeVisited; stroke = COLOR.nodeVisitedStroke;
      } else if (isSel) {
        fill = COLOR.nodeSelected; stroke = COLOR.nodeSelectedStroke;
        shadowC = 'rgba(255,255,255,0.15)'; shadowB = 10;
      } else {
        fill = COLOR.nodeDefault; stroke = COLOR.nodeStroke;
      }

      ctx.shadowColor = shadowC;
      ctx.shadowBlur  = shadowB;

      ctx.beginPath();
      ctx.arc(n.x, n.y, 20, 0, Math.PI * 2);
      ctx.fillStyle   = fill;
      ctx.fill();
      ctx.strokeStyle = stroke;
      ctx.lineWidth   = (isSel || n.active) ? 2.5 : 1.5;
      ctx.stroke();
      ctx.shadowBlur  = 0;

      // ID
      ctx.font         = 'bold 13px JetBrains Mono, monospace';
      ctx.fillStyle    = n.active ? '#111' : COLOR.labelId;
      ctx.textAlign    = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(n.id, n.x, n.y);

      // Distancia
      ctx.font      = '10px JetBrains Mono, monospace';
      ctx.fillStyle = n.active ? '#cc2222' : COLOR.labelDist;
      ctx.fillText(n.dist, n.x, n.y + 34);

      ctx.textAlign    = 'left';
      ctx.textBaseline = 'alphabetic';
    });

    // Anillo punteado para el nodo seleccionado en modo edge
    if (selected && mode === 'edge') {
      ctx.beginPath();
      ctx.arc(selected.x, selected.y, 28, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255,255,255,0.2)';
      ctx.lineWidth   = 1;
      ctx.setLineDash([3, 3]);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  // ── Tabla de distancias ───────────────────────────────────
  function updateTable(dist, visited) {
    tableEl.innerHTML = '';
    Graph.getNodes().forEach(n => {
      const d = dist[n.id] === Infinity ? '∞' : dist[n.id];
      const v = visited[n.id] ? '✔' : '—';
      tableEl.innerHTML += `<tr>
        <td>${n.id}</td>
        <td>${d}</td>
        <td style="color:${visited[n.id] ? '#aaa' : '#444'}">${v}</td>
      </tr>`;
    });
  }

  // ── Log de pasos ──────────────────────────────────────────
  function addStep(txt, type = '') {
    const p = document.createElement('p');
    p.textContent = txt;
    if (type) p.classList.add(`step-${type}`);
    stepsEl.appendChild(p);
    stepsEl.scrollTop = stepsEl.scrollHeight;
  }

  // ── Acciones expuestas al HTML (onclick) ──────────────────
  window.setMode = setMode;

  window.resetGraph = () => {
    if (Graph.isRunning()) return;
    Graph.reset();
    stepsEl.innerHTML  = '';
    tableEl.innerHTML  = '';
    selected           = null;
    updateCounts();
    draw();
  };

  window.clearSteps = () => { stepsEl.innerHTML = ''; };

  window.runDijkstra = async () => {
    if (Graph.isRunning() || Graph.getNodes().length === 0) return;
    const start = parseInt(prompt('Nodo inicial (0 – ' + (Graph.getNodes().length - 1) + '):'));
    if (isNaN(start)) return;
    stepsEl.innerHTML = '';
    setRunButtonActive(false);
    await Graph.runDijkstra(start);
  };

  // ── Init ──────────────────────────────────────────────────
  setMode('add');
  draw();

})();