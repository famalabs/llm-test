import { readdir, readFile, writeFile } from "fs/promises";
import yargs from "yargs";
import { createOutputFolderIfNeeded, parseCSV } from "../utils";
import { PATH_NORMALIZATION_MARK } from "../lib/nlp";
import { hideBin } from "yargs/helpers";

const getHeatmapColor = (value: number) => {
  const v = Math.max(0, Math.min(1, value));
  const r = Math.round(255 * (1 - v));
  const g = Math.round(255 * v);
  return `rgb(${r},${g},0)`;
};

const getTextColor = (value: number) => {
  const v = Math.max(0, Math.min(1, value));
  const r = 255 * (1 - v),
    g = 255 * v,
    b = 0;
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 140 ? "#111827" : "#FFFFFF";
};

const escapeText = (s: any) =>
  String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const escapeAttrQuotesOnly = (s: string) =>
  String(s ?? "")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const buildRagConfigTooltipHTML = (filePath: string, config: any) => {
  const renderValue = (value: any): string => {
    if (typeof value === "boolean") {
      return value
        ? `<span class="font-semibold text-green-400">${value}</span>`
        : `<span class="font-semibold text-red-400">${value}</span>`;
    }
    if (typeof value === "object" && value !== null) {
      return `<div class="pl-4 mt-1 border-l border-gray-600">${renderConfigObject(value)}</div>`;
    }
    return escapeText(value);
  };

  const renderConfigObject = (obj: any): string =>
    Object.entries(obj)
      .map(([key, value]) => `
        <div class="flex justify-between items-start space-x-4 py-1">
          <span class="text-gray-400 whitespace-nowrap">${escapeText(key)}:</span>
          <span class="font-mono text-right">${renderValue(value)}</span>
        </div>
      `)
      .join("");

  const topLevelPrimitives = Object.fromEntries(Object.entries(config ?? {}).filter(([,v]) => typeof v !== 'object' || v === null));
  const topLevelObjects = Object.fromEntries(Object.entries(config ?? {}).filter(([,v]) => typeof v === 'object' && v !== null));

  let html = `<div class="space-y-3 text-white">
    <div class="text-xs text-gray-400 break-all"><b>File:</b> ${escapeText(filePath)}</div>
    <div class="border-t border-gray-700"></div>`;

  if(Object.keys(topLevelPrimitives).length > 0) {
     html += `<div class="bg-gray-700 p-2 rounded-md">
       <div class="font-semibold text-sm mb-1 text-gray-200">General</div>
       <div class="text-xs">${renderConfigObject(topLevelPrimitives)}</div>
     </div>`
  }

  for(const [sectionTitle, sectionObject] of Object.entries(topLevelObjects)) {
    html += `<div class="bg-gray-700 p-2 rounded-md">
      <div class="font-semibold text-sm mb-1 text-gray-200 capitalize">${escapeText(sectionTitle)}</div>
      <div class="text-xs">${renderConfigObject(sectionObject)}</div>
    </div>`;
  }

  html += '</div>';
  return html;
};


const buildQueryRefTooltipHTML = (query: string, reference: string) => `
  <div class="space-y-2">
    <div>
      <div class="font-semibold text-sm mb-1">Query</div>
      <div class="text-sm leading-snug">${escapeText(query)}</div>
    </div>
    <div>
      <div class="font-semibold text-sm mb-1">Reference</div>
      <div class="text-sm leading-snug">${escapeText(reference)}</div>
    </div>
  </div>`;

const buildCandidateTooltipHTML = (candidate: string) => `
  <div>
    <div class="font-semibold text-sm mb-1">Candidate</div>
    <div class="text-sm leading-snug">${escapeText(candidate)}</div>
  </div>`;

const main = async () => {
  const { input } = await yargs(hideBin(process.argv))
    .option('input', { alias: 'i', type: 'string', demandOption: true, description: 'Input base name used to filter results' })
    .help()
    .parse();

  const normalizedInput = input.replaceAll("/", PATH_NORMALIZATION_MARK);

  const allFiles = (await readdir("output/scores")).filter(
    (f) => f.split("_")[0] === normalizedInput
  );

  const allData = await Promise.all(
    allFiles.map(async (file) => {
      const csvRaw = await readFile("output/scores/" + file, "utf-8");
      const [meanScoresText, ...csvLines] = csvRaw.split("\n");
      const [llm, llmValue, meteor, meteorValue, rouge1, rouge1Value] =
        meanScoresText.split(",");
      const meanScores = {
        [llm.trim()]: parseFloat(llmValue),
        [meteor.trim()]: parseFloat(meteorValue),
        [rouge1.trim()]: parseFloat(rouge1Value),
      };

      const jsonPath = "output/candidates/" + file.replace(".csv", ".json");
      let config = {};
      try {
        config = JSON.parse(await readFile(jsonPath, "utf-8")).config ?? {};
      } catch {
        console.warn(`⚠️ Nessuna config trovata per ${file}`);
      }

      const csvFile = csvLines.join("\n");
      const csvData = await parseCSV(csvFile);
      return {
        filePath: file.replace(".csv", ""),
        displayName: (file.split("_").pop()?.replace(".csv", "") ?? file).replaceAll(
          PATH_NORMALIZATION_MARK,
          "/"
        ),
        meanScores,
        csvData,
        config,
      };
    })
  );

  allData.sort((a, b) => b.meanScores.llm - a.meanScores.llm);

  let html = `<html>
<head>
  <title>Risultati della valutazione per "${input}"</title>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="stylesheet" href="https://unpkg.com/tippy.js@6/dist/tippy.css"/>
  <link rel="icon" type="image/x-icon" href="../../data/fl-logo.webp"/>
  <script src="https://unpkg.com/@popperjs/core@2"></script>
  <script src="https://unpkg.com/tippy.js@6"></script>
  <style>
    .tippy-box[data-theme~='fg']{
      background-color:#1f2937; /* Darker gray */
      color:white;
      border-radius:0.5rem;
      box-shadow:0 10px 15px -3px rgba(0,0,0,0.1),0 4px 6px -2px rgba(0,0,0,0.05);
    }
    .tippy-box[data-theme~='fg'] .tippy-content{
      padding:10px 12px;
      font-size:0.875rem;
      line-height:1.25rem;
      max-width: 450px;
      max-height:70vh;
      overflow:auto;
    }
  </style>
</head>
<body class="p-6 bg-gray-50">
<h1 class="text-3xl flex items-center gap-2 font-bold mb-6"><span>Risultati della valutazione per</span><code 
class="bg-gray-200 font-light mt-1.5 text-xl rounded-full px-3 py-0.5">${input}</code></h1>`;

  html += `<h2 class="text-xl font-semibold mb-3">Score medi</h2>`;
  html += `<table class="table-fixed border-collapse border border-gray-300 w-full mb-8 text-sm">
  <thead><tr class="bg-gray-200">
    <th class="border border-gray-300 px-3 py-2 w-1/5">File</th>
    <th class="border border-gray-300 px-3 py-2">LLM</th>
    <th class="border border-gray-300 px-3 py-2">Meteor</th>
    <th class="border border-gray-300 px-3 py-2">Rouge</th>
  </tr></thead><tbody>`;

  for (const { filePath, displayName, meanScores, config } of allData) {
    const tooltip = escapeAttrQuotesOnly(buildRagConfigTooltipHTML(filePath, config));
    html += `<tr>
      <td class="border border-gray-300 px-3 py-2 whitespace-nowrap overflow-hidden text-ellipsis">
        <span class="cursor-help underline decoration-dotted" data-tippy-content="${tooltip}">
          ${escapeText(displayName)}
        </span>
      </td>
      ${Object.values(meanScores)
        .map((v) => {
          const bg = getHeatmapColor(v);
          const fg = getTextColor(v);
          return `<td class="border border-gray-300 px-3 py-2 text-center font-mono" style="background:${bg};color:${fg}">${v.toFixed(
            3
          )}</td>`;
        })
        .join("")}
    </tr>`;
  }
  html += `</tbody></table>`;

  html += `<h2 class="text-xl font-semibold mb-3">LLM scores per test</h2>`;
  const firstCsv = allData[0].csvData;
  html += `<table class="table-fixed border-collapse border border-gray-300 w-full text-sm">
    <thead><tr class="bg-gray-200">
      <th class="border border-gray-300 px-3 py-2 w-1/5">File</th>`;
  for (let i = 0; i < firstCsv.length; i++) {
    const { query, reference } = firstCsv[i];
    const tip = escapeAttrQuotesOnly(buildQueryRefTooltipHTML(query, reference));
    html += `<th class="border border-gray-300 px-3 py-2"><span class="cursor-help underline decoration-dotted" data-tippy-content="${tip}">#${i + 1}</span></th>`;
  }
  html += `</tr></thead><tbody>`;

  for (const { filePath, displayName, csvData, config } of allData) {
    const tooltip = escapeAttrQuotesOnly(buildRagConfigTooltipHTML(filePath, config));
    html += `<tr>
      <td class="border border-gray-300 px-3 py-2 whitespace-nowrap overflow-hidden text-ellipsis">
        <span class="cursor-help underline decoration-dotted" data-tippy-content="${tooltip}">
          ${escapeText(displayName)}
        </span>
      </td>`;
    for (const row of csvData) {
      const score = parseFloat(row.llm);
      const bg = getHeatmapColor(score);
      const fg = getTextColor(score);
      const tip = escapeAttrQuotesOnly(buildCandidateTooltipHTML(row.candidate));
      html += `<td class="border border-gray-300 px-3 py-2 text-center font-mono" style="background:${bg};color:${fg}">
        <span class="cursor-help" data-tippy-content="${tip}">${score.toFixed(3)}</span>
      </td>`;
    }
    html += `</tr>`;
  }

  html += `</tbody></table>
<script>
document.addEventListener('DOMContentLoaded', function(){
  tippy('[data-tippy-content]', {
    theme: 'fg',
    allowHTML: true,
    interactive: true,
    maxWidth: 450,
    delay: [100, 50],
    appendTo: () => document.body,
    arrow: true,
    placement: 'auto',
  });
});
</script>
</body></html>`;

  const fileName = `${createOutputFolderIfNeeded('output/test_results')}/${normalizedInput}.html`;
  await writeFile(fileName, html);
  console.log("Report written to", fileName);
};

main().catch(console.error).then(() => process.exit(0));