/* ============================================================
   script.js – QP Editor Logic  (with Figures, Equations, Code)
   ============================================================ */

// ── HELPERS ────────────────────────────────────────────────
function uid() { return Math.random().toString(36).slice(2, 9); }
function val(id) { return document.getElementById(id)?.value || ''; }

// ── STATE ──────────────────────────────────────────────────
// Each question has:
//   text  - string (question text)
//   co    - string
//   btl   - string
// ── STATE ──────────────────────────────────────────────────
let parts = [
  {
    id: uid(), name: 'Part A',
    instruction: 'Answer <em>all</em> questions in one word or one sentence. Each question carries <strong>1 mark</strong>.',
    questions: [
      { id: uid(), text: 'What is the full form of HTML?', co: 'CO1', btl: 'R', blocks: [] },
      { id: uid(), text: 'Which tag is used to create a hyperlink?', co: 'CO1', btl: 'R', blocks: [] },
      { id: uid(), text: 'Define the purpose of CSS.', co: 'CO2', btl: 'U', blocks: [] },
    ]
  },
  {
    id: uid(), name: 'Part B',
    instruction: 'Answer <em>all</em> questions. Each question carries <strong>3 marks</strong>.',
    questions: [
      { id: uid(), text: 'Explain the difference between <div> and <span> tags.', co: 'CO2', btl: 'U', blocks: [] },
      { id: uid(), text: 'How do you center a <div> vertically and horizontally using Flexbox?', co: 'CO3', btl: 'A', blocks: [] },
      { id: uid(), text: 'Describe the various types of CSS selectors with examples.', co: 'CO2', btl: 'U', blocks: [] },
    ]
  },
  {
    id: uid(), name: 'Part C',
    instruction: 'Answer <em>ANY ONE</em> question. Each question carries <strong>7 marks</strong>.',
    questions: [
      { id: uid(), text: 'Create a simple responsive navigation bar using HTML and CSS.', co: 'CO3', btl: 'A', blocks: [] },
      { id: uid(), text: 'Explain the CSS Box Model with a neat diagram.', co: 'CO2', btl: 'U', blocks: [] },
    ]
  }
];

// ── PERSISTENCE ─────────────────────────────────────────────
const STORAGE_KEY = 'qp_editor_data';

function saveToStorage() {
  const data = {
    parts,
    header: {
      paperCode: val('paperCode'),
      examTitle1: val('examTitle1'),
      examTitle2: val('examTitle2'),
      examDate: val('examDate'),
      department: val('department'),
      subjectName: val('subjectName'),
      examTime: val('examTime'),
      maxMarks: val('maxMarks'),
      footerText: val('footerText')
    }
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function loadFromStorage() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    try {
      const data = JSON.parse(saved);
      if (data.parts) parts = data.parts;
      if (data.header) {
        Object.keys(data.header).forEach(id => {
          const el = document.getElementById(id);
          if (el) el.value = data.header[id];
        });
      }
    } catch (e) { console.error('Load error:', e); }
  }
}

function resetEditor() {
  if (confirm('Are you sure you want to clear all data and reset to defaults?')) {
    localStorage.removeItem(STORAGE_KEY);
    location.reload();
  }
}

function exportData() {
  const data = {
    parts,
    header: {
      paperCode: val('paperCode'),
      examTitle1: val('examTitle1'),
      examTitle2: val('examTitle2'),
      examDate: val('examDate'),
      department: val('department'),
      subjectName: val('subjectName'),
      examTime: val('examTime'),
      maxMarks: val('maxMarks'),
      footerText: val('footerText')
    }
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `qp-${val('paperCode') || 'export'}.json`;
  a.click();
  showToast('Paper exported! 📁');
}

function importData(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (evt) => {
    try {
      const data = JSON.parse(evt.target.result);
      if (data.parts && data.header) {
        parts = data.parts;
        Object.keys(data.header).forEach(id => {
          const el = document.getElementById(id);
          if (el) el.value = data.header[id];
        });
        saveToStorage();
        renderEditor();
        updatePreview();
        showToast('Paper imported! 📥');
      }
    } catch (err) {
      alert('Invalid JSON file.');
    }
  };
  reader.readAsText(file);
}

// ── QUESTION NUMBER ─────────────────────────────────────────
function getGlobalQuestionNumber(partIdx, qIdx) {
  let count = 1;
  for (let p = 0; p < partIdx; p++) count += parts[p].questions.length;
  return count + qIdx;
}

// ── RENDER BLOCK EDITOR HTML ────────────────────────────────
function blockEditorHtml(pid, qid, block) {
  const b = block;
  if (b.type === 'equation') {
    return `
      <div class="block-card block-equation" data-bid="${b.id}">
        <div class="block-header">
          <span class="block-tag eq-tag">📐 Equation</span>
          <div class="block-opts">
            <label class="inline-check"><input type="checkbox" class="eq-display" data-pid="${pid}" data-qid="${qid}" data-bid="${b.id}" ${b.display ? 'checked' : ''}/> Display</label>
            <button class="remove-block-btn" data-pid="${pid}" data-qid="${qid}" data-bid="${b.id}">✕</button>
          </div>
        </div>
        <div class="field-group" style="margin:0">
          <label>LaTeX (e.g. E = mc^2 or \\frac{a}{b})</label>
          <input type="text" class="eq-input" placeholder="E = mc^2" value="${escapeAttr(b.latex || '')}" data-pid="${pid}" data-qid="${qid}" data-bid="${b.id}" />
        </div>
      </div>`;
  }
  if (b.type === 'figure') {
    return `
      <div class="block-card block-figure" data-bid="${b.id}">
        <div class="block-header">
          <span class="block-tag fig-tag">🖼 Figure</span>
          <button class="remove-block-btn" data-pid="${pid}" data-qid="${qid}" data-bid="${b.id}">✕</button>
        </div>
        <div class="field-group" style="margin:0 0 6px">
          <label>Upload Image</label>
          <input type="file" accept="image/*" class="fig-upload" data-pid="${pid}" data-qid="${qid}" data-bid="${b.id}" />
        </div>
        ${b.src ? `<img src="${b.src}" class="fig-thumb" alt="figure" />` : ''}
        <div class="field-group" style="margin:6px 0 0">
          <label>Caption (optional)</label>
          <input type="text" class="fig-caption" placeholder="Fig 1: ..." value="${escapeAttr(b.caption || '')}" data-pid="${pid}" data-qid="${qid}" data-bid="${b.id}" />
        </div>
        <div class="inline-row" style="margin-top:6px">
          <div class="field-group" style="margin:0">
            <label>Width %</label>
            <input type="number" class="fig-width" min="10" max="100" value="${b.width || 60}" data-pid="${pid}" data-qid="${qid}" data-bid="${b.id}" />
          </div>
          <div class="field-group" style="margin:0">
            <label>Align</label>
            <select class="fig-align" data-pid="${pid}" data-qid="${qid}" data-bid="${b.id}">
              <option value="center" ${b.align === 'center' ? 'selected' : ''}>Center</option>
              <option value="left"   ${b.align === 'left' ? 'selected' : ''}>Left</option>
              <option value="right"  ${b.align === 'right' ? 'selected' : ''}>Right</option>
            </select>
          </div>
        </div>
      </div>`;
  }
  if (b.type === 'code') {
    return `
      <div class="block-card block-code" data-bid="${b.id}">
        <div class="block-header">
          <span class="block-tag code-tag">💻 Code</span>
          <button class="remove-block-btn" data-pid="${pid}" data-qid="${qid}" data-bid="${b.id}">✕</button>
        </div>
        <div class="field-group" style="margin:0">
          <label>Code / Pseudocode</label>
          <textarea rows="4" class="code-input" data-pid="${pid}" data-qid="${qid}" data-bid="${b.id}" style="font-family:monospace;font-size:0.78rem">${escapeHtml(b.code || '')}</textarea>
        </div>
      </div>`;
  }
  return '';
}

function escapeHtml(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function escapeAttr(str) {
  return String(str).replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

// ── RENDER EDITOR ──────────────────────────────────────────
function renderEditor() {
  const container = document.getElementById('partsContainer');
  const title = container.querySelector('.section-title');
  container.innerHTML = '';
  container.appendChild(title);

  parts.forEach((part, pIdx) => {
    const card = document.createElement('div');
    card.className = 'part-card';
    card.dataset.id = part.id;

    let qHtml = '';
    part.questions.forEach((q, qIdx) => {
      const globalN = getGlobalQuestionNumber(pIdx, qIdx);
      const blocksHtml = (q.blocks || []).map(b => blockEditorHtml(part.id, q.id, b)).join('');

      qHtml += `
        <div class="question-card" data-qid="${q.id}">
          <div class="question-row">
            <div class="qn-side">
              <span class="qn-number">${globalN}</span>
              <div class="qn-move-btns">
                <button class="qn-move-btn" data-qaction="moveup" data-pid="${part.id}" data-qid="${q.id}">↑</button>
                <button class="qn-move-btn" data-qaction="movedown" data-pid="${part.id}" data-qid="${q.id}">↓</button>
              </div>
            </div>
            <div class="question-fields">
              <div class="field-group">
                <label>Question Text</label>
                <textarea rows="2" data-field="text" data-pid="${part.id}" data-qid="${q.id}">${q.text}</textarea>
              </div>
              <div class="inline-row">
                <div class="field-group">
                  <label>CO</label>
                  <input type="text" value="${q.co}" data-field="co" data-pid="${part.id}" data-qid="${q.id}" />
                </div>
                <div class="field-group">
                  <label>BTL</label>
                  <input type="text" value="${q.btl}" data-field="btl" data-pid="${part.id}" data-qid="${q.id}" />
                </div>
              </div>
              <!-- Blocks (equations, figures, code) -->
              <div class="blocks-list" data-pid="${part.id}" data-qid="${q.id}">${blocksHtml}</div>
              <!-- Add block dropdown -->
              <div class="add-block-row">
                <span class="add-block-label">Insert:</span>
                <button class="add-block-btn eq-btn" data-pid="${part.id}" data-qid="${q.id}" data-btype="equation">📐 Equation</button>
                <button class="add-block-btn fig-btn" data-pid="${part.id}" data-qid="${q.id}" data-btype="figure">🖼 Figure</button>
                <button class="add-block-btn code-btn" data-pid="${part.id}" data-qid="${q.id}" data-btype="code">💻 Code</button>
              </div>
            </div>
            <button class="remove-q-btn" data-pid="${part.id}" data-qid="${q.id}" title="Remove question">✕</button>
          </div>
        </div>`;
    });

    card.innerHTML = `
      <div class="part-card-header">
        <span class="part-card-title">${part.name}</span>
        <div class="part-actions">
          ${pIdx > 0 ? `<button class="btn-icon" data-action="moveup" data-pid="${part.id}">↑</button>` : ''}
          ${pIdx < parts.length - 1 ? `<button class="btn-icon" data-action="movedown" data-pid="${part.id}">↓</button>` : ''}
          <button class="btn-icon danger" data-action="removepart" data-pid="${part.id}">🗑</button>
        </div>
      </div>
      <div class="field-group">
        <label>Part Name</label>
        <input type="text" value="${part.name}" data-field="partname" data-pid="${part.id}" />
      </div>
      <div class="field-group">
        <label>Instruction (HTML: &lt;em&gt;, &lt;strong&gt;)</label>
        <textarea rows="2" data-field="instruction" data-pid="${part.id}">${part.instruction}</textarea>
      </div>
      <div class="question-list">${qHtml}</div>
      <button class="add-q-btn" data-pid="${part.id}">+ Add Question</button>`;

    container.appendChild(card);
  });

  attachEditorEvents();
}

// ── EVENTS ─────────────────────────────────────────────────
function attachEditorEvents() {

  // Header text fields
  document.querySelectorAll('[data-field]').forEach(el => {
    el.addEventListener('input', onFieldChange);
  });

  // Add question
  document.querySelectorAll('.add-q-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const part = parts.find(p => p.id === btn.dataset.pid);
      if (part) {
        part.questions.push({ id: uid(), text: '', co: 'CO1', btl: 'U', blocks: [] });
        saveToStorage();
        renderEditor(); updatePreview();
      }
    });
  });

  // Question actions (up/down)
  document.querySelectorAll('[data-qaction]').forEach(btn => {
    btn.addEventListener('click', () => {
      const { qaction, pid, qid } = btn.dataset;
      const part = parts.find(p => p.id === pid);
      if (!part) return;
      const idx = part.questions.findIndex(q => q.id === qid);
      if (qaction === 'moveup' && idx > 0) {
        [part.questions[idx - 1], part.questions[idx]] = [part.questions[idx], part.questions[idx - 1]];
      } else if (qaction === 'movedown' && idx < part.questions.length - 1) {
        [part.questions[idx + 1], part.questions[idx]] = [part.questions[idx], part.questions[idx + 1]];
      }
      saveToStorage();
      renderEditor(); updatePreview();
    });
  });

  // Remove question
  document.querySelectorAll('.remove-q-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const part = parts.find(p => p.id === btn.dataset.pid);
      if (part) {
        part.questions = part.questions.filter(q => q.id !== btn.dataset.qid);
        saveToStorage();
        renderEditor(); updatePreview();
      }
    });
  });

  // Part actions
  document.querySelectorAll('[data-action]').forEach(btn => {
    btn.addEventListener('click', () => {
      const { action, pid } = btn.dataset;
      const idx = parts.findIndex(p => p.id === pid);
      if (action === 'removepart') {
        if (confirm('Remove this part?')) { parts.splice(idx, 1); saveToStorage(); renderEditor(); updatePreview(); }
      } else if (action === 'moveup' && idx > 0) {
        [parts[idx - 1], parts[idx]] = [parts[idx], parts[idx - 1]];
        saveToStorage(); renderEditor(); updatePreview();
      } else if (action === 'movedown' && idx < parts.length - 1) {
        [parts[idx + 1], parts[idx]] = [parts[idx], parts[idx + 1]];
        saveToStorage(); renderEditor(); updatePreview();
      }
    });
  });

  // ── ADD BLOCK ──
  document.querySelectorAll('.add-block-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const { pid, qid, btype } = btn.dataset;
      const q = getQuestion(pid, qid);
      if (!q) return;
      const block = { id: uid(), type: btype };
      if (btype === 'equation') { block.latex = ''; block.display = false; }
      if (btype === 'figure') { block.src = ''; block.caption = ''; block.width = 60; block.align = 'center'; }
      if (btype === 'code') { block.code = ''; }
      q.blocks.push(block);
      saveToStorage();
      renderEditor(); updatePreview();
    });
  });

  // ── REMOVE BLOCK ──
  document.querySelectorAll('.remove-block-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const { pid, qid, bid } = btn.dataset;
      const q = getQuestion(pid, qid);
      if (q) { q.blocks = q.blocks.filter(b => b.id !== bid); saveToStorage(); renderEditor(); updatePreview(); }
    });
  });

  // ── EQUATION inputs ──
  document.querySelectorAll('.eq-input').forEach(el => {
    el.addEventListener('input', () => {
      const b = getBlock(el.dataset.pid, el.dataset.qid, el.dataset.bid);
      if (b) { b.latex = el.value; updatePreview(); }
    });
  });
  document.querySelectorAll('.eq-display').forEach(el => {
    el.addEventListener('change', () => {
      const b = getBlock(el.dataset.pid, el.dataset.qid, el.dataset.bid);
      if (b) { b.display = el.checked; updatePreview(); }
    });
  });

  // ── FIGURE inputs ──
  document.querySelectorAll('.fig-upload').forEach(el => {
    el.addEventListener('change', () => {
      const file = el.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = e => {
        const b = getBlock(el.dataset.pid, el.dataset.qid, el.dataset.bid);
        if (b) { b.src = e.target.result; renderEditor(); updatePreview(); }
      };
      reader.readAsDataURL(file);
    });
  });
  document.querySelectorAll('.fig-caption').forEach(el => {
    el.addEventListener('input', () => {
      const b = getBlock(el.dataset.pid, el.dataset.qid, el.dataset.bid);
      if (b) { b.caption = el.value; updatePreview(); }
    });
  });
  document.querySelectorAll('.fig-width').forEach(el => {
    el.addEventListener('input', () => {
      const b = getBlock(el.dataset.pid, el.dataset.qid, el.dataset.bid);
      if (b) { b.width = parseInt(el.value) || 60; updatePreview(); }
    });
  });
  document.querySelectorAll('.fig-align').forEach(el => {
    el.addEventListener('change', () => {
      const b = getBlock(el.dataset.pid, el.dataset.qid, el.dataset.bid);
      if (b) { b.align = el.value; updatePreview(); }
    });
  });

  // ── CODE inputs ──
  document.querySelectorAll('.code-input').forEach(el => {
    el.addEventListener('input', () => {
      const b = getBlock(el.dataset.pid, el.dataset.qid, el.dataset.bid);
      if (b) { b.code = el.value; updatePreview(); }
    });
  });
}

function getQuestion(pid, qid) {
  const part = parts.find(p => p.id === pid);
  return part ? part.questions.find(q => q.id === qid) : null;
}
function getBlock(pid, qid, bid) {
  const q = getQuestion(pid, qid);
  return q ? (q.blocks || []).find(b => b.id === bid) : null;
}

function onFieldChange(e) {
  const el = e.target;
  const field = el.dataset.field;
  const pid = el.dataset.pid;
  const qid = el.dataset.qid;
  if (field === 'partname' || field === 'instruction') {
    const part = parts.find(p => p.id === pid);
    if (part) part[field === 'partname' ? 'name' : 'instruction'] = el.value;
  } else if (qid) {
    const q = getQuestion(pid, qid);
    if (q) q[field] = el.value;
  }
  saveToStorage();
  updatePreview();
}

// ── RENDER BLOCKS IN PREVIEW ────────────────────────────────
function renderBlocksPreview(blocks) {
  if (!blocks || !blocks.length) return '';
  return blocks.map(b => {
    if (b.type === 'equation') {
      const latex = b.display ? `$$${b.latex}$$` : `$${b.latex}$`;
      return `<div class="qp-eq ${b.display ? 'qp-eq-display' : 'qp-eq-inline'}">${latex}</div>`;
    }
    if (b.type === 'figure' && b.src) {
      const align = b.align || 'center';
      const width = b.width || 60;
      return `<div class="qp-figure" style="text-align:${align}">
        <img src="${b.src}" style="width:${width}%;max-width:100%;display:inline-block;" alt="${b.caption || 'figure'}" />
        ${b.caption ? `<div class="qp-fig-caption">${b.caption}</div>` : ''}
      </div>`;
    }
    if (b.type === 'code') {
      return `<pre class="qp-code">${escapeHtml(b.code)}</pre>`;
    }
    return '';
  }).join('');
}

// ── RENDER PREVIEW ─────────────────────────────────────────
function updatePreview() {
  const h = { paperCode: val('paperCode'), examTitle1: val('examTitle1'), examTitle2: val('examTitle2'), examDate: val('examDate'), department: val('department'), subjectName: val('subjectName'), examTime: val('examTime'), maxMarks: val('maxMarks'), footerText: val('footerText') };
  const preview = document.getElementById('a4Preview');
  let globalN = 1;
  let partsHtml = '';

  parts.forEach(part => {
    let rows = '';
    part.questions.forEach(q => {
      const blocksHtml = renderBlocksPreview(q.blocks);
      rows += `
        <tr>
          <td class="col-qn">${globalN++}</td>
          <td class="col-q">
            ${q.text.replace(/\n/g, '<br>')}
            ${blocksHtml}
          </td>
          <td class="col-co">${q.co}</td>
          <td class="col-btl">${q.btl}</td>
        </tr>`;
    });

    partsHtml += `
      <div class="qp-part-heading">
        <div class="ph-title">${part.name}</div>
        <div class="ph-instr">${part.instruction}</div>
      </div>
      <table class="qp-table">
        <thead><tr>
          <th class="col-qn">Qn</th>
          <th class="col-q">Question</th>
          <th class="col-co">CO</th>
          <th class="col-btl">BTL</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>`;
  });

  preview.innerHTML = `
    <div class="qp-meta-line"><strong>${h.paperCode}</strong></div>
    <div class="qp-roll-row">
      <span>Roll No :………………</span>
      <span>Signature:……………………………</span>
    </div>
    <div class="qp-class-row">Class :………………</div>

    <div class="qp-title-block">
      <div class="t1">${h.examTitle1}</div>
      <div class="t2">${h.examTitle2}</div>
      <div class="t3">${h.examDate}</div>
      <div class="dept">${h.department}</div>
      <div class="subj">${h.subjectName}</div>
      <div class="qp-timemark">
        <span>(Time: ${h.examTime})</span>
        <span>(Maximum Marks: ${h.maxMarks})</span>
      </div>
    </div>

    ${partsHtml}
    <div class="qp-footer">${h.footerText}</div>
  `;

  // Re-typeset MathJax after DOM update
  if (window.MathJax && window.MathJax.typesetPromise) {
    window.MathJax.typesetPromise([preview]).catch(err => console.warn('MathJax:', err));
  }
}

// ── ADD PART ───────────────────────────────────────────────
document.getElementById('addPartBtn').addEventListener('click', () => {
  const letter = String.fromCharCode(65 + parts.length);
  parts.push({
    id: uid(), name: `Part ${letter}`,
    instruction: 'Answer all questions.',
    questions: [{ id: uid(), text: '', co: 'CO1', btl: 'U', blocks: [] }]
  });
  saveToStorage();
  renderEditor(); updatePreview();
});

// ── DATA PERSISTENCE ACTIONS ──────────────────────────────
document.getElementById('resetBtn')?.addEventListener('click', resetEditor);
document.getElementById('exportBtn')?.addEventListener('click', exportData);
document.getElementById('importFile')?.addEventListener('change', importData);
document.getElementById('importBtn')?.addEventListener('click', () => document.getElementById('importFile').click());

// ── HEADER FIELD LIVE UPDATE ────────────────────────────────
['paperCode', 'examTitle1', 'examTitle2', 'examDate', 'department',
  'subjectName', 'examTime', 'maxMarks', 'footerText'].forEach(id => {
    document.getElementById(id)?.addEventListener('input', () => {
      saveToStorage();
      updatePreview();
    });
  });

// ── TOGGLE PANEL ───────────────────────────────────────────
document.getElementById('togglePanel').addEventListener('click', () => {
  const panel = document.getElementById('editorPanel');
  const btn = document.getElementById('togglePanel');
  panel.classList.toggle('collapsed');
  btn.textContent = panel.classList.contains('collapsed') ? '›' : '‹';
});

// ── PDF DOWNLOAD ───────────────────────────────────────────
function downloadPDF() {
  const element = document.getElementById('a4Preview');

  // Save original styles
  const origWidth = element.style.width;
  const origPadding = element.style.padding;
  const origBoxShadow = element.style.boxShadow;
  const origMinHeight = element.style.minHeight;

  // Temporarily apply print-friendly sizing so content is centred on A4
  element.style.width = '190mm';        // 210mm page − 10mm margin each side
  element.style.padding = '15mm 10mm 15mm 10mm';
  element.style.boxShadow = 'none';
  element.style.minHeight = 'auto';

  const opt = {
    margin: [10, 10, 10, 10],          // equal margins → centred
    filename: 'question-paper.pdf',
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true, letterRendering: true, allowTaint: true },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
    pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
  };

  showToast('Generating PDF…');
  html2pdf().set(opt).from(element).save().then(() => {
    // Restore original styles
    element.style.width = origWidth;
    element.style.padding = origPadding;
    element.style.boxShadow = origBoxShadow;
    element.style.minHeight = origMinHeight;
    showToast('PDF downloaded! ✔');
  });
}
document.getElementById('downloadBtn').addEventListener('click', downloadPDF);
document.getElementById('downloadBtnTop').addEventListener('click', downloadPDF);

// ── TOAST ──────────────────────────────────────────────────
function showToast(msg) {
  let t = document.querySelector('.toast');
  if (!t) { t = document.createElement('div'); t.className = 'toast'; document.body.appendChild(t); }
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('show'), 2600);
}

// ── PREVIEW BTN (mobile) ──────────────────────────────────
document.getElementById('previewBtn').addEventListener('click', () => {
  document.querySelector('.preview-viewport').scrollIntoView({ behavior: 'smooth' });
});

// ── INITIAL RENDER ─────────────────────────────────────────
document.getElementById('paperCode').value = 'WT (24)101 A';
document.getElementById('examTitle1').value = 'FIRST SEMESTER BACHELOR OF TECHNOLOGY';
document.getElementById('examTitle2').value = 'SESSIONAL EXAMINATION';
document.getElementById('examDate').value = 'MARCH 2026';
document.getElementById('department').value = 'Department of Information Technology';
document.getElementById('subjectName').value = 'WEB TECHNOLOGIES & DESIGN';
document.getElementById('examTime').value = '1.5 Hours';
document.getElementById('maxMarks').value = '50';

loadFromStorage();
renderEditor();
updatePreview();
