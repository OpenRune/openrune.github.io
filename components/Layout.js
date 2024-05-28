import React, {useState} from "react";
import 'primereact/resources/themes/saga-blue/theme.css';  // or another theme of your choice
import 'primereact/resources/primereact.min.css';
import 'primeicons/primeicons.css';
import Navigation from "./Navigation";
import {Button} from "primereact/button";


const Layout = ({children}) => {

    const [sidebarVisible, setSidebarVisible] = useState(true);

    return (
        <>
            <Button
                icon="pi pi-arrow-right"
                onClick={() => setSidebarVisible(true)}
                className="p-mr-2 open-menu-button"
                style={{fontSize: '1.5rem', padding: '0.5rem 1rem'}}
            />

            <div className="layout-container">
                <Navigation sidebarVisible={sidebarVisible} setSidebarVisible={setSidebarVisible} />
                <div className={`layout-main-container ${sidebarVisible ? 'sidebar-expanded' : ''}`}>
                    <div className="layout-main">{children}</div>
                </div>
            </div>
            <div className="layout-mask"></div>
        </>
    );
};

export default Layout;