# Instruções de Deploy

## Problema: Arquivos LFS não são baixados automaticamente na Vercel

Os arquivos `data/features.json` e `data/addressIndex.json` são muito grandes (117 MB) e estão armazenados usando Git LFS. A Vercel não baixa arquivos LFS automaticamente durante o build.

## Soluções

### Opção 1: Upload para Storage Externo (Recomendado)

1. Faça upload dos arquivos para um storage externo:
   - AWS S3
   - Google Cloud Storage
   - Azure Blob Storage
   - Cloudflare R2
   - Outro CDN/storage

2. Configure as variáveis de ambiente na Vercel:
   - `FEATURES_JSON_URL`: URL pública do arquivo `features.json`
   - `ADDRESS_INDEX_URL`: URL pública do arquivo `addressIndex.json`

3. O script `scripts/download-data.js` baixará automaticamente os arquivos durante o build.

### Opção 2: Usar GitHub Releases

1. Crie um release no GitHub
2. Faça upload dos arquivos como assets do release
3. Configure as URLs nas variáveis de ambiente da Vercel apontando para os assets do release

### Opção 3: Configurar Git LFS na Vercel (Mais Complexo)

Se você quiser usar Git LFS diretamente, você precisa:

1. Instalar Git LFS no ambiente de build da Vercel
2. Configurar autenticação para acessar os arquivos LFS

Isso pode ser feito modificando o `vercel.json`:

```json
{
  "buildCommand": "git lfs install && git lfs pull && npm run build",
  "installCommand": "npm install"
}
```

**Nota**: Isso pode não funcionar porque a Vercel pode não ter Git LFS instalado ou configurado corretamente.

## Solução Temporária

O script `scripts/download-data.js` tentará baixar os arquivos de várias fontes:
1. URLs externas (se configuradas via variáveis de ambiente)
2. GitHub raw URLs (pode não funcionar para arquivos LFS)

Se nenhuma fonte funcionar, o build continuará mas o site funcionará sem os dados (apenas com o mapa base).

## Verificação

Após o deploy, verifique se os arquivos foram baixados corretamente:
- Os logs do build devem mostrar: `✓ features.json baixado com sucesso`
- O site deve mostrar todas as camadas de dados, não apenas o mapa base

