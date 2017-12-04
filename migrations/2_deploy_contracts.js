var BigNumber = require('bignumber.js');
var Tokensale = artifacts.require('./Tokensale.sol');

let presaleStartTime = 1512370800; // 1512568800; // Dec 6, 2pm UTC
let startTime = 1512371800; // 1512655200; // Dec 7, 2pm UTC
let hardCap = fromEtherToWei(5412); // at $462/ETH
let investmentFundWallet = "0xB4e817449b2fcDEc82e69f02454B42FE95D4d1fD"
let miscellaneousWallet = "0x7F744e420874AF3752CE657181e4b37CA9594779"
let treasury = "0xB4e817449b2fcDEc82e69f02454B42FE95D4d1fD"
let teamWallet = "0xC29789f465DF1AAF791027f4CABFc6Eb3EC2fc19"
let reserveWallet = "0xb30CC06c46A0Ad3Ba600f4a66FB68F135EAb716D"
let advisorsWallet = "0x14589ba142Ff8686772D178A49503D176628147a"

/* TODO: Replace with full list of 484 whitelist addresses */
let presalesWhitelist = [
    ["0x00A29Dbd171B43d3b3BDd02291F308454eF0A4cE", 1000],
    ["0x10A29Dbd171B43d3b3BDd02291F308454eF0A4cE", 1001],
    ["0x20A29Dbd171B43d3b3BDd02291F308454eF0A4cE", 1002],
    ["0x30A29Dbd171B43d3b3BDd02291F308454eF0A4cE", 1003],
    ["0x40A29Dbd171B43d3b3BDd02291F308454eF0A4cE", 1004],
    ["0x50A29Dbd171B43d3b3BDd02291F308454eF0A4cE", 1005],
    ["0x60A29Dbd171B43d3b3BDd02291F308454eF0A4cE", 1006],
    ["0x70A29Dbd171B43d3b3BDd02291F308454eF0A4cE", 1007],
    ["0x80A29Dbd171B43d3b3BDd02291F308454eF0A4cE", 1008],
    ["0x90A29Dbd171B43d3b3BDd02291F308454eF0A4cE", 1009],
    ["0x00A29Dbd171B43d3b3BDd02291F308454eF0A4cE", 2000],
    ["0x10A29Dbd171B43d3b3BDd02291F308454eF0A4cE", 2001],
    ["0x888623a6DeEc123c844BcEfD57bE30B8bc0a5e27", 2002]
];

function fromEtherToWei(amountInether) {
    return web3.toWei(new BigNumber(amountInether), 'ether');
}

async function whitelist(saleContract) {
    let sliceSize = 10;
    for (var i = 0; i < presalesWhitelist.length; i += sliceSize) {
        var slice = presalesWhitelist.slice(i, i + sliceSize)
        var addresses = slice.map(item => item[0]);
        var maxes = slice.map(item => fromEtherToWei(item[1]));
        console.log("Whitelisting address:");
        console.log(slice);
        console.log("Please confirm transaction.");
        var receipt = await saleContract.addPresaleWallets(addresses, maxes);
        console.log("Whitelisted", addresses.length, "addreses.\n\n");
    }
}

async function deploySaleContract() {
    console.log("Deploying sales contract. Please confirm transaction.");
    var saleContract = await Tokensale.new(presaleStartTime, startTime, hardCap, investmentFundWallet, miscellaneousWallet, treasury, teamWallet, reserveWallet, advisorsWallet, {from: web3.eth.accounts[0], gas: 6000000});
    console.log("Deployed sales contract at address: ", saleContract.address, "\n\n");
    return saleContract;
}

module.exports = async function (deployer, network, accounts) {

    try {
        var saleContract = await deploySaleContract();
        await whitelist(saleContract);
    } catch(e) {
        console.error(e);
    }
}
