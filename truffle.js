require("babel-register")({
  ignore: /node_modules(?!\/zeppelin-solidity)/,
  presets: [
    ["env", {
      "targets" : {
        "node" : "8.0"
      }
    }]
  ],
  retainLines: true,
});
require("babel-polyfill");

/* read deployment details from external config file */
const HDWalletProvider = require("truffle-hdwallet-provider");
const w = require('./wallet.json');

module.exports = {
  networks: {
    development: {
      host: "localhost",
      port: 8545,
      network_id: "*",
      gas: 5712388
    },
    rinkeby: {
      provider: new HDWalletProvider(w['rinkeby']['mnemonic'], 'https://rinkeby.infura.io/' + w['infura']),
      network_id: '*',
      gas: 6700000
    },
    production: {
      provider: new HDWalletProvider(w['production']['mnemonic'], 'https://mainnet.infura.io/' + w['infura']),
      network_id: '*',
      gas: 6675000,
      gasPrice: 4 * 10**9 // 4 gwei
    }
  }
};
