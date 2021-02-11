function roundQuantity(quanitity, symbol) {
    if (symbol == "USD") {
        return Math.round(quanitity * 100) / 100;
    } else {
        return Math.round(quanitity * 100000000) / 100000000;
    }
}

function balancesObjToArray(balances, curPrices, totalValue) {
    const balancesArray = [];
    for (let coin of Object.keys(balances)) {
        const balance = balances[coin];
        let curPrice = curPrices[coin] || 0;
        const value = Math.round(balance * curPrice * 100) / 100;
        const percentage = Math.round(value / totalValue * 100 * 10) / 10;
        balancesArray.push({
            symbol: coin,
            balance: balances[coin],
            value,
            percentage,
        });
    }
    return balancesArray;
}

function lockedBalancesObjToArray(lockedBalances) {
    const lockedBalancesArray = [];
    for (let coin of Object.keys(lockedBalances)) {
        lockedBalancesArray.push({
            symbol: coin,
            balance: lockedBalances[coin],
        });
    }
    return lockedBalancesArray;
}

module.exports = { roundQuantity, balancesObjToArray, lockedBalancesObjToArray };