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
import oldschoolIcon from '../assets/images/oldschool.png';
import runescape742Icon from '../assets/images/runescape.png';
import vorkathIcon from '../assets/images/vorkath.png';
import { cisList, cidStore, cilSettings } from '@coreui/icons-pro';
import SecureContent from 'src/components/SecureComponent';
import { FaExclamationTriangle } from 'react-icons/fa';

const serversData = [
  {
    icon: oldschoolIcon,
    description: 'Latest Oldschool Data',
    ip: '192.168.1.1',
    port: '8080',
    name: 'Oldschool',
    isPublic: true,
  },
  {
    icon: runescape742Icon,
    description: 'Runescape data from 742',
    ip: '192.168.1.2',
    port: '8081',
    name: 'Runescape 742',
    isPublic: true,
  },
  {
    icon: vorkathIcon,
    description: 'Vorkath',
    ip: '192.168.1.2',
    port: '8081',
    name: 'Vorkath',
    isPublic: false,
  },
];

const ServerDropdown = () => {
  const [selectedServer, setSelectedServer] = useState(null);
  const [activeTab, setActiveTab] = useState(1);

  useEffect(() => {
    const savedServer = localStorage.getItem('selectedServer');
    if (savedServer) {
      setSelectedServer(JSON.parse(savedServer));
    } else {
      const defaultServer = serversData.find((server) => server.name === 'Oldschool');
      setSelectedServer(defaultServer);
      localStorage.setItem('selectedServer', JSON.stringify(defaultServer));
    }
  }, []);

  const handleSelectServer = (server) => {
    setSelectedServer(server);
    localStorage.setItem('selectedServer', JSON.stringify(server));
  };

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
          onClick={() => handleSelectServer(server)}
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
