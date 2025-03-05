import React, { useState, useEffect } from 'react';
import {
  CRow,
  CCol,
  CCard,
  CCardBody,
  CCardHeader,
  CFormInput,
  CFormLabel,
  CFormCheck,
  CButton,
  CTooltip,
} from '@coreui/react';
import { FiCopy } from 'react-icons/fi';
import RSItemIcon from 'src/components/RSItemIcon';
import { buildImageUrl } from 'src/components/RSItemIcon';
import AlertProviderWithDisplay, { useAlert } from 'src/components/AlertProviderWithDisplay';
import inventoryIcon from '../assets/images/inv.png';
import {getPublicFetch} from "src/api/Api"; // Path to your local image

const defaultValues = {
  itemId: 385, // Default to item 385
  xan2d: 0,
  yan2d: 0,
  zan2d: 0,
  xOffset2d: 0,
  yOffset2d: 0,
  zoom: 2000,
  quantity: 1,
  border: '#000000',
  shadowColor: '#000000',
  width: 32,
  height: 32,
  isNoted: false,
};

const InventoryHelper = () => {
  const [settings, setSettings] = useState(defaultValues);
  const [randomItemIds, setRandomItemIds] = useState([]);
  const { addAlert } = useAlert();
  const boxes = Array.from({ length: 28 }, (_, index) => index); // Create 28 grid boxes

  const updateSettings = (key, value) => setSettings(prev => ({ ...prev, [key]: value }));

  const fetchItemData = async (itemId) => {
    try {
      const response = await getPublicFetch(`item/${itemId}`);
      const item = await response.json();

      setSettings(prev => ({
        ...prev,
        xan2d: item.xan2d || defaultValues.xan2d,
        yan2d: item.yan2d || defaultValues.yan2d,
        zan2d: item.zan2d || defaultValues.zan2d,
        xOffset2d: item.xOffset2d || defaultValues.xOffset2d,
        yOffset2d: item.yOffset2d || defaultValues.yOffset2d,
        zoom: item.zoom || defaultValues.zoom,
      }));
    } catch (error) {
      console.error('Error fetching item data:', error);
    }
  };

  useEffect(() => {
    fetchItemData(defaultValues.itemId);

    // Generate random item IDs only once
    const generateRandomItemIds = () => {
      const ids = [];
      while (ids.length < 27) {
        const randomId = Math.floor(Math.random() * 1000); // Random ID between 0 and 999
        if (randomId !== defaultValues.itemId && !ids.includes(randomId)) {
          ids.push(randomId);
        }
      }
      return ids;
    };

    setRandomItemIds(generateRandomItemIds());
  }, []);

  const resetToDefault = () => {
    setSettings(defaultValues);
    fetchItemData(defaultValues.itemId);
  };

  const copyIconUrl = () => {
    const iconUrl = buildImageUrl(settings.itemId, {
      ...settings,
      zoom2d: settings.zoom,
    });
    navigator.clipboard.writeText(iconUrl);
    addAlert('Copied', 'success');
  };

  return (
    <CRow className="colors-container">
      <CCol md={3}>
        <CCard className="vertical-card mb-4">
          <CCardHeader>Item Settings</CCardHeader>
          <CCardBody>
            <CFormLabel htmlFor="itemId">Item ID</CFormLabel>
            <CFormInput
              type="number"
              id="itemId"
              value={settings.itemId}
              onChange={(e) => updateSettings('itemId', parseInt(e.target.value))}
              placeholder="Enter Item ID"
              min={0}
              className="mb-3"
            />

            <CFormLabel htmlFor="quantity">Quantity</CFormLabel>
            <CFormInput
              type="number"
              id="quantity"
              value={settings.quantity}
              onChange={(e) => updateSettings('quantity', parseInt(e.target.value))}
              min={1}
              className="mb-3"
            />

            <div className="d-flex align-items-center mb-3">
              <CFormLabel htmlFor="shadowColor" className="me-2">Shadow Color</CFormLabel>
              <CFormInput
                type="color"
                id="shadowColor"
                value={settings.shadowColor}
                onChange={(e) => updateSettings('shadowColor', e.target.value)}
              />
            </div>

            <div className="d-flex align-items-center mb-3">
              <CFormLabel htmlFor="borderColor" className="me-2">Border Color</CFormLabel>
              <CFormInput
                type="color"
                id="borderColor"
                value={settings.border}
                onChange={(e) => updateSettings('border', e.target.value)}
              />
            </div>

            <CFormLabel htmlFor="isNoted" style={{ marginRight: '5px' }}>Is Noted</CFormLabel>
            <CFormCheck
              type="checkbox"
              id="isNoted"
              checked={settings.isNoted}
              onChange={(e) => updateSettings('isNoted', e.target.checked)}
              className="mb-3"
            />

            <div className="d-flex align-items-center mb-3">
              <CFormLabel htmlFor="width" className="me-2">Width</CFormLabel>
              <CFormInput
                type="number"
                id="width"
                value={settings.width}
                onChange={(e) => updateSettings('width', parseInt(e.target.value))}
                min={16}
                className="me-3"
              />

              <CFormLabel htmlFor="height" className="me-2">Height</CFormLabel>
              <CFormInput
                type="number"
                id="height"
                value={settings.height}
                onChange={(e) => updateSettings('height', parseInt(e.target.value))}
                min={16}
              />
            </div>

            <CButton color="danger" className="mt-3" onClick={resetToDefault}>
              Reset to Default
            </CButton>
          </CCardBody>
        </CCard>
        <CCard>
          <CCardHeader>Current Values</CCardHeader>
          <CCardBody>
            <p><strong>X Angle 2D:</strong> {settings.xan2d}</p>
            <p><strong>Y Angle 2D:</strong> {settings.yan2d}</p>
            <p><strong>Z Angle 2D:</strong> {settings.zan2d}</p>
            <p><strong>X Offset 2D:</strong> {settings.xOffset2d}</p>
            <p><strong>Y Offset 2D:</strong> {settings.yOffset2d}</p>
            <p><strong>Zoom:</strong> {settings.zoom}</p>
          </CCardBody>
        </CCard>
      </CCol>

      <CCol md={9}>
        <CRow>
          <CCol md={6}>
            <CCard className="color-picker-card">
              <CCardHeader className="d-flex justify-content-between align-items-center">
                <span>Inventory Sprite Editor</span>
                <div className="d-flex align-items-center">
                  <CTooltip content="Copy Icon URL">
                    <CButton color="primary" onClick={copyIconUrl}>
                      <FiCopy />
                    </CButton>
                  </CTooltip>
                </div>
              </CCardHeader>

              <CCardBody className="d-flex justify-content-center align-items-center">
                <RSItemIcon
                  id={settings.itemId}
                  params={{
                    ...settings,
                    zoom2d: settings.zoom,
                  }}
                />
              </CCardBody>
            </CCard>

            {/* Sliders */}
            <CCard className="mt-3">
              <CCardHeader>Value Editor</CCardHeader>
              <CCardBody>
                <CRow className="mb-3 align-items-center">
                  <CCol xs={4}>
                    <CFormLabel htmlFor="xan2dRange">X Angle 2D</CFormLabel>
                  </CCol>
                  <CCol xs={5}>
                    <CFormInput
                      type="range"
                      id="xan2dRange"
                      min="0"
                      max="2047"
                      value={settings.xan2d}
                      onChange={(e) => updateSettings('xan2d', parseInt(e.target.value))}
                    />
                  </CCol>
                  <CCol xs={3}>
                    <CFormInput
                      type="number"
                      value={settings.xan2d}
                      min="0"
                      max="2047"
                      onChange={(e) => updateSettings('xan2d', parseInt(e.target.value))}
                    />
                  </CCol>
                </CRow>

                <CRow className="mb-3 align-items-center">
                  <CCol xs={4}>
                    <CFormLabel htmlFor="yan2dRange">Y Angle 2D</CFormLabel>
                  </CCol>
                  <CCol xs={5}>
                    <CFormInput
                      type="range"
                      id="yan2dRange"
                      min="0"
                      max="2047"
                      value={settings.yan2d}
                      onChange={(e) => updateSettings('yan2d', parseInt(e.target.value))}
                    />
                  </CCol>
                  <CCol xs={3}>
                    <CFormInput
                      type="number"
                      value={settings.yan2d}
                      min="0"
                      max="2047"
                      onChange={(e) => updateSettings('yan2d', parseInt(e.target.value))}
                    />
                  </CCol>
                </CRow>

                <CRow className="mb-3 align-items-center">
                  <CCol xs={4}>
                    <CFormLabel htmlFor="zan2dRange">Z Angle 2D</CFormLabel>
                  </CCol>
                  <CCol xs={5}>
                    <CFormInput
                      type="range"
                      id="zan2dRange"
                      min="0"
                      max="2047"
                      value={settings.zan2d}
                      onChange={(e) => updateSettings('zan2d', parseInt(e.target.value))}
                    />
                  </CCol>
                  <CCol xs={3}>
                    <CFormInput
                      type="number"
                      value={settings.zan2d}
                      min="0"
                      max="2047"
                      onChange={(e) => updateSettings('zan2d', parseInt(e.target.value))}
                    />
                  </CCol>
                </CRow>

                <CRow className="mb-3 align-items-center">
                  <CCol xs={4}>
                    <CFormLabel htmlFor="xOffset2dRange">X Offset 2D</CFormLabel>
                  </CCol>
                  <CCol xs={5}>
                    <CFormInput
                      type="range"
                      id="xOffset2dRange"
                      min="-250"
                      max="250"
                      value={settings.xOffset2d}
                      onChange={(e) => updateSettings('xOffset2d', parseInt(e.target.value))}
                    />
                  </CCol>
                  <CCol xs={3}>
                    <CFormInput
                      type="number"
                      value={settings.xOffset2d}
                      min="-250"
                      max="250"
                      onChange={(e) => updateSettings('xOffset2d', parseInt(e.target.value))}
                    />
                  </CCol>
                </CRow>

                <CRow className="mb-3 align-items-center">
                  <CCol xs={4}>
                    <CFormLabel htmlFor="yOffset2dRange">Y Offset 2D</CFormLabel>
                  </CCol>
                  <CCol xs={5}>
                    <CFormInput
                      type="range"
                      id="yOffset2dRange"
                      min="-250"
                      max="250"
                      value={settings.yOffset2d}
                      onChange={(e) => updateSettings('yOffset2d', parseInt(e.target.value))}
                    />
                  </CCol>
                  <CCol xs={3}>
                    <CFormInput
                      type="number"
                      value={settings.yOffset2d}
                      min="-250"
                      max="250"
                      onChange={(e) => updateSettings('yOffset2d', parseInt(e.target.value))}
                    />
                  </CCol>
                </CRow>

                <CRow className="mb-3 align-items-center">
                  <CCol xs={4}>
                    <CFormLabel htmlFor="zoomRange">Zoom</CFormLabel>
                  </CCol>
                  <CCol xs={5}>
                    <CFormInput
                      type="range"
                      id="zoomRange"
                      min="0"
                      max="2048"
                      value={settings.zoom}
                      onChange={(e) => updateSettings('zoom', parseInt(e.target.value))}
                    />
                  </CCol>
                  <CCol xs={3}>
                    <CFormInput
                      type="number"
                      value={settings.zoom}
                      min="0"
                      max="2048"
                      onChange={(e) => updateSettings('zoom', parseInt(e.target.value))}
                    />
                  </CCol>
                </CRow>
              </CCardBody>
            </CCard>

          </CCol>

          <CCol md={6}>
            <CCard className="color-picker-card" style={{ position: 'relative', width: '249px', height: '335px' }}>
              <CCardHeader>Inventory Preview</CCardHeader>
              <CCardBody className="d-flex justify-content-center align-items-center p-0" style={{ position: 'relative', width: '100%', height: '100%' }}>

                {/* Image */}
                <img
                  src={inventoryIcon}
                  alt="Local Resource"
                  style={{ width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', top: 0, left: 0 }}
                />

                {/* Grid Overlay */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(4, 36px)', // 4 columns of 36px width
                  gridTemplateRows: 'repeat(7, 32px)', // 7 rows of 32px height
                  gap: '2px', // 2px gap between grid cells (similar to OSRS)
                  position: 'absolute',
                  top: '30px', // Adjusted top offset
                  left: '50px', // Adjusted left offset
                  width: 'calc(36px * 4 + 3px)', // 4 columns + gaps
                  height: 'calc(32px * 7 + 6px)', // 7 rows + gaps
                  backgroundColor: 'rgba(0, 0, 0, 0.1)', // Optional slight background color to see the grid better
                  zIndex: 1 // Ensures the grid is on top of the image
                }}>
                  {boxes.map((box, index) => (
                    <div
                      key={box}
                      style={{
                        width: '36px',
                        height: '32px',
                        position: 'relative',
                        backgroundColor: box === 0 ? 'rgba(102, 255, 102, 0.5)' : 'transparent' // Light green background for the first box
                      }}
                    >
                      {box === 0 ? (
                        <RSItemIcon
                          id={settings.itemId} // First slot uses settings.itemId
                          params={{
                            ...settings,
                            zoom2d: settings.zoom,
                            width: 36,
                            height: 32,
                          }}
                        />
                      ) : (
                        <RSItemIcon
                          id={randomItemIds[index - 1]} // Use random item IDs for other slots
                          params={{ width: 36, height: 32 }}
                        />
                      )}
                    </div>
                  ))}
                </div>

              </CCardBody>
            </CCard>
          </CCol>
        </CRow>
      </CCol>
    </CRow>
  );
};

export default InventoryHelper;
