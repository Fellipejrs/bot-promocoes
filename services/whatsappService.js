const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');

/**
 * Formata a promoção em uma mensagem atraente para o WhatsApp.
 * 
 * @param {Object} promo Dados da promoção do banco de dados
 * @returns {string} Texto formatado com emojis e marcações do WhatsApp
 */
function formatarMensagemPromocao(promo) {
  const titulo = promo.title || 'Oferta Imperdível';

  // Formatação dos preços
  let precoAtualStr = '';
  if (promo.current_price !== null && promo.current_price !== undefined) {
    const val = typeof promo.current_price === 'number' ? promo.current_price : parseFloat(promo.current_price);
    if (!isNaN(val)) {
      precoAtualStr = `R$ ${val.toFixed(2).replace('.', ',')}`;
    }
  } else if (promo.currentPrice) {
    precoAtualStr = promo.currentPrice;
  }

  let precoOriginalStr = '';
  if (promo.original_price !== null && promo.original_price !== undefined) {
    const val = typeof promo.original_price === 'number' ? promo.original_price : parseFloat(promo.original_price);
    if (!isNaN(val)) {
      precoOriginalStr = `~R$ ${val.toFixed(2).replace('.', ',')}~`;
    }
  } else if (promo.originalPrice) {
    precoOriginalStr = `~${promo.originalPrice}~`;
  }

  const desconto = promo.discount ? `(${promo.discount})` : '';
  const link = promo.affiliate_link || promo.affiliateLink || promo.link || '';

  let msg = `🔥 *OFERTA IMPERDÍVEL!* 🔥\n\n`;
  msg += `📦 *${titulo}*\n\n`;

  if (precoOriginalStr) {
    msg += `💰 De: ${precoOriginalStr}\n`;
  }
  if (precoAtualStr) {
    msg += `🏷️ *Por: ${precoAtualStr}* ${desconto}\n\n`;
  }

  if (link) {
    msg += `🔗 *Garanta a sua agora:*\n${link}\n\n`;
  }

  msg += `⚡ _Promoção por tempo limitado!_`;

  return msg;
}

/**
 * Inicializa o cliente do WhatsApp utilizando sessão salva localmente.
 * 
 * @returns {Promise<Client>} Instância do cliente do WhatsApp conectado
 */
function inicializarWhatsAppClient() {
  return new Promise((resolve, reject) => {
    console.log('🚀 Inicializando cliente do WhatsApp...');

    const client = new Client({
      authStrategy: new LocalAuth({
        dataPath: './sessions/whatsapp'
      }),
      puppeteer: {
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      }
    });

    client.on('qr', (qr) => {
      console.log('\n📲 Escaneie o QR Code abaixo no WhatsApp do seu celular:\n');
      qrcode.generate(qr, { small: true });
    });

    client.on('ready', () => {
      console.log('✅ Cliente WhatsApp conectado e pronto!');
      resolve(client);
    });

    client.on('auth_failure', (msg) => {
      console.error('❌ Falha na autenticação do WhatsApp:', msg);
      reject(new Error(msg));
    });

    client.initialize().catch(reject);
  });
}

/**
 * Envia uma promoção para o destino especificado no WhatsApp.
 * 
 * @param {Client} client Instância do cliente whatsapp-web.js
 * @param {string} targetChatId ID do canal/grupo ou número (ex: "120363023920392@g.us" ou "5511999999999@c.us")
 * @param {Object} promo Objeto contendo os dados da promoção
 */
async function enviarPromocaoWpp(client, targetChatId, promo) {
  const mensagem = formatarMensagemPromocao(promo);
  const imageUrl = promo.image_url || promo.imageUrl;

  try {
    if (imageUrl && (imageUrl.startsWith('http://') || imageUrl.startsWith('https://'))) {
      try {
        const media = await MessageMedia.fromUrl(imageUrl, { unsafeMime: true });
        await client.sendMessage(targetChatId, media, { caption: mensagem });
        return;
      } catch (imgError) {
        console.warn(`⚠️ Não foi possível baixar a imagem (${imageUrl}), enviando apenas o texto...`);
      }
    }

    // Se não tiver imagem ou falhar o download da imagem, envia só o texto
    await client.sendMessage(targetChatId, mensagem);
  } catch (error) {
    console.error(`❌ Erro ao enviar mensagem para ${targetChatId}:`, error.message);
    throw error;
  }


}

/**
 * Converte um link de canal, código de convite ou ID bruto para um JID de destino válido do WhatsApp.
 * 
 * @param {Client} client Instância do cliente do WhatsApp
 * @param {string} targetInput Link do canal (ex: https://whatsapp.com/channel/0029VbCioh8AojYjbgVRqo10) ou JID
 * @returns {Promise<string>} JID de destino (ex: 120363...`@newsletter` ou `@g.us`)
 */
async function resolverTargetId(client, targetInput) {
  if (!targetInput) return null;

  let input = targetInput.trim();

  // Se já for um ID formatado (@newsletter, @g.us, @c.us)
  if (input.includes('@newsletter') || input.includes('@g.us') || input.includes('@c.us')) {
    return input;
  }

  // Se for um link de canal do WhatsApp: https://whatsapp.com/channel/CODE
  let inviteCode = null;
  if (input.includes('whatsapp.com/channel/')) {
    const parts = input.split('whatsapp.com/channel/');
    inviteCode = parts[1].split('/')[0].split('?')[0].trim();
  } else if (input.startsWith('0029')) {
    inviteCode = input.trim();
  }

  if (inviteCode) {
    console.log(`🔍 Resolvendo ID do canal do WhatsApp pelo código: "${inviteCode}"...`);
    try {
      const resolvedId = await client.pupPage.evaluate(async (code) => {
        // Método 1: Busca em WAWebNewsletterMetadataQueryJob
        try {
          const queryJob = window.require('WAWebNewsletterMetadataQueryJob');
          if (queryJob && typeof queryJob.queryNewsletterMetadataByInviteCode === 'function') {
            for (const role of ['GUEST', 'OWNER', 'SUBSCRIBER', 'ADMIN']) {
              try {
                const res = await queryJob.queryNewsletterMetadataByInviteCode(code, role);
                if (res && res.idJid) return res.idJid;
              } catch (e) { }
            }
          }
        } catch (e) { }

        // Método 2: Busca nas coleções locais de newsletters do usuário em WAWebCollections
        try {
          const collections = window.require('WAWebCollections');
          const collection = collections.WAWebNewsletterCollection || collections.NewsletterCollection;
          if (collection) {
            const models = collection.getModelsArray ? collection.getModelsArray() : [];
            for (const m of models) {
              const mCode = m.inviteCode || m.membership?.inviteCode;
              const serialized = m.id?._serialized || m.id;
              if (mCode === code || (serialized && serialized.includes(code))) {
                return serialized;
              }
            }
            // Se houver apenas 1 canal na coleção do usuário
            if (models.length === 1) {
              return models[0].id?._serialized || models[0].id;
            }
          }
        } catch (e) { }

        return null;
      }, inviteCode);

      if (resolvedId) {
        console.log(`✅ ID do canal resolvido com sucesso: ${resolvedId}`);
        return resolvedId;
      }
    } catch (err) {
      console.warn(`⚠️ Erro ao resolver ID do canal via código (${inviteCode}):`, err.message);
    }
  }

  return input;
}

module.exports = {
  formatarMensagemPromocao,
  inicializarWhatsAppClient,
  enviarPromocaoWpp,
  resolverTargetId
};

