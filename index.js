const { chromium } = require('playwright');
const { salvarPromocoes } = require('./services/promocoesServices');
const { pool } = require('./database/connection');

/**
 * Função responsável por acessar a página de promoções do Mercado Livre Afiliados
 * e retornar a lista de promoções/ofertas disponíveis.
 * 
 * @param {Object} options Configurações adicionais
 * @param {boolean} options.headless Se deve rodar o navegador em modo invisível (default: true).
 * @param {Array<Object>} [options.cookies] Lista de cookies para navegar autenticado no Hub de Afiliados.
 * @returns {Promise<Array<{title: string, currentPrice: string, originalPrice: string, discount: string, link: string, imageUrl: string}>>}
 */
async function getPromocoesMercadoLivre({ headless = true, cookies = [] } = {}) {
  const context = await chromium.launchPersistentContext(
    './sessions/mercadolivre',
    {
      headless,
      viewport: {
        width: 1280,
        height: 800
      },
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
        '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }
  );
  if (cookies && cookies.length > 0) {
    await context.addCookies(cookies);
  }

  const page = await context.newPage();

  try {
    console.log('Navegando até a página de Afiliados do Mercado Livre (https://www.mercadolivre.com.br/afiliados/hub)...');

    await page.goto('https://www.mercadolivre.com.br/afiliados/hub', {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });

    await page.waitForTimeout(3000);

    if (page.url().includes('/login/')) {
      console.warn('\n⚠️  Atenção: O Mercado Livre redirecionou para a tela de login (acesso restrito ao Hub de Afiliados).');
      console.warn('Para extrair promoções deste link, você precisa passar cookies de uma sessão autenticada.\n');
    }

    // Rola a tela para carregar imagens e conteúdo dinâmico da página de afiliados
    await page.evaluate(() => window.scrollBy(0, 1000));
    await page.waitForTimeout(1500);

    // Extrai as promoções encontradas na página
    const promocoes = await page.evaluate(() => {
      const items = [];
      const visitedLinks = new Set();
      const cards = document.querySelectorAll('.poly-card, .promotion-item, [class*="card"]');

      cards.forEach(card => {
        const titleEl = card.querySelector('.poly-component__title, .promotion-item__title, [class*="title"]');
        const linkEl = card.querySelector('a[href*="mercadolivre.com.br"]');
        const imgEl = card.querySelector('img');

        const discountEl = card.querySelector('.poly-discount-tag, .promotion-item__discount-text, [class*="discount"]');
        const originalPriceEl = card.querySelector('.andes-money-amount--previous .andes-money-amount__fraction, [class*="previous"]');
        const currentPriceEl = card.querySelector('.poly-price__amount .andes-money-amount--cents-superscript, .andes-money-amount--weight-semibold');
        const centsEl = card.querySelector('.poly-price__current .andes-money-amount__cents');

        const title = titleEl ? titleEl.innerText.trim() : '';
        const link = linkEl ? linkEl.href : '';

        if (!title || !link || visitedLinks.has(link)) return;
        visitedLinks.add(link);

        const discount = discountEl ? discountEl.innerText.trim() : '';
        const originalPrice = originalPriceEl ? `R$ ${originalPriceEl.innerText.trim()}` : '';
        let currentPrice = currentPriceEl ? `R$ ${currentPriceEl.innerText.trim()}` : '';
        if (currentPrice && centsEl) {
          currentPrice += `,${centsEl.innerText.trim()}`;
        }

        const imageUrl = imgEl ? (imgEl.src || imgEl.getAttribute('data-src') || '') : '';

        items.push({
          title,
          currentPrice,
          originalPrice,
          discount,
          link,
          imageUrl
        });
      });

      return items;
    });

    return promocoes;
  } catch (error) {
    console.error('Erro ao buscar promoções:', error);
    throw error;
  } finally {
    await context.close();
  }
}

const { processarFilaEnvio } = require('./enviarPromocoes');

// Execução completa unificada: raspagem -> salvar banco -> disparar para WhatsApp
if (require.main === module) {
  (async () => {
    try {
      console.log('🔍 [1/2] Buscando promoções do Mercado Livre...');
      const ofertas = await getPromocoesMercadoLivre({ headless: true });
      console.log(`\n✅ Sucesso! ${ofertas.length} promoções extraídas.\n`);

      if (ofertas.length > 0) {
        await salvarPromocoes(ofertas);
      } else {
        console.log('ℹ️ Nenhuma nova oferta encontrada na raspagem.');
      }

      console.log('\n🚀 [2/2] Iniciando processo de envio para o WhatsApp...');
      // Executa a fila de envio e encerra a conexão com o banco ao finalizar
      await processarFilaEnvio({ closePool: true });

    } catch (err) {
      console.error('❌ Falha na execução unificada:', err);
      await pool.end();
    }
  })();
}

module.exports = {
  getPromocoesMercadoLivre
};

