import React, { useState, useEffect } from 'react';
import { CFormInput, CFormCheck, CButton, CModal, CModalHeader, CModalBody, CModalTitle, CModalFooter } from '@coreui/react-pro';
import { FaHashtag, FaTextWidth } from 'react-icons/fa';
import { saveAs } from 'file-saver';
import FilterTable from "src/components/FilterTable";
import { CNav, CNavItem, CNavLink, CTabContent, CTabPane } from "@coreui/react";
import ColorBox from "src/api/ColorBox";
import RSItemIcon from "src/components/RSItemIcon";
import { useModal } from "src/api/ModalProvider";
import RsModel from "src/components/RsModel";

const Items = () => {
  const [searchId, setSearchId] = useState('');
  const [searchName, setSearchName] = useState('');
  const [filterNulls, setFilterNulls] = useState(false);
  const [tableData, setTableData] = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false); // Modal visibility state
  const [selectedItem, setSelectedItem] = useState(null); // Currently selected item for the modal

  const fetchData = async () => {
    setLoading(true);
    try {
      const nullsParam = filterNulls ? 'nulls=false' : 'nulls=true';
      const response = await fetch(`http://127.0.0.1:8080/public/item/?${nullsParam}`);
      const data = await response.json();

      setTableData(data.map((item) => ({
        id: item.id,
        name: item.name,
        iconId: item.id
      })));
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [filterNulls]);

  useEffect(() => {
    applyFilters();
  }, [searchId, searchName, filterNulls, tableData]);

  const applyFilters = () => {
    let filtered = [...tableData];
    if (searchId) {
      filtered = filtered.filter((item) => item.id.toString().includes(searchId));
    }
    if (searchName) {
      filtered = filtered.filter((item) => item.name.toLowerCase().includes(searchName.toLowerCase()));
    }
    setFilteredData(filtered);
  };

  const handleIdChange = (e) => {
    const value = e.target.value;
    if (value === '' || /^[1-9]*$/.test(value)) {
      setSearchId(value);
    }
  };

  const handleDownloadItemIcon = async (item) => {
    const response = await fetch(`http://127.0.0.1:8080/public/item/${item.id}/icon`);
    const blob = await response.blob();
    saveAs(blob, `${item.name}_icon.png`);
  };

  const handleRowClick = async (item) => {
    try {
      const response = await fetch(`http://127.0.0.1:8080/public/item/${item.id}`);
      const fullItemData = await response.json();
      setSelectedItem(fullItemData);
      setModalVisible(true);
    } catch (error) {
      console.error('Error fetching item details:', error);
    }
  };

  const columns = [
    {
      key: 'icon',
      label: 'Icon',
      _style: { width: '5%' },
      filter: false,
      sorter: false,
    },
    {
      key: 'id',
      label: 'ID',
      _style: { width: '15%' },
      filter: false,
      sorter: false,
    },
    {
      key: 'name',
      label: 'Name',
      filter: false,
      sorter: false,
    },
    {
      key: 'info',
      label: 'Details',
      _style: { width: '5%' },
      filter: false,
      sorter: false,
    },
  ];

  const scopedColumns = {
    icon: (item) => (
      <td>
        <RSItemIcon id={item.id} />
      </td>
    ),
    info: (item) => (
      <td>
        <CButton color="primary" onClick={() => handleRowClick(item)}>
          View
        </CButton>
      </td>
    ),
  };

  const customFilters = (
    <div style={{ display: 'flex', gap: '20px', alignItems: 'center', marginBottom: '10px' }}>
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <FaHashtag style={{ marginRight: '8px' }} />
        <CFormInput
          type="text"
          placeholder="Search ID"
          value={searchId}
          onChange={handleIdChange}
          style={{ width: '150px' }}
        />
      </div>

      <div style={{ display: 'flex', alignItems: 'center' }}>
        <FaTextWidth style={{ marginRight: '8px' }} />
        <CFormInput
          type="text"
          placeholder="Search Name"
          value={searchName}
          onChange={(e) => setSearchName(e.target.value)}
          style={{ width: '150px' }}
        />
      </div>

      <CFormCheck
        id="filter-nulls"
        label="Exclude Nulls"
        checked={filterNulls}
        onChange={(e) => setFilterNulls(e.target.checked)}
      />
    </div>
  );

  return (
    <>
      <FilterTable
        pageTitle={"Items"}
        tableData={filteredData}
        fetchData={fetchData}
        customFilters={customFilters}
        columns={columns}
        scopedColumns={scopedColumns}
        loading={loading}
        handleDownloadItemIcon={handleDownloadItemIcon}
        handleRowClick={handleRowClick}
      />

      <RsModel />

      {selectedItem && (
        <CModal visible={modalVisible} onClose={() => setModalVisible(false)}>
          <CModalHeader>
            <CModalTitle>
              <RSItemIcon id={selectedItem.id} />
              Item: {selectedItem.name}
            </CModalTitle>
          </CModalHeader>
          <CModalBody>
            <CustomModalBody item={selectedItem} closeParentModal={() => setModalVisible(false)} />
          </CModalBody>
          <CModalFooter>
            <CButton color="secondary" onClick={() => setModalVisible(false)}>
              Close
            </CButton>
          </CModalFooter>
        </CModal>
      )}
    </>
  );
};

const CustomModalBody = ({ item, closeParentModal }) => {
  const [activeTab, setActiveTab] = useState(0);
  const { openModal } = useModal();

  const isDefaultValue = (key, value) => {
    const defaults = {
      id: -1,
      name: "null",
      examine: "null",
      resizeX: 128,
      resizeY: 128,
      resizeZ: 128,
      xan2d: 0,
      category: -1,
      yan2d: 0,
      zan2d: 0,
      equipSlot: -1,
      appearanceOverride1: -1,
      appearanceOverride2: -1,
      weight: 0.0,
      cost: 1,
      isTradeable: false,
      stacks: 0,
      inventoryModel: 0,
      members: false,
      zoom2d: 2000,
      xOffset2d: 0,
      yOffset2d: 0,
      ambient: 0,
      contrast: 0,
      options: [null, null, "Take", null, null],
      interfaceOptions: [null, null, null, null, "Drop"],
      maleModel0: -1,
      maleModel1: -1,
      maleModel2: -1,
      maleHeadModel0: -1,
      maleHeadModel1: -1,
      femaleModel0: -1,
      femaleModel1: -1,
      femaleModel2: -1,
      femaleHeadModel0: -1,
      femaleHeadModel1: -1,
      noteLinkId: -1,
      noteTemplateId: -1,
      teamCape: 0,
      dropOptionIndex: -2,
      unnotedId: -1,
      notedId: -1,
      placeholderLink: -1,
      placeholderTemplate: -1,
      inherit: -1,
      option3: "Take",
      ioption5: "Drop",
      attackSpeed: -1,
      equipType: 0,
      weaponType: -1
    };

    return defaults.hasOwnProperty(key) && value === defaults[key];
  };

  const handleModelClick = (modelId) => {
    closeParentModal(); // Close the parent modal
    openModal(modelId); // Then open the RsModel modal
  };

  const renderItemDetails = () => {
    return Object.entries(item).map(([key, value]) => {
      if (!isDefaultValue(key, value)) {
        // Handle clickable fields for model IDs
        if (
          key === 'maleModel0' || key === 'maleModel1' || key === 'maleModel2' ||
          key === 'maleHeadModel0' || key === 'maleHeadModel1' ||
          key === 'femaleModel0' || key === 'femaleModel1' || key === 'femaleModel2' ||
          key === 'femaleHeadModel0' || key === 'femaleHeadModel1' || key === 'inventoryModel'
        ) {
          return (
            <div key={key} style={{ margin: '5px', display: 'flex', alignItems: 'center' }}>
              <strong style={{ marginRight: '10px' }}>{capitalize(key)}:</strong>
              <CButton color="primary" onClick={() => handleModelClick(value)}>
                {value}
              </CButton>
            </div>
          );
        }

        // Handle color fields (originalColours, modifiedColours)
        if (key === 'originalColours' || key === 'modifiedColours' || key === 'originalTextureColours' || key === 'modifiedTextureColours') {
          return (
            <div key={key} style={{ margin: '5px' }}>
              {renderColorBoxesInline(key, value)}
            </div>
          );
        }

        // Handle averageRgb with ColorBox
        if (key === 'averageRgb') {
          return (
            <div key={key} style={{ margin: '5px' }}>
              <strong>{capitalize(key)}:</strong>
              <ColorBox
                width={40}
                height={40}
                packedHsl={value}
                tooltip
              />
            </div>
          );
        }

        // Render other fields normally if they are not default values
        return (
          <div key={key} style={{ margin: '5px' }}>
            <strong>{capitalize(key)}:</strong> {Array.isArray(value) ? value.join(", ") : value.toString()}
          </div>
        );
      }
      return null;
    });
  };

  const capitalize = (str) => {
    return str.replace(/([A-Z])/g, ' $1').replace(/^./, (match) => match.toUpperCase());
  };

  const renderColorBoxesInline = (key, colors) => (
    <div style={{ display: 'flex', alignItems: 'center', marginBottom: '10px' }}>
      <strong style={{ marginRight: '10px' }}>{capitalize(key)}:</strong>
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
        {colors && colors.length > 0 ? colors.map((color, index) => (
          <ColorBox
            key={index}
            width={30}
            height={30}
            packedHsl={color}
            tooltip
          />
        )) : <p>No colors available.</p>}
      </div>
    </div>
  );

  return (
    <>
      <CNav variant="underline-border">
        <CNavItem>
          <CNavLink
            active={activeTab === 0}
            onClick={() => setActiveTab(0)}
          >
            General Info
          </CNavLink>
        </CNavItem>
        <CNavItem>
          <CNavLink
            active={activeTab === 1}
            onClick={() => setActiveTab(1)}
          >
            Client Data
          </CNavLink>
        </CNavItem>
      </CNav>

      <CTabContent style={{
        overflowX: 'auto',
        overflowY: 'auto',
        maxHeight: '640px',
        whiteSpace: 'pre-wrap'
      }}>
        <CTabPane visible={activeTab === 0}>
          {renderItemDetails()}
        </CTabPane>

        <CTabPane visible={activeTab === 1}>
          <pre style={{
            padding: '10px',
            borderRadius: '5px'
          }}>
            {JSON.stringify(item, null, 2)}
          </pre>
        </CTabPane>
      </CTabContent>
    </>
  );
};
export default Items;
