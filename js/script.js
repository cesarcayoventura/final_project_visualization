const eduMap = {
  1: "Graduate School",
  2: "University",
  3: "High School",
  4: "Others",
  5: "Others",
  6: "Others",
  0: "Others",
};
const sexMap = { 1: "Male", 2: "Female" };
const marriageMap = { 1: "Married", 2: "Single", 3: "Others", 0: "Others" };

const COLOR_ON_TRACK = "#2563eb";
const COLOR_AT_RISK = "#e11d48";

let globalDataRef = [];
let activeFilters = {
  SEX_LABEL: [],
  EDU_LABEL: [],
  MARRY_LABEL: [],
  RISK: null,
};
const tooltip = d3.select("#tooltip");

d3.csv("data/default_of_credit_card_clients.csv").then(function (data) {
  data.forEach(function (d) {
    d.default = +d["default payment next month"];
    d.limit = +d.LIMIT_BAL;
    d.EDU_LABEL = eduMap[+d["EDUCATION"]] || "Others";
    d.SEX_LABEL = sexMap[+d["SEX"]] || "Others";
    d.MARRY_LABEL = marriageMap[+d["MARRIAGE"]] || "Others";
    for (let i = 1; i <= 6; i++) {
      d[`bill${i}`] = +d[`BILL_AMT${i}`];
      d[`pay${i}`] = +d[`PAY_AMT${i}`];
    }
  });
  globalDataRef = data;
  initToggle();
  updateDashboard();
  d3.select("#reset-btn").on("click", resetAll);
});

function resetAll() {
  activeFilters = { SEX_LABEL: [], EDU_LABEL: [], MARRY_LABEL: [], RISK: null };
  d3.selectAll(".toggle-item").classed("active", false);
  updateDashboard();
}

function initToggle() {
  d3.selectAll(".toggle-item").on("click", function () {
    const riskVal = +d3.select(this).attr("data-risk");
    if (activeFilters.RISK === riskVal) {
      activeFilters.RISK = null;
      d3.select(this).classed("active", false);
    } else {
      activeFilters.RISK = riskVal;
      d3.selectAll(".toggle-item").classed("active", false);
      d3.select(this).classed("active", true);
    }
    updateDashboard();
  });
}

function updateDashboard() {
  let filtered = globalDataRef;
  Object.keys(activeFilters).forEach(function (key) {
    if (key !== "RISK" && activeFilters[key].length > 0) {
      filtered = filtered.filter((d) => activeFilters[key].includes(d[key]));
    }
  });
  if (activeFilters.RISK !== null)
    filtered = filtered.filter((d) => d.default === activeFilters.RISK);

  renderKPIs(
    filtered.length,
    d3.sum(filtered, (d) => d.default)
  );
  renderDemo();
  renderLimitDistribution(filtered);
  renderPaymentHeatmap(filtered);
  renderLineChart(filtered);
  updateBreadcrumbs();
}

function renderKPIs(total, def) {
  const kpi = d3.select("#kpi").html("");
  const rate = total > 0 ? ((def / total) * 100).toFixed(1) : 0;
  const items = [
    { l: "Total Clients", v: total },
    { l: "At Risk", v: def },
    { l: "Risk Rate", v: rate + "%" },
  ];
  items.forEach(function (s) {
    const card = kpi.append("div").attr("class", "kpi-card");
    card.append("h3").text(s.l);
    card.append("p").text(s.v.toLocaleString());
  });
}

function drawStackedBar(containerId, title, column, fixedYMax) {
  const containerNode = d3.select(containerId).node();
  const box = containerNode.getBoundingClientRect();
  const vW = box.width || 400;
  const vH = 400;
  const margin = { top: 20, right: 10, bottom: 50, left: 45 };
  const w = vW - margin.left - margin.right;
  const h = vH - margin.top - margin.bottom;

  d3.select(containerId).html("");

  const svg = d3
    .select(containerId)
    .append("svg")
    .attr("width", "100%")
    .attr("height", vH)
    .attr("viewBox", `0 0 ${vW} ${vH}`)
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  const nested = d3.rollups(
    globalDataRef,
    (v) => v.length,
    (d) => d[column],
    (d) => d.default
  );
  const chartData = nested
    .map(function ([k, v]) {
      const o = { cat: k, total: d3.sum(v, (x) => x[1]), 0: 0, 1: 0 };
      v.forEach(([s, val]) => (o[s] = val));
      return o;
    })
    .sort((a, b) => b.total - a.total);

  const x = d3
    .scaleBand()
    .domain(chartData.map((d) => d.cat))
    .range([0, w])
    .padding(0.4);

  const maxVal = fixedYMax || d3.max(chartData, (d) => d.total);
  const y = d3
    .scaleLinear()
    .domain([0, maxVal * 1.1])
    .range([h, 0]);

  const color = d3
    .scaleOrdinal()
    .domain([0, 1])
    .range([COLOR_ON_TRACK, COLOR_AT_RISK]);

  const xAxis = svg
    .append("g")
    .attr("transform", `translate(0,${h})`)
    .call(d3.axisBottom(x).tickSize(0).tickPadding(12));

  xAxis.select(".domain").remove();
  xAxis
    .selectAll("text")
    .style("text-anchor", "middle")
    .style("font-size", "12px")
    .style("font-weight", "500")
    .style("fill", "#64748b");

  const yAxis = svg
    .append("g")
    .call(
      d3
        .axisLeft(y)
        .ticks(5)
        .tickFormat(d3.format(".2s"))
        .tickSize(-w)
        .tickPadding(12)
    );

  yAxis.select(".domain").remove();
  yAxis
    .selectAll(".tick line")
    .attr("stroke", "#e2e8f0")
    .attr("stroke-dasharray", "2,2");
  yAxis
    .selectAll("text")
    .style("fill", "#64748b")
    .style("font-size", "12px")
    .style("font-weight", "500");

  svg
    .selectAll("g.layer")
    .data(d3.stack().keys([0, 1])(chartData))
    .enter()
    .append("g")
    .attr("fill", (d) => color(d.key))
    .selectAll("rect")
    .data((d) => d)
    .enter()
    .append("rect")
    .attr("class", "clickable-bar")
    .attr("x", (d) => x(d.data.cat))
    .attr("y", (d) => y(d[1]))
    .attr("height", (d) => y(d[0]) - y(d[1]))
    .attr("width", x.bandwidth())
    .attr("rx", 2)
    .classed("bar-selected", (d) => activeFilters[column].includes(d.data.cat))
    .classed("bar-dimmed", (d) => {
      const anyActive = Object.values(activeFilters).some(
        (arr) => Array.isArray(arr) && arr.length > 0
      );
      return anyActive && !activeFilters[column].includes(d.data.cat);
    })
    .on("click", function (event, d) {
      const idx = activeFilters[column].indexOf(d.data.cat);
      if (idx > -1) activeFilters[column].splice(idx, 1);
      else activeFilters[column].push(d.data.cat);
      updateDashboard();
    })
    .on("mousemove", function (event, d) {
      tooltip
        .style("visibility", "visible")
        .html(
          `<strong>${d.data.cat}</strong>
           ${
             d3.select(this.parentNode).datum().key === 1
               ? "At Risk"
               : "On-Track"
           }: 
           ${(d[1] - d[0]).toLocaleString()}`
        )
        .style("top", event.pageY + "px")
        .style("left", event.pageX + "px");
    })
    .on("mouseout", () => tooltip.style("visibility", "hidden"));
}

function renderDemo() {
  const container = d3.select("#demographic").html("");
  const chartConfigs = [
    { id: "sex", t: "Gender", c: "SEX_LABEL" },
    { id: "edu", t: "Education", c: "EDU_LABEL" },
    { id: "mar", t: "Marriage", c: "MARRY_LABEL" },
  ];

  chartConfigs.forEach(function (p) {
    container.append("div").attr("class", "demo-chart-box").attr("id", p.id);
  });

  let globalMax = 0;
  chartConfigs.forEach((config) => {
    const groups = d3.rollups(
      globalDataRef,
      (v) => v.length,
      (d) => d[config.c]
    );
    const localMax = d3.max(groups, (d) => d[1]);
    if (localMax > globalMax) globalMax = localMax;
  });

  chartConfigs.forEach(function (p) {
    drawStackedBar(`#${p.id}`, p.t, p.c, globalMax);
  });
}

function renderLimitDistribution(data) {
  const containerNode = d3.select("#credit").node();
  const box = containerNode.getBoundingClientRect();
  const vW = box.width || 400;
  const vH = 400;

  const container = d3.select("#credit").html("");
  const margin = { top: 20, right: 20, bottom: 50, left: 50 };
  const w = vW - margin.left - margin.right;
  const h = vH - margin.top - margin.bottom;

  const svg = container
    .append("svg")
    .attr("width", "100%")
    .attr("height", vH)
    .attr("viewBox", `0 0 ${vW} ${vH}`)
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  const x = d3
    .scaleLinear()
    .domain([0, d3.max(globalDataRef, (d) => d.limit)])
    .range([0, w]);

  const bins = d3.bin().domain(x.domain()).thresholds(20)(
    data.map((d) => d.limit)
  );

  const y = d3
    .scaleLinear()
    .domain([0, d3.max(bins, (d) => d.length)])
    .range([h, 0]);
  svg
    .selectAll("rect")
    .data(bins)
    .enter()
    .append("rect")
    .attr("x", (d) => x(d.x0) + 1)
    .attr("y", (d) => y(d.length))
    .attr("width", (d) => Math.max(0, x(d.x1) - x(d.x0) - 1))
    .attr("height", (d) => h - y(d.length))
    .attr("fill", COLOR_ON_TRACK)
    .attr("rx", 2)
    .on("mousemove", (event, d) =>
      tooltip
        .style("visibility", "visible")
        .html(
          `<strong>Credit Limit</strong><br/>
           Range: ${d3.format(".2s")(d.x0)} - ${d3.format(".2s")(d.x1)}<br/>
           Clients: ${d.length.toLocaleString()}`
        )
        .style("top", event.pageY + "px")
        .style("left", event.pageX + "px")
    )
    .on("mouseout", () => tooltip.style("visibility", "hidden"));

  const xAxis = svg
    .append("g")
    .attr("transform", `translate(0,${h})`)
    .call(
      d3
        .axisBottom(x)
        .ticks(5)
        .tickFormat(d3.format(".3s"))
        .tickSize(0)
        .tickPadding(12)
    );
  xAxis.select(".domain").remove();
  xAxis
    .selectAll("text")
    .style("fill", "#64748b")
    .style("font-size", "12px")
    .style("font-weight", "500");

  const yAxis = svg
    .append("g")
    .call(d3.axisLeft(y).ticks(5).tickSize(-w).tickPadding(12));
  yAxis.select(".domain").remove();
  yAxis
    .selectAll(".tick line")
    .attr("stroke", "#e2e8f0")
    .attr("stroke-dasharray", "2,2");
  yAxis
    .selectAll("text")
    .style("fill", "#64748b")
    .style("font-size", "12px")
    .style("font-weight", "500");
}

function renderLineChart(dataSubset) {
  const containerNode = d3.select("#Linechart").node();
  const box = containerNode.getBoundingClientRect();
  const vW = box.width || 600;
  const vH = 400;

  const container = d3.select("#Linechart").html("");
  const margin = { top: 20, right: 30, bottom: 50, left: 60 };
  const w = vW - margin.left - margin.right;
  const h = vH - margin.top - margin.bottom;

  const svg = container
    .append("svg")
    .attr("width", "100%")
    .attr("height", vH)
    .attr("viewBox", `0 0 ${vW} ${vH}`)
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  const months = [6, 5, 4, 3, 2, 1],
    labels = ["Apr", "May", "Jun", "Jul", "Aug", "Sep"];
  const getAvg = (sub) =>
    months.map((m, i) => ({
      x: i,
      v: d3.mean(sub, (d) => d[`bill${m}`]) || 0,
      p: d3.mean(sub, (d) => d[`pay${m}`]) || 0,
    }));
  const def = getAvg(dataSubset.filter((d) => d.default === 1)),
    ok = getAvg(dataSubset.filter((d) => d.default === 0));
  const yMax = d3.max([...def, ...ok].flatMap((d) => [d.v, d.p])) || 1000;

  const x = d3.scaleLinear().domain([0, 5]).range([0, w]);
  const y = d3
    .scaleLinear()
    .domain([0, yMax * 1.1])
    .range([h, 0]);

  const xAxis = svg
    .append("g")
    .attr("transform", `translate(0,${h})`)
    .call(
      d3
        .axisBottom(x)
        .tickFormat((i) => labels[i])
        .tickSize(0)
        .tickPadding(12)
    );
  xAxis.select(".domain").remove();
  xAxis
    .selectAll("text")
    .style("fill", "#64748b")
    .style("font-size", "12px")
    .style("font-weight", "500");

  const yAxis = svg
    .append("g")
    .call(
      d3.axisLeft(y).tickFormat(d3.format(".2s")).tickSize(-w).tickPadding(12)
    );
  yAxis.select(".domain").remove();
  yAxis
    .selectAll(".tick line")
    .attr("stroke", "#e2e8f0")
    .attr("stroke-dasharray", "2,2");
  yAxis
    .selectAll("text")
    .style("fill", "#64748b")
    .style("font-size", "12px")
    .style("font-weight", "500");

  const lineB = d3
      .line()
      .x((d) => x(d.x))
      .y((d) => y(d.v))
      .curve(d3.curveMonotoneX),
    lineP = d3
      .line()
      .x((d) => x(d.x))
      .y((d) => y(d.p))
      .curve(d3.curveMonotoneX);

  const configs = [
    { d: def, c: COLOR_AT_RISK, l: "At Risk: Bill", type: "b", s: "solid" },
    { d: def, c: COLOR_AT_RISK, l: "At Risk: Pay", type: "p", s: "dashed" },
    { d: ok, c: COLOR_ON_TRACK, l: "On-Track: Bill", type: "b", s: "solid" },
    { d: ok, c: COLOR_ON_TRACK, l: "On-Track: Pay", type: "p", s: "dashed" },
  ];
  configs.forEach(function (cfg) {
    if (cfg.d.every((d) => d.v === 0 && d.p === 0)) return;
    svg
      .append("path")
      .datum(cfg.d)
      .attr("fill", "none")
      .attr("stroke", cfg.c)
      .attr("stroke-width", 2)
      .attr("stroke-dasharray", cfg.s === "dashed" ? "4,4" : "0")
      .attr("d", cfg.type === "b" ? lineB : lineP)
      .attr("opacity", 0.9);

    svg
      .selectAll(".dot-" + cfg.l.replace(/[\s:]/g, ""))
      .data(cfg.d)
      .enter()
      .append("circle")
      .attr("r", 4)
      .attr("cx", (d) => x(d.x))
      .attr("cy", (d) => (cfg.type === "b" ? y(d.v) : y(d.p)))
      .attr("fill", "white")
      .attr("stroke", cfg.c)
      .attr("stroke-width", 2)
      .on("mousemove", (event, d) =>
        tooltip
          .style("visibility", "visible")
          .html(
            `<strong>${cfg.l}</strong><br/>
             Month: ${labels[d.x]}<br/>
             Amount: NT$ ${Math.round(
               cfg.type === "b" ? d.v : d.p
             ).toLocaleString()}`
          )
          .style("top", event.pageY + "px")
          .style("left", event.pageX + "px")
      )
      .on("mouseout", () => tooltip.style("visibility", "hidden"));
  });

  const legend = d3.select("#line-legend").html("");
  configs.forEach(function (cfg) {
    const item = legend.append("div").attr("class", "legend-item");
    item
      .append("div")
      .attr("class", `legend-line ${cfg.s === "dashed" ? "line-dashed" : ""}`)
      .style(
        "border-top",
        `2px ${cfg.s === "dashed" ? "dashed" : "solid"} ${cfg.c}`
      );
    item.append("span").text(cfg.l);
  });
}

function renderPaymentHeatmap(dataSubset) {
  const containerNode = d3.select("#payment-placeholder").node();
  const box = containerNode.getBoundingClientRect();
  const vW = box.width || 400;
  const vH = 320;

  const container = d3.select("#payment-placeholder").html("");
  const margin = { top: 30, right: 20, bottom: 40, left: 100 };
  const w = vW - margin.left - margin.right;
  const h = vH - margin.top - margin.bottom;

  const months = [
    { key: "PAY_0", label: "Sep" },
    { key: "PAY_2", label: "Aug" },
    { key: "PAY_3", label: "Jul" },
    { key: "PAY_4", label: "Jun" },
    { key: "PAY_5", label: "May" },
    { key: "PAY_6", label: "Apr" },
  ];

  const groups = [
    { label: "On-Track", value: 0 },
    { label: "At Risk", value: 1 },
  ];

  // Prepare aggregated data
  const heatmapData = [];
  groups.forEach((g) => {
    months.forEach((m) => {
      const avg = d3.mean(
        dataSubset.filter((d) => d.default === g.value),
        (d) => +d[m.key]
      );
      heatmapData.push({
        group: g.label,
        month: m.label,
        value: avg ?? 0,
      });
    });
  });

  const svg = container
    .append("svg")
    .attr("width", "100%")
    .attr("height", vH)
    .attr("viewBox", `0 0 ${vW} ${vH}`)
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  const x = d3
    .scaleBand()
    .domain(months.map((d) => d.label))
    .range([0, w])
    .padding(0.05);

  const y = d3
    .scaleBand()
    .domain(groups.map((d) => d.label))
    .range([0, h])
    .padding(0.1);

  const color = d3.scaleDiverging(d3.interpolateRdBu).domain([2, 0, -1]);

  // Axes
  const xAxis = svg
    .append("g")
    .attr("transform", `translate(0,${h})`)
    .call(d3.axisBottom(x).tickSize(0).tickPadding(12));
  xAxis.select(".domain").remove();
  xAxis
    .selectAll("text")
    .style("fill", "#64748b")
    .style("font-size", "12px")
    .style("font-weight", "500");

  const yAxis = svg
    .append("g")
    .call(d3.axisLeft(y).tickSize(0).tickPadding(12));
  yAxis.select(".domain").remove();
  yAxis
    .selectAll("text")
    .style("fill", "#64748b")
    .style("font-weight", "600")
    .style("font-size", "12px");

  // Heatmap cells
  svg
    .selectAll("rect")
    .data(heatmapData)
    .enter()
    .append("rect")
    .attr("x", (d) => x(d.month))
    .attr("y", (d) => y(d.group))
    .attr("width", x.bandwidth())
    .attr("height", y.bandwidth())
    .attr("fill", (d) => color(d.value))
    .attr("rx", 4)
    .on("mousemove", (event, d) => {
      tooltip
        .style("visibility", "visible")
        .html(
          `<strong>${d.group}</strong><br/>
           Month: ${d.month}<br/>
           Avg Delay: ${d.value.toFixed(2)} months`
        )
        .style("top", event.pageY + "px")
        .style("left", event.pageX + "px");
    })
    .on("mouseout", () => tooltip.style("visibility", "hidden"));
}

function updateBreadcrumbs() {
  let p = [];
  if (activeFilters.SEX_LABEL.length)
    p.push(activeFilters.SEX_LABEL.join(", "));
  if (activeFilters.EDU_LABEL.length)
    p.push(activeFilters.EDU_LABEL.join(", "));
  if (activeFilters.MARRY_LABEL.length)
    p.push(activeFilters.MARRY_LABEL.join(", "));
  if (activeFilters.RISK === 1) p.push("At Risk");
  if (activeFilters.RISK === 0) p.push("On-Track");

  const text = p.length ? p.join(" + ") : "All Clients";
  d3.select("#filter-summary").text(text);
}
