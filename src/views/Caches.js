import React, { useState } from 'react';
import RevisionData from "src/components/RevisionData";
import { GameType } from "src/api/GameType";
import {
  CFormSelect,
  CSmartTable,
  CDateRangePicker,
  CButton,
  CModal,
  CModalHeader,
  CModalTitle,
  CModalBody,
  CModalFooter,
  CTabs,
  CTabList,
  CTab,
  CTabContent,
  CTabPanel
} from "@coreui/react-pro";

const Caches = () => {
  const [selectedGame, setSelectedGame] = useState(GameType.RUNESCAPE);
  const perPage = 20;
  const [itemsPerPage, setItemsPerPage] = useState(perPage);
  const [inputPage, setInputPage] = useState('');
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  const [visible, setVisible] = useState(false); // Modal visibility state
  const [activeTab, setActiveTab] = useState(2); // Active tab state
  const [selectedData, setSelectedData] = useState(null); // State to hold selected row data

  const handleGameFilterChange = (e) => {
    setSelectedGame(e.target.value);
  };

  const handlePageInputChange = (e) => {
    const value = e.target.value;
    if (/^\d*$/.test(value)) {
      setInputPage(value);
    }
  };

  const handleButtonClick = (item) => {
    setSelectedData(item); // Store the selected row data
    setVisible(true); // Open the modal
  };

  return (
    <>
      <div>
        <RevisionData
          gameType={selectedGame}
          dataMethod={(service) => service.getData(selectedGame)}
          render={({ data, error }) => {
            if (error) {
              return <div>Error loading data</div>;
            }

            if (data.length === 0) {
              return <div>Loading...</div>;
            }

            console.log(data);

            const formattedData = data.map((item) => {
              const major = item.builds.length > 0 && item.builds[0].major != null && item.builds[0].major !== ''
                ? item.builds[0].major
                : -1;

              const getDaySuffix = (day) => {
                if (day > 3 && day < 21) return 'th';
                switch (day % 10) {
                  case 1: return 'st';
                  case 2: return 'nd';
                  case 3: return 'rd';
                  default: return 'th';
                }
              };
              const userLocale = navigator.language || 'en-US';
              const date = new Date(item.timestamp);
              const day = date.getDate();
              let formattedDate;
              if (userLocale.startsWith('en')) {
                const daySuffix = getDaySuffix(day);
                formattedDate = `${day}${daySuffix} ${date.toLocaleDateString(userLocale, {
                  year: 'numeric',
                  month: 'long',
                  hour: 'numeric',
                  minute: 'numeric',
                  hour12: true
                }).replace(/^[\d]+/, '')}`.trim();
              } else {
                formattedDate = date.toLocaleDateString(userLocale, {
                  day: 'numeric',
                  year: 'numeric',
                  month: 'long',
                  hour: 'numeric',
                  minute: 'numeric',
                  hour12: true
                });
              }

              let sizeInMB = item.size / (1024 * 1024);
              let formattedSize = sizeInMB < 1024
                ? sizeInMB.toFixed(2) + ' MB'
                : (sizeInMB / 1024).toFixed(2) + ' GB';

              function upperFirst(string) {
                return string.charAt(0).toUpperCase() + string.slice(1);
              }

              return {
                id: item.id, // Add a unique ID for each row (assuming 'id' exists in the data)
                major: major,
                game: upperFirst(item.game),
                env: item.environment,
                timestamp: formattedDate,
                rawTimestamp: date, // Use raw date for filtering
                size: formattedSize,
              };
            });

            const filteredData = formattedData.filter(item => {
              const itemDate = item.rawTimestamp;
              if (startDate && endDate) {
                return itemDate >= startDate && itemDate <= endDate;
              }
              return true;
            });

            const calendarDate = new Date();
            const maxDate = new Date();
            const minDate = new Date(2001, 1, 4);

            const sortedData = filteredData.sort((a, b) => b.major - a.major);

            const columns = [
              { key: 'major', label: 'Major', _style: { width: '2%' } },
              {
                key: "game",
                label: "Game",
                _style: { width: "10%" },
                filter: (values, onChange) => {
                  return (
                    <CFormSelect
                      value={selectedGame}
                      onChange={handleGameFilterChange}
                    >
                      {Object.keys(GameType).map((game) => (
                        <option key={game} value={GameType[game]}>
                          {game.charAt(0) + game.slice(1).toLowerCase()}
                        </option>
                      ))}
                    </CFormSelect>
                  );
                }
              },
              { key: 'env', label: 'Env', _style: { width: '2%' } },
              {
                key: 'timestamp',
                label: 'Timestamp',
                _style: { width: '10%' },
                filter: (values, onChange) => {
                  return (
                    <CDateRangePicker
                      calendarDate={calendarDate}
                      locale="en-US"
                      maxDate={maxDate}
                      minDate={minDate}
                      startDate={startDate}
                      endDate={endDate}
                      onStartDateChange={(date) => {
                        setStartDate(date);
                      }}
                      onEndDateChange={(date) => {
                        setEndDate(date);
                      }}
                    />
                  );
                }
              },
              { key: 'size', label: 'Size', _style: { width: '4%' } },
              {
                key: 'actions',
                label: 'Actions',
                _style: { width: '4%' },
                filter: false,
                sorter: false
              },
            ];

            return (
              <>
                <div>
                  <CSmartTable
                    items={sortedData}
                    columnFilter
                    columnSorter
                    itemsPerPageSelect
                    itemsPerPage={perPage}
                    pagination
                    columns={columns}
                    tableProps={{
                      striped: true,
                      hover: true,
                      responsive: true
                    }}
                    sorter
                    scopedColumns={{
                      actions: (item) => (
                        <td>
                          <CButton color="primary" onClick={() => handleButtonClick(item)}>
                            Display Info
                          </CButton>
                        </td>
                      )
                    }}
                  />
                </div>

                {/* Modal Component */}
                <CModal
                  alignment="center"
                  visible={visible}
                  onClose={() => setVisible(false)}
                  aria-labelledby="VerticallyCenteredExample"
                >
                  <CModalHeader>
                    <CModalTitle id="VerticallyCenteredExample">
                      {selectedData ? `Details for: ${selectedData.game} : ${selectedData.major}` : 'Modal Title'}
                    </CModalTitle>
                  </CModalHeader>
                  <CModalBody>
                    {selectedData && (
                      <div>
                        <CTabs activeItemKey={activeTab} onActiveTabChange={setActiveTab}>
                          <CTabList variant="tabs" layout="fill">
                            <CTab aria-controls="home-tab-pane" itemKey={1}>Information</CTab>
                            <CTab aria-controls="profile-tab-pane" itemKey={2}>Hashes</CTab>
                            <CTab aria-controls="contact-tab-pane" itemKey={3}>Group Count</CTab>
                            <CTab aria-controls="contact-tab-pane" itemKey={4}>Inv</CTab>
                            <CTab aria-controls="contact-tab-pane" itemKey={5}>Obj</CTab>
                          </CTabList>
                          <CTabContent>
                            <CTabPanel className="py-3" aria-labelledby="home-tab-pane" itemKey={1}>
                              <pre><code>{JSON.stringify(selectedData, null, 2)}</code></pre>
                            </CTabPanel>
                            <CTabPanel className="py-3" aria-labelledby="profile-tab-pane" itemKey={2}>
                              Profile tab content
                            </CTabPanel>
                            <CTabPanel className="py-3" aria-labelledby="contact-tab-pane" itemKey={3}>
                              Contact tab content
                            </CTabPanel>
                          </CTabContent>
                        </CTabs>
                      </div>
                    )}
                  </CModalBody>
                  <CModalFooter>
                    <CButton color="primary" onClick={() => setVisible(false)}>
                      Download All
                    </CButton>
                  </CModalFooter>
                </CModal>
              </>
            );
          }}
        />
      </div>
    </>
  );
};

export default Caches;
