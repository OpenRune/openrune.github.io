import{r,j as e,x as L}from"./index-BubZJH7A.js";import{i as $,j as v,k as w,l as A,m as S,F as P,n as _}from"./DefaultLayout-Cltd-sQ0.js";import{F as V}from"./FileSaver.min-Bz8tn3-L.js";import{F as q}from"./FilterTable-BVAP6-cN.js";import{C as T}from"./ColorBox-D-dq3IgE.js";import{R as D}from"./RSItemIcon-DIaro53U.js";import{R as W}from"./RsModel-CDk6ER_g.js";import{g as X,h as Y,i as Z,j as G,k as J,C as b,m as F,n as U}from"./CSmartTable-BoRP8CRl.js";import"./ColorUtils-D5LBpDHq.js";import"./CTabContent-BMGnwdaa.js";const ie=()=>{const[o,u]=r.useState(""),[n,h]=r.useState(""),[i,g]=r.useState(!1),[x,j]=r.useState([]),[d,C]=r.useState([]),[t,a]=r.useState(!0),[c,m]=r.useState(!1),[f,H]=r.useState(null),I=async()=>{a(!0);try{const p=await(await fetch(`http://127.0.0.1:8080/public/item/?${i?"nulls=false":"nulls=true"}`)).json();j(p.map(M=>({id:M.id,name:M.name,iconId:M.id})))}catch(l){console.error("Error fetching data:",l)}finally{a(!1)}};r.useEffect(()=>{I()},[i]),r.useEffect(()=>{N()},[o,n,i,x]);const N=()=>{let l=[...x];o&&(l=l.filter(s=>s.id.toString().includes(o))),n&&(l=l.filter(s=>s.name.toLowerCase().includes(n.toLowerCase()))),C(l)},R=l=>{const s=l.target.value;(s===""||/^[1-9]*$/.test(s))&&u(s)},O=async l=>{const p=await(await fetch(`http://127.0.0.1:8080/public/item/${l.id}/icon`)).blob();V.saveAs(p,`${l.name}_icon.png`)},y=async l=>{try{const p=await(await fetch(`http://127.0.0.1:8080/public/item/${l.id}`)).json();H(p),m(!0)}catch(s){console.error("Error fetching item details:",s)}},E=[{key:"icon",label:"Icon",_style:{width:"5%"},filter:!1,sorter:!1},{key:"id",label:"ID",_style:{width:"15%"},filter:!1,sorter:!1},{key:"name",label:"Name",filter:!1,sorter:!1},{key:"info",label:"Details",_style:{width:"5%"},filter:!1,sorter:!1}],B={icon:l=>e.jsx("td",{children:e.jsx(D,{id:l.id})}),info:l=>e.jsx("td",{children:e.jsx(b,{color:"primary",onClick:()=>y(l),children:"View"})})},z=e.jsxs("div",{style:{display:"flex",gap:"20px",alignItems:"center",marginBottom:"10px"},children:[e.jsxs("div",{style:{display:"flex",alignItems:"center"},children:[e.jsx(P,{style:{marginRight:"8px"}}),e.jsx(F,{type:"text",placeholder:"Search ID",value:o,onChange:R,style:{width:"150px"}})]}),e.jsxs("div",{style:{display:"flex",alignItems:"center"},children:[e.jsx(_,{style:{marginRight:"8px"}}),e.jsx(F,{type:"text",placeholder:"Search Name",value:n,onChange:l=>h(l.target.value),style:{width:"150px"}})]}),e.jsx(U,{id:"filter-nulls",label:"Exclude Nulls",checked:i,onChange:l=>g(l.target.checked)})]});return e.jsxs(e.Fragment,{children:[e.jsx(q,{pageTitle:"Items",tableData:d,fetchData:I,customFilters:z,columns:E,scopedColumns:B,loading:t,handleDownloadItemIcon:O,handleRowClick:y}),e.jsx(W,{}),f&&e.jsxs(X,{visible:c,onClose:()=>m(!1),children:[e.jsx(Y,{children:e.jsxs(Z,{children:[e.jsx(D,{id:f.id}),"Item: ",f.name]})}),e.jsx(G,{children:e.jsx(k,{item:f,closeParentModal:()=>m(!1)})}),e.jsx(J,{children:e.jsx(b,{color:"secondary",onClick:()=>m(!1),children:"Close"})})]})]})},k=({item:o,closeParentModal:u})=>{const[n,h]=r.useState(0),{openModal:i}=L(),g=(t,a)=>{const c={id:-1,name:"null",examine:"null",resizeX:128,resizeY:128,resizeZ:128,xan2d:0,category:-1,yan2d:0,zan2d:0,equipSlot:-1,appearanceOverride1:-1,appearanceOverride2:-1,weight:0,cost:1,isTradeable:!1,stacks:0,inventoryModel:0,members:!1,zoom2d:2e3,xOffset2d:0,yOffset2d:0,ambient:0,contrast:0,options:[null,null,"Take",null,null],interfaceOptions:[null,null,null,null,"Drop"],maleModel0:-1,maleModel1:-1,maleModel2:-1,maleHeadModel0:-1,maleHeadModel1:-1,femaleModel0:-1,femaleModel1:-1,femaleModel2:-1,femaleHeadModel0:-1,femaleHeadModel1:-1,noteLinkId:-1,noteTemplateId:-1,teamCape:0,dropOptionIndex:-2,unnotedId:-1,notedId:-1,placeholderLink:-1,placeholderTemplate:-1,inherit:-1,option3:"Take",ioption5:"Drop",attackSpeed:-1,equipType:0,weaponType:-1};return c.hasOwnProperty(t)&&a===c[t]},x=t=>{u(),i(t)},j=()=>Object.entries(o).map(([t,a])=>g(t,a)?null:t==="maleModel0"||t==="maleModel1"||t==="maleModel2"||t==="maleHeadModel0"||t==="maleHeadModel1"||t==="femaleModel0"||t==="femaleModel1"||t==="femaleModel2"||t==="femaleHeadModel0"||t==="femaleHeadModel1"||t==="inventoryModel"?e.jsxs("div",{style:{margin:"5px",display:"flex",alignItems:"center"},children:[e.jsxs("strong",{style:{marginRight:"10px"},children:[d(t),":"]}),e.jsx(b,{color:"primary",onClick:()=>x(a),children:a})]},t):t==="originalColours"||t==="modifiedColours"||t==="originalTextureColours"||t==="modifiedTextureColours"?e.jsx("div",{style:{margin:"5px"},children:C(t,a)},t):t==="averageRgb"?e.jsxs("div",{style:{margin:"5px"},children:[e.jsxs("strong",{children:[d(t),":"]}),e.jsx(T,{width:40,height:40,packedHsl:a,tooltip:!0})]},t):e.jsxs("div",{style:{margin:"5px"},children:[e.jsxs("strong",{children:[d(t),":"]})," ",Array.isArray(a)?a.join(", "):a.toString()]},t)),d=t=>t.replace(/([A-Z])/g," $1").replace(/^./,a=>a.toUpperCase()),C=(t,a)=>e.jsxs("div",{style:{display:"flex",alignItems:"center",marginBottom:"10px"},children:[e.jsxs("strong",{style:{marginRight:"10px"},children:[d(t),":"]}),e.jsx("div",{style:{display:"flex",gap:"10px",flexWrap:"wrap"},children:a&&a.length>0?a.map((c,m)=>e.jsx(T,{width:30,height:30,packedHsl:c,tooltip:!0},m)):e.jsx("p",{children:"No colors available."})})]});return e.jsxs(e.Fragment,{children:[e.jsxs($,{variant:"underline-border",children:[e.jsx(v,{children:e.jsx(w,{active:n===0,onClick:()=>h(0),children:"General Info"})}),e.jsx(v,{children:e.jsx(w,{active:n===1,onClick:()=>h(1),children:"Client Data"})})]}),e.jsxs(A,{style:{overflowX:"auto",overflowY:"auto",maxHeight:"640px",whiteSpace:"pre-wrap"},children:[e.jsx(S,{visible:n===0,children:j()}),e.jsx(S,{visible:n===1,children:e.jsx("pre",{style:{padding:"10px",borderRadius:"5px"},children:JSON.stringify(o,null,2)})})]})]})};export{ie as default};
//# sourceMappingURL=Items-Co2rf2nc.js.map
