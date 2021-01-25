import React from 'react'
import './packages.css'

export default function Packages() {

    return (
        <div className="packages">
            <h2>Packages</h2>
            <p>Below you will find the packages that We'll Call offers for building your site. The packages list the items that are included but more can be added via the add-ons or per request. All packages include all items from lower tiers (i.e. Tier II includes all items from Tier I).</p>
            <div className="cards">
                <div className="col-50">
                    <h3>Tier I <sup>starting at $500</sup></h3>
                    <ul>
                        <li>
                            Initial conversation to understand what you want and how you want it done
                        </li>
                        <li>
                            Website with 3 tabs (i.e. Home, About, and Menu)
                        </li>
                        <li>
                            Domain purchased with auto renewal
                        </li>
                        <li>
                            Text message logo for branding
                        </li>
                        <li>
                            Link to social media profiles
                        </li>
                        <li>
                            Establish Facebook business page
                        </li>
                    </ul>
                </div>
                <div className="col-50">
                    <h3>
                        Tier II <sup>starting at $1000</sup>
                    </h3>
                    <ul>
                        <li>
                            Bi-weekly update on progress and to determine if there is anything new on the horizon
                        </li>
                        <li>
                            2 emails setup under your domain name (i.e. admin@yourdomain.com)
                        </li>
                        <li>
                            Database to manage users and more
                        </li>
                        <li>
                            Search Engine Optimization
                        </li>
                        <li>
                            API and documentation
                        </li>
                        <li>
                            Email server to send and track emails from your domain
                        </li>
                    </ul>
                </div>
                <div className="col-50">
                    <h3>
                        Add-ons
                    </h3>
                    <ul>
                        <li>
                            More emails for your business using your domain (max 6 but more available on per need basis)
                        </li>
                        <li>
                            Chat to communicate with Customer Support
                        </li>
                        <li>
                            Appointments and calendars
                        </li>
                        <li>
                            Zoom Integration
                        </li>
                        <li>
                            Text customers from site
                        </li>
                        <li>
                            Social Media Ads
                        </li>
                        <li>
                            Third Party Login (i.e. Facebook, Twitter, Apple)
                        </li>
                        <li>
                            Manage the amount of Ads on your site
                        </li>
                        <li>
                            Bug support
                        </li>
                        <li>
                            Business Number via Google Voice
                        </li>
                        <li>
                            Whats App For Business
                        </li>
                        <li>
                            And much more
                        </li>
                    </ul>
                </div>
            </div>
        </div>
    )
}