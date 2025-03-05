import React, { useState, useEffect } from 'react';
import {
  CButton,
  CFormInput
} from "@coreui/react-pro";
import FilterTable from "src/components/FilterTable";
import { useModal } from "src/api/ModalProvider";
import RsModel from "src/components/RsModel"; // Import the modal context and provider

const Models = () => {
  const [tableData, setTableData] = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchId, setSearchId] = useState('');

  const { openModal } = useModal(); // Access the modal opening function

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch('http://127.0.0.1:8090/public/model/');
        if (!response.ok) throw new Error('Network response was not ok');

        const data = await response.json();
        const formattedData = Object.values(data).map((item, index) => {
          const totalAttachments = item.attachments.items.length +
            item.attachments.objects.length +
            item.attachments.npcs.length;

          return {
            id: index,
            totalFaces: item.totalFaces,
            totalVerts: item.totalVerts,
            attachments: totalAttachments,
          };
        });

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

  const handleSearchIdChange = (e) => {
    const value = e.target.value;
    setSearchId(value);

    const filtered = tableData.filter((item) =>
      item.id.toString().includes(value)
    );

    setFilteredData(filtered);
  };

  const handleRowClick = (modelId) => {
    openModal(modelId); // Open the modal with the selected model ID
  };

  const customFilters = (
    <div style={{ display: 'flex', gap: '20px', alignItems: 'center', marginBottom: '10px' }}>
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <CFormInput
          type="text"
          placeholder="Search ID"
          value={searchId}
          onChange={handleSearchIdChange}
          style={{ width: '150px', padding: '8px', marginRight: '8px' }}
        />
      </div>
    </div>
  );

  const columns = [
    {
      key: 'id',
      label: 'ID',
      _style: { width: '10%' },
      filter: false,
      sorter: false,
    },
    {
      key: 'totalFaces',
      label: 'Total Faces',
      _style: { width: '20%' },
      filter: false,
      sorter: false,
    },
    {
      key: 'totalVerts',
      label: 'Total Verts',
      _style: { width: '20%' },
      filter: false,
      sorter: false,
    },
    {
      key: 'attachments',
      label: 'Attachments',
      _style: { width: '30%' },
      filter: false,
      sorter: false,
    },
    {
      key: 'view',
      label: 'View',
      _style: { width: '5%' },
      filter: false,
      sorter: false,
    },
  ];

  const scopedColumns = {
    view: (item) => (
      <td>
        <CButton color="primary" onClick={() => handleRowClick(item.id)}>
          View
        </CButton>
      </td>
    ),
  };

  return (
    <>
      <FilterTable
        pageTitle={"Models"}
        tableData={filteredData}
        fetchData={() => {}}
        customFilters={customFilters}
        columns={columns}
        scopedColumns={scopedColumns}
        loading={loading}
        handleRowClick={handleRowClick}
      />
      <RsModel />
    </>
  );
};

export default Models;
