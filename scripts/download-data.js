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

async function downloadLFSFile(file) {
  // Tenta baixar do GitHub LFS diretamente
  const lfsUrl = `https://github.com/${GITHUB_REPO}/raw/${BRANCH}/${file.lfsPath}`;
  
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

    await downloadFile(lfsUrl, file.localPath);
    console.log(`✓ ${file.name} baixado com sucesso`);
  } catch (error) {
    console.warn(`⚠ Não foi possível baixar ${file.name}:`, error.message);
    // Não falha o build se não conseguir baixar
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

