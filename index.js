const axios = require('axios');

const SYMBOL = "BTCUSDT";
const PERIOD = 14;
const LIMIT = 100;

const API_URL = "https://testnet.binance.vision"; // https://api.binance.com
const ENDPOINT_GET = `/api/v3/klines?limit=${LIMIT}&interval=15m&symbol=${SYMBOL}`;

function averages(prices, period, startIndex) {
    let gains = 0, losses = 0;

    for (let i=0; i < period && (i + startIndex) < prices.length; i++) {
        const diff = prices[i + startIndex] - prices[i + startIndex - 1];

        if (diff >= 0) {
            gains += diff;
        } else {
            losses += Math.abs(diff);
        }
    }

    let avgGains = gains / period;
    let avgLosses = losses / period;
    return { avgGains, avgLosses };
}

function RSI(prices, period) {
    let avgGains = 0, avgLosses = 0;

    for (let i=1; i < prices.length; i++) {
        let newAverages = averages(prices, period, i);

        if (i === 1) {
            avgGains = newAverages.avgGains;
            avgLosses = newAverages.avgLosses;
            continue;
        }
        avgGains = (avgGains * (period - 1) + newAverages.avgGains) / period;
        avgLosses = (avgLosses * (period - 1) + newAverages.avgLosses) / period;
    }

    const rs = avgGains / avgLosses;
    return 100 - (100 / (1 + rs));
}

let isOpened = false;

async function start () {
    const { data } = await axios.get(API_URL + ENDPOINT_GET);
    const candle = data[data.length - 1];
    const price = parseFloat(candle[4]);

    console.clear();
    console.log("Price: " + price);

    if (price <= BUY_PRICE && isOpened === false) {
        console.log("comprar!");
        isOpened = true;
    } else if (price >= SELL_PRICE && isOpened === true) {
        console.log("vender!");
        isOpened = false;  
    } else {
        console.log("aguardar!");
    }
}

setInterval(start, 3000);

start();