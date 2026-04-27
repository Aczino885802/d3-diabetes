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

// Etiquetas de edad según codificación BRFSS
const EDAD_LABELS = {
  1:"18-24", 2:"25-29", 3:"30-34", 4:"35-39", 5:"40-44",
  6:"45-49", 7:"50-54", 8:"55-59", 9:"60-64", 10:"65-69",
  11:"70-74", 12:"75-79", 13:"80+"
};

// ── Variables globales ──────────────────────────────────────
let rawData = [];          // dataset completo
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

  // Convertir columnas a número y agregar etiqueta
  rawData = data.map(d => {
    const row = {};
    for (const k in d) row[k] = isNaN(d[k]) ? d[k] : +d[k];
    row.Diabetes_Label = ["Sin Diabetes","Prediabetes","Diabetes"][row.Diabetes_012];
    return row;
  });

  // Conectar filtros
  document.querySelectorAll("#checkboxes input").forEach(cb => {
    cb.addEventListener("change", () => {
      if (cb.checked) activeGroups.add(cb.value);
      else activeGroups.delete(cb.value);
      renderTab(currentTab);
    });
  });

  // Dibujar tab inicial
  setTimeout(() => drawBarras(), 50);

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
  if      (i === 0) drawBarras();
  else if (i === 1) drawBoxplot();
  else if (i === 2) drawFactores();
  else if (i === 3) drawEdad();
  else if (i === 4) drawHeatmap();
}

function getW(svgId) {
  return document.getElementById(svgId).parentElement.clientWidth - 48;
}

// ── Dataset filtrado ─────────────────────────────────────────
function filtered() {
  return rawData.filter(d => activeGroups.has(d.Diabetes_Label));
}

// ── Helpers estadísticos ─────────────────────────────────────
function quantile(arr, q) {
  const sorted = [...arr].sort((a, b) => a - b);
  const pos    = (sorted.length - 1) * q;
  const base   = Math.floor(pos);
  const rest   = pos - base;
  return sorted[base + 1] !== undefined
    ? sorted[base] + rest * (sorted[base + 1] - sorted[base])
    : sorted[base];
}
function mean(arr) { return arr.reduce((a, b) => a + b, 0) / arr.length; }

// ── Viz 1: Barras comparativas ───────────────────────────────
function drawBarras() {
  const data_raw = filtered();
  const counts   = d3.rollup(data_raw, v => v.length, d => d.Diabetes_Label);
  const total    = data_raw.length;

  const data = GRUPOS
    .filter(g => activeGroups.has(g))
    .map(g => ({
      grupo: g,
      n:     counts.get(g) || 0,
      pct:   total > 0 ? +((counts.get(g) || 0) / total * 100).toFixed(1) : 0
    }));

  const H = 400, m = { top:20, right:20, bottom:40, left:80 };
  const W = getW("chart-barras");
  const w = W - m.left - m.right, h = H - m.top - m.bottom;

  const svg = d3.select("#chart-barras").attr("width", W).attr("height", H);
  svg.selectAll("*").remove();
  const g = svg.append("g").attr("transform", `translate(${m.left},${m.top})`);

  if (!data.length) return;

  const x = d3.scaleBand().domain(data.map(d => d.grupo)).range([0, w]).padding(0.35);
  const y = d3.scaleLinear().domain([0, d3.max(data, d => d.n) * 1.18]).range([h, 0]);

  g.append("g").attr("transform", `translate(0,${h})`)
    .call(d3.axisBottom(x).tickSize(0)).select(".domain").remove();
  g.selectAll(".tick text").attr("font-size", 12).attr("font-weight", "600");

  g.append("g").call(d3.axisLeft(y).ticks(5).tickFormat(d3.format(",")).tickSize(-w))
    .call(ax => {
      ax.select(".domain").remove();
      ax.selectAll("line").attr("stroke", "#e2e8f0");
      ax.selectAll("text").attr("fill", "#718096").attr("font-size", 11);
    });

  g.selectAll("rect").data(data).join("rect")
    .attr("x", d => x(d.grupo)).attr("width", x.bandwidth())
    .attr("y", d => y(d.n)).attr("height", d => h - y(d.n))
    .attr("fill", d => COLOR[d.grupo]).attr("rx", 3)
    .on("mousemove", (evt, d) =>
      showTip(`<b>${d.grupo}</b><br>n = ${d3.format(",")(d.n)}<br>${d.pct}% del total`, evt))
    .on("mouseleave", hideTip);

  g.selectAll(".lbl").data(data).join("text").attr("class", "lbl")
    .attr("x", d => x(d.grupo) + x.bandwidth() / 2)
    .attr("y", d => y(d.n) - 8)
    .attr("text-anchor", "middle")
    .attr("font-size", 12).attr("font-weight", "700").attr("fill", "#2d2d2d")
    .text(d => `${d3.format(",")(d.n)} (${d.pct}%)`);

  g.append("text").attr("transform", "rotate(-90)")
    .attr("x", -h / 2).attr("y", -62)
    .attr("text-anchor", "middle").attr("font-size", 11).attr("fill", "#718096")
    .text("Número de personas");
}

// ── Viz 2: Boxplot BMI ───────────────────────────────────────
function drawBoxplot() {
  const grupos = GRUPOS.filter(g => activeGroups.has(g));

  const data = grupos.map(gr => {
    const vals = filtered().filter(d => d.Diabetes_Label === gr).map(d => d.BMI);
    const q1   = quantile(vals, 0.25);
    const med  = quantile(vals, 0.50);
    const q3   = quantile(vals, 0.75);
    const iqr  = q3 - q1;
    return {
      group:  gr,
      min:    Math.max(d3.min(vals), q1 - 1.5 * iqr),
      q1, median: med, q3,
      max:    Math.min(d3.max(vals), q3 + 1.5 * iqr),
      mean:   mean(vals)
    };
  });

  const H = 400, m = { top:20, right:20, bottom:40, left:70 };
  const W = getW("chart-boxplot");
  const w = W - m.left - m.right, h = H - m.top - m.bottom;

  const svg = d3.select("#chart-boxplot").attr("width", W).attr("height", H);
  svg.selectAll("*").remove();
  const g = svg.append("g").attr("transform", `translate(${m.left},${m.top})`);

  if (!data.length) return;

  const x  = d3.scaleBand().domain(grupos).range([0, w]).padding(0.4);
  const y  = d3.scaleLinear().domain([10, 65]).range([h, 0]);
  const bw = x.bandwidth();

  g.append("g").attr("transform", `translate(0,${h})`)
    .call(d3.axisBottom(x).tickSize(0)).select(".domain").remove();
  g.selectAll(".tick text").attr("font-size", 12).attr("font-weight", "600");

  g.append("g").call(d3.axisLeft(y).ticks(6).tickSize(-w))
    .call(ax => {
      ax.select(".domain").remove();
      ax.selectAll("line").attr("stroke", "#e2e8f0");
      ax.selectAll("text").attr("fill", "#718096").attr("font-size", 11);
    });

  data.forEach(d => {
    const cx = x(d.group) + bw / 2, col = COLOR[d.group];

    g.append("line").attr("x1", cx).attr("x2", cx)
      .attr("y1", y(d.min)).attr("y2", y(d.q1))
      .attr("stroke", col).attr("stroke-width", 1.5).attr("stroke-dasharray", "3,3");
    g.append("line").attr("x1", cx).attr("x2", cx)
      .attr("y1", y(d.q3)).attr("y2", y(d.max))
      .attr("stroke", col).attr("stroke-width", 1.5).attr("stroke-dasharray", "3,3");

    [d.min, d.max].forEach(v =>
      g.append("line")
        .attr("x1", cx - bw * 0.15).attr("x2", cx + bw * 0.15)
        .attr("y1", y(v)).attr("y2", y(v))
        .attr("stroke", col).attr("stroke-width", 1.5));

    g.append("rect")
      .attr("x", x(d.group)).attr("width", bw)
      .attr("y", y(d.q3)).attr("height", y(d.q1) - y(d.q3))
      .attr("fill", col).attr("opacity", 0.8).attr("rx", 3)
      .on("mousemove", evt =>
        showTip(`<b>${d.group}</b><br>Mediana: ${d.median.toFixed(1)}<br>Q1: ${d.q1.toFixed(1)} · Q3: ${d.q3.toFixed(1)}<br>Media: ${d.mean.toFixed(1)}`, evt))
      .on("mouseleave", hideTip);

    g.append("line")
      .attr("x1", x(d.group)).attr("x2", x(d.group) + bw)
      .attr("y1", y(d.median)).attr("y2", y(d.median))
      .attr("stroke", "#1a1a2e").attr("stroke-width", 2.5);

    const dm = 6;
    g.append("path")
      .attr("d", `M${cx},${y(d.mean)-dm} L${cx+dm},${y(d.mean)} L${cx},${y(d.mean)+dm} L${cx-dm},${y(d.mean)} Z`)
      .attr("fill", "white").attr("stroke", "#1a1a2e").attr("stroke-width", 1.5);
  });

  g.append("text").attr("transform", "rotate(-90)")
    .attr("x", -h / 2).attr("y", -55)
    .attr("text-anchor", "middle").attr("font-size", 11).attr("fill", "#718096")
    .text("Índice de Masa Corporal (BMI)");
}

// ── Viz 3: Barras agrupadas — Factores de riesgo ─────────────
function drawFactores() {
  const legEl = document.getElementById("legend-factores");
  legEl.innerHTML = "";
  GRUPOS.filter(g => activeGroups.has(g)).forEach(g => {
    legEl.innerHTML += `<div class="legend-item">
      <span class="dot" style="background:${COLOR[g]}"></span>${g}</div>`;
  });

  const factoresCols  = ["HighBP","HighChol","Smoker","PhysActivity","HeartDiseaseorAttack"];
  const factoresLabel = ["Hipertensión","Col. alto","Fumador","Act. física","Enf. cardíaca"];
  const grupos        = GRUPOS.filter(g => activeGroups.has(g));

  const data = [];
  grupos.forEach(gr => {
    const sub = filtered().filter(d => d.Diabetes_Label === gr);
    factoresCols.forEach((col, i) => {
      data.push({
        grupo:  gr,
        factor: factoresLabel[i],
        pct:    +(mean(sub.map(d => d[col])) * 100).toFixed(1)
      });
    });
  });

  const H = 420, m = { top:10, right:20, bottom:70, left:55 };
  const W = getW("chart-factores");
  const w = W - m.left - m.right, h = H - m.top - m.bottom;

  const svg = d3.select("#chart-factores").attr("width", W).attr("height", H);
  svg.selectAll("*").remove();
  const g = svg.append("g").attr("transform", `translate(${m.left},${m.top})`);

  const x0 = d3.scaleBand().domain(factoresLabel).range([0, w]).padding(0.25);
  const x1 = d3.scaleBand().domain(grupos).range([0, x0.bandwidth()]).padding(0.08);
  const y  = d3.scaleLinear().domain([0, 100]).range([h, 0]);

  g.append("g").attr("transform", `translate(0,${h})`)
    .call(d3.axisBottom(x0).tickSize(0))
    .call(ax => {
      ax.select(".domain").remove();
      ax.selectAll("text").attr("font-size", 11).attr("font-weight", "600").attr("dy", "1.4em");
    });

  g.append("g").call(d3.axisLeft(y).ticks(5).tickFormat(d => d + "%").tickSize(-w))
    .call(ax => {
      ax.select(".domain").remove();
      ax.selectAll("line").attr("stroke", "#e2e8f0");
      ax.selectAll("text").attr("fill", "#718096").attr("font-size", 11);
    });

  factoresLabel.forEach(fac => {
    grupos.forEach(gr => {
      const d   = data.find(r => r.grupo === gr && r.factor === fac);
      if (!d) return;
      const bx  = x0(fac) + x1(gr);
      const bw2 = x1.bandwidth();

      g.append("rect")
        .attr("x", bx).attr("width", bw2)
        .attr("y", y(d.pct)).attr("height", h - y(d.pct))
        .attr("fill", COLOR[gr]).attr("rx", 2)
        .on("mousemove", evt => showTip(`<b>${gr}</b><br>${fac}: ${d.pct}%`, evt))
        .on("mouseleave", hideTip);

      g.append("text")
        .attr("x", bx + bw2 / 2).attr("y", y(d.pct) - 4)
        .attr("text-anchor", "middle").attr("font-size", 9).attr("font-weight", "700")
        .attr("fill", "#2d2d2d").text(d.pct + "%");
    });
  });
}

// ── Viz 4: Barras apiladas — Prevalencia por edad ────────────
function drawEdad() {
  const legEl = document.getElementById("legend-edad");
  legEl.innerHTML = "";
  GRUPOS.filter(g => activeGroups.has(g)).forEach(g => {
    legEl.innerHTML += `<div class="legend-item">
      <span style="display:inline-block;width:14px;height:14px;background:${COLOR[g]};border-radius:2px;"></span>${g}</div>`;
  });

  const grupos = GRUPOS.filter(g => activeGroups.has(g));
  const ages   = Object.values(EDAD_LABELS);

  // Calcular proporciones por grupo de edad
  const data = ages.map(age => {
    const ageKey = +Object.keys(EDAD_LABELS).find(k => EDAD_LABELS[k] === age);
    const sub    = rawData.filter(d => d.Age === ageKey && activeGroups.has(d.Diabetes_Label));
    const total  = sub.length;
    const out    = { age };
    grupos.forEach(gr => {
      out[gr] = total > 0 ? sub.filter(d => d.Diabetes_Label === gr).length / total * 100 : 0;
    });
    return out;
  });

  const stacked = d3.stack().keys(grupos)(data);

  const H = 420, m = { top:10, right:20, bottom:60, left:55 };
  const W = getW("chart-edad");
  const w = W - m.left - m.right, h = H - m.top - m.bottom;

  const svg = d3.select("#chart-edad").attr("width", W).attr("height", H);
  svg.selectAll("*").remove();
  const g = svg.append("g").attr("transform", `translate(${m.left},${m.top})`);

  const x = d3.scaleBand().domain(ages).range([0, w]).padding(0.12);
  const y = d3.scaleLinear().domain([0, 100]).range([h, 0]);

  g.append("g").attr("transform", `translate(0,${h})`)
    .call(d3.axisBottom(x).tickSize(0))
    .call(ax => {
      ax.select(".domain").remove();
      ax.selectAll("text")
        .attr("font-size", 10).attr("font-weight", "600")
        .attr("transform", "rotate(-35)").attr("text-anchor", "end").attr("dy", "0.4em");
    });

  g.append("g").call(d3.axisLeft(y).ticks(5).tickFormat(d => d + "%").tickSize(-w))
    .call(ax => {
      ax.select(".domain").remove();
      ax.selectAll("line").attr("stroke", "#e2e8f0");
      ax.selectAll("text").attr("fill", "#718096").attr("font-size", 11);
    });

  stacked.forEach(series => {
    g.selectAll(null).data(series).join("rect")
      .attr("x", d => x(d.data.age))
      .attr("width", x.bandwidth())
      .attr("y", d => y(d[1]))
      .attr("height", d => Math.max(0, y(d[0]) - y(d[1])))
      .attr("fill", COLOR[series.key])
      .on("mousemove", (evt, d) =>
        showTip(`<b>${series.key}</b><br>Edad: ${d.data.age}<br>${d.data[series.key].toFixed(1)}%`, evt))
      .on("mouseleave", hideTip);
  });
}

// ── Viz 5: Heatmap de correlaciones ─────────────────────────
function drawHeatmap() {
  const vars = ["Diabetes_012","HighBP","HighChol","BMI","Smoker",
                "PhysActivity","GenHlth","Age","Income"];
  const labels = ["Diabetes","Hipertension","Col. alto","BMI","Fumador",
                  "Act. fisica","Salud gral.","Edad","Ingreso"];

  // Calcular correlaciones de Pearson desde el CSV completo
  function pearson(a, b) {
    const n  = a.length;
    const ma = mean(a), mb = mean(b);
    const num = a.reduce((s, v, i) => s + (v - ma) * (b[i] - mb), 0);
    const da  = Math.sqrt(a.reduce((s, v) => s + (v - ma) ** 2, 0));
    const db  = Math.sqrt(b.reduce((s, v) => s + (v - mb) ** 2, 0));
    return da && db ? +(num / (da * db)).toFixed(3) : 0;
  }

  const matrix = vars.map(r =>
    vars.map(c => pearson(rawData.map(d => d[r]), rawData.map(d => d[c])))
  );

  const n    = vars.length;
  const size = 46;
  const m    = { top:10, right:80, bottom:120, left:110 };
  const W    = n * size + m.left + m.right;
  const H    = n * size + m.top  + m.bottom;

  const svg = d3.select("#chart-heatmap").attr("width", W).attr("height", H);
  svg.selectAll("*").remove();
  const g = svg.append("g").attr("transform", `translate(${m.left},${m.top})`);

  const color = d3.scaleDiverging(d3.interpolateRdBu).domain([1, 0, -1]);

  const cells = [];
  labels.forEach((r, i) =>
    labels.forEach((c, j) =>
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
    .attr("x", d => d.j * size + size / 2)
    .attr("y", d => d.i * size + size / 2 + 4)
    .attr("text-anchor", "middle")
    .attr("font-size", 10).attr("font-weight", "700")
    .attr("fill", d => Math.abs(d.v) > 0.25 ? "white" : "#2d2d2d")
    .text(d => d.v.toFixed(2));

  g.selectAll(".xlbl").data(labels).join("text").attr("class", "xlbl")
    .attr("x", (d, i) => i * size + size / 2)
    .attr("y", n * size + 14)
    .attr("text-anchor", "end")
    .attr("transform", (d, i) => `rotate(-40,${i * size + size / 2},${n * size + 14})`)
    .attr("font-size", 11).attr("fill", "#4a5568").text(d => d);

  g.selectAll(".ylbl").data(labels).join("text").attr("class", "ylbl")
    .attr("x", -8).attr("y", (d, i) => i * size + size / 2 + 4)
    .attr("text-anchor", "end")
    .attr("font-size", 11).attr("fill", "#4a5568").text(d => d);

  const barH = n * size, barW = 14, bx = n * size + 20;
  const defs = svg.append("defs");
  const grad = defs.append("linearGradient").attr("id", "hm-grad")
    .attr("x1", "0%").attr("x2", "0%").attr("y1", "0%").attr("y2", "100%");
  grad.append("stop").attr("offset",  "0%").attr("stop-color", color(-1));
  grad.append("stop").attr("offset", "50%").attr("stop-color", color(0));
  grad.append("stop").attr("offset","100%").attr("stop-color", color(1));

  g.append("rect")
    .attr("x", bx).attr("y", 0).attr("width", barW).attr("height", barH)
    .attr("fill", "url(#hm-grad)").attr("rx", 3);

  [-1, -0.5, 0, 0.5, 1].forEach(v => {
    const yy = barH * (1 - (v + 1) / 2);
    g.append("text").attr("x", bx + barW + 5).attr("y", yy + 4)
      .attr("font-size", 10).attr("fill", "#718096").text(v.toFixed(1));
  });
}

window.addEventListener("resize", () => renderTab(currentTab));
