const { chromium } = require('playwright');

async function autenticarMercadoLivre() {
    const context = await chromium.launchPersistentContext('./sessions/mercadolivre', {
        headless: false,
        viewport: {
            width: 1280,
            height: 800
        },
        userAgent:
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
            '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });

    const page = await context.newPage();

    await page.goto('https://www.mercadolivre.com.br/afiliados/hub', {
        waitUntil: 'domcontentloaded',
        timeout: 30000
    });

    console.log('URL atual:', page.url());

    if (page.url().includes('/login')) {
        console.log('');
        console.log('Faça login no Mercado Livre no navegador aberto.');
        console.log('Depois que terminar o login, pressione ENTER aqui no terminal.');

        await new Promise(resolve => {
            process.stdin.once('data', resolve);
        });
    }

    console.log('Sessão salva em ./sessions/mercadolivre');

    await context.close();
}

autenticarMercadoLivre();