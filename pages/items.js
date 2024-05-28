import React, { useState, useEffect, useRef } from "react";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import { InputText } from "primereact/inputtext";
import { Blocks } from "react-loader-spinner";
import { Dialog } from "primereact/dialog";
import { TabPanel, TabView } from "primereact/tabview";
import { Button, Dropdown } from "react-bootstrap";
import {FaCopy, FaHistory, FaInfoCircle} from 'react-icons/fa';
import { Light as SyntaxHighlighter } from 'react-syntax-highlighter';
import { atomOneDark } from 'react-syntax-highlighter/dist/cjs/styles/hljs';
import { TieredMenu } from "primereact/tieredmenu";
import { Menubar } from "primereact/menubar";

const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text).then(() => {
        alert('Copied to clipboard');
    }, () => {
        alert('Failed to copy to clipboard');
    });
};

const CustomMenuItem = ({ label }) => (
    <div className="custom-menu-item">
        <FaHistory style={{ marginRight: '10px' }} />
        <span>{label}</span>
    </div>
);

const ItemTableHeader = ({ dateOptions, resetFilters, searchText, onSearchChange, showNoted, onShowNotedChange, selectedDate, handleDateChange, comparison, handleComparisonChange }) => {
    const [selectedComparison, setSelectedComparison] = useState('');
    const [selectedDateFilter, setSelectedDateFilter] = useState(selectedDate);

    const handleComparisonButtonClick = (value) => {
        const newValue = selectedComparison === value ? '' : value;
        setSelectedComparison(newValue);
        handleComparisonChange(newValue);
    };

    const handleDateFilterChange = (value) => {
        setSelectedDateFilter(value);
        handleDateChange({ target: { value } });
    };

    const dateItems = Object.keys(dateOptions).map(key => ({
        label: key,
        value: dateOptions[key],
        icon: selectedDateFilter === dateOptions[key] ? 'pi pi-check' : null
    }));

    const BuyMenuItems = [
        {
            label: (
                <CustomMenuItem
                    src="/buy_icon.png"
                    label="Rev Filter"
                />
            ),
            items: [
                ...dateItems.map(item => ({
                    label: item.label,
                    icon: item.icon,
                    command: () => handleDateFilterChange(item.value)
                })),
                {
                    template: () => (
                        <div style={{ display: 'flex', justifyContent: 'center', marginTop: '10px', width: '100%' }}>
                            <Button
                                style={{
                                    margin: '0 5px',
                                    flex: 1,
                                    backgroundColor: selectedComparison === '=' ? 'blue' : '',
                                    color: selectedComparison === '=' ? 'white' : ''
                                }}
                                onClick={() => handleComparisonButtonClick('=')}
                            >
                                =
                            </Button>
                            <Button
                                style={{
                                    margin: '0 5px',
                                    flex: 1,
                                    backgroundColor: selectedComparison === '<=' ? 'blue' : '',
                                    color: selectedComparison === '<=' ? 'white' : ''
                                }}
                                onClick={() => handleComparisonButtonClick('<=')}
                            >
                                &lt;=
                            </Button>
                            <Button
                                style={{
                                    margin: '0 5px',
                                    flex: 1,
                                    backgroundColor: selectedComparison === '>=' ? 'blue' : '',
                                    color: selectedComparison === '>=' ? 'white' : ''
                                }}
                                onClick={() => handleComparisonButtonClick('>=')}
                            >
                                &gt;=
                            </Button>
                        </div>
                    )
                }
            ]
        }
    ];

    return (
        <div className="flex" style={{ display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column" }}>
            <div className="flex align-items-center double-line">
                <div className="flex row1">
                    <span className="p-input-icon-left" style={{ marginLeft: "10px" }}>
                        <i className="pi pi-search" />
                        <InputText
                            value={searchText}
                            onChange={onSearchChange}
                            placeholder="Item Search"
                        />
                    </span>
                    <span className="custom-checkbox" style={{ marginLeft: "10px", display: 'flex', alignItems: 'center' }}>
                        <input
                            type="checkbox"
                            id="notedCheckbox"
                            checked={showNoted}
                            onChange={onShowNotedChange}
                        />
                        <label htmlFor="notedCheckbox" className="p-checkbox-label" style={{ marginLeft: "5px", fontSize: '16px' }}>
                            Show Noted Items
                        </label>
                    </span>
                    <span className="flexcenter" style={{ marginLeft: "10px" }}>
                        <div className="custom-menubar-container">
                            <Menubar model={BuyMenuItems} className="custom-menubar" />
                        </div>
                    </span>
                    <Button style={{ marginLeft: "10px" }} onClick={resetFilters}>
                        Reset Filters
                    </Button>
                </div>
            </div>
        </div>
    );
};

export function Items() {
    const [searchText, setSearchText] = useState("");
    const [rowsPerPage, setRowsPerPage] = useState(30);
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showNoted, setShowNoted] = useState(false);
    const [showDialog, setShowDialog] = useState(false);
    const [serverContent, setServerContent] = useState('');
    const [cacheContent, setCacheContent] = useState('');
    const [serverError, setServerError] = useState('');
    const [cacheError, setCacheError] = useState('');
    const [selectedItemId, setSelectedItemId] = useState(null);
    const [selectedItemName, setSelectedItemName] = useState(null);
    const [sortField, setSortField] = useState(null);
    const [sortOrder, setSortOrder] = useState(null);
    const [comparison, setComparison] = useState('=');
    const [selectedDate, setSelectedDate] = useState(null);
    const dateOptions = { '162': 1516859177, '222': 1716439577 }; // Example date options
    const getBaseUrl = () => {
        if (window.location.hostname === 'openrune.github.io') {
            const pathArray = window.location.pathname.split('/');
            return pathArray.length > 1 ? `/${pathArray[1]}` : '';
        }
        return '';
    };
    useEffect(() => {
        fetch(`${getBaseUrl()}/items/items.json`)
            .then(response => response.json())
            .then(data => {
                setData(data);
                setLoading(false);
            })
            .catch(error => {
                console.error("Error loading data: ", error);
                setLoading(false);
            });

        const savedShowNoted = localStorage.getItem('showNoted');
        if (savedShowNoted !== null) {
            setShowNoted(savedShowNoted === 'true');
        }
    }, []);

    const handleDateChange = (event) => {
        setSelectedDate(parseInt(event.target.value));
    };

    const handleComparisonChange = (newComparison) => {
        setComparison(newComparison);
    };

    useEffect(() => {
        localStorage.setItem('showNoted', showNoted);
    }, [showNoted]);

    const resetFilters = () => {
        setSearchText("");
        setSortField(null);
        setSortOrder(null);
        setComparison('=');
        setSelectedDate(null);
    };

    const onSearchChange = (event) => {
        setSearchText(event.target.value);
    };

    const onShowNotedChange = (event) => {
        setShowNoted(event.target.checked);
    };

    const openDialog = (id, name) => {
        setSelectedItemId(id);
        setSelectedItemName(name);
        setShowDialog(true);
        fetchServerData(id);
        fetchCacheData(id);
    };

    const filterItems = () => {
        return data.filter(item => {
            const matchesSearch = item.name.toLowerCase().includes(searchText.toLowerCase());
            const matchesNoted = showNoted || !item.isNoted;
            const matchesDate = selectedDate ? compareDate(item.releaseDate, selectedDate, comparison) : true;
            return matchesSearch && matchesNoted && matchesDate;
        });
    };

    const compareDate = (itemDate, selectedDate, comparison) => {
        const startDate = selectedDate - (3 * 24 * 60 * 60);
        const endDate = selectedDate + (3 * 24 * 60 * 60);

        switch (comparison) {
            case '=':
                return itemDate >= startDate && itemDate <= endDate;
            case '>=':
                return itemDate >= startDate;
            case '<=':
                return itemDate <= endDate;
            default:
                return true;
        }
    };

    const filteredItems = filterItems();

    const renderIcon = (rowData) => {
        const imagePath = `${getBaseUrl()}/items/items-icons/${rowData.id}.png`;
        return (
            <div className="image-text-container">
                <img
                    src={imagePath}
                    alt={rowData.name}
                    width={34}
                    height={34}
                    style={{ margin: 4, objectFit: 'contain' }}
                />
            </div>
        );
    };

    const fetchCacheData = async (id) => {
        const url = `${getBaseUrl()}/items/cache-defs/${id}.json`;
        try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error('Item not found');
            }
            const itemData = await response.json();
            setCacheContent(JSON.stringify(itemData, null, 2));
            setCacheError('');
        } catch (error) {
            setCacheContent('');
            setCacheError('Item not found');
        }
    };

    const fetchServerData = async (id) => {
        const url = `https://raw.githubusercontent.com/0xNeffarion/osrsreboxed-db/master/docs/items-json/${id}.json`;
        try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error('Item not found');
            }
            const itemData = await response.json();
            setServerContent(JSON.stringify(itemData, null, 2));
            setServerError('');
        } catch (error) {
            setServerContent('');
            setServerError('Item not found');
        }
    };

    const renderButton = (rowData) => {
        return (
            <Button
                className="custom-button"
                onClick={() => openDialog(rowData.id, rowData.name)}
            >
                <FaInfoCircle className="custom-button-icon" />
                Details
            </Button>
        );
    };

    const onSort = (event) => {
        const { sortField, sortOrder } = event;
        setSortField(sortField);
        setSortOrder(sortOrder);
    };

    const sortedItems = filteredItems.sort((a, b) => {
        let comparisonResult = 0;

        if (sortField && sortOrder !== null) {
            const valueA = a[sortField];
            const valueB = b[sortField];
            comparisonResult = (valueA < valueB ? -1 : (valueA > valueB ? 1 : 0)) * sortOrder;

            if (comparisonResult !== 0) {
                return comparisonResult;
            }
        }

        if (sortField === 'releaseDate' && selectedDate !== null) {
            switch (comparison) {
                case '=':
                    return (a.releaseDate === selectedDate ? 0 : (a.releaseDate < selectedDate ? -1 : 1)) - (b.releaseDate === selectedDate ? 0 : (b.releaseDate < selectedDate ? -1 : 1));
                case '>=':
                    return (a.releaseDate >= selectedDate ? 0 : -1) - (b.releaseDate >= selectedDate ? 0 : -1);
                case '<=':
                    return (a.releaseDate <= selectedDate ? 0 : -1) - (b.releaseDate <= selectedDate ? 0 : -1);
                default:
                    return a.id - b.id;  // Default sort by ID if no comparison is specified
            }
        }

        return a.id - b.id;  // Default sort by ID if no sortField or sortOrder
    });

    if (loading) {
        return (
            <div className="center-div">
                Loading Items
                <div className="loading-animation">
                    <Blocks
                        height="100"
                        width="100"
                        color="#4fa94d"
                        ariaLabel="blocks-loading"
                        wrapperStyle={{}}
                        wrapperClass="blocks-wrapper"
                        visible={true}
                    />
                </div>
            </div>
        );
    } else {
        return (
            <>
                <div className="center-div" style={{ height: '10vh' }}>
                    <h5 className="natureRune" style={{
                        display: "flex",
                        flexDirection: "row",
                        justifyContent: "center"
                    }}>Total Items: <div style={{ color: "yellow", paddingLeft: '10px' }}> {data.length.toLocaleString()} </div></h5>
                </div>

                <DataTable
                    value={sortedItems}
                    responsiveLayout="scroll"
                    size="small"
                    showGridlines
                    stripedRows
                    header={
                        <ItemTableHeader
                            dateOptions={dateOptions}
                            resetFilters={resetFilters}
                            searchText={searchText}
                            onSearchChange={onSearchChange}
                            showNoted={showNoted}
                            onShowNotedChange={onShowNotedChange}
                            onResetFilters={resetFilters}
                            handleComparisonChange={handleComparisonChange}
                            selectedDate={selectedDate}
                            handleDateChange={handleDateChange}
                            comparison={comparison}
                        />
                    }
                    paginator
                    rows={rowsPerPage}
                    paginatorTemplate="RowsPerPageDropdown CurrentPageReport FirstPageLink PrevPageLink PageLinks NextPageLink LastPageLink"
                    currentPageReportTemplate="Showing {first} to {last} of {totalRecords}"
                    rowsPerPageOptions={[10, 30, 50]}
                    onRowsPerPageChange={(e) => setRowsPerPage(e.value)}
                    dataKey="id"
                    onSort={onSort}
                    sortField={sortField}
                    sortOrder={sortOrder}
                >
                    <Column
                        body={renderIcon}
                        header="Icon"
                        style={{ width: '50px' }}
                    />
                    <Column
                        field="id"
                        header="ID"
                        body={(rowData) => (
                            <div>
                                {rowData.id}
                            </div>
                        )}
                    />
                    <Column
                        body={(rowData) => (
                            <div>
                                {rowData.name}
                            </div>
                        )}
                        header="Name"
                        field="name"
                    />
                    <Column
                        field="releaseDate"
                        header="Release Date"
                        body={(rowData) => (
                            <div>
                                {new Date(rowData.releaseDate * 1000).toLocaleDateString('en-GB', {
                                    day: 'numeric',
                                    month: 'long',
                                    year: 'numeric'
                                })}
                            </div>
                        )}
                        sortable
                    />
                    <Column
                        body={renderButton}
                        header="Definitions"
                        style={{ width: '150px' }}
                    />
                </DataTable>
                <Dialog
                    header={`Definition: ${selectedItemName}`}
                    visible={showDialog}
                    style={{ width: '50vw' }}
                    onHide={() => setShowDialog(false)}
                >
                    <TabView>
                        <TabPanel header={
                            <div style={{ display: 'flex', alignItems: 'center' }}>
                                Client
                                <Button
                                    variant="link"
                                    style={{
                                        marginLeft: '10px',
                                        padding: 0,
                                        fontSize: '20px',
                                        color: '#007bff',
                                        background: 'none',
                                        border: 'none'
                                    }}
                                    onClick={() => copyToClipboard(cacheError || cacheContent)}
                                >
                                    <FaCopy />
                                </Button>
                            </div>
                        }>
                            <SyntaxHighlighter language="yaml" style={atomOneDark}>
                                {cacheError || cacheContent}
                            </SyntaxHighlighter>
                        </TabPanel>
                        <TabPanel header={
                            <div style={{ display: 'flex', alignItems: 'center' }}>
                                Server
                                <Button
                                    variant="link"
                                    style={{
                                        marginLeft: '10px',
                                        padding: 0,
                                        fontSize: '20px',
                                        color: '#007bff',
                                        background: 'none',
                                        border: 'none'
                                    }}
                                    onClick={() => copyToClipboard(serverError || serverContent)}
                                >
                                    <FaCopy />
                                </Button>
                            </div>
                        }>
                            <SyntaxHighlighter language="json" style={atomOneDark}>
                                {serverError || serverContent}
                            </SyntaxHighlighter>
                        </TabPanel>
                    </TabView>
                </Dialog>
            </>
        );
    }
}

export default Items;
