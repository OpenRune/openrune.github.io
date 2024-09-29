import{r as o,j as e}from"./index-BubZJH7A.js";import{c as p,u as N,p as T,a as L,b as z,d as E,e as y}from"./ColorUtils-D5LBpDHq.js";import{C as g,a as u,b as w,c as b}from"./CRow-CUb-zIyN.js";import{C as f}from"./CCardHeader-B-jlsSY5.js";import{d as v,f as J}from"./DefaultLayout-Cltd-sQ0.js";const B=o.forwardRef(({width:i=300,defaultColor:d=32191,onChange:h},m)=>{const t=N(d),[a,r]=o.useState(t.hue),[n,l]=o.useState(t.saturation),[x,C]=o.useState(t.lightness),[P,S]=o.useState(p(t.hue,t.saturation,t.lightness)),[k,H]=o.useState(d),R=c=>{const s=N(c);r(s.hue),l(s.saturation),C(s.lightness),H(c);const I=p(s.hue,s.saturation,s.lightness);S(I)};return o.useEffect(()=>{const c=p(a,n,x),s=T(a,n,x);S(c),H(s),h&&h(s)},[a,n,x,h]),o.useImperativeHandle(m,()=>({getPackedColor:()=>k,handleHSLInputChange:c=>{R(c)}})),e.jsx(g,{style:{maxWidth:i},children:e.jsx(u,{children:e.jsxs("div",{className:"flex flex-col items-center gap-4",children:[e.jsx("div",{style:{backgroundColor:P,height:"100px",width:"100%",borderRadius:"8px",display:"flex",justifyContent:"center",alignItems:"center"},children:e.jsx("p",{style:{color:x>35?"#282c34":"#ffffff",fontSize:"1.2rem",fontWeight:"bold"},children:k})}),e.jsxs("div",{className:"w-full",children:[e.jsx("label",{className:"block text-sm font-medium mt-4 mb-1",children:"Hue"}),e.jsx(j,{width:i-40,max:63,value:a,onChange:r,gradientStops:Array.from({length:64},(c,s)=>`hsl(${s*(360/63)}, 100%, 50%)`)}),e.jsx("label",{className:"block text-sm font-medium mt-4 mb-1",children:"Saturation"}),e.jsx(j,{width:i-40,max:7,value:n,onChange:l,gradientStops:Array.from({length:8},(c,s)=>`hsl(${a*(360/63)}, ${s*(100/7)}%, 50%)`)}),e.jsx("label",{className:"block text-sm font-medium mt-4 mb-1",children:"Lightness"}),e.jsx(j,{width:i-40,max:127,value:x,onChange:C,gradientStops:Array.from({length:128},(c,s)=>`hsl(${a*(360/63)}, 50%, ${s*(100/127)}%)`)})]})]})})})}),j=({width:i,max:d,value:h,onChange:m,gradientStops:t})=>{const a={backgroundImage:`linear-gradient(to right, ${t.join(", ")})`};return e.jsx("input",{type:"range",min:"0",max:d,value:h,onChange:r=>m(Number(r.target.value)),style:{width:`${i}px`,...a},className:"range-slider"})},$=document.createElement("style");$.innerHTML=`
  .range-slider {
    -webkit-appearance: none;
    appearance: none;
    width: 100%;
    height: 18px;
    background-size: 100% 100%;
    background-repeat: no-repeat;
    border-radius: 8px;
  }

  .range-slider::-webkit-slider-runnable-track {
    background-size: 100%;
    height: 100%;
    border-radius: 8px;
    border: none;
  }

  .range-slider::-moz-range-track {
    background-size: 100%;
    height: 100%;
    border-radius: 8px;
    border: none;
  }

  .range-slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background-color: white;
    border: 2px solid #ccc;
  }

  .range-slider::-moz-range-thumb {
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background-color: white;
    border: 2px solid #ccc;
  }
`;document.head.appendChild($);const W=()=>{const[i,d]=o.useState(0),[h,m]=o.useState("#ffffff"),t=o.useRef(null),a=(r,n="hsl")=>{if(n==="hsl"){d(r);const l=L(r);m(l)}else if(n==="hex"){m(r);const l=y(r);d(l)}t.current&&t.current.handleHSLInputChange(n==="hsl"?r:y(r))};return o.useEffect(()=>{if(t.current){const r=t.current.getPackedColor()||0;a(r,"hsl")}},[t]),e.jsxs(w,{className:"colors-container",children:[e.jsxs(b,{md:3,children:[e.jsxs(g,{className:"vertical-card mb-4",children:[e.jsx(f,{children:"Color Settings"}),e.jsxs(u,{children:[e.jsx(v,{htmlFor:"jagexHSL",children:"Jagex HSL"}),e.jsx(J,{type:"number",id:"jagexHSL",value:i,onChange:r=>a(r.target.value,"hsl"),placeholder:"Enter Jagex HSL (0-65535)",min:0,max:65535,className:"mb-3"}),e.jsx(v,{htmlFor:"rgbPicker",children:"RGB Color Picker"}),e.jsx(J,{type:"color",id:"rgbPicker",value:h,onChange:r=>a(r.target.value,"hex")}),e.jsx("div",{className:"mt-3",children:t.current&&e.jsxs(e.Fragment,{children:[e.jsxs("p",{className:"mb-2",children:[e.jsx("strong",{children:"Normal Hex:"})," ",L(t.current.getPackedColor()||0)]}),e.jsxs("p",{className:"mb-2",children:[e.jsx("strong",{children:"Normal RGB:"}),t.current&&(()=>{const{r,g:n,b:l}=z(t.current.getPackedColor()||0);return` rgb(${r}, ${n}, ${l})`})()]}),e.jsxs("p",{className:"mb-2",children:[e.jsx("strong",{children:"Normal HSL:"}),t.current&&(()=>{const{h:r,s:n,l}=E(t.current.getPackedColor()||0);return` hsl(${r}, ${n}%, ${l}%)`})()]}),e.jsxs("p",{className:"mb-2",children:[e.jsx("strong",{children:"Jagex HSL:"})," ",t.current.getPackedColor()||0]})]})})]})]}),e.jsxs(g,{className:"vertical-card mb-4",children:[e.jsxs(f,{className:"bg-primary text-white d-flex align-items-center justify-content-between",children:[e.jsx("h6",{className:"mb-0 fw-normal",children:"Color Details"}),e.jsx("span",{className:"badge bg-light text-primary",children:"Info"})]}),e.jsxs(u,{children:[e.jsx("p",{className:"text-muted mb-3",children:"Jagex uses a 16-bit HSL color format within their engine, limiting them to 65,535 distinct colors."}),e.jsx("p",{className:"text-muted mb-3",children:"RGB color pickers allow for 16.7 million colors. The color you select may not exist within the 16-bit palette and will need to be approximated, which can lead to slightly different results."}),e.jsx("p",{className:"text-muted mb-0",children:"This tool generates a color palette using Jagex's 16-bit HSL format: 6 bits for hue, 3 bits for saturation, and 7 bits for lightness, all combined and represented as a short."})]})]})]}),e.jsx(b,{md:9,children:e.jsx(w,{children:e.jsx(b,{children:e.jsxs(g,{className:"color-picker-card",children:[e.jsx(f,{children:"Color Picker"}),e.jsx(u,{className:"d-flex justify-content-center align-items-center",children:e.jsx(B,{ref:t,width:500,onChange:r=>{a(r)}})})]})})})})]})};export{W as default};
//# sourceMappingURL=Colors-CqRjZ9dX.js.map
