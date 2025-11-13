const https = require("https");
const fs = require("fs");
const path = require("path");

// URLs dos arquivos - pode ser configurado via variável de ambiente
const GITHUB_REPO = process.env.GITHUB_REPO || "MarcosSantos-1/limpebras-pt";
const BRANCH = process.env.GITHUB_BRANCH || "master";
const DATA_URL_PREFIX = process.env.DATA_URL_PREFIX; // Se configurado, usa URLs externas

const LFS_FILES = [
  {
    name: "features.json",
    lfsPath: "data/features.json",
    localPath: path.join(process.cwd(), "data", "features.json"),
    externalUrl: process.env.FEATURES_JSON_URL, // URL externa se disponível
  },
  {
    name: "addressIndex.json",
    lfsPath: "data/addressIndex.json",
    localPath: path.join(process.cwd(), "data", "addressIndex.json"),
    externalUrl: process.env.ADDRESS_INDEX_URL, // URL externa se disponível
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
      const stats = fs.statSync(file.localPath);
      if (stats.size > 1000) { // Arquivo parece válido (> 1KB)
        console.log(`${file.name} já existe (${(stats.size / 1024 / 1024).toFixed(2)} MB), pulando...`);
        return;
      }
    }

    // Prioriza URL externa se configurada
    const urls = [];
    if (file.externalUrl) {
      urls.push(file.externalUrl);
    }
    if (DATA_URL_PREFIX) {
      urls.push(`${DATA_URL_PREFIX}/${file.name}`);
    }
    
    // Firebase Storage URLs (se configurado)
    const firebaseBucket = process.env.FIREBASE_STORAGE_BUCKET || "limpebras-pt.firebasestorage.app";
    urls.push(`https://storage.googleapis.com/${firebaseBucket}/${file.lfsPath}`);
    urls.push(`https://firebasestorage.googleapis.com/v0/b/${firebaseBucket}/o/${encodeURIComponent(file.lfsPath)}?alt=media`);
    
    // URLs do GitHub (podem não funcionar para LFS)
    urls.push(
      `https://raw.githubusercontent.com/${GITHUB_REPO}/${BRANCH}/${file.lfsPath}`,
      `https://github.com/${GITHUB_REPO}/raw/${BRANCH}/${file.lfsPath}`
    );

    // Tenta baixar de cada URL
    let lastError = null;
    for (const url of urls) {
      try {
        console.log(`Tentando baixar de: ${url.substring(0, 80)}...`);
        await downloadFile(url, file.localPath);
        
        // Verifica se o arquivo foi baixado corretamente
        const stats = fs.statSync(file.localPath);
        if (stats.size < 100) {
          // Arquivo muito pequeno, provavelmente é um erro HTML
          fs.unlinkSync(file.localPath);
          throw new Error('Arquivo muito pequeno, provavelmente erro');
        }
        
        console.log(`✓ ${file.name} baixado com sucesso (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);
        return;
      } catch (error) {
        lastError = error;
        if (fs.existsSync(file.localPath)) {
          fs.unlinkSync(file.localPath);
        }
        continue;
      }
    }

    throw lastError || new Error('Todas as URLs falharam');
  } catch (error) {
    console.warn(`⚠ Não foi possível baixar ${file.name}:`, error.message);
    console.warn(`  O app funcionará sem este arquivo. Para adicionar os dados:`);
    console.warn(`  1. Faça upload dos arquivos para um storage externo (S3, etc)`);
    console.warn(`  2. Configure as variáveis de ambiente na Vercel:`);
    console.warn(`     - FEATURES_JSON_URL`);
    console.warn(`     - ADDRESS_INDEX_URL`);
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

