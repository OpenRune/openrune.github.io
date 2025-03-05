import React, { useState, useEffect } from 'react';
import {
  CDropdown,
  CDropdownToggle,
  CDropdownMenu,
  CDropdownHeader,
  CButton,
  CNav,
  CNavItem,
  CNavLink,
  CTabContent,
  CTabPane,
} from '@coreui/react';
import { CIcon } from '@coreui/icons-react';
import { cisList, cidStore, cilSettings } from '@coreui/icons-pro';
import SecureContent from 'src/components/SecureComponent';
import { FaExclamationTriangle } from 'react-icons/fa';
import { setSelectedServer, getServerData, serversData, getPublicFetch } from "src/api/Api";

const ServerDropdown = () => {
  const [selectedServer, setSelectedServerState] = useState(getServerData());
  const [activeTab, setActiveTab] = useState(1);

  useEffect(() => {
    const fetchServers = async () => {
      const data = await getServerData();
      setSelectedServer(data);
    };

    fetchServers();
  }, []);

  useEffect(() => {
    if (selectedServer) {
      setSelectedServer(selectedServer);
    }
  }, [selectedServer]);

  const publicServers = serversData.filter((server) => server.isPublic);
  const privateServers = serversData.filter((server) => !server.isPublic);

  const renderServers = (servers, header) => (
    <>
      <CDropdownHeader className="bg-body-secondary fw-semibold mb-2">
        {header}
      </CDropdownHeader>
      {servers.map((server, index) => (
        <CButton
          key={index}
          className={`d-flex align-items-center p-2 ${selectedServer?.name === server.name ? 'btn-primary' : ''}`}
          style={{
            width: '100%',
            backgroundColor: selectedServer?.name === server.name ? '#007bff' : '',
            color: selectedServer?.name === server.name ? 'white' : '',
            transition: 'background-color 0.2s ease-in-out',
          }}
          onClick={() => setSelectedServerState(server)}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#007bff')}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = selectedServer?.name === server.name ? '#007bff' : '')}
        >
          <div
            style={{
              width: '40px',
              height: '40px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: '10px',
            }}
          >
            <img src={server.icon} alt={`${server.name} icon`} style={{ width: '100%', height: '100%' }} />
          </div>
          <div className="text-start">
            <strong>{server.name}</strong>
            <div>{server.description}</div>
          </div>
        </CButton>
      ))}
    </>
  );

  return (
    <CDropdown autoClose="outside" variant="nav-item" placement="bottom-end">
      <CDropdownToggle caret={false}>
        <CIcon icon={cisList} size="lg" />
      </CDropdownToggle>
      <CDropdownMenu style={{ width: '300px' }} placement="bottom-end">
        <CNav variant="underline-border">
          <CNavItem>
            <CNavLink active={activeTab === 1} onClick={() => setActiveTab(1)}>
              <CIcon icon={cisList} size="lg" />
            </CNavLink>
          </CNavItem>
          <CNavItem>
            <CNavLink active={activeTab === 2} onClick={() => setActiveTab(2)}>
              <CIcon icon={cidStore} size="lg" />
            </CNavLink>
          </CNavItem>
          <CNavItem>
            <CNavLink active={activeTab === 3} onClick={() => setActiveTab(3)}>
              <CIcon icon={cilSettings} size="lg" />
            </CNavLink>
          </CNavItem>
        </CNav>

        <CTabContent>
          <CTabPane visible={activeTab === 1}>
            {renderServers(publicServers, 'Public Servers')}

            {/* Always show Private Servers Header */}
            <CDropdownHeader className="bg-body-secondary fw-semibold mb-2">
              Private Servers
            </CDropdownHeader>

            {/* Conditionally render Private Servers or Login Message */}
            <SecureContent
              fallback={
                <div className="text-center" style={{ padding: '10px' }}>
                  <FaExclamationTriangle size={20} color="#ffcc00" />
                  <p>Login to see Private caches</p>
                </div>
              }
            >
              {renderServers(privateServers, 'Private Servers')}
            </SecureContent>
          </CTabPane>

          <CTabPane visible={activeTab === 2}>
            <SecureContent
              fallback={
                <div className="text-center" style={{ padding: '40px' }}>
                  <FaExclamationTriangle size={30} color="#ffcc00" />
                  <h2 style={{ marginTop: '20px', fontSize: '1.0rem' }}>
                    You need to login to access this page.
                  </h2>
                </div>
              }
            >
              <div>Store content goes here.</div>
            </SecureContent>
          </CTabPane>

          <CTabPane visible={activeTab === 3}>
            <SecureContent
              fallback={
                <div className="text-center" style={{ padding: '40px' }}>
                  <FaExclamationTriangle size={30} color="#ffcc00" />
                  <h2 style={{ marginTop: '20px', fontSize: '1.0rem' }}>
                    You need to login to access this page.
                  </h2>
                </div>
              }
            >
              <div>Settings content goes here.</div>
            </SecureContent>
          </CTabPane>
        </CTabContent>
      </CDropdownMenu>
    </CDropdown>
  );
};

export default ServerDropdown;
