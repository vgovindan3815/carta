/**
 * Embedded prototype dataset — used as fallback when no DB is configured.
 * Mirrors the PROGRAMS object from the prototype index.html exactly.
 */
import type { ProgramData } from './parser/types';

export const PROGRAMS: Record<string, ProgramData> = {
  GTMSETL0: {
    name: 'GTMSETL0',
    language: 'COBOL',
    loc: 847,
    domain: 'Settlement / GTM',
    desc: 'Settlement cutoff calculation — determines and broadcasts the daily transaction cutoff timestamp that governs all GTM payment flows.',
    chips: [
      { label: 'Lang', val: 'COBOL' },
      { label: 'LOC', val: '847' },
      { label: 'Domain', val: 'Settlement / GTM' },
      { label: 'Status', val: 'Active' },
    ],
    overviewQuery: 'What breaks if I change the settlement cutoff?',
    overviewNarrative:
      'Changing the settlement cutoff in <strong>GTMSETL0</strong> directly affects <strong>5 programs and data stores</strong>. Posting (<strong class="font-mono">GTMPOST1</strong>) and validation (<strong class="font-mono">GTMVALD2</strong>) consume the cutoff timestamp via direct CALL; the CICS transaction <strong class="font-mono">GTMCICS4</strong> reads the broadcast result at runtime. Downstream, the general ledger feed and the DB2 control table inherit any structural change. One Assembler dependency (GTMASM01 via GTMVALD2) is partially analysed — verify manually.',
    overviewEdges: [
      'CAST edge: GTMSETL0 → GTMPOST1 (CALL, static)',
      'CAST edge: GTMSETL0 → GTMVALD2 (CALL, static)',
      'CAST edge: GTMCICS4 → SETL_CTRL (runtime read, indirect)',
    ],
    cLayout: {
      w: 580,
      h: 468,
      nodes: [
        { id: 'GTMSETL0', label: 'GTMSETL0', sub: 'in focus',    type: 'hero', cx: 290, cy: 220, r: 44 },
        { id: 'GTMCICS4', label: 'GTMCICS4', sub: 'CICS caller',  type: 'prog', cx: 290, cy: 75,  r: 30 },
        { id: 'GTMPOST1', label: 'GTMPOST1', sub: 'posting',      type: 'prog', cx: 120, cy: 325, r: 30 },
        { id: 'GTMVALD2', label: 'GTMVALD2', sub: 'validation',   type: 'prog', cx: 440, cy: 305, r: 30 },
        { id: 'GLEDGER',  label: 'GLEDGER',  sub: 'data feed',    type: 'data', cx: 58,  cy: 425, r: 24 },
        { id: 'SETLCTRL', label: 'SETL_CTRL', sub: 'DB2 control', type: 'data', cx: 270, cy: 435, r: 24 },
        { id: 'GTMDB2IO', label: 'GTMDB2IO', sub: 'DB2 module',   type: 'prog', cx: 460, cy: 415, r: 26 },
        { id: 'GTMASM01', label: 'GTMASM01', sub: 'ASM · 71%',    type: 'asm',  cx: 535, cy: 305, r: 23 },
      ],
      edges: [
        { from: 'GTMCICS4', to: 'GTMSETL0', type: 'cics' },
        { from: 'GTMSETL0', to: 'GTMPOST1', type: 'call' },
        { from: 'GTMSETL0', to: 'GTMVALD2', type: 'call' },
        { from: 'GTMSETL0', to: 'SETLCTRL', type: 'data' },
        { from: 'GTMPOST1', to: 'GLEDGER',  type: 'data' },
        { from: 'GTMVALD2', to: 'GTMDB2IO', type: 'call' },
        { from: 'GTMVALD2', to: 'GTMASM01', type: 'dyn' },
        { from: 'GTMDB2IO', to: 'SETLCTRL', type: 'data' },
      ],
    },
    graph: {
      title: 'GTMSETL0 — Call &amp; Data Graph',
      nodes: [
        { id: 'GTMCICS4', label: 'GTMCICS4', sub: 'CICS Online Transaction',    type: 'prog', x: 310, y: 28,  w: 160, h: 56 },
        { id: 'GTMSETL0', label: 'GTMSETL0', sub: 'Settlement Cutoff · HERO',  type: 'hero', x: 310, y: 183, w: 160, h: 60 },
        { id: 'GTMPOST1', label: 'GTMPOST1', sub: 'Transaction Posting',         type: 'prog', x: 55,  y: 343, w: 150, h: 56 },
        { id: 'GTMVALD2', label: 'GTMVALD2', sub: 'Pre-cutoff Validation',       type: 'prog', x: 615, y: 343, w: 150, h: 56 },
        { id: 'GTMDB2IO', label: 'GTMDB2IO', sub: 'DB2 Access Module',           type: 'prog', x: 700, y: 453, w: 150, h: 52 },
        { id: 'GTMASM01', label: 'GTMASM01', sub: 'Assembler Utility (71%)',     type: 'asm',  x: 540, y: 453, w: 145, h: 52 },
        { id: 'GLEDGER',  label: 'GLEDGER',  sub: 'General Ledger Feed',         type: 'data', x: 30,  y: 453, w: 150, h: 52 },
        { id: 'SETLCTRL', label: 'SETL_CTRL', sub: 'DB2 · Settlement Control',  type: 'data', x: 250, y: 453, w: 170, h: 52 },
      ],
      edges: [
        { from: 'GTMCICS4', to: 'GTMSETL0', type: 'cics', label: 'reads cutoff at runtime',  fd: 'bottom', td: 'top' },
        { from: 'GTMSETL0', to: 'GTMPOST1', type: 'call', label: 'CALL — cutoff timestamp',  fd: 'bl',     td: 'top' },
        { from: 'GTMSETL0', to: 'GTMVALD2', type: 'call', label: 'CALL — validate pending',  fd: 'br',     td: 'top' },
        { from: 'GTMSETL0', to: 'SETLCTRL', type: 'data', label: 'EXEC SQL SELECT',          fd: 'bottom', td: 'top' },
        { from: 'GTMPOST1', to: 'GLEDGER',  type: 'data', label: 'WRITE — GLEDGER feed',     fd: 'bottom', td: 'top' },
        { from: 'GTMVALD2', to: 'GTMDB2IO', type: 'call', label: 'CALL — cursor ops',        fd: 'bottom', td: 'top' },
        { from: 'GTMVALD2', to: 'GTMASM01', type: 'dyn',  label: 'DYNAMIC CALL (71%)',       fd: 'bl',     td: 'top' },
        { from: 'GTMDB2IO', to: 'SETLCTRL', type: 'data', label: 'READ/WRITE — table owner', fd: 'left',   td: 'right' },
      ],
    },
    businessRules: [
      {
        section: 'Purpose & Scope',
        rules: [
          {
            text: 'GTMSETL0 is the <strong>authoritative source of the daily settlement cutoff timestamp</strong> for all Global Transaction Management (GTM) payment flows. Its output determines which transactions are included in today\'s settlement run — any transaction timestamped after the broadcast cutoff is deferred to the next business day.',
            citations: [],
          },
          {
            text: 'The program runs once per business day during the end-of-day window. It reads the configured cutoff parameters from DB2, validates all pending transactions, triggers posting, then broadcasts the confirmed cutoff to the shared control table.',
            citations: [{ label: 'SETL_CTRL (DB2 READ)', edge: 'GTMSETL0 → SETL_CTRL' }],
          },
        ],
      },
      {
        section: 'Cutoff Time Rules',
        rules: [
          {
            text: 'The standard settlement cutoff is <strong>17:00 ET</strong>, stored in SETL_CTRL as CUTOFF_TIME. A UTC_OFFSET column adjusts for timezone differences when MAVEN is run from non-New York infrastructure.',
            citations: [{ label: 'SETL_CTRL.CUTOFF_TIME', edge: 'GTMSETL0 → SETL_CTRL SELECT' }],
          },
          {
            text: 'If OVERRIDE_FLAG = \'Y\' in SETL_CTRL (set by settlement operations), the program substitutes the OVERRIDE_TIME value. This mechanism handles emergency cutoff extensions approved by treasury.',
            citations: [{ label: 'SETL_CTRL.OVERRIDE_FLAG', edge: 'GTMSETL0 → SETL_CTRL SELECT' }],
          },
          {
            text: 'On bank holidays (HOLIDAY_FLAG = \'Y\'), the program suppresses the settlement run and sets STATUS_CODE = \'HOLIDAY_SKIP\'. GTMCICS4 reads this status at runtime to display the correct message to online users.',
            citations: [
              { label: 'SETL_CTRL.HOLIDAY_FLAG', edge: 'GTMSETL0 → SETL_CTRL SELECT' },
              { label: 'GTMCICS4 reads status', edge: 'GTMCICS4 → GTMSETL0' },
            ],
          },
        ],
      },
      {
        section: 'Validation Gate (Pre-posting)',
        rules: [
          {
            text: 'Before any posting occurs, GTMSETL0 calls <strong>GTMVALD2</strong> with the computed cutoff timestamp. GTMVALD2 validates all pending transactions. If any transaction fails (VALD2-FAIL-COUNT &gt; 0), the entire settlement run is held — posting does not proceed.',
            citations: [{ label: 'CALL GTMVALD2', edge: 'GTMSETL0 → GTMVALD2' }],
          },
          {
            text: 'GTMVALD2 in turn uses <strong>GTMDB2IO</strong> for all DB2 cursor operations, and dynamically calls <strong>GTMASM01</strong> for packed-byte flag inspection. The GTMASM01 dependency is partially resolved (71%) — if its bit-field contract changes, downstream effects may not be fully detectable by automated analysis.',
            citations: [
              { label: 'CALL GTMDB2IO', edge: 'GTMVALD2 → GTMDB2IO' },
              { label: 'DYNAMIC CALL GTMASM01', edge: 'GTMVALD2 → GTMASM01 (71%)' },
            ],
          },
        ],
      },
      {
        section: 'Posting & Broadcast',
        rules: [
          {
            text: 'Once validation passes, GTMSETL0 calls <strong>GTMPOST1</strong>, passing the confirmed cutoff timestamp and region code. GTMPOST1 selects all transactions with TRANS_TS ≤ cutoff and writes them to the GLEDGER sequential feed. A non-zero return code halts the broadcast.',
            citations: [{ label: 'CALL GTMPOST1', edge: 'GTMSETL0 → GTMPOST1' }],
          },
          {
            text: 'After successful posting, GTMSETL0 writes the computed cutoff back to SETL_CTRL — setting COMPUTED_CUTOFF_TS and STATUS_CODE = \'BROADCAST\'. This is the signal that GTMCICS4 polls at online-transaction time to confirm today\'s cutoff is final.',
            citations: [
              { label: 'EXEC SQL UPDATE SETL_CTRL', edge: 'GTMSETL0 → SETL_CTRL UPDATE' },
              { label: 'GTMCICS4 reads COMPUTED_CUTOFF_TS', edge: 'GTMCICS4 → GTMSETL0' },
            ],
          },
        ],
      },
    ],
    changeImpact: {
      query: 'What breaks if <strong class="font-mono">GTMSETL0</strong> changes?',
      coverage: 91,
      coverageNote: 'Coverage 91% — GTMASM01 (dynamic call via GTMVALD2) partially analysed. Verify manually.',
      items: [
        {
          prog: 'GTMPOST1',
          rel: 'Direct callee (CALL)',
          severity: 'critical',
          reason: 'Receives cutoff timestamp via WS-POST1-PARM. Any change to parameter structure, data type, or timestamp format in GTMSETL0 will break the posting run — GTMPOST1 may read the wrong cutoff boundary or fail to start.',
          edge: 'GTMSETL0 → GTMPOST1 (CALL)',
        },
        {
          prog: 'GTMVALD2',
          rel: 'Direct callee (CALL)',
          severity: 'critical',
          reason: 'Called synchronously before posting. The interface contract (WS-VALD2-PARM: cutoff timestamp + region code + return counters) must remain stable. A parameter or calling-convention change will stall or mis-gate the settlement run.',
          edge: 'GTMSETL0 → GTMVALD2 (CALL)',
        },
        {
          prog: 'GTMCICS4',
          rel: 'Runtime reader (CICS)',
          severity: 'high',
          reason: 'Queries COMPUTED_CUTOFF_TS from SETL_CTRL at online-transaction time, relying on GTMSETL0 having set STATUS_CODE = \'BROADCAST\'. A change to the broadcast update logic could leave GTMCICS4 reading a stale or absent cutoff.',
          edge: 'GTMCICS4 → SETL_CTRL (reads COMPUTED_CUTOFF_TS set by GTMSETL0)',
        },
        {
          prog: 'GTMDB2IO',
          rel: 'Indirect (via GTMVALD2)',
          severity: 'medium',
          reason: 'Owns all I/O to SETL_CTRL. A schema change to SETL_CTRL driven by a GTMSETL0 requirement propagates directly to GTMDB2IO\'s SELECT and cursor definitions — and since GTMDB2IO is shared, the impact extends to any other caller.',
          edge: 'GTMVALD2 → GTMDB2IO (CALL) → SETL_CTRL (READ/WRITE)',
        },
        {
          prog: 'GTMASM01',
          rel: 'Dynamic call (partial · via GTMVALD2)',
          severity: 'unknown',
          reason: 'Called dynamically by GTMVALD2 for bit-field manipulation. Static analysis resolved this edge at 71% confidence. If a GTMSETL0 change modifies the validation logic path that invokes GTMASM01, its contract may break in ways this analysis cannot fully predict.',
          edge: 'GTMVALD2 → GTMASM01 (DYNAMIC CALL · 71% coverage)',
        },
      ],
    },
    spec: {
      title: 'Modernization Specification — GTMSETL0',
      subtitle: 'Target: Java Spring Boot microservice · Settlement Cutoff Service',
      sections: [
        {
          num: 1,
          title: 'Service Overview',
          content: `<p style="margin-bottom:12px;font-size:14px;">GTMSETL0 maps to a <strong>SettlementCutoffService</strong> Spring Boot microservice within the GTM domain. It exposes a synchronous REST endpoint invoked once per business day by the settlement scheduler, and a read endpoint for the online CICS replacement.</p><div class="code-block"><span class="code-kw">@Service</span>
<span class="code-kw">public class</span> <span class="code-type">SettlementCutoffService</span> {
  <span class="code-cmt">// Orchestrates: load params → validate → post → broadcast</span>
  <span class="code-kw">public</span> <span class="code-type">CutoffResult</span> calculateAndBroadcast(<span class="code-type">CutoffRequest</span> request);
  <span class="code-cmt">// Read-only — for online query (replaces GTMCICS4 runtime read)</span>
  <span class="code-kw">public</span> <span class="code-type">Optional&lt;CutoffStatus&gt;</span> getCurrentCutoff(<span class="code-type">String</span> regionId);
}</div>`,
        },
        {
          num: 2,
          title: 'Interface Contracts',
          content: `<table class="spec-table"><thead><tr><th>COBOL Interface</th><th>Java Equivalent</th><th>Notes</th></tr></thead><tbody><tr><td>LS-PARM (LINKAGE)</td><td>CutoffRequest record</td><td>regionId, forceFlag → Boolean</td></tr><tr><td>WS-POST1-PARM → GTMPOST1</td><td>PostingServiceClient.post(CutoffEvent)</td><td>Async event or REST — TBD per §5 OQ1</td></tr><tr><td>WS-VALD2-PARM → GTMVALD2</td><td>ValidationServiceClient.validate(CutoffRequest)</td><td>Returns ValidationResult with failCount</td></tr><tr><td>SETL_CTRL READ</td><td>CutoffControlRepository.findActive(regionId, date)</td><td>JPA entity — see §4</td></tr><tr><td>SETL_CTRL UPDATE (BROADCAST)</td><td>CutoffControlRepository.setBroadcast(regionId, ts)</td><td>Transactional; must match GTMCICS4 read path</td></tr></tbody></table>`,
        },
        {
          num: 3,
          title: 'Business Logic to Preserve',
          content: `<ul style="list-style:none;display:flex;flex-direction:column;gap:8px;font-size:13px;"><li style="display:flex;gap:10px;"><span style="color:var(--success);font-weight:700;">✓</span>Standard cutoff 17:00 ET from SETL_CTRL.CUTOFF_TIME; UTC offset applied</li><li style="display:flex;gap:10px;"><span style="color:var(--success);font-weight:700;">✓</span>Manual override path: OVERRIDE_FLAG = 'Y' → use OVERRIDE_TIME (treasury emergency path)</li><li style="display:flex;gap:10px;"><span style="color:var(--success);font-weight:700;">✓</span>Holiday suppression: HOLIDAY_FLAG = 'Y' → skip run, set STATUS = HOLIDAY_SKIP</li><li style="display:flex;gap:10px;"><span style="color:var(--success);font-weight:700;">✓</span>Hard gate: validation must return failCount = 0 before posting is triggered</li><li style="display:flex;gap:10px;"><span style="color:var(--success);font-weight:700;">✓</span>Broadcast update (COMPUTED_CUTOFF_TS + STATUS = BROADCAST) after successful post — must be atomic</li><li style="display:flex;gap:10px;"><span style="color:var(--warning);font-weight:700;">⚠</span>Retry logic (MAX_RETRY = 3, delay 500ms on DB2 failure) — map to Spring Retry with same semantics</li></ul>`,
        },
        {
          num: 4,
          title: 'Data Layer — DB2 → JPA',
          content: `<table class="spec-table"><thead><tr><th>DB2 Column</th><th>JPA Field</th><th>Type</th><th>Disposition</th></tr></thead><tbody><tr><td>SETL_REGION</td><td>regionId</td><td>String(8)</td><td>PK (composite)</td></tr><tr><td>CUTOFF_TIME</td><td>cutoffTime</td><td>LocalTime</td><td>Standard cutoff</td></tr><tr><td>UTC_OFFSET</td><td>utcOffsetMinutes</td><td>Integer</td><td>Decimal → minutes</td></tr><tr><td>HOLIDAY_FLAG</td><td>holidayFlag</td><td>Boolean</td><td>Y/N → Boolean</td></tr><tr><td>OVERRIDE_TIME</td><td>overrideTime</td><td>LocalTime (nullable)</td><td>Optional</td></tr><tr><td>COMPUTED_CUTOFF_TS</td><td>computedCutoffAt</td><td>OffsetDateTime</td><td>Written on broadcast</td></tr><tr><td>STATUS_CODE</td><td>statusCode</td><td>Enum(CutoffStatus)</td><td>BROADCAST/HOLIDAY_SKIP/PENDING</td></tr></tbody></table>`,
        },
        {
          num: 5,
          title: 'Open Questions — Engineer to Resolve',
          content: `<div><div class="open-question"><div class="oq-num">1</div><div><strong>Sync vs async for GTMPOST1:</strong> COBOL uses synchronous CALL. Java could use synchronous REST (simpler) or async event (more resilient). Confirm with settlement architecture before implementing PostingServiceClient.</div></div><div class="open-question"><div class="oq-num">2</div><div><strong>GTMASM01 bit-field logic:</strong> 71% coverage. Before retiring GTMASM01, manually review its bit-manipulation logic and confirm the Java equivalent in ValidationServiceClient.</div></div><div class="open-question"><div class="oq-num">3</div><div><strong>Transaction isolation for broadcast update:</strong> COBOL UPDATE is effectively auto-committed in batch. Java JPA needs explicit @Transactional. Verify isolation level with DBA.</div></div><div class="open-question"><div class="oq-num">4</div><div><strong>CICS replacement read path:</strong> GTMCICS4 reads COMPUTED_CUTOFF_TS directly from DB2. In the modernised estate this becomes an API call — caching strategy and timing TBD.</div></div></div>`,
        },
      ],
    },
  },

  GTMPOST1: {
    name: 'GTMPOST1',
    language: 'COBOL',
    loc: 612,
    domain: 'Settlement / GTM',
    desc: 'Transaction posting — processes pending transactions against the settlement cutoff and writes the GLEDGER feed file.',
    chips: [
      { label: 'Lang', val: 'COBOL' },
      { label: 'LOC', val: '612' },
      { label: 'Domain', val: 'Settlement / GTM' },
      { label: 'Status', val: 'Active' },
    ],
    overviewQuery: 'What does GTMPOST1 do and what depends on it?',
    overviewNarrative:
      '<strong>GTMPOST1</strong> is the terminal posting module for the GTM settlement run — it is <strong>always invoked by GTMSETL0</strong> and never runs standalone. It selects all validated transactions up to the cutoff timestamp from <strong class="font-mono">TRANS_PENDING</strong>, writes each to the <strong class="font-mono">GLEDGER</strong> sequential feed, and inserts an audit row into <strong class="font-mono">POST_AUDIT</strong>. The GLEDGER file format is consumed by the downstream General Ledger system; any field-layout change here breaks that consumer.',
    overviewEdges: [
      'CAST edge: GTMSETL0 → GTMPOST1 (CALL, static)',
      'CAST edge: GTMPOST1 → TRANS_PENDING (SELECT cursor)',
      'CAST edge: GTMPOST1 → GLEDGER (WRITE sequential)',
    ],
    cLayout: {
      w: 480,
      h: 420,
      nodes: [
        { id: 'GTMPOST1',  label: 'GTMPOST1',  sub: 'in focus',    type: 'hero', cx: 240, cy: 190, r: 44 },
        { id: 'GTMSETL0',  label: 'GTMSETL0',  sub: 'caller',      type: 'prog', cx: 240, cy: 60,  r: 30 },
        { id: 'TRANSPEND', label: 'TRANS_PENDING', sub: 'DB2 cursor', type: 'data', cx: 80, cy: 320, r: 26 },
        { id: 'GLEDGER',   label: 'GLEDGER',   sub: 'SEQ feed',    type: 'data', cx: 240, cy: 365, r: 26 },
        { id: 'POSTAUDIT', label: 'POST_AUDIT', sub: 'audit log',   type: 'data', cx: 400, cy: 320, r: 26 },
      ],
      edges: [
        { from: 'GTMSETL0',  to: 'GTMPOST1',  type: 'call' },
        { from: 'GTMPOST1',  to: 'TRANSPEND', type: 'data' },
        { from: 'GTMPOST1',  to: 'GLEDGER',   type: 'data' },
        { from: 'GTMPOST1',  to: 'POSTAUDIT', type: 'data' },
      ],
    },
    graph: {
      title: 'GTMPOST1 — Call &amp; Data Graph',
      nodes: [
        { id: 'GTMSETL0',  label: 'GTMSETL0',  sub: 'Settlement Cutoff · Caller',    type: 'prog', x: 300, y: 28,  w: 160, h: 56 },
        { id: 'GTMPOST1',  label: 'GTMPOST1',  sub: 'Transaction Posting · HERO',    type: 'hero', x: 300, y: 183, w: 160, h: 60 },
        { id: 'TRANSPEND', label: 'TRANS_PENDING', sub: 'DB2 · Pending Transactions', type: 'data', x: 50,  y: 343, w: 160, h: 52 },
        { id: 'GLEDGER',   label: 'GLEDGER',   sub: 'General Ledger Feed (SEQ)',     type: 'data', x: 470, y: 343, w: 160, h: 52 },
        { id: 'POSTAUDIT', label: 'POST_AUDIT', sub: 'DB2 · Posting Audit Log',      type: 'data', x: 260, y: 453, w: 160, h: 52 },
      ],
      edges: [
        { from: 'GTMSETL0',  to: 'GTMPOST1',  type: 'call', label: 'CALL — cutoff timestamp',    fd: 'bottom', td: 'top' },
        { from: 'GTMPOST1',  to: 'TRANSPEND', type: 'data', label: 'EXEC SQL SELECT (cursor)',   fd: 'bl',     td: 'top' },
        { from: 'GTMPOST1',  to: 'GLEDGER',   type: 'data', label: 'WRITE SEQUENTIAL',           fd: 'br',     td: 'top' },
        { from: 'GTMPOST1',  to: 'POSTAUDIT', type: 'data', label: 'EXEC SQL INSERT (audit)',    fd: 'bottom', td: 'top' },
      ],
    },
    businessRules: [
      {
        section: 'Purpose & Scope',
        rules: [
          {
            text: 'GTMPOST1 processes the daily transaction posting run for the GTM settlement domain. It is <strong>always called by GTMSETL0</strong> — it never runs standalone. It receives the confirmed settlement cutoff timestamp and determines which transactions are included in today\'s settlement batch.',
            citations: [{ label: 'CALL from GTMSETL0', edge: 'GTMSETL0 → GTMPOST1 (CALL)' }],
          },
        ],
      },
      {
        section: 'Transaction Selection Logic',
        rules: [
          {
            text: 'The program opens a DB2 cursor against <strong>TRANS_PENDING</strong>, selecting all rows where TRANS_STATUS = \'VALIDATED\' and TRANS_TS ≤ the received cutoff timestamp. Transactions arriving after the cutoff are left in TRANS_PENDING for the next settlement run.',
            citations: [{ label: 'TRANS_PENDING (DB2 SELECT)', edge: 'GTMPOST1 → TRANS_PENDING' }],
          },
          {
            text: 'Each fetched transaction is written as a fixed-format record to the <strong>GLEDGER sequential file</strong>. The record layout includes: transaction ID, amount (packed decimal), currency code, value date, and a posting status code. The downstream General Ledger system consumes this file for end-of-day reconciliation.',
            citations: [{ label: 'GLEDGER (WRITE SEQ)', edge: 'GTMPOST1 → GLEDGER' }],
          },
        ],
      },
      {
        section: 'Audit & Return Codes',
        rules: [
          {
            text: 'After each successfully posted transaction, GTMPOST1 inserts an audit row into <strong>POST_AUDIT</strong> with the transaction ID, posting timestamp, and operator ID. This table is the primary source for post-run reconciliation and exception reporting.',
            citations: [{ label: 'POST_AUDIT (DB2 INSERT)', edge: 'GTMPOST1 → POST_AUDIT' }],
          },
          {
            text: 'GTMPOST1 returns TXN-COUNT and RETURN-CODE to its caller, GTMSETL0. A RETURN-CODE &gt; 0 causes GTMSETL0 to halt the broadcast — the settlement cutoff is not published until posting completes without error.',
            citations: [{ label: 'Return to GTMSETL0', edge: 'GTMSETL0 → GTMPOST1 (CALL)' }],
          },
        ],
      },
    ],
    changeImpact: {
      query: 'What breaks if <strong class="font-mono">GTMPOST1</strong> changes?',
      coverage: 96,
      coverageNote: 'Coverage 96% — all dependencies fully resolved. No assembler or dynamic-call edges in this program.',
      items: [
        {
          prog: 'GTMSETL0',
          rel: 'Direct caller (CALL)',
          severity: 'critical',
          reason: 'GTMSETL0 inspects WS-POST1-RETURN-CODE to decide whether to broadcast the cutoff. If GTMPOST1\'s return-code semantics change, GTMSETL0\'s decision will be wrong — a false success or false failure affects the entire settlement run.',
          edge: 'GTMSETL0 → GTMPOST1 (CALL)',
        },
        {
          prog: 'GLEDGER feed consumers',
          rel: 'Downstream data consumer',
          severity: 'high',
          reason: 'Any change to the GLEDGER record layout (field order, field width, packed-decimal format, added/removed fields) breaks the General Ledger system\'s fixed-format parser. The GL system is a downstream consumer with its own independent change cycle.',
          edge: 'GTMPOST1 → GLEDGER (WRITE SEQ)',
        },
        {
          prog: 'TRANS_PENDING table',
          rel: 'DB2 data source (SELECT)',
          severity: 'medium',
          reason: 'A schema change to TRANS_PENDING (column rename, data type change, added NOT NULL column) will break GTMPOST1\'s cursor SELECT. TRANS_PENDING is a shared table — assess all other readers.',
          edge: 'GTMPOST1 → TRANS_PENDING (SELECT)',
        },
        {
          prog: 'POST_AUDIT table',
          rel: 'DB2 audit sink (INSERT)',
          severity: 'medium',
          reason: 'A change to required POST_AUDIT columns or constraints will cause GTMPOST1 to fail at audit write time. Impact is lower since POST_AUDIT is written by GTMPOST1 only — but a failure aborts the posting loop.',
          edge: 'GTMPOST1 → POST_AUDIT (INSERT)',
        },
      ],
    },
    spec: {
      title: 'Modernization Specification — GTMPOST1',
      subtitle: 'Target: Java Spring Batch job · Settlement Transaction Posting',
      sections: [
        {
          num: 1,
          title: 'Service Overview',
          content: `<p style="margin-bottom:12px;font-size:14px;">GTMPOST1 maps to a <strong>Spring Batch job</strong> (TransactionPostingJob). Its sequential, cursor-driven, record-by-record processing is a natural fit for Spring Batch's chunk-oriented model. Invoked by SettlementCutoffService (GTMSETL0 replacement) rather than running standalone.</p><div class="code-block"><span class="code-kw">@Configuration</span>
<span class="code-kw">public class</span> <span class="code-type">TransactionPostingJobConfig</span> {
  <span class="code-cmt">// read TRANS_PENDING → transform → write GLEDGER + POST_AUDIT</span>
  <span class="code-kw">@Bean</span> <span class="code-type">Job</span> transactionPostingJob(<span class="code-type">Step</span> postingStep);
  <span class="code-kw">@Bean</span> <span class="code-type">Step</span> postingStep(<span class="code-type">JdbcCursorItemReader</span> reader,
                           <span class="code-type">PostingItemProcessor</span> processor,
                           <span class="code-type">CompositeItemWriter</span> writer);
}</div>`,
        },
        {
          num: 2,
          title: 'Business Logic to Preserve',
          content: `<ul style="list-style:none;display:flex;flex-direction:column;gap:8px;font-size:13px;"><li style="display:flex;gap:10px;"><span style="color:var(--success);font-weight:700;">✓</span>Cursor selection: TRANS_STATUS = 'VALIDATED' AND TRANS_TS ≤ cutoffTimestamp</li><li style="display:flex;gap:10px;"><span style="color:var(--success);font-weight:700;">✓</span>GLEDGER fixed-format record layout — <strong>must be byte-for-byte identical</strong> until GL system is also modernised</li><li style="display:flex;gap:10px;"><span style="color:var(--success);font-weight:700;">✓</span>POST_AUDIT insert per transaction (transactionId, postedAt, operatorId)</li><li style="display:flex;gap:10px;"><span style="color:var(--success);font-weight:700;">✓</span>Return TXN_COUNT and error flag to caller (SettlementCutoffService)</li><li style="display:flex;gap:10px;"><span style="color:var(--warning);font-weight:700;">⚠</span>Packed-decimal AMOUNT handling — use BigDecimal with explicit precision; do not use float</li></ul>`,
        },
        {
          num: 3,
          title: 'Open Questions — Engineer to Resolve',
          content: `<div><div class="open-question"><div class="oq-num">1</div><div><strong>GLEDGER format lock:</strong> Until the downstream GL system is modernised, the flat-file format must be preserved exactly. Confirm with GL team before changing any field in the GLEDGER writer.</div></div><div class="open-question"><div class="oq-num">2</div><div><strong>Spring Batch chunk size:</strong> COBOL processes one record at a time. A chunk size of 1 replicates semantics but is inefficient. Determine safe chunk size with DBA (DB2 lock granularity on TRANS_PENDING).</div></div><div class="open-question"><div class="oq-num">3</div><div><strong>Restart semantics:</strong> COBOL has no built-in restart — a failed run re-runs from scratch. Confirm with settlement ops whether a mid-run restart is safe (idempotency of GLEDGER writes and POST_AUDIT inserts).</div></div></div>`,
        },
      ],
    },
  },
};
