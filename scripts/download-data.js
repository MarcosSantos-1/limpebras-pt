const https = require("https");
const fs = require("fs");
const path = require("path");

// URLs dos arquivos LFS no GitHub
const GITHUB_REPO = "MarcosSantos-1/limpebras-pt";
const BRANCH = "master";
const LFS_FILES = [
  {
    name: "features.json",
    lfsPath: "data/features.json",
    localPath: path.join(process.cwd(), "data", "features.json"),
  },
  {
    name: "addressIndex.json",
    lfsPath: "data/addressIndex.json",
    localPath: path.join(process.cwd(), "data", "addressIndex.json"),
  },
];

async function downloadFile(url, filepath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(filepath);
    https
      .get(url, (response) => {
        if (response.statusCode === 302 || response.statusCode === 301) {
          // Segue redirect
          return downloadFile(response.headers.location, filepath).then(resolve).catch(reject);
        }
        if (response.statusCode !== 200) {
          file.close();
          fs.unlinkSync(filepath);
          reject(new Error(`Failed to download: ${response.statusCode}`));
          return;
        }
        response.pipe(file);
        file.on("finish", () => {
          file.close();
          resolve();
        });
      })
      .on("error", (err) => {
        file.close();
        if (fs.existsSync(filepath)) {
          fs.unlinkSync(filepath);
        }
        reject(err);
      });
  });
}

async function getLFSDownloadUrl(file) {
  // Usa a API do GitHub para obter a URL de download do arquivo LFS
  const apiUrl = `https://api.github.com/repos/${GITHUB_REPO}/contents/${file.lfsPath}?ref=${BRANCH}`;
  
  return new Promise((resolve, reject) => {
    https.get(apiUrl, {
      headers: {
        'User-Agent': 'Node.js',
        'Accept': 'application/vnd.github.v3.raw'
      }
    }, (response) => {
      let data = '';
      response.on('data', (chunk) => { data += chunk; });
      response.on('end', () => {
        try {
          const json = JSON.parse(data);
          // Se o arquivo é LFS, o download_url aponta para o arquivo LFS
          resolve(json.download_url || json.git_lfs?.href);
        } catch (error) {
          reject(error);
        }
      });
    }).on('error', reject);
  });
}

async function downloadLFSFile(file) {
  console.log(`Baixando ${file.name}...`);
  
  try {
    // Cria diretório se não existir
    const dir = path.dirname(file.localPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Verifica se arquivo já existe
    if (fs.existsSync(file.localPath)) {
      console.log(`${file.name} já existe, pulando...`);
      return;
    }

    // Tenta várias URLs possíveis
    const urls = [
      `https://github.com/${GITHUB_REPO}/raw/${BRANCH}/${file.lfsPath}`,
      `https://raw.githubusercontent.com/${GITHUB_REPO}/${BRANCH}/${file.lfsPath}`,
    ];

    // Tenta obter URL via API
    try {
      const apiUrl = await getLFSDownloadUrl(file);
      if (apiUrl) {
        urls.unshift(apiUrl);
      }
    } catch (error) {
      console.warn(`Não foi possível obter URL via API, usando URLs diretas`);
    }

    // Tenta baixar de cada URL
    let lastError = null;
    for (const url of urls) {
      try {
        await downloadFile(url, file.localPath);
        console.log(`✓ ${file.name} baixado com sucesso de ${url}`);
        return;
      } catch (error) {
        lastError = error;
        continue;
      }
    }

    throw lastError || new Error('Todas as URLs falharam');
  } catch (error) {
    console.warn(`⚠ Não foi possível baixar ${file.name}:`, error.message);
    // Não falha o build se não conseguir baixar - o app funcionará sem os dados
  }
}

async function main() {
  console.log("Baixando arquivos de dados...");
  
  // Baixa todos os arquivos em paralelo
  await Promise.all(LFS_FILES.map(downloadLFSFile));
  
  console.log("Download concluído!");
}

main().catch((error) => {
  console.error("Erro ao baixar arquivos:", error);
  process.exit(1);
});

