/**
 * Script para fazer upload dos arquivos de dados para o Firebase Storage
 * 
 * Uso:
 * 1. Configure as variáveis de ambiente:
 *    - FIREBASE_PROJECT_ID
 *    - FIREBASE_STORAGE_BUCKET
 *    - GOOGLE_APPLICATION_CREDENTIALS (caminho para o arquivo de credenciais JSON)
 * 
 * 2. Execute: node scripts/upload-to-firebase.js
 */

const admin = require("firebase-admin");
const fs = require("fs");
const path = require("path");

// Configuração
const FILES_TO_UPLOAD = [
  {
    localPath: path.join(process.cwd(), "data", "features.json"),
    storagePath: "data/features.json",
    contentType: "application/json",
  },
  {
    localPath: path.join(process.cwd(), "data", "addressIndex.json"),
    storagePath: "data/addressIndex.json",
    contentType: "application/json",
  },
];

async function initializeFirebase() {
  // Verifica se já está inicializado
  if (admin.apps.length > 0) {
    return admin.app();
  }

  // Tenta usar credenciais do arquivo
  const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (credentialsPath && fs.existsSync(credentialsPath)) {
    const serviceAccount = require(credentialsPath);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
    });
  } else {
    // Tenta usar variáveis de ambiente
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const storageBucket = process.env.FIREBASE_STORAGE_BUCKET;
    
    if (!projectId || !storageBucket) {
      throw new Error(
        "Configure FIREBASE_PROJECT_ID e FIREBASE_STORAGE_BUCKET ou GOOGLE_APPLICATION_CREDENTIALS"
      );
    }

    // Para usar variáveis de ambiente, você precisa configurar as credenciais
    // Isso geralmente requer um arquivo JSON de credenciais
    throw new Error(
      "Configure GOOGLE_APPLICATION_CREDENTIALS com o caminho para o arquivo de credenciais JSON do Firebase"
    );
  }

  return admin.app();
}

async function uploadFile(fileConfig) {
  const bucket = admin.storage().bucket();
  const fileName = path.basename(fileConfig.localPath);

  if (!fs.existsSync(fileConfig.localPath)) {
    console.warn(`⚠ Arquivo não encontrado: ${fileConfig.localPath}`);
    return null;
  }

  const stats = fs.statSync(fileConfig.localPath);
  console.log(`📤 Fazendo upload de ${fileName} (${(stats.size / 1024 / 1024).toFixed(2)} MB)...`);

  try {
    await bucket.upload(fileConfig.localPath, {
      destination: fileConfig.storagePath,
      metadata: {
        contentType: fileConfig.contentType,
        cacheControl: "public, max-age=3600",
      },
    });

    // Torna o arquivo público
    await bucket.file(fileConfig.storagePath).makePublic();

    // Obtém a URL pública
    const [url] = await bucket.file(fileConfig.storagePath).getSignedUrl({
      action: "read",
      expires: "03-09-2491", // Data muito no futuro
    });

    // URL pública direta (sem assinatura)
    const publicUrl = `https://storage.googleapis.com/${bucket.name}/${fileConfig.storagePath}`;
    
    console.log(`✓ ${fileName} enviado com sucesso!`);
    console.log(`  URL pública: ${publicUrl}`);
    
    return publicUrl;
  } catch (error) {
    console.error(`✗ Erro ao fazer upload de ${fileName}:`, error.message);
    throw error;
  }
}

async function main() {
  try {
    console.log("🔥 Inicializando Firebase...");
    await initializeFirebase();
    
    console.log("📦 Fazendo upload dos arquivos...");
    const urls = [];
    
    for (const fileConfig of FILES_TO_UPLOAD) {
      const url = await uploadFile(fileConfig);
      if (url) {
        urls.push({
          file: path.basename(fileConfig.localPath),
          url: url,
        });
      }
    }

    console.log("\n✅ Upload concluído!");
    console.log("\n📋 Configure as seguintes variáveis de ambiente na Vercel:");
    console.log(`FEATURES_JSON_URL=${urls.find(u => u.file === "features.json")?.url || ""}`);
    console.log(`ADDRESS_INDEX_URL=${urls.find(u => u.file === "addressIndex.json")?.url || ""}`);
  } catch (error) {
    console.error("\n❌ Erro:", error.message);
    process.exit(1);
  }
}

main();

