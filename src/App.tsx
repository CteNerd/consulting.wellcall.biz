import React from "react";
import "./App.css";
import { BrowserRouter as Router, Switch, Route, Link } from "react-router-dom";
import Home from "./main/home/home";
import logo from "./images/Tech Logo No Padding.png";

function App() {
  return (
    <div className="App">
      <header className="App-header">
        <img src={logo} className="logo col-50" />
      </header>

      <div className="App-main">
        <Router>
          <Switch>
            <Route path="/">
              <Home />
            </Route>
          </Switch>
        </Router>
      </div>

      <footer className="App-footer">
        <div className="col-33">
          <a href={"mailto:admin@wellcall.biz"}>Email</a>
        </div>
        <div className="col-33">Your Problem. Our Solution.</div>
        <div className="col-33">
          <a href={"tel:559-574-1056"}>Call/Text</a>
        </div>
      </footer>
    </div>
  );
}

export default App;
