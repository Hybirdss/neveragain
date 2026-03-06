/**
 * fetch-jshis-vs30.ts — Instructions for obtaining real Vs30 data from J-SHIS
 *
 * J-SHIS (地震ハザードステーション) does NOT provide a public bulk download API.
 * Data must be obtained through their interactive download tool.
 *
 * === MANUAL PROCESS ===
 *
 * 1. Go to: https://www.j-shis.bosai.go.jp/map/JSHIS2/download.html?lang=jp
 * 2. Select data type: "地盤データ" → "微地形区分に基づくVs30"
 * 3. Select area: Draw a rectangle covering Japan (or download by prefecture)
 * 4. Download as CSV
 * 5. Place CSV file in: tools/data/jshis-vs30-raw/
 * 6. Run: npx tsx tools/parse-jshis-vs30.ts
 *
 * === CSV FORMAT ===
 *
 * The J-SHIS CSV contains mesh-code based Vs30 values:
 *   meshcode, lon, lat, vs30
 *   53394526, 133.9563, 34.3375, 285
 *   53394527, 133.9688, 34.3375, 310
 *   ...
 *
 * Mesh codes follow the JIS X 0410 standard (Japan Industrial Standard).
 * Each 250m mesh cell has a single Vs30 value.
 *
 * === ALTERNATIVE: USGS Vs30 Global Grid ===
 *
 * If J-SHIS data is not available, the USGS provides a global Vs30 grid:
 * https://earthquake.usgs.gov/data/vs30/
 * Based on Wald & Allen (2007) topographic slope proxy.
 * Resolution: 30 arc-seconds (~1km) — coarser than J-SHIS but freely downloadable.
 *
 * === DATA RULES ===
 *
 * Detailed format documentation:
 * https://www.j-shis.bosai.go.jp/map/JSHIS2/data/DOC/DataFileRule/Z-RULES.pdf
 *
 * Reference:
 * - Matsuoka, M. & Wakamatsu, K. (2008). "Average Vs30 from geomorphological
 *   classification: a new method." J. Struct. Constr. Eng. (AIJ) 73(627), 689-696.
 * - Fujimoto, K. & Midorikawa, S. (2006). "Empirical method for estimating
 *   Vs30 from geomorphological classification." J. JAEE 6(3), 1-17.
 */

console.log('=== J-SHIS Vs30 Data ===');
console.log('');
console.log('J-SHIS does not provide a public bulk download API.');
console.log('To obtain real Vs30 data:');
console.log('');
console.log('1. Visit: https://www.j-shis.bosai.go.jp/map/JSHIS2/download.html?lang=jp');
console.log('2. Select: 地盤データ → 微地形区分に基づくVs30');
console.log('3. Select area (Japan) and download CSV');
console.log('4. Place CSV in tools/data/jshis-vs30-raw/');
console.log('5. Run: npx tsx tools/parse-jshis-vs30.ts');
console.log('');
console.log('Current data: DEV PLACEHOLDER (synthetic, not for production)');
