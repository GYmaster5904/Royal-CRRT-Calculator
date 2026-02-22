<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Royal CRRT Calculator (Prismaflex)</title>
  <style>
    body { font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; margin: 24px; max-width: 900px; }
    h1 { margin: 0 0 12px; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px 18px; }
    label { display: block; font-size: 14px; color: #333; margin-bottom: 6px; }
    input, select { width: 100%; padding: 10px; font-size: 14px; }
    .box { border: 1px solid #ddd; border-radius: 10px; padding: 14px; margin-top: 14px; }
    .row { display: grid; grid-template-columns: 220px 1fr; gap: 10px; padding: 6px 0; border-bottom: 1px dashed #eee; }
    .row:last-child { border-bottom: 0; }
    .k { color:#555; }
    .v { font-weight: 700; }
    .note { color:#666; font-size: 13px; line-height: 1.35; }
    .warn { color:#8a2f2f; font-weight: 700; }
  </style>
</head>
<body>
  <h1>Royal CRRT Calculator (Prismaflex)</h1>
  <div class="note">
    - 입력값은 저장되지 않습니다(브라우저 내 계산).<br/>
    - HF60은 병원에서 “0.6 m²급 세트”로 운용하는 전제(세트 용적/허용 Qb는 기관 공급품에 따라 다를 수 있어, 필요 시 상수만 바꾸면 됩니다).
  </div>

  <div class="box">
    <div class="grid">
      <div>
        <label>Species</label>
        <select id="species">
          <option value="dog">Dog</option>
          <option value="cat">Cat</option>
        </select>
      </div>
      <div>
        <label>BW (kg)</label>
        <input id="bw" type="number" step="0.1" value="4.0" />
      </div>

      <div>
        <label>Filter/Cassette</label>
        <select id="filter">
          <option value="HF20">HF20</option>
          <option value="HF60">HF60 (0.6m² class)</option>
        </select>
      </div>
      <div>
        <label>Catheter</label>
        <select id="cath">
          <option value="7">MILA 7Fr</option>
          <option value="8">MILA 8Fr</option>
        </select>
      </div>

      <div>
        <label>Target total clearance dose (Qd + Qr) (mL/kg/h)</label>
        <input id="dose" type="number" step="1" value="25" />
      </div>
      <div>
        <label>DDS risk (first 12–24h)</label>
        <select id="ddsrisk">
          <option value="no">No</option>
          <option value="yes">Yes</option>
        </select>
      </div>

      <div>
        <label>DDS Qd cap (mL/kg/h)</label>
        <input id="qdcap" type="number" step="1" value="20" />
      </div>
      <div>
        <label>Pre ratio of Qr (Qr-pre / Qr-total)</label>
        <input id="preratio" type="number" step="0.05" value="0.70" />
      </div>

      <div>
        <label>UF target (net, mL/h)</label>
        <input id="uf" type="number" step="1" value="0" />
      </div>
      <div>
        <label>&nbsp;</label>
        <button id="calc" style="padding:10px 14px;font-size:14px;">계산</button>
      </div>
    </div>
  </div>

  <div class="box">
    <div class="row"><div class="k">Qb (mL/min)</div><div class="v" id="out_qb">-</div></div>
    <div class="row"><div class="k">Qd (mL/h)</div><div class="v" id="out_qd">-</div></div>
    <div class="row"><div class="k">Qr total (mL/h)</div><div class="v" id="out_qr">-</div></div>
    <div class="row"><div class="k">Qr-pre (mL/h)</div><div class="v" id="out_qrpre">-</div></div>
    <div class="row"><div class="k">Qr-post (mL/h)</div><div class="v" id="out_qrpost">-</div></div>
    <div class="row"><div class="k">UF net (mL/h)</div><div class="v" id="out_uf">-</div></div>
    <div class="row"><div class="k">Notes</div><div class="v" id="out_note">-</div></div>
  </div>

<script>
  // ---- Config (병원 운영에 맞게 여기만 수정하면 됨) ----
  const FILTERS = {
    HF20: { minQb: 20, maxQb: 100 },
    HF60: { minQb: 50, maxQb: 180 } // 0.6m² class assumption
  };

  // 카테터 기반 Qb 초기 추천 계수 (mL/min per kg) : 시작점용(현장 데이터로 보정 권장)
  const QB_COEFF = { "7": 6.0, "8": 7.0 };

  function clamp(x, lo, hi){ return Math.max(lo, Math.min(hi, x)); }
  function round(x){ return Math.round(x); }

  function calc(){
    const species = document.getElementById("species").value;
    const bw = parseFloat(document.getElementById("bw").value || "0");
    const filter = document.getElementById("filter").value;
    const cath = document.getElementById("cath").value;

    const dose = parseFloat(document.getElementById("dose").value || "0"); // mL/kg/h
    const ddsrisk = document.getElementById("ddsrisk").value === "yes";
    const qdcap = parseFloat(document.getElementById("qdcap").value || "0");
    const preratio = clamp(parseFloat(document.getElementById("preratio").value || "0.7"), 0, 1);

    const uf = parseFloat(document.getElementById("uf").value || "0"); // mL/h

    if(!(bw > 0)){
      alert("BW(kg)를 입력하세요.");
      return;
    }

    // ---- Qb ----
    const f = FILTERS[filter];
    const qbRaw = bw * (QB_COEFF[cath] ?? 6.0);
    const qb = clamp(qbRaw, f.minQb, f.maxQb);

    // ---- Qd/Qr : total clearance dose = Qd + Qr ----
    let qd_kg_h;
    if(ddsrisk){
      qd_kg_h = Math.min(qdcap, dose);
    } else {
      qd_kg_h = dose * 0.50; // 기본 50:50(조정 가능)
    }
    qd_kg_h = clamp(qd_kg_h, 0, dose);
    const qr_kg_h = Math.max(0, dose - qd_kg_h);

    const qd = bw * qd_kg_h;
    const qrTotal = bw * qr_kg_h;
    const qrPre = qrTotal * preratio;
    const qrPost = qrTotal - qrPre;

    // ---- Notes/Warn ----
    const ufCap = bw * 10; // mL/h guardrail (개 기준에서 흔히 쓰는 값)
    let note = [];
    note.push(`Filter Qb limits: ${f.minQb}-${f.maxQb} mL/min`);
    if(uf > ufCap){
      note.push(`UF 경고: ${round(uf)} mL/h > ${round(ufCap)} mL/h(=10 mL/kg/h)`);
    }
    if(ddsrisk){
      note.push(`DDS 모드: Qd cap ${qdcap} mL/kg/h 적용`);
    }
    note = note.join(" / ");

    // ---- Output ----
    document.getElementById("out_qb").textContent = `${qb.toFixed(0)}`;
    document.getElementById("out_qd").textContent = `${round(qd)}`;
    document.getElementById("out_qr").textContent = `${round(qrTotal)}`;
    document.getElementById("out_qrpre").textContent = `${round(qrPre)}`;
    document.getElementById("out_qrpost").textContent = `${round(qrPost)}`;
    document.getElementById("out_uf").textContent = `${round(uf)}`;
    document.getElementById("out_note").textContent = note;
    document.getElementById("out_note").className = (uf > ufCap) ? "v warn" : "v";
  }

  document.getElementById("calc").addEventListener("click", calc);
  calc();
</script>
</body>
</html>
