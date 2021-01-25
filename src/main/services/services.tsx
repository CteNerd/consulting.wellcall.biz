import { CrownOutlined, LaptopOutlined, TabletOutlined, WifiOutlined } from '@ant-design/icons'
import React from 'react'
import './services.css'

export default function Services() {

    return (
        <div className="services">
            <h2>Services</h2>
            <h3>
                <LaptopOutlined className="icon" />
                Web Sites
            </h3>
            <ul>
                <li>
                    Domain Management
                </li>
                <li>
                    Database Management
                </li>
                <li>
                    Employee Emails
                </li>
                <li>
                    Subdomain Management
                </li>
                <li>
                    Mobile App setup <strong>coming</strong>
                </li>
            </ul>
            <h3>
                <WifiOutlined className="icon" />
                Wi-Fi
            </h3>
            <ul>
                <li>
                    Proper Speed For Your Business
                </li>
                <li>
                    Proper Modem/Router For Your Business
                </li>
                <li>
                    Wi-Fi Security
                </li>
                <li>
                    User Management
                </li>
            </ul>
            <h3>
                <TabletOutlined className="icon" />
                Device Setup
            </h3>
            <ul>
                <li>
                    Device Tutorial
                </li>
                <li>
                    Device Security
                </li>
                <li>
                    Password Security
                </li>
                <li>
                    Cloud Storage & Management
                </li>
            </ul>
            <h3>
                <CrownOutlined className="icon" />
                Social Media
            </h3>
            <ul>
                <li>
                    Establish Business Accounts
                </li>
                <li>
                    Establish Business Profiles
                </li>
                <li>
                    Live Feed(s) From Social Media To Site
                </li>
            </ul>
        </div>
    )
}