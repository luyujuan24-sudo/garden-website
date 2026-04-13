// --- 全局变量与 ECharts 实例 ---
let chartsInitialized = false;
let wordCloudInitialized = false;
let currentEraIndex = 0;
let mapInstance = null;
let heatLayer = null;
let markersArray = [];
let lineChart = null;
let pieChart = null;
let currentGarden = '';
const userRatings = {}; 
let selectedFragments = [];
let particles = [];

// --- 辅助函数 ---
function getAreaByLngLat(lng, lat) {
    if (lat >= 39.5) return "北方";
    if (lat >= 34 && lng <= 115) return "中原";
    if (lng >= 118 && lat >= 30) return "江南";
    if (lng >= 113 && lat <= 25) return "岭南";
    if (lng <= 105 && lat >= 28) return "西南";
    if (lng >= 113 && lat <= 30) return "华中";
    return "中原";
}

function getGardenType(lng, lat) {
    if (lat >= 34.5) return "北方园林";
    if (lng >= 118 && lat >= 29) return "江南园林";
    if (lng >= 112 && lat <= 25.5) return "岭南园林";
    return "其他";
}

const eraImageFolderMap = {
    "殷周秦汉": "殷周名园",
    "魏晋南北朝": "魏晋南北朝名园名录",
    "隋唐": "隋唐名园名录",
    "宋辽金": "宋辽金名园录图片",
    "元": "元朝名园录",
    "明": "明朝名园录",
    "清": "image"
};

const eraFallbackImgMap = {
    "殷周秦汉": "image/殷周时期.png",
    "魏晋南北朝": "image/魏晋南北朝私家园林.png",
    "隋唐": "image/华清池2.png",
    "宋辽金": "宋辽金名园录图片/艮岳.jpeg",
    "元": "元朝名园录/狮子林.jpg",
    "明": "明朝名园录/拙政园.jpeg",
    "清": "image/颐和园.png"
};

const gardenImageNameAlias = {
    "沪渎园": "沪读园",
    "华清池": "华清宫"
};

function normalizeGardenName(name) {
    return String(name || '').replace(/\s+/g, '').trim();
}

function escapeJsSingleQuotedString(value) {
    return String(value || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

function buildGardenImageCandidates(name, era) {
    const normalized = normalizeGardenName(name);
    const baseNames = [];
    const pushBase = (v) => {
        const nv = normalizeGardenName(v);
        if (nv && !baseNames.includes(nv)) baseNames.push(nv);
    };

    pushBase(normalized);
    if (gardenImageNameAlias[normalized]) pushBase(gardenImageNameAlias[normalized]);
    if (normalized.endsWith('前身')) pushBase(normalized.slice(0, -2));
    if (normalized.endsWith('园林')) pushBase(normalized.slice(0, -2));

    const primaryFolder = eraImageFolderMap[era];
    const folders = [];
    const pushFolder = (f) => { if (f && !folders.includes(f)) folders.push(f); };
    pushFolder(primaryFolder);
    if (primaryFolder !== "image") pushFolder("image");

    const exts = ['.png', '.jpg', '.jpeg', '.webp'];
    const candidates = [];
    folders.forEach(folder => {
        baseNames.forEach(base => {
            exts.forEach(ext => {
                candidates.push(`${folder}/${base}${ext}`);
            });
        });
    });
    return candidates;
}

function setImageWithFallback(imgEl, candidates, fallbackSrc) {
    if (!imgEl) return;
    const uniqueCandidates = Array.from(new Set((candidates || []).filter(Boolean)));
    let idx = 0;

    const tryNext = () => {
        if (idx >= uniqueCandidates.length) {
            imgEl.onerror = null;
            imgEl.src = fallbackSrc;
            return;
        }
        imgEl.src = uniqueCandidates[idx++];
    };

    imgEl.onerror = tryNext;
    tryNext();
}

function hydrateGardenThumbs(containerEl, era) {
    if (!containerEl) return;
    const fallback = eraFallbackImgMap[era] || "image/盆景.jpg";
    containerEl.querySelectorAll('img.garden-thumb').forEach(img => {
        const name = img.getAttribute('data-name') || '';
        setImageWithFallback(img, buildGardenImageCandidates(name, era), fallback);
    });
}

const eraNarratives = {
    "殷周秦汉": "早期园林多由“苑囿、离宫、台榭、池沼”发展而来，强调规模、礼制与观游功能，常以大水面与高台形成视觉中心。",
    "魏晋南北朝": "社会动荡与玄学之风使园林更重“寄情山水”，私家园与寺观园林兴起，追求自然野逸与清旷意境。",
    "隋唐": "都城宫苑气象宏阔，山水、建筑与仪礼并重；同时诗酒风雅与文人审美进入造园体系，形成诗画互证的空间气质。",
    "宋辽金": "写意审美成熟，理水叠山与“移步换景”更精微；江南私园兴盛，文人题咏与园居生活紧密相连。",
    "元": "文人园居更显疏淡简远，偏好留白与借景，禅意与诗意交织，空间更强调“清、淡、静”。",
    "明": "造园理论与实践臻于成熟，私家园林构图严谨而富变化，亭台轩榭与花木山石形成精密的画面组织。",
    "清": "皇家园林规模宏大、山水格局更完整；私园技艺亦更精纯，地方园林风格分化明显，讲究礼序与自然并举。"
};

const gardenAutoFacts = {
    "上林苑": {
        history: "上林苑是秦汉时期著名的皇家苑囿系统之一，兼具狩猎、游观与礼制象征等功能，体现了早期“苑囿传统”的宏大格局。",
        relics: "相关遗迹多以地名、水系与考古遗址等方式留存，具体范围随历代变迁而调整。",
        anecdote: "史籍常以“上林”指代皇家苑囿的典型形态，亦成为后世文学中“盛大苑囿”的意象来源。"
    },
    "阿房宫": {
        history: "阿房宫常被视为秦代宫殿营建理想与国家动员能力的象征，其形象在历史叙述与文学想象中长期叠加。",
        relics: "关于其规模与形制，历史文献与考古研究长期并行讨论，遗址相关展示以“秦汉都城遗址体系”中的重要节点呈现。",
        anecdote: "“阿房宫”在后世文论里常作为“盛极而衰”的象征性地标，被大量诗文引用。"
    },
    "未央宫": {
        history: "未央宫为西汉长安城的重要宫殿区，作为政治与礼仪中心之一，代表了汉代宫苑体系的空间秩序与礼制结构。",
        relics: "遗址以夯土台基、宫城格局与出土遗存为主要线索，可从遗址公园与博物馆展示体系中获得更完整的空间想象。",
        anecdote: "“未央”寓意绵延无尽，常被后世作为“帝都宫阙”的文学意象。"
    },
    "昆明池": {
        history: "汉代开凿的大型水面工程，兼具水利、操练与游观等多重功能，是早期“以水为骨”的宫苑理水范式之一。",
        relics: "遗迹线索多与水系遗存、堤岸与周边遗址分布相关，反映古代大型水工与宫苑的耦合关系。",
        anecdote: "后世常以“昆明池”指代宏阔水面与水上活动的宫苑图景。"
    },
    "兰亭": {
        history: "兰亭与东晋王羲之等人的雅集叙事紧密相关，成为文人园居与山水清谈的精神象征之一。",
        relics: "相关遗址与纪念性空间多以碑刻、题咏、复建景点与文化展示的形式延续其影响。",
        anecdote: "“曲水流觞”与《兰亭集序》的故事塑造了“以景成文、以文传景”的经典范式。"
    },
    "金谷园": {
        history: "金谷园常见于魏晋南北朝时期的名园叙事中，映射士族生活与园居文化的繁华面向，也折射动荡时代的盛衰无常。",
        relics: "其具体形制多赖文献线索与后世传承意象，空间细节往往难以完全复原。",
        anecdote: "与金谷宴集等文学叙事相关，后世常借其比喻豪奢与风流。"
    },
    "西苑": {
        history: "“西苑”常指都城西侧的大型宫苑水系与园林区域，在隋唐语境中与都城格局、礼仪游观与山水营造紧密相连。",
        relics: "遗存多以都城遗址、水系格局与考古发现为线索，展示侧重“宫苑—水系—城市”的整体关系。",
        anecdote: "在后世叙事中，“西苑”经常作为“帝都盛景”的代称出现。"
    },
    "大明宫太液池": {
        history: "大明宫是唐代长安的重要宫殿群之一，太液池作为宫苑水景核心，体现了盛唐宫苑对大水面、对景与礼仪空间的综合运用。",
        relics: "遗址展示多可从宫殿区格局、池沼位置与轴线关系理解“礼制秩序 + 山水游观”的复合结构。",
        anecdote: "“太液”之名在历代宫苑中反复出现，常指核心水景与仙境想象的结合。"
    },
    "兴庆宫": {
        history: "兴庆宫在唐代都城生活中地位重要，园林部分与宫殿生活、节庆游乐与诗文题咏关联密切。",
        relics: "遗址与公园化展示有助于理解唐代宫苑在城市空间中的位置与尺度感。",
        anecdote: "唐诗语境中常可见对宫苑景色的描绘，反映“宫苑亦为文化舞台”的特征。"
    },
    "华清宫": {
        history: "华清宫位于骊山北麓，以温泉行宫闻名，历代营建叠加，唐代尤盛，既是皇家休憩之所，也是历史叙事高度密集的地点。",
        relics: "遗址常以温泉浴池遗构、宫殿基址与相关纪念空间呈现，便于从“温泉—山势—宫苑”三者关系理解其场所性。",
        anecdote: "与《长恨歌》等文学叙事相关联，使其成为盛唐浪漫与兴衰象征的复合意象。"
    },
    "九成宫": {
        history: "九成宫作为避暑行宫类型的重要代表，体现了都城之外“山水—宫殿—气候”共同塑造的皇家园居方式。",
        relics: "相关遗址与碑刻传统常被视为理解行宫制度与书法文化传播的重要线索。",
        anecdote: "历代题刻与文人记述强化了其“清凉避暑、山水胜境”的文化记忆。"
    },
    "辋川别业": {
        history: "辋川别业常与唐代文人山水实践相关，被视为“诗画入园”的典型语境之一，强调借景、意境与日常园居。",
        relics: "其空间多依赖诗文与绘画线索重构，成为后世理解文人园居的想象原型。",
        anecdote: "诗文中的“景名体系”常被用作后世园林命名与题咏的来源。"
    },
    "曲江池": {
        history: "曲江池作为唐代长安的重要游赏水景区域，承载节庆游乐与城市公共生活，是都城景观系统的重要节点。",
        relics: "水系遗存与城市格局的关系是理解其空间意义的关键：它不仅是园林，也是城市景观基础设施。",
        anecdote: "“曲江流饮”与踏青游宴等传统叙事，使其成为唐代都市风雅的代表意象。"
    },
    "艮岳": {
        history: "艮岳是北宋皇家园林营造的代表之一，以大规模叠山理水与奇石花木组织著称，体现宫苑审美与技术动员的顶峰状态。",
        relics: "相关遗存多见于史籍与后世传述，对其空间想象常以“万岁山”等关键词串联。",
        anecdote: "后世常以艮岳讨论“极致审美与国力消耗”的张力，成为园林史中的重要议题。"
    },
    "沧浪亭": {
        history: "沧浪亭是江南园林早期成熟形态的重要代表之一，以清雅质朴的文人气质和与水系的关系著称。",
        relics: "园林的廊、窗、台与水岸关系可作为理解“借景与界面”的关键线索。",
        anecdote: "园名与诗文传统关联紧密，常被用来表达“濯缨清志”的精神旨趣。"
    },
    "沈园": {
        history: "沈园在宋代园林文化记忆中具有特殊位置，园林空间与文学叙事彼此强化，使其成为“园以文传”的典型案例。",
        relics: "纪念性空间与题刻传统使园林叙事得以延续，形成“可游可读”的复合场所。",
        anecdote: "陆游《钗头凤》相关故事让沈园成为中国园林中最具情感色彩的典故之一。"
    },
    "狮子林": {
        history: "狮子林以假山叠石与曲折游线著称，体现江南园林在有限尺度内营造“迷宫式山水”的能力。",
        relics: "太湖石假山群与洞壑游径是其最具辨识度的遗存线索。",
        anecdote: "与禅意空间与文人雅集的叙事常相互交织，形成“山水—禅—文”一体的文化想象。"
    },
    "拙政园": {
        history: "拙政园是江南私家园林的代表之一，以水为骨架，建筑与植物围绕水面展开，形成层层递进的观赏节奏。",
        relics: "以分区水面、桥廊、厅堂与对景关系为线索，能清晰感受到“水木清华”的空间组织。",
        anecdote: "其名与文人自况相关，强调“以拙为雅”的审美立场，后世题咏甚多。"
    },
    "留园": {
        history: "留园以建筑与空间序列见长，长廊与院落组织形成清晰的游线节奏，体现明清私园的成熟技法。",
        relics: "厅堂、廊道、假山与花木共同构成多层次画面，适合从“框景、对景、漏景”角度解读。",
        anecdote: "园名与“停留”之意相合，强化了园林作为“可久居、可久游”的生活空间属性。"
    },
    "网师园": {
        history: "网师园以“小中见大”著称，小尺度空间通过精密的理水与建筑布置呈现深远意境。",
        relics: "临水建筑与池面比例关系是理解其精致度的关键。",
        anecdote: "常被用来说明江南园林如何在方寸之间容纳山水气象。"
    },
    "豫园": {
        history: "豫园代表城市园林与商业街区邻接的复合形态，既是私园传统的延续，也承载城市公共文化记忆。",
        relics: "假山、池塘、廊道与院落的组合可作为典型案例理解城市语境中的“咫尺山林”。",
        anecdote: "与地方传说、节俗活动与题刻文化往往相互叠加，使园林成为城市文化舞台的一部分。"
    },
    "颐和园": {
        history: "颐和园以大水面与山体构成完整山水格局，体现清代皇家园林“借山为屏、以水为镜”的总体构图能力。",
        relics: "长廊、昆明湖、万寿山等空间线索构成清晰的观景体系，可从轴线与借景关系理解其宏观秩序。",
        anecdote: "皇家园林往往与重大历史事件、政治叙事并行存在，使其兼具审美与历史双重阅读路径。"
    },
    "圆明园": {
        history: "圆明园代表清代皇家园林营造的高度综合：山水格局、建筑群与题名体系共同构成宏大的空间叙事。",
        relics: "现状以遗址景观为主，残存构件与水系线索使“盛景与断壁”形成强烈对照。",
        anecdote: "其历史命运使其成为近代史与文化记忆的重要场所，园林阅读常与历史反思相连。"
    },
    "避暑山庄": {
        history: "避暑山庄以山水格局与多类型建筑群组合著称，强调“自然山水的园林化”，并与周边寺庙建筑群共同构成更大的景观体系。",
        relics: "湖区、平原区与山区的分区构成理解其规模与类型的关键线索。",
        anecdote: "作为帝王季节性驻跸空间，其制度性与审美性同时塑造了园林的独特气质。"
    }
};

function stripHtmlText(html) {
    return String(html || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
}

function findGardenMetaByName(name) {
    const normalized = normalizeGardenName(name);
    const alias = gardenImageNameAlias[normalized] ? normalizeGardenName(gardenImageNameAlias[normalized]) : '';
    return gardenData.find(g => {
        const gName = normalizeGardenName(g[1]);
        return gName === normalized || (alias && gName === alias);
    }) || null;
}

function buildAutoGardenDetailHtml(name, era, baseHtml = '') {
    const meta = findGardenMetaByName(name);
    const lng = meta ? meta[2] : null;
    const lat = meta ? meta[3] : null;
    const region = (lng !== null && lat !== null) ? getAreaByLngLat(lng, lat) : '';
    const type = (lng !== null && lat !== null) ? getGardenType(lng, lat) : '';
    const intro = (eraBackgrounds[era] && eraBackgrounds[era].intro) ? eraBackgrounds[era].intro : '';
    const narrative = eraNarratives[era] || '';
    const facts = gardenAutoFacts[normalizeGardenName(name)] || null;
    const baseText = stripHtmlText(baseHtml);

    const overviewParts = [];
    if (era) overviewParts.push(`时代：${era}`);
    if (region) overviewParts.push(`区域：${region}`);
    if (type && type !== "其他") overviewParts.push(`类型：${type}`);
    if (lng !== null && lat !== null) overviewParts.push(`经纬度：${lng.toFixed(4)}，${lat.toFixed(4)}`);

    const overview = `${overviewParts.join(' · ')}。${narrative}`;
    const history = facts?.history || `关于“${name}”的形制与沿革，常见线索来自史籍记述、地方志与后世题咏。若为宫苑类型，多与都城格局、礼仪游观与水系营造相关；若为私园类型，则常与主人身份、园居生活与诗画审美相互映照。`;
    const relics = facts?.relics || `古迹线索通常体现在遗址格局、水系遗存、台基、碑刻题名与相关地名传统之中。即便实物保存有限，仍可通过“轴线—水面—建筑界面—借景关系”去重建其空间想象。`;
    const anecdote = facts?.anecdote || `园林典故多与“园名来历、主人逸事、诗文题咏、雅集活动”相关。阅读时可把园景当作一幅可行走的画卷：先辨水与山石，再看廊与窗的取景，再读题名与诗文的情绪指向。`;

    const blocks = [];
    if (baseText) {
        blocks.push(`
            <div class="detail-block">
                <h4><i class="fa-solid fa-feather-pointed"></i> 现有简介</h4>
                ${baseHtml}
            </div>
        `);
    }

    blocks.push(`
        <div class="detail-block">
            <h4><i class="fa-solid fa-map-location-dot"></i> 概览</h4>
            <p>${overview}</p>
            ${intro ? `<p>${intro}</p>` : ''}
        </div>
    `);

    blocks.push(`
        <div class="detail-block">
            <h4><i class="fa-solid fa-clock-rotate-left"></i> 历史</h4>
            <p>${history}</p>
        </div>
    `);

    blocks.push(`
        <div class="detail-block">
            <h4><i class="fa-solid fa-landmark"></i> 古迹</h4>
            <p>${relics}</p>
        </div>
    `);

    blocks.push(`
        <div class="detail-block">
            <h4><i class="fa-solid fa-book-open"></i> 典故</h4>
            <p>${anecdote}</p>
        </div>
    `);

    return blocks.join('');
}

const flyFlowerCorpus = {
    "花": [
        "人间四月芳菲尽，山寺桃花始盛开。",
        "迟日江山丽，春风花草香。",
        "小楼一夜听春雨，深巷明朝卖杏花。",
        "墙角数枝梅，凌寒独自开。遥知不是雪，为有暗香来。",
        "等闲识得东风面，万紫千红总是春。"
    ],
    "月": [
        "海上生明月，天涯共此时。",
        "举头望明月，低头思故乡。",
        "明月松间照，清泉石上流。",
        "但愿人长久，千里共婵娟。",
        "月出惊山鸟，时鸣春涧中。"
    ],
    "春": [
        "春眠不觉晓，处处闻啼鸟。",
        "春风又绿江南岸，明月何时照我还。",
        "国破山河在，城春草木深。",
        "野火烧不尽，春风吹又生。",
        "等闲识得东风面，万紫千红总是春。"
    ],
    "秋": [
        "自古逢秋悲寂寥，我言秋日胜春朝。",
        "停车坐爱枫林晚，霜叶红于二月花。",
        "长风万里送秋雁，对此可以酣高楼。",
        "银烛秋光冷画屏，轻罗小扇扑流萤。",
        "落霞与孤鹜齐飞，秋水共长天一色。"
    ],
    "山": [
        "会当凌绝顶，一览众山小。",
        "空山新雨后，天气晚来秋。",
        "横看成岭侧成峰，远近高低各不同。",
        "不识庐山真面目，只缘身在此山中。",
        "明月松间照，清泉石上流。"
    ],
    "水": [
        "黄河之水天上来，奔流到海不复回。",
        "逝者如斯夫，不舍昼夜。",
        "抽刀断水水更流，举杯消愁愁更愁。",
        "一道残阳铺水中，半江瑟瑟半江红。",
        "日出江花红胜火，春来江水绿如蓝。"
    ],
    "酒": [
        "对酒当歌，人生几何。",
        "劝君更尽一杯酒，西出阳关无故人。",
        "葡萄美酒夜光杯，欲饮琵琶马上催。",
        "人生得意须尽欢，莫使金樽空对月。",
        "借问酒家何处有，牧童遥指杏花村。"
    ]
};

function highlightChar(line, ch) {
    const esc = ch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return line.replace(new RegExp(esc, 'g'), `<b>${ch}</b>`);
}

function renderFlyFlowerList(ch) {
    const list = document.getElementById('fly-result-list');
    if (!list) return;
    list.innerHTML = '';
    const pool = flyFlowerCorpus[ch] || [];
    const items = pool.slice(0, 8);
    if (items.length === 0) {
        list.innerHTML = `<li>暂无“${ch}”相关诗句，试试上面的令字按钮。</li>`;
        return;
    }
    list.innerHTML = items.map(t => `<li>${highlightChar(t, ch)}</li>`).join('');
}

function initFlyFlowerGame() {
    const chips = document.querySelectorAll('.fly-chip');
    chips.forEach(btn => {
        btn.addEventListener('click', () => {
            const ch = btn.getAttribute('data-char');
            const input = document.getElementById('fly-char-input');
            if (input) input.value = ch;
            renderFlyFlowerList(ch);
        });
    });
    const startBtn = document.getElementById('fly-start-btn');
    if (startBtn) {
        startBtn.addEventListener('click', () => {
            const input = document.getElementById('fly-char-input');
            const ch = (input && input.value) ? input.value.trim() : '';
            if (!ch) return;
            renderFlyFlowerList(ch);
        });
    }
    const addBtn = document.getElementById('fly-add-btn');
    if (addBtn) {
        addBtn.addEventListener('click', () => {
            const inputCh = document.getElementById('fly-char-input');
            const ch = (inputCh && inputCh.value) ? inputCh.value.trim() : '';
            const lineInput = document.getElementById('fly-user-line');
            const line = (lineInput && lineInput.value) ? lineInput.value.trim() : '';
            if (!ch || !line || line.indexOf(ch) === -1) return;
            const list = document.getElementById('fly-result-list');
            if (list) {
                const li = document.createElement('li');
                li.innerHTML = highlightChar(line, ch);
                list.appendChild(li);
                lineInput.value = '';
            }
        });
    }
}

function initPhotoInsight() {
    const drop = document.getElementById('photo-drop');
    const input = document.getElementById('photo-input');
    const choose = document.getElementById('photo-choose');
    const analyze = document.getElementById('photo-analyze');
    const preview = document.getElementById('photo-preview');
    let currentFile = null;
    const setPreview = file => {
        const url = URL.createObjectURL(file);
        preview.src = url;
        preview.style.display = 'block';
        const hint = drop.querySelector('.photo-drop-hint');
        if (hint) hint.style.display = 'none';
        analyze.disabled = false;
        currentFile = file;
    };
    if (choose) choose.onclick = () => input && input.click();
    if (input) input.onchange = e => {
        const f = e.target.files && e.target.files[0];
        if (f) setPreview(f);
    };
    if (drop) {
        drop.addEventListener('dragover', e => { e.preventDefault(); drop.classList.add('dragover'); });
        drop.addEventListener('dragleave', () => drop.classList.remove('dragover'));
        drop.addEventListener('drop', e => {
            e.preventDefault(); drop.classList.remove('dragover');
            const f = e.dataTransfer.files && e.dataTransfer.files[0];
            if (f && f.type.startsWith('image/')) setPreview(f);
        });
    }
    if (analyze) analyze.onclick = async () => {
        if (!currentFile) return;
        const img = new Image();
        img.src = URL.createObjectURL(currentFile);
        await img.decode();
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const w = 240, h = Math.max(1, Math.round(img.height * (240 / img.width)));
        canvas.width = w; canvas.height = h;
        ctx.drawImage(img, 0, 0, w, h);
        const data = ctx.getImageData(0, 0, w, h).data;
        const step = 4 * 4;
        let green = 0, blue = 0, gray = 0, red = 0, white = 0, black = 0, total = 0, edgeCnt = 0;
        for (let y = 1; y < h - 1; y += 2) {
            for (let x = 1; x < w - 1; x += 2) {
                const i = (y * w + x) * 4;
                const r = data[i], g = data[i + 1], b = data[i + 2];
                const maxc = Math.max(r, g, b), minc = Math.min(r, g, b);
                if (g > r * 1.2 && g > b * 1.1 && g > 60) green++;
                else if (b > r * 1.2 && b > g * 1.2 && b > 60) blue++;
                else if (Math.abs(r - g) < 15 && Math.abs(g - b) < 15 && maxc > 40 && maxc < 185) gray++;
                else if (r > g * 1.2 && r > b * 1.1 && r > 80) red++;
                if (maxc > 220) white++;
                if (maxc < 35) black++;
                total++;
                const iL = (y * w + (x - 1)) * 4;
                const iR = (y * w + (x + 1)) * 4;
                const iT = ((y - 1) * w + x) * 4;
                const iB = ((y + 1) * w + x) * 4;
                const gx = Math.abs(data[iR] - data[iL]) + Math.abs(data[iR + 1] - data[iL + 1]) + Math.abs(data[iR + 2] - data[iL + 2]);
                const gy = Math.abs(data[iB] - data[iT]) + Math.abs(data[iB + 1] - data[iT + 1]) + Math.abs(data[iB + 2] - data[iT + 2]);
                if (gx + gy > 180) edgeCnt++;
            }
        }
        const p = v => total ? v / total : 0;
        const metrics = {
            green: p(green), blue: p(blue), gray: p(gray), red: p(red),
            white: p(white), black: p(black), edge: p(edgeCnt)
        };
        const insights = derivePhotoInsights(metrics);
        renderPhotoInsights(insights);
    };
}

function derivePhotoInsights(m) {
    const tags = [];
    const desc = [];
    if (m.blue > 0.18) {
        tags.push('理水');
        desc.push('画面中蓝色占比偏高，推测存在水体或大面积天空反射，属于理水要点。');
    }
    if (m.green > 0.28) {
        tags.push('花木配植');
        desc.push('绿色显著，植物覆盖度较高，可能强调花木配植与季相变化。');
    }
    if (m.gray > 0.15) {
        tags.push('叠石山石');
        desc.push('灰度聚集明显，呈现山石或假山质感，可能采用叠石造景。');
    }
    if (m.red > 0.12) {
        tags.push('建筑色彩');
        desc.push('暖色分量偏高，推测存在建筑檐、彩画或红墙元素，形成色彩对景。');
    }
    if (m.edge > 0.12) {
        tags.push('廊桥界面');
        desc.push('边缘密度较高，空间界面与线性构件可能明显，如曲廊、栏杆或桥体。');
    }
    if (m.white > 0.18 && m.black > 0.08) {
        tags.push('粉墙黛瓦');
        desc.push('亮暗对比与浅色占比提示粉墙、灰瓦等传统材料语汇。');
    }
    if (tags.length === 0) {
        tags.push('空间意象');
        desc.push('色彩与纹理分布均衡，可从“借景—对景—框景”入手进一步观察场景。');
    }
    return { tags, desc };
}

function renderPhotoInsights(result) {
    const box = document.getElementById('photo-insights');
    if (!box) return;
    const tagsHtml = result.tags.map(t => `<span class="insight-tag">${t}</span>`).join('');
    const descHtml = result.desc.map(d => `<p>${d}</p>`).join('');
    box.innerHTML = `<div class="insight-tags">${tagsHtml}</div><div class="insight-text">${descHtml}</div>`;
}

// --- 图表初始化与更新 ---
function initLineChart() {
    lineChart = echarts.init(document.getElementById('lineChart'));
    const seriesData = {北方园林: [], 江南园林: [], 岭南园林: []};
    dynasties.forEach(dy => {
        const items = gardenData.filter(d => d[0] === dy);
        let north = 0, south = 0, ling = 0;
        items.forEach(it => {
            const t = getGardenType(it[2], it[3]);
            if (t === "北方园林") north++;
            else if (t === "江南园林") south++;
            else if (t === "岭南园林") ling++;
        });
        seriesData["北方园林"].push(north);
        seriesData["江南园林"].push(south);
        seriesData["岭南园林"].push(ling);
    });
    lineChart.setOption({
        color: ['#d4a373', '#7a9d7a', '#b87a3a'],
        tooltip: { trigger: 'axis' },
        grid: { left: 34, right: 10, top: 24, bottom: 16, containLabel: true },
        xAxis: { type: 'category', data: dynasties, axisLabel: { fontSize: 9, rotate: 22 } },
        yAxis: { type: 'value', axisLabel: { fontSize: 9 } },
        series: [
            { name: '北方园林', type: 'line', data: seriesData["北方园林"], smooth: true, lineStyle: { width: 2.2 } },
            { name: '江南园林', type: 'line', data: seriesData["江南园林"], smooth: true, lineStyle: { width: 2.2 } },
            { name: '岭南园林', type: 'line', data: seriesData["岭南园林"], smooth: true, lineStyle: { width: 2.2 } }
        ]
    });
}

function updatePieChart(era) {
    const items = gardenData.filter(g => g[0] === era);
    const count = {中原:0,北方:0,江南:0,岭南:0,西南:0,华中:0};
    
    items.forEach(it => {
        const area = getAreaByLngLat(it[2], it[3]);
        count[area]++;
    });
    const pieData = areaNames.map(name => ({ name, value: count[name] })).filter(i => i.value > 0);
    const colors = pieData.map(item => areaColorMap[item.name]);
    pieChart.setOption({
        tooltip: {
            trigger: 'item',
            formatter: '{b}：{c} 座<br>占比：{d}%'
        },
        color: colors,
        series: [{
            type: 'pie',
            radius: ['0%', '66%'],
            data: pieData,
            label: {
                fontSize: 9,
                formatter: '{b} {d}%'
            }
        }]
    });
}

// --- 地图逻辑 ---
let mapRetryCount = 0;
function initMap() {
    console.log("尝试初始化地图 (重试次数: " + mapRetryCount + ")...");
    
    const mapContainer = document.getElementById("chinaMap");
    if (!mapContainer) {
        console.error("未找到地图容器 #chinaMap");
        return;
    }

    // 第一步：检查腾讯地图核心库是否就绪
    if (typeof qq === 'undefined' || !qq.maps || !qq.maps.Map) {
        mapRetryCount++;
        if (mapRetryCount > 20) { // 约10秒后强制报错并显示容器
            console.error("腾讯地图核心库加载超时，请检查网络或 API Key");
            hideMapLoading();
            mapContainer.innerHTML = '<div style="padding:20px; color:#8b3a3a; text-align:center;">地图加载失败，请刷新页面重试。</div>';
            return;
        }
        setTimeout(initMap, 500);
        return;
    }

    // 第二步：初始化基础地图
    try {
        if (!mapInstance) {
            mapInstance = new qq.maps.Map(mapContainer, {
                center: new qq.maps.LatLng(35.1, 108.3), 
                zoom: 5,
                mapStyleId: 'style1' // 尝试应用样式
            });
            console.log("基础地图实例已创建");
        }
    } catch (e) {
        console.error("地图实例创建失败:", e);
        hideMapLoading();
        return;
    }

    // 第三步：尝试初始化可视化热力图层
    if (qq.maps.visualization && qq.maps.visualization.Heat) {
        try {
            heatLayer = new qq.maps.visualization.Heat({ 
                map: mapInstance, 
                radius: 33, 
                opacity: [0.48, 0.86] 
            });
            console.log("热力图插件已就绪并初始化");
        } catch (e) {
            console.warn("热力图层初始化失败，但基础地图仍可工作:", e);
        }
    } else {
        console.warn("腾讯地图可视化插件(visualization)尚未加载，将在后续刷新中尝试...");
        // 如果重试次数不多，可以再等等插件
        if (mapRetryCount < 10) {
            mapRetryCount++;
            setTimeout(initMap, 1000);
            return;
        }
    }

    // 无论热力图是否成功，只要基础地图好了就隐藏遮罩
    hideMapLoading();
    refreshByEra();
}

function hideMapLoading() {
    const loadingMask = document.getElementById('map-loading');
    if (loadingMask) {
        loadingMask.style.opacity = '0';
        setTimeout(() => {
            loadingMask.style.display = 'none';
        }, 500);
    }
}

function clearMarkers() {
    markersArray.forEach(m => {
        if (m && m.setMap) m.setMap(null);
    });
    markersArray = [];
}

function updateGardenList(era) {
    const gardens = gardenData.filter(g => g[0] === era);
    const container = document.getElementById("gardenList");
    if (!container) return; // 容错处理

    if (!gardens.length) {
        container.innerHTML = '<div style="text-align:center; color:#9b7a52; padding:14px;">🌸 园迹暂隐</div>';
        return;
    }
    // 为每个园林项添加点击事件，移除 title 属性以避免浏览器默认的方格提示框
    container.innerHTML = gardens.slice(0, 30).map(g => {
        const name = g[1];
        const safeName = escapeJsSingleQuotedString(name);
        return `<div class="garden-item" onclick="showRichDetail('${safeName}')"><img class="garden-thumb" data-name="${name}"><span class="garden-name">🌺 ${name}</span></div>`;
    }).join('');
    hydrateGardenThumbs(container, era);
}

function refreshByEra() {
    const era = dynasties[currentEraIndex];
    const eraEl = document.getElementById("artEraName");
    const eraSubEl = document.querySelector(".art-sub");
    if (eraEl) {
        const prevEra = dynasties[modEraIndex(currentEraIndex - 1)];
        const nextEra = dynasties[modEraIndex(currentEraIndex + 1)];
        const tooltipText = eraBackgrounds[era] ? eraBackgrounds[era].intro : '';

        if (eraEl.getAttribute('data-era-structure') !== '1') {
            eraEl.innerHTML = `
                <div class="era-mini-arrow" data-era-arrow="up"><i class="fa-solid fa-chevron-up"></i></div>
                <div class="era-seg era-prev" data-era-seg="prev"></div>
                <div class="era-seg era-current" data-era-seg="current"></div>
                <div class="era-seg era-next" data-era-seg="next"></div>
                <div class="era-mini-arrow" data-era-arrow="down"><i class="fa-solid fa-chevron-down"></i></div>
                <div class="era-tooltip"></div>
            `;
            eraEl.setAttribute('data-era-structure', '1');
        }

        const prevEl = eraEl.querySelector('[data-era-seg="prev"]');
        const currentEl = eraEl.querySelector('[data-era-seg="current"]');
        const nextEl = eraEl.querySelector('[data-era-seg="next"]');
        const tooltipEl = eraEl.querySelector('.era-tooltip');
        if (prevEl) prevEl.textContent = prevEra;
        if (currentEl) currentEl.textContent = era;
        if (nextEl) nextEl.textContent = nextEra;
        if (tooltipEl) tooltipEl.textContent = tooltipText;

        const applySize = (el, base, min = 0.85) => {
            if (!el) return;
            const t = String(el.textContent || '');
            const len = Array.from(t).length;
            let size = base;
            if (len >= 6) size = base - 0.75;
            else if (len === 5) size = base - 0.55;
            else if (len === 4) size = base - 0.3;
            el.style.fontSize = `${Math.max(min, size).toFixed(2)}rem`;
        };

        applySize(prevEl, 1.25);
        applySize(currentEl, 1.85, 1.05);
        applySize(nextEl, 1.25);
    }

    if (eraSubEl) {
        const map = {
            "殷周秦汉": "苑 囿 初 成",
            "魏晋南北朝": "寄 情 山 水",
            "隋唐": "盛 世 宫 苑",
            "宋辽金": "写 意 高 峰",
            "元": "清 远 简 逸",
            "明": "造 园 极 盛",
            "清": "集 大 成"
        };
        eraSubEl.innerText = map[era] || "园 林 之 粹";
    }
    
    const eraGardens = gardenData.filter(g => g[0] === era);
    
    // 增加 heatLayer 存在性检查，防止因异步加载导致的报错
    if (heatLayer && eraGardens.length) {
        const heatPoints = eraGardens.map(g => ({ lat: g[3], lng: g[2], value: g[4] || 2.5 }));
        const maxVal = Math.max(...heatPoints.map(p => p.value), 3);
        heatLayer.setData({ max: maxVal, min: 0, data: heatPoints });
        
        clearMarkers();
        eraGardens.forEach(garden => {
            const pos = new qq.maps.LatLng(garden[3], garden[2]);
            const marker = new qq.maps.Marker({
                map: mapInstance, position: pos,
                icon: new qq.maps.MarkerImage('data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="1" height="1"%3E%3Crect width="1" height="1" fill="none"/%3E%3C/svg%3E', new qq.maps.Size(1,1))
            });
            const infoWin = new qq.maps.InfoWindow({
                content: `<div style="background:#fef3da;padding:4px 10px;border-radius:20px;font-size:12px;color:#333;">🏯 ${garden[1]}<br>${garden[0]}</div>`,
                position: pos
            });
            qq.maps.event.addListener(marker, 'click', () => infoWin.open());
            markersArray.push(marker);
        });
    } else if (heatLayer) {
        heatLayer.setData({ max: 1, min: 0, data: [] });
        clearMarkers();
    }
    
    updateGardenList(era);
    updatePieChart(era);
}

function showGardensForRegion(regionName) {
    const era = dynasties[currentEraIndex];
    const gardensInRegion = gardenData.filter(g => g[0] === era && getAreaByLngLat(g[2], g[3]) === regionName);

    const modal = document.getElementById("modal");
    const mTitle = document.getElementById("m-title");
    const mImg = document.getElementById("m-img");
    const mMiniMapBox = document.getElementById("m-mini-map-box");
    const mText = document.getElementById("m-text");
    const ratingSec = document.querySelector('.rating-section');

    mTitle.innerText = `${era} · ${regionName}地区园林`;
    mImg.style.display = 'none';
    if (mMiniMapBox) mMiniMapBox.style.display = 'none';
    if (ratingSec) ratingSec.style.display = 'none';

    let listHtml = gardensInRegion.length > 0
        ? gardensInRegion.map(g => {
            const name = g[1];
            const safeName = escapeJsSingleQuotedString(name);
            return `<div class="garden-item" onclick="showRichDetail('${safeName}')"><img class="garden-thumb" data-name="${name}"><span class="garden-name">🌺 ${name}</span></div>`;
        }).join('')
        : '<p style="text-align:center; color:#9b7a52; padding:14px;">该区域在此朝代暂无园林记录。</p>';

    mText.innerHTML = `
        <div style="padding: 10px 20px;">
            <p style="font-size: 1.1rem; color: var(--title-color); margin-bottom: 15px; text-align:center;">
                共发现 <b>${gardensInRegion.length}</b> 座园林
            </p>
            <div class="garden-list-modal" id="garden-list-modal">${listHtml}</div>
        </div>
    `;
    hydrateGardenThumbs(document.getElementById('garden-list-modal'), era);

    modal.style.display = 'flex';
}

function showEraMiniMap(era) {
    const data = eraBackgrounds[era];
    const modal = document.getElementById("modal");
    const mTitle = document.getElementById("m-title");
    const mImg = document.getElementById("m-img");
    const mMiniMapBox = document.getElementById("m-mini-map-box");
    const mText = document.getElementById("m-text");
    const ratingSec = document.querySelector('.rating-section');
    
    mTitle.innerText = `${era} · 园林风华简图`;
    mImg.style.display = 'none';
    if (mMiniMapBox) mMiniMapBox.style.display = 'block';
    
    if (ratingSec) ratingSec.style.display = 'none';
    
    // 获取该朝代的园林数据
    const eraGardens = gardenData.filter(g => g[0] === era);
    
    // 生成园林名录 HTML
    const gardenItemsHtml = eraGardens.length > 0
        ? eraGardens.map(g => {
            const name = g[1];
            const safeName = escapeJsSingleQuotedString(name);
            return `<div class="garden-item" onclick="showRichDetail('${safeName}')"><img class="garden-thumb" data-name="${name}"><span class="garden-name">🌺 ${name}</span></div>`;
        }).join('')
        : '<p style="text-align:center; color:#9b7a52; padding:14px;">该朝代暂无详细名录记录。</p>';

    mText.innerHTML = `
        <div style="padding: 10px 20px;">
            <p style="font-size: 1.1rem; color: var(--title-color); margin-bottom: 10px; text-align:center;">
                ${era}时期共有记录园林 <b>${eraGardens.length}</b> 座
            </p>
            <p style="font-size: 0.95rem; line-height: 1.6; color: var(--body-text); text-align: justify; margin-bottom: 20px;">
                ${data.intro}
            </p>
            
            <div class="mini-map-legend" style="margin-bottom: 10px;">
                <div class="legend-item"><span class="legend-dot" style="background:#d4a373;"></span> 北方</div>
                <div class="legend-item"><span class="legend-dot" style="background:#6a994e;"></span> 江南</div>
                <div class="legend-item"><span class="legend-dot" style="background:#bc6c25;"></span> 岭南</div>
                <div class="legend-item"><span class="legend-dot" style="background:#e9c46a;"></span> 中原</div>
            </div>

            <div style="margin-top: 25px;">
                <p style="font-weight: bold; color: var(--emphasis); margin-bottom: 10px; border-bottom: 1px solid var(--bg-divider); padding-bottom: 5px;">
                    <i class="fa-solid fa-list-ul"></i> ${era} · 名园名录 (点击查看详情)
                </p>
                <div class="garden-list-modal" id="garden-list-modal">${gardenItemsHtml}</div>
            </div>
        </div>
    `;
    hydrateGardenThumbs(document.getElementById('garden-list-modal'), era);
    
    modal.style.display = 'flex';
    
    // 初始化简易地图图表
    setTimeout(() => {
        initMiniMapChart(era, eraGardens);
    }, 100);
}

function initMiniMapChart(era, gardens) {
    const chartDom = document.getElementById('m-mini-map-box');
    if (!chartDom) return;
    
    // 销毁已有实例，确保内容刷新
    let existingChart = echarts.getInstanceByDom(chartDom);
    if (existingChart) {
        existingChart.dispose();
    }
    
    const myChart = echarts.init(chartDom);
    
    // 转换数据为 ECharts 散点图格式
    const seriesData = gardens.map(g => {
        const area = getAreaByLngLat(g[2], g[3]);
        return {
            name: g[1],
            value: [g[2], g[3], g[4] || 3],
            itemStyle: { color: areaColorMap[area] || '#d4a373' }
        };
    });

    const option = {
        backgroundColor: 'transparent',
        title: {
            text: `${era} 园林空间分布示意`,
            left: 'center',
            top: 10,
            textStyle: { fontSize: 13, color: '#8c603a', fontWeight: 'bold' }
        },
        tooltip: {
            formatter: params => `园林: ${params.name}`
        },
        grid: { top: 50, bottom: 40, left: 50, right: 30 },
        xAxis: { 
            type: 'value', 
            name: '经度',
            min: 73, max: 135, 
            splitLine: { show: true, lineStyle: { color: 'rgba(0,0,0,0.05)' } },
            axisLabel: { fontSize: 10 }
        },
        yAxis: { 
            type: 'value', 
            name: '纬度',
            min: 18, max: 54, 
            splitLine: { show: true, lineStyle: { color: 'rgba(0,0,0,0.05)' } },
            axisLabel: { fontSize: 10 }
        },
        series: [{
            type: 'scatter',
            data: seriesData,
            symbolSize: function (data) {
                return data[2] * 4.5;
            },
            emphasis: {
                itemStyle: {
                    shadowBlur: 10,
                    shadowColor: 'rgba(0, 0, 0, 0.3)'
                }
            }
        }]
    };

    myChart.setOption(option);
    
    // 监听窗口调整
    window.addEventListener('resize', () => myChart.resize());
}

function switchEra(index) {
    if (index === currentEraIndex) return;
    currentEraIndex = index;
    refreshByEra();
}

function modEraIndex(index) {
    const len = dynasties.length;
    return ((index % len) + len) % len;
}

function buildTimeline() {
    const eraEl = document.getElementById("artEraName");
    if (!eraEl) return;
    if (eraEl.getAttribute('data-era-flip') === '1') return;
    eraEl.setAttribute('data-era-flip', '1');

    eraEl.addEventListener('wheel', (e) => {
        e.preventDefault();
        if (e.deltaY > 0) switchEra(modEraIndex(currentEraIndex + 1));
        else switchEra(modEraIndex(currentEraIndex - 1));
    }, { passive: false });

    eraEl.addEventListener('click', (e) => {
        const arrow = e.target.closest('[data-era-arrow]');
        if (arrow) {
            const dir = arrow.getAttribute('data-era-arrow');
            if (dir === 'up') switchEra(modEraIndex(currentEraIndex - 1));
            else switchEra(modEraIndex(currentEraIndex + 1));
            return;
        }
        const seg = e.target.closest('[data-era-seg]');
        if (!seg) return;
        const role = seg.getAttribute('data-era-seg');
        if (role === 'prev') {
            switchEra(modEraIndex(currentEraIndex - 1));
            return;
        }
        if (role === 'next') {
            switchEra(modEraIndex(currentEraIndex + 1));
            return;
        }
        showEraMiniMap(dynasties[currentEraIndex]);
    });
}

// --- 登录与 Tab 切换逻辑 ---
function switchAuthTab(type) {
    if (type === 'login') {
        document.getElementById('tab-login').classList.add('active');
        document.getElementById('tab-register').classList.remove('active');
        document.getElementById('form-login').style.display = 'flex';
        document.getElementById('form-register').style.display = 'none';
    } else {
        document.getElementById('tab-register').classList.add('active');
        document.getElementById('tab-login').classList.remove('active');
        document.getElementById('form-register').style.display = 'flex';
        document.getElementById('form-login').style.display = 'none';
    }
}

function submitAuth(action) {
    alert(action + '成功！欢迎进入林泉高致的古典世界。');
    document.getElementById('auth-page').style.display = 'none';
    document.getElementById('main-app').style.display = 'block';
    switchMainTab(1);
}

function switchMainTab(n) {
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('show'));
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    
    const panel = document.getElementById('main-tab-' + n);
    panel.style.animation = 'none';
    panel.offsetHeight; 
    panel.style.animation = null; 
    panel.classList.add('show');
    
    document.querySelectorAll('.tab')[n-1].classList.add('active');

    if(n === 1) {
        if (!chartsInitialized) {
            buildTimeline();
            pieChart = echarts.init(document.getElementById('pieChart'));
            // 为饼图添加点击事件，以显示区域内的园林列表
            pieChart.on('click', function (params) {
                if (params.name) {
                    showGardensForRegion(params.name);
                }
            });
            initLineChart();
            initMap();
            chartsInitialized = true;
        }
        setTimeout(() => {
            if (mapInstance) qq.maps.event.trigger(mapInstance, 'resize');
            if (lineChart) lineChart.resize();
            if (pieChart) pieChart.resize();
        }, 160);
    }

    if(n === 3 && !wordCloudInitialized) {
        init3DWordCloud();
        wordCloudInitialized = true;
    }
}

function toggleNightMode() {
    const body = document.body;
    const btn = document.querySelector('.theme-toggle');
    body.classList.toggle('night-mode');
    
    if (body.classList.contains('night-mode')) {
        btn.innerHTML = '<i class="fa-solid fa-sun"></i> 白昼模式';
    } else {
        btn.innerHTML = '<i class="fa-solid fa-moon"></i> 夜游园林';
    }
}

function openSubPage(cat) {
    document.getElementById('category-view').style.display = 'none';
    document.getElementById('sub-' + cat).style.display = 'block';
}
function closeSubPage() {
    document.querySelectorAll('.sub-page').forEach(p => p.style.display = 'none');
    document.getElementById('category-view').style.display = 'block';
}

// --- 动态水墨粒子系统 ---
let inkCanvas = null;
let inkCtx = null;
let customCursor = null;

function initCustomCursor() {
    // 动态创建鼠标小花元素
    if (!document.getElementById('custom-cursor')) {
        customCursor = document.createElement('div');
        customCursor.id = 'custom-cursor';
        customCursor.innerHTML = '<i class="fa-solid fa-fan flower-icon"></i>';
        document.body.appendChild(customCursor);
    }

    // 追踪鼠标位置
    window.addEventListener('mousemove', (e) => {
        if (customCursor) {
            // 使用 requestAnimationFrame 优化平滑度
            requestAnimationFrame(() => {
                customCursor.style.left = e.clientX + 'px';
                customCursor.style.top = e.clientY + 'px';
            });
        }

        // 原有的鼠标移动产生粒子逻辑
        if (Math.random() < 0.15) {
            let p = new InkParticle(e.clientX, e.clientY);
            p.size = 6; 
            particles.push(p);
        }
    });

    // 交互反馈：按下
    window.addEventListener('mousedown', () => {
        if (customCursor) customCursor.classList.add('active');
    });
    window.addEventListener('mouseup', () => {
        if (customCursor) customCursor.classList.remove('active');
    });

    // 交互反馈：悬停在可点击元素上
    const interactiveElements = 'a, button, .tab, .cat-card, .g-card, .garden-item, .dynasty-btn, .fragment';
    document.addEventListener('mouseover', (e) => {
        if (e.target.closest(interactiveElements)) {
            if (customCursor) customCursor.classList.add('hover');
        }
    });
    document.addEventListener('mouseout', (e) => {
        if (!e.target.closest(interactiveElements)) {
            if (customCursor) customCursor.classList.remove('hover');
        }
        // 当鼠标离开窗口时隐藏自定义鼠标
        if (!e.relatedTarget && !e.toElement) {
            if (customCursor) customCursor.style.display = 'none';
        }
    });
    document.addEventListener('mouseenter', () => {
        if (customCursor) customCursor.style.display = 'flex';
    });
}

function initInkSystem() {
    inkCanvas = document.getElementById('ink-canvas');
    if (!inkCanvas) return;
    inkCtx = inkCanvas.getContext('2d');
    
    window.addEventListener('resize', resizeInkCanvas);
    resizeInkCanvas();
    animateInk();
}

function resizeInkCanvas() {
    if (!inkCanvas) return;
    inkCanvas.width = window.innerWidth;
    inkCanvas.height = window.innerHeight;
}
// window.addEventListener('resize', resizeInkCanvas); // 已在 initPage 中处理
// resizeInkCanvas();

class InkParticle {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.size = Math.random() * 3 + 1;
        this.maxSize = Math.random() * 30 + 15;
        this.speedX = (Math.random() - 0.5) * 0.5;
        this.speedY = (Math.random() - 0.5) * 0.5 - 0.2; 
        this.life = 1.0; 
        this.decay = Math.random() * 0.015 + 0.01;
    }
    update() {
        this.x += this.speedX;
        this.y += this.speedY;
        if (this.size < this.maxSize) this.size += 1.0; 
        this.life -= this.decay;
    }
    draw() {
        const style = getComputedStyle(document.body);
        const rawColor = style.getPropertyValue('--ink-color').trim();
        const rgbaMatch = rawColor.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*[\d.]+)?\)/);
        if(rgbaMatch) {
            inkCtx.fillStyle = `rgba(${rgbaMatch[1]}, ${rgbaMatch[2]}, ${rgbaMatch[3]}, ${this.life * 0.15})`;
        } else {
            inkCtx.fillStyle = `rgba(0,0,0, ${this.life * 0.1})`;
        }
        inkCtx.beginPath();
        inkCtx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        inkCtx.fill();
    }
}

function animateInk() {
    inkCtx.clearRect(0, 0, inkCanvas.width, inkCanvas.height);
    if(Math.random() < 0.03) {
        particles.push(new InkParticle(Math.random() * inkCanvas.width, Math.random() * inkCanvas.height));
    }
    for (let i = 0; i < particles.length; i++) {
        particles[i].update();
        particles[i].draw();
        if (particles[i].life <= 0) {
            particles.splice(i, 1);
            i--;
        }
    }
    requestAnimationFrame(animateInk);
}
// animateInk(); // 已在 initPage 中处理

window.addEventListener('mousemove', (e) => {
    if (Math.random() < 0.15) {
        let p = new InkParticle(e.clientX, e.clientY);
        p.size = 6; 
        particles.push(p);
    }
});

// --- 弹窗与评分交互 ---
function showRichDetail(key) {
    currentGarden = key;
    const modal = document.getElementById('modal');
    const data = richDB[key];
    const ratingSec = document.querySelector('.rating-section');
    const mImg = document.getElementById('m-img');
    const mMiniMapBox = document.getElementById("m-mini-map-box");
    const era = dynasties[currentEraIndex];
    const fallback = eraFallbackImgMap[era] || "image/盆景.jpg";
    
    if(data) {
        document.getElementById('m-title').innerText = data.title;
        mImg.style.display = 'block';
        mImg.className = 'result-img'; 
        if (mMiniMapBox) mMiniMapBox.style.display = 'none'; // 隐藏简易地图
        const textLen = stripHtmlText(data.content).length;
        if (textLen >= 180) {
            document.getElementById('m-text').innerHTML = data.content;
        } else {
            document.getElementById('m-text').innerHTML = `<div class="figure-detail-content">${buildAutoGardenDetailHtml(key, era, data.content)}</div>`;
        }
        setImageWithFallback(mImg, [data.img, ...buildGardenImageCandidates(key, era)], fallback);
    } else {
        document.getElementById('m-title').innerText = `${era} · ${key}`;
        mImg.style.display = 'block';
        mImg.className = 'result-img';
        if (mMiniMapBox) mMiniMapBox.style.display = 'none';
        document.getElementById('m-text').innerHTML = `<div class="figure-detail-content">${buildAutoGardenDetailHtml(key, era)}</div>`;
        setImageWithFallback(mImg, buildGardenImageCandidates(key, era), fallback);
    }
    
    if (ratingSec) ratingSec.style.display = 'flex'; 
    
    updateStarsUI(userRatings[key] || 0);
    modal.style.display = 'flex';
}

function closeModal() { document.getElementById('modal').style.display = 'none'; }

function showMasterpiece(name) {
    const data = figureDetails[name];
    if (!data) return;
    
    const modal = document.getElementById('modal');
    const mTitle = document.getElementById('m-title');
    const mImg = document.getElementById('m-img');
    const mText = document.getElementById('m-text');
    const mMiniMapBox = document.getElementById("m-mini-map-box");
    const ratingSec = document.querySelector('.rating-section');
    
    mTitle.innerText = `${name} · 艺术成就与造园哲学`;
    mImg.src = data.mImg;
    mImg.style.display = 'block';
    mImg.className = 'result-img';
    
    if (mMiniMapBox) mMiniMapBox.style.display = 'none';
    if (ratingSec) ratingSec.style.display = 'none';
    
    // 构建代表作列表
    const worksHtml = data.works ? data.works.map(w => `<span class="work-tag">${w}</span>`).join('') : '';
    // 构建更多名言
    const quotesHtml = data.moreQuotes ? data.moreQuotes.map(q => `<p class="extra-quote">“${q}”</p>`).join('') : '';

    mText.innerHTML = `
        <div class="figure-detail-content">
            <div class="quote-section">
                <i class="fa-solid fa-quote-left"></i>
                <p class="main-quote">${data.quote}</p>
                <i class="fa-solid fa-quote-right"></i>
            </div>
            
            <div class="detail-block">
                <h4><i class="fa-solid fa-gem"></i> 核心代表作：${data.masterpiece}</h4>
                <p>${data.mDesc}</p>
                <div class="works-grid">${worksHtml}</div>
            </div>

            <div class="detail-block">
                <h4><i class="fa-solid fa-scroll"></i> 造园哲学</h4>
                <p>${data.philosophy}</p>
            </div>

            <div class="detail-block">
                <h4><i class="fa-solid fa-clock-rotate-left"></i> 历史轶事</h4>
                <p>${data.history}</p>
            </div>

            <div class="detail-block">
                <h4><i class="fa-solid fa-feather-pointed"></i> 更多名言</h4>
                <div class="quotes-list">${quotesHtml}</div>
            </div>
        </div>
    `;
    
    modal.style.display = 'flex';
}

function showTimelineDetail(stage) {
    const data = timelineDetails[stage];
    if (!data) return;
    
    const modal = document.getElementById('modal');
    const mTitle = document.getElementById('m-title');
    const mImg = document.getElementById('m-img');
    const mText = document.getElementById('m-text');
    const mMiniMapBox = document.getElementById("m-mini-map-box");
    const ratingSec = document.querySelector('.rating-section');
    
    mTitle.innerText = data.title;
    mImg.src = data.img;
    mImg.style.display = 'block';
    mImg.className = 'result-img';
    
    if (mMiniMapBox) mMiniMapBox.style.display = 'none';
    if (ratingSec) ratingSec.style.display = 'none';
    
    mText.innerHTML = `
        <div class="result-text" style="padding: 0 10px;">
            ${data.content}
        </div>
    `;
    
    modal.style.display = 'flex';
}

function initEvolutionTimelineInteractive() {
    const nodes = Array.from(document.querySelectorAll('.timeline .tl-node'));
    if (nodes.length === 0) return;

    let root = document.getElementById('tl-hover');
    if (!root) {
        root = document.createElement('div');
        root.id = 'tl-hover';
        root.innerHTML = `
            <div class="tl-hover-card" id="tl-hover-card">
                <canvas id="tl-axis-3d" width="380" height="170"></canvas>
                <div class="tl-hover-info">
                    <div class="tl-hover-title" id="tl-hover-title"></div>
                    <div class="tl-hover-sub" id="tl-hover-sub"></div>
                    <div class="tl-hover-snippet" id="tl-hover-snippet"></div>
                </div>
            </div>
        `;
        document.body.appendChild(root);
    }

    const card = document.getElementById('tl-hover-card');
    const axisCanvas = document.getElementById('tl-axis-3d');
    const titleEl = document.getElementById('tl-hover-title');
    const subEl = document.getElementById('tl-hover-sub');
    const snippetEl = document.getElementById('tl-hover-snippet');
    if (!card || !axisCanvas || !titleEl || !subEl || !snippetEl) return;

    const stages = ['起源', '转折', '成熟', '精深'];
    const timelineByStage = {
        '起源': {
            era: '殷周秦汉',
            range: '约前16c–前2c',
            tags: ['苑囿', '礼制', '台榭池沼', '大水面'],
            items: [
                { label: '殷', years: '约前16c–前11c', tags: ['囿', '狩猎', '礼制'] },
                { label: '周', years: '前1046–前256', tags: ['灵台', '辟雍', '苑囿'] },
                { label: '秦', years: '前221–前207', tags: ['离宫', '台榭', '苑囿体系'] },
                { label: '汉', years: '前202–220', tags: ['上林', '太液', '昆明池'] }
            ]
        },
        '转折': {
            era: '魏晋南北朝',
            range: '220–589',
            tags: ['寄情山水', '私园萌芽', '清旷', '玄学风尚'],
            items: [
                { label: '魏', years: '220–266', tags: ['园游', '台榭', '宫苑'] },
                { label: '晋', years: '266–420', tags: ['清谈', '山水', '兰亭'] },
                { label: '南朝', years: '420–589', tags: ['江南', '私园', '文人'] },
                { label: '北朝', years: '386–581', tags: ['宫苑', '佛寺园林', '山水化'] }
            ]
        },
        '成熟': {
            era: '唐宋',
            range: '618–1279',
            tags: ['诗画入园', '自然山水园', '文人参与', '行宫别业'],
            items: [
                { label: '初唐', years: '618–712', tags: ['都城格局', '宫苑'] },
                { label: '盛唐', years: '713–755', tags: ['大明宫', '兴庆宫', '华清'] },
                { label: '中晚唐', years: '756–907', tags: ['曲江', '都市游赏', '文风'] },
                { label: '北宋', years: '960–1127', tags: ['写意', '理水叠山', '艮岳'] },
                { label: '南宋', years: '1127–1279', tags: ['江南私园', '小中见大'] }
            ]
        },
        '精深': {
            era: '明清',
            range: '1368–1912',
            tags: ['造园理论', '私园巅峰', '皇家集成', '技艺精纯'],
            items: [
                { label: '明初', years: '1368–1450', tags: ['私园复兴', '格局奠定'] },
                { label: '明中', years: '1450–1570', tags: ['园居生活', '题咏体系'] },
                { label: '明末', years: '1570–1644', tags: ['园冶', '精细构图'] },
                { label: '清初', years: '1636–1722', tags: ['皇家格局', '样式整合'] },
                { label: '盛清', years: '1723–1796', tags: ['圆明园', '颐和', '体系化'] },
                { label: '晚清', years: '1796–1912', tags: ['遗址记忆', '保护意识'] }
            ]
        }
    };

    const axisCtx = axisCanvas.getContext('2d');
    const axisW = axisCanvas.width;
    const axisH = axisCanvas.height;
    const axisDepth = 260;
    let axisMouseX = 40;
    let axisMouseY = -40;
    let activeStage = stages[0];
    let activeTimeline = timelineByStage[activeStage];
    let axisRunning = false;
    let axisRaf = null;
    let nodeHit = [];

    let axisTick = 0;
    const baseY = -6;

    const rotatePoint = (p, ax, ay) => {
        let { x, y, z } = p;
        const cosY = Math.cos(ay), sinY = Math.sin(ay);
        let x1 = x * cosY + z * sinY;
        let z1 = z * cosY - x * sinY;
        x = x1; z = z1;
        const cosX = Math.cos(ax), sinX = Math.sin(ax);
        let y1 = y * cosX - z * sinX;
        z1 = z * cosX + y * sinX;
        y = y1; z = z1;
        return { x, y, z };
    };

    const project = (p) => {
        const scale = axisDepth / (axisDepth - p.z);
        return { x: (axisW / 2) + p.x * scale, y: (axisH / 2) + p.y * scale, s: scale };
    };

    const samplePolylinePoint = (pts, t01) => {
        if (pts.length < 2) return { x: axisCx, y: axisCy };
        const segLens = [];
        let total = 0;
        for (let i = 0; i < pts.length - 1; i++) {
            const dx = pts[i + 1].x - pts[i].x;
            const dy = pts[i + 1].y - pts[i].y;
            const l = Math.hypot(dx, dy);
            segLens.push(l);
            total += l;
        }
        let dist = total * t01;
        for (let i = 0; i < segLens.length; i++) {
            const l = segLens[i];
            if (dist <= l || i === segLens.length - 1) {
                const k = l ? dist / l : 0;
                return {
                    x: pts[i].x + (pts[i + 1].x - pts[i].x) * k,
                    y: pts[i].y + (pts[i + 1].y - pts[i].y) * k
                };
            }
            dist -= l;
        }
        return { x: pts[pts.length - 1].x, y: pts[pts.length - 1].y };
    };

    const drawAxis3D = () => {
        if (!axisRunning) return;
        axisCtx.clearRect(0, 0, axisW, axisH);

        axisTick += 1;
        const ay = 0.012 + axisMouseX * 0.00006;
        const ax = axisMouseY * 0.00006;

        const emphasis = getComputedStyle(document.documentElement).getPropertyValue('--emphasis').trim() || '#8b3a3a';
        const sub = getComputedStyle(document.documentElement).getPropertyValue('--sub-title').trim() || '#8c603a';
        const divider = getComputedStyle(document.documentElement).getPropertyValue('--bg-divider').trim() || '#e8dbcb';

        const items = (activeTimeline && activeTimeline.items) ? activeTimeline.items : [];
        const count = Math.max(2, items.length);
        const left = -((axisW - 60) / 2);
        const step = (axisW - 60) / (count - 1);
        const pts3D = items.map((d, i) => {
            const x = left + step * i;
            const y = baseY;
            const z = 0;
            return rotatePoint({ x, y, z }, ax, ay);
        });
        const pts2D = pts3D.map(project);
        nodeHit = pts2D.map((p2, i) => {
            const d = items[i];
            const r = 10 * p2.s;
            return { x: p2.x, y: p2.y, r, item: d };
        });

        axisCtx.save();
        axisCtx.lineCap = 'round';
        axisCtx.lineJoin = 'round';
        axisCtx.strokeStyle = divider;
        axisCtx.globalAlpha = 0.95;
        axisCtx.lineWidth = 3;
        axisCtx.beginPath();
        axisCtx.moveTo(pts2D[0].x, pts2D[0].y);
        for (let i = 1; i < pts2D.length; i++) axisCtx.lineTo(pts2D[i].x, pts2D[i].y);
        axisCtx.stroke();

        const flow = (Math.sin(axisTick * 0.06) + 1) / 2;
        const flowPt = samplePolylinePoint(pts2D, flow);
        const g = axisCtx.createRadialGradient(flowPt.x, flowPt.y, 0, flowPt.x, flowPt.y, 26);
        g.addColorStop(0, 'rgba(139, 58, 58, 0.45)');
        g.addColorStop(0.55, 'rgba(139, 58, 58, 0.12)');
        g.addColorStop(1, 'rgba(139, 58, 58, 0)');
        axisCtx.fillStyle = g;
        axisCtx.globalAlpha = 1;
        axisCtx.beginPath();
        axisCtx.arc(flowPt.x, flowPt.y, 26, 0, Math.PI * 2);
        axisCtx.fill();

        pts2D.forEach((p2, i) => {
            const d = items[i];
            const isActive = true;
            const r = (isActive ? 7 : 5) * p2.s;
            axisCtx.beginPath();
            axisCtx.fillStyle = isActive ? emphasis : 'rgba(140, 96, 58, 0.26)';
            axisCtx.arc(p2.x, p2.y, r, 0, Math.PI * 2);
            axisCtx.fill();
            axisCtx.globalAlpha = 1;
            axisCtx.fillStyle = isActive ? emphasis : sub;
            axisCtx.font = `bold ${Math.round((isActive ? 12 : 11) * p2.s)}px "STKaiti", serif`;
            axisCtx.textAlign = 'center';
            axisCtx.textBaseline = 'top';
            axisCtx.fillText(d ? d.label : '', p2.x, p2.y + (10 * p2.s));
        });

        axisCtx.restore();

        axisRaf = requestAnimationFrame(drawAxis3D);
    };

    const startAxis = () => {
        if (axisRunning) return;
        axisRunning = true;
        axisRaf = requestAnimationFrame(drawAxis3D);
    };
    const stopAxis = () => {
        axisRunning = false;
        if (axisRaf) cancelAnimationFrame(axisRaf);
        axisRaf = null;
    };

    const computeSnippet = (stage) => {
        const data = (typeof timelineDetails !== 'undefined') ? timelineDetails[stage] : null;
        const txt = data ? stripHtmlText(data.content) : '';
        const t = timelineByStage[stage];
        const years = t ? t.range : '';
        const tags = t ? t.tags.slice(0, 7).join('、') : '';
        const short = txt ? (txt.length > 88 ? `${txt.slice(0, 88)}…` : txt) : '';
        return `${years}${tags ? `｜${tags}` : ''}${short ? `｜${short}` : ''}`;
    };

    const setContent = (node, stage) => {
        const data = (typeof timelineDetails !== 'undefined') ? timelineDetails[stage] : null;
        const eraText = node.querySelector('.tl-text')?.textContent?.trim() || '';
        titleEl.textContent = `阶段：${stage}`;
        subEl.textContent = eraText ? `对应朝代：${eraText}` : '';
        snippetEl.textContent = computeSnippet(stage);
        activeStage = stage;
        activeTimeline = timelineByStage[stage];
    };

    let hideTimer = null;
    const showAt = (node, stage, clientX, clientY) => {
        if (hideTimer) {
            clearTimeout(hideTimer);
            hideTimer = null;
        }
        startAxis();
        setContent(node, stage);
        const rect = node.getBoundingClientRect();
        const preferAbove = rect.top > 180;
        const top = preferAbove ? rect.top - 12 : rect.bottom + 12;
        const cardW = 420;
        if (stage === '精深') {
            const rightX = rect.right + 16;
            if (rightX + cardW <= window.innerWidth - 8) {
                root.style.left = `${rightX}px`;
                root.style.transform = `translate(0, ${preferAbove ? '-100%' : '0'})`;
            } else {
                const leftX = rect.left - 16;
                root.style.left = `${leftX}px`;
                root.style.transform = `translate(-100%, ${preferAbove ? '-100%' : '0'})`;
            }
        } else {
            const centerX = Math.min(window.innerWidth - 24, Math.max(24, rect.left + rect.width / 2));
            root.style.left = `${centerX}px`;
            root.style.transform = `translate(-50%, ${preferAbove ? '-100%' : '0'})`;
        }
        root.style.top = `${top}px`;
        root.style.pointerEvents = 'auto';

        const rx = Math.max(-10, Math.min(10, (rect.top + rect.height / 2 - clientY) / 14));
        const ry = Math.max(-12, Math.min(12, (clientX - (rect.left + rect.width / 2)) / 14));
        card.style.setProperty('--rx', `${rx}deg`);
        card.style.setProperty('--ry', `${ry}deg`);

        axisMouseX = clientX - (rect.left + rect.width / 2);
        axisMouseY = clientY - (rect.top + rect.height / 2);

        card.classList.add('show');
    };

    const hide = () => {
        card.classList.remove('show');
        hideTimer = setTimeout(() => {
            root.style.left = '0px';
            root.style.top = '0px';
            root.style.transform = 'none';
            root.style.pointerEvents = 'none';
            stopAxis();
        }, 180);
    };

    card.addEventListener('mouseenter', () => {
        if (hideTimer) {
            clearTimeout(hideTimer);
            hideTimer = null;
        }
        startAxis();
        card.classList.add('show');
    });
    card.addEventListener('mouseleave', hide);

    axisCanvas.addEventListener('click', (e) => {
        if (!axisRunning || !activeTimeline || !activeTimeline.items) return;
        const rect = axisCanvas.getBoundingClientRect();
        const cx = e.clientX;
        const cy = e.clientY;
        const hit = nodeHit
            .map(h => ({ h, d: Math.hypot((h.x - rect.left) - cx, (h.y - rect.top) - cy) }))
            .sort((a, b) => a.d - b.d)[0];
        if (!hit || !hit.h || hit.d > Math.max(16, hit.h.r * 1.6)) return;
        showTimelineSubDetail(activeStage, hit.h.item, activeTimeline);
    });

    nodes.forEach(node => {
        const stage = node.getAttribute('data-stage') || '';
        if (!stage) return;
        node.addEventListener('mouseenter', (e) => showAt(node, stage, e.clientX, e.clientY));
        node.addEventListener('mousemove', (e) => showAt(node, stage, e.clientX, e.clientY));
        node.addEventListener('mouseleave', hide);
    });
}

function showTimelineSubDetail(stage, item, timelineMeta) {
    if (!item) return;
    const modal = document.getElementById('modal');
    const mTitle = document.getElementById('m-title');
    const mImg = document.getElementById('m-img');
    const mText = document.getElementById('m-text');
    const mMiniMapBox = document.getElementById("m-mini-map-box");
    const ratingSec = document.querySelector('.rating-section');

    const stageData = (typeof timelineDetails !== 'undefined') ? timelineDetails[stage] : null;
    const era = timelineMeta?.era || '';
    const years = item.years || '';
    const tags = (item.tags || []).join('、');

    if (mTitle) mTitle.innerText = `${era} · ${item.label}`;
    if (mImg && stageData?.img) {
        mImg.src = stageData.img;
        mImg.style.display = 'block';
        mImg.className = 'result-img';
    } else if (mImg) {
        mImg.style.display = 'none';
    }
    if (mMiniMapBox) mMiniMapBox.style.display = 'none';
    if (ratingSec) ratingSec.style.display = 'none';

    const stageSummary = stageData ? stripHtmlText(stageData.content) : '';
    const short = stageSummary ? (stageSummary.length > 220 ? `${stageSummary.slice(0, 220)}…` : stageSummary) : '';

    if (mText) {
        mText.innerHTML = `
            <div class="result-text" style="padding: 0 10px;">
                <div class="detail-block">
                    <h4>所属阶段</h4>
                    <p>${stage}</p>
                </div>
                <div class="detail-block">
                    <h4>时间范围</h4>
                    <p>${years}</p>
                </div>
                <div class="detail-block">
                    <h4>关键词</h4>
                    <p>${tags || '—'}</p>
                </div>
                ${short ? `
                    <div class="detail-block">
                        <h4>阶段要点</h4>
                        <p>${short}</p>
                    </div>
                ` : ''}
            </div>
        `;
    }

    if (modal) modal.style.display = 'flex';
}

const stars = document.querySelectorAll('#star-container i');
stars.forEach(star => {
    star.addEventListener('mouseover', function() {
        let val = parseInt(this.getAttribute('data-val'));
        updateStarsUI(val, true);
    });
    star.addEventListener('mouseout', function() {
        updateStarsUI(userRatings[currentGarden] || 0);
    });
    star.addEventListener('click', function(event) {
        let val = parseInt(this.getAttribute('data-val'));
        userRatings[currentGarden] = val; 
        updateStarsUI(val);
        const p = new InkParticle(event.clientX, event.clientY);
        p.size = 15; 
        particles.push(p); 
    });
});

function updateStarsUI(rating, isHover = false) {
    stars.forEach(s => {
        if (parseInt(s.getAttribute('data-val')) <= rating) {
            s.className = 'fa-solid fa-star active';
        } else {
            s.className = 'fa-solid fa-star'; 
            s.classList.remove('active');
        }
    });
    const textEl = document.getElementById('rating-score-text');
    if (rating === 0 && !isHover) textEl.innerText = '暂未评分';
    else if (rating === 5) textEl.innerText = '5.0 绝美神作！';
    else if (rating === 4) textEl.innerText = '4.0 值得一游';
    else textEl.innerText = rating + '.0 分';
}

// --- 营造小游戏逻辑 ---
function renderGame() {
    const board = document.getElementById('game-board');
    if (!board) return;
    board.innerHTML = '';
    [...fragments].sort(() => Math.random() - 0.5).forEach(f => {
        const div = document.createElement('div');
        div.className = 'fragment';
        div.innerHTML = `<i class="fa-solid ${f.icon}"></i><span style="color: var(--title-color);">${f.name}</span>`;
        div.onclick = () => {
            if (selectedFragments.includes(f)) {
                selectedFragments = selectedFragments.filter(i => i.id !== f.id);
                div.classList.remove('selected');
            } else {
                if (selectedFragments.length >= 3) { alert('最多只能选择 3 个构件！'); return; }
                selectedFragments.push(f);
                div.classList.add('selected');
            }
        };
        board.appendChild(div);
    });
}

function checkGameResult() {
    if (selectedFragments.length < 3) { alert('请收集齐 3 个碎片再进行组合！'); return; }
    const isSuccess = selectedFragments.every(f => f.type === 'target');
    const modal = document.getElementById('modal');
    
    document.querySelector('.rating-section').style.display = 'none';
    
    if (isSuccess) {
        document.getElementById('m-title').innerText = '🎉 营造成功：再现江南雅韵';
        document.getElementById('m-img').src = 'https://images.unsplash.com/photo-1543363363-233bbba0684a?w=800&q=80';
        document.getElementById('m-img').style.display = 'block';
        document.getElementById('m-text').innerHTML = '<p style="font-size:18px; text-align:center;"><b style="color: var(--title-color);">太棒了！</b>你准确捕捉到了江南私家园林的精髓。粉墙黛瓦的素雅、漏窗借景的巧妙、太湖奇石的瘦透漏皱，共同构筑了文人墨客心中的精神家园。</p>';
    } else {
        document.getElementById('m-title').innerText = '❌ 营造失败：风格冲突';
        document.getElementById('m-img').style.display = 'none';
        document.getElementById('m-text').innerHTML = '<p style="font-size:18px; text-align:center;">哎呀，似乎混入了皇家园林（如琉璃瓦、汉白玉）或岭南园林（如满洲窗）的特征，破坏了江南园林的清幽雅致。请取消错误选项重新尝试！</p>';
    }
    
    const oldClose = document.querySelector('.modal-close').onclick;
    document.querySelector('.modal-close').onclick = function() {
        closeModal();
        setTimeout(() => { document.querySelector('.rating-section').style.display = 'flex'; }, 300);
        document.querySelector('.modal-close').onclick = closeModal; 
    };
    
    modal.style.display = 'flex';
}

// --- 3D 文字地球 ---
function init3DWordCloud() {
    const canvas = document.getElementById('wordcloud-3d');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    let width = canvas.width, height = canvas.height;
    let cx = width / 2, cy = height / 2;
    const radius = 220;
    
    let tags = [];
    let mouseX = 40, mouseY = -40;

    const phi = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < words3D.length; i++) {
        let y = 1 - (i / (words3D.length - 1)) * 2;
        let radiusAtY = Math.sqrt(1 - y * y);
        let theta = phi * i;
        let x = Math.cos(theta) * radiusAtY;
        let z = Math.sin(theta) * radiusAtY;
        tags.push({ x: x * radius, y: y * radius, z: z * radius, text: words3D[i].text, size: words3D[i].size, color: words3D[i].c });
    }

    function rotateX(angle) {
        let cos = Math.cos(angle), sin = Math.sin(angle);
        tags.forEach(t => { let y1 = t.y * cos - t.z * sin; let z1 = t.z * cos + t.y * sin; t.y = y1; t.z = z1; });
    }
    function rotateY(angle) {
        let cos = Math.cos(angle), sin = Math.sin(angle);
        tags.forEach(t => { let x1 = t.x * cos + t.z * sin; let z1 = t.z * cos - t.x * sin; t.x = x1; t.z = z1; });
    }

    function draw() {
        ctx.clearRect(0, 0, width, height);
        rotateX(mouseY * 0.0001); rotateY(mouseX * 0.0001);
        
        let sorted = tags.slice().sort((a, b) => a.z - b.z);
        sorted.forEach(t => {
            let scale = radius / (radius - t.z * 0.6); 
            let alpha = (t.z + radius) / (2 * radius); 
            alpha = Math.max(0.15, alpha);

            ctx.save();
            ctx.translate(cx + t.x * scale, cy + t.y * scale);
            ctx.scale(scale, scale);
            ctx.globalAlpha = alpha;
            
            if (document.body.classList.contains('night-mode')) {
                ctx.shadowColor = t.color; ctx.shadowBlur = 10; ctx.fillStyle = '#fff';
            } else {
                ctx.shadowBlur = 0; ctx.fillStyle = t.color; 
            }

            ctx.font = `bold ${t.size}px "Noto Serif SC", serif`;
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText(t.text, 0, 0);
            ctx.restore();
        });
        requestAnimationFrame(draw);
    }

    canvas.addEventListener('mousemove', e => {
        let rect = canvas.getBoundingClientRect();
        mouseX = e.clientX - rect.left - cx;
        mouseY = e.clientY - rect.top - cy;
    });
    canvas.addEventListener('mouseleave', () => { mouseX = 40; mouseY = -40; }); 
    draw(); 
}

function initSankeyChart() {
    const chartDom = document.getElementById('sankey-chart');
    if (!chartDom) return;
    const myChart = echarts.init(chartDom);
    
    const option = {
        title: {
            text: '园林智慧传承谱系图',
            left: 'center',
            top: 6,
            textStyle: {
                color: '#8b3a3a',
                fontSize: 22,
                fontFamily: '华文行楷, STKaiti, serif',
                textShadowBlur: 5,
                textShadowColor: 'rgba(0,0,0,0.1)'
            }
        },
        tooltip: {
            trigger: 'item',
            triggerOn: 'mousemove',
            backgroundColor: 'rgba(255, 255, 255, 0.95)',
            borderColor: '#d4a373',
            borderWidth: 1,
            textStyle: { color: '#4a3e36', fontSize: 13 },
            formatter: function(params) {
                if (params.dataType === 'node') {
                    return `<div style="padding:5px;">
                                <b style="color:#8b3a3a; font-size:15px;">${params.name}</b><br/>
                                <span style="color:#666;">点击查看深度影响与历史意义</span>
                            </div>`;
                }
                return `<div style="padding:5px;">
                            <span style="color:#b87a3a;">从：</span>${params.data.source}<br/>
                            <span style="color:#b87a3a;">至：</span>${params.data.target}<br/>
                            <span style="color:#8b3a3a;">关联权重：</span>${params.data.value}
                        </div>`;
            }
        },
        series: [
            {
                type: 'sankey',
                left: 12,
                right: 190,
                top: 64,
                bottom: 120,
                data: sankeyData.nodes.map(node => ({
                    name: node.name,
                    itemStyle: {
                        color: getNodeColor(node.name),
                        borderColor: 'transparent',
                        opacity: 0.95
                    }
                })),
                links: sankeyData.links,
                emphasis: {
                    focus: 'adjacency',
                    lineStyle: {
                        opacity: 0.9,
                        color: 'source'
                    }
                },
                lineStyle: {
                    color: 'source',
                    curveness: 0.45,
                    opacity: 0.12 // 极细线条效果：初始透明度降得很低
                },
                label: {
                    color: '#4a3e36',
                    fontFamily: 'STKaiti, serif',
                    fontSize: 12,
                    position: 'right',
                    distance: 6,
                    width: 110,
                    overflow: 'truncate'
                },
                layoutIterations: 64, // 大幅增加迭代次数，使线条分布更均匀
                nodeAlign: 'justify',
                nodeWidth: 8, // 节点变窄，使线条显得更长、更细
                nodeGap: 12,
                draggable: true
            }
        ]
    };

    myChart.setOption(option);
    
    myChart.on('click', function(params) {
        if (params.dataType === 'node') {
            showSankeyDetail(params.name);
        }
    });

    window.addEventListener('resize', () => myChart.resize());
}

// 优化的多级节点颜色体系
function getNodeColor(name) {
    // 第1层：时代背景 (6个) - 正红色
    const layer1 = [
        "秦汉宫苑", "魏晋私园", "隋唐御苑", 
        "宋代文人园", "明代造园热", "清代皇家园林"
    ];
    
    // 第2层：理论与著作 (12个) - 紫罗兰色
    const layer2 = [
        "《营造法式》", "《林泉高致》", "《园冶》", "《长物志》", 
        "《闲情偶寄》", "《说园》",
        "因借体宜", "虽由人作", "宛自天开", 
        "步移景异", "情景交融", "天人合一"
    ];
    
    // 第3层：营建技艺 (12个) - 翡翠绿色
    const layer3 = [
        "太湖石叠山", "黄石叠山", "聚散理水", "曲水流觞", 
        "框景漏窗", "对景借景", "花木配植", "铺地艺术", 
        "木构装修", "彩画装饰", "空间布局", "借景手法"
    ];
    
    // 第4层：名园与现代影响 (16个) - 湖蓝色
    const layer4 = [
        "拙政园", "留园", "网师园", "沧浪亭", "狮子林", 
        "个园", "寄畅园", "豫园", "颐和园", "圆明园", "避暑山庄",
    ];
    const layer5 = [
        "现代景观设计", "文化遗产保护", "生态智慧", "东方美学", "诗意栖居"
    ];
    
    if (layer1.includes(name)) return '#c0392b';  // 第1层：正红色
    if (layer2.includes(name)) return '#8e44ad';  // 第2层：紫罗兰色
    if (layer3.includes(name)) return '#27ae60';  // 第3层：翡翠绿色
    if (layer4.includes(name)) return '#3498db';  // 第4层：湖蓝色
    if (layer5.includes(name)) return 'orange';
    
    // 默认颜色（防止遗漏）
    return '#95a5a6';
}

// 专属桑基详情展示逻辑
function showSankeyDetail(name) {
    const detail = sankeyNodeDetails[name] || {
        impact: "该著作/理念是中国造园艺术的重要组成部分，通过跨越时空的传承，深刻影响了东方的空间审美与营建逻辑。",
        significance: "它不仅保留了传统的营造智慧，更为现代城市景观设计提供了可持续发展的生态灵感与文化范式。"
    };
    
    const modal = document.getElementById('sankey-modal');
    const content = `
        <div class="sankey-scroll-content">
            <span class="sankey-scroll-close" onclick="closeSankeyModal()"><i class="fa-solid fa-xmark"></i></span>
            <h2 class="scroll-title">${name}</h2>
            <div class="scroll-section">
                <h3><i class="fa-solid fa-arrow-up-right-dots"></i> 历史影响 (Impact)</h3>
                <p>${detail.impact}</p>
            </div>
            <div class="scroll-section">
                <h3><i class="fa-solid fa-seedling"></i> 现实意义 (Significance)</h3>
                <p>${detail.significance}</p>
            </div>
            <div class="scroll-decoration">
                <i class="fa-solid fa-leaf"></i>
                <p style="font-size: 0.8rem; margin-top: 10px; color: #999;">— 园林风雅 · 薪火相传 —</p>
            </div>
        </div>
    `;
    
    modal.innerHTML = content;
    modal.style.display = 'flex';
}

function closeSankeyModal() {
    const modal = document.getElementById('sankey-modal');
    modal.style.display = 'none';
}

// --- 页面初始化入口 ---
function initPage(pageName) {
    console.log("初始化页面: " + pageName);
    
    try {
        // 公共初始化：水墨动画系统
        initInkSystem();

        if (pageName === 'gallery') {
            if (!chartsInitialized) {
                buildTimeline();
                const pieEl = document.getElementById('pieChart');
                const lineEl = document.getElementById('lineChart');
                if(pieEl) {
                    pieChart = echarts.init(pieEl);
                    pieChart.on('click', function (params) {
                        if (params.name) showGardensForRegion(params.name);
                    });
                }
                if(lineEl) initLineChart();
                
                // 立即进行首次数据刷新（显示列表和图表），不等待地图
                try {
                    refreshByEra();
                } catch (e) {
                    console.warn("初始数据刷新失败，可能数据尚未就绪:", e);
                }
                
                // 异步初始化地图
                initMap();
                chartsInitialized = true;
            }
            setTimeout(() => {
                try {
                    if (mapInstance) qq.maps.event.trigger(mapInstance, 'resize');
                    if (lineChart) lineChart.resize();
                    if (pieChart) pieChart.resize();
                } catch (e) {}
            }, 160);
        }

        if (pageName === 'game') {
            // 演变史页面：初始化 3D 意象球
            if (!wordCloudInitialized) {
                init3DWordCloud();
                wordCloudInitialized = true;
            }
            initEvolutionTimelineInteractive();
        }

        if (pageName === 'philosophy') {
            // 人物与著作页面：初始化桑基图
            initSankeyChart();
        }

        if (pageName === 'fun') {
            // 园趣页面：初始化营造小游戏
            renderGame();
            console.log("园趣页面已初始化，AI 智能体已就绪。");
            initFlyFlowerGame();
            initPhotoInsight();
        }
    } catch (err) {
        console.error("页面初始化过程中发生错误:", err);
    }
}

// --- 初始加载 ---
// 不再直接覆盖 window.onload，而是通过 addEventListener 确保不会冲突
window.addEventListener('load', () => {
    // 如果 body 没有 onload 属性，则尝试运行默认初始化（如登录页）
    if (!document.body.getAttribute('onload')) {
        console.log("检测到页面未设置 onload 属性，执行默认逻辑");
        // 可以在这里放置通用的背景初始化逻辑
        initInkSystem();
    }
});
