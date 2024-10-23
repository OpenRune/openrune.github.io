import{r as l,j as e}from"./index-DRFVM3ZW.js";import{c as p,u as N,p as T,a as L,b as z,d as E,g as B,e as y}from"./ColorUtils-Dk721PgH.js";import{C as g,a as u,b as w,c as b}from"./CRow-CY6wNlhi.js";import{C as f}from"./CCardHeader-BRQMo8ki.js";import{d as $,f as v}from"./DefaultLayout-CDV56VL7.js";const F=l.forwardRef(({width:i=300,defaultColor:d=32191,onChange:h},m)=>{const s=N(d),[n,r]=l.useState(s.hue),[a,o]=l.useState(s.saturation),[x,C]=l.useState(s.lightness),[P,S]=l.useState(p(s.hue,s.saturation,s.lightness)),[k,H]=l.useState(d),R=c=>{const t=N(c);r(t.hue),o(t.saturation),C(t.lightness),H(c);const I=p(t.hue,t.saturation,t.lightness);S(I)};return l.useEffect(()=>{const c=p(n,a,x),t=T(n,a,x);S(c),H(t),h&&h(t)},[n,a,x,h]),l.useImperativeHandle(m,()=>({getPackedColor:()=>k,handleHSLInputChange:c=>{R(c)}})),e.jsx(g,{style:{maxWidth:i},children:e.jsx(u,{children:e.jsxs("div",{className:"flex flex-col items-center gap-4",children:[e.jsx("div",{style:{backgroundColor:P,height:"100px",width:"100%",borderRadius:"8px",display:"flex",justifyContent:"center",alignItems:"center"},children:e.jsx("p",{style:{color:x>35?"#282c34":"#ffffff",fontSize:"1.2rem",fontWeight:"bold"},children:k})}),e.jsxs("div",{className:"w-full",children:[e.jsx("label",{className:"block text-sm font-medium mt-4 mb-1",children:"Hue"}),e.jsx(j,{width:i-40,max:63,value:n,onChange:r,gradientStops:Array.from({length:64},(c,t)=>`hsl(${t*(360/63)}, 100%, 50%)`)}),e.jsx("label",{className:"block text-sm font-medium mt-4 mb-1",children:"Saturation"}),e.jsx(j,{width:i-40,max:7,value:a,onChange:o,gradientStops:Array.from({length:8},(c,t)=>`hsl(${n*(360/63)}, ${t*(100/7)}%, 50%)`)}),e.jsx("label",{className:"block text-sm font-medium mt-4 mb-1",children:"Lightness"}),e.jsx(j,{width:i-40,max:127,value:x,onChange:C,gradientStops:Array.from({length:128},(c,t)=>`hsl(${n*(360/63)}, 50%, ${t*(100/127)}%)`)})]})]})})})}),j=({width:i,max:d,value:h,onChange:m,gradientStops:s})=>{const n={backgroundImage:`linear-gradient(to right, ${s.join(", ")})`};return e.jsx("input",{type:"range",min:"0",max:d,value:h,onChange:r=>m(Number(r.target.value)),style:{width:`${i}px`,...n},className:"range-slider"})},J=document.createElement("style");J.innerHTML=`
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
`;document.head.appendChild(J);const D=()=>{const[i,d]=l.useState(0),[h,m]=l.useState("#ffffff"),s=l.useRef(null),n=(r,a="hsl")=>{if(a==="hsl"){d(r);const o=L(r);m(o)}else if(a==="hex"){m(r);const o=y(r);d(o)}s.current&&s.current.handleHSLInputChange(a==="hsl"?r:y(r))};return l.useEffect(()=>{if(s.current){const r=s.current.getPackedColor()||0;n(r,"hsl")}},[s]),e.jsxs(w,{className:"colors-container",children:[e.jsxs(b,{md:3,children:[e.jsxs(g,{className:"vertical-card mb-4",children:[e.jsx(f,{children:"Color Settings"}),e.jsxs(u,{children:[e.jsx($,{htmlFor:"jagexHSL",children:"Jagex HSL"}),e.jsx(v,{type:"number",id:"jagexHSL",value:i,onChange:r=>n(r.target.value,"hsl"),placeholder:"Enter Jagex HSL (0-65535)",min:0,max:65535,className:"mb-3"}),e.jsx($,{htmlFor:"rgbPicker",children:"RGB Color Picker"}),e.jsx(v,{type:"color",id:"rgbPicker",value:h,onChange:r=>n(r.target.value,"hex")}),e.jsx("div",{className:"mt-3",children:s.current&&e.jsxs(e.Fragment,{children:[e.jsxs("p",{className:"mb-2",children:[e.jsx("strong",{children:"Normal Hex:"})," ",L(s.current.getPackedColor()||0)]}),e.jsxs("p",{className:"mb-2",children:[e.jsx("strong",{children:"Normal RGB:"}),s.current&&(()=>{const{r,g:a,b:o}=z(s.current.getPackedColor()||0);return` rgb(${r}, ${a}, ${o})`})()]}),e.jsxs("p",{className:"mb-2",children:[e.jsx("strong",{children:"Normal HSL:"}),s.current&&(()=>{const{h:r,s:a,l:o}=E(s.current.getPackedColor()||0);return` hsl(${r}, ${a}%, ${o}%)`})()]}),e.jsxs("p",{className:"mb-2",children:[e.jsx("strong",{children:"Jagex HSL:"})," ",s.current.getPackedColor()||0]}),e.jsxs("p",{className:"mb-2",children:[e.jsx("strong",{children:"Jagex HSL (h,s,l):"}),s.current&&(()=>{const{h:r,s:a,l:o}=B(s.current.getPackedColor()||0);return` hsl(${r}, ${a}%, ${o}%)`})()]})]})})]})]}),e.jsxs(g,{className:"vertical-card mb-4",children:[e.jsxs(f,{className:"bg-primary text-white d-flex align-items-center justify-content-between",children:[e.jsx("h6",{className:"mb-0 fw-normal",children:"Color Details"}),e.jsx("span",{className:"badge bg-light text-primary",children:"Info"})]}),e.jsxs(u,{children:[e.jsx("p",{className:"text-muted mb-3",children:"Jagex uses a 16-bit HSL color format within their engine, limiting them to 65,535 distinct colors."}),e.jsx("p",{className:"text-muted mb-3",children:"RGB color pickers allow for 16.7 million colors. The color you select may not exist within the 16-bit palette and will need to be approximated, which can lead to slightly different results."}),e.jsx("p",{className:"text-muted mb-0",children:"This tool generates a color palette using Jagex's 16-bit HSL format: 6 bits for hue, 3 bits for saturation, and 7 bits for lightness, all combined and represented as a short."})]})]})]}),e.jsx(b,{md:9,children:e.jsx(w,{children:e.jsx(b,{children:e.jsxs(g,{className:"color-picker-card",children:[e.jsx(f,{children:"Color Picker"}),e.jsx(u,{className:"d-flex justify-content-center align-items-center",children:e.jsx(F,{ref:s,width:500,onChange:r=>{n(r)}})})]})})})})]})};export{D as default};
//# sourceMappingURL=Colors-DTRGywZ-.js.map
