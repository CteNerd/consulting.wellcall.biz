import React from "react";
import code from "../../images/vscode.jpg";
import ceiling from "../../images/glassCeiling.jpg";
import "./home.css";
import { UsergroupAddOutlined, UserOutlined } from "@ant-design/icons";

export default function Home() {
  return (
    <div className={"home"}>
      <h2>
        Need Help With Technology?
        <br />
        <strong>We'll Call</strong> With Answers
      </h2>
      <div className={"cards"}>
        <div className={""}>
          <img src={ceiling} />
        </div>
        <div className={"info"}>
          <h3>
            <UserOutlined className={"title-icon"} />
            Personal
          </h3>
          <ul>
            <li>Build a website for yourself or your r&eacute;sum&eacute;</li>
            <li>Build your social media presence</li>
            <li>Highlight Films of your awesome season</li>
            <li>Hardware or Software Questions</li>
            <li>Smart Home and Personal Home Security Assistance</li>
            <li>And more...</li>
          </ul>
        </div>
        <div className={"info"}>
          <h3>
            <UsergroupAddOutlined className={"title-icon"} />
            Small Business
          </h3>
          <ul>
            <li>Establish your business digitally with a website and domain</li>
            <li>Emails and Addresses are delivered professionally</li>
            <li>Control the ads your customers will see</li>
            <li>Search Engine Optimization</li>
            <li>Hardware or Software Questions</li>
            <li>And more...</li>
          </ul>
        </div>
        <img src={code} />
      </div>
    </div>
  );
}
