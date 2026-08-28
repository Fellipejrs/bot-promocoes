# 🚀 Bot de Automação de Promoções: Mercado Livre ➔ WhatsApp

> **Documentação de Apresentação e Entrega Técnica do Produto**  
> *Manual completo para comercialização, setup e implantação da solução.*

## 🎯 1. Visão Geral do Produto

Esta automação foi desenvolvida para **afiliados do Mercado Livre, donos de canais de ofertas e gestores de tráfego** que desejam automatizar 100% o processo de captura e publicação de ofertas no WhatsApp.

### 💰 Proposta de Valor Comercial
- **Economia de Tempo Absoluta**: Elimina a necessidade de copiar manualmente títulos, imagens, preços e links de cada promoção.
- **Formatação de Alto Impacto (Copys Convertedoras)**: Gera mensagens estruturadas com emojis, preços de/por destacados, percentual de desconto e link de afiliado com call-to-action.
- **Proteção Anti-Spam (Postagem Cadenciada)**: Envia uma promoção por vez com intervalo de tempo configurável (ex: 30 a 60 segundos), evitando bloqueios de conta ou rejeição dos membros do canal.
- **Zero Duplicidade**: Sistema inteligente com banco de dados MySQL que garante que nenhuma oferta seja enviada repetidamente.

## 🛠️ 2. Arquitetura e Funcionamento do Sistema

O sistema é dividido em **3 Pilares Principais**:

```
 ┌─────────────────────────┐      ┌─────────────────────────┐      ┌─────────────────────────┐
 │   1. Scraper Inteligente│ ───► │  2. Banco de Dados MySQL │ ───► │  3. Disparador WhatsApp │
 │   (Playwright Browser)  │      │  (Filtro Anti-Duplicidade)│      │  (Fila Cadenciada 30s)  │
 └─────────────────────────┘      └─────────────────────────┘      └─────────────────────────┘
```

### 1. Scraper de Ofertas (Playwright)
- Navega de forma automatizada no Hub de Afiliados do Mercado Livre.
- Extrai dados em tempo real: Título do produto, Preço Original, Preço com Desconto, % de Desconto, Link de Afiliado e Imagem HD.

### 2. Controle de Duplicidade (MySQL)
- Salva todas as ofertas extraídas no banco de dados.
- Adiciona uma chave única para cada link de produto.
- Mantém a flag `enviado_wpp` (0 = Não Enviado, 1 = Já Enviado).

### 3. Fila de Envios (WhatsApp Web API)
- Conecta a conta de WhatsApp do cliente através da leitura de QR Code no terminal.
- Mantém a sessão salva (sem necessidade de escanear o QR Code a cada execução).
- Lê o link ou ID do canal do WhatsApp e envia as mensagens sequencialmente de forma segura.

---

## 📋 3. Requisitos para Instalação

Para rodar esta automação na máquina do cliente ou em um servidor VPS:

1. **Node.js**: Versão `v18.0.0` ou superior.
2. **Banco de Dados MySQL**: Servidor MySQL rodando localmente (XAMPP/WampServer) ou em nuvem (ex: PlanetScale, AWS, Aiven).
3. **Navegador Google Chrome / Chromium**: Utilizado pelo Playwright.

---

## ⚙️ 4. Passo a Passo de Setup para o Cliente

### Passo 1: Instalação das Dependências
Abra o terminal na pasta do projeto e execute:
```bash
npm install
```

### Passo 2: Configuração do Arquivo `.env`
Crie ou edite o arquivo `.env` com as credenciais do cliente:

```env
# Banco de Dados MySQL
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=sua_senha
DB_DATABASE=promocoes

# Configurações do WhatsApp
# Cole aqui o ID ou o LINK do Canal do WhatsApp (ex: https://whatsapp.com/channel/0029VbC...)
WPP_TARGET_ID=120363413413478127@newsletter

# Intervalo em segundos entre cada envio (Recomendado: 30 a 60s)
WPP_DELAY_SECONDS=30
```

### Passo 3: Autenticação do WhatsApp (Primeiro Acesso)
Se você estiver utilizando um link de canal e quiser listar os grupos/canais para pegar o ID numérico:
```bash
npm run list:chats
```
> Um **QR Code** será gerado no terminal. O cliente deve abrir o WhatsApp no celular ➔ **Aparelhos Conectados** ➔ **Conectar um aparelho** e escanear o código.

---

## 🚀 5. Como Executar a Automação

Sempre que o cliente quiser executar o robô para capturar e enviar ofertas:

```bash
npm start
```

### O que acontece ao rodar `npm start`:
1. O robô abre o navegador invisível e extrai as ofertas do Mercado Livre.
2. Salva apenas as novidades no MySQL.
3. Conecta no WhatsApp do cliente de forma transparente.
4. Envia **uma por uma** com intervalo de 30 segundos até finalizar a lista.

---

## 💰 6. Sugestões de Modelos de Negócio para Venda

### Opção A: Venda de Licença / Setup Único (One-Time Fee)
- **Preço Sugerido**: R$ 350,00 a R$ 800,00
- **O que você entrega**: Código completo + Instalação/Configuração no computador do cliente.

### Opção B: Assinatura Mensal (SaaS / Recorrência)
- **Preço Sugerido**: R$ 99,00 a R$ 199,00 / mês
- **O que você entrega**: Você hospeda o robô em um servidor nuvem (VPS por R$ 30/mês) rodando em loop a cada 1 hora. O cliente só precisa ler o QR Code uma vez e ver os lucros de afiliados entrarem.

### Opção C: Parceria de Coprodução (Percentual de Afiliado)
- Você entra com a tecnologia e o cliente com a audiência/divulgação do canal de ofertas. Dividem 50%/50% das comissões geradas no Mercado Livre Afiliados.

---

## 📱 Exemplo de Mensagem Gerada no WhatsApp

```text
🔥 *OFERTA IMPERDÍVEL!* 🔥

📦 *Smartphone Samsung Galaxy A55 5G 128GB 8GB RAM Azul-escuro*

💰 De: ~R$ 2.999,00~
🏷️ *Por: R$ 1.699,00* (43% OFF)

🔗 *Garanta a sua agora:*
https://mercadolivre.com/sec/link-de-afiliado

⚡ _Promoção por tempo limitado!_
```

---
*Documentação gerada para suporte comercial e implantação técnica.*
