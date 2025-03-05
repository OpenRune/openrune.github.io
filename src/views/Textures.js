import React, { useState, useEffect } from 'react';
import {
  CButton,
  CModal,
  CModalHeader,
  CModalTitle,
  CModalBody,
  CModalFooter,
  CFormInput,
  CFormSelect,
  CSpinner,
  CCard,
  CCardHeader,
  CCardBody,
} from "@coreui/react-pro";
import { FaChevronUp, FaChevronDown, FaHashtag, FaFilter } from "react-icons/fa"; // Added FaFilter icon
import RSSprite from "src/components/RSSprite";
import ColorBox from "src/api/ColorBox";
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import FilterTable from "src/components/FilterTable";
import {getPublicFetch} from "src/api/Api";

const Textures = () => {
  const perPage = 30;
  const [itemsPerPage, setItemsPerPage] = useState(perPage);
  const [tableData, setTableData] = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [visible, setVisible] = useState(false);
  const [selectedData, setSelectedData] = useState(null);
  const [searchId, setSearchId] = useState('');
  const [isTransparentFilter, setIsTransparentFilter] = useState('all');
  const [filtersVisible, setFiltersVisible] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await getPublicFetch('texture/');
        if (!response.ok) throw new Error('Network response was not ok');

        const data = await response.json();
        const formattedData = data.map((item) => ({
          id: item.id,
          isTransparent: item.isTransparent,
          averageRgb: item.averageRgb,
          animationDirection: item.animationDirection,
          animationSpeed: item.animationSpeed,
          spriteIds: item.fileIds,
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

  const handleRowClick = (item) => {
    setSelectedData(item);
    setVisible(true);
  };

  const handleSearchIdChange = (e) => {
    const value = e.target.value;
    setSearchId(value);

    const filtered = tableData.filter((item) =>
      item.id.toString().includes(value)
    );

    setFilteredData(filtered);
  };

  const handleTransparencyFilterChange = (e) => {
    const value = e.target.value;
    setIsTransparentFilter(value);

    const filtered = tableData.filter((item) => {
      if (value === 'all') return true;
      return value === 'true' ? item.isTransparent : !item.isTransparent;
    });

    setFilteredData(filtered);
  };

  const handleDownloadTexture = async (item) => {
    if (!item || item.spriteIds.length === 0) return;

    if (item.spriteIds.length === 1) {
      // If only one sprite, download directly
      const response = await getPublicFetch(`sprite/${item.spriteIds[0]}.png`);
      const blob = await response.blob();
      saveAs(blob, `${item.spriteIds[0]}.png`);
    } else {
      // If multiple sprites, create a zip
      const zip = new JSZip();
      await Promise.all(item.spriteIds.map(async (spriteId) => {
        const response = await getPublicFetch(`sprite/${spriteId}.png`);
        const blob = await response.blob();
        zip.file(`${spriteId}.png`, blob);
      }));

      zip.generateAsync({ type: 'blob' }).then((content) => {
        saveAs(content, `textures_${item.id}.zip`);
      });
    }
  };

  const handleDownloadAll = async () => {
    const zip = new JSZip();
    await Promise.all(tableData.map(async (item) => {
      if (item.spriteIds.length === 1) {
        // If only one sprite, add to zip
        const response = await getPublicFetch(`sprite/${item.spriteIds[0]}.png`);
        const blob = await response.blob();
        zip.file(`${item.spriteIds[0]}.png`, blob);
      } else {
        // If multiple sprites, add all to zip
        await Promise.all(item.spriteIds.map(async (spriteId) => {
          const response = await getPublicFetch(`sprite/${spriteId}.png`);
          const blob = await response.blob();
          zip.file(`${spriteId}.png`, blob);
        }));
      }
    }));

    zip.generateAsync({ type: 'blob' }).then((content) => {
      saveAs(content, 'all_textures.zip');
    });
  };

  const columns = [
    {
      key: 'id',
      label: 'ID',
      _style: { width: '30%' },
      filter: false,
      sorter: false,
    },
    {
      key: 'transparency',
      label: 'Transparency',
      filter: false,
      sorter: false,
    },
    {
      key: 'averageRgb',
      label: 'Average RGB',
      filter: false,
      sorter: false,
    },
    {
      key: 'animationDirection',
      label: 'Direction',
      filter: false,
      sorter: false,
    },
    {
      key: 'animationSpeed',
      label: 'Speed',
      filter: false,
      sorter: false,
    },
    {
      key: 'sprites',
      label: 'Sprites',
      filter: false,
      sorter: false,
    },
  ];

  const scopedColumns = {
    transparency: (item) => (
      <td>{item.isTransparent ? 'Yes' : 'No'}</td>
    ),
    averageRgb: (item) => (
      <td>
        <ColorBox width={80} height={80} packedHsl={item.averageRgb} tooltip showHex />
      </td>
    ),
    sprites: (item) => (
      <td style={{ display: 'flex', gap: '10px' }}>
        {item.spriteIds.map((spriteId) => (
          <RSSprite
            key={spriteId}
            rounded
            thumbnail
            id={spriteId}
            width={80}
            height={80}
            keepAspectRatio
            onClick={() => handleRowClick(item)}
          />
        ))}
      </td>
    ),
  };

  const customFilters = (
    <div style={{ display: 'flex', gap: '20px', alignItems: 'center', marginBottom: '10px' }}>
      {/* Search by ID */}
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <FaHashtag style={{ marginRight: '8px' }} />
        <CFormInput
          type="text"
          placeholder="Search ID"
          value={searchId}
          onChange={handleSearchIdChange}
          style={{ width: '150px' }}
        />
      </div>

      {/* Transparency Filter */}
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <FaFilter style={{ marginRight: '8px' }} /> {/* Filter Icon */}
        <CFormSelect
          value={isTransparentFilter}
          onChange={handleTransparencyFilterChange}
          style={{ width: '150px' }}
        >
          <option value="all">All</option>
          <option value="true">Transparent</option>
          <option value="false">Opaque</option>
        </CFormSelect>
      </div>

      {/* Download All Textures Button - Moved to Right */}
      <CButton color="primary" onClick={handleDownloadAll} style={{ marginLeft: 'auto' }}>
        Download All Textures
      </CButton>
    </div>
  );

  return (
    <>
      <FilterTable
        pageTitle="Textures"
        tableData={filteredData}
        columns={columns}
        scopedColumns={scopedColumns}
        loading={loading}
        customFilters={customFilters}
        handleRowClick={handleRowClick}
      />

      {selectedData && (
        <CModal alignment="center" visible={visible} onClose={() => setVisible(false)}>
          <CModalHeader>
            <CModalTitle>Texture Details</CModalTitle>
          </CModalHeader>
          <CModalBody>
            <p><strong>ID:</strong> {selectedData.id}</p>
            <p><strong>Transparent:</strong> {selectedData.isTransparent ? 'Yes' : 'No'}</p>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '10px' }}>
              <strong style={{ marginRight: '10px' }}>Average RGB:</strong>
              <ColorBox width={55} height={55} tooltip showHex packedHsl={selectedData.averageRgb} />
            </div>
            <p><strong>Animation Direction:</strong> {selectedData.animationDirection}</p>
            <p><strong>Animation Speed:</strong> {selectedData.animationSpeed}</p>
            <p><strong>Sprites:</strong></p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {selectedData.spriteIds.map((spriteId) => (
                <div key={spriteId} style={{ textAlign: 'center' }}>
                  <RSSprite id={spriteId} width={80} height={80} keepAspectRatio />
                  <p>{spriteId}</p>
                </div>
              ))}
            </div>
          </CModalBody>
          <CModalFooter>
            <CButton color="primary" onClick={() => handleDownloadTexture(selectedData)}>
              Download
            </CButton>
            <CButton color="secondary" onClick={() => setVisible(false)}>
              Close
            </CButton>
          </CModalFooter>
        </CModal>
      )}
    </>
  );
};

export default Textures;
