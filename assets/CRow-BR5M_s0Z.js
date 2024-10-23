import{r as m,_ as d,R as u,a as y,c as g,P as e,b as x}from"./index-D49GhdXc.js";var N=m.forwardRef(function(o,l){var n,f=o.children,c=o.className,s=o.color,t=o.textBgColor,r=o.textColor,a=d(o,["children","className","color","textBgColor","textColor"]);return u.createElement("div",y({className:g("card",(n={},n["bg-".concat(s)]=s,n["text-".concat(r)]=r,n["text-bg-".concat(t)]=t,n),c)},a,{ref:l}),f)});N.propTypes={children:e.node,className:e.string,color:x,textBgColor:x,textColor:e.string};N.displayName="CCard";var v=m.forwardRef(function(o,l){var n=o.children,f=o.className,c=d(o,["children","className"]);return u.createElement("div",y({className:g("card-body",f)},c,{ref:l}),n)});v.propTypes={children:e.node,className:e.string};v.displayName="CCardBody";var T=["xxl","xl","lg","md","sm","xs"],C=m.forwardRef(function(o,l){var n=o.children,f=o.className,c=d(o,["children","className"]),s=[];return T.forEach(function(t){var r=c[t];delete c[t];var a=t==="xs"?"":"-".concat(t);(typeof r=="number"||typeof r=="string")&&s.push("col".concat(a,"-").concat(r)),typeof r=="boolean"&&s.push("col".concat(a)),r&&typeof r=="object"&&((typeof r.span=="number"||typeof r.span=="string")&&s.push("col".concat(a,"-").concat(r.span)),typeof r.span=="boolean"&&s.push("col".concat(a)),(typeof r.order=="number"||typeof r.order=="string")&&s.push("order".concat(a,"-").concat(r.order)),typeof r.offset=="number"&&s.push("offset".concat(a,"-").concat(r.offset)))}),u.createElement("div",y({className:g(s.length>0?s:"col",f)},c,{ref:l}),n)}),h=e.oneOfType([e.bool,e.number,e.string,e.oneOf(["auto"])]),i=e.oneOfType([h,e.shape({span:h,offset:e.oneOfType([e.number,e.string]),order:e.oneOfType([e.oneOf(["first","last"]),e.number,e.string])})]);C.propTypes={children:e.node,className:e.string,xs:i,sm:i,md:i,lg:i,xl:i,xxl:i};C.displayName="CCol";var O=["xxl","xl","lg","md","sm","xs"],b=m.forwardRef(function(o,l){var n=o.children,f=o.className,c=d(o,["children","className"]),s=[];return O.forEach(function(t){var r=c[t];delete c[t];var a=t==="xs"?"":"-".concat(t);typeof r=="object"&&(r.cols&&s.push("row-cols".concat(a,"-").concat(r.cols)),typeof r.gutter=="number"&&s.push("g".concat(a,"-").concat(r.gutter)),typeof r.gutterX=="number"&&s.push("gx".concat(a,"-").concat(r.gutterX)),typeof r.gutterY=="number"&&s.push("gy".concat(a,"-").concat(r.gutterY)))}),u.createElement("div",{className:g("row",s,f),ref:l},n)}),p=e.shape({cols:e.oneOfType([e.oneOf(["auto"]),e.number,e.string]),gutter:e.oneOfType([e.string,e.number]),gutterX:e.oneOfType([e.string,e.number]),gutterY:e.oneOfType([e.string,e.number])});b.propTypes={children:e.node,className:e.string,xs:p,sm:p,md:p,lg:p,xl:p,xxl:p};b.displayName="CRow";export{N as C,v as a,b,C as c};
//# sourceMappingURL=CRow-BR5M_s0Z.js.map