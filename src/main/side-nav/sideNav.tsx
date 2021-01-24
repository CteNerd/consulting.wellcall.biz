import React, { useState } from "react";
import {
  CaretDownOutlined,
  HomeOutlined,
  GithubOutlined,
  InfoCircleOutlined,
  UsergroupAddOutlined,
  InstagramOutlined,
  FacebookOutlined,
} from "@ant-design/icons";
import "./sideNav.css";

export default function SideNav() {
  const [showProjectsDropdown, setShowProjectsDropdown] = useState(false);
  const [showSocialDropdown, setShowSocialDropdown] = useState(false);

  function closeNav() {
    if (document.getElementById("mySidenav"))
      document.getElementById("mySidenav")!.style.width = "0";
  }

  return (
    <div id="mySidenav" className="sidenav">
      <div className="closebtn" onClick={closeNav}>
        &times;
      </div>
      <a href="/">
        <HomeOutlined /> Home
      </a>
      <a href="/about">
        <InfoCircleOutlined /> About
      </a>
      <button
        onClick={() => setShowProjectsDropdown(!showProjectsDropdown)}
        className="dropdown-btn"
      >
        <GithubOutlined /> Projects
        <CaretDownOutlined className={"fa-caret-down"} />
      </button>
      <div
        className="dropdown-container"
        style={{ display: showProjectsDropdown ? "block" : "none" }}
      >
        <a href="https://ttyltutors.com">TTYL</a>
        <a href="https://www.pearlrae.com">Pearl Rae</a>
        <a href="https://jimmyjamkalewraps.com">Jimmy Jam Kale Wrap</a>
        <a href="https://www.wewillcalltix.com">We'll Call Tix</a>
      </div>
      <button
        onClick={() => setShowSocialDropdown(!showSocialDropdown)}
        className="dropdown-btn"
      >
        <UsergroupAddOutlined /> Social
        <CaretDownOutlined className={"fa-caret-down"} />
      </button>
      <div
        className="dropdown-container"
        style={{ display: showSocialDropdown ? "block" : "none" }}
      >
        <a href="https://www.facebook.com/WellCallTechConsulting" target={"_blank"}>
          <FacebookOutlined /> Facebook
        </a>
        <a href="https://www.instagram.com/d.o.n._tomlin/" target={"_blank"}>
          <InstagramOutlined /> Instagram
        </a>
      </div>
    </div>
  );
}
