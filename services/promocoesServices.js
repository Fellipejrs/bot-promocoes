const { pool } = require('../database/connection');

/**
 * Converte valores de preço formatados (ex: "R$ 1.299,90" ou "R$ 99,00") para número decimal (1299.90).
 * 
 * @param {string|number} priceStr 
 * @returns {number|null}
 */
function parsePrice(priceStr) {
  if (typeof priceStr === 'number') return priceStr;
  if (!priceStr || typeof priceStr !== 'string') return null;

  const cleaned = priceStr.replace(/[^\d.,]/g, '').trim();
  if (!cleaned) return null;

  if (cleaned.includes(',')) {
    const formatted = cleaned.replace(/\./g, '').replace(',', '.');
    const val = parseFloat(formatted);
    return isNaN(val) ? null : val;
  }

  const val = parseFloat(cleaned);
  return isNaN(val) ? null : val;
}

/**
 * Salva uma única promoção no banco de dados na tabela `promocoes`.
 * Ignora o campo `status` conforme solicitado.
 * 
 * @param {Object} promo Dados da promoção extraídos do scraper
 * @returns {Promise<Object>} Resultado da inserção no MySQL
 */
async function salvarPromocao(promo) {
  const query = `
    INSERT INTO promocoes (
      title,
      current_price,
      original_price,
      discount,
      link,
      affiliate_link,
      image_url
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      title = VALUES(title),
      current_price = VALUES(current_price),
      original_price = VALUES(original_price),
      discount = VALUES(discount),
      affiliate_link = VALUES(affiliate_link),
      image_url = VALUES(image_url),
      updated_at = CURRENT_TIMESTAMP
  `;

  const title = promo.title ? String(promo.title).substring(0, 500) : '';
  const currentPrice = parsePrice(promo.currentPrice || promo.current_price);
  const originalPrice = parsePrice(promo.originalPrice || promo.original_price);
  const discount = promo.discount ? String(promo.discount).substring(0, 50) : null;
  const link = promo.link ? String(promo.link).substring(0, 1000) : '';
  const rawAffiliateLink = promo.affiliateLink || promo.affiliate_link || link;
  const affiliateLink = rawAffiliateLink ? String(rawAffiliateLink).substring(0, 1000) : null;
  const rawImageUrl = promo.imageUrl || promo.image_url;
  const imageUrl = rawImageUrl ? String(rawImageUrl).substring(0, 1000) : null;

  const params = [
    title,
    currentPrice,
    originalPrice,
    discount,
    link,
    affiliateLink,
    imageUrl
  ];

  const [result] = await pool.execute(query, params);
  return result;
}

/**
 * Salva uma lista de promoções no banco de dados.
 * 
 * @param {Array<Object>} promocoes Lista de promoções extraídas
 * @returns {Promise<{salvas: number, erros: number}>}
 */
async function salvarPromocoes(promocoes) {
  if (!Array.isArray(promocoes) || promocoes.length === 0) {
    console.log('⚠️ Nenhuma promoção recebida para salvar no banco de dados.');
    return { salvas: 0, erros: 0 };
  }

  let salvas = 0;
  let erros = 0;

  console.log(`\n💾 Salvando ${promocoes.length} promoção(ões) na tabela "promocoes"...`);

  for (const promo of promocoes) {
    try {
      await salvarPromocao(promo);
      salvas++;
    } catch (err) {
      erros++;
      console.error(`❌ Erro ao salvar promoção "${promo.title || 'Sem título'}":`, err.message);
    }
  }

  console.log(`✅ Processo finalizado: ${salvas} salvas/atualizadas, ${erros} erros.\n`);
  return { salvas, erros };
}

/**
 * Garante que a tabela `promocoes` possua as colunas `enviado_wpp` e `enviado_em`.
 */
async function garantirTabelaEColunasWpp() {
  try {
    // Adiciona a coluna enviado_wpp se não existir
    await pool.query(`
      ALTER TABLE promocoes
      ADD COLUMN IF NOT EXISTS enviado_wpp TINYINT(1) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS enviado_em DATETIME NULL;
    `);
  } catch (err) {
    // Se a versão do MySQL não suportar 'ADD COLUMN IF NOT EXISTS' diretamente
    try {
      await pool.query(`ALTER TABLE promocoes ADD COLUMN enviado_wpp TINYINT(1) DEFAULT 0;`);
    } catch (e) {}
    try {
      await pool.query(`ALTER TABLE promocoes ADD COLUMN enviado_em DATETIME NULL;`);
    } catch (e) {}
  }
}

/**
 * Busca todas as promoções pendentes de envio para o WhatsApp (enviado_wpp = 0).
 * 
 * @param {number} [limite=50] Quantidade máxima de promoções a buscar
 * @returns {Promise<Array<Object>>} Lista de promoções pendentes
 */
async function buscarPromocoesPendentesWpp(limite = 50) {
  await garantirTabelaEColunasWpp();
  const query = `
    SELECT * FROM promocoes
    WHERE enviado_wpp = 0 OR enviado_wpp IS NULL
    ORDER BY created_at ASC
    LIMIT ?
  `;
  const [rows] = await pool.query(query, [limite]);
  return rows;
}

/**
 * Marca uma promoção como enviada para o WhatsApp.
 * 
 * @param {number} id ID da promoção no banco de dados
 */
async function marcarPromocaoComoEnviadaWpp(id) {
  const query = `
    UPDATE promocoes
    SET enviado_wpp = 1, enviado_em = NOW()
    WHERE id = ?
  `;
  await pool.execute(query, [id]);
}

module.exports = {
  parsePrice,
  salvarPromocao,
  salvarPromocoes,
  garantirTabelaEColunasWpp,
  buscarPromocoesPendentesWpp,
  marcarPromocaoComoEnviadaWpp
};

