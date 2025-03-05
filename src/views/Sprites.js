import React, { useState, useEffect } from 'react';
import {
  CButton,
  CModal,
  CModalHeader,
  CModalTitle,
  CModalBody,
  CModalFooter,
  CProgress,
  CFormInput
} from "@coreui/react-pro";
import RSSprite from "src/components/RSSprite";
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import FilterTable from "src/components/FilterTable";
import { useServer } from '../api/apiService';
import {getPublicFetch, getServerData } from "src/api/Api";

const Sprites = () => {

  const [tableData, setTableData] = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedSprite, setSelectedSprite] = useState(null);
  const [searchId, setSearchId] = useState('');
  const [downloadModalVisible, setDownloadModalVisible] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);

  // Fetch sprite data
  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await getPublicFetch(`sprite/`);

        if (!response.ok) throw new Error('Network response was not ok');

        const data = await response.json();
        const formattedData = data.map((item) => ({
          id: item.id,
          offsetX: item.offsetX,
        })).sort((a, b) => a.id - b.id);

        setTableData(formattedData);
        setFilteredData(formattedData);
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const downloadSprite = async (spriteId) => {
    try {
      const response = await getPublicFetch(`sprite/${spriteId}`);
      if (!response.ok) throw new Error(`Error fetching sprite ${spriteId}`);

      const blob = await response.blob();
      saveAs(blob, `sprite_${spriteId}.png`);
    } catch (error) {
      console.error('Error downloading sprite:', error);
    }
  };

  const downloadAllSprites = async () => {
    const zip = new JSZip();
    setDownloadModalVisible(true);

    const totalSprites = filteredData.length;
    let processedSprites = 0;

    await Promise.all(filteredData.map(async (item) => {
      try {
        const response = await getPublicFetch(`sprite/${item.id}`);
        if (response.ok) {
          const blob = await response.blob();
          zip.file(`sprite_${item.id}.png`, blob);
        }
      } catch (error) {
        console.error(`Error downloading sprite ${item.id}:`, error);
      }

      processedSprites += 1;
      setDownloadProgress(Math.round((processedSprites / totalSprites) * 100));
    }));

    const zipBlob = await zip.generateAsync({ type: 'blob' });
    saveAs(zipBlob, 'all_sprites.zip');
    setDownloadModalVisible(false);
  };

  const handleSearchIdChange = (e) => {
    const value = e.target.value;
    setSearchId(value);

    const filtered = tableData.filter((item) =>
      item.id.toString().includes(value) // Ensures ID 0 is included when filtering
    );

    console.log("Filtered Data:", filtered); // Debugging line
    setFilteredData(filtered);
  };

  const handleRowClick = (item) => {
    setSelectedSprite(item);
    setModalVisible(true);
  };

  const columns = [
    { key: 'id', label: 'ID', _style: { width: '30%' }, filter: false, sorter: false },
    { key: 'sprite', label: 'Sprite', filter: false, sorter: false },
  ];

  const scopedColumns = {
    sprite: (item) => (
      <td>
        <RSSprite onClick={() => handleRowClick(item)} key={item.id} rounded thumbnail id={item.id} width={40} height={40} />
      </td>
    ),
  };

  return (
    <>
      <FilterTable
        pageTitle="Sprites"
        tableData={filteredData}
        fetchData={() => {}}
        customFilters={
          <div style={{ display: 'flex', gap: '20px', alignItems: 'center', marginBottom: '10px' }}>
            <CFormInput
              type="text"
              placeholder="Search ID"
              value={searchId}
              onChange={handleSearchIdChange}
              style={{ width: '150px', padding: '8px', marginRight: '8px' }}
            />
            <CButton color="primary" onClick={downloadAllSprites} style={{ marginLeft: 'auto' }}>
              Download All Textures
            </CButton>
          </div>
        }
        columns={columns}
        scopedColumns={scopedColumns}
        loading={loading}
        CModalContent={({ item }) => <RSSprite id={item.id} />}
        handleRowClick={handleRowClick}
        handleDownloadItemIcon={downloadSprite}
      />

      {/* Modal for Sprite Details */}
      <CModal alignment="center" visible={modalVisible} onClose={() => setModalVisible(false)}>
        <CModalHeader>
          <CModalTitle>Sprite Details</CModalTitle>
        </CModalHeader>
        <CModalBody>
          {selectedSprite && <RSSprite id={selectedSprite.id} />}
        </CModalBody>
        <CModalFooter>
          <CButton color="primary" onClick={() => downloadSprite(selectedSprite.id)}>
            Download Sprite
          </CButton>
          <CButton color="secondary" onClick={() => setModalVisible(false)}>
            Close
          </CButton>
        </CModalFooter>
      </CModal>

      {/* Modal for Download Progress */}
      <CModal alignment="center" visible={downloadModalVisible} onClose={() => setDownloadModalVisible(false)}>
        <CModalHeader>
          <CModalTitle>Downloading Sprites</CModalTitle>
        </CModalHeader>
        <CModalBody>
          <p>Zipping and downloading all sprites. Please wait...</p>
          <CProgress value={downloadProgress} className="mb-3" />
          <p>{downloadProgress}% completed</p>
        </CModalBody>
        <CModalFooter>
          <CButton color="secondary" onClick={() => setDownloadModalVisible(false)} disabled={downloadProgress < 100}>
            Close
          </CButton>
        </CModalFooter>
      </CModal>
    </>
  );
};

export default Sprites;
