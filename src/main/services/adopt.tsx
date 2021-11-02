import { List } from "antd";
import React from "react";

export default function Adopt() {
  const data = [
    "Educate staff on new website",
    "Educate staff on new app",
    "Educate staff on 3rd party hardware",
    "Educate staff on 3rd party software",
    "Educate consumers on digital business",
  ];

  return (
    <div>
      <h1>Adopt</h1>
      <p>
        Just because you have a site, app, or business doesn’t mean consumers
        and/or staff are ready to use it. We’ll Call Inc. will work with your
        company in order to properly train/teach individuals. Education is a key
        to business, so let’s help educate you on all the ins and outs. You’ll
        never be left in the dark.
      </p>

      <List
        size={"small"}
        header={<div>Services</div>}
        bordered
        dataSource={data}
        renderItem={(item) => <List.Item>{item}</List.Item>}
      />

      <div className="col-50">
        <a href="/implement">
          <button type="submit">Implement</button>
        </a>
      </div>
      <div className="col-50">
        <a href="/maintenance">
          <button type="submit">Maintenance</button>
        </a>
      </div>
    </div>
  );
}
