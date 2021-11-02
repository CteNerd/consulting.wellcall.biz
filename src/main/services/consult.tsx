import { List } from "antd";
import React from "react";

export default function Consult() {
  const data = [
    "Choosing a path to build your business digitally",
    "Building a website",
    "Building an app",
    "Enhancing a website",
    "Enahncing an app",
    "Choosing software",
    "Troubleshooting software",
    "Troubleshooting hardware",
  ];

  return (
    <div>
      <h1>Consult</h1>

      <p>
        Technology isn’t always as simple as picking up a manual and hitting a
        couple buttons. It could be what internet devices does my company need
        so my clients can use the internet without any concerns; We’ll Call Inc.
        can also help you understand what type of technology is needed in order
        to get your digital business from startup phase to a fully functioning
        scaled solution, We’ll Call Inc. has experience to guide you through any
        and all challenges.
      </p>

      <List
        size={"small"}
        header={<div>Services</div>}
        bordered
        dataSource={data}
        renderItem={(item) => <List.Item>{item}</List.Item>}
      />

      <div className="col-50">
        <a href="/">
          <button type="submit">Home</button>
        </a>
      </div>
      <div className="col-50">
        <a href="/implement">
          <button type="submit">Implement</button>
        </a>
      </div>
    </div>
  );
}
