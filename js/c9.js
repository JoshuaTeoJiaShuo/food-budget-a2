import { mountChart, loadCSV, applyTextSize, setTextCues } from "./chart-utils.js";
export async function initialiseC9() {
  const container=document.getElementById("chart-9");if(!container)return null;
  const rows=await loadCSV("data/food-price-quarterly.csv");
  const names=["Meals out and take away foods","Bread and cereal products","Meat and seafoods","Dairy and related products","Fruit and vegetables","Non-alcoholic beverages","Food products n.e.c."];
  const short=["Meals out","Bread & cereals","Meat & seafood","Dairy","Fruit & vegetables","Drinks","Other food"];
  rows.forEach(r=>{r.category=r.category||r["\ufeffcategory"];if(typeof r.quarter!=="string")r.quarter=new Date(r.quarter).toISOString().slice(0,7);r.date=Date.UTC(Number(r.quarter.slice(0,4)),Number(r.quarter.slice(5))-1,1);r.short_category=short[names.indexOf(r.category)];});
  const quarters=[...new Set(rows.map(r=>r.quarter))].sort();const stamp=q=>Date.UTC(Number(q.slice(0,4)),Number(q.slice(5))-1,1);
  const baseline=new Map(rows.filter(r=>r.quarter===quarters[0]).map(r=>[r.category,Number(r.index)]));rows.forEach(r=>r.rebased=100*Number(r.index)/baseline.get(r.category));
  const slider=document.getElementById("c9-quarter");slider.max=quarters.length-1;let controller;
  function update() {
    const q=quarters[Number(slider.value)];const label=new Intl.DateTimeFormat("en-AU",{month:"short",year:"numeric",timeZone:"UTC"}).format(stamp(q));document.getElementById("c9-quarter-label").textContent=label;slider.setAttribute("aria-valuetext",label);
    const indexed=controller?.getSignal("priceMode")==="index";const selected=rows.filter(r=>r.quarter===q).sort((a,b)=>indexed?b.rebased-a.rebased:b.annual_change_pct-a.annual_change_pct);const row=selected[0];
    document.getElementById("c9-quarter-summary").textContent=`${label}: ${row.category}, ${Number(indexed?row.rebased-100:row.annual_change_pct).toFixed(1)}% ${indexed?"since September 2016":"year-on-year"}.`;
    const figure=container.closest("figure");figure.querySelector(".figure-scope").textContent=indexed?"September 2016–June 2026 · price change since September 2016":"September 2016–June 2026 · changes from a year earlier";
    setTextCues(figure.querySelector(".chart-finding"), indexed
      ? ["By June 2026, dairy prices were ", { text: "38.6% higher", cue: "cue-rise" }, " than in September 2016, the largest accumulated rise among these seven groups."]
      : ["Fruit and vegetable annual changes ranged from an ", { text: "8.3% fall", cue: "cue-fall" }, " to a ", { text: "16.1% rise", cue: "cue-rise" }, ". Meals-out prices rose in every comparison shown."]);
    document.getElementById("c9-chart-help").textContent=indexed?"100 is the starting price level. The side panel shows how much higher or lower prices were in the selected quarter.":"Gold shows annual rises; blue shows falls. The side panel puts exact percentages on the selected quarter.";
    const last = selected.at(-1);
    const value = r => Number(indexed ? r.rebased - 100 : r.annual_change_pct).toFixed(1);
    figure.querySelector(".takeaway-meaning").textContent = indexed
      ? `${label}: ${row.short_category} had the largest change since September 2016 (${value(row)}%), compared with ${value(last)}% for ${last.short_category.toLowerCase()}.`
      : `${label}: annual changes ran from ${value(last)}% for ${last.short_category.toLowerCase()} to ${value(row)}% for ${row.short_category.toLowerCase()}. The price pressure varied across the shopping basket.`;
    figure.querySelector(".chart-details").hidden=indexed;
    document.getElementById("c9-band-guide").hidden=indexed;
  }
  controller=await mountChart({id:"chart-9",url:"charts/c9-food-price-horizon.vl.json",signals:{selectedQuarter:stamp(quarters.at(-1)),priceMode:"annual"},
    prepare(template,{availableWidth,fontSize}) {
      applyTextSize(template,fontSize);const paired=availableWidth>=850;const indexed=document.querySelector('[data-c9-mode="index"]').getAttribute("aria-pressed")==="true";
      const mainWidth=paired?Math.floor(availableWidth*.56)-25:Math.max(270,availableWidth-64);const barWidth=paired?availableWidth-mainWidth-76:Math.max(275,availableWidth-28);
      const time={field:"date",type:"temporal",scale:{type:"utc",domain:[stamp(quarters[0]),stamp(quarters.at(-1))]},axis:{title:null,format:"%Y",values:["2017-01-01","2019-01-01","2021-01-01","2023-01-01","2025-01-01"],grid:false,labelPadding:8}};

      document.getElementById("c9-column-headings").style.gridTemplateColumns=paired?`${mainWidth+40}px 1fr`:"1fr";
      document.getElementById("c9-column-headings").firstElementChild.textContent=indexed?"Price level · September 2016 = 100":"Price history · gold rise, blue fall";
      document.getElementById("c9-snapshot-heading").textContent=indexed?"Selected quarter · change since 2016 (%)":"Selected quarter · annual change (%)";
      const minimum=Math.min(90,Math.floor(Math.min(...rows.map(r=>r.rebased))/10)*10);
      const maximum=Math.ceil(Math.max(...rows.map(r=>r.rebased))/10)*10;
      const height=indexed?42:28;
      const pairs=names.map((category,i)=>{
        let history;
        if(indexed) {
          history={data:{values:rows.filter(r=>r.category===category)},width:mainWidth,height,
            encoding:{x:{...time,axis:i===names.length-1?time.axis:null},y:{field:"rebased",type:"quantitative",scale:{domain:[minimum,maximum],zero:false,nice:false},axis:{title:null,values:[100,maximum],domain:false,ticks:false,grid:false}}},layer:[
              {data:{values:[{}]},mark:{type:"rule",stroke:"#a5b7a7",strokeDash:[3,3]},encoding:{x:{value:0},x2:{value:mainWidth},y:{datum:100}}},
              {mark:{type:"line",strokeWidth:2,color:"#728a7e"},encoding:{tooltip:[{field:"category",title:"Category"},{field:"quarter",title:"Quarter"},{field:"rebased",type:"quantitative",format:".1f",title:"September 2016 = 100"}]}},
              {transform:[{filter:"datum.date === selectedQuarter"}],mark:{type:"rule",strokeDash:[3,3],color:"#304a40"},encoding:{y:{value:0},y2:{value:height}}},
              {transform:[{filter:"datum.date === selectedQuarter"}],mark:{type:"point",filled:true,color:"#304a40",size:45}},
            ]};
        } else {
          history=structuredClone(template.spec);history.data={values:rows.filter(r=>r.category===category)};history.transform=structuredClone(template.transform);history.width=mainWidth;history.height=height;history.encoding.x={...time,axis:i===names.length-1?time.axis:null};history.layer[0].encoding.color.legend=null;
          history.layer[0].encoding.color.scale.range=["#e0dab6","#b6aa69","#897b3f","#5b5026","#bdd6e2","#83afc4","#4b829d","#28566f"];
          history.layer.push({transform:[{filter:"datum.band === 'rise0' && toNumber(datum.date) === selectedQuarter"}],mark:{type:"rule",color:"#304a40",strokeDash:[3,3],strokeWidth:1.2},encoding:{y:{datum:0},y2:{datum:5}}});
        }
        const snapshot={data:{values:rows.filter(r=>r.category===category)},transform:[{filter:"datum.date === selectedQuarter"},{calculate:"priceMode === 'index' ? datum.rebased-100 : datum.annual_change_pct",as:"change"},{calculate:"(datum.change > 0 ? '+' : '') + format(datum.change,'.1f') + '%'",as:"value_label"}],width:barWidth,height,
          encoding:{x:{field:"change",type:"quantitative",scale:{domain:indexed?[-10,40]:[-10,20],range:[16,barWidth-52],nice:false},axis:i===names.length-1?{title:null,values:indexed?[0,20,40]:[-10,0,10,20],labelExpr:"datum.value+'%'",grid:false,domain:false,ticks:false}:null},y:{value:height/2},color:{condition:{test:"datum.change < 0",value:"#83afc4"},value:"#9a8a4f"},tooltip:[{field:"category",title:"Food group"},{field:"quarter",title:"Quarter"},{field:"annual_change_pct",type:"quantitative",format:"+.1f",title:"Annual change (%)"},{field:"rebased",type:"quantitative",format:".1f",title:"September 2016 = 100"}]},layer:[
            {mark:{type:"bar",orient:"horizontal",size:18,cornerRadiusEnd:3},encoding:{x2:{datum:0}}},
            {data:{values:[{}]},mark:{type:"rule",stroke:"#8fa396",strokeWidth:1},encoding:{x:{datum:0},y:{value:0},y2:{value:height},color:{value:"#8fa396"},tooltip:null}},
            {mark:{type:"text",align:"left",dx:5,fontSize:fontSize-1,fontWeight:"bold"},encoding:{text:{field:"value_label"},color:{value:"#223b36"}}},
          ]};
        return {title:{text:short[i],anchor:"start",fontSize,color:"#223b36",offset:6},...(paired?{hconcat:[history,snapshot]}:{vconcat:[history,snapshot]}),spacing:paired?24:8,resolve:{scale:{x:"independent",y:"independent",color:"independent"}}};
      });
      return {$schema:template.$schema,background:"#fffefa",padding:8,params:[{name:"selectedQuarter",value:stamp(quarters.at(-1))},{name:"priceMode",value:"annual"}],vconcat:pairs,spacing:12,resolve:{scale:{x:"independent",y:"independent",color:"independent"}},config:template.config};
    }
  });
  const options={signal:controller.events};slider.addEventListener("input",()=>{controller.setSignal("selectedQuarter",stamp(quarters[Number(slider.value)]));update();},options);
  document.querySelectorAll("[data-c9-mode]").forEach(button=>button.addEventListener("click",()=>{document.querySelectorAll("[data-c9-mode]").forEach(b=>b.setAttribute("aria-pressed",String(b===button)));void controller.refresh({priceMode:button.dataset.c9Mode});update();},options));update();return controller;
}
