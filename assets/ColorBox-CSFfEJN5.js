import{j as t}from"./index-CuZpSdon.js";import{c as m,u as f}from"./ColorUtils-Dk721PgH.js";import{h as d}from"./DefaultLayout-DXFJkhDj.js";const j=({width:a=100,height:x=100,packedHsl:e=0,tooltip:p=!1,showHex:n=!1})=>{const{hue:s,saturation:r,lightness:i}=f(e),o=m(s,r,i),l={width:`${a}px`,height:`${x}px`,backgroundColor:o,border:"1px solid #000",display:"flex",alignItems:"center",justifyContent:"center",position:"relative",fontSize:"12px",color:"#fff",textShadow:"1px 1px 2px rgba(0,0,0,0.5)",fontFamily:"monospace"},c=`
    HSL: (${s}, ${r}%, ${i}%)
    HEX: ${o}
    Jagex HSL: ${e}
  `.trim();return t.jsx(t.Fragment,{children:p?t.jsx(d,{content:c,placement:"top",children:t.jsxs("div",{style:l,children:[n&&o," "]})}):t.jsxs("div",{style:l,children:[n&&o," "]})})};export{j as C};
//# sourceMappingURL=ColorBox-CSFfEJN5.js.map
