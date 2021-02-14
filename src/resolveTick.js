const axios = require('axios');
const moment = require('moment');
//const Heap = require('heap');
const { db } = require('./firebase/firebase');

const main = async () => {
    try {
        const coinCapRes = await axios.get(`https://pro-api.coinmarketcap.com/v1/cryptocurrency/listings/latest?CMC_PRO_API_KEY=${process.env.CMC_PRO_API_KEY}`);
        const { status, data } = coinCapRes.data;
        const ts = status.timestamp;
        const coins = ["BTC", "ETH", "LTC"];
        const coinData = getCoins(coins, data);
        const prices = await updatePrices(coinData, ts);

        await updateUserValues(prices);
        await db.ref(`lastTick`).set(ts);
    } catch (err) {
        console.log(err);
    }
}

async function updateUserValues(prices) {
    const usersRes = await db.ref(`users`).once('value');
    const users = usersRes.val();
    for (let userId of Object.keys(users)) {
        const user = users[userId];
        const totalValue = calculateTotalValue(prices, user.balances);
        await db.ref(`users/${userId}/totalValue`).set(totalValue);
    }
}

function calculateTotalValue(prices, balances) {
    let totalValue = 0;
    Object.keys(balances).forEach(coin => {
        totalValue += balances[coin] * prices[coin];
    });
    return Math.round(totalValue * 100) / 100;
}

async function updatePrices(coinData, ts) {
    const prices = { USD: 1 };

    for (let coin of Object.keys(coinData)) {
        let curPrice = coinData[coin].quote.USD.price;
        curPrice = Math.round(curPrice * 100) / 100;
        await db.ref(`coins/cur/${coin}`).set(curPrice);
        await db.ref(`coins/his/${coin}`).push({
            price: curPrice,
            ts
        });
        prices[coin] = curPrice;
    }
    return prices;
}

function getCoins(coins, data) {
    const coinData = {};
    const coinSet = new Set(coins);
    for (let coin of data) {
        if (coinSet.has(coin.symbol)) {
            coinSet.delete(coin.symbol);
            coinData[coin.symbol] = coin;
        }
        if (!coinSet.size) {
            break;
        }
    }
    return coinData;
}

const frequencyInMinutes = 15;
const frequencyInMs = frequencyInMinutes * 60 * 1000;

const now = moment();
const startOfCurMinute = now.startOf('minute');
const minutesToFirstTick = frequencyInMinutes - (startOfCurMinute.minutes() % frequencyInMinutes);
const timeOfNextTick = startOfCurMinute.add(minutesToFirstTick, 'minutes');
const msToNextTick = timeOfNextTick.diff(moment());

setTimeout(async () => {

    await main();
    setInterval(async () => {
        await main();
    }, frequencyInMs);

}, msToNextTick);

//main();
module.exports = { calculateTotalValue };