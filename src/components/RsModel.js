import React, { useState, useEffect } from 'react';
import {
  CModal,
  CModalHeader,
  CModalTitle,
  CModalBody,
  CModalFooter,
  CNav,
  CNavItem,
  CNavLink,
  CTabContent,
  CTabPane,
  CButton
} from '@coreui/react-pro';
import { useModal } from "src/api/ModalProvider";
import ColorBox from "src/api/ColorBox"; // Import useModal from the context provider

const RsModel = () => {
  const { visible, modelId, closeModal } = useModal(); // Access modal service to control modal behavior
  const [activeTab, setActiveTab] = useState(0); // Track active tab
  const [modelData, setModelData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      if (modelId) {
        setLoading(true);
        try {
          const response = await getPublicFetch(`model/${modelId}`);


          const data = await response.json();
          setModelData(data);
        } catch (error) {
          console.error('Error fetching model data:', error);
        } finally {
          setLoading(false);
        }
      }
    };

    fetchData();
  }, [modelId]);

  // Helper function to check if an array or list is empty
  const isEmptyArray = (arr) => Array.isArray(arr) && arr.length === 0;


  const capitalize = (str) => str.charAt(0).toUpperCase() + str.slice(1);

  // Helper function to render colors or textures in ColorBox components
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

  // Render model data based on whether values are default or not
  const renderModelData = () => {
    if (loading) {
      return <p>Loading data...</p>;
    }

    if (!modelData) {
      return <p>No data available.</p>;
    }

    const {totalFaces, totalVerts, textures, colors, attachments} = modelData;

    return (
      <div>
        {totalFaces > 0 && <p><strong>Total Faces:</strong> {totalFaces}</p>}
        {totalVerts > 0 && <p><strong>Total Verts:</strong> {totalVerts}</p>}

        {/* Render Color Fields */}
        {colors && renderColorBoxesInline('Colours', colors)}

        {/* Scrollable Attachments Section without border or padding */}
        {attachments && attachments.total > 0 && (
          <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
            <p><strong>Total Attachments:</strong> {attachments.total}</p>

            {/* Items Section */}
            {!isEmptyArray(attachments.items) && (
              <div>
                <h4>Items</h4>
                <ul>
                  {attachments.items.map((item, index) => (
                    <li key={index}>{item}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Objects Section */}
            {!isEmptyArray(attachments.objects) && (
              <div>
                <h4>Objects</h4>
                <ul>
                  {attachments.objects.map((object, index) => (
                    <li key={index}>{object}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* NPCs Section */}
            {!isEmptyArray(attachments.npcs) && (
              <div>
                <h4>NPCs</h4>
                <ul>
                  {attachments.npcs.map((npc, index) => (
                    <li key={index}>{npc}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

    return (
    <>
      {/* Modal with 3 tabs */}
      <CModal
        alignment="center"
        visible={visible}
        onClose={closeModal} // Close when backdrop or close button is clicked
        backdrop={true} // Enable clicking outside to close the modal
      >
        <CModalHeader>
          <CModalTitle>Model {modelId} Details</CModalTitle>
        </CModalHeader>
        <CModalBody>
          {/* Tab Navigation */}
          <CNav variant="tabs">
            <CNavItem>
              <CNavLink
                active={activeTab === 0}
                onClick={() => setActiveTab(0)}
              >
                Model Data
              </CNavLink>
            </CNavItem>
            <CNavItem>
              <CNavLink
                active={activeTab === 1}
                onClick={() => setActiveTab(1)}
              >
                Model View
              </CNavLink>
            </CNavItem>
          </CNav>

          {/* Tab Content */}
          <CTabContent>
            <CTabPane role="tabpanel" visible={activeTab === 0}>
              <div>{renderModelData()}</div>
            </CTabPane>
            <CTabPane role="tabpanel" visible={activeTab === 1}>
              <div>
                <p>Coming Soon</p>
              </div>
            </CTabPane>
          </CTabContent>
        </CModalBody>
        <CModalFooter>
          <CButton color="secondary" onClick={closeModal}>
            Close
          </CButton>
        </CModalFooter>
      </CModal>
    </>
  );
};

export default RsModel;
