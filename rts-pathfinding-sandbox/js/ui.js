// UI — wires DOM events to the Simulator

(function () {
  let sim;
  let currentAlgo = '';
  let placeMode   = 'start';  // 'start' | 'goal'
  let lastElapsed = null;

  function init() {
    const canvas = document.getElementById('canvas');
    sim = new Simulator(canvas);

    // Populate algorithm selector
    const sel = document.getElementById('algoSelect');
    PathfinderRegistry.getAll().forEach((pf, i) => {
      const opt       = document.createElement('option');
      opt.value       = pf.name;
      opt.textContent = pf.name;
      sel.appendChild(opt);
    });
    currentAlgo = PathfinderRegistry.getAll()[0]?.name || '';
    sel.value   = currentAlgo;
    updateAlgoDesc();

    sel.addEventListener('change', () => {
      currentAlgo = sel.value;
      updateAlgoDesc();
    });

    // Map controls
    const obstacleSlider = document.getElementById('numObstacles');
    const obstacleVal    = document.getElementById('obstacleVal');
    obstacleSlider.addEventListener('input', () => { obstacleVal.textContent = obstacleSlider.value; });

    document.getElementById('btnGenerate').addEventListener('click', () => {
      const n    = parseInt(obstacleSlider.value);
      const seed = document.getElementById('seed').value.trim();
      sim.generateMap(n, seed !== '' ? parseInt(seed) : null);
      updateStats();
    });

    // Pathfinding
    document.getElementById('btnRun').addEventListener('click', () => {
      const info = sim.runPathfinder(currentAlgo);
      lastElapsed = info?.elapsed ?? null;
      updateStats();
    });

    // Animation controls
    document.getElementById('btnPlay').addEventListener('click',  () => sim.play());
    document.getElementById('btnPause').addEventListener('click', () => sim.pause());
    document.getElementById('btnReset').addEventListener('click', () => sim.resetAnim());

    const speedSlider = document.getElementById('speed');
    speedSlider.addEventListener('input', () => {
      sim.settings.speed = speedToPixels(parseInt(speedSlider.value));
    });

    // Display toggles
    document.getElementById('chkExplored').addEventListener('change', e => {
      sim.settings.showExplored = e.target.checked;
    });
    document.getElementById('chkPath').addEventListener('change', e => {
      sim.settings.showPath = e.target.checked;
    });
    document.getElementById('chkTree').addEventListener('change', e => {
      sim.settings.showTree = e.target.checked;
    });

    // Placement mode buttons
    document.querySelectorAll('.placeBtn').forEach(btn => {
      btn.addEventListener('click', () => {
        placeMode = btn.dataset.mode;
        document.querySelectorAll('.placeBtn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      });
    });

    // Canvas click — place start or goal
    canvas.addEventListener('click', e => {
      const rect = canvas.getBoundingClientRect();
      const p = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      if (placeMode === 'start') sim.setStart(p);
      else                       sim.setGoal(p);
      updateStats();
    });

    // Resize
    let resizeTimer;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        // Regenerate with same settings on resize
        const n    = parseInt(obstacleSlider.value);
        const seed = document.getElementById('seed').value.trim();
        sim.generateMap(n, seed !== '' ? parseInt(seed) : null);
        updateStats();
      }, 250);
    });

    // Initial map
    sim.generateMap(parseInt(obstacleSlider.value), null);
    updateStats();
  }

  function updateAlgoDesc() {
    const pf   = PathfinderRegistry.getByName(currentAlgo);
    const desc = document.getElementById('algoDesc');
    desc.textContent = pf?.description || '';
  }

  function updateStats() {
    const stats   = sim.getStats(currentAlgo);
    const el      = document.getElementById('statsContent');
    const lines   = [];

    if (stats.status)        lines.push(`Status: ${stats.status}`);
    if (stats.pathLength != null) lines.push(`Length: ${stats.pathLength.toFixed(1)} px`);
    if (stats.waypoints  != null) lines.push(`Waypoints: ${stats.waypoints}`);
    if (stats.explored   != null) lines.push(`Explored: ${stats.explored} nodes`);
    if (lastElapsed      != null) lines.push(`Computed: ${lastElapsed.toFixed(1)} ms`);

    el.innerHTML = lines.map(l => `<div>${l}</div>`).join('');
  }

  // Map slider value [1–10] to pixels/second
  function speedToPixels(v) { return 40 + (v - 1) * 40; }  // 40 – 400 px/s

  document.addEventListener('DOMContentLoaded', init);
})();
