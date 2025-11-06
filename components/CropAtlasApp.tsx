'use client';

function mapCountyToId(f:any){
  const name = f.properties?.COUNTYNAME; // 例如「新北市」
  const table: Record<string,string> = {
    "新北市":"NTP","臺中市":"TXG","高雄市":"KHH","臺北市":"TPE","桃園市":"TYN","新竹縣":"HSC",
    "宜蘭縣":"ILA","花蓮縣":"HUA","臺東縣":"TTT","苗栗縣":"MIA","彰化縣":"CHW","南投縣":"NAN",
    "雲林縣":"YUN","嘉義市":"CYI","嘉義縣":"CYU","臺南市":"TNN","屏東縣":"PIF","澎湖縣":"PGM",
    "金門縣":"KMN","連江縣":"LNN"
  };
  return table[name] || f.properties?.COUNTY_ID || name;
}

import React, { useEffect, useMemo, useRef, useState } from 'react';

type Month = 1|2|3|4|5|6|7|8|9|10|11|12;
type Fert = { stage:string; months:Month[]; ratio?:string };
type CropRec = { regionId:string; crop:string; sowing:Month[]; harvest:Month[]; fertilization:Fert[] };
type Region = { id:string; name:string };

let L: any = null;
function useLeafletReady(){
  const [ok,setOk]=useState(false);
  useEffect(()=>{ (async()=>{
    if (typeof window==='undefined') return;
    const leaflet = await import('leaflet');
    await import('leaflet/dist/leaflet.css');
    L = leaflet.default || leaflet;
    setOk(true);
  })(); },[]);
  return ok;
}

function TimelineRow({title, months, color}:{title:string; months:Month[]; color:'lime'|'amber'|'sky'}){
  const cls = color==='lime'?'bg-lime-100 border-lime-300':color==='amber'?'bg-amber-100 border-amber-300':'bg-sky-100 border-sky-300';
  const labels = ['1','2','3','4','5','6','7','8','9','10','11','12'];
  return (
    <div className="mb-2">
      <div className="text-sm font-medium mb-1">{title}</div>
      <div className="grid grid-cols-12 gap-1">
        {labels.map((lab,i)=>{
          const active = months.includes((i+1) as Month);
          return <div key={lab} className={`h-6 rounded-md text-[10px] flex items-center justify-center border ${active?cls:'bg-white'}`}>{lab}</div>
        })}
      </div>
    </div>
  );
}

export default function CropAtlasApp(){
  const [regions,setRegions]=useState<Region[]>([]);
  const [crops,setCrops]=useState<CropRec[]>([]);
  const [activeRegion,setActiveRegion]=useState<string|null>(null);
  const [month,setMonth]=useState<number|null>(null);
  const [cropFilter,setCropFilter]=useState<string|null>(null);

  useEffect(()=>{ (async()=>{
    const r = await fetch('/data/regions.json').then(r=>r.json());
    const c = await fetch('/data/crops.json').then(r=>r.json());
    setRegions(r); setCrops(c);
  })(); },[]);

  const list = useMemo(()=> {
    return crops.filter(c =>
      (!activeRegion || c.regionId===activeRegion) &&
      (!cropFilter || c.crop===cropFilter) &&
      (!month || c.sowing.includes(month as Month) || c.harvest.includes(month as Month) || c.fertilization?.some(f=>f.months.includes(month as Month)))
    );
  }, [crops, activeRegion, cropFilter, month]);

  const ready = useLeafletReady();
  const mapRef = useRef<any>(null);
  const regionHit = useMemo(()=>{
    const s = new Set<string>();
    regions.forEach(r=>{
      const ok = crops.some(c=> c.regionId===r.id && (!cropFilter || c.crop===cropFilter) && (!month || c.sowing.includes(month as Month) || c.harvest.includes(month as Month) || c.fertilization?.some(f=>f.months.includes(month as Month))));
      if (ok) s.add(r.id);
    });
    return s;
  },[regions,crops,month,cropFilter]);

  useEffect(()=> {
    if (!ready) return;
    if (!mapRef.current){
      const m = L.map('map-root',{ zoomControl:true, attributionControl:false }).setView([23.7, 121], 6.8);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:18}).addTo(m);
      mapRef.current = m;
    }
    const m = mapRef.current as any;

    let layer:any = null;
    fetch('/data/taiwan-counties.geojson').then(r=>r.json()).then((gj)=>{
      if (layer) m.removeLayer(layer);
      layer = L.geoJSON(gj, {
        style: (f:any)=>{
          const id = mapCountyToId(f);
          const hit = regionHit.has(id);
          return { color: hit? '#2563eb':'#cbd5e1', weight: hit? 2:1, fillColor: hit? '#93c5fd':'#e2e8f0', fillOpacity: 0.6 };
        },
onEachFeature: (f:any, lyr:any)=>{
  const id = mapCountyToId(f);
  const name = f.properties?.COUNTYNAME || id;
  lyr.on('click',()=> setActiveRegion(id));
  lyr.on('mouseover',()=> lyr.setStyle({weight:3, color:'#1f2937'}));
  lyr.on('mouseout',()=> lyr.setStyle({weight: regionHit.has(id)?2:1, color: regionHit.has(id)?'#2563eb':'#cbd5e1'}));
  lyr.bindTooltip(name);
}

      }).addTo(m);
    });
    return ()=>{};
  }, [ready, regionHit]);

  const regionName = (id:string)=> regions.find(r=>r.id===id)?.name || id;

  return (
    <div className="min-h-screen">
      <header className="px-4 py-3 border-b flex gap-2 items-center">
        <div className="text-xl font-semibold">台灣作物時序地圖</div>
        <div className="ml-auto flex gap-2">
          <select value={cropFilter||''} onChange={e=>setCropFilter(e.target.value||null)}>
            <option value="">全部作物</option>
            {[...new Set(crops.map(c=>c.crop))].sort().map(c=> <option key={c} value={c}>{c}</option>)}
          </select>
          <div className="flex gap-1">
  {[...Array(12)].map((_,i)=> {
    const m = i+1;
    const active = month===m;
    return (
      <button
        key={m}
        onClick={()=> setMonth(active? null : m)}
        className={`px-2 py-1 rounded-md border text-sm ${active?'bg-black text-white':'bg-white hover:bg-gray-50'}`}>
        {m}
      </button>
    );
  })}
  <button onClick={()=>setMonth(null)} className="ml-1 text-sm underline">清除</button>
</div>

          <button onClick={()=>{setActiveRegion(null); setCropFilter(null); setMonth(null);}}>清除</button>
        </div>
      </header>

      <main className="grid md:grid-cols-2 gap-6 p-4">
        <div>
          <div className="font-semibold mb-2">互動地圖</div>
          <div id="map-root" className="w-full h-[520px] rounded-2xl overflow-hidden border" />
          <div className="text-xs text-gray-500 mt-2">提示：點選縣市可在右側查看該地的作物卡；上方可依「作物」或「月份」過濾。</div>
        </div>

        <div>
          <div className="font-semibold mb-2">{activeRegion? `${regionName(activeRegion)} — 作物資訊` : '請從地圖選擇縣市或使用上方篩選'}</div>
          <div className="space-y-3 max-h-[520px] overflow-auto pr-1">
            {list.map((rec,idx)=> (
              <div key={idx} className="rounded-2xl border p-3 bg-white">
                <div className="font-semibold">{rec.crop}</div>
                <div className="mt-2 space-y-2">
                  <TimelineRow title="播種" months={rec.sowing} color="lime" />
                  {rec.fertilization?.map((f,i)=> <TimelineRow key={i} title={`施肥｜${f.stage}`} months={f.months} color="sky" />)}
                  <TimelineRow title="採收／盛產" months={rec.harvest} color="amber" />
                </div>
              </div>
            ))}
            {list.length===0 && <div className="text-sm text-gray-500">沒有符合條件的作物資料。請更換篩選。</div>}
          </div>
        </div>
      </main>
      <footer className="px-4 py-3 text-xs text-gray-500 border-t">
  資料來源：作物施肥手冊、農糧署統計；更新：{new Date().toISOString().slice(0,10)}
</footer>

    </div>
  );
}
