require('dotenv').config();
const { pool } = require('./database/connection');
const {
  buscarPromocoesPendentesWpp,
  marcarPromocaoComoEnviadaWpp
} = require('./services/promocoesServices');
const {
  inicializarWhatsAppClient,
  enviarPromocaoWpp,
  resolverTargetId
} = require('./services/whatsappService');

/**
 * Função de auxílio para pausar a execução por N milissegundos.
 * 
 * @param {number} ms 
 * @returns {Promise<void>}
 */
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Executa a fila de envio de promoções pendentes para o WhatsApp.
 * 
 * @param {Object} [options]
 * @param {boolean} [options.closePool=true] Se deve encerrar a conexão com o MySQL ao finalizar
 */
async function processarFilaEnvio({ closePool = true } = {}) {
  const rawTarget = process.env.WPP_TARGET_ID;
  const delaySeconds = parseInt(process.env.WPP_DELAY_SECONDS || '30', 10);
  const delayMs = delaySeconds * 1000;

  let client;

  try {
    // 1. Conecta o cliente do WhatsApp
    client = await inicializarWhatsAppClient();

    // 2. Resolve o ID do destino (aceita link do canal https://whatsapp.com/channel/... ou ID direto)
    let targetId = await resolverTargetId(client, rawTarget);

    // 3. Se o usuário passar a flag --list-chats ou não tiver configurado WPP_TARGET_ID
    if (process.argv.includes('--list-chats') || !targetId) {
      console.log('\n📋 Buscando seus grupos e canais do WhatsApp para ajuda no ID:');
      try {
        const chats = await client.getChats();
        const gruposECanal = chats.filter(c => c.isGroup || c.id._serialized.includes('@g.us') || c.id._serialized.includes('@newsletter'));
        
        console.log('\n--- Seus Grupos/Canais Encontrados ---');
        if (gruposECanal.length === 0) {
          chats.slice(0, 10).forEach(c => {
            console.log(`📌 Nome: "${c.name}" | ID: ${c.id._serialized}`);
          });
        } else {
          gruposECanal.forEach(g => {
            console.log(`📌 Nome: "${g.name}" | ID: ${g.id._serialized}`);
          });
        }
        console.log('-------------------------------------\n');
      } catch (chatErr) {
        console.log('ℹ️ Não foi possível listar todos os chats via API legada, mas você pode usar diretamente o LINK do seu canal no .env!');
      }

      if (!targetId) {
        console.warn('⚠️ WPP_TARGET_ID não configurado no arquivo .env!');
        console.warn('Cole o link do seu canal (ex: WPP_TARGET_ID=https://whatsapp.com/channel/0029VbCioh8AojYjbgVRqo10) ou o ID no seu .env\n');
        return;
      }
    }

    // 3. Busca promoções pendentes no MySQL
    console.log('🔍 Verificando promoções pendentes no banco de dados...');
    const pendentes = await buscarPromocoesPendentesWpp(100);

    if (pendentes.length === 0) {
      console.log('✨ Nenhuma promoção nova/pendente para enviar no momento.');
      return;
    }

    console.log(`\n📢 Encontradas ${pendentes.length} promoção(ões) pendente(s).`);
    console.log(`⏱️ Intervalo configurado: ${delaySeconds} segundo(s) entre cada envio.\n`);

    // 4. Envia uma a uma (Envio sequencial com delay)
    let enviadasCount = 0;

    for (const [index, promo] of pendentes.entries()) {
      console.log(`\n[${index + 1}/${pendentes.length}] Enviando: "${promo.title.substring(0, 40)}..."`);
      
      try {
        await enviarPromocaoWpp(client, targetId, promo);
        await marcarPromocaoComoEnviadaWpp(promo.id);
        enviadasCount++;
        console.log(`✅ Promoção #${promo.id} enviada e marcada como ENVIADA no banco de dados!`);
      } catch (err) {
        console.error(`❌ Falha ao enviar promoção #${promo.id}:`, err.message);
        // Em caso de falha, não marca como enviada para tentar na próxima vez
      }

      // Se ainda houver promoções a serem enviadas, aguarda o tempo estipulado
      if (index < pendentes.length - 1) {
        console.log(`⏳ Aguardando ${delaySeconds}s antes de enviar a próxima...`);
        await delay(delayMs);
      }
    }

    console.log(`\n🎉 Processamento da fila finalizado! Total de ${enviadasCount} promoção(ões) enviada(s).`);

  } catch (error) {
    console.error('❌ Erro durante a execução da fila de envio:', error);
  } finally {
    if (client) {
      console.log('Encerrando cliente do WhatsApp...');
      await client.destroy();
    }
    if (closePool) {
      await pool.end();
    }
  }
}

// Executa se rodado diretamente pelo terminal
if (require.main === module) {
  processarFilaEnvio();
}

module.exports = {
  processarFilaEnvio
};
