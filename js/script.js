const eduMap = { 1: "Graduate School", 2: "University", 3: "High School", 4: "Others", 5: "Others", 6: "Others", 0: "Others" };
const sexMap = { 1: "Male", 2: "Female" };
const marriageMap = { 1: "Married", 2: "Single", 3: "Others", 0: "Others" };

let globalDataRef = [];
let activeFilters = { SEX_LABEL: [], EDU_LABEL: [], MARRY_LABEL: [], RISK: null };
const tooltip = d3.select("#tooltip");

d3.csv("data/default_of_credit_card_clients.csv").then(function(data) {
    data.forEach(function(d) {
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
    d3.selectAll(".toggle-item").on("click", function() {
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
    Object.keys(activeFilters).forEach(function(key) {
        if (key !== 'RISK' && activeFilters[key].length > 0) {
            filtered = filtered.filter(d => activeFilters[key].includes(d[key]));
        }
    });
    if (activeFilters.RISK !== null) filtered = filtered.filter(d => d.default === activeFilters.RISK);

    renderKPIs(filtered.length, d3.sum(filtered, d => d.default));
    renderDemo();
    renderLimitDistribution(filtered);
    renderPaymentHeatmap(filtered); 
    renderLineChart(filtered);
    updateBreadcrumbs();
}

function renderKPIs(total, def) {
    const kpi = d3.select("#kpi").html("");
    const rate = total > 0 ? ((def / total) * 100).toFixed(1) : 0;
    const items = [{l: "Total Population", v: total}, {l: "Defaulters at Risk", v: def}, {l: "Group Risk Rate", v: rate + "%"}];
    items.forEach(function(s) {
        const card = kpi.append("div").attr("class", "kpi-card");
        card.append("h3").text(s.l);
        card.append("p").text(s.v.toLocaleString());
    });
}

function drawStackedBar(containerId, title, column) {
    const vW = 320, vH = 380, margin = {top: 30, right: 10, bottom: 80, left: 60};
    const w = vW - margin.left - margin.right, h = vH - margin.top - margin.bottom;
    const svg = d3.select(containerId).append("svg").attr("viewBox", `0 0 ${vW} ${vH}`).append("g").attr("transform", `translate(${margin.left},${margin.top})`);
    
    const nested = d3.rollups(globalDataRef, v => v.length, d => d[column], d => d.default);
    const chartData = nested.map(function([k, v]) {
        const o = { cat: k, total: d3.sum(v, x => x[1]), 0: 0, 1: 0 };
        v.forEach(([s, val]) => o[s] = val);
        return o;
    }).sort((a,b) => b.total - a.total);

    const x = d3.scaleBand().domain(chartData.map(d => d.cat)).range([0, w]).padding(0.4);
    const y = d3.scaleLinear().domain([0, d3.max(chartData, d => d.total) * 1.1]).range([h, 0]);
    const color = d3.scaleOrdinal().domain([0, 1]).range(["#4e79a7", "#f28e2c"]);

    svg.append("g").attr("transform", `translate(0,${h})`).call(d3.axisBottom(x)).selectAll("text")
       .attr("transform", "rotate(-35)").style("text-anchor", "end");
    svg.append("g").call(d3.axisLeft(y).ticks(5).tickFormat(d3.format(".1s")));

    svg.selectAll("g.layer").data(d3.stack().keys([0, 1])(chartData)).enter().append("g").attr("fill", d => color(d.key))
        .selectAll("rect").data(d => d).enter().append("rect")
        .attr("class", "clickable-bar")
        .attr("x", d => x(d.data.cat)).attr("y", d => y(d[1])).attr("height", d => y(d[0]) - y(d[1])).attr("width", x.bandwidth())
        .classed("bar-selected", d => activeFilters[column].includes(d.data.cat))
        .classed("bar-dimmed", d => {
            const anyActive = Object.values(activeFilters).some(arr => Array.isArray(arr) && arr.length > 0);
            return anyActive && !activeFilters[column].includes(d.data.cat);
        })
        .on("click", function(event, d) {
            const idx = activeFilters[column].indexOf(d.data.cat);
            if (idx > -1) activeFilters[column].splice(idx, 1);
            else activeFilters[column].push(d.data.cat);
            updateDashboard();
        })
        .on("mousemove", function(event, d) {
            tooltip.style("visibility", "visible")
                   .html(`<strong>Category: ${d.data.cat}</strong><br/>Type: ${d3.select(this.parentNode).datum().key === 1 ? 'Defaulter' : 'On-Track'}<br/>Clients: ${(d[1]-d[0]).toLocaleString()}`)
                   .style("top", (event.pageY - 15) + "px").style("left", (event.pageX + 15) + "px");
        })
        .on("mouseout", () => tooltip.style("visibility", "hidden"));

    svg.append("text").attr("x", w/2).attr("y", -10).attr("text-anchor", "middle").style("font-weight", "800").style("font-size", "18px").text(title);
}

function renderDemo() {
    const container = d3.select("#demographic").html("");
    [{id:"sex", t:"Gender", c:"SEX_LABEL"}, {id:"edu", t:"Education", c:"EDU_LABEL"}, {id:"mar", t:"Marriage", c:"MARRY_LABEL"}].forEach(function(p) {
        container.append("div").attr("class", "demo-chart-box").attr("id", p.id);
        drawStackedBar(`#${p.id}`, p.t, p.c);
    });
}

function renderLimitDistribution(data) {
    const container = d3.select("#credit").html("");
    const vW = 400, vH = 320, margin = {top: 20, right: 20, bottom: 40, left: 60};
    const w = vW - margin.left - margin.right, h = vH - margin.top - margin.bottom;
    const svg = container.append("svg").attr("viewBox", `0 0 ${vW} ${vH}`).append("g").attr("transform", `translate(${margin.left},${margin.top})`);
    const x = d3.scaleLinear().domain([0, d3.max(globalDataRef, d => d.limit)]).range([0, w]);
    const bins = d3.bin().domain(x.domain()).thresholds(20)(data.map(d => d.limit));
    const y = d3.scaleLinear().domain([0, d3.max(bins, d => d.length)]).range([h, 0]);
    svg.selectAll("rect").data(bins).enter().append("rect").attr("x", d => x(d.x0) + 1).attr("y", d => y(d.length)).attr("width", d => Math.max(0, x(d.x1) - x(d.x0) - 1)).attr("height", d => h - y(d.length)).attr("fill", "#4e79a7")
       .on("mousemove", (event, d) => tooltip.style("visibility", "visible").html(`Credit Range: NT$ ${d.x0.toLocaleString()} - ${d.x1.toLocaleString()}<br/>Clients: ${d.length.toLocaleString()}`).style("top", (event.pageY - 15) + "px").style("left", (event.pageX + 15) + "px"))
       .on("mouseout", () => tooltip.style("visibility", "hidden"));
    svg.append("g").attr("transform", `translate(0,${h})`).call(d3.axisBottom(x).ticks(5).tickFormat(d3.format(".1s")));
    svg.append("g").call(d3.axisLeft(y).ticks(5));
}

function renderLineChart(dataSubset) {
    const container = d3.select("#Linechart").html("");
    const vW = 850, vH = 400, margin = {top: 20, right: 30, bottom: 60, left: 65};
    const w = vW - margin.left - margin.right, h = vH - margin.top - margin.bottom;
    const svg = container.append("svg").attr("viewBox", `0 0 ${vW} ${vH}`).append("g").attr("transform", `translate(${margin.left},${margin.top})`);
    const months = [6, 5, 4, 3, 2, 1], labels = ["Apr", "May", "Jun", "Jul", "Aug", "Sep"];
    const getAvg = sub => months.map((m, i) => ({x: i, v: d3.mean(sub, d => d[`bill${m}`]) || 0, p: d3.mean(sub, d => d[`pay${m}`]) || 0}));
    const def = getAvg(dataSubset.filter(d => d.default === 1)), ok = getAvg(dataSubset.filter(d => d.default === 0));
    const yMax = d3.max([...def, ...ok].flatMap(d => [d.v, d.p])) || 1000;
    const x = d3.scaleLinear().domain([0, 5]).range([0, w]), y = d3.scaleLinear().domain([0, yMax * 1.1]).range([h, 0]);
    svg.append("g").attr("transform", `translate(0,${h})`).call(d3.axisBottom(x).tickFormat(i => labels[i]));
    svg.append("g").call(d3.axisLeft(y).tickFormat(d3.format(".1s")));
    const lineB = d3.line().x(d => x(d.x)).y(d => y(d.v)), lineP = d3.line().x(d => x(d.x)).y(d => y(d.p));
    const configs = [{d: def, c: "#f28e2c", l: "Defaulter Bill", type: 'b', s: "line-solid"}, {d: def, c: "#f28e2c", l: "Defaulter Pay", type: 'p', s: "line-dashed"}, {d: ok, c: "#4e79a7", l: "On-Track Bill", type: 'b', s: "line-solid"}, {d: ok, c: "#4e79a7", l: "On-Track Pay", type: 'p', s: "line-dashed"}];
    configs.forEach(function(cfg) {
        if (cfg.d.every(d => d.v === 0 && d.p === 0)) return;
        svg.append("path").datum(cfg.d).attr("fill", "none").attr("stroke", cfg.c).attr("stroke-width", 2)
           .attr("stroke-dasharray", cfg.s === "line-dashed" ? "8,8" : "0").attr("d", cfg.type === 'b' ? lineB : lineP);
        
        svg.selectAll(".dot-" + cfg.l.replace(/\s+/g, '')).data(cfg.d).enter().append("circle").attr("r", 4).attr("cx", d => x(d.x)).attr("cy", d => cfg.type === 'b' ? y(d.v) : y(d.p)).attr("fill", cfg.c)
           .on("mousemove", (event, d) => tooltip.style("visibility", "visible").html(`<strong>Month: ${labels[d.x]}</strong><br/>Amount: NT$ ${Math.round(cfg.type === 'b' ? d.v : d.p).toLocaleString()}`).style("top", (event.pageY - 15) + "px").style("left", (event.pageX + 15) + "px"))
           .on("mouseout", () => tooltip.style("visibility", "hidden"));
    });
    const legend = d3.select("#line-legend").html("");
    configs.forEach(function(cfg) {
        const item = legend.append("div").attr("class", "legend-item");
        item.append("div").attr("class", `legend-line ${cfg.s}`).style("border-top-color", cfg.c);
        item.append("span").text(cfg.l);
    });
}

// Heatmap

function renderPaymentHeatmap(dataSubset) {

    const container = d3.select("#payment-placeholder").html("");

    const months = [
        { key: "PAY_0", label: "Sep" },
        { key: "PAY_2", label: "Aug" },
        { key: "PAY_3", label: "Jul" },
        { key: "PAY_4", label: "Jun" },
        { key: "PAY_5", label: "May" },
        { key: "PAY_6", label: "Apr" }
    ];

    const groups = [
        { label: "On-Track", value: 0 },
        { label: "At Risk", value: 1 }
    ];

    // Prepare aggregated data
    const heatmapData = [];
    groups.forEach(g => {
        months.forEach(m => {
            const avg = d3.mean(
                dataSubset.filter(d => d.default === g.value),
                d => +d[m.key]
            );
            heatmapData.push({
                group: g.label,
                month: m.label,
                value: avg ?? 0
            });
        });
    });

    const vW = 500, vH = 260;
    const margin = { top: 40, right: 30, bottom: 40, left: 120 };
    const w = vW - margin.left - margin.right;
    const h = vH - margin.top - margin.bottom;

    const svg = container.append("svg")
        .attr("viewBox", `0 0 ${vW} ${vH}`)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    const x = d3.scaleBand()
        .domain(months.map(d => d.label))
        .range([0, w])
        .padding(0.05);

    const y = d3.scaleBand()
        .domain(groups.map(d => d.label))
        .range([0, h])
        .padding(0.1);

    const color = d3.scaleSequential()
        .domain([4, -2])   // severe delay → red, early/on-time → green
        .interpolator(d3.interpolateRdYlGn);

    // Axes
    svg.append("g")
        .attr("transform", `translate(0,${h})`)
        .call(d3.axisBottom(x));

    svg.append("g")
        .call(d3.axisLeft(y));

    // Heatmap cells
    svg.selectAll("rect")
        .data(heatmapData)
        .enter()
        .append("rect")
        .attr("x", d => x(d.month))
        .attr("y", d => y(d.group))
        .attr("width", x.bandwidth())
        .attr("height", y.bandwidth())
        .attr("fill", d => color(d.value))
        .on("mousemove", (event, d) => {
            tooltip.style("visibility", "visible")
                .html(`
                    <strong>${d.group}</strong><br/>
                    Month: ${d.month}<br/>
                    Avg Delay: ${d.value.toFixed(2)} months
                `)
                .style("top", (event.pageY - 15) + "px")
                .style("left", (event.pageX + 15) + "px");
        })
        .on("mouseout", () => tooltip.style("visibility", "hidden"));
}


function updateBreadcrumbs() {
    let p = [];
    if (activeFilters.SEX_LABEL.length) p.push(activeFilters.SEX_LABEL.join(" & "));
    if (activeFilters.EDU_LABEL.length) p.push(activeFilters.EDU_LABEL.join(" & "));
    if (activeFilters.MARRY_LABEL.length) p.push(activeFilters.MARRY_LABEL.join(" & "));
    if (activeFilters.RISK === 1) p.push("At Risk");
    if (activeFilters.RISK === 0) p.push("On-Track");
    d3.select("#filter-summary").text(p.length ? p.join(" + ") : "Showing All Clients");
}