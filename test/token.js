var CREDToken = artifacts.require('./CREDToken.sol');
import increaseTime, { duration, increaseTimeTo } from 'zeppelin-solidity/test/helpers/increaseTime';
import latestTime from 'zeppelin-solidity/test/helpers/latestTime';
import exceptThrow from 'zeppelin-solidity/test/helpers/expectThrow';

contract('CREDToken', function (accounts) {

  let token,
    owner = accounts[0],
    teamWallet = accounts[1],
    reserveWallet = accounts[2],
    advisorsWallet = accounts[3],
    userWallet = accounts[4],
    cap = web3.toBigNumber(web3.toWei(50000000, 'ether')),
    initialMintValue = web3.toBigNumber(web3.toWei(10000, 'ether')),
    beginTime;


  beforeEach(async () => {
    beginTime = latestTime();
    token = await CREDToken.new(
      cap,
      beginTime + duration.years(1),
      teamWallet,
      reserveWallet,
      advisorsWallet,
      {from: owner}
    );
  });

  describe('Minting', () => {

    beforeEach(async () => {
      await token.mint(userWallet, initialMintValue, {from: owner});
    });

    it('should not transfer', async () => {
      await exceptThrow(token.transfer(accounts[6], 100, {from: userWallet}));
    });

    it('should not approve transfer', async () => {
      await exceptThrow(token.approve(accounts[6], 100, {from: userWallet}));
    });

    it('should not mint more than cap', async () => {
      await exceptThrow(token.mint(userWallet, cap.plus(1), {from: owner}));
    });

    it('not owner should not be able to mint', async () => {
      await exceptThrow(token.mint(userWallet, initialMintValue, {from: userWallet}));
    });

    it('should add when minting', async () => {
      await token.mint(userWallet, initialMintValue, {from: owner});
      assert.deepEqual(await token.balanceOf(userWallet), initialMintValue.plus(initialMintValue));
    });

    it('should not be able to mint locked twice', async () => {
      await token.mintAdvisorsTokens(web3.toWei('5500000', 'ether'), {from: owner});
      await exceptThrow(token.mintAdvisorsTokens(web3.toWei('5500000', 'ether'), {from: owner}));

      await token.mintTeamTokens(web3.toWei('10000000', 'ether'), {from: owner});
      await exceptThrow(token.mintTeamTokens(web3.toWei('10000000', 'ether'), {from: owner}));

      await token.mintReserveTokens(web3.toWei('10000000', 'ether'), {from: owner});
      await exceptThrow(token.mintReserveTokens(web3.toWei('10000000', 'ether'), {from: owner}));
    });

    it('only owner should be able to finalise', async () => {
      await exceptThrow(token.finalise({from: userWallet}));
    })

  });

  describe('Frozen', () => {

    beforeEach(async () => {
      await token.mint(userWallet, initialMintValue, {from: owner});
      await token.mintAdvisorsTokens(web3.toWei('5500000', 'ether'), {from: owner});
      await token.mintTeamTokens(web3.toWei('10000000', 'ether'), {from: owner});
      await token.mintReserveTokens(web3.toWei('10000000', 'ether'), {from: owner});
      await token.finalise({from: owner});
    });

    it('should compute total supply', async () => {
      let expectedTotalSupply =
        initialMintValue
          .plus(web3.toWei('5500000', 'ether'))
          .plus(web3.toWei('10000000', 'ether'))
          .plus(web3.toWei('10000000', 'ether'));
      assert.deepEqual(await token.totalSupply(), expectedTotalSupply);
    })

    it('owner is 0x0', async () => {
      assert.equal(await token.owner(), '0x0000000000000000000000000000000000000000');
    })

    it('should not be able to unfreeze tokens right after tokensale ends', async () => {
      await exceptThrow(token.unfreeze({from: userWallet}));
    })

    it('should not be able to transfer frozen tokens', async () => {
      await exceptThrow(token.transfer(accounts[6], 100, {from: userWallet}));
    });

    it('should not be able to finalise twice', async () => {
      await exceptThrow(token.finalise({from: owner}));
    });

    it('should not be able to unlock tokens right after sale', async () => {
      await exceptThrow(token.unlockTeamAndReserveTokens({from: userWallet}));
      await exceptThrow(token.unlockAdvisorTokens({from: userWallet}));
    });

  });

  describe('Liquid', () => {

    beforeEach(async () => {
      await token.mint(userWallet, initialMintValue, {from: owner});
      await token.mintAdvisorsTokens(web3.toWei('5500000', 'ether'), {from: owner});
      await token.mintTeamTokens(web3.toWei('10000000', 'ether'), {from: owner});
      await token.mintReserveTokens(web3.toWei('10000000', 'ether'), {from: owner});
      await token.finalise({from: owner});
      await increaseTimeTo(latestTime() + duration.weeks(1));
      await token.unfreeze();
    });

    it('should be able to transfer frozen tokens', async () => {
      await token.transfer(accounts[6], 100, {from: userWallet});
      assert.deepEqual(await token.balanceOf(userWallet), initialMintValue.minus(100));
      assert.deepEqual(await token.balanceOf(accounts[6]), web3.toBigNumber(100));
    });

    it('should not be able to unlock team and reserve tokens', async () => {
      await exceptThrow(token.unlockTeamAndReserveTokens({from: userWallet}));
    });

    describe('Reserve and team', () => {

      it('should be able to unlock all reserve tokens after a year', async () => {
        await increaseTimeTo(beginTime + duration.years(1));
        await token.unlockTeamAndReserveTokens({from: owner});
        assert.deepEqual(await token.balanceOf(teamWallet),
          web3.toBigNumber(web3.toWei('10000000', 'ether')));
        assert.deepEqual(await token.balanceOf(reserveWallet),
          web3.toBigNumber(web3.toWei('10000000', 'ether')));
      });

      it('should be able to unlock reserve tokens only once', async () => {
        await increaseTimeTo(beginTime + duration.years(1));
        await token.unlockTeamAndReserveTokens({from: owner});
        await exceptThrow(token.unlockTeamAndReserveTokens({from: owner}));
      });

    });

    describe('Advisors', () => {

      it('not unlockable 1 week after sale end', async () => {
        await exceptThrow(token.unlockAdvisorTokens());
      });

      it('can unlock only once during one cliff', async () => {
        await increaseTime(duration.days(92));
        await token.unlockAdvisorTokens();
        await exceptThrow(token.unlockAdvisorTokens());
        assert.isTrue((await token.balanceOf(advisorsWallet)).toNumber() > 0);
      });

      it('should unlock all after 2 years', async () => {
        await increaseTime(duration.years(1));
        await token.unlockAdvisorTokens();
        await increaseTime(duration.years(1));
        await token.unlockAdvisorTokens();

        assert.deepEqual(
          await token.balanceOf(advisorsWallet),
          web3.toBigNumber(web3.toWei('5500000', 'ether')));

      });



    });


  });
})
