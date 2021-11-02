import React from "react";

export default function Maintenance() {
  return (
    <div>
      <h1>Maintenance</h1>
      <p>
        Over time maintenance will be needed. Maintenance schedules can become
        tedious for software and hardware. So, when maintenance is needed, give
        us a call and we will assist with whatever enhancements are required. We
        also offer packages for our clients to establish a maintenance schedule.
        With the maintenance schedule you can ensure that when issues arise,
        they will be fixed in a timely manner. Before any work is done for
        maintenance there will need to be a consultation to understand how much
        work is needed and create a plan to remediate these issues. After this
        consultation is completed, if more hours are necessary to complete the
        work, clients can purchase these hours at the rate defined within their
        package. These packages include the following options:
      </p>
      <ul>
        <li>
          Retainer - Pay in advance at a lower rate for services that may arise
          in the future. When an issue arises, call and schedule an appointment.
        </li>
        <li>Annual - Pay in advance for a once a year maintenance.</li>
        <li>Semi-Annual - Same as annual but twice a year versus once.</li>
        <li>
          Quarterly - Same as annual but four (4) times a year versus once.
        </li>
      </ul>
      <div className="col-50">
        <a href="/maintenance">
          <button type="submit">Maintenance</button>
        </a>
      </div>
      <div className="col-50">
        <a href="/enhancements">
          <button type="submit">Enhancements</button>
        </a>
      </div>
    </div>
  );
}
