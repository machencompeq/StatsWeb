/* StatGrade AI — JS 模擬資料庫（localStorage）
   學生端提交批改後寫入，教師端讀取呈現；純前端展示用。
   紀錄欄位：id, student, sid, q, score(數字|null), max, conf(數字|null),
             status: graded|review|grading, time(YYYY-MM-DD HH:mm:ss),
             spdc:{S,P,D,C}|null, comment, reason(待複核原因|null), think:[{tag,cls,t}]|null */
(function () {
  var KEY = 'sgdb.v2';

  /* 陳小涵真實案例：卡方獨立性檢定（20 分制，資料取自實際批改管線） */
  var THINK_CHI = [
    { tag: '[RAG]',      cls: '',       t: '檢索題庫 chi_002 → 命中 rubric「Chi-square Test for Independence」（20 pts，SPDC 各 5）' },
    { tag: '[RAG]',      cls: '',       t: '載入 teacher prompt 與標準解答（2×2 列聯表：72 / 38 / 28 / 52，n=190）' },
    { tag: '[讀取]',     cls: 'dim',    t: 'OCR 作答載入：SPDC 四段齊全；α=0.05、χ²=17.24、df=1、臨界值 3.84146' },
    { tag: '[State]',    cls: 'dim',    t: 'A~E 逐項核對：目標／H₀／Ha／α／脈絡 皆正確 → 5 / 5' },
    { tag: '[Plan]',     cls: 'dim',    t: '卡方獨立性檢定 ✓；隨機性、10% 規則、期望次數 ≥ 5（min 37.89）皆已驗證 → 5 / 5' },
    { tag: '[CODE]',     cls: 'code',   t: 'scipy.stats.chi2_contingency([[72,38],[28,52]])：χ² = 17.2260，df = 1，p = 3.3e-05' },
    { tag: '[CODE]',     cls: 'code',   t: '期望次數 = [57.89, 52.11, 42.11, 37.89]；臨界值 χ²(0.05, 1) = 3.8415' },
    { tag: '[比對]',     cls: 'dim',    t: '學生 χ² = 17.24 ≈ 17.226（四捨五入差異，依 rubric 不扣分）；df、臨界值一致' },
    { tag: '[Do]',       cls: 'dim',    t: '公式、統計量、df、臨界值、逐格代入皆正確 → 5 / 5' },
    { tag: '[判讀]',     cls: 'dim',    t: '17.24 > 3.841 → 落入拒絕域，拒絕 H₀；方向正確' },
    { tag: '[Conclude]', cls: 'dim',    t: '比較、數值、判定、開頭語、脈絡結尾完整 → 5 / 5' },
    { tag: '[SCHEMA]',   cls: '',       t: '產出 Grading JSON：統計 20 / 20；英文學術寫作另評 18 / 20（CEFR B2）' },
    { tag: '[覆核]',     cls: 'review', t: '教授視角雙模型覆核（opus-4.8 ∥ sonnet-4.6）：無誤判，兩模型結論一致' },
    { tag: '[覆核]',     cls: 'review', t: 'confidence = 0.97 ≥ 門檻 0.85 → 通過，結果落庫' }
  ];

  var THINK_0142 = [
    { tag: '[RAG]',      cls: '',       t: '檢索題庫 ht_007 → 命中 rubric v2.3（假設檢定單元）' },
    { tag: '[RAG]',      cls: '',       t: '取得標準答案與配分：State 4 · Plan 4 · Do 4 · Conclude 4' },
    { tag: '[讀取]',     cls: 'dim',    t: '學生數據：n=36, x̄=4.6, s=1.5, α=0.05；右尾檢定' },
    { tag: '[State]',    cls: 'dim',    t: 'H₀: μ=4、H₁: μ>4 與標準答案一致 → 4 / 4' },
    { tag: '[Plan]',     cls: 'dim',    t: '偵測 one-sample t-test ✓；搜尋條件檢查敘述（隨機樣本 / n≥30 CLT）→ 未找到' },
    { tag: '[Plan]',     cls: 'warn',   t: '引用 rubric §2.1「未說明條件檢查者，扣 1 分」→ 3 / 4' },
    { tag: '[CODE]',     cls: 'code',   t: 'scipy.stats：t = (4.6−4)/(1.5/√36) = 2.4000，df = 35' },
    { tag: '[CODE]',     cls: 'code',   t: 'p = 1 − t.cdf(2.4, 35) = 0.0110；t*(0.05, 35) = 1.6896' },
    { tag: '[比對]',     cls: 'dim',    t: '學生 t=2.40 ✓ df=35 ✓ p≈0.011 ✓ 皆與驗算一致 → Do 4 / 4' },
    { tag: '[判讀]',     cls: 'dim',    t: 'p = 0.011 < α = 0.05 → 拒絕 H₀；學生結論方向正確' },
    { tag: '[Conclude]', cls: 'warn',   t: '結論未回扣題目脈絡（等待時間）→ 引用 §4.1 扣 1 → 3 / 4' },
    { tag: '[SCHEMA]',   cls: '',       t: '產出 Grading JSON：score 14 / 16，各維度判定與引用封裝完成' },
    { tag: '[覆核]',     cls: 'review', t: '教授視角雙模型覆核（opus-4.8 ∥ sonnet-4.6）：無「對判錯」/「錯判對」，兩模型結論一致' },
    { tag: '[覆核]',     cls: 'review', t: 'confidence = 0.93 ≥ 門檻 0.85 → 通過，結果落庫' }
  ];

  var SEED = [
    { id: 'sub_0118', student: '陳小涵', sid: '113408515', q: '卡方獨立性檢定', score: 20, max: 20, conf: 0.97,
      status: 'graded', time: '2026-06-09 14:32:11',
      spdc: { S: 5, P: 5, D: 5, C: 5 },
      comment: 'SPDC 框架完整、檢定選擇正確、條件驗證齊全、計算與結論皆正確（χ² = 17.24 ≈ 17.226，四捨五入差異依 rubric 不扣分）。統計 20 / 20；英文學術寫作 18 / 20（CEFR B2）。',
      reason: null, think: THINK_CHI },
    { id: 'sub_0142', student: '王伯涵', sid: 'B11208033', q: '題目一', score: 14, max: 16, conf: 0.93,
      status: 'graded', time: '2026-07-07 09:12:47',
      spdc: { S: 4, P: 3, D: 4, C: 3 },
      comment: '整體概念正確，計算無誤。扣分點：Plan 未檢查條件（隨機樣本、n ≥ 30 CLT）；Conclude 未回扣題目脈絡。',
      reason: null, think: THINK_0142 },
    { id: 'sub_0141', student: '李雅婷', sid: 'B11208017', q: '題目一', score: 11, max: 16, conf: 0.91,
      status: 'graded', time: '2026-07-07 09:03:15',
      spdc: { S: 3, P: 2, D: 4, C: 2 },
      comment: 'H₁ 方向書寫含糊扣 1；Plan 未選明檢定方法；結論未比較 p 與 α。計算部分正確。',
      reason: null, think: null },
    { id: 'sub_0140', student: '陳建宏', sid: 'B11208051', q: '題目二', score: 8, max: 16, conf: 0.61,
      status: 'review', time: '2026-07-07 08:47:02',
      spdc: { S: 3, P: 2, D: 2, C: 1 },
      comment: '（待人工複核，分數未定案）',
      reason: '學生使用 pooled variance，Rubric 未明確涵蓋此解法', think: null },
    { id: 'sub_0139', student: '林思妤', sid: 'B11208002', q: '題目一', score: 15, max: 16, conf: 0.95,
      status: 'graded', time: '2026-07-07 08:30:41',
      spdc: { S: 4, P: 4, D: 4, C: 3 },
      comment: '條件檢查完整、計算正確。僅結論未附信賴敘述扣 1，表現優異。',
      reason: null, think: null },
    { id: 'sub_0138', student: '張育誠', sid: 'B11208046', q: '題目三', score: 12, max: 16, conf: 0.88,
      status: 'graded', time: '2026-07-07 08:14:26',
      spdc: { S: 4, P: 3, D: 3, C: 2 },
      comment: '比例檢定架構正確；np ≥ 10 條件檢查缺漏、z 值四捨五入誤差，結論方向正確。',
      reason: null, think: null },
    { id: 'sub_0137', student: '黃冠宇', sid: 'B11208024', q: '題目二', score: null, max: 16, conf: null,
      status: 'grading', time: '2026-07-07 07:58:09',
      spdc: null, comment: '', reason: null, think: null },
    { id: 'sub_0136', student: '吳佩珊', sid: 'B11208039', q: '題目一', score: 13, max: 16, conf: 0.90,
      status: 'graded', time: '2026-07-07 07:41:53',
      spdc: { S: 4, P: 3, D: 4, C: 2 },
      comment: '計算正確；Plan 條件檢查不完整、結論未以題目脈絡陳述。',
      reason: null, think: null },
    { id: 'sub_0135', student: '劉承翰', sid: 'B11208010', q: '題目三', score: 6, max: 16, conf: 0.58,
      status: 'review', time: '2026-07-06 17:42:36',
      spdc: { S: 2, P: 2, D: 1, C: 1 },
      comment: '（待人工複核，分數未定案）',
      reason: '手寫符號辨識不確定（p̂ vs p）', think: null },
    { id: 'sub_0129', student: '蔡欣怡', sid: 'B11208027', q: '題目一', score: 10, max: 16, conf: 0.72,
      status: 'review', time: '2026-07-05 14:22:18',
      spdc: { S: 4, P: 3, D: 2, C: 1 },
      comment: '（待人工複核，分數未定案）',
      reason: '結論方向與計算矛盾，疑似筆誤', think: null }
  ];

  var STUDENTS = {
    '113408515': { name: '陳小涵', sid: '113408515', dept: '財務金融學系（NCUFN）', email: 'student@demo.statgrade.tw',
                   submitted: 1, avg: '20 / 20', best: 'State' },
    B11208033: { name: '王伯涵', sid: 'B11208033', dept: '統計學系', email: 'b11208033@demo.statgrade.tw',
                 submitted: 5, avg: '13.2 / 16', best: 'State' },
    B11208017: { name: '李雅婷', sid: 'B11208017', dept: '統計學系', email: 'b11208017@demo.statgrade.tw', submitted: 4, avg: '11.5 / 16', best: 'Do' },
    B11208051: { name: '陳建宏', sid: 'B11208051', dept: '統計學系', email: 'b11208051@demo.statgrade.tw', submitted: 5, avg: '9.0 / 16',  best: 'State' },
    B11208002: { name: '林思妤', sid: 'B11208002', dept: '統計學系', email: 'b11208002@demo.statgrade.tw', submitted: 5, avg: '14.4 / 16', best: 'Plan' },
    B11208046: { name: '張育誠', sid: 'B11208046', dept: '統計學系', email: 'b11208046@demo.statgrade.tw', submitted: 3, avg: '11.7 / 16', best: 'State' },
    B11208024: { name: '黃冠宇', sid: 'B11208024', dept: '統計學系', email: 'b11208024@demo.statgrade.tw', submitted: 4, avg: '10.8 / 16', best: 'Do' },
    B11208039: { name: '吳佩珊', sid: 'B11208039', dept: '統計學系', email: 'b11208039@demo.statgrade.tw', submitted: 5, avg: '12.6 / 16', best: 'Conclude' },
    B11208010: { name: '劉承翰', sid: 'B11208010', dept: '統計學系', email: 'b11208010@demo.statgrade.tw', submitted: 3, avg: '7.3 / 16',  best: 'State' },
    B11208027: { name: '蔡欣怡', sid: 'B11208027', dept: '統計學系', email: 'b11208027@demo.statgrade.tw', submitted: 4, avg: '11.0 / 16', best: 'Plan' }
  };

  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) { /* 損毀時重建 */ }
    localStorage.setItem(KEY, JSON.stringify(SEED));
    return JSON.parse(JSON.stringify(SEED));
  }
  function save(rows) { localStorage.setItem(KEY, JSON.stringify(rows)); }
  function pad(n) { return (n < 10 ? '0' : '') + n; }

  window.SGDB = {
    all: function () {
      return load().slice().sort(function (a, b) { return a.time < b.time ? 1 : -1; });
    },
    get: function (id) {
      var hit = null;
      load().forEach(function (r) { if (r.id === id) hit = r; });
      return hit;
    },
    add: function (rec) {
      var rows = load();
      rows.push(rec);
      save(rows);
      return rec;
    },
    nextId: function () {
      var maxN = 0;
      load().forEach(function (r) {
        var n = parseInt(r.id.replace('sub_', ''), 10);
        if (n > maxN) maxN = n;
      });
      var s = String(maxN + 1);
      while (s.length < 4) s = '0' + s;
      return 'sub_' + s;
    },
    now: function () {
      var d = new Date();
      return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + ' ' +
             pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds());
    },
    student: function (sid) { return STUDENTS[sid] || null; },
    reset: function () { localStorage.removeItem(KEY); }
  };
})();
