       IDENTIFICATION DIVISION.
       PROGRAM-ID. GTMSETL0.
       ENVIRONMENT DIVISION.
       DATA DIVISION.
       WORKING-STORAGE SECTION.
       01  WS-VARS.
           05  WS-PROG-NAME    PIC X(8)   VALUE 'GTMPOST1'.
           05  WS-SQLCODE      PIC S9(9)  COMP.
       COPY CUSTDATA.
       PROCEDURE DIVISION.
       MAIN-PARA.
           PERFORM INIT-PARA
           PERFORM PROC-PARA UNTIL WS-SQLCODE = 0
           CALL 'GTMVALID' USING WS-VARS
           CALL WS-PROG-NAME USING WS-VARS
           STOP RUN.
       INIT-PARA.
           EXEC SQL
               SELECT CUST_ID INTO :WS-SQLCODE
               FROM CUSTOMER
               WHERE STATUS = 'A'
           END-EXEC.
       PROC-PARA.
           EXEC CICS
               LINK PROGRAM('GTMCICS1')
           END-EXEC.
       CLEANUP-PARA.
           EXIT.
