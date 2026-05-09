// js/analytics-radar.js
// 共用雷達圖元件，所有分析頁面引用此檔

window.RadarChart = {
  /**
   * 在指定 canvas 上繪製三條線的雷達圖。
   * @param {string} canvasId - canvas 元素的 id
   * @param {Object} data - { labels, self, average, top, top_player }
   */
  render(canvasId, data) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    if (canvas._chartInstance) canvas._chartInstance.destroy();

    const ctx = canvas.getContext('2d');
    canvas._chartInstance = new Chart(ctx, {
      type: 'radar',
      data: {
        labels: data.labels || ['速度','正確率','穩定度','記憶力','推理能力','各科綜合'],
        datasets: [
          {
            label: '我',
            data: data.self || [],
            backgroundColor: 'rgba(124,58,237,0.25)',
            borderColor: '#7c3aed',
            borderWidth: 2,
            pointBackgroundColor: '#7c3aed',
            pointRadius: 4,
          },
          {
            label: '全體平均',
            data: data.average || [],
            backgroundColor: 'rgba(148,163,184,0.15)',
            borderColor: '#94a3b8',
            borderWidth: 1.5,
            borderDash: [4, 4],
            pointBackgroundColor: '#94a3b8',
            pointRadius: 3,
          },
          {
            label: data.top_player || '第一名',
            data: data.top || [],
            backgroundColor: 'rgba(251,191,36,0.15)',
            borderColor: '#fbbf24',
            borderWidth: 2,
            pointBackgroundColor: '#fbbf24',
            pointRadius: 3,
          },
        ],
      },
      options: {
        responsive: true,
        animation: { duration: 1200, easing: 'easeInOutQuart' },
        plugins: {
          legend: {
            labels: { color: '#e9d5ff', font: { size: 12 } },
          },
        },
        scales: {
          r: {
            min: 0,
            max: 100,
            ticks: { color: '#6d28d9', backdropColor: 'transparent', stepSize: 20 },
            grid: { color: 'rgba(139,92,246,0.2)' },
            angleLines: { color: 'rgba(139,92,246,0.3)' },
            pointLabels: { color: '#c4b5fd', font: { size: 12 } },
          },
        },
      },
    });
  },

  /**
   * 從 API 取得雷達資料並渲染。
   * @param {string} canvasId
   * @param {string} playerName
   */
  async loadAndRender(canvasId, playerName) {
    try {
      const res = await fetch(`/api/radar/${encodeURIComponent(playerName)}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      this.render(canvasId, data);
    } catch (e) {
      console.warn('[RadarChart] loadAndRender error:', e);
    }
  },
};
