# MAVEN/CARTA — CardDemo CAST Analysis Report

**Generated:** 7/30/2026, 5:33:54 PM  
**Codebase:** AWS Mainframe Modernization CardDemo  
**Analyzer:** MAVEN/CARTA Static COBOL Parser (CAST-compatible)

## Summary

| Metric | Value |
|--------|-------|
| Total Programs | 44 |
| Total LOC | 23,636 |
| Total Dependency Edges | 184 |
| Avg Cyclomatic Complexity | 85 |
| High Complexity Programs (CC > 20) | 40 |
| Standalone Programs (no deps) | 0 |
| Unique Copybooks Referenced | 70 |

## Programs by Domain

### Account / VSAM
| Program | LOC | CC | Calls | SQL | CICS | File I/O | Copybooks |
|---------|-----|-----|-------|-----|------|----------|-----------|
| `COACCT01` | 601 | 45 | 4 | 0 | 0 | 0 | 9 |
| `CODATE01` | 508 | 39 | 4 | 0 | 0 | 0 | 8 |

### Account Batch
| Program | LOC | CC | Calls | SQL | CICS | File I/O | Copybooks |
|---------|-----|-----|-------|-----|------|----------|-----------|
| `CBACT04C` | 552 | 130 | 1 | 0 | 0 | 6 | 6 |
| `CBACT01C` | 358 | 61 | 2 | 0 | 0 | 5 | 3 |
| `CBACT03C` | 130 | 33 | 1 | 0 | 0 | 1 | 2 |
| `CBACT02C` | 129 | 33 | 1 | 0 | 0 | 1 | 2 |

### Account Online
| Program | LOC | CC | Calls | SQL | CICS | File I/O | Copybooks |
|---------|-----|-----|-------|-----|------|----------|-----------|
| `COACTUPC` | 3368 | 555 | 1 | 0 | 4 | 0 | 18 |
| `COACTVWC` | 703 | 82 | 1 | 0 | 2 | 0 | 15 |

### Administration
| Program | LOC | CC | Calls | SQL | CICS | File I/O | Copybooks |
|---------|-----|-----|-------|-----|------|----------|-----------|
| `COADM01C` | 189 | 31 | 1 | 0 | 1 | 0 | 10 |

### Authorization
| Program | LOC | CC | Calls | SQL | CICS | File I/O | Copybooks |
|---------|-----|-----|-------|-----|------|----------|-----------|
| `COPAUS0C` | 792 | 114 | 1 | 0 | 1 | 0 | 15 |
| `COPAUA0C` | 771 | 90 | 4 | 0 | 0 | 5 | 15 |
| `COPAUS1C` | 461 | 68 | 2 | 0 | 1 | 0 | 11 |
| `PAUDBLOD` | 274 | 44 | 2 | 0 | 0 | 3 | 5 |
| `CBPAUP0C` | 266 | 52 | 0 | 0 | 0 | 2 | 3 |
| `PAUDBUNL` | 222 | 28 | 2 | 0 | 0 | 5 | 5 |
| `DBUNLDGS` | 211 | 20 | 2 | 0 | 0 | 1 | 7 |
| `COPAUS2C` | 201 | 10 | 0 | 1 | 0 | 0 | 3 |

### Billing Online
| Program | LOC | CC | Calls | SQL | CICS | File I/O | Copybooks |
|---------|-----|-----|-------|-----|------|----------|-----------|
| `COBIL00C` | 420 | 57 | 1 | 0 | 1 | 0 | 11 |

### CICS Wait
| Program | LOC | CC | Calls | SQL | CICS | File I/O | Copybooks |
|---------|-----|-----|-------|-----|------|----------|-----------|
| `COBSWAIT` | 13 | 1 | 1 | 0 | 0 | 0 | 1 |

### Credit Card Online
| Program | LOC | CC | Calls | SQL | CICS | File I/O | Copybooks |
|---------|-----|-----|-------|-----|------|----------|-----------|
| `COCRDUPC` | 1195 | 233 | 1 | 0 | 3 | 0 | 15 |
| `COCRDLIC` | 1093 | 195 | 2 | 0 | 2 | 1 | 13 |
| `COCRDSLC` | 642 | 99 | 1 | 0 | 4 | 0 | 15 |

### Customer Batch
| Program | LOC | CC | Calls | SQL | CICS | File I/O | Copybooks |
|---------|-----|-----|-------|-----|------|----------|-----------|
| `CBCUS01C` | 130 | 33 | 1 | 0 | 0 | 1 | 2 |

### Data Export
| Program | LOC | CC | Calls | SQL | CICS | File I/O | Copybooks |
|---------|-----|-----|-------|-----|------|----------|-----------|
| `CBEXPORT` | 396 | 38 | 1 | 0 | 0 | 7 | 7 |

### Data Import
| Program | LOC | CC | Calls | SQL | CICS | File I/O | Copybooks |
|---------|-----|-----|-------|-----|------|----------|-----------|
| `CBIMPORT` | 337 | 36 | 1 | 0 | 0 | 14 | 7 |

### Menu Online
| Program | LOC | CC | Calls | SQL | CICS | File I/O | Copybooks |
|---------|-----|-----|-------|-----|------|----------|-----------|
| `COMEN01C` | 213 | 39 | 1 | 0 | 1 | 0 | 10 |

### Reporting Online
| Program | LOC | CC | Calls | SQL | CICS | File I/O | Copybooks |
|---------|-----|-----|-------|-----|------|----------|-----------|
| `CORPT00C` | 498 | 66 | 2 | 0 | 1 | 2 | 9 |

### Sign-on Online
| Program | LOC | CC | Calls | SQL | CICS | File I/O | Copybooks |
|---------|-----|-----|-------|-----|------|----------|-----------|
| `COSGN00C` | 172 | 21 | 2 | 0 | 1 | 0 | 10 |

### Statement Batch
| Program | LOC | CC | Calls | SQL | CICS | File I/O | Copybooks |
|---------|-----|-----|-------|-----|------|----------|-----------|
| `CBSTM03A` | 784 | 63 | 2 | 0 | 0 | 4 | 5 |
| `CBSTM03B` | 162 | 30 | 0 | 0 | 0 | 5 | 1 |

### Transaction Batch
| Program | LOC | CC | Calls | SQL | CICS | File I/O | Copybooks |
|---------|-----|-----|-------|-----|------|----------|-----------|
| `CBTRN02C` | 619 | 149 | 1 | 0 | 0 | 9 | 6 |
| `CBTRN03C` | 545 | 119 | 1 | 0 | 0 | 7 | 6 |
| `CBTRN01C` | 415 | 102 | 1 | 0 | 0 | 7 | 7 |

### Transaction Type
| Program | LOC | CC | Calls | SQL | CICS | File I/O | Copybooks |
|---------|-----|-----|-------|-----|------|----------|-----------|
| `COTRTLIC` | 1861 | 272 | 2 | 1 | 1 | 1 | 11 |
| `COTRTUPC` | 1429 | 230 | 1 | 1 | 2 | 0 | 13 |
| `COTRN02C` | 614 | 97 | 2 | 0 | 1 | 0 | 11 |
| `COTRN00C` | 529 | 119 | 1 | 0 | 1 | 0 | 9 |
| `COTRN01C` | 231 | 28 | 1 | 0 | 1 | 0 | 9 |
| `COBTUPDT` | 205 | 21 | 0 | 1 | 0 | 1 | 1 |

### User Management
| Program | LOC | CC | Calls | SQL | CICS | File I/O | Copybooks |
|---------|-----|-----|-------|-----|------|----------|-----------|
| `COUSR00C` | 531 | 118 | 1 | 0 | 1 | 0 | 9 |
| `COUSR02C` | 303 | 51 | 1 | 0 | 1 | 0 | 9 |
| `COUSR03C` | 251 | 36 | 1 | 0 | 1 | 0 | 9 |
| `COUSR01C` | 198 | 25 | 1 | 0 | 1 | 0 | 10 |

### Utility / Date
| Program | LOC | CC | Calls | SQL | CICS | File I/O | Copybooks |
|---------|-----|-----|-------|-----|------|----------|-----------|
| `CSUTLDTC` | 114 | 11 | 1 | 0 | 0 | 0 | 1 |

## Top 5 Most Connected Programs

| Program | Domain | Total Deps | Calls | SQL | CICS |
|---------|--------|-----------|-------|-----|------|
| `CBIMPORT` | Data Import | 15 | 1 | 0 | 0 |
| `CBTRN02C` | Transaction Batch | 10 | 1 | 0 | 0 |
| `COPAUA0C` | Authorization | 9 | 4 | 0 | 0 |
| `CBEXPORT` | Data Export | 8 | 1 | 0 | 0 |
| `CBTRN01C` | Transaction Batch | 8 | 1 | 0 | 0 |

## High Complexity Programs (CC > 20)

| Program | Domain | Complexity | LOC |
|---------|--------|-----------|-----|
| `COACTUPC` | Account Online | 555 | 3368 |
| `COTRTLIC` | Transaction Type | 272 | 1861 |
| `COCRDUPC` | Credit Card Online | 233 | 1195 |
| `COTRTUPC` | Transaction Type | 230 | 1429 |
| `COCRDLIC` | Credit Card Online | 195 | 1093 |
| `CBTRN02C` | Transaction Batch | 149 | 619 |
| `CBACT04C` | Account Batch | 130 | 552 |
| `CBTRN03C` | Transaction Batch | 119 | 545 |
| `COTRN00C` | Transaction Type | 119 | 529 |
| `COUSR00C` | User Management | 118 | 531 |
| `COPAUS0C` | Authorization | 114 | 792 |
| `CBTRN01C` | Transaction Batch | 102 | 415 |
| `COCRDSLC` | Credit Card Online | 99 | 642 |
| `COTRN02C` | Transaction Type | 97 | 614 |
| `COPAUA0C` | Authorization | 90 | 771 |
| `COACTVWC` | Account Online | 82 | 703 |
| `COPAUS1C` | Authorization | 68 | 461 |
| `CORPT00C` | Reporting Online | 66 | 498 |
| `CBSTM03A` | Statement Batch | 63 | 784 |
| `CBACT01C` | Account Batch | 61 | 358 |
| `COBIL00C` | Billing Online | 57 | 420 |
| `CBPAUP0C` | Authorization | 52 | 266 |
| `COUSR02C` | User Management | 51 | 303 |
| `COACCT01` | Account / VSAM | 45 | 601 |
| `PAUDBLOD` | Authorization | 44 | 274 |
| `CODATE01` | Account / VSAM | 39 | 508 |
| `COMEN01C` | Menu Online | 39 | 213 |
| `CBEXPORT` | Data Export | 38 | 396 |
| `CBIMPORT` | Data Import | 36 | 337 |
| `COUSR03C` | User Management | 36 | 251 |
| `CBACT02C` | Account Batch | 33 | 129 |
| `CBACT03C` | Account Batch | 33 | 130 |
| `CBCUS01C` | Customer Batch | 33 | 130 |
| `COADM01C` | Administration | 31 | 189 |
| `CBSTM03B` | Statement Batch | 30 | 162 |
| `COTRN01C` | Transaction Type | 28 | 231 |
| `PAUDBUNL` | Authorization | 28 | 222 |
| `COUSR01C` | User Management | 25 | 198 |
| `COBTUPDT` | Transaction Type | 21 | 205 |
| `COSGN00C` | Sign-on Online | 21 | 172 |

## Copybook Registry (70 unique)

`03220012`, `03500000`, `CCPAUERY`, `CCPAURLY`, `CCPAURQY`, `CIPAUDTY`, `CIPAUSMY`, `CMQGMOV`, `CMQMDV`, `CMQODV`, `CMQPMOV`, `CMQTML`, `CMQV`, `COACTUP`, `COACTVW`, `COADM01`, `COADM02Y`, `COBIL00`, `COCOM01Y`, `COCRDLI`, `COCRDSL`, `COCRDUP`, `CODATECN`, `COMEN01`, `COMEN02Y`, `COPAU00`, `COPAU01`, `CORPT00`, `COSGN00`, `COSTM01`, `COTRN00`, `COTRN01`, `COTRN02`, `COTRTLI`, `COTRTUP`, `COTTL01Y`, `COUSR00`, `COUSR01`, `COUSR02`, `COUSR03`, `CSDAT01Y`, `CSLKPCDY`, `CSMSG01Y`, `CSMSG02Y`, `CSSETATY`, `CSUSR01Y`, `CSUTLDPY`, `CUSTREC`, `CVACT01Y`, `CVACT02Y`, `CVACT03Y`, `CVCRD01Y`, `CVCUS01Y`, `CVEXPORT`, `CVTRA01Y`, `CVTRA02Y`, `CVTRA03Y`, `CVTRA04Y`, `CVTRA05Y`, `CVTRA06Y`, `CVTRA07Y`, `DFHAID`, `DFHATTR`, `DFHBMSCA`, `IMSFUNCS`, `OF`, `PADFLPCB`, `PASFLPCB`, `PAUTBPCB`, `REPLACING`

## Output Files

- `carddemo-cast-report.json` — machine-readable dep graph data (app-compatible schema)
- `carddemo-cast-report.xml` — CAST-compatible XML report
- `carddemo-cast-report.md` — this summary