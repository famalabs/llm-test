import { escapeText, escapeAttrQuotesOnly, createOutputFolderIfNeeded, parseCSV, PATH_NORMALIZATION_MARK } from "../utils";
import { resolveCitations, Chunk, Citation } from "../lib/chunks";
import { readdir, readFile, writeFile } from "fs/promises";
import { hideBin } from "yargs/helpers";
import yargs from "yargs";
import path from "path";

type JSONResult = {
  question?: string;
  keyRef?: string;
  fullRef?: string;
  candidate?: string;
  timeMs?: number;
  citations?: Citation[];
  chunks?: Chunk[];
};

const fmtMilliseconds = (ms: number): string => {
  const minutes = Math.floor(ms / 60000);
  ms %= 60000;

  const seconds = Math.floor(ms / 1000);
  ms %= 1000;

  const parts: string[] = [];
  if (minutes > 0) parts.push(`${minutes}m`);
  if (seconds > 0) parts.push(`${seconds}s`);
  if (ms > 0) parts.push(`${ms.toFixed(0)}ms`);

  return parts.join(" ") || "0ms";
};


export const getHeatmapColor = (value: number) => {
  const v = Math.max(0, Math.min(1, value));
  const r = Math.round(255 * (1 - v));
  const g = Math.round(255 * v);
  return `rgb(${r},${g},0)`;
};

export const getTextColor = (value: number) => {
  const v = Math.max(0, Math.min(1, value));
  const r = 255 * (1 - v),
    g = 255 * v,
    b = 0;
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 140 ? "#111827" : "#FFFFFF";
};

const titleize = (s: string) =>
  s
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/^./, (c) => c.toUpperCase());

const normalizeConfigShape = (parsed: any): { rag: Record<string, any>; docStore: Record<string, any> } => {
  return {
    rag: parsed?.ragConfig ?? {},
    docStore: parsed?.docStoreConfig ?? {}
  };
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
    return escapeText(String(value));
  };

  const renderConfigObject = (obj: Record<string, any>): string =>
    Object.entries(obj ?? {})
      .map(
        ([key, value]) => `
        <div class="flex justify-between items-start space-x-4 py-1">
          <span class="text-gray-400 whitespace-nowrap">${escapeText(titleize(key))}:</span>
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
      <div class="font-semibold text-sm mb-1 text-gray-200">${escapeText(titleize(sectionTitle))}</div>
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
      <div class="text-sm leading-snug">${escapeText(query ?? "")}</div>
    </div>
    ${keyRef
    ? `<div>
             <div class="font-semibold text-sm mb-1">Key reference</div>
             <div class="text-sm leading-snug whitespace-pre-wrap">${escapeText(keyRef)}</div>
           </div>`
    : ""
  }
    ${fullRef
    ? `<div>
             <div class="font-semibold text-sm mb-1">Full reference</div>
             <div class="text-sm leading-snug whitespace-pre-wrap">${escapeText(fullRef)}</div>
           </div>`
    : ""
  }
  </div>`;

const encodeForDataAttr = (s: string) => encodeURIComponent(s);

const buildCandidateTooltipHTML = (
  candidate: string,
  items: Array<{ sourceName: string; spanLabel: string; resolvedEncoded: string }>,
  explanation?: string,
  timeMs?: number | string
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




  const exp =
    explanation && explanation.trim().length > 0
      ? `<div class="mt-3">
          <div class="font-semibold text-sm mb-1">LLM explanation</div>
          <div class="text-xs leading-snug whitespace-pre-wrap">${escapeText(explanation)}</div>
        </div>`
      : "";
  const timeHtml = (timeMs && String(timeMs).trim().length > 0)
    ? `<div class="mt-3">
          <div class="font-semibold text-sm mb-1">Time</div>
          <div class="text-sm leading-snug">${fmtMilliseconds(Number(timeMs))}</div>
        </div>`
    : "";

  return `
  <div class="space-y-3">
    <div>
      <div class="font-semibold text-sm mb-1">Candidate</div>
      <div class="text-sm leading-snug whitespace-pre-wrap">${escapeText(candidate ?? "")}</div>
    </div>
    ${timeHtml}
    <div>
      <div class="font-semibold text-sm mb-1">Citations</div>
      ${list}
    </div>
    ${exp}
  </div>`;
};

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
  const allScoreFiles = (await readdir(scoresDir)).filter((f) => f.split("_")[0] === normalizedInput);

  if (allScoreFiles.length == 0) {
    console.warn(`⚠️ Nessun file di score trovato per "${normalizedInput}" in ${scoresDir}`);
  }

  const allData = await Promise.all(
    allScoreFiles.map(async (file) => {
      const csvRaw = await readFile(path.join(scoresDir, file), "utf-8");
      const [meanScoresText, ...csvLines] = csvRaw.split("\n");

      let meanScores: Record<string, number> = {};
      if (meanScoresText?.includes(",")) {
        const parts = meanScoresText.split(",").map(p => p.trim());
        for (let i = 0; i < parts.length; i += 2) {
          const k = parts[i];
          const v = parts[i + 1];
          if (k && v !== undefined) {
            const num = parseFloat(v);
            meanScores[k] = isFinite(num) ? num : NaN;
          }
        }
      } else {
        // fallback
        meanScores = { llm: NaN };
      }

      const jsonPath = path.join("output", "candidates", file.replace(".csv", ".json"));
      let config: any = {};
      let results: JSONResult[] | undefined = undefined;
      try {
        const parsed = JSON.parse(await readFile(jsonPath, "utf-8"));
        const normalized = normalizeConfigShape(parsed);
        config = normalized; // { rag: {...}, docStore: {...} }
        results = parsed?.results ?? undefined;
      } catch {
        console.warn(`⚠️ Nessuna config/results trovata per ${file}`);
      }

      const csvFile = csvLines.join("\n");
      const csvData = await parseCSV(csvFile);
      return {
        filePath: file.replace(".csv", ""),
        displayName: file.replace(".csv", ""),
        meanScores,
        csvData,
        config,
        results,
      };
    })
  );

  allData.sort((a, b) => {
    const av = typeof a.meanScores.llm === 'number' ? a.meanScores.llm : Number.NEGATIVE_INFINITY;
    const bv = typeof b.meanScores.llm === 'number' ? b.meanScores.llm : Number.NEGATIVE_INFINITY;
    return (isNaN(bv) ? -Infinity : bv) - (isNaN(av) ? -Infinity : av);
  });

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
    code.badge {
      font-size: 0.70rem;
      background: #e5e7eb;
      padding: 2px 6px;
      border-radius: 9999px;
      margin-left: 6px;
    }
  </style>
</head>
<body class="p-6 bg-gray-50">
<h1 class="text-3xl flex items-center gap-2 font-bold mb-6"><span>Risultati della valutazione per</span><code 
class="bg-gray-200 font-light mt-1.5 text-xl rounded-full px-3 py-0.5">${escapeText(input)}</code></h1>`;

  // Tabella score medi
  html += `<h2 class="text-xl font-semibold mb-3">Score medi</h2>`;
  html += `<table class="table-fixed border-collapse border border-gray-300 w-full mb-8 text-sm">
  <thead><tr class="bg-gray-200">
    <th class="border border-gray-300 px-3 py-2 w-1/5">File</th>
    <th class="border border-gray-300 px-3 py-2">LLM</th>
    <th class="border border-gray-300 px-3 py-2">Mean Time</th>
  </tr></thead><tbody>`;

  for (const { filePath, displayName, meanScores, config } of allData) {
    const tooltip = escapeAttrQuotesOnly(buildRagConfigTooltipHTML(filePath, config));
    const llmVal = typeof meanScores.llm == 'number' ? meanScores.llm : NaN;
    const timeVal = typeof meanScores.time_ms == 'number' ? meanScores.time_ms : NaN;
    const llmBg = isFinite(llmVal) ? getHeatmapColor(llmVal) : "#f3f4f6";
    const llmFg = isFinite(llmVal) ? getTextColor(llmVal) : "#111827";
    const llmContent = isFinite(llmVal) ? llmVal.toFixed(3) : "-";
    const timeContent = isFinite(timeVal) ? fmtMilliseconds(timeVal) : "-";

    html += `<tr>
      <td class="border border-gray-300 px-3 py-2 whitespace-nowrap overflow-hidden text-ellipsis">
        <span class="cursor-help underline decoration-dotted" data-tippy-content="${tooltip}">
          ${escapeText(displayName)}
        </span>
      </td>
      <td class="border border-gray-300 px-3 py-2 text-center font-mono" style="background:${llmBg};color:${llmFg}">${llmContent}</td>
      <td class="border border-gray-300 px-3 py-2 text-center font-mono">${escapeText(timeContent)}</td>
    </tr>`;
  }
  html += `</tbody></table>`;

  // Per-test
  html += `<h2 class="text-xl font-semibold mb-3">LLM scores per test</h2>`;

  if (allData.length === 0) {
    html += `<p class="text-sm text-gray-600">Nessun dato disponibile.</p>`;
  } else {
    const firstCsv = allData[0].csvData ?? [];
    html += `<table class="table-fixed border-collapse border border-gray-300 w-full text-sm">
      <thead><tr class="bg-gray-200">
        <th class="border border-gray-300 px-3 py-2 w-1/5">File</th>`;
    for (let i = 0; i < firstCsv.length; i++) {
      const row: any = firstCsv[i] ?? {};
      const query = row.query ?? "";
      const keyRef = row.keyref ?? row.keyRef ?? "";
      const fullRef = row.fullref ?? row.fullRef ?? "";
      const tip = escapeAttrQuotesOnly(buildQueryRefsTooltipHTML(query, keyRef, fullRef));
      html += `<th class="border border-gray-300 px-3 py-2"><span class="cursor-help underline decoration-dotted" data-tippy-content="${tip}">#${i + 1}</span></th>`;
    }
    html += `</tr></thead><tbody>`;

    for (const { filePath, displayName, csvData, config, results } of allData) {
      const cfgTip = escapeAttrQuotesOnly(buildRagConfigTooltipHTML(filePath, config));
      const dsName = config?.docStore?.indexName ? `<code class="badge" title="Doc Store indexName">${escapeText(config.docStore.indexName)}</code>` : "";
      html += `<tr>
        <td class="border border-gray-300 px-3 py-2 whitespace-nowrap overflow-hidden text-ellipsis">
          <span class="cursor-help underline decoration-dotted" data-tippy-content="${cfgTip}">
            ${escapeText(displayName)}${dsName}
          </span>
        </td>`;

      for (let i = 0; i < (csvData?.length ?? 0); i++) {
        const row: any = csvData[i] ?? {};
        // ⬇️ allineato al nuovo schema: llm_score e llm_explanation
        const score = parseFloat(row.llm_score ?? row.llm ?? "NaN");
        const explanation = row.llm_explanation ?? "";

        const bg = isFinite(score) ? getHeatmapColor(score) : "#f3f4f6";
        const fg = isFinite(score) ? getTextColor(score) : "#111827";

        const res: JSONResult | undefined = results?.[i];
        const citations = res?.citations ?? [];
        const chunks = res?.chunks ?? [];

        // Preparo i badge citazioni
        const items = await Promise.all(
          (citations ?? []).map(async (c) => {
            const chunk = chunks?.[c.chunkIndex as number];
            const srcFull = chunk?.source ?? "sorgente-sconosciuta";
            const sourceName = path.basename(srcFull);
            const spanLabel = `Citazione`;
            const resolvedEncoded = await buildResolvedCitationEncoded(c, chunks);
            return { sourceName, spanLabel, resolvedEncoded };
          })
        );

        const candidateText = row.candidate ?? res?.candidate ?? "";
        const timeFromRow = row.timeMs;
        const timeVal = timeFromRow != undefined ? (isNaN(Number(timeFromRow)) ? timeFromRow : Number(timeFromRow)) : (res?.timeMs ?? undefined);
        const cellTip = escapeAttrQuotesOnly(buildCandidateTooltipHTML(candidateText, items, explanation, timeVal));

        html += `<td class="border border-gray-300 px-3 py-2 text-center font-mono" style="background:${bg};color:${fg}">
          <span class="cursor-help" data-tippy-content="${cellTip}">${isFinite(score) ? score.toFixed(3) : "-"}</span>
        </td>`;
      }
      html += `</tr>`;
    }

    html += `</tbody></table>`;
  }

  html += `
<script>
document.addEventListener('DOMContentLoaded', function(){

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
