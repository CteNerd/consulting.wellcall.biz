import React from "react";

export default function Payments() {
  return (
    <div>
      <h1>Payment</h1>
      <h2>Billing Cycle</h2>
      <p>Billing cycles are the month prior for the current invoice.</p>
      <h2>Initial Deposit</h2>
      <p>
        After both parties have met, We’ll Call has provided their consulting
        services to plan the initial project, and both parties agree to work
        within the initial contract, the initial deposit will be due before any
        work is done. The initial deposit is determined by 20% of the hours
        planned during the initial consultation. This deposit will then be
        subtracted from the first month’s bill. For instance, if a project has
        an estimated of 80 hours of work, 16 hours will need to be paid prior to
        work being done. When the first month’s invoice comes for the project
        and 40 hours have been worked, the client will see a bill for 40 hours
        minus the 16 hours in the initial deposit for a total billable amount of
        24 hours. The second month’s bill contains the remaining hours to
        complete the project, another 40 hours. However, this invoice will not
        have any subtracted hours since the initial deposit hours were accounted
        for in the first month’s bill.
      </p>
      <h2>Accepted Payments</h2>
      <p>
        Payments are accepted via cash, Zelle, or BitCoin. Once the contract has
        been signed by all parties, We’ll Call will provide payment information
        on each invoice that is sent out monthly.
      </p>
      <h2>Payment Schedule</h2>
      <p>
        On the 15th of each month, Invoices will be sent via email detailing how
        many hours were worked for the previous billing cycle. Detailed on each
        invoice will be hours worked, any hours that were paid from a bucket
        (i.e., retainer hours or saved from previous project), and total cost.
        Invoices are expected to be paid no later than 22nd; 7 days. Each day an
        invoice is late, there will be a 5% interest compounded daily. If there
        are 2, two, invoices that are consecutively unpaid, all work will be
        halted until the account is in good standings.
      </p>
    </div>
  );
}
