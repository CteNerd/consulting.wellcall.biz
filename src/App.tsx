import React from "react";
import "./App.css";
import { BrowserRouter as Router, Switch, Route, Link } from "react-router-dom";
import Home from "./main/home/home";
import About from "./main/about/about";
import Services from "./main/services/services";
import Consult from "./main/services/consult";
import Implement from "./main/services/implement";
import Adopt from "./main/services/adopt";
import Maintenance from "./main/services/maintenance";
import Enhancements from "./main/services/enhancements";
import FAQs from "./main/faqs";
import Payments from "./main/payment";
import SideNav from "./main/side-nav/sideNav";
import logo from "./images/Tech Logo No Padding.png";
import { MailOutlined, PhoneOutlined } from "@ant-design/icons";

function App() {
  return (
    <div className="App">
      <SideNav />
      <header className="App-header">
        <div className="col-33 menu-btn" onClick={() => openNav()}>
          <div className="menu-line"></div>
          <div className="menu-line"></div>
          <div className="menu-line"></div>
        </div>
        <div className="col-33">
          <img src={logo} className="logo col-50" />
        </div>
        <div className="col-33"></div>
      </header>

      <div className="App-main">
        <Router>
          <Switch>
            <Route path="/about">
              <About />
            </Route>
            <Route path="/payment">
              <Payments />
            </Route>
            <Route path="/faqs">
              <FAQs />
            </Route>
            <Route path="/services/consult">
              <Consult />
            </Route>
            <Route path="/services/implement">
              <Implement />
            </Route>
            <Route path="/services/adopt">
              <Adopt />
            </Route>
            <Route path="/services/maintenance">
              <Maintenance />
            </Route>
            <Route path="/services/enhancements">
              <Enhancements />
            </Route>
            <Route path="/services">
              <Services />
            </Route>
            <Route path="/">
              <Home />
            </Route>
          </Switch>
        </Router>
      </div>

      <footer className="App-footer">
        <div className="col-33">
          <a href={"mailto:admin@wellcall.biz"}>
            <MailOutlined />
          </a>
        </div>
        <div className="col-33">
          <a href="https://wellcall-app-cdk.s3.amazonaws.com/Terms+and+Agreements.docx">
            <button type="submit">Download Contract</button>
          </a>
        </div>
        <div className="col-33">
          <a href={"tel:559-574-1056"}>
            <PhoneOutlined />
          </a>
        </div>
      </footer>
    </div>
  );
}

/* Set the width of the side navigation to 250px */
function openNav() {
  if (document.getElementById("mySidenav")) {
    document.getElementById("mySidenav")!.style.width = "200px";
  }
}

export default App;
