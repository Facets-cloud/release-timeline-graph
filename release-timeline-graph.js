class ReleaseTimelineGraph extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });

    this.projects = [];
    this.releases = [];
    this.selectedProject = null;
    this.selectedClusterId = null;
    this.totalPages = 0;
    this.totalElements = 0;
    this.currentPage = 0;
    this.pageSize = 100;

    this.render();
  }

  connectedCallback() {
    this.setupEventListeners();
    this.fetchProjects();
  }

  render() {
    this.shadowRoot.innerHTML = `
      <style>
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        :host {
          display: block;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          color: #333;
          --primary: #0077cc;
          --primary-dark: #005fa3;
          --border: #e0e0e0;
          --bg-light: #f8f9fa;
          --radius: 8px;
        }

        .container { padding: 1.5rem; }

        h2 {
          font-size: 1.2rem;
          font-weight: 700;
          color: #1a1a2e;
          margin-bottom: 1.25rem;
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        /* ── Filters ─────────────────────────────────────── */
        .filters {
          display: flex;
          flex-wrap: wrap;
          gap: 0.75rem;
          align-items: flex-end;
          margin-bottom: 1.5rem;
          padding: 1rem 1.25rem;
          background: var(--bg-light);
          border: 1px solid var(--border);
          border-radius: var(--radius);
        }

        .filter-group { display: flex; flex-direction: column; gap: 0.3rem; }

        label {
          font-size: 0.7rem;
          font-weight: 700;
          color: #666;
          text-transform: uppercase;
          letter-spacing: 0.6px;
        }

        select, input[type="date"] {
          height: 36px;
          padding: 0 0.75rem;
          border: 1px solid var(--border);
          border-radius: 6px;
          font-size: 0.85rem;
          background: white;
          color: #333;
          min-width: 170px;
          outline: none;
          transition: border-color 0.15s;
        }

        select:focus, input[type="date"]:focus { border-color: var(--primary); }
        select:disabled { background: #f0f0f0; color: #999; cursor: not-allowed; }

        .fetch-btn {
          height: 36px;
          padding: 0 1.25rem;
          background: var(--primary);
          color: white;
          border: none;
          border-radius: 6px;
          font-size: 0.85rem;
          font-weight: 600;
          cursor: pointer;
          white-space: nowrap;
          transition: background 0.15s;
          display: flex;
          align-items: center;
          gap: 0.4rem;
        }

        .fetch-btn:hover:not(:disabled) { background: var(--primary-dark); }
        .fetch-btn:disabled { background: #90caf9; cursor: not-allowed; }

        /* ── Alerts ──────────────────────────────────────── */
        .alert {
          padding: 0.75rem 1rem;
          border-radius: 6px;
          font-size: 0.85rem;
          margin-bottom: 1rem;
        }
        .alert-error  { background: #ffebee; color: #c62828; border: 1px solid #ef9a9a; }
        .alert-info   { background: #e3f2fd; color: #0277bd; border: 1px solid #90caf9; }

        /* ── Graph section ───────────────────────────────── */
        .card {
          background: white;
          border: 1px solid var(--border);
          border-radius: var(--radius);
          margin-bottom: 1.5rem;
          overflow: hidden;
        }

        .card-header {
          padding: 0.85rem 1.25rem;
          border-bottom: 1px solid var(--border);
          font-size: 0.88rem;
          font-weight: 700;
          color: #444;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .legend {
          display: flex;
          gap: 1rem;
          font-size: 0.75rem;
          color: #666;
          font-weight: 400;
        }

        .legend-item { display: flex; align-items: center; gap: 0.35rem; }
        .legend-dot {
          width: 10px; height: 10px; border-radius: 50%;
        }
        .legend-line {
          width: 20px; height: 2px;
          background: repeating-linear-gradient(to right, #ff9800 0, #ff9800 6px, transparent 6px, transparent 10px);
        }

        .graph-body { padding: 1rem 1.25rem 0.5rem; position: relative; }

        .empty-graph {
          display: flex;
          align-items: center;
          justify-content: center;
          height: 220px;
          color: #9e9e9e;
          font-size: 0.875rem;
        }

        svg.chart { display: block; width: 100%; }

        /* ── Tooltip ─────────────────────────────────────── */
        .tooltip {
          position: absolute;
          background: rgba(20, 20, 40, 0.93);
          color: white;
          padding: 0.65rem 0.9rem;
          border-radius: 6px;
          font-size: 0.78rem;
          line-height: 1.6;
          pointer-events: none;
          z-index: 200;
          max-width: 280px;
          box-shadow: 0 4px 16px rgba(0,0,0,0.2);
          opacity: 0;
          transition: opacity 0.1s;
        }
        .tooltip.show { opacity: 1; }
        .tip-title {
          font-weight: 700;
          font-size: 0.8rem;
          border-bottom: 1px solid rgba(255,255,255,0.15);
          padding-bottom: 0.3rem;
          margin-bottom: 0.35rem;
          white-space: nowrap;
        }
        .tip-row { display: flex; gap: 0.5rem; white-space: nowrap; }
        .tip-lbl { color: #90caf9; min-width: 80px; }
        .tip-val { color: white; font-weight: 600; }
        .tip-spike { color: #ff8a80; font-size: 0.72rem; margin-top: 0.35rem; }

        /* ── Table ───────────────────────────────────────── */
        .table-count { font-size: 0.78rem; color: #888; font-weight: 400; }

        .table-wrap { overflow-x: auto; }

        table { width: 100%; border-collapse: collapse; font-size: 0.84rem; min-width: 680px; }

        thead th {
          background: #f5f6f8;
          padding: 0.6rem 1rem;
          text-align: left;
          font-size: 0.72rem;
          font-weight: 700;
          color: #666;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          border-bottom: 1px solid var(--border);
          white-space: nowrap;
        }

        tbody td {
          padding: 0.7rem 1rem;
          border-bottom: 1px solid #f0f0f0;
          vertical-align: middle;
        }

        tbody tr:last-child td { border-bottom: none; }
        tbody tr:hover { background: #f9fafb; }

        .mono {
          font-family: 'SFMono-Regular', Consolas, 'Courier New', monospace;
          font-size: 0.76rem;
          background: #f0f4f8;
          color: #555;
          padding: 0.15rem 0.4rem;
          border-radius: 4px;
        }

        .badge {
          display: inline-block;
          padding: 0.18rem 0.55rem;
          border-radius: 12px;
          font-size: 0.7rem;
          font-weight: 700;
          letter-spacing: 0.3px;
          text-transform: uppercase;
          white-space: nowrap;
        }

        .s-SUCCEEDED       { background: #e8f5e9; color: #2e7d32; }
        .s-FAILED          { background: #ffebee; color: #c62828; }
        .s-FAULT           { background: #ffebee; color: #b71c1c; }
        .s-IN_PROGRESS     { background: #e3f2fd; color: #0277bd; }
        .s-STARTED         { background: #e8f5e9; color: #1b5e20; }
        .s-ABORTED         { background: #f5f5f5; color: #757575; }
        .s-TIMED_OUT       { background: #fff8e1; color: #e65100; }
        .s-QUEUED          { background: #e8eaf6; color: #3949ab; }
        .s-PENDING_APPROVAL{ background: #fff3e0; color: #e65100; }
        .s-REJECTED        { background: #ffebee; color: #880e4f; }
        .s-default         { background: #f5f5f5; color: #616161; }

        .type-badge {
          display: inline-block;
          padding: 0.18rem 0.55rem;
          border-radius: 4px;
          font-size: 0.72rem;
          font-weight: 600;
          background: #e8eaf6;
          color: #3949ab;
          white-space: nowrap;
        }

        .praxis-btn {
          display: inline-flex;
          align-items: center;
          gap: 0.3rem;
          padding: 0.28rem 0.7rem;
          color: var(--primary);
          border: 1px solid var(--primary);
          border-radius: 5px;
          font-size: 0.76rem;
          font-weight: 600;
          text-decoration: none;
          cursor: pointer;
          background: transparent;
          transition: all 0.15s;
          white-space: nowrap;
        }
        .praxis-btn:hover { background: var(--primary); color: white; }

        /* ── Pagination ──────────────────────────────────── */
        .pagination {
          display: flex;
          justify-content: center;
          align-items: center;
          gap: 1rem;
          padding: 0.75rem;
          border-top: 1px solid var(--border);
        }

        .page-btn {
          padding: 0.3rem 0.85rem;
          border: 1px solid var(--border);
          background: white;
          border-radius: 5px;
          font-size: 0.8rem;
          cursor: pointer;
        }
        .page-btn:hover:not(:disabled) { border-color: var(--primary); color: var(--primary); }
        .page-btn:disabled { color: #ccc; cursor: not-allowed; }
        .page-info { font-size: 0.8rem; color: #666; }

        /* ── Spinner ─────────────────────────────────────── */
        .spinner {
          width: 13px; height: 13px;
          border: 2px solid rgba(255,255,255,0.4);
          border-top-color: white;
          border-radius: 50%;
          animation: spin 0.65s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }
      </style>

      <div class="container">
        <h2>Release Timeline Graph</h2>

        <div class="filters">
          <div class="filter-group">
            <label>Project</label>
            <select id="project-select">
              <option value="">Loading projects…</option>
            </select>
          </div>
          <div class="filter-group">
            <label>Environment</label>
            <select id="env-select" disabled>
              <option value="">Select project first</option>
            </select>
          </div>
          <div class="filter-group">
            <label>Start Date</label>
            <input type="date" id="start-date" />
          </div>
          <div class="filter-group">
            <label>End Date</label>
            <input type="date" id="end-date" />
          </div>
          <button class="fetch-btn" id="fetch-btn" disabled>Fetch Releases</button>
        </div>

        <div id="alert" class="alert" style="display:none;"></div>

        <!-- Graph -->
        <div class="card" id="graph-card">
          <div class="card-header">
            Release Duration Over Time
            <div class="legend" id="legend" style="display:none;">
              <div class="legend-item">
                <div class="legend-dot" style="background:#0077cc;"></div> Release
              </div>
              <div class="legend-item">
                <div class="legend-dot" style="background:#f44336;"></div> Spike (&gt;1.5× avg)
              </div>
              <div class="legend-item">
                <div class="legend-line"></div> Average
              </div>
            </div>
          </div>
          <div class="graph-body" id="graph-body">
            <div class="empty-graph" id="empty-graph">
              Select a project, environment &amp; date range, then click Fetch Releases
            </div>
            <svg class="chart" id="chart" viewBox="0 0 900 300" style="display:none;" preserveAspectRatio="xMidYMid meet"></svg>
            <div class="tooltip" id="tooltip"></div>
          </div>
        </div>

        <!-- Table -->
        <div class="card" id="table-card" style="display:none;">
          <div class="card-header">
            Releases
            <span class="table-count" id="table-count"></span>
          </div>
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Release ID</th>
                  <th>Triggered By</th>
                  <th>Status</th>
                  <th>Release Type</th>
                  <th>Duration</th>
                  <th>Started At</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody id="table-body"></tbody>
            </table>
          </div>
          <div class="pagination" id="pagination" style="display:none;">
            <button class="page-btn" id="prev-btn" disabled>← Prev</button>
            <span class="page-info" id="page-info"></span>
            <button class="page-btn" id="next-btn" disabled>Next →</button>
          </div>
        </div>
      </div>
    `;
  }

  setupEventListeners() {
    this.shadowRoot.getElementById('project-select').addEventListener('change', () => this.onProjectChange());
    this.shadowRoot.getElementById('env-select').addEventListener('change', () => this.onEnvChange());
    this.shadowRoot.getElementById('fetch-btn').addEventListener('click', () => {
      this.currentPage = 0;
      this.fetchReleases();
    });
    this.shadowRoot.getElementById('prev-btn').addEventListener('click', () => {
      this.currentPage--;
      this.fetchReleases();
    });
    this.shadowRoot.getElementById('next-btn').addEventListener('click', () => {
      this.currentPage++;
      this.fetchReleases();
    });
  }

  // ── Data fetching ──────────────────────────────────────────────────────

  async fetchProjects() {
    try {
      const resp = await fetch('/cc-ui/v1/stacks/projects-with-running-environments');
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      const data = await resp.json();

      // Handle array or wrapper object
      const list = Array.isArray(data)
        ? data
        : (data.projects || data.stacks || data.content || []);

      this.projects = list;
      this.populateProjects();
    } catch (err) {
      this.showAlert('error', 'Could not load projects: ' + err.message);
      const sel = this.shadowRoot.getElementById('project-select');
      sel.innerHTML = '<option value="">Failed to load</option>';
    }
  }

  populateProjects() {
    const sel = this.shadowRoot.getElementById('project-select');
    sel.innerHTML = '<option value="">— Select Project —</option>';

    // Response shape: [{ stack: { name, label, ... }, runningEnvironments: [...] }]
    this.projects.forEach((p, i) => {
      const stack = p.stack || p;
      const name  = stack.name  || `project-${i}`;
      const label = stack.label || name;
      const opt   = document.createElement('option');
      opt.value   = i;
      opt.textContent = label !== name ? `${label} (${name})` : name;
      sel.appendChild(opt);
    });
  }

  onProjectChange() {
    const idx      = this.shadowRoot.getElementById('project-select').value;
    const envSel   = this.shadowRoot.getElementById('env-select');
    const fetchBtn = this.shadowRoot.getElementById('fetch-btn');

    if (idx === '') {
      this.selectedProject   = null;
      this.selectedClusterId = null;
      envSel.innerHTML = '<option value="">Select project first</option>';
      envSel.disabled  = true;
      fetchBtn.disabled = true;
      return;
    }

    this.selectedProject = this.projects[parseInt(idx, 10)];

    // Response shape: { stack: {...}, runningEnvironments: [{ clusterId, clusterName, ... }] }
    const envs = this.selectedProject.runningEnvironments || [];

    envSel.innerHTML = '<option value="">— Select Environment —</option>';
    envs.forEach(env => {
      const id   = env.clusterId || env.id;  // clusterId is the real cluster ID for the API
      const name = env.clusterName || id;
      if (!id) return;
      const opt = document.createElement('option');
      opt.value = id;
      opt.textContent = name;
      envSel.appendChild(opt);
    });

    envSel.disabled   = false;
    fetchBtn.disabled = true;
    this.selectedClusterId = null;
  }

  onEnvChange() {
    const val = this.shadowRoot.getElementById('env-select').value;
    this.selectedClusterId = val || null;
    this.shadowRoot.getElementById('fetch-btn').disabled = !this.selectedClusterId;
  }

  async fetchReleases() {
    if (!this.selectedClusterId) return;

    const btn       = this.shadowRoot.getElementById('fetch-btn');
    const startVal  = this.shadowRoot.getElementById('start-date').value;
    const endVal    = this.shadowRoot.getElementById('end-date').value;

    btn.disabled = true;
    btn.innerHTML = '<div class="spinner"></div> Fetching…';
    this.hideAlert();

    try {
      const params = new URLSearchParams({
        pageNumber: this.currentPage,
        pageSize:   this.pageSize,
      });

      if (startVal) {
        params.set('start', new Date(startVal + 'T00:00:00').toISOString());
      }
      if (endVal) {
        const e = new Date(endVal + 'T23:59:59');
        params.set('end', e.toISOString());
      }

      const resp = await fetch(
        `/cc-ui/v1/clusters/${this.selectedClusterId}/deployments/search?${params}`
      );
      if (!resp.ok) throw new Error('API error ' + resp.status);

      const data    = await resp.json();
      const content = data.content || [];

      this.releases      = content.map(item => this.parseDeployment(item));
      this.totalPages    = data.totalPages   || 1;
      this.totalElements = data.totalElements || content.length;

      this.renderGraph();
      this.renderTable();

    } catch (err) {
      this.showAlert('error', 'Failed to fetch releases: ' + err.message);
    } finally {
      btn.disabled    = false;
      btn.textContent = 'Fetch Releases';
    }
  }

  parseDeployment(item) {
    // searchDeployments returns PageVersionVersioned — the actual deployment
    // data may be at item level or nested under item.entity
    const dep = (item.entity && (item.entity.createdOn || item.entity.status))
      ? item.entity
      : item;

    return {
      id:                 dep.id        || item.id        || '',
      createdOn:          dep.createdOn || item.createdOn || null,
      finishedOn:         dep.finishedOn|| item.finishedOn|| null,
      timeTakenInSeconds: dep.timeTakenInSeconds != null
                            ? dep.timeTakenInSeconds
                            : item.timeTakenInSeconds,
      releaseType:        dep.releaseType  || item.releaseType  || 'UNKNOWN',
      status:             dep.status       || item.status       || 'UNKNOWN',
      triggeredBy:        dep.triggeredBy  || item.triggeredBy  || '',
      description:        dep.description  || item.description  || '',
    };
  }

  // ── Graph ──────────────────────────────────────────────────────────────

  renderGraph() {
    const svg       = this.shadowRoot.getElementById('chart');
    const empty     = this.shadowRoot.getElementById('empty-graph');
    const legend    = this.shadowRoot.getElementById('legend');

    // Only plot releases that have time data
    const valid = this.releases
      .filter(r => r.timeTakenInSeconds != null && r.createdOn)
      .sort((a, b) => new Date(a.createdOn) - new Date(b.createdOn));

    if (valid.length === 0) {
      svg.style.display   = 'none';
      empty.style.display = 'flex';
      empty.textContent   = 'No release data with timing information for the selected range.';
      legend.style.display = 'none';
      return;
    }

    empty.style.display  = 'none';
    svg.style.display    = 'block';
    legend.style.display = 'flex';

    const VW = 900, VH = 300;
    const pad = { top: 28, right: 80, bottom: 56, left: 68 };
    const W   = VW - pad.left - pad.right;
    const H   = VH - pad.top  - pad.bottom;

    const minutes = valid.map(r => r.timeTakenInSeconds / 60);
    const avg     = minutes.reduce((a, b) => a + b, 0) / minutes.length;
    const maxVal  = Math.max(...minutes) * 1.12;
    const minVal  = 0;

    const xOf = i  => pad.left + (valid.length === 1 ? W / 2 : (i / (valid.length - 1)) * W);
    const yOf = v  => pad.top  + H - ((v - minVal) / (maxVal - minVal || 1)) * H;

    const NS = 'http://www.w3.org/2000/svg';
    svg.innerHTML = '';

    const mk = tag => document.createElementNS(NS, tag);
    const set = (el, attrs) => { Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v)); return el; };
    const ap  = el => { svg.appendChild(el); return el; };

    // ── Grid lines & Y-axis labels
    const yTicks = 5;
    for (let i = 0; i <= yTicks; i++) {
      const val = minVal + (maxVal - minVal) * (i / yTicks);
      const y   = yOf(val);

      ap(set(mk('line'), { x1: pad.left, x2: pad.left + W, y1: y, y2: y,
        stroke: i === 0 ? '#bbb' : '#eeeff2', 'stroke-width': 1 }));

      const label = val >= 60 ? `${(val / 60).toFixed(1)}h` : `${Math.round(val)}m`;
      const t = ap(set(mk('text'), { x: pad.left - 8, y: y + 4,
        'text-anchor': 'end', 'font-size': 11, fill: '#999' }));
      t.textContent = label;
    }

    // ── Y-axis title
    const yTitle = ap(set(mk('text'), {
      x: -(pad.top + H / 2), y: 14,
      transform: 'rotate(-90)',
      'text-anchor': 'middle', 'font-size': 11, fill: '#aaa'
    }));
    yTitle.textContent = 'Duration (minutes)';

    // ── Area fill
    const areaPoints =
      `${xOf(0)},${pad.top + H} ` +
      valid.map((_, i) => `${xOf(i)},${yOf(minutes[i])}`).join(' ') +
      ` ${xOf(valid.length - 1)},${pad.top + H}`;
    ap(set(mk('polygon'), { points: areaPoints, fill: 'rgba(0,119,204,0.07)' }));

    // ── Line
    const linePoints = valid.map((_, i) => `${xOf(i)},${yOf(minutes[i])}`).join(' ');
    ap(set(mk('polyline'), {
      points: linePoints, fill: 'none',
      stroke: '#0077cc', 'stroke-width': 2.2, 'stroke-linejoin': 'round'
    }));

    // ── Average line
    const avgY = yOf(avg);
    ap(set(mk('line'), {
      x1: pad.left, x2: pad.left + W, y1: avgY, y2: avgY,
      stroke: '#ff9800', 'stroke-width': 1.8, 'stroke-dasharray': '7,4'
    }));
    const avgTxt = ap(set(mk('text'), {
      x: pad.left + W + 4, y: avgY + 4,
      'font-size': 10, fill: '#ff9800', 'font-weight': 600
    }));
    avgTxt.textContent = `Avg: ${avg >= 60 ? (avg / 60).toFixed(1) + 'h' : Math.round(avg) + 'm'}`;

    // ── X-axis labels (max 9)
    const labelStep = Math.max(1, Math.floor(valid.length / 9));
    valid.forEach((r, i) => {
      if (i % labelStep !== 0 && i !== valid.length - 1) return;
      const x   = xOf(i);
      const d   = new Date(r.createdOn);
      const lbl = `${d.getMonth()+1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2,'0')}`;

      ap(set(mk('line'), { x1: x, x2: x, y1: pad.top + H, y2: pad.top + H + 4,
        stroke: '#ccc', 'stroke-width': 1 }));

      const xt = ap(set(mk('text'), {
        x, y: pad.top + H + 15,
        'text-anchor': 'middle', 'font-size': 10, fill: '#aaa'
      }));
      xt.textContent = lbl;
    });

    // ── Data points
    const tooltip    = this.shadowRoot.getElementById('tooltip');
    const graphBody  = this.shadowRoot.getElementById('graph-body');

    valid.forEach((r, i) => {
      const cx      = xOf(i);
      const cy      = yOf(minutes[i]);
      const isSpike = minutes[i] > avg * 1.5;

      const durStr = minutes[i] >= 60
        ? `${(minutes[i] / 60).toFixed(2)} hrs`
        : `${Math.round(minutes[i])} min`;

      // Spike glow
      if (isSpike) {
        ap(set(mk('circle'), { cx, cy, r: 11, fill: 'rgba(244,67,54,0.18)' }));
      }

      // Visible dot
      ap(set(mk('circle'), {
        cx, cy, r: 5.5,
        fill:   isSpike ? '#f44336' : '#0077cc',
        stroke: 'white', 'stroke-width': 2
      }));

      // Invisible large hit area
      const hit = ap(set(mk('circle'), { cx, cy, r: 14, fill: 'transparent', style: 'cursor:pointer' }));

      const showTip = (e) => {
        const rect = graphBody.getBoundingClientRect();
        let tx = e.clientX - rect.left + 14;
        let ty = e.clientY - rect.top  - 14;

        const shortId = r.id ? r.id.substring(0, 8) + '…' : 'Release';

        tooltip.innerHTML = `
          <div class="tip-title">${shortId}</div>
          <div class="tip-row"><span class="tip-lbl">Duration</span><span class="tip-val">${durStr}</span></div>
          <div class="tip-row"><span class="tip-lbl">Status</span><span class="tip-val">${r.status}</span></div>
          <div class="tip-row"><span class="tip-lbl">Type</span><span class="tip-val">${r.releaseType}</span></div>
          <div class="tip-row"><span class="tip-lbl">Triggered</span><span class="tip-val">${r.triggeredBy || '—'}</span></div>
          <div class="tip-row"><span class="tip-lbl">Started</span><span class="tip-val">${new Date(r.createdOn).toLocaleString()}</span></div>
          ${r.finishedOn ? `<div class="tip-row"><span class="tip-lbl">Finished</span><span class="tip-val">${new Date(r.finishedOn).toLocaleString()}</span></div>` : ''}
          ${isSpike ? '<div class="tip-spike">⚠ Spike — exceeds 1.5× average</div>' : ''}
        `;

        // Keep tooltip inside graph body
        tooltip.style.left = tx + 'px';
        tooltip.style.top  = ty + 'px';
        tooltip.classList.add('show');
      };

      hit.addEventListener('mouseenter', showTip);
      hit.addEventListener('mousemove',  showTip);
      hit.addEventListener('mouseleave', () => tooltip.classList.remove('show'));
    });
  }

  // ── Table ──────────────────────────────────────────────────────────────

  renderTable() {
    const card      = this.shadowRoot.getElementById('table-card');
    const tbody     = this.shadowRoot.getElementById('table-body');
    const count     = this.shadowRoot.getElementById('table-count');
    const pagination= this.shadowRoot.getElementById('pagination');
    const prevBtn   = this.shadowRoot.getElementById('prev-btn');
    const nextBtn   = this.shadowRoot.getElementById('next-btn');
    const pageInfo  = this.shadowRoot.getElementById('page-info');

    card.style.display = 'block';
    count.textContent  = `${this.totalElements.toLocaleString()} release${this.totalElements !== 1 ? 's' : ''} total`;
    tbody.innerHTML    = '';

    if (this.releases.length === 0) {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td colspan="7" style="text-align:center;color:#9e9e9e;padding:2rem;">
        No releases found for the selected filters.
      </td>`;
      tbody.appendChild(tr);
      pagination.style.display = 'none';
      return;
    }

    this.releases.forEach(r => {
      const duration = r.timeTakenInSeconds != null
        ? (r.timeTakenInSeconds >= 3600
            ? `${(r.timeTakenInSeconds / 3600).toFixed(1)} h`
            : `${Math.round(r.timeTakenInSeconds / 60)} min`)
        : '—';

      const startedAt = r.createdOn ? new Date(r.createdOn).toLocaleString() : '—';

      const statusKey = r.status || 'default';
      const knownStatuses = ['SUCCEEDED','FAILED','FAULT','IN_PROGRESS','STARTED',
        'ABORTED','TIMED_OUT','QUEUED','PENDING_APPROVAL','REJECTED'];
      const statusClass = knownStatuses.includes(statusKey) ? `s-${statusKey}` : 's-default';

      const shortId = r.id ? r.id.substring(0, 12) : 'N/A';

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><span class="mono" title="${r.id}">${shortId}</span></td>
        <td>${r.triggeredBy || '—'}</td>
        <td><span class="badge ${statusClass}">${r.status}</span></td>
        <td><span class="type-badge">${r.releaseType}</span></td>
        <td>${duration}</td>
        <td>${startedAt}</td>
        <td>
          <a class="praxis-btn" href="/ui/ai/agent/praxis/session/" target="_blank">
            Open in Praxis →
          </a>
        </td>
      `;
      tbody.appendChild(tr);
    });

    // Pagination
    if (this.totalPages > 1) {
      pagination.style.display = 'flex';
      prevBtn.disabled = this.currentPage === 0;
      nextBtn.disabled = this.currentPage >= this.totalPages - 1;
      pageInfo.textContent = `Page ${this.currentPage + 1} of ${this.totalPages}`;
    } else {
      pagination.style.display = 'none';
    }
  }

  // ── Helpers ────────────────────────────────────────────────────────────

  showAlert(type, msg) {
    const el = this.shadowRoot.getElementById('alert');
    el.className     = `alert alert-${type}`;
    el.textContent   = msg;
    el.style.display = 'block';
  }

  hideAlert() {
    this.shadowRoot.getElementById('alert').style.display = 'none';
  }
}

customElements.define('release-timeline-graph', ReleaseTimelineGraph);
