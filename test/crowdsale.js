var Tokensale = artifacts.require('./Tokensale.sol');
var CREDToken = artifacts.require('./CREDToken.sol');

import increaseTime, { duration, increaseTimeTo } from 'zeppelin-solidity/test/helpers/increaseTime';
import latestTime from 'zeppelin-solidity/test/helpers/latestTime';
import exceptThrow from 'zeppelin-solidity/test/helpers/expectThrow';
import { generateAddresses } from './utils';


contract('TokenSale', function (accounts) {

  let tokensale,
    token,
    owner = accounts[0],
    teamWallet = accounts[1],
    reserveWallet = accounts[2],
    advisorsWallet = accounts[3],
    userWallet = accounts[4],
    treasury = accounts[5],
    investmentFundWallet = accounts[6],
    miscellaneousWallet = accounts[7],
    preAllocatedTokens = web3.toWei(
      10500000+2875000+20000000+5500000, 'ether'),
    whitelist = [accounts[8], ...generateAddresses(10)],
    presaleLimits = [5, 1, 10, 20, 1, 256, 1000000, 1, 1, 1, 1];

  const deploy = async (hardCap) => {
    tokensale = await Tokensale.new(
      latestTime() + duration.days(1),
      latestTime() + duration.days(3),
      web3.toBigNumber(web3.toWei(hardCap, 'ether')),
      investmentFundWallet,
      miscellaneousWallet,
      treasury,
      teamWallet,
      reserveWallet,
      advisorsWallet,
      {
        from: owner,
        gas: 6000000
      }
    );
    await tokensale.addPresaleWallets(
      whitelist,
      presaleLimits.map(l => web3.toWei(l, 'ether')),
      {
        from: owner,
        gas: 6000000
      }
    );
    token = CREDToken.at(await tokensale.token());

  }


  beforeEach(async () => {
    await deploy(5000);
  });

  describe('Before presale', () => {

    it('should setup token', async () => {
      assert.deepEqual(await token.cap(), web3.toBigNumber(web3.toWei(50000000, 'ether')));
    });

    it('should calculate rate', async () => {
      assert.equal((await tokensale.rate()).toString(), '2225');
    })

    it('should correctly set token allocations', async () => {
      let
        total = await tokensale.MAX_SUPPLY(),
        sale = await tokensale.SALE_TOKENS_SUPPLY(),
        investment = await tokensale.INVESTMENT_FUND_TOKENS_SUPPLY(),
        miscellanous = await tokensale.MISCELLANEOUS_TOKENS_SUPPLY(),
        team = await tokensale.TEAM_TOKENS_SUPPLY(),
        reserve = await tokensale.RESERVE_TOKENS_SUPPLY(),
        advisors = await tokensale.ADVISORS_TOKENS_SUPPLY();

      assert.deepEqual(total, web3.toBigNumber(web3.toWei(50000000, 'ether')));
      assert.deepEqual(total,
        sale
        .plus(investment)
        .plus(miscellanous)
        .plus(team)
        .plus(reserve)
        .plus(advisors)
      );

    });

    it('non-owner should not able to add presale accounts', async () => {
      await exceptThrow(tokensale.addPresaleWallets([userWallet], [1], { from: userWallet }));
    });

    it('should be possible for owner to change cap', async () => {
      await tokensale.setHardCap(web3.toWei(1000, 'ether'), {from: owner});
      assert.deepEqual(await tokensale.cap(), web3.toBigNumber(web3.toWei(1000, 'ether')));
      assert.deepEqual(await tokensale.rate(), web3.toBigNumber(11125));
    });

    it('non-owner cannot change cap', async () => {
      await exceptThrow(tokensale.setHardCap(web3.toWei(1000, 'ether'), {from: userWallet}));
    });

    it('should not be possible to take part in presales', async () => {
      await exceptThrow(tokensale.sendTransaction({from: whitelist[0], value: 1}));
    });

  });

  describe('During presale', () => {

    beforeEach(async () => {
      await increaseTime(duration.days(1));
    });

    it('presale should work', async () => {
      let treasuryBalanceBefore = web3.fromWei(await web3.eth.getBalance(treasury), 'ether').toNumber();
      tokensale.sendTransaction({
        value: web3.toBigNumber(web3.toWei('5', 'ether')),
        from: whitelist[0]
      });
      assert.deepEqual(web3.fromWei(await token.balanceOf(whitelist[0]), 'ether').toString(), '11125');
      assert.deepEqual(
        web3.fromWei(await web3.eth.getBalance(treasury), 'ether').toNumber() - treasuryBalanceBefore,
        5);
    });

    it('not possible to change hardcap', async () => {
      await exceptThrow(tokensale.setHardCap(web3.toWei(1000, 'ether'), {from: owner}));
    });

    it('not possible to buy if not in whitelist', async () => {
      await exceptThrow(tokensale.sendTransaction({ value: web3.toWei('1', 'ether'), from: userWallet }));
    });

    it('should not presale over cap', async () => {
      await deploy(5);
      await increaseTime(duration.days(1));

      await exceptThrow(tokensale.sendTransaction({
        value: web3.toBigNumber(web3.toWei('11', 'ether')),
        from: whitelist[0]
      }));
    });

    it('should not presale over cap while adding', async () => {
      await deploy(5);
      await increaseTime(duration.days(1));

      await exceptThrow(tokensale.sendTransaction({
        value: web3.toBigNumber(web3.toWei('11', 'ether')),
        from: whitelist[0]
      }));
    })

    it('cannot buy over limit', async () => {
      await exceptThrow(tokensale.sendTransaction({
        value: web3.toBigNumber(web3.toWei('5.1', 'ether')),
        from: whitelist[0]
      }));

      await tokensale.sendTransaction({
        value: web3.toBigNumber(web3.toWei('4', 'ether')),
        from: whitelist[0]
      });

      await exceptThrow(tokensale.sendTransaction({
        value: web3.toBigNumber(web3.toWei('1.1', 'ether')),
        from: whitelist[0]
      }));

    });

    it('limit behaves correctly when value has many decimal digits',
      async () => {
        await tokensale.sendTransaction({
          value: web3.toBigNumber(web3.toWei('2.51', 'ether')),
          from: whitelist[0]
        });

        await exceptThrow(tokensale.sendTransaction({
          value: web3.toBigNumber(web3.toWei('2.5', 'ether')),
          from: whitelist[0]
        }));
      }
    );


    it('tokens should be frozen', async () => {
      await tokensale.sendTransaction({
        value: web3.toBigNumber(web3.toWei('4', 'ether')),
        from: whitelist[0]
      });
      await exceptThrow(token.transfer(accounts[9], 1, {from: whitelist[0]}));
    });

    it('should be finalisable if hard cap reached', async () => {
      await deploy(5);
      await increaseTime(duration.days(2));

      await tokensale.sendTransaction({
        value: web3.toBigNumber(web3.toWei('5', 'ether')),
        from: whitelist[0]
      });
      await tokensale.finalise();
    });

    it('presale tokens transferable week after finalization', async () => {
      await deploy(5);
      await increaseTime(duration.days(2));

      await tokensale.sendTransaction({
        value: web3.toBigNumber(web3.toWei('5', 'ether')),
        from: whitelist[0]
      });
      await tokensale.finalise();

      await increaseTime(duration.weeks(1));

      await token.unfreeze();
      await token.transfer(accounts[9], 1, {from: whitelist[0]});

      assert.deepEqual((await token.balanceOf(accounts[9])).toString(), '1');

    });

  });

  describe('During Sale', () => {

    beforeEach(async () => {
      await increaseTime(duration.days(3));
    });

    it('should be possible to buy', async () => {
      await tokensale.sendTransaction({value: web3.toWei('1', 'ether'), from: userWallet});
      let balance = await token.balanceOf(userWallet);
      assert.equal(balance.div(await tokensale.rate()).toString(10), web3.toWei('1', 'ether'));
    });

    it('should not be possible to buy over hard cap', async () => {
      // Need to lower cap because of testrpc limitations
      await deploy(10);
      await increaseTime(duration.days(3));

      await exceptThrow(tokensale.sendTransaction({ value: web3.toWei('11', 'ether'), from: userWallet }));
      // Sanity check
      await tokensale.sendTransaction({ value: web3.toWei('9', 'ether'), from: userWallet });
    });

    it('tokens should be frozen', async () => {
      await tokensale.sendTransaction({ value: web3.toWei('1', 'ether'), from: accounts[9] });
      await exceptThrow(token.unfreeze());
      await exceptThrow(token.transfer(userWallet, 1, { from: userWallet }));
    });

    it('should not be possible to pause if not owner', async () => {
      await exceptThrow(tokensale.pause({from: userWallet}));
    })

    it('should not be possible to finalise', async () => {
      await exceptThrow(tokensale.finalise());
    });

    it('should be finalisable after hard cap reached', async () => {
      await deploy(3);
      await increaseTime(duration.days(3));

      await tokensale.sendTransaction({ value: web3.toWei('3', 'ether'), from: userWallet });
      await tokensale.finalise();
    });



    describe('Paused', () => {

      beforeEach(async () => {
        await tokensale.pause({from: owner});
      });

      it('should not be possible to buy', async () => {
        await exceptThrow(tokensale.sendTransaction({value: web3.toWei('1', 'ether'), from: userWallet}));
      });

      it('not owner should not be able to unpause', async () => {
        await exceptThrow(tokensale.unpause({from: userWallet}));
      });

      it('should buy tokens after unpause', async () => {
        await tokensale.unpause({from: owner});
        await tokensale.sendTransaction({value: web3.toWei('1', 'ether'), from: userWallet})
      });
    });

    describe('After sale', () => {

      beforeEach(async () => {
        await increaseTime(duration.days(3));
        await tokensale.sendTransaction({ value: web3.toWei('1', 'ether'), from: userWallet });
        await increaseTime(duration.days(30));
        await tokensale.finalise();
      });

      it('should be finalised', async () => {
        assert.equal(await token.mintingFinished(), true);
      });

      it('should not be possible to buy', async () => {
        await exceptThrow(tokensale.sendTransaction({value: web3.toWei('1', 'ether'), from: userWallet}));
        await exceptThrow(tokensale.sendTransaction({value: web3.toWei('1', 'ether'), from: whitelist[0]}));
      });

      it('should not be unfreezable', async () => {
        await exceptThrow(token.unfreeze());
      });

      describe('Unfrozen tokens',  () => {

        beforeEach(async () => {
          await increaseTime(duration.weeks(1));
          await token.unfreeze();
        })

        it('tokens should be unfreezable after a week', async () => {
          await token.transfer(accounts[8], 1, {from: userWallet});
          assert.deepEqual((await token.balanceOf(accounts[8])).toString(), '1');
        });

        it('investment wallet and misc. wallet transferable', async () => {
          await token.transfer(accounts[8], 1, {from: investmentFundWallet});
          await token.transfer(accounts[8], 1, {from: miscellaneousWallet});
          assert.deepEqual((await token.balanceOf(accounts[8])).toString(), '2');
        });

        it('team and reserve not transferable', async () => {
          await exceptThrow(token.transfer(accounts[8], 1, {from: teamWallet}));
          await exceptThrow(token.transfer(accounts[8], 1, {from: reserveWallet}));
        });

        it('team and reserve transferable after a year', async () => {
          await increaseTime(duration.years(1));
          await token.transfer(accounts[8], 1, {from: investmentFundWallet});
          await token.transfer(accounts[8], 1, {from: miscellaneousWallet});
          assert.deepEqual((await token.balanceOf(accounts[8])).toString(), '2');
        });


      });


    });

  });

});
