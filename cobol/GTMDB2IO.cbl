      *================================================================*
      * PROGRAM  : GTMDB2IO                                          *
      * TITLE    : DB2 I/O Dispatcher for GTM Settlement             *
      *                                                              *
      * DESCRIPTION:                                                 *
      *   Central DB2 access module for the GTM settlement sub-      *
      *   system.  Owns all SQL against SETL_CTRL and the           *
      *   TRANS_PENDING cursor lifecycle.  Callers supply a          *
      *   function-code parameter and a shared parameter block;      *
      *   this module dispatches to the appropriate internal         *
      *   paragraph.  The design isolates SQL from business logic    *
      *   and provides a single point of change for DB2 access       *
      *   patterns, SQLCA handling, and cursor management.           *
      *                                                              *
      *   Supported function codes:                                  *
      *     GET-CTRL-ROW  - Fetch single SETL_CTRL row               *
      *     UPDATE-CUTOFF - Write computed cutoff to SETL_CTRL       *
      *     OPEN-CURSOR   - Open TRANS_PENDING cursor                *
      *     FETCH-TRANS   - Fetch next row from TRANS_PENDING cursor *
      *     CLOSE-CURSOR  - Close TRANS_PENDING cursor               *
      *                                                              *
      * CALLED BY : GTMSETL0 (GET-CTRL-ROW, UPDATE-CUTOFF)          *
      *             GTMVALD2 (OPEN-CURSOR, FETCH-TRANS, CLOSE-CURSOR)*
      *                                                              *
      * DATA ACCESSED:                                               *
      *   DB2  - BNY_GTM.SETL_CTRL     (read / update)              *
      *   DB2  - BNY_GTM.TRANS_PENDING (cursor read)                *
      *                                                              *
      * RETURN CODES  (DB2IO-RETURN-CODE):                           *
      *   0   - Normal                                               *
      *   4   - Not found (SQLCODE +100)                             *
      *   8   - DB2 error                                            *
      *   16  - Unknown function code                                *
      *                                                              *
      * CHANGE LOG:                                                  *
      *   2024-03-01  R.HARRINGTON    Initial release (v1.0)        *
      *   2024-07-05  D.MBEKI         Add FETCH-TRANS function       *
      *   2024-10-14  S.PATEL         Cursor WITH UR for validation  *
      *================================================================*
       IDENTIFICATION DIVISION.
       PROGRAM-ID.  GTMDB2IO.
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

       01  WS-PROGRAM-ID            PIC X(08) VALUE 'GTMDB2IO'.
       01  WS-CURSOR-STATE          PIC X(01) VALUE 'C'.
           88  CURSOR-OPEN                   VALUE 'O'.
           88  CURSOR-CLOSED                 VALUE 'C'.

      *--- Internal host variables ------------------------------------*
       01  HV-SETL-REGION           PIC X(04).
       01  HV-VALUE-DATE            PIC X(10).
       01  HV-BASE-CUTOFF-TIME      PIC X(08).
       01  HV-OVERRIDE-FLAG         PIC X(01).
       01  HV-OVERRIDE-MINS         PIC S9(04) COMP.
       01  HV-CURRENCY-CODE         PIC X(03).
       01  HV-COMPUTED-CUTOFF-TS    PIC X(26).
       01  HV-STATUS-CODE           PIC X(10).
       01  HV-CUTOFF-TS             PIC X(26).

      *--- Fetch host variables for TRANS_PENDING ---------------------*
       01  HV-TRANS-ID              PIC X(16).
       01  HV-ACCOUNT-NO            PIC X(18).
       01  HV-DC-IND                PIC X(01).
       01  HV-AMOUNT                PIC S9(15)V99 COMP-3.
       01  HV-TXN-CURRENCY          PIC X(03).
       01  HV-CPARTY-ID             PIC X(10).
       01  HV-FLAG-BYTE             PIC X(01).
       01  HV-TXN-VALUE-DATE        PIC X(10).

       EXEC SQL
           DECLARE PEND-CURSOR CURSOR WITH HOLD FOR
               SELECT  TRANS_ID
                      ,ACCOUNT_NO
                      ,DC_INDICATOR
                      ,TRANS_AMOUNT
                      ,CURRENCY_CODE
                      ,CPARTY_ID
                      ,FLAG_BYTE
                      ,VALUE_DATE
               FROM    BNY_GTM.TRANS_PENDING
               WHERE   SETL_REGION   = :HV-SETL-REGION
               AND     TRANS_STATUS  = 'APPROVED'
               AND     CUTOFF_TS    <= :HV-CUTOFF-TS
               ORDER BY TRANS_ID
               FOR READ ONLY
               WITH UR
       END-EXEC.

      *--- Working fields --------------------------------------------*
       01  WS-SQLCODE-SAVE          PIC S9(08) COMP VALUE ZERO.

      *================================================================*
       LINKAGE SECTION.
       01  LS-DB2IO-PARM.
           05  DB2IO-FUNC-CODE      PIC X(12).
               88  FUNC-GET-CTRL-ROW        VALUE 'GET-CTRL-ROW'.
               88  FUNC-UPDATE-CUTOFF       VALUE 'UPDATE-CUTOFF'.
               88  FUNC-OPEN-CURSOR         VALUE 'OPEN-CURSOR '.
               88  FUNC-FETCH-TRANS         VALUE 'FETCH-TRANS '.
               88  FUNC-CLOSE-CURSOR        VALUE 'CLOSE-CURSOR'.
           05  DB2IO-CUTOFF-TS      PIC X(26).
           05  DB2IO-REGION-CODE    PIC X(04).
           05  DB2IO-TRANS-ROW.
               10  DT-TRANS-ID      PIC X(16).
               10  DT-ACCOUNT-NO    PIC X(18).
               10  DT-DC-IND        PIC X(01).
               10  DT-AMOUNT        PIC S9(15)V99 COMP-3.
               10  DT-CURRENCY-CODE PIC X(03).
               10  DT-CPARTY-ID     PIC X(10).
               10  DT-FLAG-BYTE     PIC X(01).
               10  DT-VALUE-DATE    PIC X(10).
               10  DT-FILLER        PIC X(05).
           05  DB2IO-RETURN-CODE    PIC S9(08) COMP.
           05  DB2IO-EOF-FLAG       PIC X(01).

      *================================================================*
       PROCEDURE DIVISION USING LS-DB2IO-PARM.
      *================================================================*
       0000-MAINLINE.
           MOVE ZERO            TO DB2IO-RETURN-CODE
           MOVE 'N'             TO DB2IO-EOF-FLAG

           EVALUATE TRUE
               WHEN FUNC-GET-CTRL-ROW
                   PERFORM 1000-GET-CTRL-ROW
               WHEN FUNC-UPDATE-CUTOFF
                   PERFORM 2000-UPDATE-CUTOFF
               WHEN FUNC-OPEN-CURSOR
                   PERFORM 3000-OPEN-PEND-CURSOR
               WHEN FUNC-FETCH-TRANS
                   PERFORM 4000-FETCH-TRANS
               WHEN FUNC-CLOSE-CURSOR
                   PERFORM 5000-CLOSE-PEND-CURSOR
               WHEN OTHER
                   MOVE 16      TO DB2IO-RETURN-CODE
                   DISPLAY 'GTMDB2IO: UNKNOWN FUNC-CODE='
                           DB2IO-FUNC-CODE
           END-EVALUATE

           GOBACK
           .

      *----------------------------------------------------------------*
       1000-GET-CTRL-ROW.
           MOVE DB2IO-REGION-CODE TO HV-SETL-REGION

           EXEC SQL
               SELECT  BASE_CUTOFF_TIME
                      ,OVERRIDE_FLAG
                      ,OVERRIDE_MINS
                      ,CURRENCY_CODE
                      ,COMPUTED_CUTOFF_TS
                      ,STATUS_CODE
               INTO    :HV-BASE-CUTOFF-TIME
                      ,:HV-OVERRIDE-FLAG
                      ,:HV-OVERRIDE-MINS
                      ,:HV-CURRENCY-CODE
                      ,:HV-COMPUTED-CUTOFF-TS
                      ,:HV-STATUS-CODE
               FROM    BNY_GTM.SETL_CTRL
               WHERE   SETL_REGION = :HV-SETL-REGION
               AND     VALUE_DATE  = :HV-VALUE-DATE
               AND     STATUS_CODE = 'OPEN'
               FETCH FIRST 1 ROW ONLY
           END-EXEC

           PERFORM 9000-EVALUATE-SQLCODE
           .

      *----------------------------------------------------------------*
       2000-UPDATE-CUTOFF.
           MOVE DB2IO-REGION-CODE TO HV-SETL-REGION
           MOVE DB2IO-CUTOFF-TS   TO HV-COMPUTED-CUTOFF-TS

           EXEC SQL
               UPDATE  BNY_GTM.SETL_CTRL
               SET     COMPUTED_CUTOFF_TS = :HV-COMPUTED-CUTOFF-TS
                      ,STATUS_CODE        = 'BROADCAST'
                      ,LAST_UPD_TS        = CURRENT TIMESTAMP
                      ,LAST_UPD_PGM       = 'GTMDB2IO'
               WHERE   SETL_REGION = :HV-SETL-REGION
               AND     VALUE_DATE  = :HV-VALUE-DATE
           END-EXEC

           PERFORM 9000-EVALUATE-SQLCODE
           .

      *----------------------------------------------------------------*
       3000-OPEN-PEND-CURSOR.
           MOVE DB2IO-REGION-CODE TO HV-SETL-REGION
           MOVE DB2IO-CUTOFF-TS   TO HV-CUTOFF-TS

           EXEC SQL
               OPEN PEND-CURSOR
           END-EXEC

           IF SQLCODE = 0
               SET CURSOR-OPEN  TO TRUE
           ELSE
               MOVE 8           TO DB2IO-RETURN-CODE
               PERFORM 9100-SQL-ERROR
           END-IF
           .

      *----------------------------------------------------------------*
       4000-FETCH-TRANS.
           IF CURSOR-CLOSED
               MOVE 8           TO DB2IO-RETURN-CODE
               DISPLAY 'GTMDB2IO: FETCH ON CLOSED CURSOR'
               EXIT PARAGRAPH
           END-IF

           EXEC SQL
               FETCH PEND-CURSOR
               INTO  :HV-TRANS-ID
                    ,:HV-ACCOUNT-NO
                    ,:HV-DC-IND
                    ,:HV-AMOUNT
                    ,:HV-TXN-CURRENCY
                    ,:HV-CPARTY-ID
                    ,:HV-FLAG-BYTE
                    ,:HV-TXN-VALUE-DATE
           END-EXEC

           EVALUATE SQLCODE
               WHEN 0
                   MOVE HV-TRANS-ID         TO DT-TRANS-ID
                   MOVE HV-ACCOUNT-NO       TO DT-ACCOUNT-NO
                   MOVE HV-DC-IND           TO DT-DC-IND
                   MOVE HV-AMOUNT           TO DT-AMOUNT
                   MOVE HV-TXN-CURRENCY     TO DT-CURRENCY-CODE
                   MOVE HV-CPARTY-ID        TO DT-CPARTY-ID
                   MOVE HV-FLAG-BYTE        TO DT-FLAG-BYTE
                   MOVE HV-TXN-VALUE-DATE   TO DT-VALUE-DATE
                   MOVE 'N'                 TO DB2IO-EOF-FLAG
               WHEN 100
                   MOVE 'Y'                 TO DB2IO-EOF-FLAG
                   MOVE 0                   TO DB2IO-RETURN-CODE
               WHEN OTHER
                   MOVE 8                   TO DB2IO-RETURN-CODE
                   PERFORM 9100-SQL-ERROR
           END-EVALUATE
           .

      *----------------------------------------------------------------*
       5000-CLOSE-PEND-CURSOR.
           EXEC SQL
               CLOSE PEND-CURSOR
           END-EXEC
           SET CURSOR-CLOSED    TO TRUE

           IF SQLCODE NOT = 0
               MOVE 8           TO DB2IO-RETURN-CODE
               PERFORM 9100-SQL-ERROR
           END-IF
           .

      *----------------------------------------------------------------*
       9000-EVALUATE-SQLCODE.
           EVALUATE SQLCODE
               WHEN 0
                   MOVE 0       TO DB2IO-RETURN-CODE
               WHEN 100
                   MOVE 4       TO DB2IO-RETURN-CODE
               WHEN OTHER
                   MOVE 8       TO DB2IO-RETURN-CODE
                   PERFORM 9100-SQL-ERROR
           END-EVALUATE
           .

       9100-SQL-ERROR.
           MOVE SQLCODE         TO WS-SQLCODE-SAVE
           DISPLAY 'GTMDB2IO: SQL ERROR FUNC=' DB2IO-FUNC-CODE
                   ' SQLCODE=' SQLCODE
           .

       END PROGRAM GTMDB2IO.
