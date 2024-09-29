import React, { useState, useEffect } from 'react';
import {
  CButton,
  CModal,
  CModalHeader,
  CModalTitle,
  CModalBody,
  CModalFooter,
  CProgress, CFormSelect
} from "@coreui/react-pro";
import RSSprite from "src/components/RSSprite";
import { CFormInput } from "@coreui/react";
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import FilterTable from "src/components/FilterTable";
import {FaFilter, FaHashtag} from "react-icons/fa";

const Sprites = () => {
  const [tableData, setTableData] = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [visible, setVisible] = useState(false);
  const [selectedData, setSelectedData] = useState(null);
  const [searchId, setSearchId] = useState('');
  const [downloadModalVisible, setDownloadModalVisible] = useState(false); // Modal visibility for downloading
  const [downloadProgress, setDownloadProgress] = useState(0); // Track download progress


  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch('http://127.0.0.1:8080/public/sprite/');
        if (!response.ok) throw new Error('Network response was not ok');

        const data = await response.json();
        const formattedData = data.map((item) => ({
          id: item.id,
          offsetX: item.offsetX,
        }));

        setTableData(formattedData.sort((a, b) => a.id - b.id));
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
      const response = await fetch(`http://127.0.0.1:8080/public/sprite/${spriteId}`);
      if (!response.ok) throw new Error('Error fetching sprite');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `sprite_${spriteId}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('Error downloading sprite:', error);
    }
  };

  const downloadAllSprites = async () => {
    const zip = new JSZip();
    setDownloadModalVisible(true); // Show modal when download starts

    const totalSprites = filteredData.length;
    let processedSprites = 0;

    for (const item of filteredData) {
      try {
        const response = await fetch(`http://127.0.0.1:8080/public/sprite/${item.id}`);
        if (response.ok) {
          const blob = await response.blob();
          zip.file(`sprite_${item.id}.png`, blob);
        }
      } catch (error) {
        console.error(`Error downloading sprite ${item.id}:`, error);
      }

      // Update progress
      processedSprites += 1;
      const progress = Math.round((processedSprites / totalSprites) * 100);
      setDownloadProgress(progress);
    }

    zip.generateAsync({ type: 'blob' }).then((content) => {
      saveAs(content, 'all_sprites.zip');
      setDownloadModalVisible(false); // Hide modal when download finishes
    });
  };

  const handleSearchIdChange = (e) => {
    const value = e.target.value;
    setSearchId(value);

    const filtered = tableData.filter((item) =>
      item.id.toString().includes(value)
    );

    setFilteredData(filtered);
  };

  const handleRowClick = (item) => {
    setSelectedData(item);
    setVisible(true);
  };

  const customFilters = (
    <div style={{ display: 'flex', gap: '20px', alignItems: 'center', marginBottom: '10px' }}>
      {/* Search by ID */}
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <CFormInput
          type="text"
          placeholder="Search ID"
          value={searchId}
          onChange={handleSearchIdChange}
          style={{ width: '150px', padding: '8px', marginRight: '8px' }}
        />
      </div>

      {/* Download All Textures Button - Moved to Right */}
      <CButton color="primary" onClick={downloadAllSprites} style={{ marginLeft: 'auto' }}>
        Download All Textures
      </CButton>
    </div>
  );


  const columns = [
    {
      key: 'id',
      label: 'ID',
      _style: { width: '30%' },
      filter: false,
      sorter: false,
    },
    {
      key: 'sprite',
      label: 'Sprite',
      filter: false,
      sorter: false,
    },
  ];

  const scopedColumns = {
    sprite: (item) => (
      <td>
        <RSSprite onClick={() => handleRowClick(item)} key={item.id} rounded thumbnail id={item.id} width={40} height={40} keepAspectRatio />
      </td>
    ),
  };

  const CustomModalBody = ({ item }) => (
    <>
      <RSSprite id={item.id} />
    </>
  );

  return (
    <>
      <FilterTable
        pageTitle={"Sprites"}
        tableData={filteredData} // Pass the filtered data here
        fetchData={() => {}} // No need to refetch, data already loaded
        customFilters={customFilters}
        columns={columns}
        scopedColumns={scopedColumns}
        loading={loading}
        CModalContent={CustomModalBody}
        handleRowClick={handleRowClick}
        handleDownloadItemIcon={downloadSprite}
      />

      {/* Modal Component for Sprite Details */}
      <CModal alignment="center" visible={visible} onClose={() => setVisible(false)}>
        <CModalHeader>
          <CModalTitle>Sprite Details</CModalTitle>
        </CModalHeader>
        <CModalBody>
          {selectedData && <RSSprite id={selectedData.id} />}
        </CModalBody>
        <CModalFooter>
          <CButton color="primary" onClick={() => downloadSprite(selectedData.id)}>
            Download Sprite
          </CButton>
          <CButton color="secondary" onClick={() => setVisible(false)}>
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
