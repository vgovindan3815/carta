# Business Rules Document
## Account Update Service (COACTUPC)

> **Quality review status:** Template — pending agent quality gate pass  
> **Analysis coverage:** ~70% — copybooks CSUTLDWY, CVCRD01Y, CSLKPCDY, COCOM01Y, CVACT01Y, CVACT03Y, CVCUS01Y, COACTUP not available; behaviour of those modules is inferred or flagged as gaps.  
> **Document type:** Business Rules (§2 of MAVEN prompt framework)  
> **Source program:** COACTUPC.CBL  

---

## Executive Summary

The Account Update Service is an online, operator-facing function that allows an authorised user — such as a customer service representative — to look up a customer account by account number and update both the account settings and the associated customer profile in a single session. The service is triggered on demand whenever a representative needs to modify account or customer information. Any update made through this service is written immediately to the Account Master and Customer Profile databases upon the representative's explicit confirmation, making it a real-time, synchronous operation with direct effect on customer-facing limits and data.

---

## Business Purpose

This service exists to give authorised operations staff a single, controlled interface for maintaining customer account and profile data without requiring direct database access. It enforces a structured, validated workflow — search, review, edit, confirm, save — so that no change reaches the system without the operator having seen the existing values and explicitly approved the update. The service is designed for a credit-card operations environment where account limits, identity data, and card status must be changed accurately and with a clear audit trail.

---

## Key Business Rules

---

**Rule 1: Account Lookup Is Mandatory Before Any Edit**
Trigger   : An operator opens the Account Update screen for the first time, or returns after completing a previous update.  
Action    : The system prompts the operator to supply a valid account number. No account or customer data is displayed, and no editing is possible, until an account number is entered and successfully looked up.  
Outcome   : The account's current data — limits, status, dates, and full customer profile — is retrieved and presented to the operator for review before any change is permitted.  
Risk      : If the account lookup fails or returns no data, the operator is informed and no update is possible. An operator cannot bypass this step and edit data blindly.

---

**Rule 2: Account Number Must Be a Valid 11-Digit Identifier**
Trigger   : The operator enters an account number and submits the search.  
Action    : The system verifies that the account number is exactly 11 digits, entirely numeric, and not zero. It then looks up the account in the Card Cross-Reference and Account Master records in sequence.  
Outcome   : If the number passes all three checks and a matching account is found, the account and customer details are displayed. If any check fails, the operator receives a specific error message and must correct the entry.  
Risk      : If this rule were bypassed, invalid or non-existent accounts could be searched, potentially exposing data for the wrong customer or causing processing errors downstream.

⚠ *Gap — Card Cross-Reference lookup module (CXACAIX) not fully analysed. The business logic governing how a card number maps to an account number, and what happens when multiple cards exist for one account, is inferred but not confirmed. Engineer validation required.*

---

**Rule 3: Account Active Status Must Be Explicitly Set**
Trigger   : The operator modifies the Account Active Status field.  
Action    : The system validates that the value entered is either "Y" (account is active) or "N" (account is inactive). Any other value, or a blank, is rejected.  
Outcome   : An active status of "N" likely suppresses the account from participating in normal transaction processing. The system will not allow the field to be left ambiguous.  
Risk      : Incorrectly setting an account to inactive could prevent a customer from using their card. Setting it to active when it should be suspended could expose the business to fraud or credit risk.

---

**Rule 4: Credit Limit and Cash Limit Are Required and Must Be Valid Amounts**
Trigger   : The operator submits changes to the Credit Limit or Cash Credit Limit fields.  
Action    : The system requires both fields to contain a valid signed monetary amount (positive or negative). A blank entry is not permitted.  
Outcome   : The new limits replace the existing limits on the Account Master record and take effect for future transactions immediately upon saving.  
Risk      : A blank or invalid credit limit would leave the account with no enforceable spending boundary. An incorrect cash limit could allow a customer to withdraw more cash than the account terms permit, or block legitimate cash access.

---

**Rule 5: Current Balance and Cycle Amounts Are Validated Before Saving**
Trigger   : The operator submits changes to the Current Balance, Current Cycle Credit, or Current Cycle Debit fields.  
Action    : Each of the three fields is validated as a signed monetary amount. All three must be present and numerically valid.  
Outcome   : The updated values are written to the Account Master record.  
Risk      : An erroneous balance figure would cause incorrect statements, interest calculations, and available-credit calculations for the customer. Incorrect cycle credit/debit figures would affect billing cycle reconciliation.

⚠ *Gap — The business rules governing whether a representative is permitted to manually adjust Current Balance (as opposed to it being a system-calculated field) are not established from the code alone. SME confirmation required: is manual balance adjustment a controlled, supervised operation, or is it routine?*

---

**Rule 6: Account Dates Must Be Logically Valid Calendar Dates**
Trigger   : The operator enters or changes the Account Open Date, Card Expiry Date, or Card Reissue Date.  
Action    : Each date is validated as a real calendar date (year, month, and day each within valid ranges). A date with an invalid month (e.g., month 13) or an invalid day for the given month is rejected.  
Outcome   : Valid dates are stored on the account record. The Card Expiry Date controls when a card can no longer be used for transactions.  
Risk      : An incorrect Expiry Date could cause a customer's card to be declined prematurely, or conversely, allow an expired card to continue transacting. An incorrect Open Date affects account age calculations and potentially regulatory reporting.

---

**Rule 7: Customer Name Fields Must Contain Letters Only**
Trigger   : The operator enters or changes First Name, Middle Name, Last Name, City, State, or Country.  
Action    : First Name, Last Name, City, State, and Country are required alphabetic fields — numbers and special characters are not accepted. Middle Name is optional but, if provided, must also be alphabetic only.  
Outcome   : Valid name and address values are stored on the Customer Profile record.  
Risk      : Allowing numbers or special characters in name fields could corrupt downstream processes that format names for correspondence, regulatory filings, or identity verification.

---

**Rule 8: Customer Address Fields Are Required (Except Address Line 2)**
Trigger   : The operator enters or changes address fields.  
Action    : Address Line 1, City, State, Country, and Zip Code are all required. Address Line 2 is optional and may be left blank. The State code must be a valid US state code, and the Zip Code must be a numeric, non-zero value. The system cross-validates State and Zip Code together to confirm the combination is geographically valid.  
Outcome   : Valid address data is stored on the Customer Profile record.  
Risk      : An invalid address affects statement delivery, regulatory correspondence, and fraud detection rules that rely on address verification.

⚠ *Gap — The list of valid US state codes and the State/Zip cross-validation table are defined in copybooks (CSLKPCDY) not available for analysis. The exact validation logic is confirmed to exist; the specific rules it enforces are inferred from standard North America conventions. Engineer validation required.*

---

**Rule 9: Social Security Number Must Pass Format and Range Validation**
Trigger   : The operator enters or changes the customer's Social Security Number.  
Action    : The SSN is validated in three parts. The first segment (3 digits) cannot be 0, 666, or any number between 900 and 999 — these are federally reserved ranges that are never assigned to real individuals. All three segments must be numeric.  
Outcome   : A valid SSN is stored on the Customer Profile record.  
Risk      : Storing an invalid SSN could cause failures in identity verification, credit reporting, and regulatory Know-Your-Customer (KYC) processes.

---

**Rule 10: FICO Credit Score Must Be Between 300 and 850**
Trigger   : The operator enters or changes the customer's FICO Credit Score.  
Action    : The system rejects any score outside the range 300–850, which is the defined range for standard FICO scoring models. The field is required and must be numeric.  
Outcome   : The validated score is stored on the Customer Profile record.  
Risk      : An out-of-range score could distort credit risk assessments, automated limit-setting, and any downstream analytics that segment customers by creditworthiness.

---

**Rule 11: Phone Numbers Must Be Valid US Format When Provided**
Trigger   : The operator enters or changes Phone Number 1 or Phone Number 2.  
Action    : Phone numbers are not mandatory. However, if a number is provided, all three segments (area code, prefix, subscriber number) must be present and numeric, and the area code must be a valid North American area code. A partially entered phone number is rejected.  
Outcome   : Valid phone numbers are stored on the Customer Profile record.  
Risk      : An invalid phone number would prevent the business from contacting the customer for fraud alerts, statement notifications, or collections.

---

**Rule 12: EFT Account Identifier Is Required and Must Be Numeric**
Trigger   : The operator enters or changes the EFT (Electronic Funds Transfer) Account Identifier.  
Action    : The field must be supplied, must be 10 digits, entirely numeric, and non-zero.  
Outcome   : The EFT identifier is stored on the Customer Profile record and is used to route direct debits or credits for the customer.  
Risk      : An invalid EFT identifier would cause automated payment or refund transactions to fail or route to the wrong account.

---

**Rule 13: Primary Cardholder Indicator Must Be Explicitly Set**
Trigger   : The operator enters or changes the Primary Card Holder flag.  
Action    : The field must be "Y" (this customer is the primary cardholder) or "N" (this customer is a supplementary cardholder). Blank is not permitted.  
Outcome   : The indicator is stored on the Customer Profile and governs which cardholder has primary responsibility for the account.  
Risk      : Incorrect designation affects liability assignment, statement routing, and communications targeting.

---

**Rule 14: The System Detects Whether Any Changes Were Actually Made**
Trigger   : The operator submits the edit form after account data has been displayed.  
Action    : Before proceeding to validation or saving, the system compares every field in the submitted form against the values that were originally retrieved from the database. If every field is identical, no update is triggered and the operator is informed that no changes were detected.  
Outcome   : Unnecessary database writes are prevented. The operator must make at least one real change to proceed to confirmation.  
Risk      : Without this check, spurious updates could pollute audit logs and create false "record updated" events in downstream monitoring systems.

---

**Rule 15: Changes Must Be Explicitly Confirmed Before Saving**
Trigger   : The operator's changes pass all validation checks.  
Action    : The system presents the validated changes to the operator and requires explicit confirmation via a dedicated key (F5) before writing anything to the database. Simply entering changes and pressing Enter does not save them.  
Outcome   : The two-step confirm-then-save workflow prevents accidental updates. The operator sees a summary of validated data and must make a deliberate decision to commit.  
Risk      : Removing this confirmation step would expose the system to accidental overwrites of account limits, status, and customer identity data.

---

**Rule 16: The System Guards Against Concurrent Updates**
Trigger   : The operator confirms a save, but between the time they loaded the account data and the time they attempted to save, another user or process modified the same record.  
Action    : The system detects that the record has been changed since it was last read and refuses to overwrite it. The operator is shown a message that the record has been modified by someone else and is asked to review the current values before trying again.  
Outcome   : The update is cancelled. The operator must reload the account to see the current state, then re-enter their changes.  
Risk      : Without this control, one operator's update could silently overwrite another's, creating data loss and audit gaps — particularly dangerous for limit changes or status changes.

---

**Rule 17: Record Locking Failure Is Surfaced Explicitly**
Trigger   : The operator confirms a save, but the system cannot obtain the exclusive lock needed to write the update.  
Action    : The save is not attempted. The operator is shown a specific error message indicating the account could not be locked for update, and is asked to try again.  
Outcome   : The system retries are left to the operator. The update is not silently discarded.  
Risk      : If locking failures were suppressed, operators might believe changes were saved when they were not, leading to operational errors for the customer.

---

**Rule 18: Exiting Returns the Operator to the Calling System**
Trigger   : The operator presses the Exit key (F3) at any point.  
Action    : Any unsaved changes are discarded. The system returns the operator to whichever application called this screen — the Main Menu, the Card List, or another function. If no calling system is recorded, the operator is returned to the Main Menu by default.  
Outcome   : Session context is preserved so the operator can resume their prior workflow without losing their place.  
Risk      : If exit navigation were broken, operators could be stranded on the update screen or land in the wrong application, disrupting their workflow.

---

## Data Read and Changed

| Business Data Name             | What it represents                                                  | Read / Changed  |
|-------------------------------|----------------------------------------------------------------------|-----------------|
| Account Master Record          | All account-level settings: status, limits, balance, dates, group   | Read and Changed |
| Customer Profile Record        | All customer identity data: name, address, phone, SSN, DOB, FICO    | Read and Changed |
| Card Cross-Reference Record    | Links a card number to its account and customer identifiers         | Read only        |
| Card Data Record               | Card-level details used to resolve the account lookup               | Read only        |
| North America Area Code Table  | Reference table of valid US/Canada phone area codes                 | Read only        |
| US State Code Reference Table  | Reference table of valid US state codes and their zip code ranges   | Read only        |
| Session Context (Commarea)     | Passes the operator's current navigation state between screens      | Read and Changed |

---

## What Triggers This Service

This service is triggered on demand by an authorised operations user — typically a customer service representative — who selects the Account Update function from the application menu, or who navigates to it directly from a Card List or Card Detail screen. It is an interactive, real-time online transaction: there is no batch or scheduled component. Each session covers exactly one account lookup and update sequence.

---

## What This Service Triggers Next

| Downstream | Dependency |
|---|---|
| Account Master database | Updated immediately on confirmed save; any system or process that reads account limits, status, or dates will see the new values on the next access. |
| Customer Profile database | Updated immediately on confirmed save; downstream processes using customer name, address, or identity data will see the new values on the next access. |
| Main Menu / Card List / Card Detail | On exit (F3), the operator is returned to the screen that launched this service, resuming their prior workflow. |
| Card Update Service | The operator may navigate directly from this service to the Card Update function to modify card-level details for the same account. |

⚠ *Gap — Whether the Account Master or Customer Profile updates trigger any event notifications, downstream synchronisation jobs, or real-time feeds (e.g., to a fraud system, a data warehouse, or a card network) is not determinable from this program alone. SME confirmation required: what consumes changes to these records in near real-time?*

---

## Gaps and Limitations

| # | What is uncertain | Business risk | Recommended validation step |
|---|---|---|---|
| 1 | Copybooks CVACT01Y (Account record layout), CVCUS01Y (Customer record layout), CVACT03Y (Card cross-reference layout) were not available. The field names and sizes were inferred from in-program data structures. | If the actual record layouts differ from what was inferred, field mapping in this document may be incorrect. | SME to confirm the field mapping table against the live record layouts. |
| 2 | The Card Cross-Reference lookup logic (CXACAIX alternate index) was not fully analysed. It is unknown whether multiple cards per account are handled, and which card is selected when more than one exists. | An operator searching by account number with multiple cards might retrieve the wrong card's context, or receive an error that is not well explained. | Engineer to trace the CARDAIX / CXACAIX read logic and document multi-card behaviour. |
| 3 | The exact US state + zip cross-validation rules (copybook CSLKPCDY) were not available. Validation is confirmed to exist but the specific rules are not documented here. | An invalid state/zip combination accepted by the system could cause address-dependent processes to fail silently. | Engineer to extract the valid state/zip table from the copybook and document boundary cases. |
| 4 | Whether updates to Account Master and Customer Profile trigger downstream event feeds (fraud, analytics, card network) is unknown from this program. | A change to a credit limit or account status may need to propagate to other systems in near real-time. If the feed is missing or delayed, downstream systems may operate on stale data. | SME to confirm: what downstream systems consume changes to ACCTDAT and CUSTDAT, and what is the propagation mechanism and latency? |
| 5 | The business rules governing who is authorised to manually adjust Current Balance are not established from the code. The code permits it; whether policy restricts it to certain roles is unknown. | Unrestricted balance adjustment by any representative is a fraud and compliance risk. | SME / compliance team to confirm: is manual balance adjustment role-restricted, and is it logged for audit? |
| 6 | The abend (abnormal termination) handling routine was not read in full. The conditions under which the system terminates abnormally vs. presents an error to the operator are not fully documented. | An unhandled error scenario could leave a record locked, an operator unable to proceed, or a partial update written. | Engineer to review the ABEND-ROUTINE and document the error recovery behaviour for each failure mode. |
