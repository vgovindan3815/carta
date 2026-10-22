      *================================================================*
      * PROGRAM  : GTMSETL0                                          *
      * TITLE    : Settlement Cutoff Calculation                     *
      *                                                              *
      * DESCRIPTION:                                                 *
      *   Main settlement orchestrator for the Global Transaction    *
      *   Management (GTM) payment engine.  Reads the SETL_CTRL     *
      *   control table to obtain the base cutoff time and any      *
      *   override flags for the current settlement region and      *
      *   value date.  Delegates validation to GTMVALD2 and         *
      *   transaction posting to GTMPOST1.  On successful           *
      *   completion it broadcasts the computed cutoff timestamp     *
      *   back to SETL_CTRL for downstream consumers.               *
      *                                                              *
      * CALLED BY : GTMCICS4 (CICS online), GTMBATCH (batch JCL)   *
      * CALLS     : GTMVALD2  - pre-post validation module          *
      *             GTMPOST1  - transaction posting module           *
      *                                                              *
      * DATA ACCESSED:                                               *
      *   DB2  - BNY_GTM.SETL_CTRL  (read / update)                *
      *                                                              *
      * RETURN CODES:                                                *
      *   0  - Normal completion                                     *
      *   4  - Warning - validation failures within tolerance        *
      *   8  - Error   - cutoff not computable                      *
      *   12 - Severe  - DB2 or subsystem failure                   *
      *                                                              *
      * CHANGE LOG:                                                  *
      *   2024-03-01  R.HARRINGTON    Initial release (v1.0)        *
      *   2024-07-15  S.PATEL         Add override flag processing   *
      *   2024-11-20  A.KOWALCZYK     Daylight saving adjustment     *
      *================================================================*
       IDENTIFICATION DIVISION.
       PROGRAM-ID.  GTMSETL0.
       AUTHOR.      GTM PAYMENTS ENGINEERING.
       DATE-WRITTEN. 2024-03-01.

       ENVIRONMENT DIVISION.
       CONFIGURATION SECTION.
       SOURCE-COMPUTER.  IBM-ZOS.
       OBJECT-COMPUTER.  IBM-ZOS.

       INPUT-OUTPUT SECTION.
       FILE-CONTROL.

       DATA DIVISION.
       FILE SECTION.

      *----------------------------------------------------------------*
      * DB2 HOST-VARIABLE DECLARATIONS                                 *
      *----------------------------------------------------------------*
       WORKING-STORAGE SECTION.

       EXEC SQL
           INCLUDE SQLCA
       END-EXEC.

       01  WS-PROGRAM-ID            PIC X(08) VALUE 'GTMSETL0'.
       01  WS-PROGRAM-VERSION       PIC X(04) VALUE '1.02'.

      *--- Settlement control row from SETL_CTRL ----------------------*
       01  WS-SETL-CTRL-ROW.
           05  WS-SETL-REGION       PIC X(04).
           05  WS-VALUE-DATE        PIC X(10).
           05  WS-BASE-CUTOFF-TIME  PIC X(08).
           05  WS-OVERRIDE-FLAG     PIC X(01).
           05  WS-OVERRIDE-MINS     PIC S9(04) COMP.
           05  WS-CURRENCY-CODE     PIC X(03).
           05  WS-COMPUTED-CUTOFF   PIC X(26).

      *--- DB2 host variables -----------------------------------------*
       01  HV-SETL-REGION           PIC X(04).
       01  HV-VALUE-DATE            PIC X(10).
       01  HV-BASE-CUTOFF-TIME      PIC X(08).
       01  HV-OVERRIDE-FLAG         PIC X(01).
       01  HV-OVERRIDE-MINS         PIC S9(04) COMP.
       01  HV-CURRENCY-CODE         PIC X(03).
       01  HV-COMPUTED-CUTOFF-TS    PIC X(26).

      *--- Working fields ---------------------------------------------*
       01  WS-CUTOFF-TIMESTAMP      PIC X(26).
       01  WS-CUTOFF-MINUTES        PIC S9(04) COMP VALUE ZERO.
       01  WS-WORK-HHMMSS           PIC 9(06).
       01  WS-OVERRIDE-APPLIED      PIC X(01) VALUE 'N'.
       01  WS-RETURN-CODE           PIC S9(08) COMP VALUE ZERO.
       01  WS-FAIL-COUNT            PIC S9(08) COMP VALUE ZERO.
       01  WS-TXN-COUNT             PIC S9(08) COMP VALUE ZERO.
       01  WS-ABEND-CODE            PIC X(04) VALUE SPACES.

       01  WS-CURRENT-TIMESTAMP     PIC X(26).
       01  WS-FORMATTED-DATE        PIC X(10).
       01  WS-FORMATTED-TIME        PIC X(08).

      *--- Linkage area passed to sub-programs ------------------------*
       01  WS-VALD-PARM.
           05  LS-CUTOFF-TS         PIC X(26).
           05  LS-REGION-CODE       PIC X(04).
           05  LS-FAIL-COUNT        PIC S9(08) COMP.
           05  LS-VALD-RC           PIC S9(08) COMP.

       01  WS-POST-PARM.
           05  LS-POST-CUTOFF-TS    PIC X(26).
           05  LS-POST-REGION       PIC X(04).
           05  LS-TXN-COUNT         PIC S9(08) COMP.
           05  LS-POST-RC           PIC S9(08) COMP.

       01  WS-MISC.
           05  WS-INDEX             PIC S9(04) COMP.
           05  WS-SQLCODE-SAVE      PIC S9(08) COMP.

      *================================================================*
       PROCEDURE DIVISION.
      *================================================================*
       0000-MAINLINE.
           PERFORM 1000-INITIALIZE
           PERFORM 2000-READ-SETL-CTRL
           IF WS-RETURN-CODE = ZERO
               PERFORM 2100-COMPUTE-CUTOFF
               PERFORM 3000-CALL-VALIDATION
               IF WS-RETURN-CODE <= 4
                   PERFORM 4000-CALL-POSTING
               END-IF
               IF WS-RETURN-CODE <= 4
                   PERFORM 5000-UPDATE-CUTOFF-BROADCAST
               END-IF
           END-IF
           PERFORM 9000-TERMINATE
           STOP RUN
           .

      *----------------------------------------------------------------*
       1000-INITIALIZE.
           MOVE SPACES          TO WS-CUTOFF-TIMESTAMP
           MOVE ZERO            TO WS-RETURN-CODE
           MOVE ZERO            TO WS-FAIL-COUNT
           MOVE ZERO            TO WS-TXN-COUNT

           EXEC SQL
               SET :WS-CURRENT-TIMESTAMP = CURRENT TIMESTAMP
           END-EXEC

           IF SQLCODE NOT = 0
               MOVE 12          TO WS-RETURN-CODE
               MOVE SQLCODE     TO WS-SQLCODE-SAVE
               PERFORM 9100-SQL-ERROR
           END-IF
           .

      *----------------------------------------------------------------*
       2000-READ-SETL-CTRL.
           MOVE WS-SETL-REGION  TO HV-SETL-REGION
           MOVE WS-VALUE-DATE   TO HV-VALUE-DATE

           EXEC SQL
               SELECT  BASE_CUTOFF_TIME
                      ,OVERRIDE_FLAG
                      ,OVERRIDE_MINS
                      ,CURRENCY_CODE
               INTO    :HV-BASE-CUTOFF-TIME
                      ,:HV-OVERRIDE-FLAG
                      ,:HV-OVERRIDE-MINS
                      ,:HV-CURRENCY-CODE
               FROM    BNY_GTM.SETL_CTRL
               WHERE   SETL_REGION = :HV-SETL-REGION
               AND     VALUE_DATE  = :HV-VALUE-DATE
               AND     STATUS_CODE = 'OPEN'
           END-EXEC

           EVALUATE SQLCODE
               WHEN 0
                   MOVE HV-BASE-CUTOFF-TIME TO WS-BASE-CUTOFF-TIME
                   MOVE HV-OVERRIDE-FLAG    TO WS-OVERRIDE-FLAG
                   MOVE HV-OVERRIDE-MINS    TO WS-OVERRIDE-MINUTES
                   MOVE HV-CURRENCY-CODE    TO WS-CURRENCY-CODE
               WHEN 100
                   MOVE 8           TO WS-RETURN-CODE
               WHEN OTHER
                   MOVE 12          TO WS-RETURN-CODE
                   PERFORM 9100-SQL-ERROR
           END-EVALUATE
           .

      *----------------------------------------------------------------*
       2100-COMPUTE-CUTOFF.
           MOVE WS-BASE-CUTOFF-TIME TO WS-WORK-HHMMSS

           IF WS-OVERRIDE-FLAG = 'Y'
               ADD WS-OVERRIDE-MINUTES TO WS-OVERRIDE-APPLIED
               MOVE 'Y'  TO WS-OVERRIDE-APPLIED
           END-IF

           STRING WS-VALUE-DATE      DELIMITED SIZE
                  '-'                DELIMITED SIZE
                  WS-BASE-CUTOFF-TIME DELIMITED SIZE
                  '.000000'          DELIMITED SIZE
               INTO WS-CUTOFF-TIMESTAMP
           .

      *----------------------------------------------------------------*
       3000-CALL-VALIDATION.
           MOVE WS-CUTOFF-TIMESTAMP TO LS-CUTOFF-TS  OF WS-VALD-PARM
           MOVE WS-SETL-REGION      TO LS-REGION-CODE OF WS-VALD-PARM
           MOVE ZERO                TO LS-FAIL-COUNT  OF WS-VALD-PARM
           MOVE ZERO                TO LS-VALD-RC     OF WS-VALD-PARM

           CALL 'GTMVALD2' USING WS-VALD-PARM

           MOVE LS-FAIL-COUNT OF WS-VALD-PARM TO WS-FAIL-COUNT
           MOVE LS-VALD-RC    OF WS-VALD-PARM TO WS-RETURN-CODE
           .

      *----------------------------------------------------------------*
       4000-CALL-POSTING.
           MOVE WS-CUTOFF-TIMESTAMP TO LS-POST-CUTOFF-TS OF WS-POST-PARM
           MOVE WS-SETL-REGION      TO LS-POST-REGION    OF WS-POST-PARM
           MOVE ZERO                TO LS-TXN-COUNT      OF WS-POST-PARM
           MOVE ZERO                TO LS-POST-RC        OF WS-POST-PARM

           CALL 'GTMPOST1' USING WS-POST-PARM

           MOVE LS-TXN-COUNT OF WS-POST-PARM TO WS-TXN-COUNT
           MOVE LS-POST-RC   OF WS-POST-PARM TO WS-RETURN-CODE
           .

      *----------------------------------------------------------------*
       5000-UPDATE-CUTOFF-BROADCAST.
           MOVE WS-CUTOFF-TIMESTAMP TO HV-COMPUTED-CUTOFF-TS
           MOVE WS-SETL-REGION      TO HV-SETL-REGION
           MOVE WS-VALUE-DATE       TO HV-VALUE-DATE

           EXEC SQL
               UPDATE  BNY_GTM.SETL_CTRL
               SET     COMPUTED_CUTOFF_TS = :HV-COMPUTED-CUTOFF-TS
                      ,STATUS_CODE        = 'BROADCAST'
                      ,LAST_UPD_TS        = CURRENT TIMESTAMP
                      ,LAST_UPD_PGM       = 'GTMSETL0'
               WHERE   SETL_REGION = :HV-SETL-REGION
               AND     VALUE_DATE  = :HV-VALUE-DATE
           END-EXEC

           IF SQLCODE NOT = 0
               MOVE 12 TO WS-RETURN-CODE
               PERFORM 9100-SQL-ERROR
           END-IF
           .

      *----------------------------------------------------------------*
       9000-TERMINATE.
           MOVE WS-RETURN-CODE TO RETURN-CODE
           .

       9100-SQL-ERROR.
           DISPLAY 'GTMSETL0: SQL ERROR SQLCODE=' SQLCODE
                   ' REGION=' WS-SETL-REGION
           .

       END PROGRAM GTMSETL0.
