import { escapeText, escapeAttrQuotesOnly, getHeatmapColor, getTextColor } from "../utils";
import { createOutputFolderIfNeeded, parseCSV } from "../utils";
import { readdir, readFile, writeFile } from "fs/promises";
import { PATH_NORMALIZATION_MARK } from "../lib/nlp";
import { hideBin } from "yargs/helpers";
import yargs from "yargs";
import path from "path";

import { resolveCitations, type Chunk, type Citation } from "../lib/chunks";

type JSONResult = {
  question?: string;
  keyRef?: string;
  fullRef?: string;
  candidate?: string;
  citations?: Citation[];
  chunks?: Chunk[];
};

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

  const renderConfigObject = (obj: Record<string, any>): string =>
    Object.entries(obj)
      .map(
        ([key, value]) => `
        <div class="flex justify-between items-start space-x-4 py-1">
          <span class="text-gray-400 whitespace-nowrap">${escapeText(key)}:</span>
          <span class="font-mono text-right">${renderValue(value)}</span>
        </div>
      `
      )
      .join("");

  const topLevelPrimitives = Object.fromEntries(
    Object.entries(config ?? {}).filter(([, v]) => typeof v !== "object" || v === null)
  );
  const topLevelObjects = Object.fromEntries(
    Object.entries(config ?? {}).filter(([, v]) => typeof v === "object" && v !== null)
  );

  let html = `<div class="space-y-3 text-white">
    <div class="text-xs text-gray-400 break-all"><b>File:</b> ${escapeText(filePath)}</div>
    <div class="border-t border-gray-700"></div>`;

  if (Object.keys(topLevelPrimitives).length > 0) {
    html += `<div class="bg-gray-700 p-2 rounded-md">
       <div class="font-semibold text-sm mb-1 text-gray-200">General</div>
       <div class="text-xs">${renderConfigObject(topLevelPrimitives)}</div>
     </div>`;
  }

  for (const [sectionTitle, sectionObject] of Object.entries(topLevelObjects)) {
    html += `<div class="bg-gray-700 p-2 rounded-md">
      <div class="font-semibold text-sm mb-1 text-gray-200 capitalize">${escapeText(sectionTitle)}</div>
      <div class="text-xs">${renderConfigObject(sectionObject as Record<string, any>)}</div>
    </div>`;
  }

  html += "</div>";
  return html;
};

const buildQueryRefsTooltipHTML = (query: string, keyRef?: string, fullRef?: string) => `
  <div class="space-y-3">
    <div>
      <div class="font-semibold text-sm mb-1">Query</div>
      <div class="text-sm leading-snug">${escapeText(query)}</div>
    </div>
    ${
      keyRef
        ? `<div>
             <div class="font-semibold text-sm mb-1">Key reference</div>
             <div class="text-sm leading-snug whitespace-pre-wrap">${escapeText(keyRef)}</div>
           </div>`
        : ""
    }
    ${
      fullRef
        ? `<div>
             <div class="font-semibold text-sm mb-1">Full reference</div>
             <div class="text-sm leading-snug whitespace-pre-wrap">${escapeText(fullRef)}</div>
           </div>`
        : ""
    }
  </div>`;

const encodeForDataAttr = (s: string) => encodeURIComponent(s);

// Solo costruzione lista; il testo risolto è salvato URL-encoded in data-resolved-enc.
const buildCandidateTooltipHTML = (
  candidate: string,
  items: Array<{ sourceName: string; spanLabel: string; resolvedEncoded: string }>
) => {
  const list =
    items.length === 0
      ? `<div class="text-xs text-gray-400">Nessuna citazione.</div>`
      : `<ul class="mt-1 space-y-1">
          ${items
            .map(
              (it) => `
            <li class="grid grid-cols-[1fr_auto] items-center gap-3">
              <span class="font-mono truncate">${escapeText(it.sourceName)}</span>
              <button
                type="button"
                class="citation-badge text-xs bg-gray-600 text-white rounded px-1.5 py-0.5 cursor-help whitespace-nowrap"
                data-resolved-enc="${it.resolvedEncoded}"
                aria-label="Apri citazione risolta"
              >${escapeText(it.spanLabel)}</button>
            </li>`
            )
            .join("")}
        </ul>`;

  return `
  <div class="space-y-3">
    <div>
      <div class="font-semibold text-sm mb-1">Candidate</div>
      <div class="text-sm leading-snug whitespace-pre-wrap">${escapeText(candidate)}</div>
    </div>
    <div>
      <div class="font-semibold text-sm mb-1">Citations</div>
      ${list}
    </div>
  </div>`;
};

// Crea HTML per tooltip delle citazioni (pre + monospaced), poi lo codifica.
const buildResolvedCitationEncoded = async (c: Citation, chunks?: Chunk[]): Promise<string> => {
  try {
    const resolved = await resolveCitations([c], chunks ?? []);
    const html = `<pre class="text-xs bg-gray-600 whitespace-pre-wrap leading-snug font-mono">${escapeText(
      resolved
    )}</pre>`;
    return encodeForDataAttr(html);
  } catch (err: any) {
    const fallback = `<div class="text-xs text-red-300">Impossibile risolvere la citazione: ${escapeText(
      String(err?.message ?? "errore sconosciuto")
    )}</div>`;
    return encodeForDataAttr(fallback);
  }
};

const main = async () => {
  const { input } = await yargs(hideBin(process.argv))
    .option("input", {
      alias: "i",
      type: "string",
      demandOption: true,
      description: "Path to evaluation test JSON.",
    })
    .help()
    .parse();

  const normalizedInput = input.replaceAll("/", PATH_NORMALIZATION_MARK);

  const scoresDir = path.join("output", "scores");
  const allFiles = (await readdir(scoresDir)).filter((f) => f.split("_")[0] === normalizedInput);

  const allData = await Promise.all(
    allFiles.map(async (file) => {
      const csvRaw = await readFile(path.join(scoresDir, file), "utf-8");
      const [meanScoresText, ...csvLines] = csvRaw.split("\n");
      const [llm, llmValue] = meanScoresText.split(",");
      const meanScores = {
        [llm.trim()]: parseFloat(llmValue),
      };

      const jsonPath = path.join("output", "candidates", file.replace(".csv", ".json"));
      let config: any = {};
      let results: JSONResult[] | undefined = undefined;
      try {
        const parsed = JSON.parse(await readFile(jsonPath, "utf-8"));
        config = parsed?.config ?? {};
        results = parsed?.results ?? undefined;
      } catch {
        console.warn(`⚠️ Nessuna config/results trovata per ${file}`);
      }

      const csvFile = csvLines.join("\n");
      const csvData = await parseCSV(csvFile);
      return {
        filePath: file.replace(".csv", ""),
        displayName:
          (file.split("_").pop()?.replace(".csv", "") ?? file).replaceAll(
            PATH_NORMALIZATION_MARK,
            "/"
          ),
        meanScores,
        csvData,
        config,
        results,
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
  <link rel="icon" type="image/x-icon" href="../../local/fl-logo.webp"/>
  <script src="https://unpkg.com/@popperjs/core@2"></script>
  <script src="https://unpkg.com/tippy.js@6"></script>
  <style>
    .tippy-box[data-theme~='fg']{
      background-color:#1f2937;
      color:white;
      border-radius:0.5rem;
      box-shadow:0 10px 15px -3px rgba(0,0,0,0.1),0 4px 6px -2px rgba(0,0,0,0.05);
    }
    .tippy-box[data-theme~='fg'] .tippy-content{
      padding:10px 12px;
      font-size:0.875rem;
      line-height:1.25rem;
      max-width: 520px;
      max-height:70vh;
      overflow:auto;
    }
  </style>
</head>
<body class="p-6 bg-gray-50">
<h1 class="text-3xl flex items-center gap-2 font-bold mb-6"><span>Risultati della valutazione per</span><code 
class="bg-gray-200 font-light mt-1.5 text-xl rounded-full px-3 py-0.5">${input}</code></h1>`;

  // Score medi
  html += `<h2 class="text-xl font-semibold mb-3">Score medi</h2>`;
  html += `<table class="table-fixed border-collapse border border-gray-300 w-full mb-8 text-sm">
  <thead><tr class="bg-gray-200">
    <th class="border border-gray-300 px-3 py-2 w-1/5">File</th>
    <th class="border border-gray-300 px-3 py-2">LLM</th>
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

  // Per-test
  html += `<h2 class="text-xl font-semibold mb-3">LLM scores per test</h2>`;
  const firstCsv = allData[0].csvData;
  html += `<table class="table-fixed border-collapse border border-gray-300 w-full text-sm">
    <thead><tr class="bg-gray-200">
      <th class="border border-gray-300 px-3 py-2 w-1/5">File</th>`;
  for (let i = 0; i < firstCsv.length; i++) {
    const row: any = firstCsv[i];
    const query = row.query ?? "";
    const keyRef = row.keyref ?? row.keyRef ?? "";
    const fullRef = row.fullref ?? row.fullRef ?? "";
    const tip = escapeAttrQuotesOnly(buildQueryRefsTooltipHTML(query, keyRef, fullRef));
    html += `<th class="border border-gray-300 px-3 py-2"><span class="cursor-help underline decoration-dotted" data-tippy-content="${tip}">#${i + 1}</span></th>`;
  }
  html += `</tr></thead><tbody>`;

  for (const { filePath, displayName, csvData, config, results } of allData) {
    const cfgTip = escapeAttrQuotesOnly(buildRagConfigTooltipHTML(filePath, config));
    html += `<tr>
      <td class="border border-gray-300 px-3 py-2 whitespace-nowrap overflow-hidden text-ellipsis">
        <span class="cursor-help underline decoration-dotted" data-tippy-content="${cfgTip}">
          ${escapeText(displayName)}
        </span>
      </td>`;

    for (let i = 0; i < csvData.length; i++) {
      const row: any = csvData[i];
      const score = parseFloat(row.llm);
      const bg = getHeatmapColor(score);
      const fg = getTextColor(score);

      const res: JSONResult | undefined = results?.[i];
      const citations = res?.citations ?? [];
      const chunks = res?.chunks ?? [];

      // Preparo i badge: filename + lines (testo risolto codificato)
      const items = await Promise.all(
        (citations ?? []).map(async (c) => {
          const chunk = chunks?.[c.chunkIndex];
          const srcFull = (chunk?.metadata as any)?.source ?? "sorgente-sconosciuta";
          const sourceName = path.basename(srcFull);
          const spanLabel = `Citazione`;
          const resolvedEncoded = await buildResolvedCitationEncoded(c, chunks);
          return { sourceName, spanLabel, resolvedEncoded };
        })
      );

      const candidateText = row.candidate ?? res?.candidate ?? "";
      const cellTip = escapeAttrQuotesOnly(buildCandidateTooltipHTML(candidateText, items));

      html += `<td class="border border-gray-300 px-3 py-2 text-center font-mono" style="background:${bg};color:${fg}">
        <span class="cursor-help" data-tippy-content="${cellTip}">${isFinite(score) ? score.toFixed(3) : "-"}</span>
      </td>`;
    }
    html += `</tr>`;
  }

  html += `</tbody></table>
<script>
document.addEventListener('DOMContentLoaded', function(){
  // Tooltip principali (celle, config, header, ecc.)
  tippy('[data-tippy-content]', {
    theme: 'fg',
    allowHTML: true,
    interactive: true,
    maxWidth: 520,
    delay: [100, 50],
    appendTo: () => document.body,
    arrow: true,
    placement: 'auto',
    zIndex: 9998
  });

  // Tooltip SOLO per i badge delle linee (hover -> mostra citazione risolta)
  tippy.delegate(document.body, {
    target: '.citation-badge',
    theme: 'fg',
    allowHTML: true,
    interactive: true,
    maxWidth: 520,
    delay: [80, 40],
    appendTo: () => document.body,
    arrow: true,
    placement: 'top',
    offset: [0, 8],
    zIndex: 9999,
    content(reference){
      const enc = reference.getAttribute('data-resolved-enc');
      return enc ? decodeURIComponent(enc) : '<div class="text-xs text-gray-400">Nessun testo disponibile</div>';
    },
    // Per usare il click invece dell'hover:
    // trigger: 'click',
  });
});
</script>
</body></html>`;

  const fileName = path.join(
    createOutputFolderIfNeeded("output", "test_results"),
    `${normalizedInput}.html`
  );
  await writeFile(fileName, html);
  console.log("Report written to", fileName);
};

main().catch(console.error).then(() => process.exit(0));
