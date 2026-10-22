      *================================================================*
      * PROGRAM  : GTMCICS4                                          *
      * TITLE    : CICS Online Settlement Cutoff Inquiry             *
      *                                                              *
      * DESCRIPTION:                                                 *
      *   CICS online transaction that allows operations staff to    *
      *   query the current settlement cutoff timestamp for a        *
      *   given settlement region and value date.  The program       *
      *   receives its input via the CICS COMMAREA (or TS queue),    *
      *   issues a DB2 SELECT against SETL_CTRL, and returns the    *
      *   COMPUTED_CUTOFF_TS to the caller's COMMAREA.               *
      *   At batch completion GTMSETL0 is invoked via START to       *
      *   trigger the full settlement cycle.                         *
      *                                                              *
      * TRANSACTION: GTM4 (defined in CICS CSD)                     *
      * CALLED BY : CICS transaction manager (terminal / API)       *
      * CALLS     : GTMSETL0 via EXEC CICS START (batch trigger)    *
      *                                                              *
      * DATA ACCESSED:                                               *
      *   DB2  - BNY_GTM.SETL_CTRL  (read only)                    *
      *                                                              *
      * RETURN CODES  (COMMAREA CA-RETURN-CODE):                    *
      *   0  - Cutoff found and returned in CA-CUTOFF-TS            *
      *   4  - No row found for supplied region / value date         *
      *   8  - DB2 error - see CA-ERR-MSG                           *
      *   12 - CICS error - see CA-ERR-MSG                          *
      *                                                              *
      * CHANGE LOG:                                                  *
      *   2024-03-10  R.HARRINGTON    Initial release (v1.0)        *
      *   2024-05-18  F.OKONKWO       Add COMMAREA length check      *
      *   2024-09-30  A.KOWALCZYK     Trigger GTMSETL0 on demand    *
      *================================================================*
       IDENTIFICATION DIVISION.
       PROGRAM-ID.  GTMCICS4.
       AUTHOR.      GTM PAYMENTS ENGINEERING.
       DATE-WRITTEN. 2024-03-10.

       ENVIRONMENT DIVISION.
       CONFIGURATION SECTION.
       SOURCE-COMPUTER.  IBM-ZOS.
       OBJECT-COMPUTER.  IBM-ZOS.

       DATA DIVISION.
       WORKING-STORAGE SECTION.

       EXEC SQL
           INCLUDE SQLCA
       END-EXEC.

       01  WS-PROGRAM-ID            PIC X(08) VALUE 'GTMCICS4'.
       01  WS-EXPECTED-CA-LEN       PIC S9(04) COMP VALUE 100.

      *--- DB2 host variables ----------------------------------------*
       01  HV-SETL-REGION           PIC X(04).
       01  HV-VALUE-DATE            PIC X(10).
       01  HV-COMPUTED-CUTOFF-TS    PIC X(26).
       01  HV-STATUS-CODE           PIC X(10).

      *--- Working fields --------------------------------------------*
       01  WS-RESP                  PIC S9(08) COMP VALUE ZERO.
       01  WS-RESP2                 PIC S9(08) COMP VALUE ZERO.
       01  WS-COMMAREA-LENGTH       PIC S9(04) COMP VALUE ZERO.
       01  WS-SQLCODE-SAVE          PIC S9(08) COMP VALUE ZERO.
       01  WS-ERR-MSG               PIC X(50) VALUE SPACES.
       01  WS-ABEND-CODE            PIC X(04) VALUE SPACES.

      *--- CICS START data area for GTMSETL0 trigger -----------------*
       01  WS-START-DATA.
           05  SD-SETL-REGION       PIC X(04).
           05  SD-VALUE-DATE        PIC X(10).
           05  SD-REQUESTER-ID      PIC X(08).

      *================================================================*
      * COMMAREA layout - shared with calling program / CICS API      *
      *================================================================*
       LINKAGE SECTION.
       01  DFHCOMMAREA.
           05  CA-FUNCTION-CODE     PIC X(04).
               88  CA-INQUIRE              VALUE 'INQ '.
               88  CA-TRIGGER-SETL         VALUE 'TRIG'.
           05  CA-SETL-REGION       PIC X(04).
           05  CA-VALUE-DATE        PIC X(10).
           05  CA-CUTOFF-TS         PIC X(26).
           05  CA-STATUS-CODE       PIC X(10).
           05  CA-RETURN-CODE       PIC S9(08) COMP.
           05  CA-ERR-MSG           PIC X(50).
           05  CA-FILLER            PIC X(08).

      *================================================================*
       PROCEDURE DIVISION.
      *================================================================*
       0000-MAINLINE.
           PERFORM 1000-INITIALIZE
           IF CA-RETURN-CODE = ZERO
               EVALUATE TRUE
                   WHEN CA-INQUIRE
                       PERFORM 2000-INQUIRE-CUTOFF
                   WHEN CA-TRIGGER-SETL
                       PERFORM 3000-TRIGGER-SETTLEMENT
                   WHEN OTHER
                       MOVE 8       TO CA-RETURN-CODE
                       MOVE 'INVALID FUNCTION CODE' TO CA-ERR-MSG
               END-EVALUATE
           END-IF
           PERFORM 9000-RETURN-TO-CICS
           .

      *----------------------------------------------------------------*
       1000-INITIALIZE.
           MOVE ZERO            TO CA-RETURN-CODE
           MOVE SPACES          TO CA-CUTOFF-TS
           MOVE SPACES          TO CA-ERR-MSG

           EXEC CICS ASSIGN
               CALEN(WS-COMMAREA-LENGTH)
               RESP(WS-RESP)
               RESP2(WS-RESP2)
           END-EXEC

           IF WS-COMMAREA-LENGTH < WS-EXPECTED-CA-LEN
               MOVE 12          TO CA-RETURN-CODE
               MOVE 'COMMAREA TOO SHORT' TO CA-ERR-MSG
               EXIT PARAGRAPH
           END-IF

           MOVE CA-SETL-REGION  TO HV-SETL-REGION
           MOVE CA-VALUE-DATE   TO HV-VALUE-DATE
           .

      *----------------------------------------------------------------*
       2000-INQUIRE-CUTOFF.
           EXEC SQL
               SELECT  COMPUTED_CUTOFF_TS
                      ,STATUS_CODE
               INTO    :HV-COMPUTED-CUTOFF-TS
                      ,:HV-STATUS-CODE
               FROM    BNY_GTM.SETL_CTRL
               WHERE   SETL_REGION = :HV-SETL-REGION
               AND     VALUE_DATE  = :HV-VALUE-DATE
               FETCH FIRST 1 ROW ONLY
           END-EXEC

           EVALUATE SQLCODE
               WHEN 0
                   MOVE HV-COMPUTED-CUTOFF-TS TO CA-CUTOFF-TS
                   MOVE HV-STATUS-CODE        TO CA-STATUS-CODE
                   MOVE ZERO                  TO CA-RETURN-CODE
               WHEN 100
                   MOVE 4       TO CA-RETURN-CODE
                   MOVE 'NO ROW FOUND FOR REGION/DATE'
                                TO CA-ERR-MSG
               WHEN OTHER
                   MOVE 8       TO CA-RETURN-CODE
                   MOVE SQLCODE TO WS-SQLCODE-SAVE
                   STRING 'DB2 ERROR SQLCODE=' DELIMITED SIZE
                          SQLCODE              DELIMITED SIZE
                       INTO CA-ERR-MSG
           END-EVALUATE
           .

      *----------------------------------------------------------------*
       3000-TRIGGER-SETTLEMENT.
           MOVE CA-SETL-REGION  TO SD-SETL-REGION
           MOVE CA-VALUE-DATE   TO SD-VALUE-DATE

           EXEC CICS ASSIGN
               USERID(SD-REQUESTER-ID)
               RESP(WS-RESP)
           END-EXEC

           EXEC CICS START
               TRANSID('GTM0')
               INTERVAL(0)
               FROM(WS-START-DATA)
               LENGTH(LENGTH OF WS-START-DATA)
               RESP(WS-RESP)
               RESP2(WS-RESP2)
           END-EXEC

           IF WS-RESP NOT = DFHRESP(NORMAL)
               MOVE 12          TO CA-RETURN-CODE
               STRING 'CICS START FAILED RESP=' DELIMITED SIZE
                      WS-RESP                   DELIMITED SIZE
                      ' RESP2='                 DELIMITED SIZE
                      WS-RESP2                  DELIMITED SIZE
                   INTO CA-ERR-MSG
           ELSE
               MOVE ZERO        TO CA-RETURN-CODE
               MOVE 'SETTLEMENT TRIGGER QUEUED' TO CA-ERR-MSG
           END-IF
           .

      *----------------------------------------------------------------*
       9000-RETURN-TO-CICS.
           EXEC CICS RETURN
               RESP(WS-RESP)
           END-EXEC
           .

       END PROGRAM GTMCICS4.
