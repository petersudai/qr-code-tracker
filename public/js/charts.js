/* Renders the scans-over-time chart and the scan-location map.
   Expects window.ZIP = { timeline:[{date,count}], points:[{lat,lon,city,country,timestamp}] } */
(function () {
  const data = window.ZIP || {};

  // ---- Timeline chart ----
  const canvas = document.getElementById('timelineChart');
  if (canvas && window.Chart && data.timeline) {
    const ctx = canvas.getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, 0, 160);
    grad.addColorStop(0, 'rgba(16,185,129,0.35)');
    grad.addColorStop(1, 'rgba(16,185,129,0.0)');

    const labels = data.timeline.map(d =>
      new Date(d.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
    );

    new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          data: data.timeline.map(d => d.count),
          borderColor: '#34d399',
          backgroundColor: grad,
          fill: true,
          tension: 0.4,
          borderWidth: 2.5,
          pointRadius: 0,
          pointHoverRadius: 5,
          pointHoverBackgroundColor: '#34d399',
          pointHoverBorderColor: '#06140e'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#0d1322',
            borderColor: 'rgba(255,255,255,0.1)',
            borderWidth: 1,
            titleColor: '#e2e8f0',
            bodyColor: '#34d399',
            padding: 10,
            displayColors: false,
            callbacks: { label: c => `${c.parsed.y} scan${c.parsed.y === 1 ? '' : 's'}` }
          }
        },
        scales: {
          x: { grid: { display: false }, ticks: { color: '#64748b', maxRotation: 0, autoSkipPadding: 16 } },
          y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#64748b', precision: 0, maxTicksLimit: 5 } }
        }
      }
    });
  }

  // ---- Map ----
  const mapEl = document.getElementById('map');
  if (mapEl && window.L && data.points && data.points.length) {
    const map = L.map('map', { scrollWheelZoom: false, attributionControl: true });
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '© OpenStreetMap © CARTO',
      maxZoom: 18
    }).addTo(map);

    const latlngs = [];
    data.points.forEach(p => {
      const m = L.circleMarker([p.lat, p.lon], {
        radius: 6, color: '#34d399', weight: 2, fillColor: '#10b981', fillOpacity: 0.6
      }).addTo(map);
      const where = [p.city, p.country].filter(Boolean).join(', ') || 'Unknown';
      const when = p.timestamp ? new Date(p.timestamp).toLocaleString('en-GB') : '';
      m.bindPopup(`<strong>${where}</strong>${when ? '<br><span style="color:#94a3b8">' + when + '</span>' : ''}`);
      latlngs.push([p.lat, p.lon]);
    });

    if (latlngs.length === 1) map.setView(latlngs[0], 6);
    else map.fitBounds(latlngs, { padding: [30, 30], maxZoom: 10 });
  }
})();
