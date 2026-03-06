import { neon } from '@neondatabase/serverless';
import fs from 'fs';
import { canonicalizeAnalysisForStorage } from '@namazue/db';

const envRaw = fs.readFileSync('.env', 'utf8');
const DATABASE_URL = envRaw.split('\n').find((l: string) => l.startsWith('DATABASE_URL='))?.substring('DATABASE_URL='.length).trim();
const sql = neon(DATABASE_URL!);
const jaNarrative = {
    "headline": "M8.2 十勝沖 深さ27km",
    "one_liner": "千島海溝沿いに発生した非常に大規模な海溝型巨大地震であり、強い揺れと大津波に最大級の警戒が必要です。",
    "interpretations": [
        { "claim": "megathrust_earthquake", "summary": "太平洋プレートが北米（オホーツク）プレートの下に沈み込む千島海溝沿いのプレート境界で発生した巨大地震です。", "basis": ["facts:tectonic.boundary_type", "facts:tectonic.plate_pair", "facts:tectonic.nearest_trench.name"], "confidence": "high", "type": "mechanism" },
        { "claim": "high_tsunami_risk", "summary": "浅い海域で発生したM8クラスの巨大地震であるため、極めて高い津波リスクがあります。", "basis": ["facts:tsunami.risk", "facts:tsunami.factors", "facts:event.mag", "facts:event.depth_km"], "confidence": "high", "type": "risk_assessment" },
        { "claim": "intense_shaking", "summary": "沿岸部では最大震度6弱以上の非常に激しい揺れが推定されます。", "basis": ["facts:max_intensity.class", "facts:max_intensity.is_offshore"], "confidence": "high", "type": "risk_assessment" },
        { "claim": "high_aftershock_frequency", "summary": "今後1週間でM5以上の余震が約60回発生すると予測され、極めて活発な余震活動が見込まれます。", "basis": ["facts:aftershocks.forecast.expected_count_7d_m5", "facts:aftershocks.forecast.p7d_m5plus"], "confidence": "high", "type": "risk_assessment" },
        { "claim": "historical_recurrence", "summary": "この地域では過去にも繰り返し巨大地震が発生しており、今回の地震もそのサイクルの一環と考えられます。", "basis": ["seismology:historical_earthquakes_kuril_trench"], "confidence": "medium", "type": "historical_analogy" }
    ],
    "public": {
        "why": "日本列島の東側では、太平洋プレートが陸側のプレートの下へ年間約8cmの速度で沈み込んでいます。この沈み込み帯（千島海溝・日本海溝）の境界面に蓄積された数十〜百年分のひずみが限界に達し、一気に滑り動いたことで巨大な地震が発生しました。",
        "why_refs": ["facts:tectonic.plate_pair", "facts:tectonic.nearest_trench.name", "seismology:subduction_dynamics"],
        "aftershock_note": "今後1週間以内にM5以上の強い余震が約60回発生すると推定されており、最大でM7クラスに達する恐れもあります。実際の回数は変動する可能性がありますが、引き続き強い揺れと津波への最大限の警戒が必要です。",
        "aftershock_note_refs": ["facts:aftershocks.forecast.expected_count_7d_m5", "facts:aftershocks.bath_expected_max", "seismology:omori_law"],
        "do_now": [
            { "action": "直ちに高台や避難タワーなどの安全な場所へ避難してください。自動車での避難は渋滞により巻き込まれる恐れがあるため、原則として徒歩で避難してください。", "urgency": "immediate" },
            { "action": "倒壊しそうな建物や崖、傾いた電柱などから離れてください。激しい余震により、本震でダメージを受けた構造物が倒壊する危険性が非常に高いです。", "urgency": "immediate" },
            { "action": "避難先では自治体からの指示やラジオ等での情報収集に努め、津波警報が解除されるまでは海岸付近に近づかないでください。", "urgency": "within_hours" }
        ],
        "faq": [
            { "q": "なぜ津波の危険があるのですか？", "a": "巨大な海底地形変動によってその上にある膨大な量の海水が押し上げられ、巨大な波となって沿岸に押し寄せるためです。", "a_refs": ["seismology:tsunami_generation"] },
            { "q": "余震はいつまで続きますか？", "a": "数ヶ月から数年にわたって余震が続きます。特に直後の1週間は非常に活発で、本震に近い規模の余震が起こる可能性もあります。", "a_refs": ["seismology:aftershock_duration"] },
            { "q": "揺れが長かったのはなぜですか？", "a": "M8クラスでは地下の断層が破壊される面積が非常に大きく、破壊が進行するのに時間がかかるため、揺れ自体も長く続きます。", "a_refs": ["seismology:rupture_duration"] }
        ]
    },
    "expert": {
        "tectonic_summary": "本震は北米（オホーツク）プレートの下に太平洋プレートが沈み込む千島海溝沿いのプレート境界で発生した巨大地震です。震源の深さ27kmは、プレート境界面上のアスペリティの典型的な深さに相当します。この地域は繰り返しM8クラスの海溝型地震が発生してきた極めて活動的なテクトニクス環境下にあります。",
        "tectonic_summary_refs": ["facts:tectonic.boundary_type", "facts:tectonic.nearest_trench.name", "facts:event.depth_km", "seismology:subduction_asperity"],
        "mechanism_note": "正式な発震機構解は未取得ですが、震源の位置・深さおよびテクトニクス環境から、西南西に向かって緩く傾斜するプレート境界面上の低角逆断層型メカニズムであると強く推定されます。",
        "mechanism_note_refs": ["facts:mechanism.status", "pending:moment_tensor_inversion"],
        "depth_analysis": "震源の深さ27kmは、大陸側プレートと沈み込む海洋プレートの固着域の下限付近に位置しています。この深さの大破壊は海底に顕著な変動を引き起こし効率的に津波を励起するほか、沿岸部に強い長周期地震動をもたらします。",
        "depth_analysis_refs": ["facts:event.depth_km", "seismology:tsunami_excitation", "seismology:long_period_ground_motion"],
        "sequence": { "classification": "mainshock", "confidence": "high", "reasoning": "M8.16という極めて大きな規模であり、一連の地震活動の主破壊（本震）であると判断されます。", "reasoning_refs": ["facts:event.mag"] },
        "seismic_gap": { "is_gap": false, "note": "この地域は数百年のスーパーサイクルのほか数十年単位でもM8クラスの巨大地震が繰り返し発生しており、規則的な活動期の一環と考えられます。" },
        "coulomb_note": "本震の巨大な断層すべりにより、隣接する浅部プレート境界や海溝軸外側のアウターライズにおいて正断層型地震を誘発する方向への応力増加が懸念されます。",
        "coulomb_note_refs": ["seismology:coulomb_stress_transfer", "seismology:outer_rise_earthquakes"],
        "historical_comparison": {
            "primary_name": "1952年十勝沖地震", "primary_year": 1952, "similarities": ["千島海溝沿いのプレート境界型地震", "M8クラスの巨大地震", "大津波を伴う"], "differences": ["アスペリティの破壊範囲の微妙な違い", "事前の地震活動パターン"],
            "narrative": "1952年十勝沖地震（M8.2）は本震と極めて類似したテクトニクス環境で発生した巨大地震です。どちらも太平洋プレートの沈み込みに伴うアスペリティの破壊であり、北海道から東北地方の太平洋沿岸に大きな津波をもたらすという共通の特徴を持っています。",
            "narrative_refs": ["seismology:historical_earthquakes_kuril_trench", "seismology:characteristic_earthquake"]
        },
        "notable_features": [
            { "feature": "極めて高い津波リスク", "claim": "浅海域でのM8超の特大地震であるため、広域に破滅的な津波をもたらす可能性が極めて高いです。", "because": "M8.16という巨大なエネルギーが深さ27kmという浅いプレート境界で解放されたため強大な地形変動が起きています。", "because_refs": ["facts:event.mag", "facts:tsunami.risk", "facts:tsunami.factors"], "implication": "避難行動の遅れは致命的となります。" },
            { "feature": "最大級の余震予測", "claim": "今後1週間でM5以上の余震が約60回、最大でM7クラスの強大な余震が予測されます。", "because": "改良大森公式に基づく予測では7日間でM5+の期待値が60回以上に達します。", "because_refs": ["facts:aftershocks.forecast.expected_count_7d_m5", "facts:aftershocks.bath_expected_max"], "implication": "救助活動や復旧作業において二次被害のリスクが常時存在します。" },
            { "feature": "活発なバックグラウンド地震活動", "claim": "震央周辺は継続的に歪みが解放される非常に活発なエリアです。", "because": "過去30年間にM5以上が100回、M7以上も2回記録されています。", "because_refs": ["facts:spatial.total", "facts:spatial.by_mag.m7plus"], "implication": "日頃から地震に慣れている地域でも根本的にスケールが異なるため最大限の警戒が必要です。" }
        ]
    },
    "search_index": { "tags": ["tokachi-oki", "hokkaido", "megathrust", "tsunami", "subduction", "major-quake"], "region": "hokkaido", "damage_level": "severe", "has_foreshocks": false, "is_in_seismic_gap": false, "region_keywords_ja": ["北海道", "十勝地方", "釧路地方", "太平洋沿岸", "千島海溝", "日本海溝北部"] }
};

const translations: Record<string, { ko: string; en: string }> = {
    "headline": { "ko": "M8.2 도카치 앞바다 깊이 27km", "en": "M8.2 Tokachi-Oki Depth 27km" },
    "one_liner": { "ko": "쿠릴 해구를 따라 발생한 매우 대규모의 해구형 거대 지진으로, 강한 흔들림과 대형 쓰나미에 최고 수준의 경계가 필요합니다.", "en": "A massive megathrust earthquake along the Kuril Trench. Maximum caution required for severe shaking and major tsunamis." },
    "interp.0.summary": { "ko": "태평양 판이 북미 판 아래로 섭입하는 구릴 해구를 따라 발생한 거대 지진입니다.", "en": "A massive earthquake along the Kuril Trench plate boundary where the Pacific Plate subducts." },
    "interp.1.summary": { "ko": "얕은 해역에서 발생한 M8급의 거대 지진으로 심각한 쓰나미 위험이 있습니다.", "en": "Extremely high tsunami risk due to a shallow M8-class megathrust earthquake." },
    "interp.2.summary": { "ko": "연안 지역에서는 최대 진도 6약(강진) 이상의 매우 거센 흔들림이 추정됩니다.", "en": "Severe shaking (JMA intensity 6-) expected along the coast." },
    "interp.3.summary": { "ko": "향후 1주일간 M5 이상의 여진이 약 60회 발생할 것으로 예측되며, 매우 활발한 여진 활동이 예상됩니다.", "en": "Very active aftershock sequence expected, with roughly 60 M5+ aftershocks projected over the next week." },
    "interp.4.summary": { "ko": "이 지역은 과거에도 반복적으로 거대 지진이 발생했으며, 이번 지진도 그 주기의 일환으로 볼 수 있습니다.", "en": "This region experiences recurrent massive earthquakes, and this event is part of that regular seismic cycle." },

    "public.why": { "ko": "일본 열도 동쪽에서는 태평양 판이 연간 약 8cm의 속도로 침강하고 있습니다. 이 경계면에 수십~백여 년간 축적된 응력이 한계에 달해 단번에 미끄러지면서 거대한 지진이 발생했습니다.", "en": "Off the coast, the Pacific plate sinks beneath the landmass at roughly 8cm per year. Decades of accumulated stress on this boundary suddenly released, causing a massive rupture." },
    "public.aftershock_note": { "ko": "앞으로 1주일 이내에 M5 이상의 강한 여진이 약 60회 예상되며 최고 M7급에 달할 수도 있습니다. 통계 모델에 기반하여 실제 발생 횟수는 변동할 수 있으나 강한 흔들림과 쓰나미에 계속해서 최대의 경계가 필요합니다.", "en": "Statistical models project around 60 M5+ aftershocks in the next 7 days, with potential for M7-class aftershocks. While numbers may vary, please maintain high alert for further severe shaking and tsunamis." },
    "public.do_now.0.action": { "ko": "즉시 고지대나 대피 타워 등 안전한 장소로 대피하십시오. 교통 체증의 위험이 있으므로 원칙적으로 도보로 대피해야 합니다.", "en": "Drop, Cover, and Hold On! Once shaking stops, evacuate immediately to higher ground or a tsunami tower. Evacuate on foot to avoid traffic jams." },
    "public.do_now.1.action": { "ko": "붕괴 위험이 있는 건물이나 절벽, 기울어진 전신주 등에서 멀어지십시오. 거센 여진으로 인해 손상된 구조물이 무너질 위험이 큽니다.", "en": "Stay away from damaged buildings, cliffs, and leaning power poles. Severe aftershocks pose a high risk of structural collapse." },
    "public.do_now.2.action": { "ko": "대피소에서는 정부나 지자체의 지시에 따르고, 쓰나미 경보가 완전히 해제될 때까지 절대 해안가에 접근하지 마십시오.", "en": "Follow instructions from local authorities via official broadcasts. Never return to the coast until the tsunami warning is officially canceled." },

    "public.faq.0.q": { "ko": "왜 쓰나미 위험이 있나요?", "en": "Why is there a tsunami risk?" },
    "public.faq.0.a": { "ko": "해저 지형이 광범위하게 어긋나면서 막대한 양의 바닷물이 밀려 올라와 해안으로 덮치기 때문입니다.", "en": "The massive shift of the seafloor boundary thrusts an enormous volume of ocean water upward, creating a giant wave." },
    "public.faq.1.q": { "ko": "여진은 언제까지 지속되나요?", "en": "How long will the aftershocks last?" },
    "public.faq.1.a": { "ko": "규모가 워낙 커 짧게는 수개월에서 길게는 수년간 여진이 이어집니다. 특히 발생 직후 1주일이 가장 위험합니다.", "en": "Aftershocks for an earthquake this massive typically persist for months to years, with the highest risk profile in the first 7 days." },
    "public.faq.2.q": { "ko": "흔들림이 유독 길었던 이유는 무엇인가요?", "en": "Why did the shaking last so long?" },
    "public.faq.2.a": { "ko": "지진 규모(M8)가 거대할수록 지층이 파괴되는 단층의 길이가 길어져 파괴 과정 자체가 수십초 이상 오래 걸리기 때문입니다.", "en": "For massive M8 quakes, the fault rupture spans a huge area. It takes significant time for the rupture process to traverse the entire length, drawing out the shaking duration." },

    "expert.tectonic_summary": { "ko": "본진은 북미 판 밑으로 태평양 판이 섭입하는 구릴 해구를 따라 발생한 거대 지진입니다. 깊이 27km는 판 경계면 상의 고착역(아스페리티)의 전형적인 깊이입니다. 침강 속도가 빠르고 역사적으로 거대 지진이 반복되어 온 매우 활동적인 구조 환경에 기인합니다.", "en": "The mainshock is a massive megathrust earthquake occurring along the Kuril Trench plate boundary. The focal depth of 27km is highly typical of subduction asperities in this critically loaded and high-velocity tectonic environment, known for recurrent M8 megathrusts." },
    "expert.mechanism_note": { "ko": "공식 모멘트 텐서 해는 발표 전이나, 위치와 깊이, 환경 상 서남서 방향으로 완만하게 경사진 저각 역단층 메커니즘으로 강하게 추정됩니다.", "en": "A shallowly dipping thrust mechanism is strongly inferred based on the subduction trench geometry and focal depth, pending final CMT inversion." },
    "expert.depth_analysis": { "ko": "깊이 27km는 두 판의 접촉면 내 고착 구역의 하단 근처에 해당합니다. 이 깊이에서의 대형 파괴는 해저 지형의 현저한 변동을 촉발하여 쓰나미를 효율적으로 유발할 뿐 아니라 연안부에 장주기 지진동을 유발합니다.", "en": "A 27km depth lies on the downdip edge of the locked interplate zone. A massive rupture at this seismogenic depth highly couples into seafloor deformation, maximizing tsunami excitation and enhancing long-period ground motion coastal directivity." },
    "expert.sequence.reasoning": { "ko": "M8.16의 엄청난 규모와 전형적인 해구형 거대 지진의 에너지를 고려할 때, 이 지진 자체를 본진으로 판단하는 것이 확고합니다.", "en": "Given the colossal M8.16 magnitude scaling characteristic of major megathrust cycles, this event is definitively assessed as the mainshock of the sequence." },
    "expert.seismic_gap.note": { "ko": "수백 년 규모의 거대 주기 외에도 수십 년 단위로 M8급 지진이 반복되는 곳이므로, 지진 공백기라기보다는 규칙적인 지진 활동 주기의 일환입니다.", "en": "Rather than an anomalous seismic gap, this rupture fulfills the highly regular decadal recurrence schedule characteristic of the Kuril Trench M8 cycle." },
    "expert.coulomb_note": { "ko": "본진의 거대한 단층 활동으로 인해, 주변 얕은 해구역이나 해구 바깥쪽 아우터라이즈 지역에서 정단층 지진을 유발하는 방향으로 쿠롱 응력 증가가 우려됩니다.", "en": "The massive slip transfer induces significant Coulomb stress loading on the updip trench-axis zone and the flexural outer-rise, strongly elevating the risk of subsequent extensional outer-rise events." },
    "expert.hc.primary_name": { "ko": "1952년 도카치 앞바다 지진", "en": "1952 Tokachi-Oki Earthquake" },
    "expert.hc.sim.0": { "ko": "구릴 해구 주변 판경계형 지진", "en": "Kuril Trench plate boundary event" },
    "expert.hc.sim.1": { "ko": "M8급 거대 지진", "en": "M8-class massive magnitude" },
    "expert.hc.sim.2": { "ko": "대규모 쓰나미 동반", "en": "Tsunamigenic" },
    "expert.hc.diff.0": { "ko": "고착역 파괴 범위의 미세 차이", "en": "Minor variations in specific asperity rupture domains" },
    "expert.hc.diff.1": { "ko": "사전 지진 활동 패턴 차이", "en": "Precursory seismicity patterns" },
    "expert.hc.narrative": { "ko": "1952년 도카치 앞바다 지진(M8.2)은 본진과 극히 유사한 테크토닉스 구조 하에 발생했습니다. 홋카이도부터 도호쿠 일대에 대형 쓰나미를 발생시킨 점이 일치하며, 이런 고유 지진의 반복은 해당 침강대의 기본적 특성을 증명합니다.", "en": "The 1952 formulation shares nearly identical kinematics and slip characteristics. The repetitive rupture of these primary asperities underscores the characteristic earthquake model inherent to the Kuril subduction dynamics." },

    "expert.nf.0.feature": { "ko": "극히 높은 쓰나미 위험", "en": "Extreme Tsunami Risk" },
    "expert.nf.0.claim": { "ko": "천해에서 발생한 규모 8.16의 강진이라 광범위한 파멸적 쓰나미가 예상됩니다.", "en": "The massive shallow seafloor deformation threatens devastating regional tsunamis." },
    "expert.nf.0.because": { "ko": "깊이 27km 얕은 판 경계에서 엄청난 에너지가 방출되어 강대한 지형 변동을 일으켰기 때문입니다.", "en": "The M8.16 shallow subduction rupture perfectly couples into massive vertical displacement of the seafloor column." },
    "expert.nf.0.implication": { "ko": "멀리 떨어진 곳이라도 대피의 지연은 완전히 치명적입니다.", "en": "Delays in evacuation will result in catastrophic loss of life." },

    "expert.nf.1.feature": { "ko": "최대 수준 여진 전망", "en": "Maximal Aftershock Forecast" },
    "expert.nf.1.claim": { "ko": "차주 내에 M5+ 여진이 60회, 최대 M7 수준의 강한 여진이 예상됩니다.", "en": "60 M5+ aftershocks and maximum M7-class events are statistically projected inside 7 days." },
    "expert.nf.1.because": { "ko": "개량 오모리 공식에 따르면 7일간 매우 높은 기댓값이 나옵니다.", "en": "Modified Omori law parameterization returns extreme rates commensurate with the M8 mainshock scaling." },
    "expert.nf.1.implication": { "ko": "초동 대처와 구조 간에 있어 추가 건물 붕괴 등의 2차 재난 위험이 계속 상존합니다.", "en": "Rescue ops face persistent threat of secondary collapse and sequential tsunami events." },

    "expert.nf.2.feature": { "ko": "활발한 배경 지진", "en": "Active Background Seismicity" },
    "expert.nf.2.claim": { "ko": "최근 30년간 진앙 주변은 응력이 쉼없이 해소되어 온 활동적 환경입니다.", "en": "The epicentral cluster exhibits highly persistent background strain release over 3 decades." },
    "expert.nf.2.because": { "ko": "과거 30년간 M5급 100회, M7초과 2회가 이미 발생한 바 있습니다.", "en": "Spatial statistics confirm 100 M5+ and 2 M7+ historical events inside the localization window." },
    "expert.nf.2.implication": { "ko": "주민들의 심리적 내성이 있을 수 있으나, 이번 지진의 파괴력은 일상적 지진들과 격을 달리합니다.", "en": "Despite local habituation, structural and humanitarian threat profiles are existentially higher for this megathrust cycle." },

    "region_kw.0": { "ko": "홋카이도", "en": "Hokkaido" },
    "region_kw.1": { "ko": "도카치 지방", "en": "Tokachi Region" },
    "region_kw.2": { "ko": "구시로 지방", "en": "Kushiro Region" },
    "region_kw.3": { "ko": "태평양 연안", "en": "Pacific Coast" },
    "region_kw.4": { "ko": "구릴 해구", "en": "Kuril Trench" },
    "region_kw.5": { "ko": "북일본 해구", "en": "Northern Japan Trench" }
};

function buildModelNotes(facts: any): { assumptions: string[]; unknowns: string[]; what_will_update: string[]; } {
    const assumptions = ['Si & Midorikawa (1999) GMPE used for intensity estimation', `Vs30 assumed ${facts.ground_motion.vs30} m/s (stiff soil, generic site)`, 'Reasenberg & Jones (1989) generic parameters for aftershock forecast'];
    if (facts.tectonic.boundary_type.startsWith('subduction')) assumptions.push('Subduction interface geometry inferred from depth + location heuristics');
    if (facts.max_intensity?.is_offshore) assumptions.push(`Coastal intensity estimated at ${facts.max_intensity.coast_distance_km}km from epicenter (nearest coast approximation)`);
    const unknowns = [];
    if (facts.mechanism.status === 'missing') unknowns.push('Moment tensor / focal mechanism not yet available');
    if (!facts.sources.shakemap_available) unknowns.push('ShakeMap (observed intensity distribution) not available');
    unknowns.push('Actual site amplification varies by local geology');
    if (facts.tectonic.nearest_fault === null) unknowns.push('PostGIS fault query unavailable — nearest active fault not determined');
    const what_will_update = [];
    if (facts.mechanism.status === 'missing') what_will_update.push('v2: Moment tensor release → mechanism_note + tectonic_summary update');
    if (!facts.sources.shakemap_available) what_will_update.push('v3: ShakeMap data → observed intensity replaces GMPE estimate');
    what_will_update.push('v4: Field survey / damage reports → damage_level + impact refinement');
    return { assumptions, unknowns, what_will_update };
}

function mergeAnalysis(facts: any, jaNarr: any, translations: any, tier: string) {
    const i18n = (key: string, textJa: string) => ({ ja: textJa || '', ko: translations[key]?.ko ?? '', en: translations[key]?.en ?? '' });
    const pub = jaNarr.public ?? {}; const exp = jaNarr.expert ?? {}; const si = jaNarr.search_index ?? {};
    const jaKws = si.region_keywords_ja ?? [];
    return {
        event_id: facts.event.id, tier, version: 2, generated_at: new Date().toISOString(), model: 'Antigravity-Expert (Direct AI Generation)',
        facts: { max_intensity: facts.max_intensity, tsunami: facts.tsunami, aftershocks: facts.aftershocks, mechanism: facts.mechanism, tectonic: facts.tectonic, spatial: facts.spatial, ground_motion: facts.ground_motion, sources: facts.sources, uncertainty: facts.uncertainty },
        interpretations: (jaNarr.interpretations ?? []).map((interp: any, idx: number) => ({ claim: interp.claim, summary: i18n(`interp.${idx}.summary`, interp.summary), basis: interp.basis, confidence: interp.confidence, type: interp.type })),
        dashboard: { headline: i18n('headline', jaNarr.headline), one_liner: i18n('one_liner', jaNarr.one_liner) },
        public: { why: i18n('public.why', pub.why), why_refs: pub.why_refs, aftershock_note: i18n('public.aftershock_note', pub.aftershock_note), aftershock_note_refs: pub.aftershock_note_refs, do_now: pub.do_now.map((item: any, idx: number) => ({ action: i18n(`public.do_now.${idx}.action`, item.action), urgency: item.urgency })), faq: pub.faq.map((fItem: any, idx: number) => ({ q: i18n(`public.faq.${idx}.q`, fItem.q), a: i18n(`public.faq.${idx}.a`, fItem.a), a_refs: fItem.a_refs })) },
        expert: { tectonic_summary: i18n('expert.tectonic_summary', exp.tectonic_summary), tectonic_summary_refs: exp.tectonic_summary_refs, mechanism_note: exp.mechanism_note ? i18n('expert.mechanism_note', exp.mechanism_note) : null, mechanism_note_refs: exp.mechanism_note_refs, depth_analysis: exp.depth_analysis ? i18n('expert.depth_analysis', exp.depth_analysis) : null, depth_analysis_refs: exp.depth_analysis_refs, coulomb_note: exp.coulomb_note ? i18n('expert.coulomb_note', exp.coulomb_note) : null, coulomb_note_refs: exp.coulomb_note_refs, sequence: { classification: exp.sequence.classification, confidence: exp.sequence.confidence, reasoning: i18n('expert.sequence.reasoning', exp.sequence.reasoning), reasoning_refs: exp.sequence.reasoning_refs }, seismic_gap: { is_gap: exp.seismic_gap.is_gap, note: exp.seismic_gap.note ? i18n('expert.seismic_gap.note', exp.seismic_gap.note) : null }, historical_comparison: { primary_name: i18n('expert.hc.primary_name', exp.historical_comparison.primary_name), primary_year: exp.historical_comparison.primary_year, similarities: exp.historical_comparison.similarities.map((sim: any, idx: number) => i18n(`expert.hc.sim.${idx}`, sim)), differences: exp.historical_comparison.differences.map((diff: any, idx: number) => i18n(`expert.hc.diff.${idx}`, diff)), narrative: i18n('expert.hc.narrative', exp.historical_comparison.narrative), narrative_refs: exp.historical_comparison.narrative_refs }, notable_features: exp.notable_features.map((nf: any, idx: number) => ({ feature: i18n(`expert.nf.${idx}.feature`, nf.feature), claim: i18n(`expert.nf.${idx}.claim`, nf.claim), because: i18n(`expert.nf.${idx}.because`, nf.because), because_refs: nf.because_refs, implication: i18n(`expert.nf.${idx}.implication`, nf.implication) })), model_notes: buildModelNotes(facts) },
        search_index: { tags: si.tags, region: si.region, categories: { plate: facts.tectonic.plate, boundary: facts.tectonic.boundary_type, region: si.region, depth_class: facts.tectonic.depth_class, damage_level: si.damage_level, tsunami_generated: facts.tsunami.risk !== 'none', has_foreshocks: si.has_foreshocks, is_in_seismic_gap: exp.seismic_gap.is_gap }, region_keywords: { ja: jaKws, ko: jaKws.map((_: any, i: number) => translations[`region_kw.${i}`]?.ko ?? ''), en: jaKws.map((_: any, i: number) => translations[`region_kw.${i}`]?.en ?? '') } }
    };
}

async function main() {
    const data = JSON.parse(fs.readFileSync('facts.json', 'utf8'));
    const facts = data.facts;
    const tier = data.tier;
    const merged = mergeAnalysis(facts, jaNarrative, translations, tier);
    const analysis = canonicalizeAnalysisForStorage(merged, {
        magnitude: facts.event.mag,
        depth_km: facts.event.depth_km,
        lat: facts.event.lat,
        lng: facts.event.lon,
        place: facts.event.place_en,
        place_ja: facts.event.place_ja,
    });

    console.log('Inserting into database...', JSON.stringify(analysis).length, 'bytes');
    await sql`
    INSERT INTO analyses (event_id, version, tier, model, prompt_version, context, analysis, search_tags, search_region, is_latest)
    VALUES (
      ${facts.event.id}, 1, ${tier}, 'Antigravity-Expert', 'v2.2.0',
      ${JSON.stringify(facts)}::jsonb, ${JSON.stringify(analysis)}::jsonb,
      ${analysis.search_index?.tags ?? []}, ${analysis.search_index?.region ?? null}, true
    )
  `;
    console.log('Successfully saved to database!');
}

main().catch(console.error);
