/**

LEMMATIZATION:
 -  (*) create a venv named .venv in llm-test/ and install spacy
 -  python -m spacy download it_core_news_lg

SCRIPT:

 - Qwen 8B (set the HUGGINGFACEHUB_API_KEY in .env)
 npx tsx src/scripts/visual-embeddings-comparison.ts -i data/embeddings-comparison.json -p huggingface -m Qwen/Qwen3-Embedding-8B -l true

 - Qwen 0.6B, then, take the previously created .venv (*), and install sentence_transformers. Check the code in custom-embedders/local.ts, then run:
 npx tsx src/scripts/visual-embeddings-comparison.ts -i data/embeddings-comparison.json -p local -m Qwen/Qwen3-Embedding-0.6B -l true

 - Google (⚠ the documentation report a wrong model name - also, set GOOGLE_GENERATIVE_AI_API_KEY in .env)
 npx tsx src/scripts/visual-embeddings-comparison.ts -i data/embeddings-comparison.json -p google -m gemini-embedding-001 -l true

*/

import 'dotenv/config';
import { createOutputFolderIfNeeded, escapeText, sleep, checkCallFromRoot, lemmatize } from "../utils";
import path from 'path';
import { readFile, writeFile } from "fs/promises";
import { createEmbedder } from "../lib/embeddings";
import { hideBin } from "yargs/helpers";
import { cosineSimilarity } from "ai";
import yargs from "yargs";

const main = async () => {
  const { input, tooltip, provider, model, lemmatization } = await yargs(hideBin(process.argv))
    .option("input", {
      alias: "i",
      type: "string",
      demandOption: true,
      describe: "Path to the JSON input file",
    })
    .option("tooltip", {
      alias: "t",
      type: "boolean",
      default: false,
      describe: "If true, show Q<n> with tooltips, otherwise show full queries directly",
    })
    .option("provider", {
      alias: "p",
      type: "string",
      demandOption: true,
      choices: ["mistral", "openai", "voyage", "local", "huggingface", "google"],
      describe: "Provider to use for embeddings",
    })
    .option("model", {
      alias: "m",
      type: "string",
      demandOption: true,
      describe: "Model to use for embeddings",
    })
    .option("lemmatization", {
      alias: "l",
      type: "boolean",
      demandOption: true,
      describe: "If true, lemmatize queries before embedding",
    })
    .parse();

  if (lemmatization) {
    checkCallFromRoot();
    console.log('Lemmatization is enabled. Make sure you created a venv named .venv in llm-test/ and you installed spacy and ran python -m spacy download it_core_news_lg');
  }

  const embedder = createEmbedder(model, provider as "mistral" | "openai");
  const embeddingsCache: Record<string, number[]> = {};
  const lemmatizationCache: Record<string, string> = {};

  const inputData = JSON.parse(await readFile(input, "utf-8"));

  const matrices: Record<string, number[][]> = {};
  const groupQueries: Record<string, string[]> = {};

  // ------ aggiunto questo -----
  const uniqueQueries: string[] = Object.values(inputData).flat() as string[];
  const processedUniqueQueries = lemmatization ? await lemmatize(uniqueQueries) : uniqueQueries;

  const embeddings = await embedder.embedDocuments(processedUniqueQueries);
  
  for (let i = 0; i < uniqueQueries.length; i++) {
    const q = uniqueQueries[i];
    embeddingsCache[q] = embeddings[i];
    lemmatizationCache[q] = processedUniqueQueries[i];
  }

  for (const group in inputData) {
    const queries: string[] = inputData[group];
    groupQueries[group] = queries.map(q => lemmatization ? lemmatizationCache[q] : q);
    const embeddings: number[][] = queries.map(q => embeddingsCache[q]);
    
    const matrix: number[][] = [];

    for (let i = 0; i < embeddings.length; i++) {
      const row: number[] = [];
      for (let j = 0; j < embeddings.length; j++) {
        if (i == j) {
          row.push(1);
        } else {
          const sim = cosineSimilarity(embeddings[i], embeddings[j]);
          const normalizedSim = (sim + 1) / 2;
          row.push(normalizedSim);
        }
      }
      matrix.push(row);
    }
    matrices[group] = matrix;
  }

  let html = `<html>
<head>
  <title>Matrici di similarità</title>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="stylesheet" href="https://unpkg.com/tippy.js@6/dist/tippy.css"/>
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
      max-width: 450px;
      max-height:70vh;
      overflow:auto;
    }
  </style>
</head>
<body class="p-6 bg-gray-50">
<div class="flex justify-between items-center mb-6 sticky top-0 bg-gray-50">
  <h1 class="text-3xl font-bold">Matrici di similarità</h1>
  <div class="flex items-center space-x-4">
    <div id="hitsContainer" class="text-sm font-medium px-3 py-1 rounded bg-gray-200">
      Hits: <span id="hitsCount">0</span>
    </div>
    <div class="flex items-center space-x-2">
      <label for="minSim" class="text-sm font-medium">Min Similarity:</label>
      <input id="minSimRange" type="range" min="0" max="1" step="0.01" value="0" class="w-40">
      <input id="minSim" type="number" step="0.01" class="w-20 border border-gray-300 rounded px-2 py-1 text-sm font-mono" value="0.00">
    </div>
    <div class="flex items-center space-x-1">
      <input type="checkbox" id="useAsThreshold" class="w-4 h-4">
      <label for="useAsThreshold" class="text-sm font-medium">Usa solo come soglia</label>
    </div>
    <div class="flex items-center space-x-1">
      <input type="checkbox" id="remapValues" class="w-4 h-4">
      <label for="remapValues" class="text-sm font-medium">Rimappa valori celle</label>
    </div>
  </div>
</div>`;

  for (const group in matrices) {
    const matrix = matrices[group];
    const queries = groupQueries[group];

    html += `<h2 class="text-xl font-semibold mb-3">${escapeText(group)}</h2>`;
    html += `<table class="table-fixed border-collapse border border-gray-300 mb-8"> 
      <thead><tr class="bg-gray-200"><th class="border border-gray-300 px-2 py-1">#</th>`;

    for (let j = 0; j < queries.length; j++) {
      if (tooltip) {
        html += `<th class="border bg-white border-gray-300 font-light p-3 cursor-help underline decoration-dotted" data-tippy-content="${escapeText(
          queries[j]
        )}">Q${j + 1}</th>`;
      } else {
        html += `<th class="border border-gray-300 bg-white font-light p-3">${escapeText(
          queries[j]
        )}</th>`;
      }
    }
    html += `</tr></thead><tbody>`;

    for (let i = 0; i < matrix.length; i++) {
      html += `<tr>`;
      if (tooltip) {
        html += `<td class="border border-gray-300 p-3 cursor-help underline decoration-dotted" data-tippy-content="${escapeText(
          queries[i]
        )}">Q${i + 1}</td>`;
      } else {
        html += `<td class="border border-gray-300 p-3">${escapeText(
          queries[i]
        )}</td>`;
      }

      for (let j = 0; j < matrix[i].length; j++) {
        const v = matrix[i][j];
        html += `<td class="border border-gray-300 p-3 text-center font-mono heatmap-cell" data-value="${v}" data-diagonal="${i === j}" data-i="${i}" data-j="${j}">${v.toFixed(
          3
        )}</td>`;
      }
      html += `</tr>`;
    }

    html += `</tbody></table>`;
  }

  html += `
<script>
function getHeatmapColor(value, minSim, useAsThreshold) {
  if (value < minSim) return "rgb(229,231,235)";
  let norm = value;
  if (!useAsThreshold) {
    norm = (value - minSim) / (1 - minSim);
  }
  const r = Math.round(255 * (1 - norm));
  const g = Math.round(255 * norm);
  return \`rgb(\${r},\${g},0)\`;
}
function getTextColor(value, minSim) {
  if (value < minSim) return "#000";
  return value > 0.5 ? "#000" : "#fff";
}
function updateColors() {
  const minSim = parseFloat(document.getElementById("minSim").value);
  const useAsThreshold = document.getElementById("useAsThreshold").checked;
  const remapValues = document.getElementById("remapValues").checked;
  let aboveThresholdCount = 0;
  document.querySelectorAll(".heatmap-cell").forEach(cell => {
    let value = parseFloat(cell.dataset.value);
    const isDiagonal = cell.dataset.diagonal === "true";
    if (remapValues) {
      if (value < minSim) {
        cell.innerText = "-";
      } else {
        cell.innerText = ((value - minSim) / (1 - minSim)).toFixed(3);
      }
    } else {
      cell.innerText = value.toFixed(3);
    }
    cell.style.backgroundColor = getHeatmapColor(value, minSim, useAsThreshold);
    cell.style.color = getTextColor(value, minSim);

    // Count hits: value strictly greater than threshold, excluding diagonal
    if (!isDiagonal && value > minSim) {
      aboveThresholdCount += 1;
    }
  });

  // Divide by two to account for symmetric duplicates (i,j) and (j,i)
  const uniquePairs = Math.floor(aboveThresholdCount / 2);
  const hitsEl = document.getElementById("hitsCount");
  if (hitsEl) hitsEl.textContent = String(uniquePairs);
}

// sincronizza slider e input
document.getElementById("minSimRange").addEventListener("input", (e) => {
  document.getElementById("minSim").value = e.target.value;
  updateColors();
});
document.getElementById("minSim").addEventListener("input", (e) => {
  document.getElementById("minSimRange").value = e.target.value;
  updateColors();
});

document.getElementById("useAsThreshold").addEventListener("change", updateColors);
document.getElementById("remapValues").addEventListener("change", updateColors);

document.addEventListener("DOMContentLoaded", updateColors);
</script>`;

  if (tooltip) {
    html += `<script>
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
</script>`;
  }

  html += `</body></html>`;

  const baseName = input.split(/[/\\]/).slice(-1)[0].split('.').slice(0,-1).join('.')
  const outputDir = createOutputFolderIfNeeded('output','embeddings-comparison');
  const outputFile = path.join(
    outputDir,
    `${baseName}-${model.replace('/', '-')}-${provider}-lemmatization=${lemmatization.toString()}-similarity-matrix.html`
  );
  await writeFile(outputFile, html);
  console.log("Output written to", outputFile);
};

main().catch(console.error).then(() => process.exit(0));
