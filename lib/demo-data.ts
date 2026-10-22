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
        section: 'Program Identity & Batch Context',
        rules: [
          {
            id: 'BR-001', title: 'Settlement Cutoff Orchestration Is the Sole Batch Entry Point',
            trigger: 'The daily GTM settlement batch stream is initiated by the JCL job scheduler at the end of each business day.',
            action: 'GTMSETL0 is invoked as the exclusive entry-point program. It executes in strict paragraph sequence: 1000-INITIALIZE → 2000-READ-SETL-CTRL → 3000-CALL-VALIDATION → 4000-CALL-POSTING → 5000-UPDATE-CUTOFF-BROADCAST → 9000-TERMINATE. Steps 3 through 5 are bypassed if any preceding step returns a non-zero code.',
            outcome: 'The full settlement cutoff lifecycle — determination, validation, posting, broadcast — is completed as a single atomic batch run. No other program can initiate or substitute for this sequence.',
            risk: 'A change to RETURN-CODE semantics breaks the JCL COND= gate logic. Downstream batch steps may run when they should be held, or be skipped when they should run.',
          },
          {
            id: 'BR-002', title: 'Strict Execution Sequence Prevents Partial Settlement',
            trigger: 'Any step in the settlement pipeline (validate, post, broadcast) is about to begin.',
            action: 'The program evaluates the return code of the preceding step. If non-zero, remaining steps are skipped and control passes directly to 9000-TERMINATE. Validation must return FAIL-COUNT = 0 for posting to execute; posting must return RC = 0 for broadcast to execute.',
            outcome: 'Validation failure means no transaction is posted. Posting failure means no broadcast occurs. The batch run either completes fully or fails cleanly with a diagnostic return code.',
            risk: 'Inserting a new step, weakening a return-code check, or reordering paragraphs can cause transactions to be posted without passing validation, or the cutoff to be broadcast after a failed posting.',
          },
        ],
      },
      {
        section: 'Settlement Cutoff Determination Rules',
        rules: [
          {
            id: 'BR-003', title: 'Cutoff Time Is Configurable via the Control Table, Not Hard-Coded',
            trigger: 'The program reaches paragraph 2000-READ-SETL-CTRL at the start of each settlement run.',
            action: 'The program reads SETL_CTRL.CUTOFF_TIME (PIC X(08), HHMMSS format) and SETL_CTRL.UTC_OFFSET (PIC S9(04) COMP) from DB2. It computes the effective cutoff at 2100-COMPUTE-CUTOFF by applying the UTC offset. If SETL_CTRL row is not found, RETURN-CODE = 8 and processing stops.',
            outcome: 'The effective settlement cutoff is a computed, configurable value. Changing CUTOFF_TIME in SETL_CTRL changes the cutoff window for all future runs without a code deployment.',
            risk: 'Changing the data type or format of CUTOFF_TIME or UTC_OFFSET breaks the arithmetic in 2100-COMPUTE-CUTOFF. An incorrect UTC_OFFSET silently shifts the cutoff boundary — a silent financial accuracy error.',
          },
          {
            id: 'BR-004', title: 'Emergency Override Extends the Cutoff Window for a Single Run',
            trigger: 'Settlement operations manually sets SETL_CTRL.OVERRIDE_FLAG = \'Y\' before the batch run.',
            action: 'When OVERRIDE_FLAG = \'Y\', the program reads SETL_CTRL.OVERRIDE_TIME and substitutes it for the standard CUTOFF_TIME. The program does not reset OVERRIDE_FLAG — that is an operations responsibility.',
            outcome: 'The settlement window is extended to OVERRIDE_TIME for the current run only.',
            risk: 'Failing to reset OVERRIDE_FLAG after use could extend the cutoff beyond a single day without treasury awareness. The program provides no safeguard against OVERRIDE_FLAG remaining \'Y\' across consecutive runs.',
          },
          {
            id: 'BR-005', title: 'Bank Holiday Suppression Produces a Clean Exit, Not an Error',
            trigger: 'SETL_CTRL.HOLIDAY_FLAG = \'Y\' at the time the program reads the control row.',
            action: 'The program sets STATUS_CODE = \'HOLIDAY_SKIP\' on SETL_CTRL via EXEC SQL UPDATE and sets RETURN-CODE = 0. No validation, posting, or broadcast is performed.',
            outcome: 'The settlement run produces a zero return code. JCL treats it as successful even though no transactions were processed. GTMCICS4 reads STATUS_CODE = \'HOLIDAY_SKIP\' and displays the appropriate customer-facing message.',
            risk: 'Setting HOLIDAY_FLAG = \'Y\' for a non-holiday, or failing to reset it, suppresses an entire live settlement run with no alert — because RC=0, JCL will not detect the suppression as a failure.',
            gap: 'The process that resets HOLIDAY_FLAG to \'N\' after a holiday skip is not visible in GTMSETL0. SME confirmation required: who resets HOLIDAY_FLAG, and what is the safeguard?',
          },
        ],
      },
      {
        section: 'Validation Gate Rules',
        rules: [
          {
            id: 'BR-006', title: 'Validation Is a Hard Gate — Posting Cannot Bypass It',
            trigger: 'The program reaches paragraph 3000-CALL-VALIDATION after successfully reading the SETL_CTRL control row.',
            action: 'GTMSETL0 calls GTMVALD2 synchronously via static CALL, passing the computed cutoff and region code via WS-VALD2-PARM. GTMVALD2 returns LS-FAIL-COUNT. If LS-FAIL-COUNT > 0, non-zero RETURN-CODE is set and paragraph 4000-CALL-POSTING is skipped entirely.',
            outcome: 'Validation failure immediately halts the settlement run before any transaction is posted. No posting occurs until FAIL-COUNT = 0.',
            risk: 'Weakening the fail-count gate would let invalid transactions enter the settlement batch, producing an incorrect GLEDGER feed and a direct GL reconciliation failure.',
          },
          {
            id: 'BR-007', title: 'Validation Sub-Pipeline Includes a Partially Resolved Assembler Dependency',
            trigger: 'GTMVALD2 is executing its internal validation logic against TRANS_PENDING.',
            action: 'GTMVALD2 calls GTMDB2IO for all DB2 cursor operations (CALL_STATIC, 100% confidence). It also dynamically calls GTMASM01 for packed-byte flag inspection (71% confidence).',
            outcome: 'Each pending transaction\'s status flags are validated against a bit-field mask. Transactions failing the check increment LS-FAIL-COUNT and are held from posting.',
            risk: 'If GTMASM01\'s bit-field layout changes, GTMVALD2 will silently mis-validate transactions. Automated analysis cannot guarantee detection of this breakage.',
            gap: 'GTMASM01 dynamic CALL resolved at 71% confidence only. Its bit-field contract — parameter register convention, flag bit positions, return value semantics — is not fully determinable by static analysis.',
          },
        ],
      },
      {
        section: 'Transaction Posting & Broadcast Rules',
        rules: [
          {
            id: 'BR-008', title: 'Posting Shares a COPYBOOK-Defined Interface with GTMPOST1',
            trigger: 'Validation passes (LS-FAIL-COUNT = 0) and the program reaches paragraph 4000-CALL-POSTING.',
            action: 'GTMSETL0 calls GTMPOST1 via static CALL, passing WS-POST-PARM: the confirmed cutoff timestamp (PIC X(26)), settlement region code (PIC X(04)), and pre-zeroed counters. WS-POST-PARM is defined in a shared COPYBOOK.',
            outcome: 'GTMPOST1 takes control of transaction posting. All transactions in TRANS_PENDING with TRANS_STATUS = \'VALIDATED\' and TRANS_TS ≤ cutoff are posted to GLEDGER.',
            risk: 'A change to WS-POST-PARM structure must be co-deployed with GTMPOST1. A change to one without the other causes GTMPOST1 to parse the parameter block incorrectly.',
          },
          {
            id: 'BR-009', title: 'Broadcast Is the Settlement Completion Signal for Online Systems',
            trigger: 'GTMPOST1 returns RETURN-CODE = 0 and the program reaches paragraph 5000-UPDATE-CUTOFF-BROADCAST.',
            action: 'GTMSETL0 writes COMPUTED_CUTOFF_TS and STATUS_CODE = \'BROADCAST\' to SETL_CTRL via EXEC SQL UPDATE. GTMCICS4 reads this status at online-transaction time via a runtime DB2 SELECT.',
            outcome: 'The cutoff is published. GTMCICS4 can confirm that today\'s settlement is final. Any online transaction processed after this point knows it is post-cutoff.',
            risk: 'Any change to the STATUS_CODE vocabulary or COMPUTED_CUTOFF_TS format must be co-ordinated with GTMCICS4, with no compile-time signal if it is not.',
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
    pipelineStatus: {
      cast: 'fail',
      github: 'success',
      llm: 'success',
      docs: 'success',
      graphSource: 'llm',
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
        section: 'Program Identity & Invocation Context',
        rules: [
          {
            id: 'BR-001', title: 'GTMPOST1 Is a Terminal Posting Module — Never a Standalone Batch Job',
            trigger: 'GTMSETL0 reaches paragraph 4000-CALL-POSTING after validation passes with FAIL-COUNT = 0.',
            action: 'GTMSETL0 executes a static CALL to GTMPOST1, passing WS-POST-PARM via the LINKAGE SECTION. GTMPOST1 takes control and executes its full posting sequence. It has zero outgoing CALLs — it resolves all its work through direct DB2 and file I/O.',
            outcome: 'All validated, in-window transactions for the specified region are posted to GLEDGER and recorded in POST_AUDIT. Control returns to GTMSETL0 with a count and a success or error code.',
            risk: 'Any attempt to invoke GTMPOST1 directly from JCL (without GTMSETL0) will result in an empty or zero-filled parameter block — the program will select the wrong transaction set or fail immediately.',
          },
          {
            id: 'BR-002', title: 'The Caller Interface Is a Versioned Binary Contract',
            trigger: 'GTMSETL0 prepares the WS-POST-PARM LINKAGE block before calling GTMPOST1.',
            action: 'GTMPOST1 reads its entire operational context — cutoff timestamp (PIC X(26)), region code (PIC X(04)), and output counters — from the LINKAGE SECTION parameter block. Both programs must use the same COPYBOOK definition for WS-POST-PARM.',
            outcome: 'The parameter contract is enforced at link-edit time. Both programs must be co-deployed whenever the COPYBOOK changes.',
            risk: 'A change to the block structure — field order, data type, or length — without co-deploying both programs causes GTMPOST1 to parse the parameter block incorrectly, posting the wrong transaction set.',
          },
        ],
      },
      {
        section: 'Transaction Selection & Posting Rules',
        rules: [
          {
            id: 'BR-003', title: 'Two-Condition Eligibility Filter Defines the Settlement Set',
            trigger: 'GTMPOST1 opens its DB2 cursor at paragraph 3000-FETCH-PENDING-TXNS.',
            action: 'The cursor selects rows from TRANS_PENDING where TRANS_STATUS = \'VALIDATED\' AND TRANS_TS ≤ the received cutoff timestamp, filtered by region code. Both conditions must be satisfied for a transaction to be included.',
            outcome: 'Exactly the validated, in-window transaction set for the current region is posted each run. Unvalidated transactions and post-cutoff arrivals remain in TRANS_PENDING.',
            risk: 'A timezone mismatch between TRANS_TS storage (UTC vs ET) and the ET-based cutoff timestamp will silently include or exclude boundary transactions with no error code.',
            gap: 'The exact timezone convention for TRANS_TS and whether the column is indexed on (TRANS_STATUS, TRANS_TS) are not confirmed from GTMPOST1\'s analysis alone.',
          },
          {
            id: 'BR-004', title: 'GLEDGER Record Layout Is a Binary Contract with the GL System',
            trigger: 'GTMPOST1 writes each posted transaction to the GLEDGER sequential file at paragraph 4000-WRITE-GLEDGER-RECORD.',
            action: 'Each record is written in fixed format: transaction ID (PIC X(16)), amount (PIC S9(13)V9(2) COMP-3), currency code (PIC X(03)), value date (PIC X(08)), posting status code (PIC X(02)). The downstream GL system reads with a fixed-format parser.',
            outcome: 'Each settled transaction is captured in GLEDGER for the GL system\'s end-of-day reconciliation run.',
            risk: 'Any field change in GTMPOST1\'s GLEDGER WRITE must be co-ordinated with the GL team, which has its own release cycle. A mis-aligned record layout causes the GL system to silently mis-read every field after the change point.',
          },
        ],
      },
      {
        section: 'Audit Trail & Return Code Rules',
        rules: [
          {
            id: 'BR-005', title: 'Every Posted Transaction Produces an Audit Row in POST_AUDIT',
            trigger: 'GTMPOST1 successfully writes a transaction record to GLEDGER.',
            action: 'GTMPOST1 immediately inserts a row into POST_AUDIT containing: transaction ID, posted timestamp (CURRENT TIMESTAMP), settlement region code, and posting operator ID. If the INSERT fails, SQLCODE is logged and posting continues.',
            outcome: 'POST_AUDIT is the authoritative record of each settlement run for reconciliation and operations reporting.',
            risk: 'A reconciliation run after a partial POST_AUDIT failure will find fewer audit rows than GLEDGER records, creating a discrepancy requiring manual investigation — a compliance finding in regulated environments.',
            gap: 'POST_AUDIT INSERT failure handling: GTMPOST1 logs the SQLCODE but continues posting, allowing GLEDGER and POST_AUDIT to become out of sync. Engineer and audit team to agree whether this is acceptable.',
          },
          {
            id: 'BR-006', title: 'Return Code Scheme Is a Formal Contract with GTMSETL0',
            trigger: 'GTMPOST1 completes its posting run (success or error) and returns to GTMSETL0.',
            action: 'GTMPOST1 sets LS-TXN-COUNT (number of transactions posted) and LS-POST-RC (return code: 0 = success, 8 = partial, 12 = DB2 cursor error, 16 = GLEDGER write failure) in the WS-POST-PARM block.',
            outcome: 'GTMSETL0 inspects LS-POST-RC at paragraph 4000-CALL-POSTING. RC=0 or RC=8 allow broadcast to proceed; RC=12 or RC=16 suppress broadcast and propagate to JCL.',
            risk: 'Adding a new return code to GTMPOST1 without updating GTMSETL0\'s decision logic at paragraph 4000-CALL-POSTING may cause GTMSETL0 to treat a failure as success and proceed to broadcast a faulty cutoff.',
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
    pipelineStatus: {
      cast: 'fail',
      github: 'success',
      llm: 'success',
      docs: 'success',
      graphSource: 'llm',
    },
  },
};
