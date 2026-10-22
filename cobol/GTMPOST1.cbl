      *================================================================*
      * PROGRAM  : GTMPOST1                                          *
      * TITLE    : Transaction Posting Module                        *
      *                                                              *
      * DESCRIPTION:                                                 *
      *   Receives the computed settlement cutoff timestamp from     *
      *   GTMSETL0 via a CALL interface.  Queries all pending        *
      *   transactions from the TRANS_PENDING DB2 table whose       *
      *   value date and region fall within the cutoff.  Approved   *
      *   transactions are written to the GLEDGER sequential flat   *
      *   file for downstream general-ledger ingestion.             *
      *   Returns TXN-COUNT (transactions posted) and RETURN-CODE   *
      *   to the calling program.                                    *
      *                                                              *
      * CALLED BY : GTMSETL0 (settlement orchestrator)              *
      * CALLS     : None                                             *
      *                                                              *
      * DATA ACCESSED:                                               *
      *   DB2  - BNY_GTM.TRANS_PENDING  (read via cursor)           *
      *   FILE - GLEDGER  (sequential write, DD in JCL)             *
      *                                                              *
      * RETURN CODES:                                                *
      *   0  - Normal - all pending transactions posted              *
      *   4  - Warning - partial post, threshold not exceeded        *
      *   8  - Error   - file I/O failure                           *
      *   12 - Severe  - DB2 failure                                *
      *                                                              *
      * CHANGE LOG:                                                  *
      *   2024-03-01  R.HARRINGTON    Initial release (v1.0)        *
      *   2024-08-10  D.MBEKI         GLEDGER record layout v2      *
      *================================================================*
       IDENTIFICATION DIVISION.
       PROGRAM-ID.  GTMPOST1.
       AUTHOR.      GTM PAYMENTS ENGINEERING.
       DATE-WRITTEN. 2024-03-01.

       ENVIRONMENT DIVISION.
       CONFIGURATION SECTION.
       SOURCE-COMPUTER.  IBM-ZOS.
       OBJECT-COMPUTER.  IBM-ZOS.

       INPUT-OUTPUT SECTION.
       FILE-CONTROL.
           SELECT GLEDGER-FILE
               ASSIGN TO GLEDGER
               ORGANIZATION IS SEQUENTIAL
               ACCESS MODE  IS SEQUENTIAL
               FILE STATUS  IS WS-GLEDGER-STATUS.

       DATA DIVISION.
       FILE SECTION.
       FD  GLEDGER-FILE
           RECORDING MODE IS F
           BLOCK CONTAINS 0 RECORDS
           RECORD CONTAINS 200 CHARACTERS.
       01  GLEDGER-RECORD               PIC X(200).

      *================================================================*
       WORKING-STORAGE SECTION.

       EXEC SQL
           INCLUDE SQLCA
       END-EXEC.

       01  WS-PROGRAM-ID                PIC X(08) VALUE 'GTMPOST1'.

      *--- GLEDGER output record layout ------------------------------*
       01  WS-GL-REC.
           05  GL-REC-TYPE              PIC X(02) VALUE 'TX'.
           05  GL-TRANS-ID              PIC X(16).
           05  GL-ACCOUNT-NO            PIC X(18).
           05  GL-DEBIT-CREDIT-IND      PIC X(01).
           05  GL-AMOUNT                PIC S9(15)V99 COMP-3.
           05  GL-CURRENCY-CODE         PIC X(03).
           05  GL-VALUE-DATE            PIC X(10).
           05  GL-CUTOFF-TS             PIC X(26).
           05  GL-POSTING-PGM           PIC X(08).
           05  GL-FILLER                PIC X(91).

      *--- DB2 host variables ----------------------------------------*
       01  HV-CUTOFF-TS                 PIC X(26).
       01  HV-TRANS-ID                  PIC X(16).
       01  HV-ACCOUNT-NO                PIC X(18).
       01  HV-DC-IND                    PIC X(01).
       01  HV-AMOUNT                    PIC S9(15)V99 COMP-3.
       01  HV-CURRENCY-CODE             PIC X(03).
       01  HV-VALUE-DATE                PIC X(10).
       01  HV-REGION-CODE               PIC X(04).

       EXEC SQL
           DECLARE TRANS-CURSOR CURSOR FOR
               SELECT  TRANS_ID
                      ,ACCOUNT_NO
                      ,DC_INDICATOR
                      ,TRANS_AMOUNT
                      ,CURRENCY_CODE
                      ,VALUE_DATE
               FROM    BNY_GTM.TRANS_PENDING
               WHERE   SETL_REGION   = :HV-REGION-CODE
               AND     VALUE_DATE   <= :HV-VALUE-DATE
               AND     TRANS_STATUS  = 'APPROVED'
               AND     CUTOFF_TS    <= :HV-CUTOFF-TS
               ORDER BY TRANS_ID
       END-EXEC.

      *--- Working fields --------------------------------------------*
       01  WS-EOF-SWITCH                PIC X(01) VALUE 'N'.
       01  WS-GLEDGER-STATUS            PIC X(02) VALUE SPACES.
       01  WS-SQLCODE-SAVE              PIC S9(08) COMP VALUE ZERO.
       01  WS-FILE-OPEN                 PIC X(01) VALUE 'N'.
       01  WS-CURSOR-OPEN               PIC X(01) VALUE 'N'.

      *================================================================*
       LINKAGE SECTION.
       01  LS-POST-PARM.
           05  LS-POST-CUTOFF-TS        PIC X(26).
           05  LS-POST-REGION           PIC X(04).
           05  LS-TXN-COUNT             PIC S9(08) COMP.
           05  LS-POST-RC               PIC S9(08) COMP.

      *================================================================*
       PROCEDURE DIVISION USING LS-POST-PARM.
      *================================================================*
       0000-MAINLINE.
           PERFORM 1000-INITIALIZE
           PERFORM 2000-OPEN-RESOURCES
           IF LS-POST-RC = ZERO
               PERFORM 3000-FETCH-AND-POST
                   UNTIL WS-EOF-SWITCH = 'Y'
                      OR LS-POST-RC > 4
           END-IF
           PERFORM 9000-CLOSE-RESOURCES
           GOBACK
           .

      *----------------------------------------------------------------*
       1000-INITIALIZE.
           MOVE ZERO            TO LS-TXN-COUNT
           MOVE ZERO            TO LS-POST-RC
           MOVE 'N'             TO WS-EOF-SWITCH
           MOVE 'N'             TO WS-FILE-OPEN
           MOVE 'N'             TO WS-CURSOR-OPEN

           MOVE LS-POST-CUTOFF-TS TO HV-CUTOFF-TS
           MOVE LS-POST-REGION    TO HV-REGION-CODE

           MOVE LS-POST-CUTOFF-TS(1:10) TO HV-VALUE-DATE
           .

      *----------------------------------------------------------------*
       2000-OPEN-RESOURCES.
           OPEN OUTPUT GLEDGER-FILE
           IF WS-GLEDGER-STATUS NOT = '00'
               MOVE 8           TO LS-POST-RC
               DISPLAY 'GTMPOST1: OPEN GLEDGER FAILED STATUS='
                       WS-GLEDGER-STATUS
               EXIT PARAGRAPH
           END-IF
           MOVE 'Y'             TO WS-FILE-OPEN

           EXEC SQL
               OPEN TRANS-CURSOR
           END-EXEC
           IF SQLCODE NOT = 0
               MOVE 12          TO LS-POST-RC
               PERFORM 9100-SQL-ERROR
               EXIT PARAGRAPH
           END-IF
           MOVE 'Y'             TO WS-CURSOR-OPEN
           .

      *----------------------------------------------------------------*
       3000-FETCH-AND-POST.
           EXEC SQL
               FETCH TRANS-CURSOR
               INTO  :HV-TRANS-ID
                    ,:HV-ACCOUNT-NO
                    ,:HV-DC-IND
                    ,:HV-AMOUNT
                    ,:HV-CURRENCY-CODE
                    ,:HV-VALUE-DATE
           END-EXEC

           EVALUATE SQLCODE
               WHEN 0
                   PERFORM 3100-WRITE-GL-RECORD
               WHEN 100
                   MOVE 'Y'     TO WS-EOF-SWITCH
               WHEN OTHER
                   MOVE 12      TO LS-POST-RC
                   PERFORM 9100-SQL-ERROR
           END-EVALUATE
           .

      *----------------------------------------------------------------*
       3100-WRITE-GL-RECORD.
           MOVE SPACES          TO WS-GL-REC
           MOVE 'TX'            TO GL-REC-TYPE
           MOVE HV-TRANS-ID     TO GL-TRANS-ID
           MOVE HV-ACCOUNT-NO   TO GL-ACCOUNT-NO
           MOVE HV-DC-IND       TO GL-DEBIT-CREDIT-IND
           MOVE HV-AMOUNT       TO GL-AMOUNT
           MOVE HV-CURRENCY-CODE TO GL-CURRENCY-CODE
           MOVE HV-VALUE-DATE   TO GL-VALUE-DATE
           MOVE HV-CUTOFF-TS    TO GL-CUTOFF-TS
           MOVE WS-PROGRAM-ID   TO GL-POSTING-PGM

           MOVE WS-GL-REC       TO GLEDGER-RECORD
           WRITE GLEDGER-RECORD

           IF WS-GLEDGER-STATUS NOT = '00'
               MOVE 8           TO LS-POST-RC
               DISPLAY 'GTMPOST1: WRITE GLEDGER FAILED STATUS='
                       WS-GLEDGER-STATUS
               EXIT PARAGRAPH
           END-IF

           ADD 1                TO LS-TXN-COUNT
           .

      *----------------------------------------------------------------*
       9000-CLOSE-RESOURCES.
           IF WS-CURSOR-OPEN = 'Y'
               EXEC SQL
                   CLOSE TRANS-CURSOR
               END-EXEC
           END-IF

           IF WS-FILE-OPEN = 'Y'
               CLOSE GLEDGER-FILE
           END-IF
           .

       9100-SQL-ERROR.
           MOVE SQLCODE         TO WS-SQLCODE-SAVE
           DISPLAY 'GTMPOST1: SQL ERROR SQLCODE=' SQLCODE
           .

       END PROGRAM GTMPOST1.
