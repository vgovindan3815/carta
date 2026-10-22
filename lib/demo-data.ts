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
        section: 'Service Invocation Context',
        rules: [
          {
            id: 'BR-001', title: 'Batch Job GTMJOB01 Is the Sole Trigger',
            trigger: 'The daily GTM settlement batch stream is initiated by JCL job GTMJOB01 at end-of-day via the enterprise scheduler (TWS).',
            action: 'JCL step SETLSTEP executes PGM=GTMSETL0 with no PARM. GTMSETL0 obtains its run context entirely from DB2 table SETL_CTRL, keyed by SETL_REGION (PIC X(04)) set in Working-Storage. No upstream program CALLs GTMSETL0 — it is always a JCL entry point.',
            outcome: 'The full settlement cutoff lifecycle is triggered once per business day by the scheduler. No online or ad-hoc invocation path exists.',
            risk: 'Any attempt to CALL GTMSETL0 from another program will populate LINKAGE with zeros, causing the SETL_CTRL SELECT to fail with SQLCODE -811 and RETURN-CODE = 16.',
          },
          {
            id: 'BR-002', title: 'Strict Paragraph Sequence — Each Step Gates the Next',
            trigger: 'Any step in the settlement pipeline (validate, post, broadcast) is about to begin.',
            action: 'The program executes in fixed paragraph order: 1000-INITIALIZE → 2000-READ-SETL-CTRL → 3000-CALL-VALIDATION → 4000-CALL-POSTING → 5000-UPDATE-CUTOFF-BROADCAST → 9000-TERMINATE. After each step, WS-STEP-RC is checked; if non-zero, remaining steps are skipped and control jumps to 9000-TERMINATE.',
            outcome: 'Validation failure means no posting. Posting failure means no broadcast. The batch run either completes fully or fails cleanly with a diagnostic return code.',
            risk: 'Reordering paragraphs or weakening a WS-STEP-RC check can cause transactions to be posted without validation, or the cutoff to be broadcast after a failed posting.',
          },
        ],
      },
      {
        section: 'Data Reads',
        rules: [
          {
            id: 'BR-003', title: 'SETL_CTRL Table Provides All Run Parameters',
            trigger: 'Paragraph 2000-READ-SETL-CTRL executes at the start of each run after initialization.',
            action: 'The program issues EXEC SQL SELECT CUTOFF_TIME, UTC_OFFSET, HOLIDAY_FLAG, OVERRIDE_FLAG, OVERRIDE_TIME INTO :WS-CUTOFF-TIME, :WS-UTC-OFFSET, :WS-HOLIDAY-FLAG, :WS-OVERRIDE-FLAG, :WS-OVERRIDE-TIME FROM SETL_CTRL WHERE SETL_REGION = :WS-REGION-CODE. If SQLCODE = +100 (not found), RETURN-CODE = 8 is set and processing stops.',
            outcome: 'All run-control parameters are loaded from a single DB2 row. The settlement cutoff is fully configurable without a code change.',
            risk: 'A schema change to SETL_CTRL (column rename, type change, added NOT NULL column without default) will cause a compile error or runtime SQLCODE at this SELECT.',
          },
          {
            id: 'BR-004', title: 'TRANS_PENDING Is Read Only via GTMVALD2 and GTMPOST1 — Not Directly',
            trigger: 'GTMSETL0 does not read TRANS_PENDING directly; it delegates to GTMVALD2 (paragraph 3000) and GTMPOST1 (paragraph 4000).',
            action: 'GTMSETL0 passes WS-CUTOFF-TS (PIC X(26)) and WS-REGION-CODE (PIC X(04)) to each sub-program via their respective LINKAGE SECTION parameter blocks. All DB2 cursor work against TRANS_PENDING is encapsulated in GTMVALD2 and GTMPOST1.',
            outcome: 'GTMSETL0 has no direct DB2 dependency on TRANS_PENDING — only an indirect one through its callees.',
            risk: 'If the TRANS_PENDING schema changes, GTMVALD2 and GTMPOST1 must be updated; GTMSETL0 does not need a recompile, but the sub-programs must be co-deployed.',
          },
        ],
      },
      {
        section: 'Core Business Logic',
        rules: [
          {
            id: 'BR-005', title: 'Effective Cutoff Time Is Computed, Not Stored Directly',
            trigger: 'The program reads CUTOFF_TIME and UTC_OFFSET from SETL_CTRL and reaches paragraph 2100-COMPUTE-CUTOFF.',
            action: 'The program applies UTC_OFFSET (PIC S9(04) COMP, in minutes) to CUTOFF_TIME (PIC X(08), HHMMSS local time) using Working-Storage arithmetic to derive WS-CUTOFF-TS in ISO-8601 format (PIC X(26)). If OVERRIDE_FLAG = \'Y\', OVERRIDE_TIME replaces CUTOFF_TIME before the offset calculation.',
            outcome: 'The effective settlement cutoff is a precise UTC timestamp. It is configurable via the table for standard runs and overrideable by operations for emergency extensions.',
            risk: 'An incorrect UTC_OFFSET silently shifts the cutoff boundary — potentially including post-cutoff transactions or excluding valid ones. There is no range check on UTC_OFFSET.',
          },
          {
            id: 'BR-006', title: 'Bank Holiday Suppression Exits Cleanly Without Processing',
            trigger: 'SETL_CTRL.HOLIDAY_FLAG = \'Y\' is read at paragraph 2000-READ-SETL-CTRL.',
            action: 'The program moves \'HOLIDAY_SKIP\' to WS-STATUS-CODE, issues EXEC SQL UPDATE SETL_CTRL SET STATUS_CODE = :WS-STATUS-CODE, then moves 0 to RETURN-CODE and performs 9000-TERMINATE. No validation, posting, or broadcast is performed.',
            outcome: 'The settlement run produces RETURN-CODE = 0. JCL treats it as successful. GTMCICS4 reads STATUS_CODE = \'HOLIDAY_SKIP\' and displays the appropriate customer-facing message.',
            risk: 'Setting HOLIDAY_FLAG = \'Y\' on a non-holiday, or leaving it set across days, suppresses a live settlement run with no alert — because RC=0, JCL COND= gates will not detect the suppression.',
            gap: 'No program in this analysis resets HOLIDAY_FLAG to \'N\' after a holiday skip. SME confirmation required: which job or operator process resets this flag?',
          },
        ],
      },
      {
        section: 'Downstream Service Calls',
        rules: [
          {
            id: 'BR-007', title: 'GTMVALD2 Is Called for Validation Before Any Posting',
            trigger: 'Paragraph 3000-CALL-VALIDATION executes after SETL_CTRL is read and HOLIDAY_FLAG = \'N\'.',
            action: 'GTMSETL0 issues CALL \'GTMVALD2\' USING WS-VALD2-PARM. WS-VALD2-PARM contains: WS-CUTOFF-TS (PIC X(26)), WS-REGION-CODE (PIC X(04)), LS-FAIL-COUNT (PIC 9(06) COMP, output). GTMVALD2 returns LS-FAIL-COUNT. If LS-FAIL-COUNT > 0, WS-STEP-RC is set non-zero and paragraph 4000-CALL-POSTING is skipped entirely.',
            outcome: 'Validation is a hard gate. No transaction is posted until FAIL-COUNT = 0.',
            risk: 'Weakening the LS-FAIL-COUNT check allows invalid transactions into the settlement batch, producing an incorrect GLEDGER feed and a GL reconciliation failure.',
          },
          {
            id: 'BR-008', title: 'GTMPOST1 Is Called for Transaction Posting via a Shared COPYBOOK Interface',
            trigger: 'Paragraph 4000-CALL-POSTING executes after GTMVALD2 returns LS-FAIL-COUNT = 0.',
            action: 'GTMSETL0 issues CALL \'GTMPOST1\' USING WS-POST-PARM. WS-POST-PARM is defined in a shared COPYBOOK and contains: WS-CUTOFF-TS (PIC X(26)), WS-REGION-CODE (PIC X(04)), LS-TXN-COUNT (PIC 9(08) COMP, output), LS-POST-RC (PIC 9(04) COMP, output). GTMPOST1 posts all validated transactions to GLEDGER and sets LS-POST-RC.',
            outcome: 'All transactions in TRANS_PENDING with TRANS_STATUS = \'VALIDATED\' and TRANS_TS ≤ cutoff are posted to GLEDGER and recorded in POST_AUDIT.',
            risk: 'A change to WS-POST-PARM structure in the COPYBOOK without co-deploying both programs causes GTMPOST1 to parse the parameter block incorrectly, posting the wrong transaction set.',
          },
        ],
      },
      {
        section: 'Data Writes & Persistence',
        rules: [
          {
            id: 'BR-009', title: 'Cutoff Broadcast Is the Settlement Completion Signal',
            trigger: 'GTMPOST1 returns LS-POST-RC = 0 and the program reaches paragraph 5000-UPDATE-CUTOFF-BROADCAST.',
            action: 'GTMSETL0 issues EXEC SQL UPDATE SETL_CTRL SET STATUS_CODE = \'BROADCAST\', COMPUTED_CUTOFF_TS = :WS-CUTOFF-TS WHERE SETL_REGION = :WS-REGION-CODE. This is the only write GTMSETL0 makes to SETL_CTRL on a successful run (the HOLIDAY_SKIP path uses a separate UPDATE in paragraph 2000).',
            outcome: 'COMPUTED_CUTOFF_TS and STATUS_CODE = \'BROADCAST\' are published to SETL_CTRL. GTMCICS4 reads this at online-transaction time to confirm settlement is final.',
            risk: 'A change to STATUS_CODE vocabulary or COMPUTED_CUTOFF_TS format must be co-ordinated with GTMCICS4. There is no compile-time signal if it is not — GTMCICS4 will silently read a stale or misformatted value.',
          },
        ],
      },
      {
        section: 'Error Handling & Return Codes',
        rules: [
          {
            id: 'BR-010', title: 'Return Code Scheme Is a Formal JCL Interface',
            trigger: 'GTMSETL0 completes or aborts and transfers control back to the JCL step.',
            action: 'The program sets RETURN-CODE per a defined scheme: 0 = full success (all steps completed), 4 = holiday skip (no processing, expected), 8 = SETL_CTRL not found, 12 = validation failed (FAIL-COUNT > 0), 16 = posting error (LS-POST-RC > 0). JCL step SETLSTEP uses COND=(12,LT) to suppress downstream steps.',
            outcome: 'The batch stream correctly gates subsequent steps based on the settlement outcome.',
            risk: 'Adding a new return code without updating the JCL COND= parameters may cause downstream steps to run when settlement has failed, or to be suppressed when it has not.',
          },
          {
            id: 'BR-011', title: 'DB2 Errors Are Propagated Immediately — No Retry Logic',
            trigger: 'Any EXEC SQL statement in GTMSETL0 returns a negative SQLCODE.',
            action: 'The program moves the SQLCODE to WS-SQLCODE-SAVE, displays a diagnostic message to SYSOUT, moves 16 to RETURN-CODE, and performs 9000-TERMINATE. There is no retry logic in GTMSETL0 itself; GTMPOST1 has its own retry for posting-phase DB2 errors.',
            outcome: 'A DB2 failure in GTMSETL0 immediately aborts the run with RC=16.',
            risk: 'Transient DB2 errors (deadlock, timeout) that resolve themselves will cause the entire settlement run to fail, requiring manual restart by operations.',
          },
        ],
      },
      {
        section: 'Copybook & Data Structure Dependencies',
        rules: [
          {
            id: 'BR-012', title: 'WS-POST-PARM Is Defined in a Shared COPYBOOK — Both Programs Must Co-Deploy',
            trigger: 'GTMSETL0 and GTMPOST1 both COPY the same COPYBOOK member at compile time.',
            action: 'The WS-POST-PARM block (cutoff timestamp PIC X(26), region code PIC X(04), TXN-COUNT PIC 9(08) COMP, POST-RC PIC 9(04) COMP) is defined in a single COPYBOOK. Both programs must be compiled and deployed together whenever this COPYBOOK changes.',
            outcome: 'A single source of truth governs the CALL interface between orchestrator and posting module.',
            risk: 'Deploying one program without the other after a COPYBOOK change causes a binary incompatibility that is not detectable at runtime until the CALL executes — typically mid-run.',
          },
          {
            id: 'BR-013', title: 'WS-VALD2-PARM Follows the Same Co-Deploy Pattern with GTMVALD2',
            trigger: 'GTMSETL0 and GTMVALD2 both COPY the WS-VALD2-PARM COPYBOOK member.',
            action: 'WS-VALD2-PARM contains: cutoff timestamp (PIC X(26)), region code (PIC X(04)), FAIL-COUNT (PIC 9(06) COMP). Any change to this block requires co-deployment of GTMSETL0 and GTMVALD2.',
            outcome: 'A shared, versioned interface governs the orchestrator-to-validator call.',
            risk: 'A field added to WS-VALD2-PARM for a new validation rule, without co-deploying GTMSETL0, causes GTMVALD2 to receive a truncated or misaligned parameter block.',
          },
        ],
      },
      {
        section: 'Gaps & Limitations',
        rules: [
          {
            id: 'BR-014', title: 'HOLIDAY_FLAG Reset Responsibility Is External and Undocumented',
            trigger: 'After a holiday-skip run completes with STATUS_CODE = \'HOLIDAY_SKIP\'.',
            action: 'GTMSETL0 does not reset HOLIDAY_FLAG to \'N\'. Static analysis of all programs in this portfolio finds no program that does so. The reset is presumably an operations/DBA manual step.',
            outcome: 'No system-enforced safeguard prevents HOLIDAY_FLAG from remaining \'Y\' across consecutive business days.',
            risk: 'Leaving HOLIDAY_FLAG = \'Y\' after a holiday suppresses the next live settlement run with RETURN-CODE = 4, which JCL treats as success. Transactions pile up in TRANS_PENDING undetected.',
            gap: 'SME confirmation required: who resets HOLIDAY_FLAG? Is there a TWS job or stored procedure? If operations resets it manually, a missed reset suppresses a live settlement with no automated alert.',
          },
          {
            id: 'BR-015', title: 'OVERRIDE_FLAG Is Not Auto-Reset After Emergency Use',
            trigger: 'Settlement operations sets OVERRIDE_FLAG = \'Y\' for an emergency cutoff extension.',
            action: 'GTMSETL0 reads OVERRIDE_FLAG but never resets it. The program does not check how many consecutive runs have used OVERRIDE_TIME — it applies the override indefinitely until operations manually resets OVERRIDE_FLAG to \'N\'.',
            outcome: 'A single-run emergency override correctly extends the cutoff window.',
            risk: 'An unreset OVERRIDE_FLAG silently extends the settlement window indefinitely without treasury awareness — including post-cutoff transactions that should be held to the next cycle.',
            gap: 'No program in this portfolio resets OVERRIDE_FLAG. Recommend adding an automatic reset as part of the broadcast step, or a TWS job that clears it post-run.',
          },
          {
            id: 'BR-016', title: 'GTMASM01 Dynamic Dependency Is Partially Resolved (71% Confidence)',
            trigger: 'GTMVALD2 calls GTMASM01 dynamically for packed-byte flag inspection during validation.',
            action: 'Static analysis detected this edge at 71% confidence (dynamic CALL, unresolved at compile time). GTMASM01\'s parameter register convention, bit-field positions, and return value semantics are not fully determinable from source alone.',
            outcome: 'Current validation works in production. Static analysis cannot guarantee detection of a breaking change to GTMASM01.',
            risk: 'A change to GTMASM01\'s bit-field layout will cause GTMVALD2 to silently mis-validate transactions — either passing invalid transactions or rejecting valid ones — with no compile-time or link-edit warning.',
            gap: 'Manual review of GTMASM01 assembler source required before any change to GTMVALD2\'s validation logic. The CALL interface should be documented as a formal contract.',
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
        section: 'Service Invocation Context',
        rules: [
          {
            id: 'BR-001', title: 'GTMSETL0 Is the Only Caller — Never Invoked from JCL',
            trigger: 'GTMSETL0 reaches paragraph 4000-CALL-POSTING after validation passes with LS-FAIL-COUNT = 0.',
            action: 'GTMSETL0 issues CALL \'GTMPOST1\' USING WS-POST-PARM. GTMPOST1 receives its entire operational context — cutoff timestamp (PIC X(26)), region code (PIC X(04)), and pre-zeroed output counters — from the LINKAGE SECTION parameter block defined in a shared COPYBOOK. There is no JCL EXEC PGM=GTMPOST1 entry point in production.',
            outcome: 'GTMPOST1 executes only when GTMSETL0 has confirmed that validation passed and a valid cutoff timestamp has been computed.',
            risk: 'Invoking GTMPOST1 directly from JCL will populate LINKAGE with zeros or garbage — the cursor SELECT will match no SETL_REGION and no transactions will be posted, silently producing RC=0.',
          },
          {
            id: 'BR-002', title: 'WS-POST-PARM Is a Versioned Binary Contract — Co-Deploy Required',
            trigger: 'GTMSETL0 prepares the WS-POST-PARM LINKAGE block before calling GTMPOST1.',
            action: 'Both programs COPY the same COPYBOOK member at compile time. WS-POST-PARM contains: WS-CUTOFF-TS (PIC X(26)), WS-REGION-CODE (PIC X(04)), LS-TXN-COUNT (PIC 9(08) COMP), LS-POST-RC (PIC 9(04) COMP). A change to any field length, type, or order requires both programs to be recompiled and deployed together.',
            outcome: 'The CALL interface is enforced at link-edit time. Both programs must be co-deployed whenever the COPYBOOK changes.',
            risk: 'Deploying one program without the other after a COPYBOOK change causes a binary incompatibility that produces incorrect results at runtime — not a clean abend.',
          },
        ],
      },
      {
        section: 'Data Reads',
        rules: [
          {
            id: 'BR-003', title: 'TRANS_PENDING Cursor Selects the Settlement Transaction Set',
            trigger: 'Paragraph 3000-FETCH-PENDING-TXNS opens the DB2 cursor at the start of the posting loop.',
            action: 'EXEC SQL DECLARE CSR-TRANS CURSOR FOR SELECT TRANS_ID, TRANS_AMT, TRANS_CCY, TRANS_TS, VALUE_DT FROM TRANS_PENDING WHERE TRANS_STATUS = \'VALIDATED\' AND TRANS_TS <= :WS-CUTOFF-TS AND SETL_REGION = :WS-REGION-CODE ORDER BY TRANS_TS. The cursor is opened once and fetched row-by-row in a PERFORM loop.',
            outcome: 'Exactly the validated, in-window transaction set for the current region is identified for posting. Unvalidated transactions and post-cutoff arrivals remain in TRANS_PENDING.',
            risk: 'A timezone mismatch between TRANS_TS storage (UTC) and a locally-expressed cutoff timestamp will silently include or exclude boundary transactions with no error code.',
            gap: 'Whether TRANS_PENDING has a composite index on (SETL_REGION, TRANS_STATUS, TRANS_TS) is not confirmed. Without this index, full table scans occur as the table grows — a performance risk in high-volume runs.',
          },
        ],
      },
      {
        section: 'Core Business Logic',
        rules: [
          {
            id: 'BR-004', title: 'Two-Condition Eligibility Filter Is the Settlement Boundary',
            trigger: 'Each row is fetched from CSR-TRANS in the posting loop.',
            action: 'The cursor WHERE clause enforces both conditions simultaneously: TRANS_STATUS = \'VALIDATED\' (set by GTMVALD2 during the validation step) AND TRANS_TS ≤ WS-CUTOFF-TS. The cursor is not re-opened mid-run — the full eligible set is determined at cursor-open time.',
            outcome: 'The settlement set is stable and consistent for the entire posting run. No transaction can enter or exit the set after the cursor opens.',
            risk: 'A code change that adds a third filter condition (e.g. amount threshold) must be assessed for regulatory compliance — the settlement boundary is an audited financial control.',
          },
          {
            id: 'BR-005', title: 'Packed-Decimal Amount Is Written Without Rounding Guard',
            trigger: 'Paragraph 4100-FORMAT-GLEDGER-RECORD formats each transaction for WRITE.',
            action: 'TRANS_AMT (sourced as DECIMAL(15,2) from DB2) is moved to WS-GLEDGER-AMT (PIC S9(13)V9(2) COMP-3) using a direct MOVE. No ROUNDED option is specified. Any fractional cent beyond 2 decimal places is silently truncated.',
            outcome: 'Amounts are recorded in GLEDGER as submitted, with up to 2 decimal places of precision.',
            risk: 'If TRANS_AMT ever carries more than 2 decimal places (possible for multi-currency FX transactions), the truncation produces a settlement record that does not match the source transaction exactly — a reconciliation discrepancy.',
            gap: 'No currency-specific decimal-place validation exists before the MOVE. Multi-currency edge cases with more than 2 decimal places of precision are silently truncated.',
          },
        ],
      },
      {
        section: 'Downstream Service Calls',
        rules: [
          {
            id: 'BR-006', title: 'No Outbound CALLs — All Work Is Direct DB2 and File I/O',
            trigger: 'GTMPOST1 executes its posting loop for each fetched transaction.',
            action: 'GTMPOST1 has no outgoing CALL statements. All posting work — the GLEDGER WRITE and POST_AUDIT INSERT — is performed via direct file I/O and embedded SQL within GTMPOST1 itself. The program is a leaf node in the call graph.',
            outcome: 'The posting module is self-contained. Its only external dependencies are TRANS_PENDING (read), GLEDGER (write), and POST_AUDIT (write).',
            risk: 'Because there are no sub-program calls, any required logic extension must be added directly to GTMPOST1 or the program must be refactored to add a callee — either approach requires a full regression test of the posting path.',
          },
        ],
      },
      {
        section: 'Data Writes & Persistence',
        rules: [
          {
            id: 'BR-007', title: 'GLEDGER Fixed-Format Record Is a Binary Contract with the GL System',
            trigger: 'Paragraph 4000-WRITE-GLEDGER-RECORD executes for each posted transaction.',
            action: 'Each record is written in fixed format: TRANS_ID (PIC X(16)), TRANS_AMT (PIC S9(13)V9(2) COMP-3), TRANS_CCY (PIC X(03)), VALUE_DT (PIC X(08)), POST_STATUS (PIC X(02)), SETL_REGION (PIC X(04)). Record length is 46 bytes. The downstream GL system reads with a fixed-format parser keyed to this layout.',
            outcome: 'Each settled transaction is captured in GLEDGER in the exact format the GL system expects for its end-of-day reconciliation run.',
            risk: 'Any field change — order, length, or type — must be co-ordinated with the GL team. A misaligned record layout causes the GL system to silently mis-read every field after the changed position.',
          },
          {
            id: 'BR-008', title: 'POST_AUDIT INSERT Provides the Authoritative Audit Trail',
            trigger: 'Paragraph 4500-WRITE-AUDIT-RECORD executes immediately after each successful GLEDGER WRITE.',
            action: 'GTMPOST1 issues EXEC SQL INSERT INTO POST_AUDIT (TRANS_ID, POST_TS, SETL_REGION, OPERATOR_ID) VALUES (:WS-TRANS-ID, CURRENT TIMESTAMP, :WS-REGION-CODE, :WS-OPERATOR-ID). If SQLCODE is negative, the error is logged to SYSOUT and posting continues to the next transaction.',
            outcome: 'POST_AUDIT is the authoritative record of each settlement run for compliance and operations reporting.',
            risk: 'A POST_AUDIT INSERT failure allows GLEDGER and POST_AUDIT to become out of sync. A reconciliation run will find fewer audit rows than GLEDGER records — a compliance finding in regulated environments.',
            gap: 'POST_AUDIT INSERT failure handling: the program logs and continues, allowing silent divergence between GLEDGER and POST_AUDIT. Engineer and audit team must agree whether this is acceptable in the target architecture.',
          },
        ],
      },
      {
        section: 'Error Handling & Return Codes',
        rules: [
          {
            id: 'BR-009', title: 'Return Code Scheme Is a Formal Contract with GTMSETL0',
            trigger: 'GTMPOST1 completes its posting run (full success, partial, or error) and returns to GTMSETL0.',
            action: 'GTMPOST1 sets LS-TXN-COUNT (number of transactions successfully written to GLEDGER) and LS-POST-RC in WS-POST-PARM. Return codes: 0 = full success, 8 = partial (some GLEDGER writes succeeded; POST_AUDIT INSERTs failed), 12 = DB2 cursor error (cursor could not be opened or FETCH abended), 16 = GLEDGER WRITE failure (file I/O error).',
            outcome: 'GTMSETL0 inspects LS-POST-RC at paragraph 4000-CALL-POSTING. RC=0 allows broadcast; RC=8 allows broadcast with a warning; RC=12 or RC=16 suppress broadcast and propagate to JCL.',
            risk: 'Adding a new return code to GTMPOST1 without updating GTMSETL0\'s decision logic causes GTMSETL0 to treat a new failure mode as success and broadcast a faulty cutoff.',
          },
          {
            id: 'BR-010', title: 'DB2 Cursor Errors Abort the Entire Posting Run',
            trigger: 'Any EXEC SQL FETCH or OPEN returns a negative SQLCODE during the posting loop.',
            action: 'The program moves the SQLCODE to WS-SQLCODE-SAVE, displays a diagnostic to SYSOUT, sets LS-POST-RC = 12, closes the cursor, and performs the end-of-program routine. Transactions already written to GLEDGER in the current run are NOT rolled back.',
            outcome: 'The posting run is cleanly terminated with a diagnostic return code. GTMSETL0 suppresses the broadcast.',
            risk: 'Transactions written to GLEDGER before the cursor error are not rolled back. A partial posting requires operations to manually reconcile GLEDGER against TRANS_PENDING.',
            gap: 'No rollback mechanism exists for partial GLEDGER writes. The GL system may process a partial GLEDGER file and reconcile against a full TRANS_PENDING set — a manual remediation each time this occurs.',
          },
        ],
      },
      {
        section: 'Copybook & Data Structure Dependencies',
        rules: [
          {
            id: 'BR-011', title: 'WS-POST-PARM COPYBOOK Governs the Caller Interface',
            trigger: 'At compile time, both GTMSETL0 and GTMPOST1 COPY the WS-POST-PARM member.',
            action: 'The shared COPYBOOK defines: WS-CUTOFF-TS PIC X(26), WS-REGION-CODE PIC X(04), LS-TXN-COUNT PIC 9(08) COMP, LS-POST-RC PIC 9(04) COMP. Total length: 38 bytes. Both programs must reference this COPYBOOK from the same library version in the same deployment.',
            outcome: 'A single, versioned source of truth governs the CALL interface.',
            risk: 'A library mismatch — GTMSETL0 compiled against version N of the COPYBOOK, GTMPOST1 against version N+1 — produces a silent binary incompatibility detectable only by running the posting step.',
          },
        ],
      },
      {
        section: 'Gaps & Limitations',
        rules: [
          {
            id: 'BR-012', title: 'No Transaction Rollback on Partial GLEDGER Failure',
            trigger: 'A GLEDGER WRITE failure occurs mid-run after some records have been written successfully.',
            action: 'GTMPOST1 sets LS-POST-RC = 16 and terminates the posting loop. Records already written to GLEDGER are not removed. TRANS_PENDING rows already selected by the cursor are not updated — they remain TRANS_STATUS = \'VALIDATED\'.',
            outcome: 'The run ends with RC=16. GTMSETL0 suppresses the broadcast. The GL system receives a partial GLEDGER file on the next scheduled batch read.',
            risk: 'The partial GLEDGER file causes the GL system to post only a subset of the day\'s transactions — a financial reconciliation failure requiring manual remediation.',
            gap: 'No compensating transaction or rollback mechanism exists. The modernised replacement must implement idempotent writes or a saga pattern to handle partial failures cleanly.',
          },
          {
            id: 'BR-013', title: 'TRANS_TS Timezone Convention Is Undocumented',
            trigger: 'The cursor compares TRANS_TS (stored in DB2) against WS-CUTOFF-TS (computed in UTC by GTMSETL0).',
            action: 'Static analysis cannot determine whether TRANS_TS is stored as UTC or as a local timezone. The GLEDGER record uses VALUE_DT (date only), not a timestamp, so the boundary effect is not visible in the output.',
            outcome: 'If TRANS_TS is stored in UTC, the comparison is correct. If stored in local time, up to +/- UTC_OFFSET worth of transactions will be incorrectly included or excluded.',
            risk: 'A single misclassified transaction at the cutoff boundary is a regulatory incident in a settlement context.',
            gap: 'SME or DBA confirmation required: what is the timezone convention for TRANS_PENDING.TRANS_TS? This must be documented and verified before any cutoff computation is changed.',
          },
          {
            id: 'BR-014', title: 'GLEDGER File Has No Record Count or Checksum Trailer',
            trigger: 'GTMPOST1 closes the GLEDGER file at end of the posting run.',
            action: 'The program writes data records only. There is no header record (run date, region, expected count) and no trailer record (total amount, record count). The GL system\'s parser reads until end-of-file.',
            outcome: 'The GL system accepts the GLEDGER file as provided with no integrity verification at the file level.',
            risk: 'A truncated GLEDGER file (e.g. from a mid-write system failure) will be processed by the GL system as a complete file — posting fewer transactions than were settled, with no automated detection.',
            gap: 'Adding a trailer record to GLEDGER requires a co-ordinated change with the GL team. Confirm whether the GL system can be enhanced to validate a trailer before processing.',
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
