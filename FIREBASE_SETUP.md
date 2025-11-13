# Configuração do Firebase Storage

Este guia explica como configurar o Firebase Storage para hospedar os arquivos de dados grandes do projeto.

## Pré-requisitos

1. Conta no Firebase (gratuita): https://firebase.google.com
2. Node.js instalado
3. Firebase CLI instalado (opcional, mas recomendado)

## Passo 1: Criar Projeto no Firebase

1. Acesse o [Firebase Console](https://console.firebase.google.com)
2. Clique em "Adicionar projeto"
3. Escolha um nome para o projeto (ex: `limpebras-pt`)
4. Siga as instruções para criar o projeto

## Passo 2: Ativar Firebase Storage

1. No console do Firebase, vá em "Storage" no menu lateral
2. Clique em "Começar"
3. Escolha o modo de produção (ou modo de teste se quiser testar primeiro)
4. Escolha a localização do bucket (ex: `us-central1`)
5. Clique em "Concluído"

## Passo 3: Obter Credenciais de Serviço

1. No Firebase Console, vá em "Configurações do projeto" (ícone de engrenagem)
2. Vá na aba "Contas de serviço"
3. Clique em "Gerar nova chave privada"
4. Baixe o arquivo JSON (ex: `limpebras-pt-firebase-adminsdk.json`)
5. **IMPORTANTE**: Mantenha este arquivo seguro e não o commite no Git!

## Passo 4: Configurar Regras de Segurança (Tornar Arquivos Públicos)

1. No Firebase Console, vá em "Storage" > "Regras"
2. Substitua as regras por:

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    // Permite leitura pública dos arquivos em data/
    match /data/{fileName} {
      allow read: if true;
      allow write: if false; // Apenas via script de upload
    }
  }
}
```

3. Clique em "Publicar"

## Passo 5: Instalar Dependências

```bash
npm install firebase-admin
```

## Passo 6: Configurar Variáveis de Ambiente

Crie um arquivo `.env.local` (não commite no Git):

```env
GOOGLE_APPLICATION_CREDENTIALS=./limpebras-pt-firebase-adminsdk.json
FIREBASE_PROJECT_ID=seu-projeto-id
FIREBASE_STORAGE_BUCKET=seu-projeto-id.appspot.com
```

**Ou** configure diretamente na Vercel:
- `GOOGLE_APPLICATION_CREDENTIALS`: Conteúdo do arquivo JSON de credenciais (como string JSON)
- `FIREBASE_PROJECT_ID`: ID do seu projeto Firebase
- `FIREBASE_STORAGE_BUCKET`: Nome do bucket (geralmente `seu-projeto-id.appspot.com`)

## Passo 7: Fazer Upload dos Arquivos

Execute o script de upload:

```bash
node scripts/upload-to-firebase.js
```

O script irá:
1. Fazer upload dos arquivos `data/features.json` e `data/addressIndex.json`
2. Torná-los públicos
3. Mostrar as URLs públicas

## Passo 8: Configurar URLs na Vercel

Após o upload, configure as variáveis de ambiente na Vercel:

1. Acesse o painel da Vercel
2. Vá em "Settings" > "Environment Variables"
3. Adicione:
   - `FEATURES_JSON_URL`: URL pública do `features.json` (ex: `https://storage.googleapis.com/seu-bucket/data/features.json`)
   - `ADDRESS_INDEX_URL`: URL pública do `addressIndex.json`

## Alternativa: Usar Firebase CLI

Se preferir usar o Firebase CLI:

```bash
# Instalar Firebase CLI
npm install -g firebase-tools

# Login
firebase login

# Inicializar projeto
firebase init storage

# Fazer upload manual
firebase storage:upload data/features.json data/features.json
firebase storage:upload data/addressIndex.json data/addressIndex.json
```

## Verificação

Após configurar tudo:

1. Os arquivos devem estar acessíveis publicamente via URL
2. O script `scripts/download-data.js` baixará automaticamente durante o build na Vercel
3. O site funcionará com todas as camadas de dados

## Troubleshooting

### Erro: "Permission denied"
- Verifique se as regras do Storage permitem leitura pública
- Verifique se os arquivos foram marcados como públicos

### Erro: "Invalid credentials"
- Verifique se o arquivo JSON de credenciais está correto
- Verifique se as variáveis de ambiente estão configuradas

### Arquivos não aparecem no Storage
- Verifique se o upload foi concluído com sucesso
- Verifique se está olhando o bucket correto

