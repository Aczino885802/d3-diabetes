// ============================================================
// Diabetes Health Indicators — BRFSS 2015
// Lógica principal — lee datos desde CSV con d3.csv()
// ============================================================

// ── Paleta cualitativa (ColorBrewer Set1) ───────────────────
const COLOR = {
  "Sin Diabetes": "#4DAF4A",
  "Prediabetes":  "#FF7F00",
  "Diabetes":     "#E41A1C"
};
const GRUPOS = ["Sin Diabetes", "Prediabetes", "Diabetes"];

const EDAD_LABELS = {
  1:"18-24", 2:"25-29", 3:"30-34", 4:"35-39", 5:"40-44",
  6:"45-49", 7:"50-54", 8:"55-59", 9:"60-64", 10:"65-69",
  11:"70-74", 12:"75-79", 13:"80+"
};

const INCOME_LABELS = {
  1:"<$10k", 2:"$10-15k", 3:"$15-20k", 4:"$20-25k",
  5:"$25-35k", 6:"$35-50k", 7:"$50-75k", 8:">$75k"
};

// ── Variables globales ──────────────────────────────────────
let rawData = [];
let activeGroups = new Set(["Sin Diabetes", "Prediabetes", "Diabetes"]);
let currentTab   = 0;

// ── Tooltip ─────────────────────────────────────────────────
const tip = document.getElementById("tooltip");
function showTip(html, evt) {
  tip.innerHTML  = html;
  tip.style.opacity = 1;
  tip.style.left = (evt.clientX + 14) + "px";
  tip.style.top  = (evt.clientY  - 10) + "px";
}
function hideTip() { tip.style.opacity = 0; }

// ── Carga del CSV ────────────────────────────────────────────
d3.csv("data/diabetes_012_health_indicators_BRFSS2015.csv").then(data => {
  rawData = data.map(d => {
    const row = {};
    for (const k in d) row[k] = isNaN(d[k]) ? d[k] : +d[k];
    row.Diabetes_Label = ["Sin Diabetes","Prediabetes","Diabetes"][row.Diabetes_012];
    return row;
  });

  document.querySelectorAll("#checkboxes input").forEach(cb => {
    cb.addEventListener("change", () => {
      if (cb.checked) activeGroups.add(cb.value);
      else activeGroups.delete(cb.value);
      renderTab(currentTab);
    });
  });

  setTimeout(() => drawAcceso(), 50);
}).catch(err => {
  document.querySelector(".main").innerHTML =
    `<div style="padding:30px;color:#E41A1C;">
      <b>Error cargando el CSV:</b> ${err.message}<br><br>
      Esta app debe ejecutarse desde un servidor (GitHub Pages).<br>
      Localmente, usa un servidor local como <code>Live Server</code> en VS Code.
    </div>`;
});

// ── Navegación ───────────────────────────────────────────────
function showTab(i) {
  currentTab = i;
  document.querySelectorAll(".chart-card").forEach((c, j) =>
    c.classList.toggle("active", i === j));
  document.querySelectorAll("nav button").forEach((b, j) =>
    b.classList.toggle("active", i === j));
  setTimeout(() => renderTab(i), 30);
}

function renderTab(i) {
  if      (i === 0) drawAcceso();
  else if (i === 1) drawBMI();
  else if (i === 2) drawRadar();
  else if (i === 3) drawHeatmapEdad();
  else if (i === 4) drawHeatmapCorr();
}

function getW(svgId) {
  return document.getElementById(svgId).parentElement.clientWidth - 48;
}

function filtered() {
  return rawData.filter(d => activeGroups.has(d.Diabetes_Label));
}

// ── Helpers estadísticos ─────────────────────────────────────
function mean(arr) { return arr.reduce((a, b) => a + b, 0) / arr.length; }
function median(arr) {
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid-1] + sorted[mid]) / 2 : sorted[mid];
}

function setHallazgos(id, html) {
  const el = document.getElementById(id);
  if (el) el.innerHTML = `<span class="titulo-h">Hallazgos</span>${html}`;
}

// ════════════════════════════════════════════════════════════
// VIZ 1: Acceso a salud por ingreso (barras + línea)
// ════════════════════════════════════════════════════════════
function drawAcceso() {
  const data = Object.values(INCOME_LABELS).map((label, idx) => {
    const incomeKey = idx + 1;
    const sub = rawData.filter(d => d.Income === incomeKey);
    return {
      ingreso:   label,
      cobertura: sub.length ? mean(sub.map(d => d.AnyHealthcare)) * 100 : 0,
      noFue:     sub.length ? mean(sub.map(d => d.NoDocbcCost))    * 100 : 0,
      n:         sub.length
    };
  });

  const H = 460, m = { top:30, right:30, bottom:60, left:60 };
  const W = getW("chart-acceso");
  const w = W - m.left - m.right, h = H - m.top - m.bottom;

  const svg = d3.select("#chart-acceso").attr("width", W).attr("height", H);
  svg.selectAll("*").remove();
  const g = svg.append("g").attr("transform", `translate(${m.left},${m.top})`);

  const x = d3.scaleBand().domain(data.map(d => d.ingreso)).range([0, w]).padding(0.35);
  const y = d3.scaleLinear().domain([0, 110]).range([h, 0]);

  // Eje X
  g.append("g").attr("transform", `translate(0,${h})`)
    .call(d3.axisBottom(x).tickSize(0))
    .call(ax => {
      ax.select(".domain").remove();
      ax.selectAll("text").attr("font-size", 11).attr("font-weight", "600").attr("dy", "1em");
    });

  // Eje Y
  g.append("g").call(d3.axisLeft(y).ticks(6).tickFormat(d => d + "%").tickSize(-w))
    .call(ax => {
      ax.select(".domain").remove();
      ax.selectAll("line").attr("stroke", "#e2e8f0");
      ax.selectAll("text").attr("fill", "#718096").attr("font-size", 11);
    });

  // Barras (cobertura)
  g.selectAll(".bar-cob").data(data).join("rect").attr("class", "bar-cob")
    .attr("x", d => x(d.ingreso)).attr("width", x.bandwidth())
    .attr("y", d => y(d.cobertura)).attr("height", d => h - y(d.cobertura))
    .attr("fill", "#4DAF4A").attr("rx", 3)
    .on("mousemove", (evt, d) =>
      showTip(`<b>Ingreso: ${d.ingreso}</b><br>Con seguro: ${d.cobertura.toFixed(1)}%`, evt))
    .on("mouseleave", hideTip);

  // Etiquetas en barras
  g.selectAll(".bar-lbl").data(data).join("text").attr("class", "bar-lbl")
    .attr("x", d => x(d.ingreso) + x.bandwidth()/2)
    .attr("y", d => y(d.cobertura) - 6)
    .attr("text-anchor", "middle")
    .attr("font-size", 10).attr("font-weight", "700").attr("fill", "#2d2d2d")
    .text(d => d.cobertura.toFixed(1) + "%");

  // Línea (no fue al médico)
  const line = d3.line()
    .x(d => x(d.ingreso) + x.bandwidth()/2)
    .y(d => y(d.noFue))
    .curve(d3.curveMonotoneX);

  g.append("path").datum(data)
    .attr("fill", "none").attr("stroke", "#E41A1C").attr("stroke-width", 3)
    .attr("d", line);

  // Puntos en la línea
  g.selectAll(".pt-line").data(data).join("circle").attr("class", "pt-line")
    .attr("cx", d => x(d.ingreso) + x.bandwidth()/2)
    .attr("cy", d => y(d.noFue))
    .attr("r", 6).attr("fill", "#E41A1C")
    .attr("stroke", "white").attr("stroke-width", 2)
    .on("mousemove", (evt, d) =>
      showTip(`<b>Ingreso: ${d.ingreso}</b><br>No fue por costo: ${d.noFue.toFixed(1)}%`, evt))
    .on("mouseleave", hideTip);

  // Leyenda
  const leg = svg.append("g").attr("transform", `translate(${m.left},10)`);
  leg.append("rect").attr("x", 0).attr("y", 0).attr("width", 14).attr("height", 14)
    .attr("fill", "#4DAF4A").attr("rx", 2);
  leg.append("text").attr("x", 20).attr("y", 11)
    .attr("font-size", 12).attr("font-weight", "600").attr("fill", "#2d2d2d")
    .text("Tiene seguro de salud");
  leg.append("line").attr("x1", 195).attr("x2", 215).attr("y1", 7).attr("y2", 7)
    .attr("stroke", "#E41A1C").attr("stroke-width", 3);
  leg.append("circle").attr("cx", 205).attr("cy", 7).attr("r", 5)
    .attr("fill", "#E41A1C").attr("stroke", "white").attr("stroke-width", 2);
  leg.append("text").attr("x", 222).attr("y", 11)
    .attr("font-size", 12).attr("font-weight", "600").attr("fill", "#2d2d2d")
    .text("No fue al médico por costo");

  // Eje X label
  g.append("text")
    .attr("x", w/2).attr("y", h + 50)
    .attr("text-anchor", "middle").attr("font-size", 11).attr("fill", "#718096")
    .text("Nivel de ingreso anual (USD)");

  // Hallazgos
  const cobMin = data[0].cobertura;
  const cobMax = data[data.length-1].cobertura;
  const costMin = data[0].noFue;
  const costMax = data[data.length-1].noFue;
  const cobDiff = cobMax - cobMin;
  const costRatio = costMin / Math.max(costMax, 0.1);
  const prevPre  = mean(rawData.map(d => d.Diabetes_012 === 1 ? 1 : 0)) * 100;
  const prevDiab = mean(rawData.map(d => d.Diabetes_012 === 2 ? 1 : 0)) * 100;

  setHallazgos("hallazgos-acceso", `
    El gráfico muestra dos curvas que se mueven en direcciones opuestas. La cobertura de seguro sube de <b>${cobMin.toFixed(1)}%</b> en el nivel más bajo a <b>${cobMax.toFixed(1)}%</b> en el más alto, una mejora de <b>${cobDiff.toFixed(1)} puntos</b>. Al mismo tiempo, el porcentaje de personas que dejaron de ir al médico por costo cae de <b>${costMin.toFixed(1)}%</b> a <b>${costMax.toFixed(1)}%</b> — es decir, en los niveles más pobres es <b>${costRatio.toFixed(1)} veces más alto</b> que en los niveles más ricos.
    <br><br>
    Lo lógico aquí es preguntarse: si en el nivel de ingreso más bajo el ${cobMin.toFixed(1)}% ya tiene seguro, ¿por qué casi 1 de cada 3 personas (el ${costMin.toFixed(1)}%) no fue al médico por dinero? La respuesta está en que <b>tener seguro no es lo mismo que poder pagar la atención</b>. Los seguros tienen copagos, deducibles y medicamentos no cubiertos. Para alguien que gana menos de $10.000 al año, esos gastos pueden ser una decisión real entre ir al médico o pagar otras necesidades básicas.
    <br><br>
    Esto conecta con algo importante del dataset: la prediabetes solo aparece en <b>${prevPre.toFixed(1)}%</b> de los registros, mientras que la diabetes ya diagnosticada está en <b>${prevDiab.toFixed(1)}%</b>. La prediabetes es una etapa silenciosa que solo se detecta con un examen de sangre — un examen al que la población vulnerable no está llegando. La diabetes en cambio sí aparece más porque cuando da síntomas, la gente termina yendo a urgencias. <b>Lo que vemos no es que haya poca prediabetes, sino que no se está detectando en quienes más la tienen.</b>
  `);
}

// ════════════════════════════════════════════════════════════
// VIZ 2: Histograma BMI con cortes OMS
// ════════════════════════════════════════════════════════════
function drawBMI() {
  const grupos = GRUPOS.filter(g => activeGroups.has(g));
  if (!grupos.length) {
    d3.select("#chart-bmi").selectAll("*").remove();
    setHallazgos("hallazgos-bmi", "Selecciona al menos un grupo en el filtro lateral para ver los hallazgos.");
    return;
  }

  const H = 460, m = { top:40, right:30, bottom:60, left:60 };
  const W = getW("chart-bmi");
  const w = W - m.left - m.right, h = H - m.top - m.bottom;

  const svg = d3.select("#chart-bmi").attr("width", W).attr("height", H);
  svg.selectAll("*").remove();
  const g = svg.append("g").attr("transform", `translate(${m.left},${m.top})`);

  // Bins de IMC
  const binSize = 1;
  const bins = d3.range(12, 60, binSize);

  // Histogramas por grupo
  const histData = {};
  grupos.forEach(gr => {
    const vals = filtered().filter(d => d.Diabetes_Label === gr).map(d => d.BMI);
    const total = vals.length;
    histData[gr] = bins.map(b => {
      const count = vals.filter(v => v >= b && v < b + binSize).length;
      return { bin: b, pct: total > 0 ? (count / total) * 100 : 0 };
    });
  });

  const maxPct = d3.max(grupos.flatMap(gr => histData[gr].map(d => d.pct))) * 1.1;

  const x = d3.scaleLinear().domain([12, 60]).range([0, w]);
  const y = d3.scaleLinear().domain([0, maxPct]).range([h, 0]);

  // Ejes
  g.append("g").attr("transform", `translate(0,${h})`)
    .call(d3.axisBottom(x).ticks(10))
    .call(ax => {
      ax.selectAll("text").attr("fill", "#718096").attr("font-size", 11);
      ax.selectAll("line").attr("stroke", "#cbd5e0");
      ax.select(".domain").attr("stroke", "#cbd5e0");
    });

  g.append("g").call(d3.axisLeft(y).ticks(5).tickFormat(d => d.toFixed(0) + "%").tickSize(-w))
    .call(ax => {
      ax.select(".domain").remove();
      ax.selectAll("line").attr("stroke", "#e2e8f0");
      ax.selectAll("text").attr("fill", "#718096").attr("font-size", 11);
    });

  // Barras superpuestas
  const barW = (w / bins.length) * 0.9;
  grupos.forEach(gr => {
    g.selectAll(`.bar-${gr.replace(/\s/g,"")}`).data(histData[gr])
      .join("rect")
      .attr("x", d => x(d.bin))
      .attr("width", barW)
      .attr("y", d => y(d.pct))
      .attr("height", d => h - y(d.pct))
      .attr("fill", COLOR[gr]).attr("opacity", 0.55)
      .on("mousemove", (evt, d) =>
        showTip(`<b>${gr}</b><br>IMC: ${d.bin}<br>${d.pct.toFixed(1)}% del grupo`, evt))
      .on("mouseleave", hideTip);
  });

  // Líneas verticales OMS
  [{val: 25, lbl: "Sobrepeso (OMS ≥ 25)", col: "#4a5568"},
   {val: 30, lbl: "Obesidad (OMS ≥ 30)", col: "#1a1a2e"}].forEach(line => {
    g.append("line")
      .attr("x1", x(line.val)).attr("x2", x(line.val))
      .attr("y1", 0).attr("y2", h)
      .attr("stroke", line.col).attr("stroke-width", 1.5).attr("stroke-dasharray", "5,5");
    g.append("text")
      .attr("x", x(line.val)).attr("y", -8)
      .attr("text-anchor", "middle").attr("font-size", 10).attr("fill", line.col)
      .text(line.lbl);
  });

  // Leyenda
  const leg = svg.append("g").attr("transform", `translate(${m.left},${H-25})`);
  grupos.forEach((gr, i) => {
    const lg = leg.append("g").attr("transform", `translate(${i*150},0)`);
    lg.append("rect").attr("width", 14).attr("height", 14).attr("fill", COLOR[gr])
      .attr("opacity", 0.55).attr("rx", 2);
    lg.append("text").attr("x", 20).attr("y", 11)
      .attr("font-size", 12).attr("font-weight", "600").attr("fill", "#2d2d2d").text(gr);
  });

  // Eje X label
  g.append("text").attr("x", w/2).attr("y", h+45)
    .attr("text-anchor", "middle").attr("font-size", 11).attr("fill", "#718096")
    .text("Índice de Masa Corporal (BMI)");

  // ── Hallazgos ─────────────────────────────────────────────
  const stats = {};
  grupos.forEach(gr => {
    const vals = filtered().filter(d => d.Diabetes_Label === gr).map(d => d.BMI);
    stats[gr] = {
      mediana: median(vals),
      pct_obesidad: (vals.filter(v => v >= 30).length / vals.length) * 100,
      pct_sobrepeso: (vals.filter(v => v >= 25 && v < 30).length / vals.length) * 100,
      pct_normopeso: (vals.filter(v => v < 25).length / vals.length) * 100
    };
  });

  let txt = "";
  if (grupos.length === 1) {
    const gr = grupos[0]; const s = stats[gr];
    const zona = s.mediana >= 30 ? "obesidad" : (s.mediana >= 25 ? "sobrepeso" : "peso normal");
    txt = `En el grupo <b>${gr}</b>, el peso típico (mediana) es de <b>IMC ${s.mediana.toFixed(1)}</b>, lo que cae en la zona de <b>${zona}</b>. Distribuyendo a las personas según los cortes de la OMS:<br>
    • <b>${s.pct_normopeso.toFixed(1)}%</b> tiene peso normal (IMC menor a 25).<br>
    • <b>${s.pct_sobrepeso.toFixed(1)}%</b> tiene sobrepeso (IMC entre 25 y 30).<br>
    • <b>${s.pct_obesidad.toFixed(1)}%</b> tiene obesidad (IMC mayor o igual a 30).<br><br>
    Lo que estos números dicen sobre este grupo: la mayoría de las personas <b>no</b> tienen un peso saludable según la OMS. Para entender por qué esto importa, activa los otros grupos en el filtro y compara cómo cambian estos porcentajes — esa comparación es la que revela el rol del peso en la diabetes.`;
  } else if (grupos.length === 2) {
    const [g1, g2] = grupos; const s1 = stats[g1], s2 = stats[g2];
    const mayor = s1.mediana > s2.mediana ? g1 : g2;
    const menor = mayor === g1 ? g2 : g1;
    const sm = stats[mayor], sn = stats[menor];
    const diffMed = Math.abs(s1.mediana - s2.mediana);
    const diffObs = sm.pct_obesidad - sn.pct_obesidad;
    txt = `La mediana del IMC en <b>${mayor}</b> (${sm.mediana.toFixed(1)}) supera a la de <b>${menor}</b> (${sn.mediana.toFixed(1)}) por <b>${diffMed.toFixed(1)} puntos</b>. Pero el dato más revelador está en la proporción de obesidad: <b>${sm.pct_obesidad.toFixed(1)}%</b> en ${mayor} contra <b>${sn.pct_obesidad.toFixed(1)}%</b> en ${menor} — una diferencia de <b>${diffObs.toFixed(1)} puntos</b>.
    <br><br>
    Lo que esto significa lógicamente: no es solo que un grupo "pese un poco más" que el otro. Es que la <b>proporción</b> de personas en zona de obesidad cambia de forma sustancial entre los dos grupos. Cuando una distribución completa se desplaza así, no estamos hablando de casos individuales — estamos viendo un patrón estructural que afecta a todo el grupo.
    <br><br>
    Si ${mayor} es el grupo con condición diabética más severa, este patrón confirma que el peso no es solo una consecuencia de la enfermedad: es un factor que la antecede y la sostiene.`;
  } else {
    const sSd = stats["Sin Diabetes"], sPd = stats["Prediabetes"], sD = stats["Diabetes"];
    const ratio = sD.pct_obesidad / Math.max(sSd.pct_obesidad, 0.1);
    txt = `Las medianas de IMC se ordenan de forma escalonada: <b>${sSd.mediana.toFixed(1)}</b> en Sin Diabetes, <b>${sPd.mediana.toFixed(1)}</b> en Prediabetes y <b>${sD.mediana.toFixed(1)}</b> en Diabetes. La progresión no es casual: cada paso hacia una condición más grave viene con un peso típico mayor.
    <br><br>
    Lo más contundente está en la proporción de obesidad de cada grupo:<br>
    • Sin Diabetes: <b>${sSd.pct_obesidad.toFixed(1)}%</b> tienen obesidad.<br>
    • Prediabetes: <b>${sPd.pct_obesidad.toFixed(1)}%</b>.<br>
    • Diabetes: <b>${sD.pct_obesidad.toFixed(1)}%</b>.
    <br><br>
    Es decir, en el grupo con diabetes, casi <b>${ratio.toFixed(1)} veces más</b> personas están en obesidad respecto al grupo sin diabetes. Cuando un factor cambia tanto entre grupos, no es coincidencia: <b>el peso no acompaña a la diabetes, la antecede</b>.
    <br><br>
    Esto tiene una implicación práctica: si el peso aumenta el riesgo de manera tan clara, entonces la prevención se vuelve concreta — bajar de IMC no es un consejo genérico, es la intervención más directa con la evidencia que muestra este dataset.`;
  }
  setHallazgos("hallazgos-bmi", txt);
}

// ════════════════════════════════════════════════════════════
// VIZ 3: Radar de factores de riesgo
// ════════════════════════════════════════════════════════════
function drawRadar() {
  const grupos = GRUPOS.filter(g => activeGroups.has(g));
  if (!grupos.length) {
    d3.select("#chart-radar").selectAll("*").remove();
    setHallazgos("hallazgos-radar", "Selecciona al menos un grupo en el filtro lateral para ver los hallazgos.");
    return;
  }

  const fcols   = ["HighBP","HighChol","Smoker","PhysActivity","HeartDiseaseorAttack"];
  const flabels = ["Hipertensión","Col. alto","Fumador","Act. física","Enf. cardíaca"];

  const factoresData = {};
  grupos.forEach(gr => {
    const sub = filtered().filter(d => d.Diabetes_Label === gr);
    factoresData[gr] = {};
    fcols.forEach((c, i) => {
      factoresData[gr][flabels[i]] = mean(sub.map(d => d[c])) * 100;
    });
  });

  const H = 480, W = getW("chart-radar");
  const cx = W / 2, cy = H / 2 - 10;
  const radius = Math.min(W, H) / 2 - 80;

  const svg = d3.select("#chart-radar").attr("width", W).attr("height", H);
  svg.selectAll("*").remove();

  const angleSlice = (Math.PI * 2) / fcols.length;

  // Círculos guía
  const levels = 5;
  for (let lv = 1; lv <= levels; lv++) {
    const r = (radius / levels) * lv;
    svg.append("circle")
      .attr("cx", cx).attr("cy", cy).attr("r", r)
      .attr("fill", "none").attr("stroke", "#e2e8f0").attr("stroke-width", 1);
    svg.append("text").attr("x", cx + 4).attr("y", cy - r)
      .attr("font-size", 10).attr("fill", "#a0aec0")
      .text((lv * 20) + "%");
  }

  // Líneas de los ejes
  flabels.forEach((lab, i) => {
    const angle = angleSlice * i - Math.PI / 2;
    const lx = cx + radius * Math.cos(angle);
    const ly = cy + radius * Math.sin(angle);
    svg.append("line")
      .attr("x1", cx).attr("y1", cy).attr("x2", lx).attr("y2", ly)
      .attr("stroke", "#e2e8f0").attr("stroke-width", 1);
    // Etiqueta
    const labX = cx + (radius + 25) * Math.cos(angle);
    const labY = cy + (radius + 25) * Math.sin(angle);
    svg.append("text")
      .attr("x", labX).attr("y", labY)
      .attr("text-anchor", "middle").attr("dominant-baseline", "middle")
      .attr("font-size", 12).attr("font-weight", "600").attr("fill", "#2d2d2d")
      .text(lab);
  });

  // Polígonos por grupo
  grupos.forEach(gr => {
    const points = flabels.map((lab, i) => {
      const angle = angleSlice * i - Math.PI / 2;
      const r = (factoresData[gr][lab] / 100) * radius;
      return [cx + r * Math.cos(angle), cy + r * Math.sin(angle)];
    });
    const pathData = "M" + points.map(p => p.join(",")).join("L") + "Z";

    svg.append("path").attr("d", pathData)
      .attr("fill", COLOR[gr]).attr("fill-opacity", 0.3)
      .attr("stroke", COLOR[gr]).attr("stroke-width", 2);

    // Puntos
    points.forEach((p, i) => {
      svg.append("circle")
        .attr("cx", p[0]).attr("cy", p[1]).attr("r", 4)
        .attr("fill", COLOR[gr]).attr("stroke", "white").attr("stroke-width", 1.5)
        .on("mousemove", evt =>
          showTip(`<b>${gr}</b><br>${flabels[i]}: ${factoresData[gr][flabels[i]].toFixed(1)}%`, evt))
        .on("mouseleave", hideTip);
    });
  });

  // Leyenda
  const leg = svg.append("g").attr("transform", `translate(${W/2 - grupos.length*70},${H-20})`);
  grupos.forEach((gr, i) => {
    const lg = leg.append("g").attr("transform", `translate(${i*140},0)`);
    lg.append("rect").attr("width", 14).attr("height", 14).attr("fill", COLOR[gr]).attr("rx", 2);
    lg.append("text").attr("x", 20).attr("y", 11)
      .attr("font-size", 12).attr("font-weight", "600").attr("fill", "#2d2d2d").text(gr);
  });

  // ── Hallazgos ─────────────────────────────────────────────
  let txt = "";
  if (grupos.length === 1) {
    const gr = grupos[0];
    const dG = factoresData[gr];
    const ord = Object.entries(dG).sort((a,b) => b[1] - a[1]);
    const ordStr = ord.map(([k,v]) => `<b>${k}</b> (${v.toFixed(1)}%)`).join(" · ");
    txt = `En el grupo <b>${gr}</b>, los cinco factores se ordenan así de mayor a menor prevalencia:<br>${ordStr}<br><br>
    El factor más extendido es <b>${ord[0][0]}</b> (${ord[0][1].toFixed(1)}%) y el menos común es <b>${ord[ord.length-1][0]}</b> (${ord[ord.length-1][1].toFixed(1)}%). Pero ver un solo grupo no nos dice mucho — un porcentaje aislado no permite saber si es alto o bajo.<br><br>
    Activa los otros grupos en el filtro para que el contraste revele qué factores son <b>distintivos</b> de cada condición y cuáles son comunes a todos.`;
  } else if (grupos.length === 2) {
    const [g1, g2] = grupos;
    const d1 = factoresData[g1], d2 = factoresData[g2];
    const dif = flabels.map(f => ({factor: f, val: d1[f] - d2[f]}));
    const ordDif = dif.slice().sort((a,b) => Math.abs(b.val) - Math.abs(a.val));
    const mayorDif = ordDif[0], menorDif = ordDif[ordDif.length-1], segDif = ordDif[1];
    txt = `Comparando los dos grupos, las diferencias más grandes están en:<br>
    • <b>${mayorDif.factor}</b>: ${d1[mayorDif.factor].toFixed(1)}% en ${g1} vs ${d2[mayorDif.factor].toFixed(1)}% en ${g2} — diferencia de <b>${Math.abs(mayorDif.val).toFixed(1)} puntos</b>.<br>
    • <b>${segDif.factor}</b>: ${d1[segDif.factor].toFixed(1)}% vs ${d2[segDif.factor].toFixed(1)}% — diferencia de ${Math.abs(segDif.val).toFixed(1)} puntos.<br><br>
    Y la diferencia <b>más pequeña</b> está en <b>${menorDif.factor}</b> (${d1[menorDif.factor].toFixed(1)}% vs ${d2[menorDif.factor].toFixed(1)}%, solo ${Math.abs(menorDif.val).toFixed(1)} puntos). Eso significa que en ese factor los dos grupos son muy parecidos — no es lo que los diferencia.<br><br>
    Lo lógico que se desprende: <b>${mayorDif.factor}</b> es el factor que más distingue a estos dos grupos. Si ${g1} es el grupo con condición más severa, entonces controlar ${mayorDif.factor} debería ser una prioridad para evitar que personas pasen del grupo más leve al más grave.`;
  } else {
    const dSd = factoresData["Sin Diabetes"], dPd = factoresData["Prediabetes"], dD = factoresData["Diabetes"];
    const rHta = dD["Hipertensión"] / Math.max(dSd["Hipertensión"], 0.1);
    const rChol = dD["Col. alto"] / Math.max(dSd["Col. alto"], 0.1);
    txt = `Mirando los tres grupos juntos, dos factores muestran un patrón claro de escalada de Sin Diabetes → Prediabetes → Diabetes:<br>
    • <b>Hipertensión</b>: ${dSd["Hipertensión"].toFixed(1)}% → ${dPd["Hipertensión"].toFixed(1)}% → <b>${dD["Hipertensión"].toFixed(1)}%</b>. En el grupo con diabetes es <b>${rHta.toFixed(1)} veces</b> más frecuente que en el grupo sano.<br>
    • <b>Colesterol alto</b>: ${dSd["Col. alto"].toFixed(1)}% → ${dPd["Col. alto"].toFixed(1)}% → <b>${dD["Col. alto"].toFixed(1)}%</b>. La diabetes lo multiplica por <b>${rChol.toFixed(1)}</b>.<br><br>
    Y un factor se mueve <b>en sentido opuesto</b>: la actividad física pasa de <b>${dSd["Act. física"].toFixed(1)}%</b> en sin diabetes, a ${dPd["Act. física"].toFixed(1)}% en prediabetes, a solo <b>${dD["Act. física"].toFixed(1)}%</b> en el grupo con diabetes. Es la única variable donde el grupo más sano tiene <b>más</b> que los enfermos.<br><br>
    La lectura lógica es directa: la diabetes no aparece sola, viene en un paquete. Cuando alguien tiene diabetes, las probabilidades de que también tenga hipertensión y colesterol alto son <b>3 a 4 veces más altas</b> que en una persona sana. Y al mismo tiempo, hace menos ejercicio. Esto explica por qué los protocolos médicos para diabetes incluyen siempre control de presión, control de lípidos y prescripción de actividad física — no se tratan como cosas separadas porque <b>los datos muestran que no lo son</b>.`;
  }
  setHallazgos("hallazgos-radar", txt);
}

// ════════════════════════════════════════════════════════════
// VIZ 4: Heatmap edad × condición
// ════════════════════════════════════════════════════════════
function drawHeatmapEdad() {
  const grupos = GRUPOS.filter(g => activeGroups.has(g));
  if (!grupos.length) {
    d3.select("#chart-edad").selectAll("*").remove();
    setHallazgos("hallazgos-edad", "Selecciona al menos un grupo en el filtro lateral para ver los hallazgos.");
    return;
  }

  const ages = Object.values(EDAD_LABELS);

  // Calcular % por edad y grupo
  const pctData = {};
  grupos.forEach(gr => { pctData[gr] = {}; });

  ages.forEach(age => {
    const ageKey = +Object.keys(EDAD_LABELS).find(k => EDAD_LABELS[k] === age);
    const sub = rawData.filter(d => d.Age === ageKey && grupos.includes(d.Diabetes_Label));
    const total = sub.length;
    grupos.forEach(gr => {
      pctData[gr][age] = total > 0 ? (sub.filter(d => d.Diabetes_Label === gr).length / total) * 100 : 0;
    });
  });

  const H = 380, m = { top:30, right:30, bottom:70, left:130 };
  const W = getW("chart-edad");
  const w = W - m.left - m.right, h = H - m.top - m.bottom;

  const svg = d3.select("#chart-edad").attr("width", W).attr("height", H);
  svg.selectAll("*").remove();
  const g = svg.append("g").attr("transform", `translate(${m.left},${m.top})`);

  const x = d3.scaleBand().domain(ages).range([0, w]).padding(0.04);
  const y = d3.scaleBand().domain(grupos).range([0, h]).padding(0.04);

  // Escala de color secuencial blanco -> rojo
  const colorScale = d3.scaleLinear()
    .domain([0, 30, 60, 100])
    .range(["#f7fafc", "#fed7d7", "#fc8181", "#c53030"]);

  const cells = [];
  grupos.forEach(gr => ages.forEach(age => {
    cells.push({ grupo: gr, age, pct: pctData[gr][age] });
  }));

  g.selectAll("rect").data(cells).join("rect")
    .attr("x", d => x(d.age)).attr("y", d => y(d.grupo))
    .attr("width", x.bandwidth()).attr("height", y.bandwidth())
    .attr("fill", d => colorScale(d.pct))
    .attr("stroke", "white").attr("stroke-width", 1)
    .on("mousemove", (evt, d) =>
      showTip(`<b>${d.grupo}</b><br>Edad: ${d.age}<br>${d.pct.toFixed(1)}%`, evt))
    .on("mouseleave", hideTip);

  g.selectAll(".cell-txt").data(cells).join("text").attr("class", "cell-txt")
    .attr("x", d => x(d.age) + x.bandwidth()/2)
    .attr("y", d => y(d.grupo) + y.bandwidth()/2 + 4)
    .attr("text-anchor", "middle")
    .attr("font-size", 10).attr("font-weight", "600").attr("fill", "#1a1a2e")
    .text(d => d.pct.toFixed(1) + "%");

  // Eje X
  g.append("g").attr("transform", `translate(0,${h})`)
    .call(d3.axisBottom(x).tickSize(0))
    .call(ax => {
      ax.select(".domain").remove();
      ax.selectAll("text").attr("font-size", 10).attr("font-weight", "600")
        .attr("transform", "rotate(-30)").attr("text-anchor", "end").attr("dx", "-0.5em");
    });

  // Eje Y
  g.append("g").call(d3.axisLeft(y).tickSize(0))
    .call(ax => {
      ax.select(".domain").remove();
      ax.selectAll("text").attr("font-size", 11).attr("font-weight", "600").attr("fill", "#2d2d2d");
    });

  // Eje X label
  g.append("text").attr("x", w/2).attr("y", h+55)
    .attr("text-anchor", "middle").attr("font-size", 11).attr("fill", "#718096")
    .text("Grupo de edad (años)");

  // ── Hallazgos ─────────────────────────────────────────────
  let txt = "";
  if (grupos.length === 1) {
    const gr = grupos[0];
    txt = `Con un solo grupo activo (<b>${gr}</b>), todas las celdas marcan 100% — porque dentro de los datos filtrados, este grupo es el único que existe. El mapa solo cobra sentido cuando hay al menos dos condiciones para comparar entre edades.<br><br>
    Activa otro grupo en el filtro para que el mapa pueda mostrar la <b>proporción</b> de cada condición en cada edad. Esa proporción es la que revela el patrón importante: cómo el riesgo cambia con los años.`;
  } else if (grupos.length === 2) {
    const [g1, g2] = grupos;
    const j1 = pctData[g1]["18-24"], m1 = pctData[g1]["80+"];
    const j2 = pctData[g2]["18-24"], m2 = pctData[g2]["80+"];
    const c1 = m1 - j1, c2 = m2 - j2;
    txt = `Los datos muestran cómo cambia la proporción de cada grupo a lo largo de las edades:<br>
    • <b>${g1}</b>: pasa de <b>${j1.toFixed(1)}%</b> en 18-24 años a <b>${m1.toFixed(1)}%</b> en 80+. Cambio: <b>${c1 >= 0 ? "+" : ""}${c1.toFixed(1)} puntos</b>.<br>
    • <b>${g2}</b>: pasa de <b>${j2.toFixed(1)}%</b> en 18-24 a <b>${m2.toFixed(1)}%</b> en 80+. Cambio: <b>${c2 >= 0 ? "+" : ""}${c2.toFixed(1)} puntos</b>.<br><br>
    Lo que esto dice lógicamente: cuando un grupo aumenta con la edad y el otro disminuye, no es porque las personas "cambien de grupo" individualmente — es porque la composición de cada generación es diferente. Las generaciones mayores acumularon más años de exposición a factores de riesgo (peso, sedentarismo, presión alta), y eso se refleja en la proporción de quienes hoy tienen una u otra condición.<br><br>
    Esto es importante para sistemas de salud: la edad no es solo un dato demográfico, es <b>un predictor estructural</b> que permite anticipar dónde poner los recursos.`;
  } else {
    const d24 = pctData["Diabetes"]["18-24"], d50 = pctData["Diabetes"]["50-54"];
    const d65 = pctData["Diabetes"]["65-69"], d80 = pctData["Diabetes"]["80+"];
    const sd24 = pctData["Sin Diabetes"]["18-24"], sd80 = pctData["Sin Diabetes"]["80+"];
    const ratio = d80 / Math.max(d24, 0.1);
    txt = `Lo primero que salta en el mapa es que la diabetes pasa de prácticamente <b>${d24.toFixed(1)}%</b> en personas de 18-24 años a <b>${d80.toFixed(1)}%</b> en mayores de 80. Eso es un crecimiento de <b>${ratio.toFixed(0)} veces</b>. Y en paralelo, la fila de Sin Diabetes baja de <b>${sd24.toFixed(1)}%</b> a <b>${sd80.toFixed(1)}%</b>.<br><br>
    Pero el dato más útil no son los extremos, son los puntos intermedios: a los 50-54 años la diabetes ya está en <b>${d50.toFixed(1)}%</b>, y a los 65-69 sube a <b>${d65.toFixed(1)}%</b>. Es decir, entre los 50 y los 70 años la prevalencia <b>casi se duplica</b>. Esa franja de 20 años es donde el riesgo se acelera más rápido.<br><br>
    Lógicamente esto significa que las campañas de tamizaje no deberían empezar a los 65 (cuando ya muchos están enfermos), sino alrededor de los 45-50, antes de que la curva se acelere. <b>El gráfico no solo dice que el riesgo crece con la edad — dice exactamente cuándo empieza a crecer rápido</b>, y esa información es la que permite actuar a tiempo.`;
  }
  setHallazgos("hallazgos-edad", txt);
}

// ════════════════════════════════════════════════════════════
// VIZ 5: Heatmap de correlaciones
// ════════════════════════════════════════════════════════════
function drawHeatmapCorr() {
  const vars = ["Diabetes_012","HighBP","HighChol","BMI","Smoker",
                "PhysActivity","GenHlth","Age","Income"];
  const labels = ["Diabetes","Hipertensión","Col. alto","BMI","Fumador",
                  "Act. física","Salud gral.","Edad","Ingreso"];

  function pearson(a, b) {
    const ma = mean(a), mb = mean(b);
    const num = a.reduce((s, v, i) => s + (v - ma) * (b[i] - mb), 0);
    const da = Math.sqrt(a.reduce((s, v) => s + (v - ma) ** 2, 0));
    const db = Math.sqrt(b.reduce((s, v) => s + (v - mb) ** 2, 0));
    return da && db ? +(num / (da * db)).toFixed(3) : 0;
  }

  const matrix = vars.map(r =>
    vars.map(c => pearson(rawData.map(d => d[r]), rawData.map(d => d[c])))
  );

  const n = vars.length, size = 46;
  const m = { top:10, right:80, bottom:120, left:110 };
  const W = n * size + m.left + m.right;
  const H = n * size + m.top + m.bottom;

  const svg = d3.select("#chart-corr").attr("width", W).attr("height", H);
  svg.selectAll("*").remove();
  const g = svg.append("g").attr("transform", `translate(${m.left},${m.top})`);

  const color = d3.scaleDiverging(d3.interpolateRdBu).domain([1, 0, -1]);

  const cells = [];
  labels.forEach((r, i) => labels.forEach((c, j) =>
    cells.push({ r, c, i, j, v: matrix[i][j] })));

  g.selectAll("rect").data(cells).join("rect")
    .attr("x", d => d.j * size).attr("y", d => d.i * size)
    .attr("width", size).attr("height", size)
    .attr("fill", d => color(d.v))
    .attr("stroke", "white").attr("stroke-width", 1.5)
    .on("mousemove", (evt, d) =>
      showTip(`<b>${d.r} × ${d.c}</b><br>r = ${d.v.toFixed(3)}`, evt))
    .on("mouseleave", hideTip);

  g.selectAll(".val").data(cells).join("text").attr("class", "val")
    .attr("x", d => d.j * size + size/2).attr("y", d => d.i * size + size/2 + 4)
    .attr("text-anchor", "middle")
    .attr("font-size", 10).attr("font-weight", "700")
    .attr("fill", d => Math.abs(d.v) > 0.25 ? "white" : "#2d2d2d")
    .text(d => d.v.toFixed(2));

  g.selectAll(".xlbl").data(labels).join("text").attr("class", "xlbl")
    .attr("x", (d, i) => i * size + size/2).attr("y", n * size + 14)
    .attr("text-anchor", "end")
    .attr("transform", (d, i) => `rotate(-40,${i*size + size/2},${n*size + 14})`)
    .attr("font-size", 11).attr("fill", "#4a5568").text(d => d);

  g.selectAll(".ylbl").data(labels).join("text").attr("class", "ylbl")
    .attr("x", -8).attr("y", (d, i) => i * size + size/2 + 4)
    .attr("text-anchor", "end")
    .attr("font-size", 11).attr("fill", "#4a5568").text(d => d);

  // Barra de color
  const barH = n * size, barW = 14, bx = n * size + 20;
  const defs = svg.append("defs");
  const grad = defs.append("linearGradient").attr("id", "hm-grad")
    .attr("x1", "0%").attr("x2", "0%").attr("y1", "0%").attr("y2", "100%");
  grad.append("stop").attr("offset", "0%").attr("stop-color", color(-1));
  grad.append("stop").attr("offset", "50%").attr("stop-color", color(0));
  grad.append("stop").attr("offset", "100%").attr("stop-color", color(1));

  g.append("rect").attr("x", bx).attr("y", 0).attr("width", barW).attr("height", barH)
    .attr("fill", "url(#hm-grad)").attr("rx", 3);

  [-1, -0.5, 0, 0.5, 1].forEach(v => {
    const yy = barH * (1 - (v + 1) / 2);
    g.append("text").attr("x", bx + barW + 5).attr("y", yy + 4)
      .attr("font-size", 10).attr("fill", "#718096").text(v.toFixed(1));
  });

  // ── Hallazgos ─────────────────────────────────────────────
  const filaDiab = labels.slice(1).map((lbl, i) => ({lbl, val: matrix[0][i+1]}));
  filaDiab.sort((a, b) => b.val - a.val);
  const topPos = filaDiab.slice(0, 3);
  const topNeg = filaDiab.slice(-2);
  const incomeGenhlth = matrix[labels.indexOf("Ingreso")][labels.indexOf("Salud gral.")];
  const edadHta = matrix[labels.indexOf("Edad")][labels.indexOf("Hipertensión")];
  const bmiHta = matrix[labels.indexOf("BMI")][labels.indexOf("Hipertensión")];

  setHallazgos("hallazgos-corr", `
    El mapa cruza 9 variables del dataset y mide qué tan fuerte van juntas. Los valores van de -1 (azul oscuro: cuando una sube, la otra baja) a 1 (rojo oscuro: suben juntas). Cero (blanco) significa que no se relacionan.
    <br><br>
    Lo primero que hay que notar: <b>ninguna correlación con Diabetes pasa de 0.30</b>. Las tres más altas son <b>${topPos[0].lbl}</b> (${topPos[0].val.toFixed(2)}), <b>${topPos[1].lbl}</b> (${topPos[1].val.toFixed(2)}) y <b>${topPos[2].lbl}</b> (${topPos[2].val.toFixed(2)}). Esto significa que <b>ningún factor por sí solo explica la diabetes</b> — no hay una variable mágica. Si fuera tan simple, ya habría una sola prueba para detectarla. La diabetes es el resultado de varios factores actuando juntos.
    <br><br>
    Y eso lleva al segundo hallazgo: las correlaciones <b>entre los factores</b> son a veces más fuertes que con la diabetes misma. Por ejemplo, BMI con Hipertensión correlaciona <b>${bmiHta.toFixed(2)}</b>, y Edad con Hipertensión <b>${edadHta.toFixed(2)}</b>. Esto explica el patrón de "comorbilidad" que vimos en el radar — las enfermedades vienen en paquete porque <b>los factores de riesgo se refuerzan entre sí</b>.
    <br><br>
    El dato sociopolítico está en la esquina opuesta: <b>Ingreso vs Salud general</b> da <b>${incomeGenhlth.toFixed(2)}</b> (negativa). Es decir, a menor ingreso, peor salud percibida. No es una correlación gigante, pero es consistente y conecta con lo que vimos en el tab 1 — el dinero condiciona el acceso a la salud, y eso se traduce en cómo la gente se siente.
    <br><br>
    <b>Conclusión lógica:</b> el dataset no muestra una causa única de diabetes, sino una <b>red de variables interconectadas</b>. Cualquier modelo predictivo o intervención de salud pública que ignore esta interconexión va a fallar — porque atacar una sola variable deja a las otras compensándola.
  `);
}

window.addEventListener("resize", () => renderTab(currentTab));