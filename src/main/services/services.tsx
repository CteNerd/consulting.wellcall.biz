import {
  CrownOutlined,
  LaptopOutlined,
  TabletOutlined,
  WifiOutlined,
} from "@ant-design/icons";
import React from "react";
import "./services.css";
import wifi from "../../images/wifi at your palms.jpg";
import ipad from "../../images/ipad.jpg";
import ttyl from "../../images/ttyl_home.png";
import fb from "../../images/fb_biz_page.png";

export default function Services() {
  return (
    <div className="services">
      <h2>Services</h2>
      <div className="cards">
        <div className="col-50">
          <h3>
            <LaptopOutlined className="icon" />
            Web Sites
          </h3>
          <ul>
            <li>Domain Management</li>
            <li>Database Management</li>
            <li>Employee Emails</li>
            <li>Subdomain Management</li>
            <li>Api Documentation</li>
            <li>Unit and Integration Testing</li>
            <li>
              Mobile App setup <strong>coming soon</strong>
            </li>
          </ul>
        </div>
        <div className="col-50">
          <img src={ttyl} />
        </div>
        <div className="col-50">
          <img src={wifi} />
        </div>
        <div className="col-50">
          <h3>
            <WifiOutlined className="icon" />
            Wi-Fi
          </h3>
          <ul>
            <li>Proper Speed For Your Business</li>
            <li>Proper Modem/Router For Your Business</li>
            <li>Wi-Fi Security</li>
            <li>User Management</li>
          </ul>
        </div>
        <div className="col-50">
          <h3>
            <CrownOutlined className="icon" />
            Social Media
          </h3>
          <ul>
            <li>Establish Business Accounts</li>
            <li>Establish Business Profiles</li>
            <li>Live Feed(s) From Social Media To Site</li>
          </ul>
        </div>
        <div className="col-50">
          <img src={fb} />
        </div>
        <div className="col-50">
          <img src={ipad} />
        </div>
        <div className="col-50">
          <h3>
            <TabletOutlined className="icon" />
            Device Setup
          </h3>
          <ul>
            <li>Device Tutorial</li>
            <li>Device Security</li>
            <li>Password Security</li>
            <li>Cloud Storage & Management</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
