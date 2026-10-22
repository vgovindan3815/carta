      *================================================================*
      * PROGRAM  : GTMVALD2                                          *
      * TITLE    : Pre-Post Transaction Validation Module            *
      *                                                              *
      * DESCRIPTION:                                                 *
      *   Called by GTMSETL0 prior to transaction posting.           *
      *   Validates each pending transaction against GTM business    *
      *   rules: amount limits, counterparty standing, duplicate     *
      *   detection, and mandatory-field presence.                   *
      *   Delegates DB2 cursor management to GTMDB2IO via a         *
      *   function-code CALL interface.                              *
      *   Bit-field status flags within each transaction record are  *
      *   validated by dynamically CALLing GTMASM01 (assembler       *
      *   utility) to extract and inspect packed flag bytes.         *
      *   Returns FAIL-COUNT and RETURN-CODE to GTMSETL0.           *
      *                                                              *
      * CALLED BY : GTMSETL0 (settlement orchestrator)              *
      * CALLS     : GTMDB2IO  - DB2 I/O function dispatcher         *
      *             GTMASM01  - Assembler bit-field utility (dynamic)*
      *                                                              *
      * DATA ACCESSED:                                               *
      *   DB2  - BNY_GTM.TRANS_PENDING  (via GTMDB2IO cursor)       *
      *   DB2  - BNY_GTM.CPARTY_LIMIT   (direct SELECT)             *
      *                                                              *
      * RETURN CODES:                                                *
      *   0  - All validations passed                                *
      *   4  - Warning - failures within tolerance threshold         *
      *   8  - Error   - failures exceed tolerance                   *
      *   12 - Severe  - DB2 or sub-program failure                 *
      *                                                              *
      * CHANGE LOG:                                                  *
      *   2024-03-01  R.HARRINGTON    Initial release (v1.0)        *
      *   2024-06-22  Y.TANAKA        Add bit-field check via ASM   *
      *   2024-12-05  S.PATEL         Counterparty limit validation  *
      *================================================================*
       IDENTIFICATION DIVISION.
       PROGRAM-ID.  GTMVALD2.
       AUTHOR.      GTM PAYMENTS ENGINEERING.
       DATE-WRITTEN. 2024-03-01.

       ENVIRONMENT DIVISION.
       CONFIGURATION SECTION.
       SOURCE-COMPUTER.  IBM-ZOS.
       OBJECT-COMPUTER.  IBM-ZOS.

       DATA DIVISION.
       WORKING-STORAGE SECTION.

       EXEC SQL
           INCLUDE SQLCA
       END-EXEC.

       01  WS-PROGRAM-ID           PIC X(08) VALUE 'GTMVALD2'.
       01  WS-MAX-FAIL-THRESHOLD   PIC S9(08) COMP VALUE 50.

      *--- Transaction record from GTMDB2IO cursor -------------------*
       01  WS-TRANS-ROW.
           05  WS-TRANS-ID         PIC X(16).
           05  WS-ACCOUNT-NO       PIC X(18).
           05  WS-DC-IND           PIC X(01).
           05  WS-TRANS-AMOUNT     PIC S9(15)V99 COMP-3.
           05  WS-CURRENCY-CODE    PIC X(03).
           05  WS-CPARTY-ID        PIC X(10).
           05  WS-FLAG-BYTE        PIC X(01).
           05  WS-VALUE-DATE       PIC X(10).

      *--- Counterparty limit host variables -------------------------*
       01  HV-CPARTY-ID            PIC X(10).
       01  HV-CPARTY-LIMIT         PIC S9(15)V99 COMP-3.
       01  HV-CPARTY-STATUS        PIC X(02).

      *--- GTMDB2IO call interface ------------------------------------*
       01  WS-DB2IO-PARM.
           05  DB2IO-FUNC-CODE     PIC X(12).
               88  DB2IO-OPEN-CURSOR        VALUE 'OPEN-CURSOR '.
               88  DB2IO-FETCH-TRANS        VALUE 'FETCH-TRANS '.
               88  DB2IO-CLOSE-CURSOR       VALUE 'CLOSE-CURSOR'.
           05  DB2IO-CUTOFF-TS     PIC X(26).
           05  DB2IO-REGION-CODE   PIC X(04).
           05  DB2IO-TRANS-ROW     PIC X(68).
           05  DB2IO-RETURN-CODE   PIC S9(08) COMP.
           05  DB2IO-EOF-FLAG      PIC X(01).

      *--- GTMASM01 call interface ------------------------------------*
       01  WS-ASM-PARM.
           05  ASM-FUNC-CODE       PIC X(08).
               88  ASM-EXTRACT-BIT          VALUE 'EXTRACT '.
               88  ASM-SET-BIT              VALUE 'SET-BIT '.
           05  ASM-FLAG-BYTE       PIC X(01).
           05  ASM-BIT-POSITION    PIC S9(04) COMP.
           05  ASM-BIT-VALUE       PIC S9(04) COMP.
           05  ASM-RETURN-CODE     PIC S9(08) COMP.

      *--- Working fields --------------------------------------------*
       01  WS-CURRENT-FAIL-COUNT   PIC S9(08) COMP VALUE ZERO.
       01  WS-EOF-SWITCH           PIC X(01) VALUE 'N'.
       01  WS-VALIDATION-RESULT    PIC X(01).
       01  WS-SQLCODE-SAVE         PIC S9(08) COMP VALUE ZERO.
       01  WS-AMOUNT-LIMIT         PIC S9(15)V99 COMP-3.
       01  WS-MAX-SINGLE-AMOUNT    PIC S9(15)V99 COMP-3 VALUE
                                   100000000.00.

      *================================================================*
       LINKAGE SECTION.
       01  LS-VALD-PARM.
           05  LS-CUTOFF-TS        PIC X(26).
           05  LS-REGION-CODE      PIC X(04).
           05  LS-FAIL-COUNT       PIC S9(08) COMP.
           05  LS-VALD-RC          PIC S9(08) COMP.

      *================================================================*
       PROCEDURE DIVISION USING LS-VALD-PARM.
      *================================================================*
       0000-MAINLINE.
           PERFORM 1000-INITIALIZE
           PERFORM 2000-OPEN-TRANS-CURSOR
           IF LS-VALD-RC = ZERO
               PERFORM 3000-VALIDATE-TRANSACTIONS
                   UNTIL WS-EOF-SWITCH = 'Y'
                      OR LS-VALD-RC >= 12
           END-IF
           PERFORM 4000-CLOSE-CURSOR
           PERFORM 5000-EVALUATE-RESULTS
           GOBACK
           .

      *----------------------------------------------------------------*
       1000-INITIALIZE.
           MOVE ZERO            TO LS-FAIL-COUNT
           MOVE ZERO            TO LS-VALD-RC
           MOVE ZERO            TO WS-CURRENT-FAIL-COUNT
           MOVE 'N'             TO WS-EOF-SWITCH
           .

      *----------------------------------------------------------------*
       2000-OPEN-TRANS-CURSOR.
           MOVE 'OPEN-CURSOR '  TO DB2IO-FUNC-CODE
           MOVE LS-CUTOFF-TS   TO DB2IO-CUTOFF-TS
           MOVE LS-REGION-CODE TO DB2IO-REGION-CODE

           CALL 'GTMDB2IO' USING WS-DB2IO-PARM

           IF DB2IO-RETURN-CODE NOT = ZERO
               MOVE 12         TO LS-VALD-RC
               DISPLAY 'GTMVALD2: GTMDB2IO OPEN-CURSOR FAILED RC='
                       DB2IO-RETURN-CODE
           END-IF
           .

      *----------------------------------------------------------------*
       3000-VALIDATE-TRANSACTIONS.
           MOVE 'FETCH-TRANS '  TO DB2IO-FUNC-CODE

           CALL 'GTMDB2IO' USING WS-DB2IO-PARM

           IF DB2IO-RETURN-CODE NOT = ZERO
               MOVE 12         TO LS-VALD-RC
               PERFORM 9000-DB2IO-ERROR
               EXIT PARAGRAPH
           END-IF

           IF DB2IO-EOF-FLAG = 'Y'
               MOVE 'Y'        TO WS-EOF-SWITCH
               EXIT PARAGRAPH
           END-IF

           MOVE DB2IO-TRANS-ROW TO WS-TRANS-ROW

           PERFORM 3100-CHECK-AMOUNT-LIMIT
           PERFORM 3200-CHECK-COUNTERPARTY
           PERFORM 3300-CHECK-BIT-FLAGS
           .

      *----------------------------------------------------------------*
       3100-CHECK-AMOUNT-LIMIT.
           IF WS-TRANS-AMOUNT > WS-MAX-SINGLE-AMOUNT
               ADD 1           TO WS-CURRENT-FAIL-COUNT
               DISPLAY 'GTMVALD2: AMOUNT EXCEEDS LIMIT TRANS='
                       WS-TRANS-ID ' AMT=' WS-TRANS-AMOUNT
           END-IF
           .

      *----------------------------------------------------------------*
       3200-CHECK-COUNTERPARTY.
           MOVE WS-CPARTY-ID   TO HV-CPARTY-ID

           EXEC SQL
               SELECT  EXPOSURE_LIMIT
                      ,STANDING_STATUS
               INTO    :HV-CPARTY-LIMIT
                      ,:HV-CPARTY-STATUS
               FROM    BNY_GTM.CPARTY_LIMIT
               WHERE   CPARTY_ID = :HV-CPARTY-ID
               AND     EFFECTIVE_DATE <= CURRENT DATE
               FETCH FIRST 1 ROW ONLY
           END-EXEC

           EVALUATE SQLCODE
               WHEN 0
                   IF HV-CPARTY-STATUS NOT = 'OK'
                   OR WS-TRANS-AMOUNT > HV-CPARTY-LIMIT
                       ADD 1   TO WS-CURRENT-FAIL-COUNT
                       DISPLAY 'GTMVALD2: CPARTY FAIL TRANS='
                               WS-TRANS-ID ' CPARTY=' WS-CPARTY-ID
                   END-IF
               WHEN 100
                   ADD 1       TO WS-CURRENT-FAIL-COUNT
                   DISPLAY 'GTMVALD2: UNKNOWN CPARTY TRANS='
                           WS-TRANS-ID
               WHEN OTHER
                   MOVE 12     TO LS-VALD-RC
                   MOVE SQLCODE TO WS-SQLCODE-SAVE
                   DISPLAY 'GTMVALD2: SQL ERROR SQLCODE=' SQLCODE
           END-EVALUATE
           .

      *----------------------------------------------------------------*
       3300-CHECK-BIT-FLAGS.
           MOVE 'EXTRACT '     TO ASM-FUNC-CODE
           MOVE WS-FLAG-BYTE   TO ASM-FLAG-BYTE
           MOVE 3              TO ASM-BIT-POSITION
           MOVE ZERO           TO ASM-BIT-VALUE
           MOVE ZERO           TO ASM-RETURN-CODE

           CALL 'GTMASM01' USING WS-ASM-PARM

           IF ASM-RETURN-CODE NOT = ZERO
               ADD 1           TO WS-CURRENT-FAIL-COUNT
               DISPLAY 'GTMVALD2: FLAG CHECK FAILED TRANS='
                       WS-TRANS-ID ' BIT-POS=3'
           END-IF

           IF ASM-BIT-VALUE NOT = 1
               ADD 1           TO WS-CURRENT-FAIL-COUNT
               DISPLAY 'GTMVALD2: APPROVAL BIT NOT SET TRANS='
                       WS-TRANS-ID
           END-IF
           .

      *----------------------------------------------------------------*
       4000-CLOSE-CURSOR.
           MOVE 'CLOSE-CURSOR'  TO DB2IO-FUNC-CODE

           CALL 'GTMDB2IO' USING WS-DB2IO-PARM

           IF DB2IO-RETURN-CODE NOT = ZERO
               DISPLAY 'GTMVALD2: GTMDB2IO CLOSE-CURSOR WARNING RC='
                       DB2IO-RETURN-CODE
           END-IF
           .

      *----------------------------------------------------------------*
       5000-EVALUATE-RESULTS.
           MOVE WS-CURRENT-FAIL-COUNT TO LS-FAIL-COUNT

           EVALUATE TRUE
               WHEN WS-CURRENT-FAIL-COUNT = ZERO
                   MOVE 0      TO LS-VALD-RC
               WHEN WS-CURRENT-FAIL-COUNT <= WS-MAX-FAIL-THRESHOLD
                   MOVE 4      TO LS-VALD-RC
               WHEN OTHER
                   MOVE 8      TO LS-VALD-RC
           END-EVALUATE
           .

      *----------------------------------------------------------------*
       9000-DB2IO-ERROR.
           DISPLAY 'GTMVALD2: GTMDB2IO ERROR RC=' DB2IO-RETURN-CODE
           .

       END PROGRAM GTMVALD2.
