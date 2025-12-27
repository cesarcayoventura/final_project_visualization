
d3.csv("data/default_of_credit_card_clients.csv").then(data => {

  data.forEach(d => {
    d.default = +d["default payment next month"];
    d.limit = +d.LIMIT_BAL;
  });

  const totalClients = data.length;
  const totalDefaults = d3.sum(data, d => d.default);
  const defaultRate = (totalDefaults / totalClients) * 100;

  renderKPIs(totalClients, totalDefaults, defaultRate);

  renderDemo();
  renderLimitDistribution(data);
  renderHeat();
  renderLineChart();
});

const renderKPIs = (total, defaults, rate) => {
  const kpi = d3.select("#kpi");
  kpi.html("");

  const kpiData = [
    { label: "Total Clients", value: total },
    { label: "Clients in Default", value: defaults },
    { label: "Default Rate (%)", value: rate.toFixed(2) }
  ];

  const cards = kpi.selectAll(".kpi-card")
    .data(kpiData)
    .enter()
    .append("div")
    .attr("class", "kpi-card");

  cards.append("h3").text(d => d.label);
  cards.append("p").text(d => d.value);
}

const renderDemo = () => {
    // TODO By Rasmi
}

const renderHeat = () => {
    // TODO By Abdul
}

const renderLineChart = () => {
    // TODO By Gopi
}

const renderLimitDistribution = (data) => {
// Dimentions
  const margin = {top: 20, right: 30, bottom: 40, left: 50};
  const width = 700 - margin.left - margin.right;
  const height = 400 - margin.top - margin.bottom;

  // create SVG
  const svg = d3.select("#credit")
    .append("svg")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom)
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  // scala X
  const x = d3.scaleLinear()
    .domain([0, d3.max(data, d => d.limit)]) // máximo LIMIT_BAL
    .nice()
    .range([0, width]);

  // Generate bins
  const bins = d3.bin()
    .domain(x.domain())
    .thresholds(30) // número de barras
    (data.map(d => d.limit));

  // scala Y
  const y = d3.scaleLinear()
    .domain([0, d3.max(bins, d => d.length)])
    .nice()
    .range([height, 0]);

  // draw bars
  svg.selectAll("rect")
    .data(bins)
    .enter()
    .append("rect")
      .attr("x", d => x(d.x0) + 1)
      .attr("y", d => y(d.length))
      .attr("width", d => x(d.x1) - x(d.x0) - 1)
      .attr("height", d => height - y(d.length))
      .attr("fill", "#4e79a7")
        .on("mouseover", function(event, d) {
      d3.select(this)
        .transition()
        .duration(200)
        .attr("fill", "#e15759"); // color al pasar el mouse
  })
  .on("mouseout", function(event, d) {
      d3.select(this)
        .transition()
        .duration(200)
        .attr("fill", "#4e79a7"); // color original al salir
  });

  // axis
  svg.append("g")
    .attr("transform", `translate(0,${height})`)
    .call(d3.axisBottom(x).ticks(8).tickFormat(d3.format(".2s")));

  svg.append("g")
    .call(d3.axisLeft(y));

  // labels
  svg.append("text")
    .attr("x", width/2)
    .attr("y", height + margin.bottom - 5)
    .attr("text-anchor", "middle")
    .text("Credit Limit (LIMIT_BAL)");

  svg.append("text")
    .attr("x", -height/2)
    .attr("y", -margin.left + 15)
    .attr("transform", "rotate(-90)")
    .attr("text-anchor", "middle")
    .text("Number of Clients");
}


