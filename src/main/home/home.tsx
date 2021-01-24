import React from "react";
import code from "../../images/vscode.jpeg"
import ceiling from "../../images/glassCeiling.jpg"
import "./home.css"

export default function Home() {
  return (
    <div className={"home"}>
        <h2>Need Help With Technology? We'll Call With Answers</h2>
      <div className={"cards"}>
        <div className={""}>
          <img src={ceiling}/>
        </div>
        <div className={"info"}>
          <h4>Personal</h4>
          <ul>
            <li>Build a website for yourself or your r&eacute;sum&eacute;</li>
            <li>Build your social media presence</li>
            <li>Highlight Films of your awesome season</li>
            <li>Hardware or Software Questions</li>
            <li>And More</li>
          </ul>
        </div>
      <div className={"info"}>
        <h4>Small Business</h4>
        <ul>
          <li>Establish your business digitally with a website and domain</li>
          <li>
            Have your employees all using the similar emails to look professional
          </li>
          <li>
            Add ads to boost revenue on your site but don't overwhelm customers
          </li>
          <li>Search Engine Optimization</li>
          <li>Hardware or Software Questions</li>
          <li>And more to assist you raise your ceiling</li>
        </ul>
      </div>
        <img src={code}/>
      </div>
      <button type="submit" onClick={() => window.open("https://facebook.com/WellCallTechConsulting", "_blank")}>Schedule An Appointment Now</button>
    </div>
  );
}
