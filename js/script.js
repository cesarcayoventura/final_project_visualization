// Full labels for Education
const eduMap = { 1: "Graduate School", 2: "University", 3: "High School", 4: "Others", 5: "Others", 6: "Others", 0: "Others" };
const sexMap = { 1: "Male", 2: "Female" };
const marriageMap = { 1: "Married", 2: "Single", 3: "Others", 0: "Others" };

let globalDataRef = [];
const tooltip = d3.select("#tooltip");

d3.csv("data/default_of_credit_card_clients.csv").then(data => {
    
    data.forEach(d => {
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

    // Verification logs
    console.log("Unique Education values:", [...new Set(data.map(d => d.EDUCATION))]);
    console.log("Unique Marriage values:", [...new Set(data.map(d => d.MARRIAGE))]);

    globalDataRef = data;
    renderKPIs(data.length, d3.sum(data, d => d.default));
    renderDemo(data);
    renderLimitDistribution(data);
    renderLineChart(data);

    d3.select("#reset-btn").on("click", () => {
        d3.selectAll("rect").style("opacity", 1);
        renderDemo(globalDataRef);
        renderLineChart(globalDataRef);
    });
});

const renderKPIs = (total, def) => {
    const kpi = d3.select("#kpi").html("");
    const rate = ((def / total) * 100).toFixed(2);
    const stats = [{l: "Total Clients", v: total}, {l: "Clients in Default", v: def}, {l: "Default Rate (%)", v: rate}];
    stats.forEach(s => {
        const card = kpi.append("div").attr("class", "kpi-card");
        card.append("h3").text(s.l);
        card.append("p").text(s.v);
    });
};

const renderDemo = (data) => {
    const container = d3.select("#demographic").html("");
    const plots = [{id: "sex-chart", t: "Gender", c: "SEX_LABEL"}, {id: "edu-chart", t: "Education Level", c: "EDU_LABEL"}, {id: "mar-chart", t: "Marital Status", c: "MARRY_LABEL"}];
    plots.forEach(p => {
        container.append("div").attr("class", "demo-chart-box").attr("id", p.id);
        drawStackedBar(`#${p.id}`, p.t, p.c, data);
    });
};

function drawStackedBar(containerId, title, column, data) {
    const vW = 300, vH = 400;
    const margin = {top: 40, right: 10, bottom: 80, left: 50};
    const w = vW - margin.left - margin.right, h = vH - margin.top - margin.bottom;

    const svg = d3.select(containerId).append("svg").attr("viewBox", `0 0 ${vW} ${vH}`)
                .append("g").attr("transform", `translate(${margin.left},${margin.top})`);

    const nested = d3.rollups(data, v => v.length, d => d[column], d => d.default);
    const chartData = nested.map(([k, v]) => {
        const o = { cat: k, total: d3.sum(v, x => x[1]), 0: 0, 1: 0 };
        v.forEach(([s, val]) => o[s] = val);
        return o;
    }).sort((a,b) => b.total - a.total);

    const x = d3.scaleBand().domain(chartData.map(d => d.cat)).range([0, w]).padding(0.4);
    const y = d3.scaleLinear().domain([0, d3.max(chartData, d => d.total) * 1.05]).range([h, 0]);
    const color = d3.scaleOrdinal().domain([0, 1]).range(["#4e79a7", "#f28e2c"]);

    svg.append("g").attr("transform", `translate(0,${h})`).call(d3.axisBottom(x)).selectAll("text").attr("transform", "rotate(-45)").style("text-anchor", "end");
    svg.append("g").call(d3.axisLeft(y).ticks(5).tickFormat(d3.format(".1s")));

    svg.selectAll("g.layer").data(d3.stack().keys([0, 1])(chartData)).enter().append("g").attr("fill", d => color(d.key))
        .selectAll("rect").data(d => d).enter().append("rect")
        .attr("x", d => x(d.data.cat)).attr("y", d => y(d[1])).attr("height", d => y(d[0]) - y(d[1])).attr("width", x.bandwidth())
        .style("cursor", "pointer")
        .on("click", (event, d) => {
            const selected = d.data.cat;
            d3.selectAll("#demographic rect").style("opacity", 0.2);
            d3.select(containerId).selectAll("rect").filter(r => r && r.data && r.data.cat === selected).style("opacity", 1);
            renderLineChart(globalDataRef.filter(r => r[column] === selected));
        });

    chartData.forEach(d => {
        svg.append("text").attr("x", x(d.cat) + x.bandwidth()/2).attr("y", y(d.total) - 8).attr("text-anchor", "middle").style("font-size", "11px").style("fill", "#d45113").text(((d[1]/d.total)*100).toFixed(1) + "% Risk");
    });
    svg.append("text").attr("x", w/2).attr("y", -15).attr("text-anchor", "middle").attr("class", "chart-title").text(title);
}

const renderLimitDistribution = (data) => {
    const container = d3.select("#credit").html("");
    const vW = 400, vH = 300;
    const margin = {top: 20, right: 20, bottom: 40, left: 50};
    const w = vW - margin.left - margin.right, h = vH - margin.top - margin.bottom;

    const svg = container.append("svg").attr("viewBox", `0 0 ${vW} ${vH}`).append("g").attr("transform", `translate(${margin.left},${margin.top})`);
    const x = d3.scaleLinear().domain([0, d3.max(data, d => d.limit)]).nice().range([0, w]);
    const bins = d3.bin().domain(x.domain()).thresholds(25)(data.map(d => d.limit));
    const y = d3.scaleLinear().domain([0, d3.max(bins, d => d.length)]).nice().range([h, 0]);

    svg.selectAll("rect").data(bins).enter().append("rect")
        .attr("x", d => x(d.x0) + 1).attr("y", d => y(d.length)).attr("width", d => Math.max(0, x(d.x1) - x(d.x0) - 1)).attr("height", d => h - y(d.length)).attr("fill", "#4e79a7");
    svg.append("g").attr("transform", `translate(0,${h})`).call(d3.axisBottom(x).ticks(5).tickFormat(d3.format(".1s")));
    svg.append("g").call(d3.axisLeft(y).ticks(5).tickFormat(d3.format(".1s")));
    svg.append("text").attr("x", w/2).attr("y", h + 35).attr("text-anchor", "middle").style("font-size", "12px").text("Credit Limit (NT$)");
};

const renderLineChart = (dataSubset) => {
    const container = d3.select("#Linechart").html("");
    const vW = 800, vH = 400;
    const margin = {top: 40, right: 180, bottom: 50, left: 80};
    const w = vW - margin.left - margin.right, h = vH - margin.top - margin.bottom;

    const svg = container.append("svg").attr("viewBox", `0 0 ${vW} ${vH}`).append("g").attr("transform", `translate(${margin.left},${margin.top})`);
    const months = [6, 5, 4, 3, 2, 1], labels = ["Apr", "May", "Jun", "Jul", "Aug", "Sep"];
    const getAvg = (sub) => ({
        b: months.map((m, i) => ({x: i, v: d3.mean(sub, d => d[`bill${m}`]) || 0})),
        p: months.map((m, i) => ({x: i, v: d3.mean(sub, d => d[`pay${m}`]) || 0}))
    });

    const def = getAvg(dataSubset.filter(d => d.default === 1)), ok = getAvg(dataSubset.filter(d => d.default === 0));
    const yMax = d3.max([...def.b, ...ok.b].map(v => v.v)) || 1000;
    const x = d3.scaleLinear().domain([0, 5]).range([0, w]), y = d3.scaleLinear().domain([0, yMax * 1.1]).range([h, 0]).nice();

    svg.append("g").attr("transform", `translate(0,${h})`).call(d3.axisBottom(x).tickFormat(i => labels[i]));
    svg.append("g").call(d3.axisLeft(y).ticks(5).tickFormat(d3.format(".1s")));

    const line = d3.line().x(d => x(d.x)).y(d => y(d.v)).curve(d3.curveMonotoneX);
    const configs = [
        {l: "Avg Bill (Defaulter)", c: "#E74C3C", d: def.b, s: "0"}, 
        {l: "Avg Pay (Defaulter)", c: "#E74C3C", d: def.p, s: "3,3"}, 
        {l: "Avg Bill (On-Track)", c: "#4e79a7", d: ok.b, s: "0"}, 
        {l: "Avg Pay (On-Track)", c: "#4e79a7", d: ok.p, s: "3,3"}
    ];

    configs.forEach((cfg, i) => {
        svg.append("path").datum(cfg.d).attr("fill", "none").attr("stroke", cfg.c).attr("stroke-width", 2).attr("stroke-dasharray", cfg.s).attr("d", line);
        svg.append("text").attr("x", w + 10).attr("y", i * 20 + 5).text(cfg.l).style("font-size", "12px").attr("fill", cfg.c).attr("alignment-baseline", "middle");
    });
};