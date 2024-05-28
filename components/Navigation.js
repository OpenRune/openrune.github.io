import React, {useState} from "react";
import {Sidebar} from 'primereact/sidebar';
import { useNavigate } from 'react-router-dom';
import 'primereact/resources/themes/saga-blue/theme.css';  // or another theme of your choice
import 'primereact/resources/primereact.min.css';
import 'primeicons/primeicons.css';
import {PanelMenu} from "primereact/panelmenu";


const Navigation = ({ sidebarVisible, setSidebarVisible }) => {

    const [expandedKeys, setExpandedKeys] = useState({
        '0': true,
        '1': true
    });

    const items = [
        {
            label: 'Data',
            icon: 'pi pi-fw pi-file',
            items: [
                { label: 'Items', icon: 'pi pi-fw pi-plus', url: '/items' },
                { label: 'Objects', icon: 'pi pi-fw pi-trash', url: '/objects' }
            ]
        },
        {
            label: 'Tools',
            icon: 'pi pi-fw pi-pencil',
            items: [
                { label: 'Dump 317 Data', icon: 'pi pi-fw pi-align-left', url: '/dump-317-data' },
                { label: 'Inventory Item Helper', icon: 'pi pi-fw pi-align-right', url: '/inventory-item-helper' }
            ]
        }
    ];
    const getBaseUrl = () => {
        if (window.location.hostname === 'openrune.github.io') {
            const pathArray = window.location.pathname.split('/');
            return pathArray.length > 1 ? `/${pathArray[1]}` : '';
        }
        return '';
    };

    const CustomHeader = ({onHide}) => (
        <div className="sidebar-header">
            <img src={`${getBaseUrl()}/logo.png`} alt="Logo" className="sidebar-logo"/>
            <button className="sidebar-close-btn p-sidebar-close p-sidebar-icon p-link" onClick={onHide}>
                <i className="pi pi-times"></i>
            </button>
        </div>
    );


    return (
        <>
            <Sidebar visible={sidebarVisible} onHide={() => setSidebarVisible(false)} className="custom-sidebar"
                     icons={CustomHeader} showCloseIcon={false}>
                <PanelMenu
                    model={items}
                    expandedKeys={expandedKeys}
                    onExpandedKeysChange={(e) => setExpandedKeys(e.value)}
                    multiple={true}
                    className="custom-panelmenu"
                />
            </Sidebar>
        </>
    );
};

export default Navigation;