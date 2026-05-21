import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import DOMPurify from "dompurify";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { 
  faGithub, faLinkedin, faTelegram, faInstagram, faFacebook, faTwitter, 
  faYoutube, faDiscord, faBehance, faDribbble, faFigma, faStackOverflow, 
  faTiktok, faTwitch, faMedium, faGitlab, faPinterest, faReddit 
} from "@fortawesome/free-brands-svg-icons";
import { 
  faEnvelope, faPhone, faMapMarkerAlt, faGlobe, faPaintBrush, 
  faGamepad, faMusic, faBriefcase, faCode, faCamera, faVideo, faLaptopCode 
} from "@fortawesome/free-solid-svg-icons";

// ─── Constants ────────────────────────────────────────────────────────────────
const A4_W = 794;
const A4_H = 1123;
const PAGE_GAP = 40;
const GRID = 20;
const SNAP_TOL = 8;
const MIN_SIZE = 20;
const HISTORY_LIMIT = 40;
const LOCAL_STORAGE_KEY = "resume_builder_data";

const FONTS = ["DM Sans","Georgia","Times New Roman","Garamond","Helvetica Neue","Trebuchet MS","Courier New","Palatino","Roboto","Open Sans","Lato","Montserrat","Raleway","Playfair Display","Source Sans Pro"];
const FONT_SIZES = [8,9,10,11,12,13,14,16,18,20,22,24,28,32,36,42,48,56,64,72];
const LINE_HEIGHTS = ["1","1.15","1.25","1.4","1.5","1.6","1.75","1.85","2","2.5"];

const SHAPE_TYPES = [
  { id:"rect",     label:"Rectangle",    icon:"▬" },
  { id:"rRect",    label:"Rounded Rect", icon:"▢" },
  { id:"circle",   label:"Circle",       icon:"●" },
  { id:"triangle", label:"Triangle",     icon:"▲" },
  { id:"line",     label:"Line",         icon:"─" },
  { id:"diamond",  label:"Diamond",      icon:"◆" },
  { id:"hexagon",  label:"Hexagon",      icon:"⬡" },
  { id:"star",     label:"Star",         icon:"★" },
];

// ─── Layer system ─────────────────────────────────────────────────────────────
const LAYER_BG  = 0;
const LAYER_MID = 1;
const LAYER_TOP = 2;

const typeLayer = t => t === "shape" ? LAYER_BG : t === "divider" ? LAYER_MID : LAYER_TOP;
const isContent = t => t === "text" || t === "photo";

let _uid = Date.now();
const uid  = () => `b${_uid++}`;

// Global snap toggle logic
let _snapToGrid = true;
const SN = v => _snapToGrid ? Math.round(v / GRID) * GRID : Math.round(v);
const CL = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

const getEvtCoords = (e) => {
  if (e.touches && e.touches.length > 0) return { clientX: e.touches[0].clientX, clientY: e.touches[0].clientY };
  if (e.changedTouches && e.changedTouches.length > 0) return { clientX: e.changedTouches[0].clientX, clientY: e.changedTouches[0].clientY };
  return { clientX: e.clientX, clientY: e.clientY };
};

const compressImage = (dataUrl, callback) => {
  const img = new Image();
  img.onload = () => {
    const canvas = document.createElement('canvas');
    const MAX_SIZE = 500;
    let width = img.width;
    let height = img.height;
    if (width > height && width > MAX_SIZE) { height *= MAX_SIZE / width; width = MAX_SIZE; }
    else if (height > MAX_SIZE) { width *= MAX_SIZE / height; height = MAX_SIZE; }
    canvas.width = width; canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, width, height);
    callback(canvas.toDataURL('image/jpeg', 0.8));
  };
  img.src = dataUrl;
};

// ─── Icons ────────────────────────────────────────────────────────────────────
const Ico = ({ d, size=15 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);

const icBold = "M6 4h8a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z M6 12h9a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z";
const icItalic = "M19 4h-9 M14 20H5 M15 4L9 20";
const icUnderline = "M6 3v7a6 6 0 0 0 6 6 6 6 0 0 0 6-6V3 M4 21h16";
const icStrike = "M16 4H9a3 3 0 0 0-2.83 4 M14 12a4 4 0 0 1 0 8H6 M4 12h16";
const icLeft = "M17 10H3 M21 6H3 M21 14H3 M17 18H3";
const icCenter = "M18 10H6 M21 6H3 M21 14H3 M18 18H6";
const icRight = "M21 10H7 M21 6H3 M21 14H3 M21 18H7";
const icMenu = "M4 12h16 M4 6h16 M4 18h16";
const icList = "M8 6h13 M8 12h13 M8 18h13 M3 6h.01 M3 12h.01 M3 18h.01";
const icOList = "M10 6h11 M10 12h11 M10 18h11 M4 6h1v4 M4 10H3 M6 18H3l3-4c-.5-.83-1.5-1-2-1";
const icClear = "M18 6L6 18 M6 6l12 12";
const icTrash = "M3 6h18 M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2-2v2";
const icDuplicate = "M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2 M15 2H9c-.6 0-1 .4-1 1v2c0 .6.4 1 1 1h6c.6 0 1-.4 1-1V3c0-.6-.4-1-1-1z";
const icLock = "M19 11H5a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2z M7 11V7a5 5 0 0 1 10 0v4";
const icUnlock = "M7 11V7a5 5 0 0 1 9.9-1 M4 11h16a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2z";
const icLink = "M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71 M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71";
const icCode = "M16 18l6-6-6-6 M8 6l-6 6 6 6";
const icLineH = "M8 6h13 M8 12h13 M8 18h13";

// ─── Collision ────────────────────────────────────────────────────────────────
function overlaps(a, b) {
  if (a.id === b.id || a.page !== b.page) return false;
  return a.x < b.x+b.w-2 && a.x+a.w > b.x+2 && a.y < b.y+b.h-2 && a.y+a.h > b.y+2;
}

function resolveCollisions(all, changedId) {
  return all.map(b => {
    let {x,y,w,h,page,type}=b;
    if (type !== "shape") {
      x = CL(x,0,A4_W-w); 
      if(y<0)y=0;
      if(y+h>A4_H+30){page+=1;y=GRID;}
    }
    return {...b,x,y,page};
  });
}

// ─── Defaults ─────────────────────────────────────────────────────────────────
function makeDefaults() {
  return [
    {id:uid(),page:0,x:40, y:40, w:714,h:88, z:LAYER_TOP,type:"text",   html:"<div style='line-height:1.15'><span style='font-size:38px;font-family:Georgia,serif;font-weight:700;color:#1a1a2e'>Roman Pinchuk</span></div>"},
    {id:uid(),page:0,x:40, y:136,w:714,h:28, z:LAYER_TOP,type:"text",   html:"<div><span style='font-size:12px;font-family:\"DM Sans\",sans-serif;color:#64748b;letter-spacing:.04em'>Software Engineer & Materials Science Student · Ukraine</span></div>"},
    {id:uid(),page:0,x:40, y:176,w:714,h:2,  z:LAYER_MID,type:"divider",color:"#3b82f6"},
    {id:uid(),page:0,x:40, y:196,w:340,h:260,z:LAYER_TOP,type:"text",   html:"<div style='line-height:1.5'><div style='font-size:9px;font-family:\"DM Sans\",sans-serif;font-weight:700;text-transform:uppercase;letter-spacing:.16em;color:#3b82f6;margin-bottom:8px'>Experience & Projects</div><div style='font-size:13px;font-weight:700;font-family:Georgia,serif;color:#1e293b'>Resume Constructor Web App</div><div style='font-size:11px;font-family:\"DM Sans\",sans-serif;color:#3b82f6;margin-bottom:6px'>React / LocalStorage · 2026</div><div style='font-size:11.5px;font-family:\"DM Sans\",sans-serif;color:#475569;margin-bottom:12px'>Designed and developed a fully functional resume builder featuring draggable interface components, custom blocks, and real-time editing.</div><div style='font-size:13px;font-weight:700;font-family:Georgia,serif;color:#1e293b'>SaaS Analytics Telegram Bot</div><div style='font-size:11px;font-family:\"DM Sans\",sans-serif;color:#3b82f6;margin-bottom:6px'>Python / aiogram · Early 2026</div><div style='font-size:11.5px;font-family:\"DM Sans\",sans-serif;color:#475569'>Developed a bot for tracking Telegram channel follower growth and engagement rates.</div></div>"},
    {id:uid(),page:0,x:400,y:196,w:354,h:100,z:LAYER_TOP,type:"text",   html:"<div style='line-height:1.8'><div style='font-size:9px;font-family:\"DM Sans\",sans-serif;font-weight:700;text-transform:uppercase;letter-spacing:.16em;color:#3b82f6;margin-bottom:8px'>Skills</div><div style='font-size:11.5px;font-family:\"DM Sans\",sans-serif;color:#475569'><b>Software:</b> Python, C# .NET WinForms, React, Unity 3D<br><b>Engineering:</b> SolidWorks, Powder Metallurgy, Vickers Hardness Testing (VK3, VK6)<br></div></div>"},
    {id:uid(),page:0,x:40, y:480,w:340,h:40,z:LAYER_TOP,type:"social", align:"flex-start", color:"#1e293b", items:[{icon:"github",text:"GitHub",url:"https://github.com/CANDLE01"}]},
  ];
}

function getInitialBlocks() {
  try {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (saved) return JSON.parse(saved);
  } catch (e) { console.error("Error loading from LocalStorage:", e); }
  return makeDefaults();
}

// ─── SVG shapes ───────────────────────────────────────────────────────────────
function ShapeSVG({ block }) {
  const {w, h, shapeType, fillColor="transparent", strokeColor="#3b82f6", strokeWidth=2, opacity=1, cornerRadius=12} = block;
  const H = block.type==="divider" ? Math.max(2,h) : h;
  const c = {fill:fillColor, stroke:strokeColor, strokeWidth, opacity};
  let inner;
  switch(shapeType){
    case "circle":   inner = <ellipse cx={w/2} cy={H/2} rx={w/2-strokeWidth/2} ry={H/2-strokeWidth/2} {...c}/>;break;
    case "triangle": inner = <polygon points={`${w/2},${strokeWidth/2} ${w-strokeWidth/2},${H-strokeWidth/2} ${strokeWidth/2},${H-strokeWidth/2}`} {...c}/>;break;
    case "line":     inner = <line x1={strokeWidth/2} y1={H/2} x2={w-strokeWidth/2} y2={H/2} stroke={strokeColor} strokeWidth={strokeWidth} opacity={opacity}/>;break;
    case "rRect":    inner = <rect x={strokeWidth/2} y={strokeWidth/2} width={w-strokeWidth} height={H-strokeWidth} rx={cornerRadius} ry={cornerRadius} {...c}/>;break;
    case "diamond": {
      const pts = `${w/2},${strokeWidth/2} ${w-strokeWidth/2},${H/2} ${w/2},${H-strokeWidth/2} ${strokeWidth/2},${H/2}`;
      inner = <polygon points={pts} {...c}/>;break;
    }
    case "hexagon": {
      const cx2=w/2,cy2=H/2,rx2=w/2-strokeWidth/2,ry2=H/2-strokeWidth/2;
      const pts2 = [0,1,2,3,4,5].map(i=>{
        const a=Math.PI/180*(60*i-30);
        return `${cx2+rx2*Math.cos(a)},${cy2+ry2*Math.sin(a)}`;
      }).join(' ');
      inner = <polygon points={pts2} {...c}/>;break;
    }
    case "star": {
      const pts3 = [];
      for(let i=0;i<10;i++){
        const a=Math.PI/180*(36*i-90);
        const r2=(i%2===0)?Math.min(w,H)/2-strokeWidth:Math.min(w,H)/4;
        pts3.push(`${w/2+r2*Math.cos(a)},${H/2+r2*Math.sin(a)}`);
      }
      inner = <polygon points={pts3.join(' ')} {...c}/>;break;
    }
    default:         inner = <rect x={strokeWidth/2} y={strokeWidth/2} width={w-strokeWidth} height={H-strokeWidth} {...c}/>;
  }
  return <svg width={w} height={H} style={{position:"absolute",inset:0,pointerEvents:"none",overflow:"visible"}} viewBox={`0 0 ${w} ${H}`}>{inner}</svg>;
}

// ─── Visual Data Editor overlay ────────────────────────────────────────────────
function VisualDataEditor({ block, onSave, onCancel }) {
  const isTags = block.type === "tags";
  const isQR = block.type === "qr";
  const isBadge = block.type === "linkbadge";
  const listKey = block.type === "skillbar" ? "skills" : block.type === "rating" ? "ratings" : "items";

  const [textVal, setTextVal] = useState(isTags ? (block.tags||[]).join(", ") : isQR ? (block.url||"") : isBadge ? (block.label||"") : "");
  const [textVal2, setTextVal2] = useState(isBadge ? (block.url||"") : "");
  const [list, setList] = useState(() => Array.isArray(block[listKey]) ? [...block[listKey]] : []);

  const handleSave = () => {
    if (isTags) onSave({ tags: textVal.split(",").map(s=>s.trim()).filter(Boolean) });
    else if (isQR) onSave({ url: textVal });
    else if (isBadge) onSave({ label: textVal, url: textVal2 });
    else onSave({ [listKey]: list });
  };

  const updateList = (i, field, val) => {
    const arr = [...list];
    arr[i] = { ...arr[i], [field]: val };
    setList(arr);
  };
  const addRow = () => setList([...list, {}]);
  const removeRow = (i) => setList(list.filter((_, idx) => idx !== i));

  const inputStyle = { width: '100%', padding: '6px', fontSize: 12, border: '1px solid #cbd5e1', borderRadius: 4, boxSizing: 'border-box', fontFamily: '"DM Sans", sans-serif' };

  return (
    <>
      <div style={{position:'fixed',inset:0,zIndex:2000}} onMouseDown={e=>{e.stopPropagation();handleSave();}} onTouchStart={e=>{e.stopPropagation();handleSave();}}/>
      <div style={{position:'absolute', top:'calc(100% + 12px)', left:0, background:'white', padding:16, borderRadius:8, boxShadow:'0 10px 25px rgba(0,0,0,0.2)', zIndex:2001, border:'1px solid #e2e8f0', minWidth: 280, cursor:'default'}}
           onMouseDown={e=>e.stopPropagation()} onTouchStart={e=>e.stopPropagation()}>
         <div style={{fontSize:14, fontWeight:700, marginBottom:12, color:'#1e293b'}}>Edit {block.type} Data</div>

         <datalist id="icon-choices">
            <option value="github">GitHub</option>
            <option value="linkedin">LinkedIn</option>
            <option value="telegram">Telegram</option>
            <option value="instagram">Instagram</option>
            <option value="facebook">Facebook</option>
            <option value="twitter">Twitter / X</option>
            <option value="youtube">YouTube</option>
            <option value="discord">Discord</option>
            <option value="behance">Behance</option>
            <option value="dribbble">Dribbble</option>
            <option value="figma">Figma</option>
            <option value="stackoverflow">StackOverflow</option>
            <option value="tiktok">TikTok</option>
            <option value="email">Email</option>
            <option value="phone">Phone</option>
            <option value="location">Location</option>
            <option value="web">Website</option>
            <option value="art">Art</option>
            <option value="game">Game</option>
            <option value="code">Code</option>
         </datalist>

         {isTags && <textarea value={textVal} onChange={e=>setTextVal(e.target.value)} placeholder="React, Node.js, CSS..." style={{...inputStyle, height:80, resize:'none'}}/>}
         {isQR && <input type="text" value={textVal} onChange={e=>setTextVal(e.target.value)} placeholder="https://..." style={inputStyle}/>}
         {isBadge && <>
           <input type="text" value={textVal} onChange={e=>setTextVal(e.target.value)} placeholder="Label (e.g. Portfolio)" style={{...inputStyle, marginBottom: 8}}/>
           <input type="text" value={textVal2} onChange={e=>setTextVal2(e.target.value)} placeholder="https://..." style={inputStyle}/>
         </>}

         {!isTags && !isQR && !isBadge && (
           <div style={{display:'flex', flexDirection:'column', gap:8, maxHeight:240, overflowY:'auto', paddingRight:4}}>
             {list.map((item, i) => (
               <div key={i} style={{display:'flex', gap:6, alignItems:'center', background:'#f8fafc', padding:6, borderRadius:6, border:'1px solid #f1f5f9'}}>
                 {block.type === "skillbar" && <>
                   <input value={item.name||""} onChange={e=>updateList(i,'name',e.target.value)} placeholder="Skill name" style={{...inputStyle, flex:1}}/>
                   <input type="number" value={item.pct||0} onChange={e=>updateList(i,'pct',+e.target.value)} style={{...inputStyle, width:60}}/>
                 </>}
                 {block.type === "rating" && <>
                   <input value={item.name||""} onChange={e=>updateList(i,'name',e.target.value)} placeholder="Skill name" style={{...inputStyle, flex:1}}/>
                   <input type="number" min={1} max={5} value={item.rating||0} onChange={e=>updateList(i,'rating',+e.target.value)} style={{...inputStyle, width:50}}/>
                 </>}
                 {block.type === "timeline" && <>
                   <input value={item.date||""} onChange={e=>updateList(i,'date',e.target.value)} placeholder="Date" style={{...inputStyle, width:80}}/>
                   <div style={{display:'flex', flexDirection:'column', gap:4, flex:1}}>
                     <input value={item.title||""} onChange={e=>updateList(i,'title',e.target.value)} placeholder="Title" style={inputStyle}/>
                     <input value={item.sub||""} onChange={e=>updateList(i,'sub',e.target.value)} placeholder="Subtitle" style={inputStyle}/>
                   </div>
                 </>}
                 {block.type === "iconrow" && <>
                   <input list="icon-choices" value={item.icon||""} onChange={e=>updateList(i,'icon',e.target.value)} placeholder="Icon" style={{...inputStyle, width:80}}/>
                   <input value={item.text||""} onChange={e=>updateList(i,'text',e.target.value)} placeholder="Text" style={{...inputStyle, flex:1}}/>
                 </>}
                 {block.type === "progress" && <>
                   <input value={item.label||""} onChange={e=>updateList(i,'label',e.target.value)} placeholder="Label" style={{...inputStyle, flex:1}}/>
                   <input type="number" value={item.pct||0} onChange={e=>updateList(i,'pct',+e.target.value)} style={{...inputStyle, width:60}}/>
                 </>}
                 {block.type === "social" && <>
                   <input list="icon-choices" value={item.icon||""} onChange={e=>updateList(i,'icon',e.target.value)} placeholder="Icon" style={{...inputStyle, width:80}}/>
                   <div style={{display:'flex', flexDirection:'column', gap:4, flex:1}}>
                     <input value={item.text||""} onChange={e=>updateList(i,'text',e.target.value)} placeholder="Platform" style={inputStyle}/>
                     <input value={item.url||""} onChange={e=>updateList(i,'url',e.target.value)} placeholder="URL" style={inputStyle}/>
                   </div>
                 </>}
                 {block.type === "languages" && <>
                   <input value={item.lang||""} onChange={e=>updateList(i,'lang',e.target.value)} placeholder="Language" style={{...inputStyle, flex:1}}/>
                   <input value={item.level||""} onChange={e=>updateList(i,'level',e.target.value)} placeholder="Level" style={{...inputStyle, width:80}}/>
                 </>}
                 {block.type === "hobbies" && <>
                   <input list="icon-choices" value={item.icon||""} onChange={e=>updateList(i,'icon',e.target.value)} placeholder="Icon" style={{...inputStyle, width:80}}/>
                   <input value={item.label||""} onChange={e=>updateList(i,'label',e.target.value)} placeholder="Interest" style={{...inputStyle, flex:1}}/>
                 </>}
                 {block.type === "references" && <>
                   <div style={{display:'flex', flexDirection:'column', gap:4, flex:1}}>
                     <input value={item.name||""} onChange={e=>updateList(i,'name',e.target.value)} placeholder="Name" style={{...inputStyle, fontWeight:700}}/>
                     <input value={item.role||""} onChange={e=>updateList(i,'role',e.target.value)} placeholder="Role" style={inputStyle}/>
                     <input value={item.contact||""} onChange={e=>updateList(i,'contact',e.target.value)} placeholder="Contact" style={inputStyle}/>
                   </div>
                 </>}
                 <button onClick={()=>removeRow(i)} style={{background:'transparent', border:'none', color:'#ef4444', cursor:'pointer', fontSize:16, padding:4}}>×</button>
               </div>
             ))}
             <button onClick={addRow} style={{padding:'6px', fontSize:12, background:'#f1f5f9', border:'1px dashed #cbd5e1', borderRadius:6, cursor:'pointer', color:'#475569', fontWeight:600}}>+ Add Item</button>
           </div>
         )}

         <div style={{display:'flex', justifyContent:'flex-end', gap:8, marginTop:16}}>
           <button onClick={onCancel} style={{padding:'6px 12px', fontSize:12, border:'1px solid #cbd5e1', background:'white', borderRadius:4, cursor:'pointer', fontWeight:600, color:'#475569'}}>Cancel</button>
           <button onClick={handleSave} style={{padding:'6px 16px', fontSize:12, border:'none', background:'#22c55e', color:'white', borderRadius:4, cursor:'pointer', fontWeight:700}}>Save</button>
         </div>
      </div>
    </>
  );
}

// ─── TextEditor modal overlay ─────────────────────────────────────────────────
function TextEditor({ block, onSave, onCancel }) {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.innerHTML = block.html;
    el.focus();
    const range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(false);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  }, []);

  const handleSaveLocal = () => { if (ref.current) onSave(ref.current.innerHTML); };
  const handleKey = e => {
    e.stopPropagation();
    if (e.key === 'Escape') { e.preventDefault(); onCancel(); }
    if (e.code === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); handleSaveLocal(); }
  };

  return (
    <>
      <div style={{ position:'fixed', inset:0, zIndex:2000 }}
        onMouseDown={e => { e.stopPropagation(); handleSaveLocal(); }}
        onTouchStart={e => { e.stopPropagation(); handleSaveLocal(); }}
      />
      <div style={{
        position:'absolute', left:0, top:0, width:'100%', height:'100%',
        zIndex:2001, boxSizing:'border-box', outline:'2px solid #22c55e', borderRadius:3,
      }}
        onMouseDown={e => e.stopPropagation()}
        onTouchStart={e => e.stopPropagation()}
      >
        <div style={{
          position:'absolute', top:'calc(100% + 12px)', left:0,
          background:'#1e293b', borderRadius:'6px',
          display:'flex', alignItems:'center', gap:8, padding:'6px 12px',
          boxShadow:'0 8px 24px rgba(0,0,0,0.25)', zIndex:2002, whiteSpace:'nowrap'
        }}>
          <span style={{fontSize:11,color:'#94a3b8',fontWeight:500,marginRight:8}}>✏️ Ctrl+Enter to save, Esc to cancel</span>
          <button onMouseDown={e => { e.preventDefault(); e.stopPropagation(); onCancel(); }}
            onTouchStart={e => { e.preventDefault(); e.stopPropagation(); onCancel(); }}
            style={{ padding:'4px 12px', borderRadius:4, border:'1px solid #475569', background:'transparent', color:'#e2e8f0', fontSize:11, fontWeight:600, cursor:'pointer' }}>
            Cancel
          </button>
          <button onMouseDown={e => { e.preventDefault(); e.stopPropagation(); handleSaveLocal(); }}
            onTouchStart={e => { e.preventDefault(); e.stopPropagation(); handleSaveLocal(); }}
            style={{ padding:'4px 14px', borderRadius:4, border:'none', background:'#22c55e', color:'white', fontSize:11, fontWeight:700, cursor:'pointer', boxShadow:'0 2px 8px rgba(34,197,94,.4)' }}>
            Save
          </button>
        </div>
        <div ref={ref} contentEditable suppressContentEditableWarning
          onKeyDown={handleKey}
          onMouseDown={e => e.stopPropagation()}
          onTouchStart={e => e.stopPropagation()}
          onClick={e => e.stopPropagation()}
          style={{
            width:'100%', height:'100%', outline:'none', padding:4,
            wordBreak:'break-word', overflowWrap:'break-word', overflow:'hidden',
            boxSizing:'border-box', cursor:'text', userSelect:'text',
            background:'rgba(240,253,244,0.95)', borderRadius:3,
            direction:'ltr', unicodeBidi:'plaintext',
          }}
        />
      </div>
    </>
  );
}

// ─── Toolbar ──────────────────────────────────────────────────────────────────
const TOOLBAR_HEIGHT = 68;

const TGroup = ({ label, children, noBorder }) => (
  <div style={{ display:"flex", flexDirection:"column", padding:"0 8px", borderRight: noBorder?"none":"1px solid #e2e8f0", flexShrink:0 }}>
    <div style={{ display:"flex", alignItems:"center", gap:3, flex:1, justifyContent:"center", minHeight:32 }}>{children}</div>
    {label && <div style={{ fontSize:9, color:"#94a3b8", textAlign:"center", marginTop:2, fontWeight:600, textTransform:"uppercase", letterSpacing:".05em", height:12 }}>{label}</div>}
  </div>
);

const sSel = {fontSize:11,padding:"2px 4px",borderRadius:4,border:"1px solid #e2e8f0",cursor:"pointer",background:"white",color:"#334155",height:26};

function TBtn({children,title,onClick,onMouseDown,onTouchStart,onMouseEnter,style:sx={},disabled=false,active=false}) {
  return(
    <button title={title} onClick={onClick} onMouseDown={onMouseDown} onTouchStart={onTouchStart} onMouseEnter={onMouseEnter} disabled={disabled}
      style={{width:26,height:26,borderRadius:4,color:disabled?"#cbd5e1":active?"#3b82f6":"#475569",display:"flex",alignItems:"center",justifyContent:"center",background:active?"#eff6ff":"transparent",border:active?"1px solid #bfdbfe":"none",cursor:disabled?"default":"pointer",flexShrink:0,transition:"all 0.1s",...sx}}
      onMouseOver={e=>{if(!disabled) e.currentTarget.style.background=active?"#dbeafe":"#f1f5f9"}}
      onMouseOut={e=>{if(!disabled) e.currentTarget.style.background=active?"#eff6ff":"transparent"}}
    >{children}</button>
  );
}

function CPicker({title,onPick,icon,bg,value}) {
  return(
    <label title={title} style={{position:"relative",width:26,height:26,borderRadius:4,border:"1px solid #e2e8f0",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,flexShrink:0,background:bg||"white"}}>
      <span style={{pointerEvents:"none"}}>{icon}</span>
      <input type="color" defaultValue={value||"#000000"} style={{opacity:0,position:"absolute",inset:0,width:"100%",cursor:"pointer"}} onInput={e=>onPick(e.target.value)}/>
    </label>
  );
}

function AlignMenu({ exec, block, onUpdate }) {
  const [open, setOpen] = useState(false);
  const handleAlign = (e, cmd, alignVal) => {
    e.preventDefault();
    if (document.activeElement && document.activeElement.isContentEditable) {
      exec(cmd); setOpen(false);
    } else if (block && onUpdate) {
      const temp = document.createElement('div');
      temp.innerHTML = block.html;
      if (temp.children.length === 0) { const w = document.createElement('div'); w.innerHTML = temp.innerHTML; temp.innerHTML = ''; temp.appendChild(w); }
      Array.from(temp.children).forEach(child => { child.style.textAlign = alignVal; });
      onUpdate([{ id: block.id, html: temp.innerHTML }]); setOpen(false);
    }
  };
  return (
    <div style={{ position:"relative" }} onMouseLeave={() => setOpen(false)}>
      <TBtn title="Alignment Options" onMouseEnter={() => setOpen(true)} onClick={() => setOpen(!open)}><Ico d={icMenu} /></TBtn>
      {open && (
        <div style={{ position:"absolute", top:"100%", left:-4, paddingTop:6, zIndex:99999 }}>
          <div style={{ background:"white", border:"1px solid #e2e8f0", borderRadius:6, boxShadow:"0 10px 25px -5px rgba(0,0,0,0.2)", display:"flex", flexDirection:"column", padding:4, gap:2 }}>
            {[["Left",icLeft,"justifyLeft","left"],["Center",icCenter,"justifyCenter","center"],["Right",icRight,"justifyRight","right"],["Justify",icLineH,"justifyFull","justify"]].map(([lbl,ic,cmd,val])=>(
              <TBtn key={lbl} title={`Align ${lbl}`} style={{width:110,justifyContent:"flex-start",paddingLeft:8,fontSize:12,gap:8}} onMouseDown={e=>handleAlign(e,cmd,val)} onTouchStart={e=>handleAlign(e,cmd,val)}>
                <Ico d={ic} /> {lbl}
              </TBtn>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function LinkBtn({ exec }) {
  const handleLink = () => {
    const url = prompt("Enter URL:", "https://");
    if (url) exec("createLink", url);
  };
  return <TBtn title="Insert Link" onClick={handleLink}><Ico d={icLink} /></TBtn>;
}

function Toolbar({ block, allBlocks, onUpdate, onDelete, selectedCount }) {
  const exec = useCallback((cmd, val) => {
    if (document.activeElement && document.activeElement.isContentEditable) {
      document.execCommand(cmd, false, val ?? null);
    }
  }, []);

  const applySize = px => {
    // Перевіряємо, чи відкритий режим редагування тексту
    if (document.querySelector('[contenteditable]')) {
      document.execCommand("fontSize", false, "7");
      document.querySelectorAll("font[size='7']").forEach(n => {
        n.removeAttribute("size");
        n.style.fontSize = px + "px";
      });
    } else if (block) {
      // Застосовуємо до всього блоку, якщо він просто виділений
      const temp = document.createElement('div');
      temp.innerHTML = block.html;
      if (temp.children.length === 0) {
        const w = document.createElement('div');
        w.style.fontSize = px + "px";
        w.innerHTML = temp.innerHTML;
        temp.innerHTML = '';
        temp.appendChild(w);
      } else {
        Array.from(temp.children).forEach(c => { c.style.fontSize = px + "px"; });
      }
      onUpdate([{ id: block.id, html: temp.innerHTML }]);
    }
  };
const applyFont = fontName => {
    if (document.querySelector('[contenteditable]')) {
      document.execCommand("fontName", false, fontName);
      document.querySelectorAll("font[face]").forEach(n => {
        n.style.fontFamily = n.getAttribute("face");
        n.removeAttribute("face");
      });
    } else if (block) {
      const temp = document.createElement('div');
      temp.innerHTML = block.html;
      if (temp.children.length === 0) {
        const w = document.createElement('div');
        w.style.fontFamily = fontName;
        w.innerHTML = temp.innerHTML;
        temp.innerHTML = '';
        temp.appendChild(w);
      } else {
        Array.from(temp.children).forEach(c => { c.style.fontFamily = fontName; });
      }
      onUpdate([{ id: block.id, html: temp.innerHTML }]);
    }
  };
  const applyLineHeight = lh => {
    if (!block) return;
    const temp = document.createElement('div');
    temp.innerHTML = block.html;
    const setLH = (el) => {
      if(el.children.length === 0 && el.parentElement === temp) {
        el.style.lineHeight = lh;
      } else {
        Array.from(el.children).forEach(c => { c.style.lineHeight = lh; setLH(c); });
      }
    };
    if(temp.children.length === 0) {
      const wrapper = document.createElement('div');
      wrapper.style.lineHeight = lh;
      wrapper.innerHTML = temp.innerHTML;
      temp.appendChild(wrapper);
    } else {
      Array.from(temp.children).forEach(c => { c.style.lineHeight = lh; });
    }
    onUpdate([{id: block.id, html: temp.innerHTML}]);
  };

  const selBlocks = allBlocks.filter(b=>b._sel);

  if (selectedCount > 1) return (
    <div style={{...ROW, minHeight:TOOLBAR_HEIGHT}} onMouseDown={e=>e.stopPropagation()} onTouchStart={e=>e.stopPropagation()}>
      <TGroup label="Selection">
        <span style={{fontSize:11,color:"#64748b",fontWeight:600,padding:"0 4px"}}>{selectedCount} selected</span>
      </TGroup>
      <TGroup label="Align H">
        <TBtn title="Align left"   onClick={()=>{const m=Math.min(...selBlocks.map(b=>b.x));onUpdate(selBlocks.map(b=>({id:b.id,x:m})));}}><Ico d={icLeft}/></TBtn>
        <TBtn title="Center H"     onClick={()=>{const l=Math.min(...selBlocks.map(b=>b.x)),r=Math.max(...selBlocks.map(b=>b.x+b.w)),cx=(l+r)/2;onUpdate(selBlocks.map(b=>({id:b.id,x:Math.round(cx-b.w/2)})));}}><Ico d={icCenter}/></TBtn>
        <TBtn title="Align right"  onClick={()=>{const m=Math.max(...selBlocks.map(b=>b.x+b.w));onUpdate(selBlocks.map(b=>({id:b.id,x:m-b.w})));}}><Ico d={icRight}/></TBtn>
      </TGroup>
      <TGroup label="Align V">
        <TBtn title="Align top" onClick={()=>{const m=Math.min(...selBlocks.map(b=>b.y));onUpdate(selBlocks.map(b=>({id:b.id,y:m})));}} style={{fontSize:12}}>⬆</TBtn>
        <TBtn title="Center V"  onClick={()=>{const t=Math.min(...selBlocks.map(b=>b.y)),btm=Math.max(...selBlocks.map(b=>b.y+b.h)),cy=(t+btm)/2;onUpdate(selBlocks.map(b=>({id:b.id,y:Math.round(cy-b.h/2)})));}} style={{fontSize:12}}>↕</TBtn>
        <TBtn title="Align bottom" onClick={()=>{const m=Math.max(...selBlocks.map(b=>b.y+b.h));onUpdate(selBlocks.map(b=>({id:b.id,y:m-b.h})));}} style={{fontSize:12}}>⬇</TBtn>
      </TGroup>
      <TGroup label="Distribute">
        <TBtn title="Distribute horizontally" onClick={()=>{
          const sorted=[...selBlocks].sort((a,b)=>a.x-b.x);
          if(sorted.length<3)return;
          const totalW=sorted.reduce((s,b)=>s+b.w,0);
          const gap=(sorted[sorted.length-1].x+sorted[sorted.length-1].w-sorted[0].x-totalW)/(sorted.length-1);
          let cx=sorted[0].x;
          onUpdate(sorted.map(b=>{const r={id:b.id,x:Math.round(cx)};cx+=b.w+gap;return r;}));
        }} style={{fontSize:12}}>⇔</TBtn>
        <TBtn title="Distribute vertically" onClick={()=>{
          const sorted=[...selBlocks].sort((a,b)=>a.y-b.y);
          if(sorted.length<3)return;
          const totalH=sorted.reduce((s,b)=>s+b.h,0);
          const gap=(sorted[sorted.length-1].y+sorted[sorted.length-1].h-sorted[0].y-totalH)/(sorted.length-1);
          let cy=sorted[0].y;
          onUpdate(sorted.map(b=>{const r={id:b.id,y:Math.round(cy)};cy+=b.h+gap;return r;}));
        }} style={{fontSize:12}}>⇕</TBtn>
      </TGroup>
      <TGroup label="Size">
        <TBtn title="Same width" onClick={()=>{const ref=selBlocks[0];onUpdate(selBlocks.map(b=>({id:b.id,w:ref.w})));}} style={{fontSize:9,width:52}}>= W</TBtn>
        <TBtn title="Same height" onClick={()=>{const ref=selBlocks[0];onUpdate(selBlocks.map(b=>({id:b.id,h:ref.h})));}} style={{fontSize:9,width:52}}>= H</TBtn>
      </TGroup>
      <TGroup label="Actions" noBorder>
        <TBtn title="Group (lock together)" style={{fontSize:10,color:"#64748b"}}>⊞</TBtn>
        <TBtn title="Delete all" onClick={()=>onDelete(selBlocks.map(b=>b.id))} style={{color:"#ef4444"}}><Ico d={icTrash}/></TBtn>
      </TGroup>
    </div>
  );

  if (!block) return (
    <div style={{...ROW, minHeight:TOOLBAR_HEIGHT, alignItems:"center"}}>
      <span style={{fontSize:12,color:"#94a3b8",marginLeft:12,fontWeight:500}}>Click a block to select · Double-click to edit content · Shift+click for multi-select · Arrow keys to nudge</span>
    </div>
  );

  return (
    <div style={{...ROW, minHeight:TOOLBAR_HEIGHT}} onMouseDown={e=>e.stopPropagation()} onTouchStart={e=>e.stopPropagation()}>
      {block.type==="text" && <>
        <TGroup label="Font">
          <select style={{...sSel, width:110}} onChange={e=>applyFont(e.target.value)} title="Font Family">
            {FONTS.map(f=><option key={f} value={f}>{f}</option>)}
          </select>
          <select style={{...sSel, width:46}} onChange={e=>applySize(e.target.value)} title="Font Size">
            {FONT_SIZES.map(s=><option key={s} value={s}>{s}</option>)}
          </select>
        </TGroup>

        <TGroup label="Style">
          <TBtn title="Bold (Ctrl+B)"      onMouseDown={e=>{e.preventDefault();exec("bold")}}         onTouchStart={e=>{e.preventDefault();exec("bold")}}        ><Ico d={icBold}/></TBtn>
          <TBtn title="Italic (Ctrl+I)"    onMouseDown={e=>{e.preventDefault();exec("italic")}}        onTouchStart={e=>{e.preventDefault();exec("italic")}}       ><Ico d={icItalic}/></TBtn>
          <TBtn title="Underline (Ctrl+U)" onMouseDown={e=>{e.preventDefault();exec("underline")}}     onTouchStart={e=>{e.preventDefault();exec("underline")}}    ><Ico d={icUnderline}/></TBtn>
          <TBtn title="Strikethrough"      onMouseDown={e=>{e.preventDefault();exec("strikeThrough")}} onTouchStart={e=>{e.preventDefault();exec("strikeThrough")}}><Ico d={icStrike}/></TBtn>
          <TBtn title="Superscript"        onMouseDown={e=>{e.preventDefault();exec("superscript")}}   style={{fontSize:10,fontWeight:700}}>x²</TBtn>
          <TBtn title="Subscript"          onMouseDown={e=>{e.preventDefault();exec("subscript")}}     style={{fontSize:10,fontWeight:700}}>x₂</TBtn>
        </TGroup>

        <TGroup label="Color">
          <CPicker title="Text Color"     onPick={c=>exec("foreColor",c)}   icon="A"/>
          <CPicker title="Highlight"      onPick={c=>exec("hiliteColor",c)} icon="🖍" bg="#fef08a"/>
          <TBtn title="Clear Formatting"  onMouseDown={e=>{e.preventDefault();exec("removeFormat")}}   onTouchStart={e=>{e.preventDefault();exec("removeFormat")}}><Ico d={icClear}/></TBtn>
        </TGroup>

        <TGroup label="Paragraph">
          <AlignMenu exec={exec} block={block} onUpdate={onUpdate}/>
          <div style={{width:1,height:18,background:"#e2e8f0",margin:"0 2px"}}/>
          <TBtn title="Bullet List"   onMouseDown={e=>{e.preventDefault();exec("insertUnorderedList")}} onTouchStart={e=>{e.preventDefault();exec("insertUnorderedList")}}><Ico d={icList}/></TBtn>
          <TBtn title="Numbered List" onMouseDown={e=>{e.preventDefault();exec("insertOrderedList")}}   onTouchStart={e=>{e.preventDefault();exec("insertOrderedList")}}><Ico d={icOList}/></TBtn>
          <TBtn title="Indent"        onMouseDown={e=>{e.preventDefault();exec("indent")}}   style={{fontSize:13}}>⇥</TBtn>
          <TBtn title="Outdent"       onMouseDown={e=>{e.preventDefault();exec("outdent")}}  style={{fontSize:13}}>⇤</TBtn>
        </TGroup>

        <TGroup label="Spacing">
          <select style={{...sSel,width:52}} onChange={e=>applyLineHeight(e.target.value)} title="Line Height">
            {LINE_HEIGHTS.map(lh=><option key={lh} value={lh}>{lh}</option>)}
          </select>
          <LinkBtn exec={exec}/>
        </TGroup>
      </>}

      {["skillbar", "rating", "timeline", "tags", "iconrow", "progress", "social", "linkbadge", "languages", "hobbies", "references"].includes(block.type) && (
        <TGroup label="Colors">
          <div style={{display:"flex", gap:6}}>
            {block.type==="skillbar" && <>
              <CPicker title="Fill Color" onPick={c=>onUpdate([{id:block.id,fillBarColor:c}])} value={block.fillBarColor} icon="🟦"/>
              <CPicker title="Track Color" onPick={c=>onUpdate([{id:block.id,trackColor:c}])} value={block.trackColor} icon="⬜"/>
              <CPicker title="Text Color" onPick={c=>onUpdate([{id:block.id,labelColor:c}])} value={block.labelColor} icon="A"/>
            </>}
            {block.type==="rating" && <CPicker title="Dot Color" onPick={c=>onUpdate([{id:block.id,dotColor:c}])} value={block.dotColor} icon="●"/>}
            {block.type==="timeline" && <>
              <CPicker title="Dot Color" onPick={c=>onUpdate([{id:block.id,dotColor:c}])} value={block.dotColor} icon="●"/>
              <CPicker title="Line Color" onPick={c=>onUpdate([{id:block.id,lineColor:c}])} value={block.lineColor} icon="│"/>
              <CPicker title="Date Color" onPick={c=>onUpdate([{id:block.id,dateColor:c}])} value={block.dateColor} icon="A"/>
            </>}
            {block.type==="tags" && <>
              <CPicker title="Background" onPick={c=>onUpdate([{id:block.id,tagBg:c}])} value={block.tagBg} icon="🪣"/>
              <CPicker title="Text Color" onPick={c=>onUpdate([{id:block.id,tagColor:c}])} value={block.tagColor} icon="A"/>
              <CPicker title="Border" onPick={c=>onUpdate([{id:block.id,tagBorder:c}])} value={block.tagBorder} icon="▢"/>
            </>}
            {block.type==="progress" && <CPicker title="Color" onPick={c=>onUpdate([{id:block.id,color:c}])} value={block.color} icon="○"/>}
            {block.type==="social" && <>
              <CPicker title="Text Color" onPick={c=>onUpdate([{id:block.id,color:c}])} value={block.color} icon="A"/>
              <select style={sSel} onChange={e=>onUpdate([{id:block.id,dir:e.target.value}])} value={block.dir||"row"}>
                <option value="row">Row</option><option value="column">Column</option>
              </select>
              <select style={sSel} onChange={e=>onUpdate([{id:block.id,align:e.target.value}])} value={block.align||"flex-start"}>
                <option value="flex-start">Left</option><option value="center">Center</option><option value="flex-end">Right</option>
              </select>
            </>}
            {block.type==="linkbadge" && <>
              <CPicker title="Background" onPick={c=>onUpdate([{id:block.id,bgColor:c}])} value={block.bgColor} icon="🪣"/>
              <CPicker title="Text Color" onPick={c=>onUpdate([{id:block.id,color:c}])} value={block.color} icon="A"/>
              <TBtn title="Rounded completely" active={block.round} onClick={()=>onUpdate([{id:block.id,round:!block.round}])}>⭕</TBtn>
            </>}
            {block.type==="languages" && <>
              <CPicker title="Accent Color" onPick={c=>onUpdate([{id:block.id,color:c}])} value={block.color} icon="A"/>
              <CPicker title="Line Color" onPick={c=>onUpdate([{id:block.id,lineColor:c}])} value={block.lineColor} icon="─"/>
            </>}
            {block.type==="hobbies" && <>
              <CPicker title="Background" onPick={c=>onUpdate([{id:block.id,bgColor:c}])} value={block.bgColor} icon="🪣"/>
              <CPicker title="Text Color" onPick={c=>onUpdate([{id:block.id,color:c}])} value={block.color} icon="A"/>
              <CPicker title="Border" onPick={c=>onUpdate([{id:block.id,borderColor:c}])} value={block.borderColor} icon="▢"/>
              <TBtn title="Rounded completely" active={block.round} onClick={()=>onUpdate([{id:block.id,round:!block.round}])}>⭕</TBtn>
            </>}
            {block.type==="references" && <>
              <CPicker title="Name Color" onPick={c=>onUpdate([{id:block.id,color:c}])} value={block.color} icon="A"/>
              <CPicker title="Text Color" onPick={c=>onUpdate([{id:block.id,subColor:c}])} value={block.subColor} icon="a"/>
            </>}
          </div>
        </TGroup>
      )}

      {block.type==="divider" && (
        <TGroup label="Divider">
          <div style={{display:"flex",alignItems:"center",gap:6}}>
            <CPicker title="Color" onPick={c=>onUpdate([{id:block.id,color:c}])} icon="─" value={block.color||"#e2e8f0"}/>
            <div style={{width:1,height:18,background:"#e2e8f0",margin:"0 2px"}}/>
            <span style={{fontSize:10,color:"#475569"}}>px</span>
            <select style={sSel} onChange={e=>onUpdate([{id:block.id,h:+e.target.value}])} value={block.h}>
              {[1,2,3,4,6,8,12,16].map(t=><option key={t} value={t}>{t}</option>)}
            </select>
            <div style={{width:1,height:18,background:"#e2e8f0",margin:"0 2px"}}/>
            <span style={{fontSize:10,color:"#475569"}}>Style</span>
            <select style={{...sSel,width:80}} onChange={e=>onUpdate([{id:block.id,dividerStyle:e.target.value}])} value={block.dividerStyle||"solid"}>
              {["solid","dashed","dotted","double"].map(s=><option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </TGroup>
      )}

      {block.type==="shape" && <>
        <TGroup label="Fill & Border">
          <CPicker title="Fill Color"   onPick={c=>onUpdate([{id:block.id,fillColor:c}])}   icon="🟦" value={block.fillColor||"transparent"}/>
          <CPicker title="Border Color" onPick={c=>onUpdate([{id:block.id,strokeColor:c}])} icon="▢" value={block.strokeColor||"#3b82f6"}/>
        </TGroup>
        <TGroup label="Stroke">
          <input type="range" min={0} max={12} defaultValue={block.strokeWidth??2} style={{width:55,accentColor:"#3b82f6"}} onInput={e=>onUpdate([{id:block.id,strokeWidth:+e.target.value}])}/>
          <span style={{fontSize:10,color:"#475569",width:16}}>{block.strokeWidth??2}</span>
        </TGroup>
        <TGroup label="Opacity">
          <input type="range" min={0} max={1} step={0.05} defaultValue={block.opacity??1} style={{width:55,accentColor:"#3b82f6"}} onInput={e=>onUpdate([{id:block.id,opacity:+e.target.value}])}/>
          <span style={{fontSize:10,color:"#475569",width:24}}>{Math.round((block.opacity??1)*100)}%</span>
        </TGroup>
        {block.shapeType==="rRect" && (
          <TGroup label="Radius">
            <input type="range" min={0} max={60} defaultValue={block.cornerRadius??12} style={{width:55,accentColor:"#3b82f6"}} onInput={e=>onUpdate([{id:block.id,cornerRadius:+e.target.value}])}/>
          </TGroup>
        )}
      </>}

      {block.type==="photo" && (
        <TGroup label="Photo">
          <span style={{fontSize:10,color:"#475569"}}>Shape:</span>
          <TBtn title="Circle" active={block.shape==="circle"} onClick={()=>onUpdate([{id:block.id,shape:"circle"}])} style={{width:52,fontSize:10}}>Circle</TBtn>
          <TBtn title="Square" active={block.shape!=="circle"} onClick={()=>onUpdate([{id:block.id,shape:"square"}])} style={{width:52,fontSize:10}}>Square</TBtn>
          <div style={{width:1,height:18,background:"#e2e8f0",margin:"0 4px"}}/>
          <span style={{fontSize:10,color:"#475569"}}>Border:</span>
          <CPicker title="Border Color" onPick={c=>onUpdate([{id:block.id,borderColor:c}])} icon="○"/>
        </TGroup>
      )}

      {/* Position info */}
      <TGroup label="Position">
        <div style={{display:"flex",flexDirection:"column",gap:2}}>
          <div style={{display:"flex",gap:3,alignItems:"center"}}>
            <span style={{fontSize:9,color:"#94a3b8",width:8}}>X</span>
            <input type="number" value={block.x}
              style={{...sSel,width:46}} onChange={e=>onUpdate([{id:block.id,x:+e.target.value}])}/>
          </div>
          <div style={{display:"flex",gap:3,alignItems:"center"}}>
            <span style={{fontSize:9,color:"#94a3b8",width:8}}>Y</span>
            <input type="number" value={block.y}
              style={{...sSel,width:46}} onChange={e=>onUpdate([{id:block.id,y:+e.target.value}])}/>
          </div>
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:2}}>
          <div style={{display:"flex",gap:3,alignItems:"center"}}>
            <span style={{fontSize:9,color:"#94a3b8",width:8}}>W</span>
            <input type="number" value={block.w} min={MIN_SIZE}
              style={{...sSel,width:46}} onChange={e=>onUpdate([{id:block.id,w:+e.target.value}])}/>
          </div>
          <div style={{display:"flex",gap:3,alignItems:"center"}}>
            <span style={{fontSize:9,color:"#94a3b8",width:8}}>H</span>
            <input type="number" value={block.h} min={MIN_SIZE}
              style={{...sSel,width:46}} onChange={e=>onUpdate([{id:block.id,h:+e.target.value}])}/>
          </div>
        </div>
      </TGroup>

      <TGroup label="Block" noBorder>
        <CPicker title="Background Color" onPick={c=>onUpdate([{id:block.id,bgColor:c}])} icon="🪣"/>
        <TBtn title="Clear Background" onClick={()=>onUpdate([{id:block.id,bgColor:"transparent"}])}><Ico d={icClear}/></TBtn>
        <div style={{width:1,height:18,background:"#e2e8f0",margin:"0 2px"}}/>
        <TBtn title="Bring Forward"  onClick={()=>{const mx=Math.max(...allBlocks.map(b=>b.z||0));onUpdate([{id:block.id,z:mx+1}]);}}>⏫</TBtn>
        <TBtn title="Send Backward"  onClick={()=>{const mn=Math.min(...allBlocks.map(b=>b.z||0));onUpdate([{id:block.id,z:mn-1}]);}}>⏬</TBtn>
        <div style={{width:1,height:18,background:"#e2e8f0",margin:"0 2px"}}/>
        <TBtn title={block.locked?"Unlock Block":"Lock Block"} onClick={()=>onUpdate([{id:block.id,locked:!block.locked}])}>
          <Ico d={block.locked?icLock:icUnlock}/>
        </TBtn>
        <TBtn title="Duplicate" onClick={()=>onUpdate([{...block,id:uid(),x:block.type==="shape"?block.x+GRID:CL(block.x+GRID,0,A4_W-block.w),y:block.y+GRID,_add:true}])}><Ico d={icDuplicate}/></TBtn>
        <TBtn title="Delete" onClick={()=>onDelete([block.id])} style={{color:"#ef4444"}}><Ico d={icTrash}/></TBtn>
      </TGroup>
    </div>
  );
}

const ROW = {display:"flex",alignItems:"flex-start",gap:0,flexWrap:"nowrap",minHeight:TOOLBAR_HEIGHT,overflow:"visible", paddingRight: 20};

// Рендеринг іконок
const renderIcon = (iconString) => {
  if (!iconString) return "";
  const name = iconString.toLowerCase().trim();
  switch (name) {
    case "github": return <FontAwesomeIcon icon={faGithub} />;
    case "linkedin": return <FontAwesomeIcon icon={faLinkedin} />;
    case "telegram": return <FontAwesomeIcon icon={faTelegram} />;
    case "instagram": return <FontAwesomeIcon icon={faInstagram} />;
    case "facebook": return <FontAwesomeIcon icon={faFacebook} />;
    case "twitter": return <FontAwesomeIcon icon={faTwitter} />;
    case "youtube": return <FontAwesomeIcon icon={faYoutube} />;
    case "discord": return <FontAwesomeIcon icon={faDiscord} />;
    case "behance": return <FontAwesomeIcon icon={faBehance} />;
    case "dribbble": return <FontAwesomeIcon icon={faDribbble} />;
    case "figma": return <FontAwesomeIcon icon={faFigma} />;
    case "stackoverflow": return <FontAwesomeIcon icon={faStackOverflow} />;
    case "tiktok": return <FontAwesomeIcon icon={faTiktok} />;
    case "twitch": return <FontAwesomeIcon icon={faTwitch} />;
    case "medium": return <FontAwesomeIcon icon={faMedium} />;
    case "gitlab": return <FontAwesomeIcon icon={faGitlab} />;
    case "pinterest": return <FontAwesomeIcon icon={faPinterest} />;
    case "reddit": return <FontAwesomeIcon icon={faReddit} />;
    
    case "email": return <FontAwesomeIcon icon={faEnvelope} />;
    case "phone": return <FontAwesomeIcon icon={faPhone} />;
    case "location": return <FontAwesomeIcon icon={faMapMarkerAlt} />;
    case "web": return <FontAwesomeIcon icon={faGlobe} />;
    case "art": return <FontAwesomeIcon icon={faPaintBrush} />;
    case "game": return <FontAwesomeIcon icon={faGamepad} />;
    case "music": return <FontAwesomeIcon icon={faMusic} />;
    case "portfolio": return <FontAwesomeIcon icon={faBriefcase} />;
    case "code": return <FontAwesomeIcon icon={faCode} />;
    case "camera": return <FontAwesomeIcon icon={faCamera} />;
    case "video": return <FontAwesomeIcon icon={faVideo} />;
    case "laptop": return <FontAwesomeIcon icon={faLaptopCode} />;
    
    default: return iconString;
  }
};

// ─── Block ────────────────────────────────────────────────────────────────────
const Block = ({ block, selected, selectedIds, allBlocks, onSelect, onUpdate, onDelete, setGuides, pageRef, pushH }) => {
  const fileRef  = useRef();
  const [editing, setEditing] = useState(false);

  const blockRef      = useRef(block);
  const selIdsRef     = useRef(selectedIds);
  const allBlocksRef  = useRef(allBlocks);
  const onSelectRef   = useRef(onSelect);
  const onUpdateRef   = useRef(onUpdate);
  const setGuidesRef  = useRef(setGuides);
  const pushHRef      = useRef(pushH);

  useEffect(() => { blockRef.current     = block;       }, [block]);
  useEffect(() => { selIdsRef.current    = selectedIds; }, [selectedIds]);
  useEffect(() => { allBlocksRef.current = allBlocks;   }, [allBlocks]);
  useEffect(() => { onSelectRef.current  = onSelect;    }, [onSelect]);
  useEffect(() => { onUpdateRef.current  = onUpdate;    }, [onUpdate]);
  useEffect(() => { setGuidesRef.current = setGuides;   }, [setGuides]);
  useEffect(() => { pushHRef.current     = pushH;       }, [pushH]);

  useEffect(() => {
    if (!editing) return;
    const h = e => { if (e.key === 'Escape') setEditing(false); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [editing]);

  const toA4 = useCallback((cx,cy) => {
    const r = pageRef.current.getBoundingClientRect();
    return { x:(cx-r.left)*(A4_W/r.width), y:(cy-r.top)*(A4_H/r.height) };
  },[pageRef]);

  const startDrag = useCallback((e, isShift = false) => {
    if (e.type.startsWith('mouse') && e.button !== 0) return;
    const tgt = e.target;
    if (tgt.isContentEditable || tgt.closest("[contenteditable]") || tgt.tagName==="INPUT" || tgt.tagName==="A") return;
    if (blockRef.current.locked) return;
    if (e.cancelable && e.type !== 'touchstart') e.preventDefault();
    e.stopPropagation();

    const blk = blockRef.current;
    const curSelIds = selIdsRef.current;
    const curBlocks = allBlocksRef.current;
    let ids = [...curSelIds];
    if (isShift) { ids = ids.includes(blk.id) ? ids.filter(id=>id!==blk.id) : [...ids,blk.id]; }
    else { if (!ids.includes(blk.id)) ids = [blk.id]; }
    if (!ids.includes(blk.id)) return;
    pushHRef.current();

    const coords = getEvtCoords(e);
    const origin = toA4(coords.clientX, coords.clientY);
    const init   = ids.map(id => {
      const b = curBlocks.find(x=>x.id===id);
      return { id, ox:b.x, ogy:b.y + b.page*(A4_H+PAGE_GAP) };
    });
    const prim   = init.find(s=>s.id===blk.id);
    const statics = curBlocks.filter(b=>!ids.includes(b.id) && b.page===blk.page);
    let last = [];

    const onMove = ev => {
      const mCoords = getEvtCoords(ev);
      const pos = toA4(mCoords.clientX, mCoords.clientY);
      const dx = pos.x-origin.x, dy = pos.y-origin.y;
      let rawX = prim.ox+dx, rawGY = prim.ogy+dy;
      let pg = Math.max(0, Math.floor(rawGY/(A4_H+PAGE_GAP)));
      let rawY = rawGY - pg*(A4_H+PAGE_GAP);
      let sX=SN(rawX), sY=SN(rawY);
      const g={v:[],h:[]};
      for (const sb of statics) {
        for (const tx of [sb.x, sb.x+sb.w/2, sb.x+sb.w]) {
          if (Math.abs(rawX-tx)<SNAP_TOL)              { sX=tx;           g.v.push(tx); }
          else if (Math.abs(rawX+blk.w/2-tx)<SNAP_TOL) { sX=tx-blk.w/2;  g.v.push(tx); }
          else if (Math.abs(rawX+blk.w-tx)<SNAP_TOL)   { sX=tx-blk.w;    g.v.push(tx); }
        }
        for (const ty of [sb.y, sb.y+sb.h/2, sb.y+sb.h]) {
          if (Math.abs(rawY-ty)<SNAP_TOL)              { sY=ty;           g.h.push(ty); }
          else if (Math.abs(rawY+blk.h/2-ty)<SNAP_TOL) { sY=ty-blk.h/2;  g.h.push(ty); }
          else if (Math.abs(rawY+blk.h-ty)<SNAP_TOL)   { sY=ty-blk.h;    g.h.push(ty); }
        }
      }
      setGuidesRef.current(g);
      const diffX  = sX - prim.ox;
      const diffGY = (pg*(A4_H+PAGE_GAP)+sY) - prim.ogy;
      last = init.map(st => {
        const stB = curBlocks.find(b=>b.id===st.id);
        const isShape = stB.type === "shape";
        if (isShape) {
          return { id: st.id, x: st.ox + diffX, y: st.ogy - stB.page*(A4_H+PAGE_GAP) + diffGY, page: stB.page };
        }
        const nGY = st.ogy + diffGY;
        const np  = Math.max(0, Math.floor(nGY/(A4_H+PAGE_GAP)));
        return { id:st.id, x:CL(st.ox+diffX,0,A4_W-stB.w), y:CL(nGY-np*(A4_H+PAGE_GAP),0,A4_H-stB.h), page:np };
      });
      onUpdateRef.current(last, true, false);
    };
    const onUp = () => {
      window.removeEventListener("mousemove",onMove);
      window.removeEventListener("mouseup",onUp);
      window.removeEventListener("touchmove",onMove);
      window.removeEventListener("touchend",onUp);
      setGuidesRef.current({v:[],h:[]});
      if (last.length) onUpdateRef.current(last, true, true);
    };
    window.addEventListener("mousemove",onMove);
    window.addEventListener("mouseup",onUp);
    window.addEventListener("touchmove",onMove,{passive:false});
    window.addEventListener("touchend",onUp);
  },[]);

  const startResize = useCallback((e,dir) => {
    if (e.cancelable && e.type !== 'touchstart') e.preventDefault();
    e.stopPropagation();
    if (blockRef.current.locked) return;
    pushHRef.current();
    const blk = blockRef.current;
    const ob  = {x:blk.x,y:blk.y,w:blk.w,h:blk.h,id:blk.id};
    const coords = getEvtCoords(e);
    const or  = toA4(coords.clientX, coords.clientY);
    const onMove = ev => {
      const mCoords = getEvtCoords(ev);
      const pos=toA4(mCoords.clientX,mCoords.clientY);
      const dx=pos.x-or.x, dy=pos.y-or.y;
      let {x,y,w,h}=ob;
      const isShape = blk.type === "shape";

      if(dir.includes("e")) w=SN(isShape ? Math.max(MIN_SIZE, w+dx) : CL(w+dx,MIN_SIZE,A4_W-x));
      if(dir.includes("s")) h=SN(isShape ? Math.max(MIN_SIZE, h+dy) : CL(h+dy,MIN_SIZE,A4_H-y));
      if(dir.includes("w")){ 
        const nw=SN(isShape ? Math.max(MIN_SIZE, ob.w-dx) : CL(w-dx,MIN_SIZE,ob.x+ob.w));
        x=SN(ob.x+ob.w-nw); w=nw; 
        if(!isShape && x<0){w+=x;x=0;} 
      }
      if(dir.includes("n")){ 
        const nh=SN(isShape ? Math.max(MIN_SIZE, ob.h-dy) : CL(h-dy,MIN_SIZE,ob.y+ob.h));
        y=SN(ob.y+ob.h-nh); h=nh; 
        if(!isShape && y<0){h+=y;y=0;} 
      }
      onUpdateRef.current([{id:ob.id,x,y,w,h}],true,false);
    };
    const onUp = () => {
      window.removeEventListener("mousemove",onMove);
      window.removeEventListener("mouseup",onUp);
      window.removeEventListener("touchmove",onMove);
      window.removeEventListener("touchend",onUp);
      onUpdateRef.current([{id:ob.id}],true,true);
    };
    window.addEventListener("mousemove",onMove);
    window.addEventListener("mouseup",onUp);
    window.addEventListener("touchmove",onMove,{passive:false});
    window.addEventListener("touchend",onUp);
  },[]);

  const H = block.type==="divider" ? Math.max(2,block.h) : block.h;
  const handleCancel = () => setEditing(false);

  const dividerStyle = block.dividerStyle || "solid";

  return (
    <div
      style={{
        position:"absolute", left:block.x, top:block.y, width:block.w, height:H,
        zIndex: editing ? 1500 : selected
          ? (typeLayer(block.type)===LAYER_BG?90:typeLayer(block.type)===LAYER_MID?190:1100)
          : (typeLayer(block.type)===LAYER_BG?Math.min(10+(block.z||0),89):typeLayer(block.type)===LAYER_MID?Math.min(100+(block.z||0),189):Math.min(200+(block.z||0),1099)),
        outline: editing?"2px solid #22c55e":selected?"2px solid #3b82f6":"1.5px dashed transparent",
        outlineOffset:1, borderRadius:3, boxSizing:"border-box",
        backgroundColor: block.bgColor||"transparent",
        cursor: block.locked?"default":"default",
        opacity: block.hidden?0.18:1,
        pointerEvents: block.hidden?"none":"auto",
        touchAction: editing ? "auto" : "none",
      }}
      onMouseDown={e => {
        if (editing) { e.stopPropagation(); return; }
        e.stopPropagation();
        if (e.shiftKey) { onSelect(block.id, false); startDrag(e, true); }
        else { if (!selectedIds.includes(block.id)) onSelect(block.id, true); startDrag(e, false); }
      }}
      onTouchStart={e => {
        if (editing) { e.stopPropagation(); return; }
        e.stopPropagation();
        if (!selectedIds.includes(block.id)) onSelect(block.id, true);
        startDrag(e, false);
      }}
      onDoubleClick={e => {
        if(editing || block.locked) return;
        if(block.type==="text" || ["skillbar","rating","timeline","tags","iconrow","progress","qr","social","linkbadge","languages","hobbies","references"].includes(block.type)) {
            e.stopPropagation();
            if (!selectedIds.includes(block.id)) onSelect(block.id, true);
            setEditing(true);
        }
      }}
    >
      {selected && !editing && block.locked && (
        <div style={{position:"absolute",top:-24,right:0,background:"#1e293b",color:"white",padding:"2px 6px",borderRadius:4,fontSize:10,zIndex:400,display:"flex",alignItems:"center",gap:4}}>
          <Ico d={icLock}/> Locked
        </div>
      )}

      {selected && !editing && !block.locked && (
        <div onMouseDown={e=>e.stopPropagation()} onTouchStart={e=>e.stopPropagation()}
          style={{position:"absolute",top:-36,left:"50%",transform:"translateX(-50%)",background:"#1e293b",borderRadius:"6px 6px 0 0",display:"flex",alignItems:"center",gap:2,padding:"4px 6px",boxShadow:"0 -4px 12px rgba(0,0,0,0.2)",zIndex:400,whiteSpace:"nowrap"}}>
          <div onMouseDown={e=>{e.stopPropagation();startDrag(e,false);}} onTouchStart={e=>{e.stopPropagation();startDrag(e,false);}}
            title="Drag to move"
            style={{padding:"2px 8px",cursor:"grab",color:"#60a5fa",fontSize:14,letterSpacing:2,display:"flex",alignItems:"center"}}>⣿</div>
          <div style={{width:1,height:16,background:"#334155"}}/>
          {(block.type==="text" || ["skillbar","rating","timeline","tags","iconrow","progress","qr","social","linkbadge","languages","hobbies","references"].includes(block.type)) && (
            <button onMouseDown={e=>{e.preventDefault();e.stopPropagation();setEditing(true);}} onTouchStart={e=>{e.preventDefault();e.stopPropagation();setEditing(true);}}
              title="Edit content (double-click)"
              style={{padding:"2px 9px",borderRadius:4,border:"none",background:"#3b82f6",color:"white",fontSize:10,fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",gap:4}}>
              ✏️ Edit
            </button>
          )}
          <div style={{width:1,height:16,background:"#334155"}}/>
          <span style={{fontSize:9,color:"#64748b",padding:"0 4px"}}>{block.w}×{H}</span>
          <div style={{width:1,height:16,background:"#334155"}}/>
          {selectedIds.length===1 && (
            <button onMouseDown={e=>{e.preventDefault();e.stopPropagation();onDelete([block.id]);}} onTouchStart={e=>{e.preventDefault();e.stopPropagation();onDelete([block.id]);}}
              style={{padding:"2px 8px",borderRadius:4,border:"none",background:"transparent",color:"#fca5a5",fontSize:12,fontWeight:700,cursor:"pointer"}}>
              <Ico d={icTrash}/>
            </button>
          )}
        </div>
      )}

      {block.type==="text" && !editing && (
        <div style={{width:"100%",height:"100%",padding:4,overflow:"hidden",boxSizing:"border-box",userSelect:"none",pointerEvents:"auto",direction:"ltr"}}
          dangerouslySetInnerHTML={{__html:DOMPurify.sanitize(block.html)}}
        />
      )}
      {block.type==="text" && editing && (
        <TextEditor block={block}
          onSave={(html)=>{onUpdateRef.current([{id:block.id,html}],false,false);setEditing(false);}}
          onCancel={handleCancel}
        />
      )}

      {editing && ["skillbar","rating","timeline","tags","iconrow","progress","qr","social","linkbadge","languages","hobbies","references"].includes(block.type) && (
        <VisualDataEditor block={block}
          onSave={(updates)=>{onUpdateRef.current([{id:block.id, ...updates}],false,false);setEditing(false);}}
          onCancel={handleCancel}
        />
      )}

      {block.type==="divider" && (
        <div style={{
          width:"100%",height:"100%",
          borderTop:`${H}px ${dividerStyle} ${block.color||"#e2e8f0"}`,
          borderRadius:1,boxSizing:"border-box"
        }}/>
      )}

      {block.type==="shape"   && <ShapeSVG block={block}/>}

      {block.type==="photo"   && (
        <div style={{width:"100%",height:"100%",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:4}}>
          <div style={{
            width:Math.min(block.w,block.h)-8,height:Math.min(block.w,block.h)-8,
            borderRadius:block.shape==="circle"?"50%":10,overflow:"hidden",background:"#f1f5f9",cursor:"pointer",
            border:block.borderColor?`3px solid ${block.borderColor}`:"none"
          }} onClick={()=>{if(!block.locked)fileRef.current.click()}}>
            {block.src ? <img src={block.src} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/> :
              <div style={{width:"100%",height:"100%",display:"flex",alignItems:"center",justifyContent:"center",color:"#cbd5e1",fontSize:28}}>+</div>}
          </div>
          <div style={{display:"flex",gap:8,fontSize:9,color:"#94a3b8"}}>
            <span style={{cursor:block.locked?"default":"pointer"}} onClick={()=>{if(!block.locked)fileRef.current.click()}}>Upload</span>·
            <span style={{cursor:block.locked?"default":"pointer"}} onClick={()=>{if(!block.locked)onUpdate([{id:block.id,shape:block.shape==="circle"?"square":"circle"}])}}>
              {block.shape==="circle"?"Square":"Circle"}
            </span>
          </div>
          <input ref={fileRef} type="file" accept="image/*" style={{display:"none"}}
            onChange={e=>{
              const f=e.target.files[0];if(!f)return;
              const r=new FileReader();
              r.onload=ev=>{compressImage(ev.target.result,(d)=>onUpdate([{id:block.id,src:d}],false));};
              r.readAsDataURL(f);
            }}/>
        </div>
      )}

      {/* Social Links Block */}
      {block.type==="social" && (
        <div style={{width:"100%",padding:"4px 8px",boxSizing:"border-box",display:"flex",flexDirection:block.dir||"row",gap:12,flexWrap:"wrap",justifyContent:block.align||"flex-start"}}>
          {(block.items||[]).map((item,i)=>(
            <a key={i} href={item.url} target="_blank" rel="noreferrer" style={{display:"flex",alignItems:"center",gap:6,textDecoration:"none",color:block.color||"#3b82f6",fontSize:12,fontFamily:"DM Sans,sans-serif"}}>
              <span style={{fontSize:16, flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center", width: 20}}>{renderIcon(item.icon)}</span>
              <span style={{fontWeight:600}}>{item.text}</span>
            </a>
          ))}
        </div>
      )}

      {/* Link Badge Block */}
      {block.type==="linkbadge" && (
        <div style={{width:"100%",height:"100%",display:"flex",alignItems:"center",justifyContent:"center"}}>
          <a href={block.url} target="_blank" rel="noreferrer" style={{
            display:"inline-block", background:block.bgColor||"#3b82f6", color:block.color||"#ffffff",
            padding:"8px 16px", borderRadius:block.round?99:6, textDecoration:"none", fontWeight:700,
            fontFamily:"DM Sans,sans-serif", fontSize:12, textAlign:"center", boxShadow:"0 4px 6px rgba(0,0,0,0.1)"
          }}>
            {block.label}
          </a>
        </div>
      )}

      {/* Languages Block */}
      {block.type==="languages" && (
        <div style={{width:"100%",padding:"4px 8px",boxSizing:"border-box",display:"flex",flexDirection:"column",gap:8}}>
          {(block.items||[]).map((item,i)=>(
            <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",borderBottom:`1px solid ${block.lineColor||"#f1f5f9"}`,paddingBottom:4}}>
              <span style={{fontSize:12,fontWeight:700,color:"#1e293b",fontFamily:"DM Sans,sans-serif"}}>{item.lang}</span>
              <span style={{fontSize:11,color:block.color||"#3b82f6",fontWeight:600,fontFamily:"DM Sans,sans-serif",background:`${block.color||"#3b82f6"}15`,padding:"2px 8px",borderRadius:4}}>{item.level}</span>
            </div>
          ))}
        </div>
      )}

      {/* Hobbies Block */}
      {block.type==="hobbies" && (
        <div style={{width:"100%",padding:"4px 8px",boxSizing:"border-box",display:"flex",flexWrap:"wrap",gap:8,justifyContent:block.align||"flex-start"}}>
          {(block.items||[]).map((item,i)=>(
            <div key={i} style={{display:"flex",alignItems:"center",gap:6,background:block.bgColor||"#f8fafc",padding:"4px 10px",borderRadius:block.round?99:8,border:`1px solid ${block.borderColor||"#e2e8f0"}`}}>
              <span style={{fontSize:16, flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center", width: 20}}>{renderIcon(item.icon)}</span>
              <span style={{fontSize:11,fontWeight:600,color:block.color||"#334155",fontFamily:"DM Sans,sans-serif"}}>{item.label}</span>
            </div>
          ))}
        </div>
      )}

      {/* References Block */}
      {block.type==="references" && (
        <div style={{width:"100%",padding:"4px 8px",boxSizing:"border-box",display:"flex",flexDirection:"column",gap:12}}>
          {(block.items||[]).map((item,i)=>(
            <div key={i} style={{display:"flex",flexDirection:"column",gap:2}}>
              <span style={{fontSize:13,fontWeight:700,color:block.color||"#1e293b",fontFamily:"DM Sans,sans-serif"}}>{item.name}</span>
              <span style={{fontSize:11,color:block.subColor||"#64748b",fontFamily:"DM Sans,sans-serif"}}>{item.role}</span>
              <span style={{fontSize:11,color:"#3b82f6",fontFamily:"DM Sans,sans-serif",marginTop:2}}>{item.contact}</span>
            </div>
          ))}
        </div>
      )}

      {/* Skill bar block */}
      {block.type==="skillbar" && (
        <div style={{width:"100%",padding:"4px 8px",boxSizing:"border-box"}}>
          {(block.skills||[]).map((s,i)=>(
            <div key={i} style={{marginBottom:6}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:2}}>
                <span style={{fontSize:11,fontWeight:600,color:block.labelColor||"#334155",fontFamily:"DM Sans,sans-serif"}}>{s.name}</span>
                {block.showPct && <span style={{fontSize:10,color:"#94a3b8"}}>{s.pct}%</span>}
              </div>
              <div style={{background:block.trackColor||"#e2e8f0",borderRadius:99,height:block.barH||6,overflow:"hidden"}}>
                <div style={{width:`${s.pct}%`,height:"100%",background:block.fillBarColor||"#3b82f6",borderRadius:99}}/>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Rating block */}
      {block.type==="rating" && (
        <div style={{width:"100%",padding:"4px 8px",boxSizing:"border-box"}}>
          {(block.ratings||[]).map((r,i)=>(
            <div key={i} style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
              <span style={{fontSize:11,fontWeight:600,color:"#334155",fontFamily:"DM Sans,sans-serif",minWidth:100}}>{r.name}</span>
              <div style={{display:"flex",gap:3}}>
                {[1,2,3,4,5].map(n=>(
                  <div key={n} style={{width:12,height:12,borderRadius:"50%",background:n<=r.rating?(block.dotColor||"#3b82f6"):"#e2e8f0"}}/>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Timeline block */}
      {block.type==="timeline" && (
        <div style={{width:"100%",padding:"4px 8px 4px 20px",boxSizing:"border-box",position:"relative"}}>
          <div style={{position:"absolute",left:24,top:0,bottom:0,width:2,background:block.lineColor||"#e2e8f0"}}/>
          {(block.items||[]).map((item,i)=>(
            <div key={i} style={{position:"relative",paddingLeft:16,marginBottom:14}}>
              <div style={{position:"absolute",left:-7,top:5,width:10,height:10,borderRadius:"50%",background:block.dotColor||"#3b82f6",border:"2px solid white"}}/>
              <div style={{fontSize:10,color:block.dateColor||"#94a3b8",fontFamily:"DM Sans,sans-serif"}}>{item.date}</div>
              <div style={{fontSize:12,fontWeight:700,color:"#1e293b",fontFamily:"DM Sans,sans-serif"}}>{item.title}</div>
              {item.sub && <div style={{fontSize:11,color:"#64748b",fontFamily:"DM Sans,sans-serif"}}>{item.sub}</div>}
            </div>
          ))}
        </div>
      )}

      {/* Tag/badge block */}
      {block.type==="tags" && (
        <div style={{width:"100%",padding:"4px 8px",boxSizing:"border-box",display:"flex",flexWrap:"wrap",gap:6,alignContent:"flex-start"}}>
          {(block.tags||[]).map((tag,i)=>(
            <span key={i} style={{
              padding:"3px 10px",borderRadius:99,fontSize:11,fontWeight:600,fontFamily:"DM Sans,sans-serif",
              background:block.tagBg||"#eff6ff",color:block.tagColor||"#3b82f6",
              border:`1px solid ${block.tagBorder||"#bfdbfe"}`
            }}>{tag}</span>
          ))}
        </div>
      )}

      {/* Icon+text row block */}
      {block.type==="iconrow" && (
        <div style={{width:"100%",padding:"2px 8px",boxSizing:"border-box"}}>
          {(block.items||[]).map((item,i)=>(
            <div key={i} style={{display:"flex",alignItems:"center",gap:10,padding:"3px 0"}}>
              <span style={{fontSize:16, flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center", width: 20}}>{renderIcon(item.icon)}</span>
              <span style={{fontSize:11,color:"#334155",fontFamily:"DM Sans,sans-serif"}}>{item.text}</span>
            </div>
          ))}
        </div>
      )}

      {/* QR placeholder */}
      {block.type==="qr" && (
        <div style={{width:"100%",height:"100%",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:6}}>
          <div style={{width:Math.min(block.w,block.h)-20,height:Math.min(block.w,block.h)-20,background:"#f1f5f9",borderRadius:4,display:"flex",alignItems:"center",justifyContent:"center",border:"2px dashed #cbd5e1"}}>
            <span style={{fontSize:32,color:"#cbd5e1"}}>QR</span>
          </div>
          {block.url && <span style={{fontSize:9,color:"#94a3b8",maxWidth:"90%",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{block.url}</span>}
        </div>
      )}

      {/* Progress circle */}
      {block.type==="progress" && (() => {
        return (
          <div style={{width:"100%",height:"100%",display:"flex",alignItems:"center",justifyContent:"center",flexWrap:"wrap",gap:8}}>
            {(block.items||[{label:"Skill",pct:75}]).map((item,i)=>{
              const sz2=Math.min(Math.floor(block.w/((block.items||[item]).length)),block.h)-10;
              const r2=sz2/2-5;const circ2=2*Math.PI*r2;const off2=circ2*(1-item.pct/100);
              return (
                <div key={i} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:2}}>
                  <svg width={sz2} height={sz2}>
                    <circle cx={sz2/2} cy={sz2/2} r={r2} fill="none" stroke="#e2e8f0" strokeWidth={block.strokeW||5}/>
                    <circle cx={sz2/2} cy={sz2/2} r={r2} fill="none" stroke={block.color||"#3b82f6"} strokeWidth={block.strokeW||5}
                      strokeDasharray={circ2} strokeDashoffset={off2} strokeLinecap="round" 
                      transform={`rotate(-90 ${sz2/2} ${sz2/2})`} />
                    <text x={sz2/2} y={sz2/2} textAnchor="middle" dominantBaseline="central" fill="#334155" fontSize={sz2/5} fontWeight="700" fontFamily="DM Sans,sans-serif">
                      {item.pct}%
                    </text>
                  </svg>
                  <span style={{fontSize:9,color:"#64748b",fontFamily:"DM Sans,sans-serif",textAlign:"center"}}>{item.label}</span>
                </div>
              );
            })}
          </div>
        );
      })()}

      {selected && !editing && !block.locked && selectedIds.length===1 && HANDLES.map(({dir,cur,s})=>(
        <div key={dir} data-handle onMouseDown={e=>startResize(e,dir)} onTouchStart={e=>startResize(e,dir)}
          style={{position:"absolute",width:9,height:9,background:"white",border:"2px solid #3b82f6",borderRadius:"50%",cursor:cur,zIndex:200,...s}}/>
      ))}
    </div>
  );
};

// ─── Layers Panel ────────────────────────────────────────────────────────────
const LAYER_META = [
  { layer:LAYER_TOP, label:"Content",    icon:"T",  desc:"Text & rich blocks",     color:"#3b82f6" },
  { layer:LAYER_MID, label:"Mid",        icon:"◎",  desc:"Dividers & photos",      color:"#8b5cf6" },
  { layer:LAYER_BG,  label:"Background", icon:"🟦", desc:"Shapes & decorations",   color:"#64748b" },
];

function LayersPanel({ blocks, selectedIds, onSelect, onUpdate, onDelete }) {
  const grouped = LAYER_META.map(lm => ({
    ...lm,
    blocks: blocks.filter(b=>typeLayer(b.type)===lm.layer).sort((a,b)=>(b.z||0)-(a.z||0)),
  }));
  const typeIcon = t => ({text:"T",shape:"◆",divider:"─",photo:"◉",skillbar:"▰",rating:"●",timeline:"⋮",tags:"#",iconrow:"⊙",qr:"⊞",progress:"○",social:"🌐",linkbadge:"🔗",languages:"🗣",hobbies:"🎯",references:"🤝"}[t]||"?");
  const typeLabel = t => ({text:"Text",shape:"Shape",divider:"Divider",photo:"Photo",skillbar:"Skill Bars",rating:"Ratings",timeline:"Timeline",tags:"Tags",iconrow:"Icon Row",qr:"QR Code",progress:"Progress",social:"Social Links",linkbadge:"Link Badge",languages:"Languages",hobbies:"Hobbies",references:"References"}[t]||t);

  return (
    <div style={{paddingBottom:8}}>
      {grouped.map(group=>(
        <div key={group.layer} style={{marginBottom:4}}>
          <div style={{display:"flex",alignItems:"center",gap:6,padding:"6px 8px",borderRadius:6,marginBottom:2,background:`${group.color}12`,border:`1px solid ${group.color}30`}}>
            <span style={{fontSize:11}}>{group.icon}</span>
            <div style={{flex:1}}>
              <div style={{fontSize:10,fontWeight:700,color:group.color}}>{group.label} Layer</div>
              <div style={{fontSize:8,color:"#94a3b8"}}>{group.desc}</div>
            </div>
            <span style={{fontSize:9,color:"#cbd5e1",fontWeight:600}}>{group.blocks.length}</span>
          </div>
          {group.blocks.length===0 && <div style={{fontSize:9,color:"#cbd5e1",padding:"4px 10px",fontStyle:"italic"}}>Empty</div>}
          {group.blocks.map(b=>{
            const isSel = selectedIds.includes(b.id);
            return (
              <div key={b.id}
                onMouseDown={e=>{e.stopPropagation();onSelect(b.id,!e.shiftKey);}}
                onTouchStart={e=>{e.stopPropagation();onSelect(b.id,true);}}
                style={{display:"flex",alignItems:"center",gap:6,padding:"5px 8px 5px 16px",borderRadius:5,marginBottom:1,background:isSel?"#eff6ff":"transparent",border:isSel?"1px solid #bfdbfe":"1px solid transparent",cursor:"pointer",transition:"all .1s"}}
                onMouseEnter={e=>{if(!isSel)e.currentTarget.style.background="#f8fafc";}}
                onMouseLeave={e=>{if(!isSel)e.currentTarget.style.background="transparent";}}>
                <span style={{fontSize:10,color:group.color,flexShrink:0,width:14,textAlign:"center"}}>{typeIcon(b.type)}</span>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:10,fontWeight:600,color:"#1e293b",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",display:"flex",alignItems:"center",gap:4}}>
                    {b.locked&&<Ico d={icLock}/>} {typeLabel(b.type)}
                    {b.type==="text"&&b.html&&<span style={{fontWeight:400,color:"#94a3b8"}}>— {b.html.replace(/<[^>]+>/g,"").slice(0,18)||"empty"}</span>}
                    {b.type==="shape"&&<span style={{fontWeight:400,color:"#94a3b8"}}>{b.shapeType}</span>}
                  </div>
                  <div style={{fontSize:8,color:"#cbd5e1"}}>{b.w}×{b.h} · p{b.page+1} · z={b.z||0}</div>
                </div>
                <button title={b.hidden?"Show":"Hide"} onMouseDown={e=>{e.stopPropagation();onUpdate([{id:b.id,hidden:!b.hidden}]);}} onTouchStart={e=>{e.stopPropagation();onUpdate([{id:b.id,hidden:!b.hidden}]);}}
                  style={{background:"transparent",border:"none",cursor:"pointer",padding:2,color:b.hidden?"#cbd5e1":"#64748b",fontSize:11,flexShrink:0}}>{b.hidden?"🙈":"👁"}</button>
                <div style={{display:"flex",flexDirection:"column",gap:1,flexShrink:0}}>
                  <button title="Move up" onMouseDown={e=>{e.stopPropagation();onUpdate([{id:b.id,z:(b.z||0)+1}]);}} style={{background:"transparent",border:"none",cursor:"pointer",color:"#94a3b8",fontSize:8,lineHeight:1,padding:"1px 2px"}}>▲</button>
                  <button title="Move down" onMouseDown={e=>{e.stopPropagation();onUpdate([{id:b.id,z:(b.z||0)-1}]);}} style={{background:"transparent",border:"none",cursor:"pointer",color:"#94a3b8",fontSize:8,lineHeight:1,padding:"1px 2px"}}>▼</button>
                </div>
                <button title="Delete" onMouseDown={e=>{e.stopPropagation();onDelete([b.id]);}} style={{background:"transparent",border:"none",cursor:"pointer",color:"#fca5a5",fontSize:11,flexShrink:0,padding:2}}>×</button>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
function Page({ pageIdx, allBlocks, selectedIds, onSelect, onUpdate, onDelete, setGuides, guides, showGrid, pushH }) {
  const pageRef = useRef();
  const pageBlks = useMemo(()=>
    allBlocks.filter(b=>b.page===pageIdx).sort((a,b)=>{
      const la=typeLayer(a.type),lb=typeLayer(b.type);
      if(la!==lb)return la-lb;
      return (a.z||0)-(b.z||0);
    }),
  [allBlocks,pageIdx]);
  return (
    <div ref={pageRef} className="cv-page"
      style={{position:"relative",width:A4_W,height:A4_H,background:"#fff",borderRadius:2,flexShrink:0,
        boxShadow:"0 4px 6px rgba(0,0,0,0.04),0 12px 40px rgba(0,0,0,0.08)",overflow:"visible",
        backgroundImage:showGrid?`radial-gradient(#e2e8f0 1px,transparent 1px)`:"none",
        backgroundSize:`${GRID}px ${GRID}px`}}
      onMouseDown={e=>{if(e.target===e.currentTarget)setTimeout(()=>onSelect(null),0);}}
      onTouchStart={e=>{if(e.target===e.currentTarget)setTimeout(()=>onSelect(null),0);}}>
      <div className="page-number" style={{position:"absolute",bottom:10,right:14,fontSize:10,color:"#d1d5db",pointerEvents:"none",userSelect:"none"}}>{pageIdx+1}</div>
      {pageBlks.map(b=>(
        <Block key={b.id} block={b} selected={selectedIds.includes(b.id)} selectedIds={selectedIds}
          allBlocks={allBlocks.map(x=>({...x,_sel:selectedIds.includes(x.id)}))}
          onSelect={onSelect} onUpdate={onUpdate} onDelete={onDelete}
          setGuides={setGuides} pageRef={pageRef} pushH={pushH}/>
      ))}
      {guides.v.map((vx,i)=><div key={`v${i}`} style={{position:"absolute",left:vx,top:0,bottom:0,width:1,background:"#3b82f6",zIndex:9999,pointerEvents:"none"}}/>)}
      {guides.h.map((hy,i)=><div key={`h${i}`} style={{position:"absolute",top:hy,left:0,right:0,height:1,background:"#3b82f6",zIndex:9999,pointerEvents:"none"}}/>)}
    </div>
  );
}

// ─── Sidebar helpers ──────────────────────────────────────────────────────────
const PRESETS = [
  {label:"Full-width Text",  icon:"T",  group:"Text", mk:(pg,y)=>({id:uid(),page:pg,x:40,y,w:714,h:80,z:LAYER_TOP,type:"text",html:"<div style='line-height:1.5'><span style='font-size:13px;font-family:\"DM Sans\",sans-serif;color:#334155'>New text block…</span></div>"})},
  {label:"Half Left",        icon:"▧",  group:"Text", mk:(pg,y)=>({id:uid(),page:pg,x:40,y,w:340,h:120,z:LAYER_TOP,type:"text",html:"<div style='line-height:1.5'><span style='font-size:13px;font-family:\"DM Sans\",sans-serif;color:#334155'>Left column…</span></div>"})},
  {label:"Half Right",       icon:"▨",  group:"Text", mk:(pg,y)=>({id:uid(),page:pg,x:414,y,w:340,h:120,z:LAYER_TOP,type:"text",html:"<div style='line-height:1.5'><span style='font-size:13px;font-family:\"DM Sans\",sans-serif;color:#334155'>Right column…</span></div>"})},
  {label:"Name / Heading",   icon:"H",  group:"Text", mk:(pg,y)=>({id:uid(),page:pg,x:40,y,w:714,h:70,z:LAYER_TOP,type:"text",html:"<div style='line-height:1.2'><span style='font-size:38px;font-family:Georgia,serif;font-weight:700;color:#1a1a2e'>Full Name</span></div>"})},
  {label:"Section Title",    icon:"§",  group:"Text", mk:(pg,y)=>({id:uid(),page:pg,x:40,y,w:714,h:28,z:LAYER_TOP,type:"text",html:"<div><span style='font-size:9px;font-family:\"DM Sans\",sans-serif;font-weight:700;text-transform:uppercase;letter-spacing:.16em;color:#3b82f6'>Section Title</span></div>"})},
  {label:"Job Title Row",    icon:"JT", group:"Text", mk:(pg,y)=>({id:uid(),page:pg,x:40,y,w:714,h:30,z:LAYER_TOP,type:"text",html:"<div><span style='font-size:14px;font-family:\"DM Sans\",sans-serif;font-weight:600;color:#3b82f6;letter-spacing:.04em'>Position · Company · 2020–Present</span></div>"})},
  {label:"Contact Info",     icon:"@",  group:"Text", mk:(pg,y)=>({id:uid(),page:pg,x:40,y,w:714,h:30,z:LAYER_TOP,type:"text",html:"<div><span style='font-size:11px;font-family:\"DM Sans\",sans-serif;color:#64748b'>📧 email@example.com &nbsp;·&nbsp; 📱 +1 (555) 000-0000 &nbsp;·&nbsp; 🌐 linkedin.com/in/name</span></div>"})},
  {label:"Bullet List",      icon:"•",  group:"Text", mk:(pg,y)=>({id:uid(),page:pg,x:40,y,w:714,h:100,z:LAYER_TOP,type:"text",html:"<ul style='font-size:12px;font-family:\"DM Sans\",sans-serif;color:#475569;padding-left:18px;line-height:1.7;margin:0'><li>Achievement one with measurable result</li><li>Achievement two with impact description</li><li>Achievement three with key outcome</li></ul>"})},
  {label:"Numbered List",    icon:"1.", group:"Text", mk:(pg,y)=>({id:uid(),page:pg,x:40,y,w:714,h:100,z:LAYER_TOP,type:"text",html:"<ol style='font-size:12px;font-family:\"DM Sans\",sans-serif;color:#475569;padding-left:18px;line-height:1.7;margin:0'><li>First key responsibility</li><li>Second major achievement</li><li>Third notable contribution</li></ol>"})},
  {label:"Quote / Summary",  icon:"❝",  group:"Text", mk:(pg,y)=>({id:uid(),page:pg,x:40,y,w:714,h:70,z:LAYER_TOP,type:"text",html:"<div style='border-left:3px solid #3b82f6;padding-left:14px;font-size:13px;font-family:Georgia,serif;font-style:italic;color:#475569;line-height:1.7'>Passionate engineer with 5+ years crafting elegant frontend solutions at scale.</div>"})},
  {label:"Divider Line",     icon:"─",  group:"Dividers", mk:(pg,y)=>({id:uid(),page:pg,x:40,y,w:714,h:2,z:LAYER_MID,type:"divider",color:"#e2e8f0"})},
  {label:"Thick Divider",    icon:"━",  group:"Dividers", mk:(pg,y)=>({id:uid(),page:pg,x:40,y,w:714,h:4,z:LAYER_MID,type:"divider",color:"#1e293b"})},
  {label:"Accent Divider",   icon:"─",  group:"Dividers", mk:(pg,y)=>({id:uid(),page:pg,x:40,y,w:200,h:3,z:LAYER_MID,type:"divider",color:"#3b82f6"})},
  {label:"Dashed Divider",   icon:"╌",  group:"Dividers", mk:(pg,y)=>({id:uid(),page:pg,x:40,y,w:714,h:3,z:LAYER_MID,type:"divider",color:"#cbd5e1",dividerStyle:"dashed"})},
  {label:"Profile Photo",    icon:"◉",  group:"Media", mk:(pg,y)=>({id:uid(),page:pg,x:40,y,w:100,h:100,z:LAYER_MID,type:"photo",src:null,shape:"circle"})},
  {label:"Square Photo",     icon:"◻",  group:"Media", mk:(pg,y)=>({id:uid(),page:pg,x:40,y,w:120,h:120,z:LAYER_MID,type:"photo",src:null,shape:"square"})},
  {label:"Skill Bars",       icon:"▰",  group:"Visual", mk:(pg,y)=>({id:uid(),page:pg,x:40,y,w:340,h:130,z:LAYER_TOP,type:"skillbar",barH:7,showPct:true,fillBarColor:"#3b82f6",trackColor:"#e2e8f0",labelColor:"#334155",skills:[{name:"JavaScript",pct:90},{name:"React",pct:85},{name:"Node.js",pct:75},{name:"UI/UX Design",pct:70}]})},
  {label:"Dot Ratings",      icon:"●●", group:"Visual", mk:(pg,y)=>({id:uid(),page:pg,x:400,y,w:340,h:120,z:LAYER_TOP,type:"rating",dotColor:"#3b82f6",ratings:[{name:"Communication",rating:5},{name:"Problem Solving",rating:4},{name:"Teamwork",rating:5},{name:"Leadership",rating:4}]})},
  {label:"Timeline",         icon:"⋮",  group:"Visual", mk:(pg,y)=>({id:uid(),page:pg,x:40,y,w:714,h:200,z:LAYER_TOP,type:"timeline",lineColor:"#e2e8f0",dotColor:"#3b82f6",dateColor:"#94a3b8",items:[{date:"2021–Present",title:"Lead Developer",sub:"TechNova Inc."},{date:"2019–2021",title:"Frontend Engineer",sub:"StartupXYZ"},{date:"2015–2019",title:"B.S. Computer Science",sub:"University of Technology"}]})},
  {label:"Tag Cloud",        icon:"#",  group:"Visual", mk:(pg,y)=>({id:uid(),page:pg,x:40,y,w:714,h:60,z:LAYER_TOP,type:"tags",tagBg:"#eff6ff",tagColor:"#3b82f6",tagBorder:"#bfdbfe",tags:["React","TypeScript","Node.js","GraphQL","AWS","Docker","PostgreSQL","Redis"]})},
  {label:"Icon Info Row",    icon:"⊙",  group:"Visual", mk:(pg,y)=>({id:uid(),page:pg,x:40,y,w:340,h:130,z:LAYER_TOP,type:"iconrow",items:[{icon:"location",text:"San Francisco, CA"},{icon:"email",text:"alex@example.com"},{icon:"phone",text:"+1 (555) 123-4567"},{icon:"github",text:"github.com/alexcarter"},{icon:"linkedin",text:"linkedin.com/in/alexcarter"}]})},
  {label:"Progress Circles", icon:"○",  group:"Visual", mk:(pg,y)=>({id:uid(),page:pg,x:40,y,w:714,h:220,z:LAYER_TOP,type:"progress",color:"#3b82f6",strokeW:5,items:[{label:"JavaScript",pct:90},{label:"React",pct:85},{label:"Node.js",pct:75},{label:"CSS",pct:80},{label:"Python",pct:60}]})},
  {label:"Social Links",     icon:"🌐", group:"Visual", mk:(pg,y)=>({id:uid(),page:pg,x:40,y,w:400,h:40,z:LAYER_TOP,type:"social",dir:"row",align:"flex-start",color:"#3b82f6",items:[{icon:"linkedin",text:"LinkedIn",url:"https://linkedin.com"},{icon:"github",text:"GitHub",url:"https://github.com/CANDLE01"}]})},
  {label:"Link Badge",       icon:"🔗", group:"Visual", mk:(pg,y)=>({id:uid(),page:pg,x:40,y,w:180,h:40,z:LAYER_TOP,type:"linkbadge",label:"🎨 ArtStation Gallery",url:"https://artstation.com/",bgColor:"#0f172a",color:"#ffffff",round:true})},
  {label:"Languages List",   icon:"🗣", group:"Visual", mk:(pg,y)=>({id:uid(),page:pg,x:40,y,w:340,h:100,z:LAYER_TOP,type:"languages",color:"#3b82f6",lineColor:"#f1f5f9",items:[{lang:"English",level:"Upper-Intermediate"},{lang:"Ukrainian",level:"Native"}]})},
  {label:"Hobbies & Interests",icon:"🎯", group:"Visual", mk:(pg,y)=>({id:uid(),page:pg,x:40,y,w:340,h:60,z:LAYER_TOP,type:"hobbies",bgColor:"#f8fafc",color:"#334155",borderColor:"#e2e8f0",round:true,items:[{icon:"art",label:"Oil Painting"},{icon:"game",label:"Unity Game Dev"},{icon:"music",label:"Music Production"}]})},
  {label:"References",       icon:"🤝", group:"Visual", mk:(pg,y)=>({id:uid(),page:pg,x:40,y,w:340,h:100,z:LAYER_TOP,type:"references",color:"#1e293b",subColor:"#64748b",items:[{name:"Dr. Ivanenko",role:"Professor, Materials Science",contact:"ivanenko@university.edu.ua"},{name:"Tech Lead",role:"Freelance Client",contact:"client@example.com"}]})},
];

const PRESET_GROUPS = [...new Set(PRESETS.map(p=>p.group))];

function SL({children}){ return <div style={{fontSize:9,fontWeight:700,textTransform:"uppercase",letterSpacing:".12em",color:"#cbd5e1",padding:"10px 6px 5px"}}>{children}</div>; }
function SBtn({icon,label,onClick,dashed=false,danger=false,style:sx={}}){
  // Перевіряємо ширину екрана для адаптації відступів під палець
  const isMobileTarget = typeof window !== 'undefined' && window.innerWidth < 768;

  return(
    <button onClick={onClick} style={{
      width:"100%", display:"flex", alignItems:"center", gap:10, 
      // Збільшений padding для телефонів (12px замість 6px)
      padding: isMobileTarget ? "12px 14px" : "6px 8px", 
      borderRadius:8, // Трохи округліші кнопки
      border:dashed?"1px dashed #e2e8f0":"none", background:"transparent", cursor:"pointer",
      color:danger?"#dc2626":"#475569", fontSize: isMobileTarget ? "13px" : "11px", // Більший шрифт на мобільних
      fontWeight:500, textAlign:"left", marginBottom:4, ...sx
    }}
    onMouseEnter={e=>{e.currentTarget.style.background=danger?"#fef2f2":"#eff6ff";e.currentTarget.style.color=danger?"#b91c1c":"#3b82f6";}}
    onMouseLeave={e=>{e.currentTarget.style.background="transparent";e.currentTarget.style.color=danger?"#dc2626":"#475569";}}>
      <span style={{
        width: isMobileTarget ? 26 : 22, 
        height: isMobileTarget ? 26 : 22, 
        borderRadius:6, background:"#f1f5f9", display:"flex", alignItems:"center", justifyContent:"center", 
        fontSize: isMobileTarget ? 12 : 10, color:"#64748b", flexShrink:0
      }}>{icon}</span>
      {label}
    </button>
  );
}

// ─── App ──────────────────────────────────────────────────────────────────────
export default function ResumeBuilder() {
  const [blocks,     setBlocks]     = useState(getInitialBlocks);
  const [history,    setHistory]    = useState([]);
  const [future,     setFuture]     = useState([]);
  const [selIds,     setSelIds]     = useState([]);
  const [guides,     setGuides]     = useState({v:[],h:[]});
  const [extraPages, setExtraPages] = useState(0);
  const [tab,        setTab]        = useState("blocks");
  const [showGrid,   setShowGrid]   = useState(true);
  const [snapGrid,   setSnapGrid]   = useState(true);
  const [blockSearch,setBlockSearch]= useState("");
  const [expandedGroups, setExpandedGroups] = useState({Text:true,Dividers:true,Media:true,Visual:true});

 const [scale, setScale] = useState(() => {
    const width = typeof window !== 'undefined' ? window.innerWidth : 1024;
    return width < 768 ? 0.4 : 0.82;
  });
  
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' ? window.innerWidth < 768 : false);

  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      const mobile = width < 768;
      setIsMobile(mobile);
      // Примусово оновлюємо масштаб при зміні розміру вікна
      setScale(mobile ? 0.4 : 0.82);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const pagesRef = useRef(null);
  const bRef     = useRef(blocks);
  const hRef     = useRef(history);
  const fRef     = useRef(future);

  useEffect(()=>{ bRef.current=blocks; },[blocks]);
  useEffect(()=>{ hRef.current=history; },[history]);
  useEffect(()=>{ fRef.current=future; },[future]);

  useEffect(()=>{
    try { localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(blocks)); } catch(e){}
  },[blocks]);

  const pageCount = Math.max(1+extraPages, ...blocks.map(b=>b.page+1));
  const primary   = selIds.length===1 ? blocks.find(b=>b.id===selIds[0]) : null;

  // ── History ───────────────────────────────────────────────────────────────
  const pushH = useCallback(()=>{
    setHistory([...hRef.current.slice(-HISTORY_LIMIT), bRef.current]);
    setFuture([]);
  },[]);

  const handleUndo = useCallback(()=>{
    if(hRef.current.length===0)return;
    const prev=hRef.current[hRef.current.length-1];
    setFuture([bRef.current,...fRef.current]);
    setHistory(hRef.current.slice(0,-1));
    setBlocks(prev); setSelIds([]);
  },[]);

  const handleRedo = useCallback(()=>{
    if(fRef.current.length===0)return;
    const next=fRef.current[0];
    setHistory([...hRef.current,bRef.current]);
    setFuture(fRef.current.slice(1));
    setBlocks(next); setSelIds([]);
  },[]);

  // ── Update blocks ─────────────────────────────────────────────────────────
  const onUpdate = useCallback((updates,live=false,push=false)=>{
    if(!live) pushH();
    setBlocks(prev=>{
      if(updates[0]?._add){ const{_add,...nb}=updates[0]; setSelIds([nb.id]); return [...prev,nb]; }
      let next=prev.map(b=>{const u=updates.find(u=>u.id===b.id);return u?{...b,...u}:b;});
      if(push)next=resolveCollisions(next,updates[0]?.id);
      return next;
    });
  },[pushH]);

  const onSelect = useCallback((id,single=true)=>{
    if(!id){setSelIds([]);return;}
    if(!single) setSelIds(p=>p.includes(id)?p.filter(x=>x!==id):[...p,id]);
    else        setSelIds([id]);
  },[]);

  const onDelete = useCallback((ids)=>{
    pushH();
    setBlocks(p=>p.filter(b=>!ids.includes(b.id)));
    setSelIds(p=>p.filter(id=>!ids.includes(id)));
  },[pushH]);

  const addBlock = useCallback(preset=>{
    const pg=selIds.length?(blocks.find(b=>b.id===selIds[0])?.page||0):0;
    const yMax=blocks.filter(b=>b.page===pg).reduce((m,b)=>Math.max(m,b.y+b.h),40);
    const nb=preset.mk(pg, Math.min(SN(yMax+8), A4_H-80));
    pushH(); setBlocks(p=>[...p,nb]); setSelIds([nb.id]);
  },[blocks,selIds,pushH]);

  const addShape = useCallback(shapeType=>{
    const pg=selIds.length?(blocks.find(b=>b.id===selIds[0])?.page||0):0;
    const yMax=blocks.filter(b=>b.page===pg).reduce((m,b)=>Math.max(m,b.y+b.h),40);
    const nb={id:uid(),page:pg,x:40,y:Math.min(SN(yMax+8),A4_H-100),w:shapeType==="line"?714:200,h:shapeType==="line"?4:200,z:LAYER_BG,type:"shape",shapeType,fillColor:"transparent",strokeColor:"#3b82f6",strokeWidth:2,opacity:1,cornerRadius:12};
    pushH(); setBlocks(p=>[...p,nb]); setSelIds([nb.id]);
  },[blocks,selIds,pushH]);

  const applyTemplate = useCallback(name=>{
    pushH(); setSelIds([]); setExtraPages(0);
    if(name==="harvard"){
      setBlocks([
        {id:uid(),page:0,x:40,y:40,w:714,h:80,z:LAYER_TOP,type:"text",html:"<div style='text-align:center;line-height:1.2'><span style='font-size:42px;font-family:Garamond,serif;font-weight:700;color:#000000'>JOHN DOE</span></div>"},
        {id:uid(),page:0,x:40,y:120,w:714,h:24,z:LAYER_TOP,type:"text",html:"<div style='text-align:center'><span style='font-size:12px;font-family:Garamond,serif;color:#000000'>City, Country | github.com/johndoe</span></div>"},
        {id:uid(),page:0,x:40,y:160,w:714,h:2,z:LAYER_MID,type:"divider",color:"#000000"},
        {id:uid(),page:0,x:40,y:180,w:714,h:30,z:LAYER_TOP,type:"text",html:"<div style='text-align:center'><span style='font-size:14px;font-family:Garamond,serif;font-weight:700;text-transform:uppercase'>Education</span></div>"},
        {id:uid(),page:0,x:40,y:220,w:714,h:80,z:LAYER_TOP,type:"text",html:"<div style='font-family:Garamond,serif;font-size:14px;line-height:1.5'><b>University of Technology</b> <span style='float:right'>City</span><br><i>Bachelor of Science in Computer Science</i> <span style='float:right'>2024</span></div>"},
        {id:uid(),page:0,x:40,y:320,w:714,h:30,z:LAYER_TOP,type:"text",html:"<div style='text-align:center'><span style='font-size:14px;font-family:Garamond,serif;font-weight:700;text-transform:uppercase'>Experience</span></div>"},
        {id:uid(),page:0,x:40,y:360,w:714,h:120,z:LAYER_TOP,type:"text",html:"<div style='font-family:Garamond,serif;font-size:14px;line-height:1.5'><b>Tech Solutions Inc.</b> <span style='float:right'>City</span><br><i>Software Engineer</i> <span style='float:right'>2024 – Present</span><br>Developed interactive web applications, optimized database queries, and collaborated with cross-functional teams to deliver scalable solutions.</div>"}
      ]);return;
    }
    if(name==="oxford"){
      setBlocks([
        {id:uid(),page:0,x:40,y:40,w:500,h:60,z:LAYER_TOP,type:"text",html:"<div style='line-height:1.1'><span style='font-size:42px;font-family:Georgia,serif;font-weight:400;color:#1e293b'>John Doe</span></div>"},
        {id:uid(),page:0,x:554,y:48,w:200,h:50,z:LAYER_TOP,type:"text",html:"<div style='text-align:right;line-height:1.4'><span style='font-size:11px;font-family:Georgia,serif;color:#475569'>City, Country<br>github.com/johndoe</span></div>"},
        {id:uid(),page:0,x:40,y:105,w:714,h:3,z:LAYER_MID,type:"divider",color:"#1e293b"},
        {id:uid(),page:0,x:40,y:112,w:714,h:1,z:LAYER_MID,type:"divider",color:"#94a3b8"},
        {id:uid(),page:0,x:40,y:140,w:160,h:40,z:LAYER_TOP,type:"text",html:"<div style='line-height:1.2'><span style='font-size:14px;font-family:Georgia,serif;font-weight:700;color:#1e293b;text-transform:uppercase'>Education</span></div>"},
        {id:uid(),page:0,x:220,y:140,w:534,h:60,z:LAYER_TOP,type:"text",html:"<div style='line-height:1.5;font-family:Georgia,serif;font-size:12px'><b>Computer Science Student</b><br>State University<br><span style='color:#64748b'>Expected 2025</span></div>"},
        {id:uid(),page:0,x:40,y:220,w:160,h:40,z:LAYER_TOP,type:"text",html:"<div style='line-height:1.2'><span style='font-size:14px;font-family:Georgia,serif;font-weight:700;color:#1e293b;text-transform:uppercase'>Projects</span></div>"},
        {id:uid(),page:0,x:220,y:220,w:534,h:80,z:LAYER_TOP,type:"text",html:"<div style='line-height:1.5;font-family:Georgia,serif;font-size:12px'><b>E-commerce Platform</b><br>React & Node.js<br><span style='color:#64748b'>2024</span><br>Created a scalable frontend architecture and integrated secure payment gateways for an online shopping platform.</div>"}
      ]);return;
    }
    if(name==="executive"){
      setBlocks([
        {id:uid(),page:0,x:0,y:0,w:260,h:A4_H,z:LAYER_BG,type:"shape",shapeType:"rect",fillColor:"#0f172a",strokeColor:"transparent",strokeWidth:0,opacity:1,locked:true},
        {id:uid(),page:0,x:30,y:50,w:200,h:80,z:LAYER_TOP,type:"text",html:"<div style='line-height:1.1'><span style='font-size:36px;font-family:\"DM Sans\",sans-serif;font-weight:700;color:#ffffff'>John<br>Doe</span></div>"},
        {id:uid(),page:0,x:30,y:140,w:200,h:30,z:LAYER_TOP,type:"text",html:"<div><span style='font-size:14px;font-family:\"DM Sans\",sans-serif;color:#38bdf8;font-weight:500'>Software Engineer</span></div>"},
        {id:uid(),page:0,x:30,y:200,w:200,h:100,z:LAYER_TOP,type:"text",html:"<div style='line-height:1.6;font-family:\"DM Sans\",sans-serif;font-size:11px;color:#cbd5e1'><span style='color:#38bdf8;font-weight:700;letter-spacing:1px'>CONTACT</span><br>City, Country<br>github.com/johndoe</div>"},
        {id:uid(),page:0,x:30,y:340,w:200,h:120,z:LAYER_TOP,type:"text",html:"<div style='line-height:1.6;font-family:\"DM Sans\",sans-serif;font-size:11px;color:#cbd5e1'><span style='color:#38bdf8;font-weight:700;letter-spacing:1px'>SKILLS</span><br>JavaScript, TypeScript<br>React, Node.js<br>Docker, AWS<br>PostgreSQL</div>"},
        {id:uid(),page:0,x:300,y:50,w:454,h:40,z:LAYER_TOP,type:"text",html:"<div style='border-bottom:2px solid #e2e8f0;padding-bottom:8px'><span style='font-size:18px;font-family:\"DM Sans\",sans-serif;font-weight:700;color:#0f172a;letter-spacing:1px'>PROJECTS</span></div>"},
        {id:uid(),page:0,x:300,y:110,w:454,h:100,z:LAYER_TOP,type:"text",html:"<div style='line-height:1.6;font-family:\"DM Sans\",sans-serif;font-size:12px;color:#334155'><b>Analytics Dashboard</b> <span style='float:right;color:#64748b'>2024</span><br><span style='color:#38bdf8;font-weight:500'>React & D3.js</span><br>Developed a highly customizable data visualization dashboard for real-time tracking of user metrics.</div>"},
        {id:uid(),page:0,x:300,y:240,w:454,h:40,z:LAYER_TOP,type:"text",html:"<div style='border-bottom:2px solid #e2e8f0;padding-bottom:8px'><span style='font-size:18px;font-family:\"DM Sans\",sans-serif;font-weight:700;color:#0f172a;letter-spacing:1px'>EDUCATION</span></div>"},
        {id:uid(),page:0,x:300,y:300,w:454,h:80,z:LAYER_TOP,type:"text",html:"<div style='line-height:1.6;font-family:\"DM Sans\",sans-serif;font-size:12px;color:#334155'><b>Computer Science Degree</b> <span style='float:right;color:#64748b'>2024</span><br><span style='color:#38bdf8;font-weight:500'>State University</span><br>Focus on distributed systems, algorithms, and advanced software architecture.</div>"}
      ]);return;
    }
    if(name==="tech"){
      setBlocks([
        {id:uid(),page:0,x:0,y:0,w:A4_W,h:160,z:LAYER_BG,type:"shape",shapeType:"rect",fillColor:"#0f172a",strokeColor:"transparent",strokeWidth:0,opacity:1,locked:true},
        {id:uid(),page:0,x:60,y:40,w:400,h:50,z:LAYER_TOP,type:"text",html:"<div style='line-height:1'><span style='font-size:42px;font-family:\"DM Sans\",sans-serif;font-weight:700;color:#ffffff'>John Doe</span></div>"},
        {id:uid(),page:0,x:60,y:100,w:400,h:30,z:LAYER_TOP,type:"text",html:"<div><span style='font-size:16px;font-family:\"DM Sans\",sans-serif;font-weight:600;color:#38bdf8;letter-spacing:1px'>SOFTWARE ENGINEER</span></div>"},
        {id:uid(),page:0,x:500,y:60,w:234,h:60,z:LAYER_TOP,type:"text",html:"<div style='text-align:right;line-height:1.6;font-size:11px;font-family:\"DM Sans\",sans-serif;color:#94a3b8'>City, Country<br><span style='color:#e2e8f0'>github.com/johndoe</span></div>"},
        {id:uid(),page:0,x:60,y:200,w:300,h:40,z:LAYER_TOP,type:"text",html:"<div style='border-bottom:1px solid #cbd5e1;padding-bottom:4px'><span style='font-size:14px;font-family:\"DM Sans\",sans-serif;font-weight:700;color:#1e293b'>Technical Stack</span></div>"},
        {id:uid(),page:0,x:60,y:260,w:300,h:140,z:LAYER_TOP,type:"text",html:"<div style='line-height:1.8;font-size:12px;font-family:\"DM Sans\",sans-serif;color:#475569'><b>Languages:</b> JavaScript, Python<br><b>Frameworks:</b> React, Node.js, Express<br><b>Databases:</b> MongoDB, SQL<br><b>DevOps:</b> Docker, CI/CD</div>"},
        {id:uid(),page:0,x:400,y:200,w:334,h:40,z:LAYER_TOP,type:"text",html:"<div style='border-bottom:1px solid #cbd5e1;padding-bottom:4px'><span style='font-size:14px;font-family:\"DM Sans\",sans-serif;font-weight:700;color:#1e293b'>Key Projects</span></div>"},
        {id:uid(),page:0,x:400,y:260,w:334,h:140,z:LAYER_TOP,type:"text",html:"<div style='line-height:1.6;font-size:12px;font-family:\"DM Sans\",sans-serif;color:#475569'><b style='color:#0f172a'>Task Management API</b><br><span style='color:#38bdf8'>2024</span><br>Node.js-based REST API for agile teams.<br><br><b style='color:#0f172a'>Portfolio Generator</b><br><span style='color:#38bdf8'>2023</span><br>Built advanced UI components with React.</div>"}
      ]);return;
    }
    if(name==="creative"){
      setBlocks([
        {id:uid(),page:0,x:0,y:0,w:A4_W,h:A4_H,z:LAYER_BG,type:"shape",shapeType:"rect",fillColor:"#fdf8f5",strokeColor:"transparent",strokeWidth:0,opacity:1,locked:true},
        {id:uid(),page:0,x:100,y:100,w:594,h:60,z:LAYER_TOP,type:"text",html:"<div style='text-align:center;line-height:1.1'><span style='font-size:48px;font-family:Palatino,serif;font-weight:400;color:#431407'>Jane Smith</span></div>"},
        {id:uid(),page:0,x:100,y:170,w:594,h:40,z:LAYER_TOP,type:"text",html:"<div style='text-align:center'><span style='font-size:11px;font-family:\"DM Sans\",sans-serif;color:#9a3412;letter-spacing:2px;text-transform:uppercase'>Designer & Developer</span></div>"},
        {id:uid(),page:0,x:300,y:220,w:194,h:1,z:LAYER_MID,type:"divider",color:"#ea580c"},
        {id:uid(),page:0,x:140,y:260,w:514,h:80,z:LAYER_TOP,type:"text",html:"<div style='text-align:center;line-height:1.8;font-size:13px;font-family:Palatino,serif;color:#78350f'>Bridging the gap between aesthetic design principles and robust software engineering.</div>"},
        {id:uid(),page:0,x:100,y:380,w:280,h:160,z:LAYER_TOP,type:"text",html:"<div style='line-height:1.6'><span style='font-size:14px;font-family:Palatino,serif;font-weight:700;color:#431407'>Projects</span><br><br><span style='font-size:12px;font-family:\"DM Sans\",sans-serif;color:#9a3412;font-weight:600'>Creative Studio Site</span><br><span style='font-size:11px;font-family:\"DM Sans\",sans-serif;color:#a8a29e'>Interactive Web Experience</span></div>"},
        {id:uid(),page:0,x:414,y:380,w:280,h:160,z:LAYER_TOP,type:"text",html:"<div style='line-height:1.6'><span style='font-size:14px;font-family:Palatino,serif;font-weight:700;color:#431407'>Education</span><br><br><span style='font-size:12px;font-family:\"DM Sans\",sans-serif;color:#9a3412;font-weight:600'>Interaction Design</span><br><span style='font-size:11px;font-family:\"DM Sans\",sans-serif;color:#a8a29e'>Design Institute</span></div>"}
      ]);return;
    }
    if(name==="grid"){
      setBlocks([
        {id:uid(),page:0,x:250,y:40,w:1,h:A4_H-80,z:LAYER_MID,type:"divider",color:"#e2e8f0"},
        {id:uid(),page:0,x:40,y:160,w:714,h:1,z:LAYER_MID,type:"divider",color:"#e2e8f0"},
        {id:uid(),page:0,x:40,y:40,w:200,h:100,z:LAYER_TOP,type:"text",html:"<div style='line-height:1.1'><span style='font-size:36px;font-family:\"Helvetica Neue\",sans-serif;font-weight:700;color:#0f172a;letter-spacing:-1px'>John<br>Doe</span></div>"},
        {id:uid(),page:0,x:280,y:40,w:474,h:100,z:LAYER_TOP,type:"text",html:"<div style='line-height:1.6;font-size:13px;font-family:\"DM Sans\",sans-serif;color:#475569'>Professional software developer specializing in modern web technologies. Passionate about creating accessible, user-friendly, and high-performing applications.</div>"},
        {id:uid(),page:0,x:40,y:200,w:200,h:120,z:LAYER_TOP,type:"text",html:"<div style='line-height:1.6;font-size:11px;font-family:\"DM Sans\",sans-serif;color:#64748b'><span style='font-size:10px;font-weight:700;color:#0f172a;text-transform:uppercase'>Contact</span><br><br>City, Country<br>github.com/johndoe</div>"},
        {id:uid(),page:0,x:280,y:200,w:474,h:140,z:LAYER_TOP,type:"text",html:"<div style='line-height:1.6;font-size:12px;font-family:\"DM Sans\",sans-serif;color:#475569'><span style='font-size:10px;font-weight:700;color:#0f172a;text-transform:uppercase'>Key Projects</span><br><br><span style='color:#0f172a;font-weight:600;font-size:14px'>SaaS Dashboard</span><br>React Web App | 2024</div>"}
      ]);return;
    }
    if(name==="terminal"){
      setBlocks([
        {id:uid(),page:0,x:0,y:0,w:A4_W,h:A4_H,z:LAYER_BG,type:"shape",shapeType:"rect",fillColor:"#0a0a0a",strokeColor:"transparent",strokeWidth:0,opacity:1,locked:true},
        {id:uid(),page:0,x:40,y:40,w:714,h:60,z:LAYER_TOP,type:"text",html:"<div style='line-height:1.2'><span style='font-size:36px;font-family:\"Courier New\",monospace;font-weight:700;color:#22c55e'>> John_Doe</span><span style='font-size:36px;color:#22c55e;animation:blink 1s step-end infinite'>_</span></div>"},
        {id:uid(),page:0,x:40,y:100,w:714,h:40,z:LAYER_TOP,type:"text",html:"<div style='line-height:1.2'><span style='font-size:14px;font-family:\"Courier New\",monospace;color:#a3e635'>$ whoami<br>Software Developer | github.com/johndoe</span></div>"},
        {id:uid(),page:0,x:40,y:160,w:714,h:30,z:LAYER_TOP,type:"text",html:"<div style='line-height:1.2'><span style='font-size:14px;font-family:\"Courier New\",monospace;color:#22c55e'>$ cat skills.txt</span></div>"},
        {id:uid(),page:0,x:40,y:190,w:714,h:80,z:LAYER_TOP,type:"text",html:"<div style='line-height:1.6;font-size:13px;font-family:\"Courier New\",monospace;color:#a3e635'>[✓] JavaScript, TypeScript, Python<br>[✓] React, Node.js, Express<br>[✓] Docker, Linux, Git</div>"},
        {id:uid(),page:0,x:40,y:280,w:714,h:30,z:LAYER_TOP,type:"text",html:"<div style='line-height:1.2'><span style='font-size:14px;font-family:\"Courier New\",monospace;color:#22c55e'>$ ./run_experience.sh</span></div>"},
        {id:uid(),page:0,x:40,y:310,w:714,h:120,z:LAYER_TOP,type:"text",html:"<div style='line-height:1.6;font-size:13px;font-family:\"Courier New\",monospace;color:#a3e635'>[2024-Present] Senior Dev @ TechCorp<br>&nbsp;&nbsp;-> Built scalable microservices architecture.<br>&nbsp;&nbsp;-> Optimized database queries by 40%.</div>"}
      ]);return;
    }
    if(name==="corporate"){
      setBlocks([
        {id:uid(),page:0,x:0,y:0,w:A4_W,h:140,z:LAYER_BG,type:"shape",shapeType:"rect",fillColor:"#1e3a8a",strokeColor:"transparent",strokeWidth:0,opacity:1,locked:true},
        {id:uid(),page:0,x:40,y:40,w:400,h:50,z:LAYER_TOP,type:"text",html:"<div style='line-height:1.1'><span style='font-size:42px;font-family:\"Roboto\",sans-serif;font-weight:700;color:#ffffff'>John Doe</span></div>"},
        {id:uid(),page:0,x:40,y:95,w:400,h:30,z:LAYER_TOP,type:"text",html:"<div><span style='font-size:16px;font-family:\"Roboto\",sans-serif;color:#bfdbfe'>Senior Software Engineer</span></div>"},
        {id:uid(),page:0,x:450,y:40,w:300,h:80,z:LAYER_TOP,type:"text",html:"<div style='text-align:right;line-height:1.6;font-size:12px;font-family:\"Roboto\",sans-serif;color:#eff6ff'>City, Country<br>email@example.com<br>+1 234 567 890</div>"},
        {id:uid(),page:0,x:40,y:180,w:714,h:30,z:LAYER_TOP,type:"text",html:"<div style='border-bottom:2px solid #1e3a8a;padding-bottom:4px'><span style='font-size:16px;font-family:\"Roboto\",sans-serif;font-weight:700;color:#1e3a8a;text-transform:uppercase'>Professional Experience</span></div>"},
        {id:uid(),page:0,x:40,y:230,w:714,h:100,z:LAYER_TOP,type:"text",html:"<div style='line-height:1.6;font-family:\"Roboto\",sans-serif;font-size:13px;color:#334155'><b>Lead Developer</b> | Tech Solutions Inc. <span style='float:right;color:#64748b;font-weight:600'>2022 – Present</span><br>Directed a team of engineers to deliver high-performance enterprise applications, focusing on scalable architecture.</div>"},
        {id:uid(),page:0,x:40,y:350,w:714,h:30,z:LAYER_TOP,type:"text",html:"<div style='border-bottom:2px solid #1e3a8a;padding-bottom:4px'><span style='font-size:16px;font-family:\"Roboto\",sans-serif;font-weight:700;color:#1e3a8a;text-transform:uppercase'>Education</span></div>"},
        {id:uid(),page:0,x:40,y:400,w:714,h:60,z:LAYER_TOP,type:"text",html:"<div style='line-height:1.6;font-family:\"Roboto\",sans-serif;font-size:13px;color:#334155'><b>B.S. in Computer Science</b> | State University <span style='float:right;color:#64748b;font-weight:600'>2022</span></div>"}
      ]);return;
    }
    if(name==="minimal"){
      setBlocks([
        {id:uid(),page:0,x:40,y:80,w:714,h:60,z:LAYER_TOP,type:"text",html:"<div style='text-align:center;line-height:1.1'><span style='font-size:38px;font-family:\"Lato\",sans-serif;font-weight:300;color:#334155;letter-spacing:4px'>JOHN DOE</span></div>"},
        {id:uid(),page:0,x:40,y:140,w:714,h:30,z:LAYER_TOP,type:"text",html:"<div style='text-align:center'><span style='font-size:12px;font-family:\"Lato\",sans-serif;color:#64748b;letter-spacing:1px'>SOFTWARE ENGINEER</span></div>"},
        {id:uid(),page:0,x:347,y:180,w:100,h:2,z:LAYER_MID,type:"divider",color:"#cbd5e1"},
        {id:uid(),page:0,x:40,y:210,w:714,h:40,z:LAYER_TOP,type:"text",html:"<div style='text-align:center;font-size:11px;font-family:\"Lato\",sans-serif;color:#94a3b8;line-height:1.6'>City, Country • github.com/johndoe • john.doe@email.com</div>"},
        {id:uid(),page:0,x:100,y:300,w:140,h:40,z:LAYER_TOP,type:"text",html:"<div style='text-align:right'><span style='font-size:10px;font-family:\"Lato\",sans-serif;font-weight:700;color:#334155;text-transform:uppercase;letter-spacing:1px'>Experience</span></div>"},
        {id:uid(),page:0,x:280,y:300,w:414,h:100,z:LAYER_TOP,type:"text",html:"<div style='line-height:1.6;font-family:\"Lato\",sans-serif;font-size:12px;color:#475569'><b>Software Developer</b><br><span style='color:#94a3b8'>Tech Solutions / 2024 - Present</span><br><br>Focused on delivering clean, maintainable code and building intuitive user interfaces.</div>"},
        {id:uid(),page:0,x:100,y:440,w:140,h:40,z:LAYER_TOP,type:"text",html:"<div style='text-align:right'><span style='font-size:10px;font-family:\"Lato\",sans-serif;font-weight:700;color:#334155;text-transform:uppercase;letter-spacing:1px'>Education</span></div>"},
        {id:uid(),page:0,x:280,y:440,w:414,h:60,z:LAYER_TOP,type:"text",html:"<div style='line-height:1.6;font-family:\"Lato\",sans-serif;font-size:12px;color:#475569'><b>Computer Science Degree</b><br><span style='color:#94a3b8'>State University / 2024</span></div>"}
      ]);return;
    }
    if(name==="sidebar"){
      setBlocks([
        {id:uid(),page:0,x:0,y:0,w:260,h:A4_H,z:LAYER_BG,type:"shape",shapeType:"rect",fillColor:"#f8fafc",strokeColor:"transparent",strokeWidth:0,opacity:1,locked:true},
        {id:uid(),page:0,x:260,y:40,w:1,h:A4_H-80,z:LAYER_MID,type:"divider",color:"#e2e8f0"},
        {id:uid(),page:0,x:60,y:60,w:140,h:160,z:LAYER_MID,type:"photo",src:null,shape:"circle",borderColor:"#ffffff"},
        {id:uid(),page:0,x:30,y:240,w:200,h:120,z:LAYER_TOP,type:"text",html:"<div style='line-height:1.6;font-family:\"Open Sans\",sans-serif;font-size:11px;color:#475569'><b style='color:#0f172a'>CONTACT</b><br><br>📍 City, Country<br>📱 +1 234 567 890<br>✉️ johndoe@email.com<br>🌐 github.com/johndoe</div>"},
        {id:uid(),page:0,x:30,y:400,w:200,h:120,z:LAYER_TOP,type:"text",html:"<div style='line-height:1.6;font-family:\"Open Sans\",sans-serif;font-size:11px;color:#475569'><b style='color:#0f172a'>SKILLS</b><br><br>React, Node.js<br>JavaScript, TypeScript<br>UI/UX Design<br>Git, Docker</div>"},
        {id:uid(),page:0,x:300,y:60,w:440,h:60,z:LAYER_TOP,type:"text",html:"<div style='line-height:1.1'><span style='font-size:48px;font-family:\"Open Sans\",sans-serif;font-weight:700;color:#0f172a;letter-spacing:-1px'>John Doe</span></div>"},
        {id:uid(),page:0,x:300,y:120,w:440,h:30,z:LAYER_TOP,type:"text",html:"<div><span style='font-size:16px;font-family:\"Open Sans\",sans-serif;font-weight:600;color:#3b82f6'>Full Stack Developer</span></div>"},
        {id:uid(),page:0,x:300,y:180,w:440,h:80,z:LAYER_TOP,type:"text",html:"<div style='line-height:1.6;font-family:\"Open Sans\",sans-serif;font-size:12px;color:#334155'>Passionate developer with a strong focus on frontend architecture and scalable backend solutions. Proven ability to deliver production-ready applications.</div>"},
        {id:uid(),page:0,x:300,y:280,w:440,h:30,z:LAYER_TOP,type:"text",html:"<div style='border-bottom:2px solid #f1f5f9;padding-bottom:4px'><span style='font-size:14px;font-family:\"Open Sans\",sans-serif;font-weight:700;color:#0f172a'>EXPERIENCE</span></div>"},
        {id:uid(),page:0,x:300,y:330,w:440,h:100,z:LAYER_TOP,type:"text",html:"<div style='line-height:1.6;font-family:\"Open Sans\",sans-serif;font-size:12px;color:#334155'><b>Frontend Engineer</b> | Creative Agency <span style='float:right;color:#64748b'>2024</span><br>Developed interactive UI components and optimized web performance.</div>"}
      ])
    }
if(name==="nordic"){
      setBlocks([
        {id:uid(),page:0,x:40,y:50,w:450,h:70,z:LAYER_TOP,type:"text",html:"<div style='line-height:1.1'><span style='font-size:40px;font-family:\"Helvetica Neue\",sans-serif;font-weight:700;color:#0f172a;letter-spacing:-0.5px'>John Doe</span></div>"},
        {id:uid(),page:0,x:40,y:120,w:450,h:30,z:LAYER_TOP,type:"text",html:"<div><span style='font-size:12px;font-family:\"DM Sans\",sans-serif;color:#64748b;font-weight:600;letter-spacing:1.5px;text-transform:uppercase'>UX Architect & Developer</span></div>"},
        {id:uid(),page:0,x:520,y:55,w:234,h:90,z:LAYER_TOP,type:"text",html:"<div style='text-align:right;line-height:1.6;font-size:11px;font-family:\"DM Sans\",sans-serif;color:#475569'>Copenhagen, Denmark<br>john.doe@nordictech.io<br>+45 20 12 34 56<br>github.com/johndoe</div>"},
        {id:uid(),page:0,x:40,y:170,w:714,h:2,z:LAYER_MID,type:"divider",color:"#f1f5f9"},
        {id:uid(),page:0,x:40,y:200,w:200,h:40,z:LAYER_TOP,type:"text",html:"<div><span style='font-size:12px;font-family:\"Helvetica Neue\",sans-serif;font-weight:700;color:#0f172a;text-transform:uppercase;letter-spacing:1px'>Profile</span></div>"},
        {id:uid(),page:0,x:280,y:200,w:474,h:90,z:LAYER_TOP,type:"text",html:"<div style='line-height:1.6;font-size:12px;font-family:\"DM Sans\",sans-serif;color:#334155'>Minimalist-driven professional focused on building highly accessible user interfaces and clean digital systems. Over 5 years of experience in Scandinavian tech startups, bridging the gap between complex engineering and elegant design.</div>"},
        {id:uid(),page:0,x:40,y:290,w:200,h:40,z:LAYER_TOP,type:"text",html:"<div><span style='font-size:12px;font-family:\"Helvetica Neue\",sans-serif;font-weight:700;color:#0f172a;text-transform:uppercase;letter-spacing:1px'>Expertise</span></div>"},
        {id:uid(),page:0,x:280,y:290,w:474,h:50,z:LAYER_TOP,type:"tags",tagBg:"#f8fafc",tagColor:"#0f172a",tagBorder:"#e2e8f0",tags:["React","TypeScript","Next.js","Tailwind CSS","Figma","Accessibility","Webperf"]},
        {id:uid(),page:0,x:40,y:370,w:200,h:40,z:LAYER_TOP,type:"text",html:"<div><span style='font-size:12px;font-family:\"Helvetica Neue\",sans-serif;font-weight:700;color:#0f172a;text-transform:uppercase;letter-spacing:1px'>Experience</span></div>"},
        {id:uid(),page:0,x:280,y:370,w:474,h:200,z:LAYER_TOP,type:"timeline",lineColor:"#e2e8f0",dotColor:"#0f172a",dateColor:"#64748b",items:[{date:"2023–Present",title:"Senior Frontend Engineer",sub:"Stockholm Tech Lab | Led the migration to Next.js, improving SEO metrics by 40%."},{date:"2021–2023",title:"UI Developer",sub:"Design Studio Copenhagen | Created a unified design system used by 5+ enterprise clients."},{date:"2019–2021",title:"Junior Web Developer",sub:"Nordic Digital | Maintained e-commerce platforms and optimized frontend performance."}]},
        {id:uid(),page:0,x:40,y:750,w:200,h:40,z:LAYER_TOP,type:"text",html:"<div><span style='font-size:12px;font-family:\"Helvetica Neue\",sans-serif;font-weight:700;color:#0f172a;text-transform:uppercase;letter-spacing:1px'>Education</span></div>"},
        {id:uid(),page:0,x:280,y:750,w:474,h:60,z:LAYER_TOP,type:"text",html:"<div style='line-height:1.6;font-size:12px;font-family:\"DM Sans\",sans-serif;color:#334155'><b>M.Sc. Human-Computer Interaction</b><br>Aalborg University (2017 – 2019)</div>"},
        {id:uid(),page:0,x:40,y:850,w:200,h:40,z:LAYER_TOP,type:"text",html:"<div><span style='font-size:12px;font-family:\"Helvetica Neue\",sans-serif;font-weight:700;color:#0f172a;text-transform:uppercase;letter-spacing:1px'>Languages</span></div>"},
        {id:uid(),page:0,x:280,y:850,w:474,h:80,z:LAYER_TOP,type:"languages",color:"#0f172a",lineColor:"#f1f5f9",items:[{lang:"Danish",level:"Native"},{lang:"English",level:"Fluent / C2"},{lang:"Swedish",level:"Professional"}]}
      ]);return;
    }
    
    if(name==="neon"){
      setBlocks([
        {id:uid(),page:0,x:0,y:0,w:A4_W,h:A4_H,z:LAYER_BG,type:"shape",shapeType:"rect",fillColor:"#0b0f19",strokeColor:"transparent",strokeWidth:0,opacity:1,locked:true},
        {id:uid(),page:0,x:40,y:50,w:714,h:60,z:LAYER_TOP,type:"text",html:"<div style='line-height:1.1'><span style='font-size:44px;font-family:\"Montserrat\",sans-serif;font-weight:900;color:#ffffff;letter-spacing:-1px'>ALEX MERCER</span></div>"},
        {id:uid(),page:0,x:40,y:115,w:714,h:30,z:LAYER_TOP,type:"text",html:"<div><span style='font-size:13px;font-family:\"Montserrat\",sans-serif;color:#f43f5e;font-weight:700;letter-spacing:2px;text-transform:uppercase'>Cybersecurity & Devops Specialist</span></div>"},
        {id:uid(),page:0,x:40,y:160,w:714,h:2,z:LAYER_MID,type:"divider",color:"#f43f5e"},
        {id:uid(),page:0,x:40,y:190,w:340,h:140,z:LAYER_TOP,type:"text",html:"<div style='line-height:1.6;font-family:\"Montserrat\",sans-serif;font-size:12px;color:#94a3b8'><b style='color:#ffffff;letter-spacing:1px'>CORE OPERATIONS</b><br><br>• Cloud Security Architecture<br>• Automated CI/CD Pipelines<br>• Penetration Testing & Auditing<br>• Infrastructure as Code (IaC)</div>"},
        {id:uid(),page:0,x:400,y:190,w:354,h:130,z:LAYER_TOP,type:"skillbar",barH:6,showPct:true,fillBarColor:"#f43f5e",trackColor:"#1e293b",labelColor:"#ffffff",skills:[{name:"Linux Security",pct:95},{name:"Docker & K8s",pct:88},{name:"Python Scripting",pct:80},{name:"AWS Cloud",pct:85}]},
        {id:uid(),page:0,x:40,y:340,w:714,h:30,z:LAYER_TOP,type:"text",html:"<div style='border-bottom:1px solid #1e293b;padding-bottom:4px'><span style='font-size:14px;font-family:\"Montserrat\",sans-serif;font-weight:700;color:#f43f5e;letter-spacing:1px'>MISSION LOG (EXPERIENCE)</span></div>"},
        {id:uid(),page:0,x:40,y:390,w:714,h:160,z:LAYER_TOP,type:"timeline",lineColor:"#1e293b",dotColor:"#f43f5e",dateColor:"#94a3b8",items:[{date:"2022–Present",title:"Lead Security Engineer",sub:"CyberTech Global | Designed zero-trust network architectures for enterprise clients."},{date:"2019–2022",title:"DevOps Architect",sub:"FinTech Solutions | Automated deployment pipelines reducing release time by 60%."},{date:"2017–2019",title:"Penetration Tester",sub:"Red Team Security | Conducted vulnerability assessments for Fortune 500 companies."}]},
        {id:uid(),page:0,x:40,y:700,w:340,h:30,z:LAYER_TOP,type:"text",html:"<div style='border-bottom:1px solid #1e293b;padding-bottom:4px'><span style='font-size:14px;font-family:\"Montserrat\",sans-serif;font-weight:700;color:#f43f5e;letter-spacing:1px'>CERTIFICATIONS</span></div>"},
        {id:uid(),page:0,x:40,y:750,w:340,h:80,z:LAYER_TOP,type:"text",html:"<div style='line-height:1.6;font-family:\"Montserrat\",sans-serif;font-size:12px;color:#94a3b8'>[✓] Certified Ethical Hacker (CEH)<br>[✓] AWS Certified Security - Specialty<br>[✓] CompTIA Security+</div>"},
        {id:uid(),page:0,x:400,y:700,w:354,h:30,z:LAYER_TOP,type:"text",html:"<div style='border-bottom:1px solid #1e293b;padding-bottom:4px'><span style='font-size:14px;font-family:\"Montserrat\",sans-serif;font-weight:700;color:#f43f5e;letter-spacing:1px'>CONTACT PROTOCOL</span></div>"},
        {id:uid(),page:0,x:400,y:750,w:354,h:80,z:LAYER_TOP,type:"social",dir:"column",align:"flex-start",color:"#ffffff",items:[{icon:"email",text:"mercer.secure@mail.com",url:"#"},{icon:"github",text:"github.com/alex-mercer",url:"#"},{icon:"location",text:"Neo-Seattle, Sector 4",url:"#"}]}
      ]);return;
    }
    
    if(name==="legal"){
      setBlocks([
        {id:uid(),page:0,x:40,y:40,w:714,h:40,z:LAYER_TOP,type:"text",html:"<div style='text-align:center;line-height:1.1'><span style='font-size:32px;font-family:\"Times New Roman\",serif;font-weight:700;color:#000000;letter-spacing:1px'>HARRISON VANE, ESQ.</span></div>"},
        {id:uid(),page:0,x:40,y:85,w:714,h:30,z:LAYER_TOP,type:"text",html:"<div style='text-align:center;font-family:\"Times New Roman\",serif;font-size:12px;font-style:italic;color:#4b5563'>Corporate Counsel & Legal Consultant</div>"},
        {id:uid(),page:0,x:40,y:120,w:714,h:2,z:LAYER_MID,type:"divider",color:"#000000",dividerStyle:"double"},
        {id:uid(),page:0,x:40,y:140,w:714,h:24,z:LAYER_TOP,type:"text",html:"<div style='text-align:center;font-family:\"Times New Roman\",serif;font-size:11px;letter-spacing:0.5px'>100 Legal Walk, Suite 4B • London, UK • +44 20 7946 0192 • h.vane@legalcounsel.co.uk</div>"},
        {id:uid(),page:0,x:40,y:180,w:714,h:30,z:LAYER_TOP,type:"text",html:"<div style='border-bottom:1px solid #000000;padding-bottom:2px'><span style='font-size:13px;font-family:\"Times New Roman\",serif;font-weight:700;text-transform:uppercase;letter-spacing:1px'>Areas of Practice</span></div>"},
        {id:uid(),page:0,x:40,y:220,w:714,h:80,z:LAYER_TOP,type:"text",html:"<div style='line-height:1.6;font-family:\"Times New Roman\",serif;font-size:12px;color:#111827'><b>Corporate Governance & Compliance:</b> Advised Fortune 500 entities on cross-border structural compliance, regulatory demands, and robust risk mitigation frameworks.<br><b>Intellectual Property Protection:</b> Managed international patent and trademark portfolios for scale-up tech firms, overseeing litigation and successful settlements.</div>"},
        {id:uid(),page:0,x:40,y:310,w:714,h:30,z:LAYER_TOP,type:"text",html:"<div style='border-bottom:1px solid #000000;padding-bottom:2px'><span style='font-size:13px;font-family:\"Times New Roman\",serif;font-weight:700;text-transform:uppercase;letter-spacing:1px'>Professional Experience</span></div>"},
        {id:uid(),page:0,x:40,y:350,w:714,h:140,z:LAYER_TOP,type:"text",html:"<div style='line-height:1.6;font-family:\"Times New Roman\",serif;font-size:12px;color:#111827'><b>Senior Associate</b> — Blackwood & Sterling LLP (2019 – Present)<br>• Spearheaded the M&A legal diligence team for transactions valued over $500M.<br>• Drafted and negotiated complex commercial contracts, software licensing agreements, and joint ventures.<br><br><b>Legal Consultant</b> — InnovateTech Ltd. (2015 – 2019)<br>• Provided comprehensive legal guidance on data privacy laws (GDPR/CCPA) and employment disputes.</div>"},
        {id:uid(),page:0,x:40,y:510,w:340,h:30,z:LAYER_TOP,type:"text",html:"<div style='border-bottom:1px solid #000000;padding-bottom:2px'><span style='font-size:13px;font-family:\"Times New Roman\",serif;font-weight:700;text-transform:uppercase;letter-spacing:1px'>Education</span></div>"},
        {id:uid(),page:0,x:40,y:550,w:340,h:80,z:LAYER_TOP,type:"text",html:"<div style='line-height:1.6;font-family:\"Times New Roman\",serif;font-size:12px;color:#111827'><b>Juris Doctor (J.D.)</b>, Cum Laude<br>Harvard Law School, 2014<br><br><b>B.A. in Political Science</b><br>Yale University, 2011</div>"},
        {id:uid(),page:0,x:400,y:510,w:354,h:30,z:LAYER_TOP,type:"text",html:"<div style='border-bottom:1px solid #000000;padding-bottom:2px'><span style='font-size:13px;font-family:\"Times New Roman\",serif;font-weight:700;text-transform:uppercase;letter-spacing:1px'>Bar Admissions & Languages</span></div>"},
        {id:uid(),page:0,x:400,y:550,w:354,h:80,z:LAYER_TOP,type:"text",html:"<div style='line-height:1.6;font-family:\"Times New Roman\",serif;font-size:12px;color:#111827'><b>Admissions:</b><br>• New York State Bar (2015)<br>• Law Society of England and Wales (2018)<br><br><b>Languages:</b> English (Native), French (Professional)</div>"}
      ]);return;
    }
    
    if(name==="infographic"){
      setBlocks([
        {id:uid(),page:0,x:40,y:40,w:340,h:50,z:LAYER_TOP,type:"text",html:"<div style='line-height:1'><span style='font-size:36px;font-family:\"Raleway\",sans-serif;font-weight:800;color:#1e293b'>Jane Smith</span></div>"},
        {id:uid(),page:0,x:40,y:95,w:340,h:30,z:LAYER_TOP,type:"text",html:"<div><span style='font-size:13px;font-family:\"Raleway\",sans-serif;font-weight:600;color:#0ea5e9'>Data Visualization Expert</span></div>"},
        {id:uid(),page:0,x:40,y:140,w:340,h:180,z:LAYER_TOP,type:"progress",color:"#0ea5e9",strokeW:6,items:[{label:"Tableau",pct:95},{label:"PowerBI",pct:85},{label:"D3.js",pct:75}]},
        {id:uid(),page:0,x:400,y:45,w:354,h:80,z:LAYER_TOP,type:"text",html:"<div style='line-height:1.6;font-size:11.5px;font-family:\"Raleway\",sans-serif;color:#475569'><b>Location:</b> New York, NY<br><b>Email:</b> jane.visuals@email.com<br><b>Portfolio:</b> behance.net/janesmith</div>"},
        {id:uid(),page:0,x:400,y:140,w:354,h:140,z:LAYER_TOP,type:"rating",dotColor:"#0ea5e9",ratings:[{name:"Statistical Analysis",rating:5},{name:"UI/UX Prototyping",rating:4},{name:"Python (Pandas)",rating:4},{name:"Public Speaking",rating:5}]},
        {id:uid(),page:0,x:40,y:330,w:714,h:40,z:LAYER_TOP,type:"text",html:"<div style='border-bottom:2px solid #e2e8f0;padding-bottom:4px'><span style='font-size:16px;font-family:\"Raleway\",sans-serif;font-weight:700;color:#1e293b;text-transform:uppercase'>Career Journey</span></div>"},
        {id:uid(),page:0,x:40,y:390,w:714,h:160,z:LAYER_TOP,type:"timeline",lineColor:"#0ea5e9",dotColor:"#0ea5e9",dateColor:"#64748b",items:[{date:"2021 – Present",title:"Lead Data Analyst",sub:"DataCorp Inc. | Built interactive executive dashboards reducing reporting time by 50%."},{date:"2018 – 2021",title:"Business Intelligence Specialist",sub:"Retail Solutions | Analyzed customer trends across 1M+ data points."},{date:"2015 – 2018",title:"B.S. in Data Science",sub:"NYU Stern School of Business"}]},
        {id:uid(),page:0,x:40,y:700,w:340,h:40,z:LAYER_TOP,type:"text",html:"<div style='border-bottom:2px solid #e2e8f0;padding-bottom:4px'><span style='font-size:14px;font-family:\"Raleway\",sans-serif;font-weight:700;color:#1e293b;text-transform:uppercase'>Certifications</span></div>"},
        {id:uid(),page:0,x:40,y:750,w:340,h:100,z:LAYER_TOP,type:"iconrow",items:[{icon:"file",text:"Google Data Analytics Certificate"},{icon:"file",text:"Tableau Desktop Specialist"},{icon:"file",text:"AWS Certified Cloud Practitioner"}]},
        {id:uid(),page:0,x:400,y:700,w:354,h:40,z:LAYER_TOP,type:"text",html:"<div style='border-bottom:2px solid #e2e8f0;padding-bottom:4px'><span style='font-size:14px;font-family:\"Raleway\",sans-serif;font-weight:700;color:#1e293b;text-transform:uppercase'>Interests</span></div>"},
        {id:uid(),page:0,x:400,y:750,w:354,h:80,z:LAYER_TOP,type:"hobbies",bgColor:"#f0f9ff",color:"#0ea5e9",borderColor:"#bae6fd",round:true,items:[{icon:"art",label:"Infographic Art"},{icon:"game",label:"Puzzle Games"},{icon:"web",label:"Tech Blogging"}]}
      ]);return;
    }
    
    if(name==="startup"){
      setBlocks([
        {id:uid(),page:0,x:40,y:40,w:714,h:50,z:LAYER_TOP,type:"text",html:"<div style='line-height:1'><span style='font-size:38px;font-family:\"Inter\",\"Montserrat\",sans-serif;font-weight:800;color:#4f46e5;letter-spacing:-0.5px'>Liam Vance</span></div>"},
        {id:uid(),page:0,x:40,y:95,w:714,h:30,z:LAYER_TOP,type:"text",html:"<div><span style='font-size:14px;font-family:\"Inter\",sans-serif;font-weight:600;color:#1e293b'>Growth Product Manager</span></div>"},
        {id:uid(),page:0,x:40,y:140,w:714,h:60,z:LAYER_TOP,type:"text",html:"<div style='border-left:4px solid #4f46e5;padding-left:16px;font-size:13px;font-family:\"Inter\",sans-serif;color:#475569;line-height:1.6;font-style:italic'>Data-focused PM specialized in viral loops, activation optimization, and scaling SaaS platforms from 0 to 1M+ ARR. Adept at leading cross-functional squads in high-pace agile environments.</div>"},
        {id:uid(),page:0,x:40,y:220,w:714,h:50,z:LAYER_TOP,type:"tags",tagBg:"#f5f3ff",tagColor:"#4f46e5",tagBorder:"#ddd6fe",tags:["A/B Testing","SQL Analytics","Mixpanel","Product Strategy","Scrum","User Research","SEO/SEM"]},
        {id:uid(),page:0,x:40,y:290,w:714,h:30,z:LAYER_TOP,type:"text",html:"<div style='border-bottom:1px solid #e2e8f0;padding-bottom:4px'><span style='font-size:14px;font-family:\"Inter\",sans-serif;font-weight:700;color:#1e293b;text-transform:uppercase'>Experience</span></div>"},
        {id:uid(),page:0,x:40,y:340,w:714,h:120,z:LAYER_TOP,type:"text",html:"<div style='line-height:1.6;font-family:\"Inter\",sans-serif;font-size:12px;color:#475569'><b>Senior Product Manager</b> | HyperScale Inc. <span style='float:right;color:#94a3b8'>2022 – Present</span><br>• Launched a new referral program that drove a 35% increase in user acquisition.<br>• Managed a squad of 8 engineers and 2 designers, maintaining a 2-week sprint cycle.<br><br><b>Growth Marketer</b> | LaunchPad Startup <span style='float:right;color:#94a3b8'>2019 – 2022</span><br>• Optimized onboarding funnels, improving day-1 retention from 22% to 45%.</div>"},
        {id:uid(),page:0,x:40,y:480,w:340,h:30,z:LAYER_TOP,type:"text",html:"<div style='border-bottom:1px solid #e2e8f0;padding-bottom:4px'><span style='font-size:14px;font-family:\"Inter\",sans-serif;font-weight:700;color:#1e293b;text-transform:uppercase'>Education</span></div>"},
        {id:uid(),page:0,x:40,y:530,w:340,h:60,z:LAYER_TOP,type:"text",html:"<div style='line-height:1.6;font-family:\"Inter\",sans-serif;font-size:12px;color:#475569'><b>B.A. in Economics</b><br>University of California, Berkeley<br><span style='color:#94a3b8'>2015 – 2019</span></div>"},
        {id:uid(),page:0,x:400,y:480,w:354,h:30,z:LAYER_TOP,type:"text",html:"<div style='border-bottom:1px solid #e2e8f0;padding-bottom:4px'><span style='font-size:14px;font-family:\"Inter\",sans-serif;font-weight:700;color:#1e293b;text-transform:uppercase'>Connect</span></div>"},
        {id:uid(),page:0,x:400,y:530,w:354,h:60,z:LAYER_TOP,type:"social",dir:"column",align:"flex-start",color:"#4f46e5",items:[{icon:"linkedin",text:"linkedin.com/in/liamvance",url:"#"},{icon:"twitter",text:"@liam_growth",url:"#"},{icon:"email",text:"liam@vancegrowth.com",url:"#"}]}
      ]);return;
    }
    
    if(name==="academic_cv"){
      setBlocks([
        {id:uid(),page:0,x:40,y:40,w:714,h:40,z:LAYER_TOP,type:"text",html:"<div style='text-align:center;line-height:1.1'><span style='font-size:28px;font-family:\"Garamond\",serif;font-weight:700;color:#111827;letter-spacing:0.5px'>Dr. Emily R. Thorne</span></div>"},
        {id:uid(),page:0,x:40,y:85,w:714,h:24,z:LAYER_TOP,type:"text",html:"<div style='text-align:center;font-family:\"Garamond\",serif;font-size:12px;color:#374151'>Department of Biomedical Engineering • Research Institute • emily.thorne@university.edu</div>"},
        {id:uid(),page:0,x:40,y:115,w:714,h:1,z:LAYER_MID,type:"divider",color:"#94a3b8"},
        {id:uid(),page:0,x:40,y:135,w:714,h:30,z:LAYER_TOP,type:"text",html:"<div style='font-family:\"Garamond\",serif;font-size:14px;font-weight:700;color:#111827;text-transform:uppercase;letter-spacing:1px'>Education</div>"},
        {id:uid(),page:0,x:40,y:170,w:714,h:100,z:LAYER_TOP,type:"text",html:"<div style='font-family:\"Garamond\",serif;font-size:13px;line-height:1.6;color:#374151'><b>Ph.D. in Bioengineering</b> — Cambridge University <span style='float:right;font-style:italic'>2021</span><br>Dissertation: <i>\"Neural Interface Optimization Frameworks via Electro-Static Deposition\"</i><br><b>M.Sc. in Materials Science</b> — Imperial College London <span style='float:right;font-style:italic'>2017</span><br><b>B.Sc. in Physics</b> — University College London <span style='float:right;font-style:italic'>2015</span></div>"},
        {id:uid(),page:0,x:40,y:270,w:714,h:30,z:LAYER_TOP,type:"text",html:"<div style='font-family:\"Garamond\",serif;font-size:14px;font-weight:700;color:#111827;text-transform:uppercase;letter-spacing:1px'>Selected Publications</div>"},
        {id:uid(),page:0,x:40,y:305,w:714,h:100,z:LAYER_TOP,type:"text",html:"<div style='font-family:\"Garamond\",serif;font-size:13px;line-height:1.7;color:#374151'>1. Thorne, E. R., & Cooper, A. L. (2023). Novel Bio-compatible Coatings for Neural Implants. <i>Journal of Neuro-Engineering</i>, 14(2), 145-158.<br>2. Thorne, E. R. (2022). High-throughput Electrospinning Parameters. <i>Biomedical Materials Quarterly</i>, 8(4), 312-325.<br>3. Davis, M., Thorne, E. R., & Lin, C. (2020). Statistical modeling of cellular adhesion. <i>Cell Biology Advances</i>, 22(1), 45-60.</div>"},
        {id:uid(),page:0,x:40,y:425,w:714,h:30,z:LAYER_TOP,type:"text",html:"<div style='font-family:\"Garamond\",serif;font-size:14px;font-weight:700;color:#111827;text-transform:uppercase;letter-spacing:1px'>Grants & Fellowships</div>"},
        {id:uid(),page:0,x:40,y:460,w:714,h:80,z:LAYER_TOP,type:"text",html:"<div style='font-family:\"Garamond\",serif;font-size:13px;line-height:1.7;color:#374151'>• <b>National Science Foundation Early Career Award</b> ($450,000) <span style='float:right;font-style:italic'>2023 – 2026</span><br>• <b>Marie Curie Postdoctoral Fellowship</b> ($180,000) <span style='float:right;font-style:italic'>2021 – 2023</span><br>• <b>Cambridge Trust Scholar</b> <span style='float:right;font-style:italic'>2017 – 2021</span></div>"},
        {id:uid(),page:0,x:40,y:560,w:714,h:30,z:LAYER_TOP,type:"text",html:"<div style='font-family:\"Garamond\",serif;font-size:14px;font-weight:700;color:#111827;text-transform:uppercase;letter-spacing:1px'>Teaching Experience</div>"},
        {id:uid(),page:0,x:40,y:595,w:714,h:80,z:LAYER_TOP,type:"text",html:"<div style='font-family:\"Garamond\",serif;font-size:13px;line-height:1.7;color:#374151'><b>Lecturer: Introduction to Biomaterials</b> (BIOE 101)<br>Designed syllabus, delivered weekly lectures for 150+ students, and supervised laboratory practicals. Consistently rated 4.8/5.0 in student evaluations.</div>"}
      ]);return;
    }
    
    if(name==="teal_luxury"){
      setBlocks([
        {id:uid(),page:0,x:40,y:40,w:714,h:4,z:LAYER_MID,type:"divider",color:"#0d9488"},
        {id:uid(),page:0,x:40,y:60,w:450,h:60,z:LAYER_TOP,type:"text",html:"<div style='line-height:1.1'><span style='font-size:38px;font-family:\"Playfair Display\",serif;font-weight:700;color:#111827'>Sophia Sterling</span></div>"},
        {id:uid(),page:0,x:40,y:120,w:450,h:30,z:LAYER_TOP,type:"text",html:"<div><span style='font-size:12px;font-family:\"Source Sans Pro\",sans-serif;color:#0d9488;font-weight:700;letter-spacing:3px;text-transform:uppercase'>Brand Strategy Director</span></div>"},
        {id:uid(),page:0,x:520,y:65,w:234,h:70,z:LAYER_TOP,type:"text",html:"<div style='text-align:right;line-height:1.6;font-size:11px;font-family:\"Source Sans Pro\",sans-serif;color:#4b5563'>Paris, France<br>s.sterling@luxurybrand.com<br>+33 6 12 34 56 78</div>"},
        {id:uid(),page:0,x:40,y:170,w:714,h:1,z:LAYER_MID,type:"divider",color:"#e5e7eb"},
        {id:uid(),page:0,x:40,y:195,w:200,h:40,z:LAYER_TOP,type:"text",html:"<div><span style='font-size:11px;font-family:\"Source Sans Pro\",sans-serif;font-weight:700;color:#0d9488;text-transform:uppercase;letter-spacing:1.5px'>Professional Summary</span></div>"},
        {id:uid(),page:0,x:260,y:195,w:494,h:80,z:LAYER_TOP,type:"text",html:"<div style='line-height:1.7;font-size:13px;font-family:\"Playfair Display\",serif;color:#374151;font-style:italic'>Orchestrating high-end visual identities and market positioning for elite fashion and retail institutions globally. Over a decade of proven luxury sector management, merging heritage with modern digital strategy.</div>"},
        {id:uid(),page:0,x:40,y:295,w:200,h:40,z:LAYER_TOP,type:"text",html:"<div><span style='font-size:11px;font-family:\"Source Sans Pro\",sans-serif;font-weight:700;color:#0d9488;text-transform:uppercase;letter-spacing:1.5px'>Career History</span></div>"},
        {id:uid(),page:0,x:260,y:295,w:494,h:160,z:LAYER_TOP,type:"text",html:"<div style='line-height:1.7;font-size:12px;font-family:\"Source Sans Pro\",sans-serif;color:#374151'><b>Director of Global Strategy</b> | Maison Lumière <span style='float:right;color:#9ca3af'>2020 – Present</span><br>• Directed a global rebranding campaign that increased Gen-Z market penetration by 24%.<br>• Managed a $5M annual marketing budget across EU and Asian markets.<br><br><b>Senior PR Manager</b> | Atelier Belle <span style='float:right;color:#9ca3af'>2015 – 2020</span><br>• Organized exclusive runway events in Milan and Paris, securing features in Vogue and Harper's Bazaar.</div>"},
        {id:uid(),page:0,x:40,y:480,w:200,h:40,z:LAYER_TOP,type:"text",html:"<div><span style='font-size:11px;font-family:\"Source Sans Pro\",sans-serif;font-weight:700;color:#0d9488;text-transform:uppercase;letter-spacing:1.5px'>Education</span></div>"},
        {id:uid(),page:0,x:260,y:480,w:494,h:60,z:LAYER_TOP,type:"text",html:"<div style='line-height:1.7;font-size:12px;font-family:\"Source Sans Pro\",sans-serif;color:#374151'><b>MBA in Luxury Brand Management</b><br>HEC Paris (2013 – 2015)</div>"},
        {id:uid(),page:0,x:40,y:560,w:200,h:40,z:LAYER_TOP,type:"text",html:"<div><span style='font-size:11px;font-family:\"Source Sans Pro\",sans-serif;font-weight:700;color:#0d9488;text-transform:uppercase;letter-spacing:1.5px'>Languages</span></div>"},
        {id:uid(),page:0,x:260,y:560,w:494,h:80,z:LAYER_TOP,type:"languages",color:"#0d9488",lineColor:"#f3f4f6",items:[{lang:"French",level:"Native"},{lang:"English",level:"Fluent"},{lang:"Italian",level:"Conversational"}]}
      ]);return;
    }
    
    if(name==="cyberpunk"){
      setBlocks([
        {id:uid(),page:0,x:0,y:0,w:A4_W,h:A4_H,z:LAYER_BG,type:"shape",shapeType:"rect",fillColor:"#050508",strokeColor:"transparent",strokeWidth:0,opacity:1,locked:true},
        {id:uid(),page:0,x:40,y:40,w:714,h:4,z:LAYER_MID,type:"divider",color:"#06b6d4"},
        {id:uid(),page:0,x:40,y:60,w:500,h:55,z:LAYER_TOP,type:"text",html:"<div style='line-height:1'><span style='font-size:42px;font-family:\"Courier New\",monospace;font-weight:900;color:#06b6d4;letter-spacing:-1px'>NEO_MATRIX</span></div>"},
        {id:uid(),page:0,x:40,y:120,w:500,h:26,z:LAYER_TOP,type:"text",html:"<div><span style='font-size:12px;font-family:\"Courier New\",monospace;color:#f97316;font-weight:700;text-transform:uppercase;letter-spacing:2px'>[ status: full_stack_hacker ]</span></div>"},
        {id:uid(),page:0,x:560,y:65,w:194,h:60,z:LAYER_TOP,type:"text",html:"<div style='text-align:right;line-height:1.5;font-size:11px;font-family:\"Courier New\",monospace;color:#67e8f9'>IP: 192.168.1.42<br>LOC: Tokyo_Net<br>CMD: neo@matrix.org</div>"},
        {id:uid(),page:0,x:40,y:170,w:714,h:1,z:LAYER_MID,type:"divider",color:"#1e293b"},
        {id:uid(),page:0,x:40,y:190,w:340,h:130,z:LAYER_TOP,type:"text",html:"<div style='line-height:1.7;font-family:\"Courier New\",monospace;font-size:12px;color:#67e8f9'><span style='color:#f97316;font-weight:700'>> KERNEL SKILLS</span><br><br>• Rust / WebAssembly [Advanced]<br>• Solidity Smart Contracts<br>• Decentralized Storage (IPFS)<br>• Reverse Engineering</div>"},
        {id:uid(),page:0,x:400,y:190,w:354,h:130,z:LAYER_TOP,type:"tags",tagBg:"#083344",tagColor:"#22d3ee",tagBorder:"#06b6d4",tags:["Rust","Solidity","Go","Web3","Docker","Kubernetes","eBPF","GraphQL"]},
        {id:uid(),page:0,x:40,y:330,w:714,h:30,z:LAYER_TOP,type:"text",html:"<div style='line-height:1.7;font-family:\"Courier New\",monospace;font-size:12px;color:#f97316;font-weight:700'>> EXECUTE ./EXPERIENCE.SH</div>"},
        {id:uid(),page:0,x:40,y:370,w:714,h:140,z:LAYER_TOP,type:"text",html:"<div style='line-height:1.7;font-family:\"Courier New\",monospace;font-size:12px;color:#67e8f9'><b>[2023-CURRENT] Core Protocol Engineer @ DeFi_Nexus</b><br>=> Architected zero-knowledge rollup infrastructure.<br>=> Saved $2M+ in gas fees via contract optimization.<br><br><b>[2020-2023] Backend Weaver @ NeuralCorp</b><br>=> Built high-frequency trading bots in Go.<br>=> Maintained 99.999% uptime during network stress tests.</div>"},
        {id:uid(),page:0,x:40,y:530,w:714,h:30,z:LAYER_TOP,type:"text",html:"<div style='line-height:1.7;font-family:\"Courier New\",monospace;font-size:12px;color:#f97316;font-weight:700'>> BOUNTIES & ACHIEVEMENTS</div>"},
        {id:uid(),page:0,x:40,y:570,w:714,h:80,z:LAYER_TOP,type:"text",html:"<div style='line-height:1.7;font-family:\"Courier New\",monospace;font-size:12px;color:#67e8f9'>• 1st Place - ETHGlobal Tokyo Hackathon (2024)<br>• Discovered critical reentrancy bug in major DEX (Bounty: $50k)<br>• Open-source contributor to Ethereum Core</div>"}
      ]);return;
    }
    
    if(name==="editorial"){
      setBlocks([
        {id:uid(),page:0,x:80,y:60,w:634,h:65,z:LAYER_TOP,type:"text",html:"<div style='text-align:center;line-height:1.1'><span style='font-size:46px;font-family:\"Playfair Display\",serif;font-weight:700;color:#1c1917'>Clara Sterling</span></div>"},
        {id:uid(),page:0,x:80,y:130,w:634,h:24,z:LAYER_TOP,type:"text",html:"<div style='text-align:center'><span style='font-size:11px;font-family:\"Source Sans Pro\",sans-serif;color:#c2410c;font-weight:700;letter-spacing:3px;text-transform:uppercase'>Senior Content Strategist & Editor</span></div>"},
        {id:uid(),page:0,x:347,y:170,w:100,h:2,z:LAYER_MID,type:"divider",color:"#c2410c"},
        {id:uid(),page:0,x:80,y:195,w:634,h:80,z:LAYER_TOP,type:"text",html:"<div style='line-height:1.8;text-align:center;font-size:14px;font-family:\"Playfair Display\",serif;color:#44403c'>Crafting compelling narratives for international lifestyle publications, design houses, and premium digital media outlets. Dedicated to editorial precision, cultural relevance, and audience engagement.</div>"},
        {id:uid(),page:0,x:80,y:300,w:634,h:1,z:LAYER_MID,type:"divider",color:"#e7e5e4"},
        {id:uid(),page:0,x:80,y:330,w:180,h:40,z:LAYER_TOP,type:"text",html:"<div><span style='font-size:12px;font-family:\"Source Sans Pro\",sans-serif;font-weight:700;color:#c2410c;text-transform:uppercase;letter-spacing:1px'>Experience</span></div>"},
        {id:uid(),page:0,x:290,y:320,w:424,h:180,z:LAYER_TOP,type:"text",html:"<div style='line-height:1.6;font-family:\"Source Sans Pro\",sans-serif;font-size:13px;color:#57534e'><b>Chief Editor</b> — The Horizon Magazine <span style='float:right;color:#a8a29e'>2022–Present</span><br>Supervised a monthly print circulation of 50k copies and coordinated overseas editorial bureaus. Increased digital readership by 40% through targeted SEO strategies.<br><br><b>Features Writer</b> — City Life Press <span style='float:right;color:#a8a29e'>2018–2022</span><br>Authored over 100 long-form articles on urban culture and architecture.</div>"},
        {id:uid(),page:0,x:80,y:490,w:180,h:40,z:LAYER_TOP,type:"text",html:"<div><span style='font-size:12px;font-family:\"Source Sans Pro\",sans-serif;font-weight:700;color:#c2410c;text-transform:uppercase;letter-spacing:1px'>Education</span></div>"},
        {id:uid(),page:0,x:290,y:490,w:424,h:60,z:LAYER_TOP,type:"text",html:"<div style='line-height:1.6;font-family:\"Source Sans Pro\",sans-serif;font-size:13px;color:#57534e'><b>B.A. in Journalism & Literature</b><br>Columbia University (2014 – 2018)</div>"},
        {id:uid(),page:0,x:80,y:570,w:180,h:40,z:LAYER_TOP,type:"text",html:"<div><span style='font-size:12px;font-family:\"Source Sans Pro\",sans-serif;font-weight:700;color:#c2410c;text-transform:uppercase;letter-spacing:1px'>Awards</span></div>"},
        {id:uid(),page:0,x:290,y:570,w:424,h:60,z:LAYER_TOP,type:"text",html:"<div style='line-height:1.6;font-family:\"Source Sans Pro\",sans-serif;font-size:13px;color:#57534e'>• Excellence in Feature Writing (National Press Club, 2021)<br>• Best Digital Media Campaign (Digiday Awards, 2023)</div>"}
      ]);return;
    }
    
    if(name==="compact_grid"){
      setBlocks([
        {id:uid(),page:0,x:40,y:20,w:230,h:80,z:LAYER_TOP,type:"text",html:"<div style='line-height:1'><span style='font-size:32px;font-family:\"Montserrat\",sans-serif;font-weight:800;color:#0f172a'>MARK CRUISE</span></div>"},
        {id:uid(),page:0,x:40,y:95,w:230,h:24,z:LAYER_TOP,type:"text",html:"<div><span style='font-size:11px;font-family:\"DM Sans\",sans-serif;color:#64748b;font-weight:700;text-transform:uppercase'>Systems Engineer</span></div>"},
        {id:uid(),page:0,x:40,y:130,w:230,h:1,z:LAYER_MID,type:"divider",color:"#cbd5e1"},
        {id:uid(),page:0,x:40,y:145,w:230,h:90,z:LAYER_TOP,type:"text",html:"<div style='line-height:1.6;font-size:11px;font-family:\"DM Sans\",sans-serif;color:#475569'>✉️ m.cruise@sys.net<br>📱 +1 999 123 456<br>🌐 github.com/mcruise<br>📍 Austin, TX</div>"},
        {id:uid(),page:0,x:40,y:250,w:230,h:1,z:LAYER_MID,type:"divider",color:"#cbd5e1"},
        {id:uid(),page:0,x:40,y:265,w:230,h:140,z:LAYER_TOP,type:"skillbar",barH:5,showPct:false,fillBarColor:"#0f172a",trackColor:"#e2e8f0",labelColor:"#334155",skills:[{name:"Go / C++",pct:90},{name:"Kubernetes",pct:85},{name:"Network Routing",pct:80},{name:"Linux Kernel",pct:75}]},
        {id:uid(),page:0,x:40,y:420,w:230,h:1,z:LAYER_MID,type:"divider",color:"#cbd5e1"},
        {id:uid(),page:0,x:40,y:435,w:230,h:100,z:LAYER_TOP,type:"languages",color:"#0f172a",lineColor:"#f1f5f9",items:[{lang:"English",level:"Native"},{lang:"Spanish",level:"Intermediate"}]},
        {id:uid(),page:0,x:290,y:40,w:1,h:A4_H-80,z:LAYER_MID,type:"divider",color:"#e2e8f0"},
        {id:uid(),page:0,x:310,y:40,w:444,h:30,z:LAYER_TOP,type:"text",html:"<div style='border-bottom:2px solid #0f172a;padding-bottom:2px'><span style='font-size:12px;font-family:\"Montserrat\",sans-serif;font-weight:700;text-transform:uppercase;color:#0f172a'>Work History</span></div>"},
        {id:uid(),page:0,x:310,y:85,w:444,h:160,z:LAYER_TOP,type:"timeline",lineColor:"#e2e8f0",dotColor:"#0f172a",dateColor:"#64748b",items:[{date:"2022–2026",title:"Infrastructure Architect",sub:"CloudScale Systems | Engineered high-availability server clusters reducing downtime by 99%."},{date:"2019–2022",title:"Systems Administrator",sub:"Austin Data Core | Managed 500+ physical servers and implemented CI/CD pipelines."}]},
        {id:uid(),page:0,x:310,y:360,w:444,h:30,z:LAYER_TOP,type:"text",html:"<div style='border-bottom:2px solid #0f172a;padding-bottom:2px'><span style='font-size:12px;font-family:\"Montserrat\",sans-serif;font-weight:700;text-transform:uppercase;color:#0f172a'>Education & Certifications</span></div>"},
        {id:uid(),page:0,x:310,y:405,w:444,h:120,z:LAYER_TOP,type:"text",html:"<div style='line-height:1.6;font-size:11px;font-family:\"DM Sans\",sans-serif;color:#475569'><b>B.S. in Computer Engineering</b><br>Texas Tech University (2015 – 2019)<br><br><b>Certifications:</b><br>• Cisco Certified Network Professional (CCNP)<br>• Certified Kubernetes Administrator (CKA)</div>"}
      ]);return;
    }
  },[pushH]);

  // ── Keyboard shortcuts ────────────────────────────────────────────────────
  useEffect(()=>{
    const onKey = e => {
      const active = document.activeElement;
      const editing = active?.isContentEditable||active?.tagName==="INPUT"||active?.tagName==="TEXTAREA"||active?.tagName==="SELECT";

      if(!editing&&["ArrowUp","ArrowDown","ArrowLeft","ArrowRight"].includes(e.key)&&selIds.length){
        e.preventDefault();
        const step=e.shiftKey?GRID:2;
        const dx=e.key==="ArrowLeft"?-step:e.key==="ArrowRight"?step:0;
        const dy=e.key==="ArrowUp"?-step:e.key==="ArrowDown"?step:0;
        if(!e.repeat)pushH();
        const ups=selIds.map(id=>{
          const b=bRef.current.find(x=>x.id===id);if(!b)return null;
          const isShape = b.type === "shape";
          const gY=b.page*(A4_H+PAGE_GAP)+b.y+dy;
          const pg=isShape ? b.page : Math.max(0,Math.floor(gY/(A4_H+PAGE_GAP)));
          
          let newX = b.x + dx;
          let newY = isShape ? b.y + dy : gY - pg*(A4_H+PAGE_GAP);
          
          if(!isShape){
             newX = CL(newX,0,A4_W-b.w);
             newY = CL(newY,0,A4_H-b.h);
          }
          return{id,x:newX,y:newY,page:pg};
        }).filter(Boolean);
        onUpdate(ups,true,false);return;
      }
      if(editing)return;

      if((e.key==="Delete"||e.key==="Backspace")&&selIds.length){e.preventDefault();onDelete(selIds);return;}
      if(e.key==="Escape"){setSelIds([]);return;}

      if(e.ctrlKey||e.metaKey){
        if(e.code==="KeyA"){e.preventDefault();setSelIds(bRef.current.map(b=>b.id));}
        if(e.code==="KeyD"){e.preventDefault();if(!selIds.length)return;pushH();
          const copies=bRef.current.filter(b=>selIds.includes(b.id)).map(b=>({...b,id:uid(),x:b.type==="shape"?b.x+GRID:CL(b.x+GRID,0,A4_W-b.w),y:b.y+GRID,_add:true}));
          setBlocks(p=>[...p,...copies]);setSelIds(copies.map(c=>c.id));}
        if(e.code==="KeyZ"&&!e.shiftKey){e.preventDefault();handleUndo();}
        if(e.code==="KeyY"||(e.code==="KeyZ"&&e.shiftKey)){e.preventDefault();handleRedo();}
        if(e.code==="KeyS"){e.preventDefault();
          const data=JSON.stringify(bRef.current);
          const a=document.createElement('a');
          a.href='data:application/json,'+encodeURIComponent(data);
          a.download='resume-backup.json';a.click();}
      }
    };
    window.addEventListener("keydown",onKey);
    return()=>window.removeEventListener("keydown",onKey);
  },[selIds,pushH,onUpdate,onDelete,handleUndo,handleRedo]);

  const exportPDF = ()=>{setSelIds([]);setTimeout(()=>window.print(),100);};

  // Save/load JSON
  const saveJSON = () => {
    const data = JSON.stringify(blocks, null, 2);
    const a = document.createElement('a');
    a.href='data:application/json,'+encodeURIComponent(data);
    a.download='resume-backup.json';a.click();
  };

  const copyJSON = () => {
    const data = JSON.stringify(blocks, null, 2);
    navigator.clipboard.writeText(data).then(() => alert("Configuration successfully copied to clipboard!"));
  };

  const loadJSON = (e) => {
    const f = e.target.files[0];if(!f)return;
    const r = new FileReader();
    r.onload = ev => {
      try { const d=JSON.parse(ev.target.result);pushH();setBlocks(d);setSelIds([]); }
      catch(err){ alert("Invalid file"); }
    };
    r.readAsText(f);
    e.target.value='';
  };

  const TabBtn=({id,label})=>(
    <button onClick={()=>setTab(id)} style={{flex:1,padding:"6px 0",fontSize:10,fontWeight:600,
      background:tab===id?"#eff6ff":"transparent",color:tab===id?"#3b82f6":"#94a3b8",
      border:"none",cursor:"pointer",borderBottom:tab===id?"2px solid #3b82f6":"2px solid transparent",whiteSpace:"nowrap"}}>
      {label}
    </button>
  );

  // Filter presets by search
  const filteredPresets = useMemo(()=>{
    if(!blockSearch)return PRESETS;
    return PRESETS.filter(p=>p.label.toLowerCase().includes(blockSearch.toLowerCase())||p.group.toLowerCase().includes(blockSearch.toLowerCase()));
  },[blockSearch]);

  const filteredGroups = useMemo(()=>{
    const gs = {};
    filteredPresets.forEach(p=>{ if(!gs[p.group])gs[p.group]=[]; gs[p.group].push(p); });
    return gs;
  },[filteredPresets]);

  return (
    <div className="app-wrapper" style={{display:"flex",height:"100vh",width:"100vw",overflow:"hidden",
      fontFamily:"'DM Sans','Helvetica Neue',sans-serif",
      background:"linear-gradient(135deg,#eef0f4 0%,#e2e8f2 100%)"}}>

      {/* Кнопка відкриття меню (тільки для мобільних) */}
      {isMobile && (
        <button
          className="no-print"
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          style={{
            position: 'fixed', bottom: 20, right: 20, zIndex: 4000,
            width: 50, height: 50, borderRadius: 25, background: '#3b82f6',
            color: 'white', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            fontSize: 24, display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}
        >
          {isSidebarOpen ? '✕' : '☰'}
        </button>
      )}

      <aside className={`no-print sidebar ${isSidebarOpen ? 'open' : ''}`} style={{
        width: isMobile ? '100%' : 236,
        flexShrink: 0,
        height: isMobile ? (isSidebarOpen ? '45vh' : '0') : '100%',
        position: isMobile ? 'fixed' : 'relative',
        bottom: 0, left: 0,
        background: "rgba(255,255,255,0.98)",
        backdropFilter: "blur(20px)",
        borderRight: isMobile ? "none" : "1px solid #f1f5f9",
        borderTop: isMobile ? "2px solid #e2e8f0" : "none",
        display: "flex", flexDirection: "column",
        boxShadow: "0 -8px 32px rgba(0,0,0,0.08)",
        zIndex: 3000,
        transition: 'height 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        overflow: 'hidden',
        borderTopLeftRadius: isMobile ? 16 : 0,
        borderTopRightRadius: isMobile ? 16 : 0
      }}>

        {/* Новий елемент: ручка-індикатор для мобільних (Pill) */}
        {isMobile && (
          <div style={{
            width: '40px', height: '5px', background: '#cbd5e1',
            borderRadius: '2.5px', margin: '10px auto 4px', flexShrink: 0
          }} />
        )}

        <div style={{padding: isMobile ? "4px 16px 10px" : "14px 16px 10px", borderBottom:"1px solid #f1f5f9", flexShrink:0}}>
          <div style={{display:"flex", alignItems:"center", gap:10}}>
            <div style={{width:32, height:32, borderRadius:10, background:"linear-gradient(135deg,#3b82f6,#6366f1)", display:"flex", alignItems:"center", justifyContent:"center", color:"white", fontSize:12, fontWeight:700}}>CV</div>
            <div>
              <div style={{fontSize:13, fontWeight:700, color:"#1e293b", letterSpacing:"-.3px"}}>Resume Builder</div>
              <div style={{fontSize:9, color:"#94a3b8"}}>Pro · Free-form canvas</div>
            </div>
          </div>
        </div>

        <div style={{display:"flex", borderBottom:"1px solid #f1f5f9", flexShrink:0, overflowX:"auto"}}>
          <TabBtn id="blocks"    label="Blocks"/>
          <TabBtn id="shapes"    label="Shapes"/>
          <TabBtn id="layers"    label="Layers"/>
          <TabBtn id="templates" label="Theme"/>
        </div>

        {/* Оновлена зона контенту з ідеальним скролом */}
        <div style={{
          flex: 1, 
          overflowY: "auto", 
          padding: isMobile ? "8px 12px 80px" : "4px 10px 8px", 
          WebkitOverflowScrolling: "touch"
        }}>
          {tab==="blocks" && <>
            <div style={{padding:"6px 0 4px"}}>
              <input value={blockSearch} onChange={e=>setBlockSearch(e.target.value)}
                placeholder="Search blocks…"
                style={{width:"100%",padding:"5px 10px",borderRadius:6,border:"1px solid #e2e8f0",fontSize:11,color:"#334155",background:"#f8fafc",boxSizing:"border-box",outline:"none"}}/>
            </div>
            {Object.entries(filteredGroups).map(([grp,presets])=>(
              <div key={grp}>
                <div onClick={()=>setExpandedGroups(s=>({...s,[grp]:!s[grp]}))}
                  style={{display:"flex",alignItems:"center",justifyContent:"space-between",cursor:"pointer",padding:"4px 2px 2px"}}>
                  <SL>{grp}</SL>
                  <span style={{fontSize:10,color:"#94a3b8",paddingRight:4}}>{expandedGroups[grp]?"▾":"▸"}</span>
                </div>
                {expandedGroups[grp] && presets.map(p=><SBtn key={p.label} icon={p.icon} label={p.label} onClick={()=>addBlock(p)}/>)}
              </div>
            ))}
            {Object.keys(filteredGroups).length===0&&<div style={{fontSize:11,color:"#94a3b8",padding:"8px 4px"}}>No blocks match "{blockSearch}"</div>}
            <SL>Pages</SL>
            <SBtn icon="+" label="Add Page"    onClick={()=>setExtraPages(c=>c+1)} dashed/>
            <SBtn icon="−" label="Remove Page" onClick={()=>setExtraPages(c=>Math.max(0,c-1))} dashed/>
          </>}

          {tab==="shapes" && <>
            <SL>Shapes</SL>
            <div style={{fontSize:9,color:"#94a3b8",padding:"0 4px 8px",lineHeight:1.6}}>Shapes sit on the <b>Background layer</b> and never push text blocks.</div>
            {SHAPE_TYPES.map(s=><SBtn key={s.id} icon={s.icon} label={s.label} onClick={()=>addShape(s.id)}/>)}
          </>}

          {tab==="layers" && (
            <LayersPanel blocks={blocks} selectedIds={selIds} onSelect={onSelect} onUpdate={onUpdate} onDelete={onDelete}/>
          )}

          {tab==="templates" && <>
            <SL>Quick Templates</SL>
            {[
              {label:"Harvard",  sub:"Traditional strict academic",     n:"harvard"},
              {label:"Oxford",   sub:"Elegant serif CV",                n:"oxford"},
              {label:"Executive",sub:"Premium two-column layout",       n:"executive"},
              {label:"Tech Innovator",sub:"Dark header, modern IT focus",n:"tech"},
              {label:"Creative Canvas",sub:"Warm tones, artistic layout",n:"creative"},
              {label:"Modern Grid",sub:"Structured UI design approach", n:"grid"},
              {label:"Terminal", sub:"Hacker/Coder dark theme",         n:"terminal"},
              {label:"Corporate",sub:"Classic blue header, structured", n:"corporate"},
              {label:"Minimalist",sub:"Clean, elegant, lots of whitespace", n:"minimal"},
              {label:"Sidebar",  sub:"Two-column layout with photo",    n:"sidebar"},
              {label:"Nordic Clean",  sub:"Minimalist Scandinavian style",  n:"nordic"},
              {label:"Neon Creative", sub:"Dark theme with energetic rose", n:"neon"},
              {label:"Classic Legal",  sub:"Double lines traditional serif", n:"legal"},
              {label:"Infographic",    sub:"Visual charts & data blocks",    n:"infographic"},
              {label:"Trendy Startup", sub:"Modern badge cloud, active loop",n:"startup"},
              {label:"Academic Research",sub:"Strict bibliography & long text",n:"academic_cv"},
              {label:"Elegant Teal",   sub:"Luxury layout with premium teal", n:"teal_luxury"},
              {label:"Cyberpunk Tech", sub:"Dark cyber layout, cyan coding", n:"cyberpunk"},
              {label:"Warm Editorial", sub:"Literary Playfair display tones",  n:"editorial"},
              {label:"Compact Grid",   sub:"Densely packed highly structured",n:"compact_grid"},
            ].map(t=>(
              <button key={t.n} onClick={()=>applyTemplate(t.n)}
                style={{width:"100%",padding:"10px 12px",borderRadius:8,border:"1px solid #e2e8f0",background:"white",cursor:"pointer",textAlign:"left",marginBottom:6,transition:"all .12s"}}
                onMouseEnter={e=>{e.currentTarget.style.borderColor="#3b82f6";e.currentTarget.style.background="#eff6ff";}}
                onMouseLeave={e=>{e.currentTarget.style.borderColor="#e2e8f0";e.currentTarget.style.background="white";}}>
                <div style={{fontSize:11,fontWeight:700,color:"#1e293b"}}>{t.label}</div>
                <div style={{fontSize:9,color:"#94a3b8",marginTop:2}}>{t.sub}</div>
              </button>
            ))}
          </>}
        </div>

        <div style={{padding:"10px 14px 10px",borderTop:"1px solid #f1f5f9",flexShrink:0}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:4}}>
            <span style={{fontSize:9,fontWeight:700,textTransform:"uppercase",letterSpacing:".1em",color:"#cbd5e1"}}>Zoom & Grid</span>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:6}}>
            <button onClick={()=>setScale(s=>Math.max(0.3,+(s-.1).toFixed(1)))} style={ZB}>−</button>
            <div style={{flex:1,textAlign:"center",fontSize:11,fontWeight:600,color:"#475569"}}>{Math.round(scale*100)}%</div>
            <button onClick={()=>setScale(s=>Math.min(1.5,+(s+.1).toFixed(1)))} style={ZB}>+</button>
          </div>
          <input type="range" min={30} max={150} step={5} value={Math.round(scale*100)} onChange={e=>setScale(e.target.value/100)} style={{width:"100%",accentColor:"#3b82f6", marginBottom:8}}/>
          
          <div style={{display:"flex", gap: 12}}>
            <label style={{display:"flex",alignItems:"center",gap:4,cursor:"pointer",fontSize:10,color:"#64748b"}}>
              <input type="checkbox" checked={showGrid} onChange={e=>setShowGrid(e.target.checked)} style={{accentColor:"#3b82f6"}}/>
              Show Grid
            </label>
            <label style={{display:"flex",alignItems:"center",gap:4,cursor:"pointer",fontSize:10,color:"#64748b"}} title="Snap movement to 20px grid">
              <input type="checkbox" checked={snapGrid} onChange={e=>{_snapToGrid=e.target.checked;setSnapGrid(e.target.checked);}} style={{accentColor:"#3b82f6"}}/>
              Snap
            </label>
          </div>
        </div>

        <div style={{padding:"0 10px 14px",flexShrink:0,display:"flex",flexDirection:"column",gap:4}}>
          <SBtn icon="📄" label="Export PDF" onClick={exportPDF} danger/>
          <SBtn icon="💾" label="Save JSON backup" onClick={saveJSON}/>
          <SBtn icon="📋" label="Copy JSON" onClick={copyJSON}/>
          <label style={{width:"100%",display:"flex",alignItems:"center",gap:8,padding:"6px 8px",borderRadius:6,border:"none",background:"transparent",cursor:"pointer",color:"#475569",fontSize:11,fontWeight:500,textAlign:"left"}}
            onMouseEnter={e=>{e.currentTarget.style.background="#eff6ff";e.currentTarget.style.color="#3b82f6";}}
            onMouseLeave={e=>{e.currentTarget.style.background="transparent";e.currentTarget.style.color="#475569";}}>
            <span style={{width:22,height:22,borderRadius:5,background:"#f1f5f9",display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,color:"#64748b",flexShrink:0}}>📂</span>
            Load JSON backup
            <input type="file" accept=".json" style={{display:"none"}} onChange={loadJSON}/>
          </label>
        </div>
      </aside>

      <div style={{flex:1,height:"100%",display:"flex",flexDirection:"column",overflow:"hidden"}}>

        <div className="no-print toolbar-wrapper" style={{
          flexShrink:0,
          height:TOOLBAR_HEIGHT+16,
          minHeight:TOOLBAR_HEIGHT+16,
          maxHeight:TOOLBAR_HEIGHT+16,
          background:"rgba(255,255,255,0.97)",
          backdropFilter:"blur(16px)",
          borderBottom:"1px solid #f1f5f9",
          display:"flex",
          alignItems:"center",
          padding:"0 16px",
          gap:8,
          zIndex:2500,
          boxShadow:"0 2px 12px rgba(0,0,0,0.04)",
          overflowX: "auto",
          overflowY: "visible",
          WebkitOverflowScrolling: "touch"
        }}>
          <div style={{flex:1,overflow:"visible",display:"flex",alignItems:"center"}}>
            <Toolbar
              block={primary}
              allBlocks={blocks.map(b=>({...b,_sel:selIds.includes(b.id)}))}
              onUpdate={(ups,mode)=>{
                if(ups[0]?._add){pushH();const{_add,...nb}=ups[0];setBlocks(p=>[...p,nb]);setSelIds([nb.id]);return;}
                onUpdate(ups,false,false);
              }}
              onDelete={onDelete}
              selectedCount={selIds.length}
            />
          </div>
          <div style={{display:"flex",gap:4,flexShrink:0}}>
            <button onClick={handleUndo} disabled={history.length===0}
              title="Undo (Ctrl+Z)"
              style={{padding:"5px 10px",background:"white",color:history.length?"#475569":"#cbd5e1",border:"1px solid #e2e8f0",borderRadius:6,fontSize:11,fontWeight:600,cursor:history.length?"pointer":"default"}}>
              ↩ Undo
            </button>
            <button onClick={handleRedo} disabled={future.length===0}
              title="Redo (Ctrl+Y)"
              style={{padding:"5px 10px",background:"white",color:future.length?"#475569":"#cbd5e1",border:"1px solid #e2e8f0",borderRadius:6,fontSize:11,fontWeight:600,cursor:future.length?"pointer":"default"}}>
              ↪ Redo
            </button>
            <div style={{width:1,height:24,background:"#e2e8f0",margin:"0 4px"}}/>
            <button onClick={()=>{pushH();setBlocks(makeDefaults());setSelIds([]);setExtraPages(0);}}
              style={{padding:"5px 12px",background:"white",color:"#ef4444",border:"1px solid #fee2e2",borderRadius:6,fontSize:11,fontWeight:600,cursor:"pointer"}}>
              Clear All
            </button>
          </div>
        </div>

        <div className="scroll-wrapper" style={{flex:1,overflow:"auto",scrollbarGutter:"stable"}}
          onMouseDown={e=>{if(e.target===e.currentTarget)setTimeout(()=>setSelIds([]),0);}}
          onTouchStart={e=>{if(e.target===e.currentTarget)setTimeout(()=>setSelIds([]),0);}}>
          <div className="print-area" style={{display:"flex",flexDirection:"column",alignItems:"center",padding:"48px 40px",
            transform:`scale(${scale})`,transformOrigin:"top center",
            minHeight:`${(A4_H*pageCount+PAGE_GAP*(pageCount-1))*scale+200}px`}}
            onMouseDown={e=>{if(e.target===e.currentTarget)setTimeout(()=>setSelIds([]),0);}}
            onTouchStart={e=>{if(e.target===e.currentTarget)setTimeout(()=>setSelIds([]),0);}}>
            <div ref={pagesRef} className="print-pages-container" style={{display:"flex",flexDirection:"column",gap:PAGE_GAP}}>
              {Array.from({length:pageCount},(_,pi)=>(
                <div key={pi} style={{position:"relative"}}>
                  {pi>0&&(
                    <div className="no-print" style={{position:"absolute",top:-28,left:0,right:0,display:"flex",alignItems:"center",gap:10}}>
                      <div style={{flex:1,height:1,background:"rgba(147,197,253,.5)"}}/>
                      <span style={{fontSize:9,color:"#93c5fd",fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",padding:"2px 8px",background:"rgba(239,246,255,.9)",border:"1px solid #bfdbfe",borderRadius:99}}>Page {pi+1}</span>
                      <div style={{flex:1,height:1,background:"rgba(147,197,253,.5)"}}/>
                    </div>
                  )}
                  <Page pageIdx={pi} allBlocks={blocks} selectedIds={selIds}
                    onSelect={onSelect} onUpdate={onUpdate} onDelete={onDelete}
                    setGuides={setGuides} guides={guides} showGrid={showGrid} pushH={pushH}/>
                </div>
              ))}
            </div>
          </div>

          <div style={{height: 40}}></div>
        </div>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,wght@0,400;0,500;0,600;0,700;1,400&display=swap');
        #root{max-width:none!important;margin:0!important;padding:0!important;text-align:left!important;width:100vw;height:100vh}
        *{box-sizing:border-box;margin:0}
        ::-webkit-scrollbar{width:6px;height:6px}
        ::-webkit-scrollbar-track{background:transparent}
        ::-webkit-scrollbar-thumb{background:#cbd5e1;border-radius:999px}
        [contenteditable]:focus{outline:none}
        @media print{
          @page{size:210mm 297mm;margin:0}
          html,body,#root,.app-wrapper,.scroll-wrapper,.print-area{width:100%!important;height:auto!important;margin:0!important;padding:0!important;background:#ffffff!important;overflow:visible!important;transform:none!important}
          *{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important;box-shadow:none!important}
          .no-print,[data-handle],.page-number{display:none!important}
          .print-pages-container{gap:0!important;display:block!important}
          .cv-page{width:210mm!important;height:297mm!important;box-shadow:none!important;border-radius:0!important;background-image:none!important;page-break-after:always;margin:0!important;border:none!important;outline:none!important;position:relative!important;left:0!important;top:0!important;overflow:hidden!important}
        }
        @media (max-width: 768px) {
          .app-wrapper {
            flex-direction: column !important;
          }
          .print-area {
            padding: 20px 10px !important;
          }
          .toolbar-wrapper::-webkit-scrollbar {
            height: 4px;
          }
          button:active {
            background-color: #f1f5f9 !important;
          }
        }
      `}</style>
    </div>
  );
}

const ZB = {width:26,height:26,borderRadius:6,border:"1px solid #e2e8f0",background:"#f8fafc",cursor:"pointer",fontSize:14,color:"#64748b",display:"flex",alignItems:"center",justifyContent:"center"};
const HANDLES = [
  {dir:"nw",cur:"nw-resize",s:{top:-5,left:-5}},
  {dir:"n",cur:"n-resize",s:{top:-5,left:"50%",transform:"translateX(-50%)"}},
  {dir:"ne",cur:"ne-resize",s:{top:-5,right:-5}},
  {dir:"e",cur:"e-resize",s:{top:"50%",right:-5,transform:"translateY(-50%)"}},
  {dir:"se",cur:"se-resize",s:{bottom:-5,right:-5}},
  {dir:"s",cur:"s-resize",s:{bottom:-5,left:"50%",transform:"translateX(-50%)"}},
  {dir:"sw",cur:"sw-resize",s:{bottom:-5,left:-5}},
  {dir:"w",cur:"w-resize",s:{top:"50%",left:-5,transform:"translateY(-50%)"}}
];