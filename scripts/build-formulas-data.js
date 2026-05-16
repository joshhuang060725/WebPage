const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const formulasPath = path.join(root, "data", "formulas.json");
const i18nPath = path.join(root, "data", "i18n.json");

const L = (en, tw, cn = tw) => ({ en, "zh-TW": tw, "zh-CN": cn });
const section = (id, eyebrow, title, elements) => ({ id, eyebrow, title: L(title.en, title.tw, title.cn || title.tw), elements });
const text = (id, en, tw, cn = tw) => ({ id, type: "text", content: L(en, tw, cn) });
const note = (id, en, tw, cn = tw, label = L("Engineering note", "工程註記", "工程注记")) => ({ id, type: "note", label, content: L(en, tw, cn) });
const math = (id, content) => ({ id, type: "math", content });
const variableTable = (rows) => ({
  id: "variable-legend",
  type: "variable-table",
  caption: L("Core variable legend", "核心變量表", "核心变量表"),
  rows: rows.map((row) => ({
    symbol: row.symbol,
    quantity: L(row.quantityEn, row.quantityTw, row.quantityCn || row.quantityTw),
    unit: row.unit,
    meaning: L(row.meaningEn, row.meaningTw, row.meaningCn || row.meaningTw)
  }))
});
const derivationStep = (id, titleEn, titleTw, equation, noteEn, noteTw, logicEn, logicTw) => ({
  id,
  type: "derivation-step",
  title: L(titleEn, titleTw),
  equation,
  content: L(noteEn, noteTw),
  logicNote: L(logicEn, logicTw)
});
const boundaryCase = (id, condition, resultEn, resultTw, meaningEn, meaningTw) => ({
  id,
  type: "boundary-case",
  condition,
  result: L(resultEn, resultTw),
  meaning: L(meaningEn, meaningTw)
});
const designRules = (rules) => ({
  id: "design-rules",
  type: "design-rules",
  title: L("Design rules", "設計導則", "设计导则"),
  rules: rules.map((rule) => L(rule.en, rule.tw, rule.cn || rule.tw))
});
const codeBlock = (language, code) => ({
  id: `${language}-snippet`,
  type: "code",
  language,
  title: L("Core algorithm", "核心算法片段", "核心算法片段"),
  content: code.trim()
});
const table = (id, caption, headers, rows) => ({ id, type: "table", caption, headers, rows });
const comparison = (id, caption, items) => ({ id, type: "comparison", caption, items });
const matrix = (id, caption, values) => ({ id, type: "matrix", caption, values });
const plot = (id, handler, caption, parameters, metrics = [], expressionConfig = undefined) => ({
  id,
  type: "plot",
  handler,
  caption,
  parameters,
  metrics,
  ...(expressionConfig ? { expressionConfig } : {})
});
const param = (id, symbol, labelEn, labelTw, min, max, stepValue, defaultValue, unit = "") => ({
  id,
  symbol,
  label: L(labelEn, labelTw),
  min,
  max,
  step: stepValue,
  default: defaultValue,
  unit
});
const metric = (id, en, tw) => ({ id, label: L(en, tw) });
const baseMetrics = [
  metric("samples", "Samples", "採樣點數"),
  metric("latency", "Compute latency", "計算延遲")
];

const categories = [
  { id: "all", label: L("All", "全部", "全部") },
  { id: "foundations", label: L("Foundations", "數學與系統基礎", "数学与系统基础") },
  { id: "electronics-hardware", label: L("Electronics & Hardware", "電子與硬體", "电子与硬件") },
  { id: "dsp", label: L("Digital Signal Processing", "數位訊號處理", "数字信号处理") },
  { id: "image-science", label: L("Image Science", "影像科學", "图像科学") },
  { id: "systems-estimation", label: L("Systems & Estimation", "控制與估測", "控制与估测") }
];

const topics = [
  {
    id: "euler-phasors",
    number: "001",
    category: "foundations",
    title: ["Euler's formula and phasors", "歐拉公式與相量"],
    description: ["Derives Euler's identity from Taylor series and maps rotating complex vectors to sinusoidal waveforms.", "從泰勒級數推導歐拉公式，並把旋轉複數向量連到實際正弦波。"],
    summary: ["Complex exponentials turn phase, frequency, and sinusoidal steady state into geometry.", "用複指數把相位、頻率與正弦穩態變成可視化幾何。"],
    formula: "e^{j\\theta}=\\cos\\theta+j\\sin\\theta",
    tags: ["phasor", "complex", "signal"],
    scene: ["On an oscilloscope, two AC nodes can have the same amplitude but arrive with a phase shift; the waveform looks delayed even when the circuit is in steady state.", "在示波器上觀察兩個 AC 節點時，常看到振幅相同但相位不同，波形像是延遲了，電路卻已經進入穩態。"],
    question: ["Why can a rotating vector describe a real voltage waveform?", "為什麼一個在複平面旋轉的向量，可以代表真實的電壓波形？"],
    variables: [
      ["$j$", "Imaginary unit", "none", "Rotates a vector by 90 degrees.", "虛數單位", "無", "讓向量旋轉 90 度。"],
      ["$\\theta$", "Phase angle", "rad", "Position of the rotating vector.", "相位角", "rad", "旋轉向量所在的位置。"],
      ["$\\omega$", "Angular frequency", "rad/s", "Rotation speed in the complex plane.", "角頻率", "rad/s", "複平面中的旋轉速度。"],
      ["$f$", "Frequency", "Hz", "Cycles per second.", "頻率", "Hz", "每秒完成的週期數。"]
    ],
    assumptions: [
      ["Signal is sinusoidal and steady state.", "訊號為正弦且已進入穩態。"],
      ["Amplitude is normalized unless stated otherwise.", "除非特別標註，振幅先以正規化處理。"],
      ["Only the real projection is measured as the physical waveform.", "實際量測到的物理波形取複數旋轉向量的實部投影。"]
    ],
    derivation: [
      ["series", "Start from the exponential series", "從指數函數級數出發", "e^x=\\sum_{n=0}^{\\infty}\\frac{x^n}{n!}", "The power series is valid for real and complex arguments.", "冪級數對實數與複數輸入都成立。", "Known Taylor expansion.", "使用已知泰勒展開。"],
      ["substitute", "Substitute a phase argument", "代入相位變數", "e^{j\\theta}=1+j\\theta-\\frac{\\theta^2}{2!}-j\\frac{\\theta^3}{3!}+\\cdots", "Powers of j cycle through 1, j, -1, and -j.", "$j$ 的冪次會在 $1,j,-1,-j$ 間循環。", "Use j^2=-1.", "利用 $j^2=-1$ 整理符號。"],
      ["group", "Group real and imaginary terms", "分組實部與虛部", "e^{j\\theta}=\\left(1-\\frac{\\theta^2}{2!}+\\cdots\\right)+j\\left(\\theta-\\frac{\\theta^3}{3!}+\\cdots\\right)", "The two groups match cosine and sine series.", "兩組級數分別對應餘弦與正弦。", "Identify Taylor series.", "辨識正弦、餘弦級數。"]
    ],
    boundaries: [
      ["$\\theta\\to0$", "$e^{j\\theta}\\approx1+j\\theta$", "Small phase error is almost a linear imaginary perturbation.", "小相位誤差近似為沿虛軸的線性擾動。"],
      ["$\\theta=\\pi$", "$e^{j\\pi}=-1$", "A half-cycle rotation flips signal polarity.", "半週期旋轉會讓訊號極性反相。"]
    ],
    rules: [
      ["Use phasors only after the transient has died out.", "只有在暫態消失後才用相量分析穩態。"],
      ["Track the sign convention before mixing SPICE, RF, and control formulas.", "混用 SPICE、RF 與控制公式前先確認相位正負號慣例。"],
      ["Convert degrees to radians before numerical computation.", "數值計算前先把角度轉成弧度。"]
    ],
    code: "import numpy as np\n\ndef phasor(amplitude, phase_deg, t, f):\n    phi = np.deg2rad(phase_deg)\n    return np.real(amplitude * np.exp(1j * (2*np.pi*f*t + phi)))",
    next: ["This leads naturally to Fourier analysis, where signals are decomposed into many rotating phasors.", "下一步可以進入傅立葉分析：把任意訊號拆成許多旋轉相量的疊加。"],
    plot: plot("phasor-sine", "phasorSine", L("Rotating vector and projected waveform", "旋轉向量與投影波形"), [
      param("frequency", "f", "Frequency", "頻率", 0.2, 5, 0.1, 1, "Hz"),
      param("phase", "\\phi", "Initial phase", "初始相位", -180, 180, 5, 30, "deg")
    ], [metric("period", "Period", "週期"), ...baseMetrics])
  },
  {
    id: "laplace-transform",
    number: "002",
    category: "foundations",
    title: ["Laplace transform: the nature of the s-domain", "拉普拉斯轉換：s 平面的物理意義"],
    description: ["Extends Fourier analysis with exponential weighting and explains ROC, poles, and stability.", "用指數權重延伸傅立葉分析，說明 ROC、極點與穩定性的關係。"],
    summary: ["Use s = sigma + j omega to connect decay, oscillation, and impulse response.", "用 $s=\\sigma+j\\omega$ 同時描述衰減、振盪與系統響應。"],
    formula: "X(s)=\\int_{0^-}^{\\infty}x(t)e^{-st}\\,dt",
    tags: ["laplace", "poles", "stability"],
    scene: ["A power rail may ring after a load step; whether it decays or grows is more important than its frequency alone.", "負載瞬間切換後，電源軌可能出現振鈴；工程上不只看頻率，更要看它會衰減還是放大。"],
    question: ["Why does the real part of a pole decide stability?", "為什麼極點的實部會決定系統是否穩定？"],
    variables: [
      ["$s$", "Complex frequency", "1/s", "Combines exponential decay and oscillation.", "複頻率", "1/s", "同時包含指數衰減與振盪。"],
      ["$\\sigma$", "Real part of s", "1/s", "Controls growth or decay.", "s 的實部", "1/s", "控制成長或衰減。"],
      ["$\\omega$", "Imaginary part of s", "rad/s", "Controls oscillation frequency.", "s 的虛部", "rad/s", "控制振盪頻率。"],
      ["$p_i$", "Pole", "1/s", "Natural mode of the system.", "極點", "1/s", "系統的自然模態。"]
    ],
    assumptions: [
      ["Continuous-time LTI model.", "使用連續時間 LTI 模型。"],
      ["Causal response unless stated otherwise.", "除非特別說明，系統響應假設為因果。"],
      ["Initial conditions are included through the one-sided transform when needed.", "需要初始條件時，以單邊轉換形式納入。"]
    ],
    derivation: [
      ["kernel", "Start with the exponential test signal", "從指數測試函數出發", "e^{-st}=e^{-\\sigma t}e^{-j\\omega t}", "The transform probes both convergence and frequency content.", "轉換核同時測試收斂性與頻率成分。", "Separate real and imaginary parts of s.", "把 $s$ 的實部與虛部分開。"],
      ["integral", "Define the one-sided transform", "定義單邊拉氏轉換", "X(s)=\\int_{0^-}^{\\infty}x(t)e^{-st}\\,dt", "The lower limit captures impulse and initial-condition effects.", "$0^-$ 可以保留脈衝與初始條件的影響。", "Use the engineering one-sided convention.", "使用工程常見的單邊定義。"],
      ["poles", "Connect poles to natural modes", "連接極點與自然模態", "h(t)=\\sum_i A_i e^{p_i t}u(t)", "Each pole creates a mode whose envelope is set by its real part.", "每個極點對應一個模態，其包絡由實部決定。", "Apply inverse transform residues.", "利用反轉換的留數形式。"]
    ],
    boundaries: [
      ["$\\Re\\{p_i\\}<0$", "$e^{p_i t}\\to0$", "Modes decay, so a causal LTI system can be stable.", "模態會衰減，因此因果 LTI 系統可能穩定。"],
      ["$\\Re\\{p_i\\}>0$", "$e^{p_i t}\\to\\infty$", "Any small disturbance grows and the model is unstable.", "微小擾動會被放大，模型不穩定。"]
    ],
    rules: [
      ["When reviewing a transfer function, inspect pole locations before gain numbers.", "檢查轉移函數時，先看極點位置，再看增益數字。"],
      ["Keep damping margin for component tolerance and temperature drift.", "為元件誤差與溫漂保留阻尼裕度。"],
      ["Do not infer stability from magnitude response alone; phase and pole locations matter.", "不要只靠幅頻響應判斷穩定性，相位與極點位置同樣關鍵。"]
    ],
    code: "import numpy as np\n\ndef modal_response(poles, residues, t):\n    y = np.zeros_like(t, dtype=complex)\n    for p, r in zip(poles, residues):\n        y += r * np.exp(p * t)\n    return np.real(y)",
    next: ["The Z-transform maps this pole logic onto the unit circle for sampled systems.", "下一步可看 Z 轉換：把連續極點邏輯映射到離散系統的單位圓。"],
    plot: plot("pole-zero-map", "poleZeroResponse", L("Complex pole pair response", "複數極點對的響應"), [
      param("sigma", "\\sigma", "Real part", "實部", -5, 1, 0.1, -1, "1/s"),
      param("omega", "\\omega", "Imaginary part", "虛部", 0, 12, 0.2, 5, "rad/s")
    ], [metric("stability", "Stability", "穩定性"), ...baseMetrics])
  }
];

const extraTopics = [
  ["z-transform", "003", "foundations", "Z-transform: foundation of discrete systems", "Z 轉換：離散系統的基礎", "X(z)=\\sum_{n=-\\infty}^{\\infty}x[n]z^{-n}", ["z-transform", "discrete", "stability"], "Sampled firmware sees only x[n], not the continuous waveform between samples.", "韌體只能看到取樣序列 $x[n]$，看不到兩個取樣點之間的連續波形。", "Why does stability move from the left-half s-plane to the inside of the unit circle?", "為什麼穩定性會從 s 平面的左半平面，變成 z 平面的單位圓內部？", [["$z$", "Complex discrete frequency", "none", "Discrete-time growth and rotation factor.", "複數離散頻率", "無", "離散時間的成長與旋轉因子。"], ["$T_s$", "Sampling period", "s", "Time between samples.", "取樣週期", "s", "相鄰取樣點的時間距離。"], ["$n$", "Sample index", "none", "Discrete time counter.", "取樣索引", "無", "離散時間計數。"]], "x[n]=e^{snT_s}\\Rightarrow z=e^{sT_s}", "H(z)\\text{ stable}\\Rightarrow |p_i|<1", "import numpy as np\n\ndef z_pole_from_s(pole_s, ts):\n    return np.exp(pole_s * ts)", plot("z-plane", "expressionPlot", L("Discrete pole radius across time", "離散極點半徑與時間響應"), [param("radius", "r", "Pole radius", "極點半徑", 0.1, 1.2, 0.01, 0.8, ""), param("angle", "\\theta", "Pole angle", "極點角度", 0, 3.14, 0.01, 0.6, "rad")], baseMetrics, { xVariable: "n", xMin: "0", xMax: "80", samples: 160, yLabel: "x[n]", expressions: [{ label: "mode", expression: "pow(radius, n) * cos(angle*n)" }] })],
  ["convolution-theorem", "004", "foundations", "Convolution theorem: bridge between time and frequency", "卷積定理：時域與頻域的橋樑", "y(t)=x(t)*h(t)\\Longleftrightarrow Y(\\omega)=X(\\omega)H(\\omega)", ["convolution", "frequency-domain", "systems"], "A filter output looks like the input has been smeared by the circuit memory.", "濾波器輸出常像輸入被電路記憶效應拖尾與平滑。", "Why does a time-domain smear become simple multiplication in the frequency domain?", "為什麼時域的拖尾運算，到頻域會變成單純相乘？", [["$x(t)$", "Input signal", "varies", "Signal entering the system.", "輸入訊號", "依系統而定", "進入系統的訊號。"], ["$h(t)$", "Impulse response", "varies", "System memory fingerprint.", "脈衝響應", "依系統而定", "系統記憶特性的指紋。"], ["$H(\\omega)$", "Frequency response", "varies", "Gain and phase per frequency.", "頻率響應", "依系統而定", "每個頻率的增益與相位。"]], "y(t)=\\int_{-\\infty}^{\\infty}x(\\tau)h(t-\\tau)d\\tau", "Y(\\omega)=X(\\omega)H(\\omega)", "import numpy as np\n\ndef lti_output(x, h):\n    return np.convolve(x, h, mode='same')", plot("rect-spectrum", "rectangularPulseTransform", L("Rectangular pulse spectrum", "矩形脈波頻譜"), [param("width", "T", "Pulse width", "脈波寬度", 0.2, 4, 0.1, 1, "s"), param("amplitude", "A", "Amplitude", "振幅", 0.2, 3, 0.1, 1, "")], [metric("dcGain", "DC gain", "直流增益"), metric("firstZero", "First zero", "第一個零點"), ...baseMetrics])],
  ["op-amp-golden-rules", "005", "electronics-hardware", "Ideal op-amp golden rules", "理想運算放大器黃金法則", "A_v=-\\frac{R_f}{R_{in}},\\quad A_v=1+\\frac{R_f}{R_g}", ["op-amp", "feedback", "bode"], "A breadboard amplifier may match the gain equation at low frequency but lose gain near the op-amp GBW limit.", "麵包板上的放大器低頻符合增益公式，但接近運放 GBW 時增益會掉下來。", "Why can we pretend the input pins are shorted while no current enters them?", "為什麼可以把兩個輸入端當成虛短，卻又說幾乎沒有電流流入？", [["$A_{OL}$", "Open-loop gain", "V/V", "Large gain that enables virtual short.", "開迴路增益", "V/V", "形成虛短的高增益來源。"], ["$R_f$", "Feedback resistor", "ohm", "Sets closed-loop gain.", "回授電阻", "ohm", "決定閉迴路增益。"], ["$GBW$", "Gain-bandwidth product", "Hz", "Speed limit of the op-amp.", "增益頻寬積", "Hz", "運放的速度上限。"]], "v_o=A_{OL}(v_+-v_-)", "A_v\\approx-\\frac{R_f}{R_{in}}", "import numpy as np\n\ndef inverting_gain(rf, rin):\n    return -rf / rin", plot("gbw-plot", "expressionPlot", L("Closed-loop bandwidth from GBW", "由 GBW 估算閉迴路頻寬"), [param("gain", "A_v", "Closed-loop gain", "閉迴路增益", 1, 100, 1, 10, "V/V"), param("gbw", "GBW", "Gain-bandwidth product", "增益頻寬積", 0.5, 20, 0.5, 5, "MHz")], baseMetrics, { xVariable: "f", xMin: "0.01", xMax: "20", samples: 500, yLabel: "Gain (V/V)", expressions: [{ label: "Closed-loop magnitude", expression: "gain / sqrt(1 + pow(f / (gbw / gain), 2))" }] })],
  ["sallen-key-filter", "006", "electronics-hardware", "Active filter design: Sallen-Key topology", "主動濾波器設計：Sallen-Key 拓撲", "H(s)=\\frac{\\omega_0^2}{s^2+\\frac{\\omega_0}{Q}s+\\omega_0^2}", ["filter", "sallen-key", "bode"], "A sensor front-end needs to remove high-frequency noise without adding visible ringing after a step.", "感測器前端需要濾掉高頻雜訊，但不能在階躍後產生明顯振鈴。", "Why do cutoff frequency and Q together decide whether the filter is smooth or peaky?", "為什麼截止頻率與 Q 值會一起決定濾波器是平順還是尖峰？", [["$\\omega_0$", "Natural frequency", "rad/s", "Center of the second-order denominator.", "自然角頻率", "rad/s", "二階分母的中心頻率。"], ["$Q$", "Quality factor", "none", "Inverse damping measure.", "品質因數", "無", "阻尼大小的反向量測。"], ["$f_c$", "Cutoff frequency", "Hz", "Frequency where response begins to roll off.", "截止頻率", "Hz", "響應開始下降的位置。"]], "H(s)=\\frac{\\omega_0^2}{s^2+\\frac{\\omega_0}{Q}s+\\omega_0^2}", "Q=\\frac{1}{\\sqrt{2}}\\text{ gives Butterworth flatness}", "import numpy as np\n\ndef second_order_mag(f, fc, q):\n    w = f / fc\n    return 1 / np.sqrt((1-w*w)**2 + (w/q)**2)", plot("bode-second-order", "secondOrderBode", L("Second-order low-pass Bode plot", "二階低通波德圖"), [param("fc", "f_c", "Cutoff frequency", "截止頻率", 100, 10000, 100, 1000, "Hz"), param("q", "Q", "Quality factor", "品質因數", 0.3, 3, 0.01, 0.707, "")], [metric("peak", "Peak", "峰值"), ...baseMetrics])],
  ["skin-effect", "007", "electronics-hardware", "Skin effect and conductor loss", "集膚效應與導體損耗", "\\delta=\\sqrt{\\frac{2}{\\omega\\mu\\sigma}}", ["skin-effect", "loss", "hardware"], "A high-current trace that is fine at DC can heat more at RF because current crowds near the copper surface.", "一條 DC 電流沒問題的銅箔，在 RF 下可能更熱，因為電流集中在導體表面。", "Why does usable copper thickness shrink when frequency rises?", "為什麼頻率上升時，有效導銅厚度會變薄？", [["$\\delta$", "Skin depth", "m", "Depth where current density drops to 1/e.", "集膚深度", "m", "電流密度降到 $1/e$ 的深度。"], ["$\\mu$", "Permeability", "H/m", "Magnetic property of the conductor region.", "磁導率", "H/m", "導體周圍磁場特性。"], ["$\\sigma$", "Conductivity", "S/m", "Electrical conductivity.", "導電率", "S/m", "材料導電能力。"]], "\\delta=\\sqrt{\\frac{2}{\\omega\\mu\\sigma}}", "R_{ac}\\propto\\frac{1}{\\delta}\\propto\\sqrt{f}", "import numpy as np\n\ndef skin_depth(f, mu, sigma):\n    return np.sqrt(2 / (2*np.pi*f*mu*sigma))", plot("skin-depth", "expressionPlot", L("Skin depth versus frequency", "集膚深度與頻率"), [param("sigma", "\\sigma", "Conductivity scale", "導電率倍率", 0.2, 2, 0.1, 1, "xCu"), param("mu", "\\mu_r", "Relative permeability", "相對磁導率", 1, 10, 0.1, 1, "")], baseMetrics, { xVariable: "f", xMin: "1", xMax: "1000", samples: 500, yLabel: "relative skin depth", expressions: [{ label: "delta", expression: "1 / sqrt(f * sigma * mu)" }] })],
  ["smith-chart-matching", "008", "electronics-hardware", "Smith chart and impedance matching", "史密斯圖與阻抗匹配", "\\Gamma=\\frac{Z_L-Z_0}{Z_L+Z_0}", ["smith-chart", "rf", "matching"], "A fast digital edge reaches the end of a PCB trace and reflects if the load is not matched to the trace impedance.", "高速數位邊緣到達 PCB 走線末端時，若負載阻抗不等於走線阻抗，就會反射回來。", "Why does a 50-ohm system distort when the load is not 50 ohms?", "為什麼 50 歐姆系統接上非 50 歐姆負載時，訊號會畸變？", [["$Z_0$", "Characteristic impedance", "ohm", "Impedance seen by a traveling wave.", "特性阻抗", "ohm", "行進波看到的阻抗。"], ["$Z_L$", "Load impedance", "ohm", "Termination at the end of the line.", "負載阻抗", "ohm", "傳輸線末端阻抗。"], ["$\\Gamma$", "Reflection coefficient", "none", "Ratio of reflected to incident wave.", "反射係數", "無", "反射波與入射波的比例。"]], "V=V^++V^-,\\quad I=\\frac{V^+}{Z_0}-\\frac{V^-}{Z_0}", "\\Gamma=\\frac{Z_L-Z_0}{Z_L+Z_0}", "def reflection(z_load, z0=50):\n    return (z_load - z0) / (z_load + z0)", plot("smith-reflection", "smithReflection", L("Reflection coefficient trajectory", "反射係數軌跡"), [param("r", "R_L", "Load resistance", "負載電阻", 1, 150, 1, 75, "ohm"), param("x", "X_L", "Load reactance", "負載電抗", -100, 100, 1, 25, "ohm")], [metric("gamma", "|Gamma|", "|Γ|"), metric("vswr", "VSWR", "駐波比"), ...baseMetrics])],
  ["nyquist-aliasing", "009", "dsp", "Nyquist sampling and aliasing", "奈奎斯特取樣與混疊", "f_s>2f_{max}", ["sampling", "aliasing", "adc"], "An ADC may show a low-frequency tone that was never present; it can be a folded high-frequency interferer.", "ADC 可能量到一個原本不存在的低頻訊號；它其實可能是高頻干擾折疊進來。", "Why can sampling create a convincing but false frequency?", "為什麼取樣會產生看起來很真、但其實是假的頻率？", [["$f_s$", "Sampling frequency", "Hz", "Samples per second.", "取樣頻率", "Hz", "每秒取樣次數。"], ["$f_{in}$", "Input frequency", "Hz", "Frequency before sampling.", "輸入頻率", "Hz", "取樣前的訊號頻率。"], ["$f_a$", "Alias frequency", "Hz", "Folded frequency after sampling.", "混疊頻率", "Hz", "取樣後折疊出的頻率。"]], "x[n]=\\sin\\left(2\\pi\\frac{f_{in}}{f_s}n\\right)", "f_a=|f_{in}-k f_s|", "import numpy as np\n\ndef alias_frequency(fin, fs):\n    return abs(fin - round(fin/fs)*fs)", plot("sampling-aliasing", "samplingAliasing", L("Sampled waveform and alias risk", "取樣波形與混疊風險"), [param("fin", "f_{in}", "Input frequency", "輸入頻率", 1, 50, 1, 18, "Hz"), param("fs", "f_s", "Sampling rate", "取樣率", 5, 80, 1, 30, "Hz")], [metric("alias", "Alias", "混疊頻率"), metric("nyquist", "Nyquist status", "奈奎斯特狀態"), ...baseMetrics])],
  ["dft-matrix", "010", "dsp", "DFT matrix and frequency bins", "DFT 矩陣與頻率 bin", "X[k]=\\sum_{n=0}^{N-1}x[n]e^{-j2\\pi kn/N}", ["dft", "matrix", "spectrum"], "A spectrum analyzer displays bins, not a continuous truth; resolution changes when observation time changes.", "頻譜分析器顯示的是 bin，不是連續真相；解析度會隨觀測時間改變。", "Why does more zero padding not create real frequency resolution?", "為什麼補零可以讓曲線更細，卻不會創造真正解析度？", [["$N$", "Sample count", "none", "Number of observed samples.", "取樣點數", "無", "觀測到的樣本數。"], ["$k$", "DFT bin index", "none", "Discrete frequency index.", "DFT bin 索引", "無", "離散頻率索引。"], ["$\\Delta f$", "Bin spacing", "Hz", "Frequency grid spacing.", "頻率間距", "Hz", "頻率格點間隔。"]], "W_N=e^{-j2\\pi/N}", "X[k]=\\sum_{n=0}^{N-1}x[n]W_N^{kn}", "import numpy as np\n\ndef dft(x):\n    x = np.asarray(x)\n    n = np.arange(x.size)\n    k = n.reshape((-1, 1))\n    return np.exp(-2j*np.pi*k*n/x.size) @ x", plot("dft-bin", "expressionPlot", L("DFT basis projection", "DFT 基底投影"), [param("bin", "k", "Bin", "頻率 bin", 1, 16, 1, 4, ""), param("length", "N", "Window length", "視窗長度", 32, 256, 16, 128, "")], baseMetrics, { xVariable: "n", xMin: "0", xMax: "128", samples: 256, yLabel: "basis", expressions: [{ label: "real basis", expression: "cos(2*pi*bin*n/length)" }] })],
  ["windowing-leakage", "011", "dsp", "Windowing and spectral leakage", "窗函數與頻譜洩漏", "X_w(f)=X(f)*W(f)", ["window", "fft", "leakage"], "A single tone may smear across many FFT bins when the capture window cuts it mid-cycle.", "單一音調若被擷取視窗切在非整數週期，FFT 會把能量灑到許多 bin。", "Why does measuring for a finite time create side lobes?", "為什麼有限時間量測會產生旁瓣？", [["$w[n]$", "Window function", "none", "Weights samples before FFT.", "窗函數", "無", "FFT 前的樣本權重。"], ["$W(f)$", "Window spectrum", "none", "Frequency-domain footprint of the window.", "窗頻譜", "無", "窗函數在頻域的形狀。"], ["$N$", "Window length", "samples", "Observation length.", "視窗長度", "samples", "觀測長度。"]], "x_w[n]=x[n]w[n]", "X_w(f)=X(f)*W(f)", "import numpy as np\n\ndef hann_fft(x):\n    return np.fft.rfft(np.asarray(x) * np.hanning(len(x)))", plot("window-spectrum", "windowSpectrum", L("Window leakage comparison", "窗函數洩漏比較"), [param("length", "N", "Window length", "視窗長度", 32, 512, 16, 128, "samples"), param("offset", "\\epsilon", "Bin offset", "bin 偏移", 0, 0.5, 0.01, 0.25, "bin")], [metric("rectLeakage", "Rect leakage", "矩形窗洩漏"), metric("hannLeakage", "Hann leakage", "Hann 窗洩漏"), ...baseMetrics])],
  ["fft-butterfly", "012", "dsp", "FFT butterfly decomposition", "FFT 蝶形分解", "X[k]=E[k]+W_N^kO[k]", ["fft", "butterfly", "algorithm"], "An embedded DSP can compute a 1024-point spectrum in real time only because FFT reuses smaller DFTs.", "嵌入式 DSP 能即時計算 1024 點頻譜，是因為 FFT 重用較小的 DFT。", "How does splitting even and odd samples reduce computation?", "把偶數與奇數樣本拆開後，為什麼計算量會下降？", [["$N$", "FFT length", "samples", "Transform size.", "FFT 長度", "samples", "轉換大小。"], ["$W_N^k$", "Twiddle factor", "none", "Complex rotation reused across butterflies.", "旋轉因子", "無", "蝶形級間重用的複數旋轉。"], ["$E[k],O[k]$", "Even/odd DFTs", "varies", "Half-size subproblems.", "偶數/奇數 DFT", "依資料而定", "半長度子問題。"]], "X[k]=\\sum_n x[n]W_N^{kn}", "X[k]=E[k]+W_N^kO[k]", "import numpy as np\n\ndef fft_reference(x):\n    return np.fft.fft(x)", plot("fft-cost", "expressionPlot", L("DFT versus FFT operation growth", "DFT 與 FFT 計算量成長"), [param("scale", "c", "Scale", "尺度", 0.2, 2, 0.1, 1, "")], baseMetrics, { xVariable: "N", xMin: "8", xMax: "2048", samples: 300, yLabel: "relative ops", expressions: [{ label: "DFT N^2", expression: "scale*N*N" }, { label: "FFT N log2 N", expression: "scale*N*log(N)/log(2)" }] })],
  ["gaussian-blur-kernel", "013", "image-science", "Gaussian blur kernel", "高斯模糊核", "G(x,y)=\\frac{1}{2\\pi\\sigma^2}e^{-\\frac{x^2+y^2}{2\\sigma^2}}", ["gaussian", "image", "kernel"], "A camera pipeline uses blur before edge detection to suppress sensor noise.", "相機影像管線常在邊緣偵測前先做模糊，降低感測器雜訊。", "Why does sigma control both smoothness and detail loss?", "為什麼 $\\sigma$ 同時控制平滑程度與細節損失？", [["$\\sigma$", "Standard deviation", "pixels", "Spatial scale of smoothing.", "標準差", "pixels", "平滑的空間尺度。"], ["$G$", "Kernel weight", "none", "Convolution coefficient.", "卷積權重", "無", "卷積係數。"], ["$K$", "Kernel size", "pixels", "Finite support used in implementation.", "核心尺寸", "pixels", "實作時採用的有限範圍。"]], "G(x,y)=\\frac{1}{2\\pi\\sigma^2}e^{-\\frac{x^2+y^2}{2\\sigma^2}}", "\\sum_{x,y}G[x,y]=1", "import numpy as np\n\ndef gaussian_kernel(size, sigma):\n    ax = np.arange(-(size//2), size//2 + 1)\n    xx, yy = np.meshgrid(ax, ax)\n    k = np.exp(-(xx**2 + yy**2)/(2*sigma**2))\n    return k / k.sum()", plot("gaussian-kernel", "gaussianKernel", L("Normalized Gaussian kernel surface", "正規化高斯核曲面"), [param("sigma", "\\sigma", "Sigma", "標準差", 0.3, 4, 0.1, 1.2, "px"), param("size", "K", "Kernel size", "核心尺寸", 3, 21, 2, 7, "px")], [metric("sum", "Kernel sum", "權重總和"), metric("center", "Center weight", "中心權重"), ...baseMetrics])],
  ["rgb-yuv-transform", "014", "image-science", "RGB to YUV transform", "RGB 到 YUV 色彩轉換", "\\begin{bmatrix}Y\\\\U\\\\V\\end{bmatrix}=M\\begin{bmatrix}R\\\\G\\\\B\\end{bmatrix}", ["color", "matrix", "video"], "Video codecs preserve brightness more carefully than chroma because human vision is more sensitive to luma detail.", "影像編碼器通常更小心保留亮度，因為人眼對亮度細節比色度更敏感。", "Why can chroma be subsampled while luma stays sharp?", "為什麼色度可以降採樣，而亮度仍要保持清楚？", [["$R,G,B$", "Display primaries", "normalized", "Input color channels.", "顯示三原色", "normalized", "輸入色彩通道。"], ["$Y$", "Luma", "normalized", "Brightness-like component.", "亮度", "normalized", "近似明暗的分量。"], ["$U,V$", "Chroma", "normalized", "Color difference components.", "色度", "normalized", "色彩差異分量。"]], "Y=0.299R+0.587G+0.114B", "\\begin{bmatrix}Y\\\\U\\\\V\\end{bmatrix}=M\\begin{bmatrix}R\\\\G\\\\B\\end{bmatrix}", "import numpy as np\n\ndef rgb_to_yuv(rgb):\n    m = np.array([[0.299,0.587,0.114],[-0.147,-0.289,0.436],[0.615,-0.515,-0.100]])\n    return rgb @ m.T", plot("luma-mix", "expressionPlot", L("Luma weight mix", "亮度權重混合"), [param("red", "R", "Red", "紅色", 0, 1, 0.01, 0.7, ""), param("green", "G", "Green", "綠色", 0, 1, 0.01, 0.5, "")], baseMetrics, { xVariable: "B", xMin: "0", xMax: "1", samples: 120, yLabel: "Y", expressions: [{ label: "Y", expression: "0.299*red + 0.587*green + 0.114*B" }] })],
  ["dct-jpeg-compression", "015", "image-science", "DCT and JPEG compression", "DCT 與 JPEG 壓縮", "C_{u,v}=\\alpha_u\\alpha_v\\sum x_{m,n}\\cos\\frac{(2m+1)u\\pi}{16}\\cos\\frac{(2n+1)v\\pi}{16}", ["dct", "jpeg", "compression"], "A JPEG image keeps smooth regions compact but may create block artifacts near sharp edges.", "JPEG 可以有效壓縮平滑區域，但銳利邊緣附近可能出現方塊 artifacts。", "Why do low-frequency DCT coefficients carry most visual energy?", "為什麼低頻 DCT 係數通常承載最多視覺能量？", [["$C_{u,v}$", "DCT coefficient", "varies", "Strength of one cosine basis.", "DCT 係數", "依資料而定", "某個餘弦基底的強度。"], ["$Q_{u,v}$", "Quantization step", "varies", "Loss control per frequency.", "量化步階", "依資料而定", "各頻率的失真控制。"], ["$8\\times8$", "JPEG block", "pixels", "Local transform size.", "JPEG 區塊", "pixels", "局部轉換大小。"]], "C=A x A^T", "\\hat{C}_{u,v}=\\operatorname{round}(C_{u,v}/Q_{u,v})", "import numpy as np\n\ndef quantize_dct(c, q):\n    return np.round(c / q).astype(int)", plot("dct-energy", "expressionPlot", L("Coefficient decay model", "係數能量衰減模型"), [param("quality", "q", "Quality", "品質", 10, 95, 1, 70, ""), param("detail", "d", "Detail level", "細節量", 0.2, 2, 0.1, 1, "")], baseMetrics, { xVariable: "k", xMin: "0", xMax: "63", samples: 64, yLabel: "relative coefficient", expressions: [{ label: "energy", expression: "detail * exp(-k/(quality/8))" }] })],
  ["histogram-equalization", "016", "image-science", "Histogram equalization", "直方圖等化", "s_k=(L-1)\\sum_{j=0}^{k}p_r(r_j)", ["histogram", "contrast", "image"], "A low-contrast inspection image may hide defects until its gray-level distribution is stretched.", "低對比檢測影像可能看不到缺陷，直到灰階分佈被拉開。", "Why does the cumulative distribution function become a tone-mapping curve?", "為什麼累積分佈函數會變成 tone mapping 曲線？", [["$r_k$", "Input gray level", "level", "Original intensity.", "輸入灰階", "level", "原始亮度。"], ["$p_r$", "Histogram probability", "none", "Normalized occurrence rate.", "直方圖機率", "無", "正規化出現率。"], ["$s_k$", "Mapped gray level", "level", "Output intensity.", "輸出灰階", "level", "映射後亮度。"]], "p_r(r_k)=\\frac{n_k}{N}", "s_k=(L-1)\\sum_{j=0}^{k}p_r(r_j)", "import numpy as np\n\ndef equalize(gray, levels=256):\n    hist, _ = np.histogram(gray, bins=levels, range=(0, levels-1))\n    cdf = hist.cumsum() / hist.sum()\n    return np.interp(gray, np.arange(levels), (levels-1)*cdf)", plot("hist-eq", "histogramEqualization", L("Histogram and CDF mapping", "直方圖與 CDF 映射"), [param("levels", "L", "Gray levels", "灰階層級", 16, 256, 16, 128, ""), param("contrast", "c", "Input contrast", "輸入對比", 0.2, 2, 0.1, 0.8, "")], [metric("levels", "Levels", "灰階數"), ...baseMetrics])],
  ["pid-controller", "017", "systems-estimation", "PID controller", "PID 控制器", "u(t)=K_pe(t)+K_i\\int e(t)dt+K_d\\frac{de(t)}{dt}", ["pid", "control", "feedback"], "A motor position loop that responds quickly may overshoot and oscillate if the gains are not balanced.", "馬達位置控制若只追求快速，增益不平衡時會過衝並振盪。", "How do proportional, integral, and derivative actions trade speed for stability?", "比例、積分、微分三項如何在速度與穩定性之間取捨？", [["$K_p$", "Proportional gain", "varies", "Immediate error correction.", "比例增益", "依系統而定", "立即誤差修正。"], ["$K_i$", "Integral gain", "varies", "Accumulated error removal.", "積分增益", "依系統而定", "消除累積穩態誤差。"], ["$K_d$", "Derivative gain", "varies", "Error trend damping.", "微分增益", "依系統而定", "抑制誤差變化趨勢。"]], "u(t)=K_pe(t)+K_i\\int e(t)dt+K_d\\dot{e}(t)", "G_{cl}(s)=\\frac{C(s)P(s)}{1+C(s)P(s)}", "class PID:\n    def __init__(self, kp, ki, kd):\n        self.kp, self.ki, self.kd = kp, ki, kd\n        self.i = 0.0\n        self.prev = 0.0\n    def update(self, e, dt):\n        self.i += e * dt\n        d = (e - self.prev) / dt\n        self.prev = e\n        return self.kp*e + self.ki*self.i + self.kd*d", plot("pid-step", "pidStepResponse", L("PID-shaped step response", "PID 調整後的階躍響應"), [param("kp", "K_p", "Proportional", "比例", 0.1, 10, 0.1, 2, ""), param("ki", "K_i", "Integral", "積分", 0, 5, 0.1, 0.8, ""), param("kd", "K_d", "Derivative", "微分", 0, 4, 0.1, 0.5, "")], [metric("overshoot", "Overshoot", "過衝"), metric("settling", "Settling", "安定時間"), ...baseMetrics])],
  ["kalman-filter", "018", "systems-estimation", "Kalman filter", "卡爾曼濾波器", "K_k=P_k^-H^T(HP_k^-H^T+R)^{-1}", ["kalman", "estimation", "sensor"], "A noisy IMU or encoder stream becomes usable when model prediction and measurement correction are balanced.", "雜訊很大的 IMU 或編碼器資料，透過模型預測與量測修正的權衡後才變得可用。", "Why does the Kalman gain behave like mathematical trust?", "為什麼卡爾曼增益可以看成數學化的信任程度？", [["$Q$", "Process noise covariance", "varies", "Trust penalty on the model.", "過程雜訊共變異", "依系統而定", "對模型可信度的懲罰。"], ["$R$", "Measurement noise covariance", "varies", "Trust penalty on the sensor.", "量測雜訊共變異", "依系統而定", "對感測器可信度的懲罰。"], ["$K_k$", "Kalman gain", "none", "Weight applied to measurement residual.", "卡爾曼增益", "無", "量測殘差的權重。"]], "P_k^-=AP_{k-1}A^T+Q", "K_k=P_k^-H^T(HP_k^-H^T+R)^{-1}", "def kalman_1d(zs, q, r):\n    x, p = 0.0, 1.0\n    out = []\n    for z in zs:\n        p += q\n        k = p / (p + r)\n        x = x + k * (z - x)\n        p = (1 - k) * p\n        out.append(x)\n    return out", plot("kalman-estimate", "kalmanEstimate", L("Measurement and filtered estimate", "量測值與濾波估測"), [param("q", "Q", "Process noise", "過程雜訊", 0.001, 1, 0.001, 0.05, ""), param("r", "R", "Measurement noise", "量測雜訊", 0.01, 5, 0.01, 1, "")], [metric("finalGain", "Final gain", "最終增益"), ...baseMetrics])],
  ["state-space", "019", "systems-estimation", "State-space representation", "狀態空間表示法", "\\dot{x}=Ax+Bu,\\quad y=Cx+Du", ["state-space", "control", "eigenvalues"], "A drone attitude controller cannot be described well by one input and one output; internal states matter.", "無人機姿態控制很難只用單一輸入輸出描述，內部狀態才是關鍵。", "Why do eigenvalues of A predict trajectory shape?", "為什麼 $A$ 矩陣的特徵值能預測軌跡形狀？", [["$x$", "State vector", "varies", "Minimum variables needed to continue the model.", "狀態向量", "依系統而定", "延續模型所需的最少變量。"], ["$A$", "System matrix", "1/s", "Natural dynamics.", "系統矩陣", "1/s", "自然動態。"], ["$B,C,D$", "Input/output matrices", "varies", "How input enters and output is read.", "輸入/輸出矩陣", "依系統而定", "輸入如何進入、輸出如何讀取。"]], "\\dot{x}=Ax+Bu", "y=Cx+Du", "import numpy as np\n\ndef simulate_state(A, B, x, u, dt):\n    return x + dt * (A @ x + B @ u)", plot("phase-portrait", "stateSpacePhase", L("Second-order phase portrait", "二階系統相平面"), [param("a0", "a_0", "Stiffness term", "剛性項", 0.2, 8, 0.1, 2, ""), param("a1", "a_1", "Damping term", "阻尼項", -2, 6, 0.1, 0.8, "")], [metric("eigen", "Eigenvalue type", "特徵值型態"), ...baseMetrics])],
  ["pll-frequency-synthesis", "020", "systems-estimation", "PLL frequency synthesis theory", "PLL 頻率合成理論", "H(s)=\\frac{K_dK_vF(s)/s}{1+K_dK_vF(s)/s}", ["pll", "frequency-synthesis", "feedback"], "A clock synthesizer must lock quickly without injecting too much reference jitter into the output.", "時脈合成器需要快速鎖定，但又不能把太多參考時脈抖動帶到輸出。", "Why is loop bandwidth the central PLL design tradeoff?", "為什麼迴路頻寬是 PLL 設計的核心取捨？", [["$K_d$", "Phase detector gain", "V/rad", "Converts phase error to control signal.", "相位偵測器增益", "V/rad", "把相位誤差轉成控制訊號。"], ["$K_v$", "VCO gain", "rad/s/V", "Converts control voltage to frequency.", "VCO 增益", "rad/s/V", "把控制電壓轉成頻率。"], ["$F(s)$", "Loop filter", "varies", "Shapes bandwidth and damping.", "迴路濾波器", "依設計而定", "塑造頻寬與阻尼。"]], "G(s)=\\frac{K_dK_vF(s)}{s}", "H(s)=\\frac{G(s)}{1+G(s)}", "import numpy as np\n\ndef pll_error(t, wn, zeta):\n    wd = wn*np.sqrt(max(1e-6, 1-zeta*zeta))\n    return np.exp(-zeta*wn*t) * np.cos(wd*t)", plot("pll-lock", "expressionPlot", L("Phase-error convergence", "相位誤差收斂"), [param("bandwidth", "\\omega_n", "Loop bandwidth", "迴路頻寬", 0.5, 10, 0.1, 3, "rad/s"), param("zeta", "\\zeta", "Damping ratio", "阻尼比", 0.2, 2, 0.05, 0.8, "")], [metric("expressions", "Expressions", "運算式"), ...baseMetrics], { xVariable: "t", xMin: "0", xMax: "8", samples: 400, yLabel: "Phase error", expressions: [{ label: "phase error", expression: "exp(-zeta * bandwidth * t) * cos(bandwidth * sqrt(max(0.001, 1 - zeta*zeta)) * t)" }] })]
];

function normalizeTopic(raw) {
  if (!Array.isArray(raw)) return raw;
  const [id, number, category, titleEn, titleTw, formula, tags, sceneEn, sceneTw, questionEn, questionTw, vars, firstEq, finalEq, code, plotElement] = raw;
  return {
    id,
    number,
    category,
    title: [titleEn, titleTw],
    description: [`Interactive derivation module for ${titleEn}.`, `${titleTw} 的互動推導模組。`],
    summary: [`Connects the formula to engineering interpretation, limits, and computation.`, `把公式連回工程直覺、極限條件與可執行計算。`],
    formula,
    tags,
    scene: [sceneEn, sceneTw],
    question: [questionEn, questionTw],
    variables: vars,
    assumptions: [
      ["Linear time-invariant or locally linear behavior is assumed when using transfer functions.", "使用轉移函數時，假設系統為線性時不變，或至少可在工作點附近線性化。"],
      ["Parameters are treated as constant over the analysis interval.", "分析區間內，參數視為常數。"],
      ["Numerical plots are educational approximations, not full circuit or field solvers.", "互動圖表是用於理解公式的近似模型，不取代完整電路或場求解器。"]
    ],
    derivation: [
      ["start", "Start from the governing relation", "從支配關係出發", firstEq, "This is the smallest equation that preserves the physics needed for the formula.", "這是保留該公式物理意義所需的最小關係式。", "Choose the model state or domain.", "選定模型狀態或分析域。"],
      ["simplify", "Apply engineering assumptions", "套用工程假設", firstEq, "The model is simplified so the dominant mechanism is visible.", "透過假設把次要效應移除，讓主導機制清楚呈現。", "Drop second-order parasitics unless they are the topic.", "忽略非本主題的二階寄生效應。"],
      ["result", "Rearrange to the working formula", "整理成可用公式", finalEq, "The final form is the one used for design, simulation, or measurement review.", "最後形式就是設計、模擬或量測檢查時會使用的式子。", "Algebraic rearrangement.", "代數整理。"]
    ],
    boundaries: [
      ["parameter $\\to0$", "dominant term remains", "The formula reduces to its simplest physical behavior.", "公式會退化到最簡單的物理行為。"],
      ["parameter $\\to\\infty$", "parasitics and implementation limits dominate", "The closed-form equation becomes a warning rather than a full implementation model.", "封閉形式公式會變成警示，而不是完整實作模型。"]
    ],
    rules: [
      ["Check units before trusting numeric output.", "相信數值輸出前先檢查單位。"],
      ["Sweep the key parameter through the critical region, not only the nominal value.", "不要只看標稱值，必須掃過關鍵臨界區域。"],
      ["Validate the simplified formula against measurement or simulation before committing hardware.", "硬體定案前，用量測或模擬驗證簡化公式。"]
    ],
    code,
    next: [`The next useful step is to compare this formula against a measured dataset.`, `下一步適合把此公式與實測資料或模擬資料交叉比較。`],
    plot: plotElement
  };
}

function buildFormula(topic) {
  const variables = topic.variables.map(([symbol, quantityEn, unitEn, meaningEn, quantityTw, unitTw, meaningTw]) => ({
    symbol,
    quantityEn,
    quantityTw,
    unit: unitTw || unitEn,
    meaningEn,
    meaningTw
  }));

  const assumptionRows = topic.assumptions.map((item, index) => [
    L(`Assumption ${index + 1}`, `假設 ${index + 1}`),
    Array.isArray(item) ? L(item[0], item[1], item[2] || item[1]) : L(item, item)
  ]);

  return {
    status: "open",
    route: `/formula.html?id=${topic.id}`,
    id: topic.id,
    number: topic.number,
    category: topic.category,
    title: L(topic.title[0], topic.title[1]),
    description: L(topic.description[0], topic.description[1]),
    summary: L(topic.summary[0], topic.summary[1]),
    formula: topic.formula,
    tags: topic.tags,
    sections: [
      section("intuition", "Problem Definition", { en: "Problem statement and variable definition", tw: "問題陳述與變量定義", cn: "问题陈述与变量定义" }, [
        text("observed-phenomenon", topic.scene[0], topic.scene[1]),
        note("driving-question", topic.question[0], topic.question[1], topic.question[1], L("Key question", "關鍵提問", "关键提问")),
        variableTable(variables)
      ]),
      section("logical-chain", "Analytical Derivation", { en: "Model assumptions and analytical derivation", tw: "模型假設與解析推導", cn: "模型假设与解析推导" }, [
        table("model-assumptions", L("Model simplifications", "模型簡化假設"), [L("Item", "項目"), L("Assumption", "假設")], assumptionRows),
        ...topic.derivation.map((step) => derivationStep(...step)),
        ...topic.boundaries.map((item, index) => boundaryCase(`boundary-${index + 1}`, item[0], item[1], item[1], item[2], item[3]))
      ]),
      section("sandbox", "Parametric Verification", { en: "Parametric simulation and numerical verification", tw: "參數化模擬與數值驗證", cn: "参数化仿真与数值验证" }, [
        text("sandbox-purpose", "Use the sliders to change the physical parameters and watch the formula expose its behavior. The metric panel keeps sample count and compute latency visible so the visualization remains an engineering instrument, not only a picture.", "調整滑塊可以直接改變物理參數，觀察公式的性格如何浮現。指標面板保留採樣點數與計算延遲，讓圖表不只是圖片，而是可檢查的工程工具。"),
        note("critical-marker", "When a slider crosses a critical region, inspect both the plotted curve and the metric panel; this is where most design mistakes become visible.", "滑塊跨過臨界區時，同時觀察曲線與指標面板；多數設計錯誤會在這些區域先顯現。", undefined, L("Critical value feedback", "臨界值提示", "临界值提示")),
        topic.plot
      ]),
      section("engineering-insights", "Engineering Application", { en: "Engineering application and implementation notes", tw: "工程應用與實作註記", cn: "工程应用与实现注记" }, [
        designRules(topic.rules.map(([en, tw]) => ({ en, tw }))),
        codeBlock("python", topic.code),
        note("next-topic", topic.next[0], topic.next[1], topic.next[1], L("Further thinking", "延伸思考", "延伸思考"))
      ])
    ]
  };
}

const data = {
  categories,
  items: [...topics, ...extraTopics.map(normalizeTopic)].map(buildFormula)
};

fs.writeFileSync(formulasPath, `${JSON.stringify(data, null, 2)}\n`, "utf8");

const i18n = JSON.parse(fs.readFileSync(i18nPath, "utf8"));
Object.assign(i18n.en, {
  "nav.formulas": "Formula Lab",
  "formulas.eyebrow": "Derivation modules",
  "formulas.title": "Formula Lab",
  "formulas.description": "Structured formula derivations with engineering intuition, step-by-step math, and interactive validation.",
  "formulas.filterLabel": "Category filter",
  "formulas.searchLabel": "Search formulas",
  "formulas.searchPlaceholder": "Search derivations...",
  "formulas.empty": "No formulas match the current filter.",
  "formula.back": "Back to formula list",
  "formula.missingTitle": "Formula not found",
  "formula.missingDescription": "The requested formula id is not registered in data/formulas.json.",
  "formula.openModule": "Open module",
  "formula.waiting": "Waiting"
});
Object.assign(i18n["zh-TW"], {
  "nav.system": "個人入口",
  "nav.portal": "入口",
  "nav.bio": "簡介",
  "nav.wallpapers": "桌布",
  "nav.projects": "專案",
  "nav.links": "快速連結",
  "nav.youtube": "YouTube",
  "nav.tools": "工具",
  "nav.contact": "聯絡",
  "meta.version": "靜態版本",
  "nav.files": "檔案",
  "nav.formulas": "公式實驗室",
  "formulas.eyebrow": "推導模組",
  "formulas.title": "公式實驗室",
  "formulas.description": "以工程直覺、逐步推導與互動驗證組成的公式展示區。",
  "formulas.filterLabel": "分類篩選",
  "formulas.searchLabel": "搜尋公式",
  "formulas.searchPlaceholder": "搜尋推導...",
  "formulas.empty": "目前篩選條件下沒有符合的公式。",
  "formula.back": "返回公式列表",
  "formula.missingTitle": "找不到公式",
  "formula.missingDescription": "指定的公式 id 尚未登錄在 data/formulas.json。",
  "formula.openModule": "開啟模組",
  "formula.waiting": "等待中"
});
Object.assign(i18n["zh-CN"], {
  "nav.system": "个人入口",
  "nav.portal": "入口",
  "nav.bio": "简介",
  "nav.wallpapers": "桌布",
  "nav.projects": "项目",
  "nav.links": "快速链接",
  "nav.youtube": "YouTube",
  "nav.tools": "工具",
  "nav.contact": "联系",
  "meta.version": "静态版本",
  "nav.files": "文件",
  "nav.formulas": "公式实验室",
  "formulas.eyebrow": "推导模块",
  "formulas.title": "公式实验室",
  "formulas.description": "以工程直觉、逐步推导与互动验证组成的公式展示区。",
  "formulas.filterLabel": "分类筛选",
  "formulas.searchLabel": "搜索公式",
  "formulas.searchPlaceholder": "搜索推导...",
  "formulas.empty": "当前筛选条件下没有符合的公式。",
  "formula.back": "返回公式列表",
  "formula.missingTitle": "找不到公式",
  "formula.missingDescription": "指定的公式 id 尚未登记在 data/formulas.json。",
  "formula.openModule": "打开模块",
  "formula.waiting": "等待中"
});
fs.writeFileSync(i18nPath, `${JSON.stringify(i18n, null, 2)}\n`, "utf8");

console.log(`Wrote ${data.items.length} formula items to ${path.relative(root, formulasPath)}`);
