import React, {useState, useEffect, useRef} from "react";
import {DataTable} from "primereact/datatable";
import {Column} from "primereact/column";
import {Dialog} from "primereact/dialog";
import {TabPanel, TabView} from "primereact/tabview";
import {Button} from "react-bootstrap";
import {FaCog, FaCopy, FaGreaterThanEqual, FaInfoCircle} from 'react-icons/fa';
import {Light as SyntaxHighlighter} from 'react-syntax-highlighter';
import {atomOneDark} from 'react-syntax-highlighter/dist/cjs/styles/hljs';
import {Blocks} from "react-loader-spinner";
import {InputText} from "primereact/inputtext";
import {Menubar} from "primereact/menubar";
import RevisionFilter from "../components/RevisionFilter";
import {RiFilterOffFill} from "react-icons/ri";

const Header = ({
                    dateOptions,
                    resetFilters,
                    searchText,
                    onSearchChange,
                    showNoted,
                    onShowNotedChange,
                    selectedDate,
                    handleDateChange,
                    comparison,
                    handleComparisonChange
                }) => {
    const menuItems = [{
        label: (<span>
          <FaCog style={{marginRight: '5px'}}/>
          Options
        </span>), items: [{
            template: () => (<div>
                {['Noted Items', 'Null Items'].map((option) => (<label key={option} className="custom-checkbox">
                    <input
                        type="checkbox"
                        value={option}
                        checked={option === 'Noted Items' ? showNoted : false}
                        onChange={(event) => {
                            const isChecked = event.target.checked;
                            if (option === 'Noted Items') {
                                onShowNotedChange(isChecked)
                            }
                        }}
                        style={{
                            width: '25px', height: '25px'
                        }} // Fixed width and height for the input element
                    />
                    <span style={{whiteSpace: 'nowrap'}}> {option}</span>
                </label>))}
            </div>)
        }]
    }];

    return (
        <div className="flex"
             style={{display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column"}}>
            <div className="flex align-items-center double-line">
                <div className="flex row1">
                    <span className="p-input-icon-left" style={{marginLeft: "10px"}}>
                        <i className="pi pi-search"/>
                        <InputText
                            value={searchText}
                            onChange={onSearchChange}
                            placeholder="Item Search"
                        />
                    </span>
                    <span className="flexcenter" style={{marginLeft: "10px"}}>
                           <div className="custom-menubar-container" style={{display: 'inline-block'}}>
                        <Menubar model={menuItems} className="custom-menubar"/>
                    </div>
                    </span>
                    <span className="flexcenter" style={{marginLeft: "10px"}}>
                        <RevisionFilter
                            dateOptions={dateOptions}
                            selectedDate={selectedDate}
                            handleDateChange={handleDateChange}
                            comparison={comparison}
                            handleComparisonChange={handleComparisonChange}
                        />
                    </span>
                    <Button
                        className="button-global"
                        onClick={resetFilters}
                        style={{
                            backgroundColor: '#E42C27',
                            color: 'white',
                        }}
                        onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#D22C1F'}
                        onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#E42C27'}
                    >
                        <RiFilterOffFill className='icon'/>
                        Clear Filters
                    </Button>

                </div>
            </div>
        </div>
    );
};

const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text).then(() => {
        alert('Copied to clipboard');
    }, () => {
        alert('Failed to copy to clipboard');
    });
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
    const [selectedDate, setSelectedDate] = useState("all");
    const [dateOptions, setDateOptions] = useState({});

    const buyMenuItemsRef = useRef();

    useEffect(() => {
        fetch(`/items/items.json`)
            .then(response => response.json())
            .then(data => {
                setData(data);
                setLoading(false);
            })
            .catch(error => {
                console.error("Error loading data: ", error);
                setLoading(false);
            });

        fetch(`/revisions.json`)
            .then(response => response.json())
            .then(data => {
                setDateOptions(data);
            })
            .catch(error => {
                console.error("Error loading data: ", error);
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

    const onShowNotedChange = (isChecked) => {
        setShowNoted(isChecked);
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
            const matchesDate = selectedDate ? applyDateFilter(item.releaseDate * 1000, selectedDate, comparison) : true;
            return matchesSearch && matchesNoted && matchesDate;
        });
    };

    const applyDateFilter = (itemDate, selectedDateFilter, comparison) => {
        if (selectedDate === "all") {
            return true
        }
        const dateTolerance = 10 * 24 * 60 * 60 * 1000; // 3 days in milliseconds

        let minDate, maxDate;

        if (Array.isArray(selectedDateFilter) && selectedDateFilter.length === 2) {
            const [startDate, endDate] = selectedDateFilter;

            minDate = new Date(startDate * 1000 - dateTolerance);
            maxDate = new Date(endDate * 1000 + dateTolerance);
            console.log(`minDate: ${minDate.toLocaleString()}`);
            console.log(`maxDate: ${maxDate.toLocaleString()}`);
            console.log(`itemDate: ${new Date(itemDate).toLocaleString()}`);
        } else {
            const date = selectedDateFilter;
            minDate = new Date(date * 1000 - dateTolerance);
            maxDate = new Date(date * 1000 + dateTolerance);
        }
        switch (comparison) {
            case '=':
                return itemDate >= minDate;
            case '>=':
                return itemDate >= minDate;
            case '<=':
                return itemDate <= maxDate;
            default:
                return true;
        }
    };

    const filteredItems = filterItems();

    const renderIcon = (rowData) => {
        const imagePath = `/items/items-icons/${rowData.id}.png`;
        return (
            <div className="image-text-container">
                <img
                    src={imagePath}
                    alt={rowData.name}
                    width={34}
                    height={34}
                    style={{margin: 4, objectFit: 'contain'}}
                />
            </div>
        );
    };

    const fetchCacheData = async (id) => {
        const url = `/items/cache-defs/${id}.json`;
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
                className={`button-global`}
                onClick={() => openDialog(rowData.id, rowData.name)}
            >
                <FaInfoCircle className={'icon'}/>
                Details
            </Button>

        );
    };

    const onSort = (event) => {
        const {sortField, sortOrder} = event;
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

        if (sortField === 'releaseDate' && selectedDate !== 'all' && selectedDate !== null) {
            return buyMenuItemsRef.current.applyDateFilter(a, b);
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
                <div className="center-div" style={{height: '10vh'}}>
                    <h5 className="natureRune" style={{
                        display: "flex",
                        flexDirection: "row",
                        justifyContent: "center"
                    }}>Total Items: <div
                        style={{color: "yellow", paddingLeft: '10px'}}> {filteredItems.length.toLocaleString()} </div>
                    </h5>
                </div>

                <DataTable
                    value={sortedItems}
                    responsiveLayout="scroll"
                    size="small"
                    showGridlines
                    stripedRows
                    header={
                        <Header
                            dateOptions={dateOptions}
                            resetFilters={resetFilters}
                            searchText={searchText}
                            onSearchChange={onSearchChange}
                            showNoted={showNoted}
                            onShowNotedChange={onShowNotedChange}
                            selectedDate={selectedDate}
                            handleDateChange={handleDateChange}
                            comparison={comparison}
                            handleComparisonChange={handleComparisonChange}
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
                        style={{width: '50px'}}
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
                        style={{width: '150px'}}
                    />
                </DataTable>
                <Dialog
                    header={`Definition: ${selectedItemName}`}
                    visible={showDialog}
                    style={{width: '50vw'}}
                    onHide={() => setShowDialog(false)}
                >
                    <TabView>
                        <TabPanel header={
                            <div style={{display: 'flex', alignItems: 'center'}}>
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
                                    <FaCopy/>
                                </Button>
                            </div>
                        }>
                            <SyntaxHighlighter language="yaml" style={atomOneDark}>
                                {cacheError || cacheContent}
                            </SyntaxHighlighter>
                        </TabPanel>
                        <TabPanel header={
                            <div style={{display: 'flex', alignItems: 'center'}}>
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
                                    <FaCopy/>
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