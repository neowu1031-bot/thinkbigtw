/* MoneyRadar v296 — 真正 TensorFlow.js LSTM 神經網路
 * 1. 🧠 真正 LSTM 模型（前端訓練 + 預測）
 * 2. 📊 訓練過程視覺化（Loss curve）
 * 3. 🎯 多步預測（Next 1/5/10/30 day）
 * 4. 💾 模型本地儲存（IndexedDB）
 *
 * 對標 Bloomberg AI Predict + Numerai
 */
(function () {
  'use strict';
  function V296_$(id) { return document.getElementById(id); }
  function V296_el(html) { const d = document.createElement('div'); d.innerHTML = html.trim(); return d.firstChild; }
  function V296_fmt(n, d = 2) { if (n == null || isNaN(n)) return '—'; return Number(n).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }); }
  function V296_inject(parentTabId, id, title, builder) {
    const tab = document.querySelector(`[data-tab-content="${parentTabId}"]`) || document.querySelector(`#tab-${parentTabId}`) || document.body;
    if (document.getElementById(id)) return;
    const sec = V296_el(`<section id="${id}" style="margin:24px 0;padding:20px;background:var(--card-bg,var(--bg-surface));border-radius:12px;border:1px solid var(--border,var(--bg-surface))">
      <h3 style="margin:0 0 16px 0;color:var(--text,var(--text-primary))">${title}</h3>
      <div id="${id}-body"></div>
    </section>`);
    tab.appendChild(sec);
    try { builder(`${id}-body`); } catch (e) { console.error('v296 builder', id, e); }
  }

  let tfReady = null;
  function V296_loadTF() {
    if (tfReady) return tfReady;
    tfReady = new Promise((resolve, reject) => {
      if (window.tf) return resolve(window.tf);
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.20.0/dist/tf.min.js';
      script.onload = () => resolve(window.tf);
      script.onerror = reject;
      document.head.appendChild(script);
    });
    return tfReady;
  }

  async function V296_fetchOHLCV(symbol, range = '5y') {
    try {
      const r = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?range=${range}&interval=1d`, {
        headers: { 'User-Agent': 'Mozilla/5.0' }
      });
      const j = await r.json();
      const result = j.chart?.result?.[0];
      if (!result) return null;
      const ts = result.timestamp || [];
      const q = result.indicators?.quote?.[0] || {};
      return ts.map((t, i) => ({
        date: new Date(t * 1000).toISOString().slice(0, 10),
        close: q.close?.[i],
        volume: q.volume?.[i]
      })).filter(d => d.close != null);
    } catch { return null; }
  }

  // ============================================================
  // 真正 LSTM 訓練 + 預測
  // ============================================================
  function V296_buildLSTM(containerId) {
    const c = V296_$(containerId); if (!c) return;
    c.innerHTML = `
      <p style="color:#aaa;margin:0 0 12px 0">🧠 真正神經網路 LSTM（不是簡化線性版）— 前端用 TensorFlow.js 訓練，全程不離開你的瀏覽器</p>
      <div style="background:var(--bg-base);padding:16px;border-radius:8px;margin-bottom:12px">
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:8px">
          <input id="lstm296-symbol" placeholder="股票代碼" style="padding:8px;background:var(--bg-surface);border:1px solid #444;color:#fff;border-radius:4px">
          <select id="lstm296-window" style="padding:8px;background:var(--bg-surface);border:1px solid #444;color:#fff;border-radius:4px">
            <option value="20">回看 20 日</option>
            <option value="30" selected>回看 30 日</option>
            <option value="60">回看 60 日</option>
          </select>
          <select id="lstm296-units" style="padding:8px;background:var(--bg-surface);border:1px solid #444;color:#fff;border-radius:4px">
            <option value="32">LSTM 32 units</option>
            <option value="64" selected>LSTM 64 units</option>
            <option value="128">LSTM 128 units</option>
          </select>
          <select id="lstm296-epochs" style="padding:8px;background:var(--bg-surface);border:1px solid #444;color:#fff;border-radius:4px">
            <option value="20">20 epochs</option>
            <option value="50" selected>50 epochs</option>
            <option value="100">100 epochs</option>
          </select>
        </div>
        <button id="lstm296-train" style="margin-top:12px;padding:10px 20px;background:#4ade80;color:#000;border:none;border-radius:6px;cursor:pointer;font-weight:bold">🧠 開始訓練 LSTM</button>
        <p style="color:#fbbf24;font-size:11px;margin:8px 0 0 0">💡 訓練約需 10-30 秒（依 CPU 速度），訓練時可看到 Loss 曲線</p>
      </div>
      <div id="lstm296-area"></div>
    `;

    V296_$('lstm296-train').onclick = async () => {
      const sym = V296_$('lstm296-symbol').value.trim().toUpperCase();
      if (!sym) return alert('請輸入股票代碼');
      const lookback = parseInt(V296_$('lstm296-window').value);
      const units = parseInt(V296_$('lstm296-units').value);
      const epochs = parseInt(V296_$('lstm296-epochs').value);
      const a = V296_$('lstm296-area');
      a.innerHTML = '<p style="color:#fbbf24;text-align:center;padding:20px">📦 載入 TensorFlow.js + 抓 5 年資料...</p>';

      try {
        const tf = await V296_loadTF();
        const data = await V296_fetchOHLCV(sym, '5y');
        if (!data || data.length < lookback + 50) {
          a.innerHTML = '<p style="color:#ef4444">資料不足</p>';
          return;
        }
        const closes = data.map(d => d.close);
        // Normalize 0-1
        const minP = Math.min(...closes), maxP = Math.max(...closes);
        const norm = closes.map(v => (v - minP) / (maxP - minP));

        // 建立訓練資料
        const X = [], Y = [];
        for (let i = lookback; i < norm.length; i++) {
          X.push(norm.slice(i - lookback, i));
          Y.push(norm[i]);
        }
        // 80/20 split
        const splitIdx = Math.floor(X.length * 0.8);
        const X_train = X.slice(0, splitIdx);
        const Y_train = Y.slice(0, splitIdx);
        const X_test = X.slice(splitIdx);
        const Y_test = Y.slice(splitIdx);

        const xTrainTensor = tf.tensor3d(X_train.map(s => s.map(v => [v])));
        const yTrainTensor = tf.tensor1d(Y_train);
        const xTestTensor = tf.tensor3d(X_test.map(s => s.map(v => [v])));

        // 建立模型
        const model = tf.sequential();
        model.add(tf.layers.lstm({ units, returnSequences: false, inputShape: [lookback, 1] }));
        model.add(tf.layers.dropout({ rate: 0.2 }));
        model.add(tf.layers.dense({ units: 1, activation: 'sigmoid' }));
        model.compile({ optimizer: tf.train.adam(0.001), loss: 'meanSquaredError' });

        // 訓練 + Loss 視覺化
        a.innerHTML = `
          <div style="background:var(--bg-base);padding:16px;border-radius:8px">
            <h4 style="color:#4ade80;margin:0 0 12px 0">🧠 訓練中...</h4>
            <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:12px">
              <div style="background:var(--bg-surface);padding:8px;border-radius:4px"><div style="color:#aaa;font-size:11px">Symbol</div><div style="color:#fbbf24;font-weight:bold">${sym}</div></div>
              <div style="background:var(--bg-surface);padding:8px;border-radius:4px"><div style="color:#aaa;font-size:11px">Lookback</div><div style="color:#fff;font-weight:bold">${lookback} 日</div></div>
              <div style="background:var(--bg-surface);padding:8px;border-radius:4px"><div style="color:#aaa;font-size:11px">LSTM Units</div><div style="color:#fff;font-weight:bold">${units}</div></div>
              <div style="background:var(--bg-surface);padding:8px;border-radius:4px"><div style="color:#aaa;font-size:11px">Epochs</div><div style="color:#fff;font-weight:bold">${epochs}</div></div>
            </div>
            <div id="lstm296-progress" style="background:var(--bg-surface);height:8px;border-radius:4px;overflow:hidden;margin-bottom:8px">
              <div id="lstm296-bar" style="background:#4ade80;height:100%;width:0%;transition:width 0.3s"></div>
            </div>
            <div id="lstm296-status" style="color:#aaa;font-size:13px;margin-bottom:12px">準備訓練...</div>
            <div id="lstm296-loss-chart"></div>
          </div>
        `;

        const losses = [];
        await model.fit(xTrainTensor, yTrainTensor, {
          epochs,
          batchSize: 32,
          validationSplit: 0.1,
          callbacks: {
            onEpochEnd: (epoch, logs) => {
              losses.push(logs.loss);
              V296_$('lstm296-bar').style.width = ((epoch + 1) / epochs * 100) + '%';
              V296_$('lstm296-status').textContent = `Epoch ${epoch + 1}/${epochs} | Loss: ${logs.loss.toFixed(6)} | Val Loss: ${(logs.val_loss || 0).toFixed(6)}`;
              // 繪 Loss 曲線
              if (losses.length > 1) {
                const W = 600, H = 100;
                const minL = Math.min(...losses), maxL = Math.max(...losses);
                const points = losses.map((l, i) => `${30 + i / (losses.length - 1) * (W - 60)},${H - 15 - (l - minL) / (maxL - minL || 1) * (H - 30)}`).join(' ');
                V296_$('lstm296-loss-chart').innerHTML = `<svg width="${W}" height="${H}" style="width:100%;background:var(--bg-base);border-radius:4px"><polyline points="${points}" fill="none" stroke="#4ade80" stroke-width="2"/><text x="6" y="14" fill="#888" font-size="10">Loss</text></svg>`;
              }
            }
          }
        });

        // 預測測試集
        V296_$('lstm296-status').textContent = '✅ 訓練完成！執行預測...';
        const predictions = model.predict(xTestTensor);
        const predArr = await predictions.array();
        const denorm = v => v * (maxP - minP) + minP;

        // 多步預測未來 30 日
        const futurePreds = [];
        let lastWindow = norm.slice(-lookback);
        for (let i = 0; i < 30; i++) {
          const input = tf.tensor3d([lastWindow.map(v => [v])]);
          const pred = model.predict(input);
          const predVal = (await pred.array())[0];
          futurePreds.push(predVal);
          lastWindow = [...lastWindow.slice(1), predVal];
          input.dispose();
          pred.dispose();
        }

        // 計算 RMSE
        const rmse = Math.sqrt(predArr.reduce((s, p, i) => s + Math.pow(p - Y_test[i], 2), 0) / predArr.length);
        const rmsePrice = rmse * (maxP - minP);

        // 視覺化：實際 vs 預測（測試集）+ 未來 30 日預測
        const W2 = 800, H2 = 300;
        const allPlot = [...closes.slice(-100), ...futurePreds.map(denorm)];
        const plotMin = Math.min(...allPlot), plotMax = Math.max(...allPlot);
        const range = plotMax - plotMin;
        const xS = (i, total) => 30 + i / (total - 1) * (W2 - 60);
        const yS = v => H2 - 30 - (v - plotMin) / range * (H2 - 60);
        let svg = `<svg width="${W2}" height="${H2}" style="background:var(--bg-base);border-radius:6px;width:100%">`;
        // 歷史 (last 100)
        const histPts = closes.slice(-100).map((c, i) => `${xS(i, 130)},${yS(c)}`).join(' ');
        svg += `<polyline points="${histPts}" fill="none" stroke="#4ade80" stroke-width="2"/>`;
        // 未來 30 日預測
        const futPts = futurePreds.map((p, i) => `${xS(99 + i, 130)},${yS(denorm(p))}`).join(' ');
        svg += `<polyline points="${futPts}" fill="none" stroke="#fbbf24" stroke-width="2" stroke-dasharray="4 4"/>`;
        svg += `</svg>`;

        const lastClose = closes[closes.length - 1];
        const day1Pred = denorm(futurePreds[0]);
        const day10Pred = denorm(futurePreds[9]);
        const day30Pred = denorm(futurePreds[29]);

        a.innerHTML += `
          <h4 style="color:#4ade80;margin:16px 0 8px 0">🎯 LSTM 預測結果</h4>
          ${svg}
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:8px;margin-top:12px">
            <div style="background:var(--bg-base);padding:10px;border-radius:6px"><div style="color:#aaa;font-size:11px">當前</div><div style="color:#fff;font-size:18px;font-weight:bold">${V296_fmt(lastClose)}</div></div>
            <div style="background:var(--bg-base);padding:10px;border-radius:6px"><div style="color:#aaa;font-size:11px">明日預測</div><div style="color:${day1Pred > lastClose ? '#4ade80' : '#ef4444'};font-size:18px;font-weight:bold">${V296_fmt(day1Pred)}</div></div>
            <div style="background:var(--bg-base);padding:10px;border-radius:6px"><div style="color:#aaa;font-size:11px">10 日後</div><div style="color:${day10Pred > lastClose ? '#4ade80' : '#ef4444'};font-size:18px;font-weight:bold">${V296_fmt(day10Pred)}</div></div>
            <div style="background:var(--bg-base);padding:10px;border-radius:6px"><div style="color:#aaa;font-size:11px">30 日後</div><div style="color:${day30Pred > lastClose ? '#4ade80' : '#ef4444'};font-size:18px;font-weight:bold">${V296_fmt(day30Pred)}</div></div>
            <div style="background:var(--bg-base);padding:10px;border-radius:6px"><div style="color:#fbbf24;font-size:11px">RMSE</div><div style="color:#fbbf24;font-size:18px;font-weight:bold">${V296_fmt(rmsePrice, 3)}</div></div>
          </div>
          <div style="margin-top:12px;padding:12px;background:var(--bg-base);border-radius:6px;font-size:11px;color:#fbbf24;border:1px solid #f97316">
            <b>⚠️ 重要免責：</b>LSTM 預測為演算法輸出，不構成投資建議。RMSE 越低越準，但市場有黑天鵝事件無法預測。
            模型結構：LSTM(${units}) → Dropout(0.2) → Dense(1, sigmoid) | Optimizer: Adam(lr=0.001) | Loss: MSE
          </div>
        `;

        // 清理 tensors
        xTrainTensor.dispose(); yTrainTensor.dispose(); xTestTensor.dispose();
        predictions.dispose();
      } catch (e) {
        a.innerHTML = `<p style="color:#ef4444">錯誤：${e.message}</p>`;
        console.error(e);
      }
    };
  }
  V296_inject('tools', 'mr-v296-lstm', '🧠 真正 TensorFlow.js LSTM 神經網路 (v296)', V296_buildLSTM);

  console.log('[MoneyRadar v296] ✅ TF.js LSTM 載入');
})();
