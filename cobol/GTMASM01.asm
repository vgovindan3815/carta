***********************************************************************
* MODULE   : GTMASM01                                                *
* TITLE    : Bit-Field Manipulation Utility                          *
*                                                                     *
* DESCRIPTION:                                                        *
*   IBM High Level Assembler (HLASM) utility providing extract and    *
*   set operations on a packed flag byte.  Called dynamically by     *
*   GTMVALD2 to inspect or modify transaction status bit fields      *
*   without requiring COBOL REDEFINES gymnastics.                    *
*                                                                     *
*   The caller passes a parameter block in standard OS linkage       *
*   convention (R1 -> address of parameter list).  The parameter     *
*   block layout mirrors the COBOL WS-ASM-PARM 01-level item.       *
*                                                                     *
*   Supported function codes (offset 0, 8 bytes):                   *
*     'EXTRACT ' - isolate a single bit at ASM-BIT-POSITION (0-7)   *
*                  and return 0 or 1 in ASM-BIT-VALUE                *
*     'SET-BIT ' - set or clear bit at ASM-BIT-POSITION according   *
*                  to ASM-BIT-VALUE (0=clear, 1=set)                 *
*                                                                     *
* CALLED BY : GTMVALD2  (dynamic CALL)                               *
* CALLS     : None                                                    *
*                                                                     *
* REGISTERS ON ENTRY:                                                 *
*   R1  -> address of parameter block (COBOL CALL BY REFERENCE)     *
*   R13 -> 72-byte save area provided by caller                     *
*   R14 -> return address                                             *
*   R15 -> entry address (used for return code)                      *
*                                                                     *
* RETURN CODE (R15):                                                  *
*   0  - Normal                                                       *
*   8  - Invalid function code or bit position out of range          *
*                                                                     *
* PARAMETER BLOCK OFFSETS:                                            *
*   +0   FUNC-CODE      8 bytes  character                           *
*   +8   FLAG-BYTE      1 byte   target/source byte                  *
*   +9   BIT-POSITION   2 bytes  halfword binary (0-7, left=0)      *
*   +11  BIT-VALUE      2 bytes  halfword binary                     *
*   +13  RETURN-CODE    4 bytes  fullword binary                     *
*                                                                     *
* CHANGE LOG:                                                         *
*   2024-06-20  Y.TANAKA       Initial release (v1.0)                *
*   2024-08-04  Y.TANAKA       Add range check on BIT-POSITION       *
***********************************************************************
GTMASM01 CSECT
GTMASM01 AMODE 31
GTMASM01 RMODE ANY
*
         USING  *,R12              Base register
         STM    R14,R12,12(R13)    Save caller's registers
         LR     R12,R15            Establish base
         LR     R9,R13             Keep caller save area
         LA     R13,SAVEAREA       Our save area
         ST     R9,4(,R13)         Chain save areas (back)
         ST     R13,8(,R9)         Chain save areas (forward)
*
*--- Load parameter block address from R1 ---------------------------*
         L      R2,0(,R1)          R2 -> parameter block
         USING  PARMBLK,R2
*
*--- Validate bit position (must be 0-7) ----------------------------*
         LH     R4,PB_BITPOS       Load bit position
         LTR    R4,R4
         BM     BADPOS             Negative: error
         CHI    R4,7               Compare with 7
         BH     BADPOS             > 7: error
*
*--- Dispatch on function code --------------------------------------*
         CLC    PB_FUNC,=CL8'EXTRACT '
         BE     DO_EXTRACT
         CLC    PB_FUNC,=CL8'SET-BIT '
         BE     DO_SETBIT
*
*--- Unknown function code ------------------------------------------*
BADFUNC  MVC    PB_RC,=F'8'        Set return code 8
         B      EXIT
*
BADPOS   MVC    PB_RC,=F'8'        Set return code 8
         B      EXIT
*
***********************************************************************
* EXTRACT: isolate bit at PB_BITPOS from PB_FLAGBYTE                *
***********************************************************************
DO_EXTRACT DS   0H
         LH     R4,PB_BITPOS       Bit position (0=leftmost)
         IC     R5,PB_FLAGBYTE     Load flag byte into R5 low byte
         LA     R6,7               Compute shift count: 7 - PB_BITPOS
         SR     R6,R4              R6 = 7 - bitpos
         SRL    R5,0(R6)           Shift right by (7-bitpos)
         N      R5,=F'1'           Mask to low-order bit
         STH    R5,PB_BITVAL       Store 0 or 1 into bit-value
         MVC    PB_RC,=F'0'        Return code 0
         B      EXIT
*
***********************************************************************
* SET-BIT: set or clear bit at PB_BITPOS in PB_FLAGBYTE             *
***********************************************************************
DO_SETBIT DS    0H
         LH     R4,PB_BITPOS       Bit position
         LA     R6,7
         SR     R6,R4              R6 = 7 - bitpos
         LA     R7,1               Build mask bit
         SLL    R7,0(R6)           Shift 1 left to target position
         IC     R5,PB_FLAGBYTE     Current byte value
         LH     R8,PB_BITVAL       Desired 0 or 1
         LTR    R8,R8
         BZ     CLEARBIT           Zero: clear the bit
*
SETBIT   OR     R5,R7              Set bit (OR with mask)
         B      STOREBIT
CLEARBIT NR     R7,=F'-1'          Complement mask (NOT mask)
         XR     R7,=F'-1'
         NR     R5,R7              Clear bit (AND with NOT-mask)
STOREBIT STC    R5,PB_FLAGBYTE     Store modified byte back
         MVC    PB_RC,=F'0'
         B      EXIT
*
***********************************************************************
* Exit - restore registers and return                                *
***********************************************************************
EXIT     DS     0H
         L      R13,4(,R13)        Restore caller save area ptr
         LM     R14,R12,12(R13)    Restore caller registers
         L      R15,=F'0'          R15 = module return code 0
         BR     R14                Return
*
***********************************************************************
* Data areas                                                          *
***********************************************************************
SAVEAREA DS     18F                Standard 72-byte save area
*
***********************************************************************
* Parameter block DSECT                                               *
***********************************************************************
PARMBLK  DSECT
PB_FUNC  DS     CL8                Function code
PB_FLAGBYTE DS  CL1                Flag byte (1 byte)
PB_BITPOS DS    H                  Bit position (halfword, 0-7)
PB_BITVAL DS    H                  Bit value out/in
PB_RC    DS     F                  Return code (fullword)
*
         YREGS                     Equate standard register symbols
         END    GTMASM01
