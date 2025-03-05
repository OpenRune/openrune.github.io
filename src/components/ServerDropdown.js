import React, { useEffect, useState } from 'react';
import { CDropdown, CDropdownToggle, CDropdownMenu, CButton } from '@coreui/react';
import { CIcon } from '@coreui/icons-react';
import { cisList } from '@coreui/icons-pro';
import { setSelectedServer, getServerData, serversData, getPublicFetch } from "src/api/Api";

const ServerDropdown = () => {
  const [selectedServer, setSelectedServerState] = useState(getServerData());

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

  return (
    <CDropdown autoClose="outside">
      <CDropdownToggle caret={false}>
        <CIcon icon={cisList} size="lg" />
      </CDropdownToggle>
      <CDropdownMenu style={{ width: '300px' }}>
        {serversData.map((server, index) => (
          <CButton
            key={index}
            className={`d-flex align-items-center p-2 ${selectedServer?.name === server.name ? 'btn-primary' : ''}`}
            onClick={() => setSelectedServerState(server)}
          >
            <div className="text-start">
              <strong>{server.name}</strong>
              <div>{server.ip}</div>
            </div>
          </CButton>
        ))}
      </CDropdownMenu>
    </CDropdown>
  );
};

export default ServerDropdown;
