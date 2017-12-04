pragma solidity ^0.4.18;


import 'zeppelin-solidity/contracts/token/CappedToken.sol';
import 'zeppelin-solidity/contracts/ownership/Ownable.sol';
import 'zeppelin-solidity/contracts/token/TokenVesting.sol';


contract CREDToken is CappedToken {
    using SafeMath for uint256;

    /**
     * Constant fields
     */

    string public constant name = "Verify Token";
    uint8 public constant decimals = 18;
    string public constant symbol = "CRED";

    /**
     * Immutable state variables
     */

    // Time when team and reserved tokens are unlocked
    uint256 public reserveUnlockTime;

    address public teamWallet;
    address public reserveWallet;
    address public advisorsWallet;

    /**
     * State variables
     */

    uint256 teamLocked;
    uint256 reserveLocked;
    uint256 advisorsLocked;

    // Are the tokens non-transferrable?
    bool public locked = true;

    // Phase information for slow-release tokens.
    uint256 public unfreezeTime = 0;

    bool public unlockedReserveAndTeamFunds = false;

    TokenVesting public advisorsVesting = TokenVesting(address(0));
    uint256 public previousTokenTransfer = 0;
    /**
     * Events
     */

    event MintLocked(address indexed to, uint256 amount);

    /**
     * Modifiers
     */

    // Tokens must not be locked.
    modifier whenLiquid {
        require(!locked);
        _;
    }

    modifier mintLockedOnlyOnce {
        require(advisorsLocked == 0);
        _;
    }

    modifier afterReserveUnlockTime {
        require(now >= reserveUnlockTime);
        _;
    }

    modifier unlockReserveAndTeamOnce {
        require(!unlockedReserveAndTeamFunds);
        _;
    }

    /**
     * Constructor
     */
    function CREDToken(
        uint256 _cap,
        uint256 _yearLockEndTime,
        address _teamWallet,
        address _reserveWallet,
        address _advisorsWallet
    )
    CappedToken(_cap)
    public
    {
        reserveUnlockTime = _yearLockEndTime;
        teamWallet = _teamWallet;
        reserveWallet = _reserveWallet;
        advisorsWallet = _advisorsWallet;
    }

    // Mint a certain number of tokens that are locked up.
    // _value has to be bounded not to overflow.
    function mintAdvisorsTokens(uint256 _value) public onlyOwner canMint {
        require(advisorsLocked == 0);
        advisorsLocked = _value;
        totalSupply = totalSupply.add(_value);
        MintLocked(advisorsWallet, _value);
    }

    function mintTeamTokens(uint256 _value) public onlyOwner canMint {
        require(teamLocked == 0);
        teamLocked = _value;
        totalSupply = totalSupply.add(_value);
        MintLocked(teamWallet, _value);
    }

    function mintReserveTokens(uint256 _value) public onlyOwner canMint {
        require(reserveLocked == 0);
        reserveLocked = _value;
        totalSupply = totalSupply.add(_value);
        MintLocked(reserveWallet, _value);
    }


    /// Finalise any minting operations. Resets the owner and causes normal tokens
    /// to be frozen. Also begins the countdown for locked-up tokens.
    function finalise() public onlyOwner {
        require(reserveLocked > 0);
        require(teamLocked > 0);
        require(advisorsLocked > 0);
        finishMinting();
        owner = 0;
        advisorsVesting = new TokenVesting(advisorsWallet, now, 92 days, 2 years, false);
        balances[advisorsVesting] = advisorsLocked;
        unfreezeTime = now + 1 weeks;
    }


    // Causes tokens to be liquid 1 week after the tokensale is completed
    function unfreeze() public {
        require(unfreezeTime > 0);
        require(now >= unfreezeTime);
        locked = false;
    }


    /// Unlock any now freeable tokens that are locked up for account `_who`.
    function unlockTeamAndReserveTokens() public whenLiquid afterReserveUnlockTime unlockReserveAndTeamOnce{
        balances[teamWallet] = balances[teamWallet].add(teamLocked);
        balances[reserveWallet] = balances[reserveWallet].add(reserveLocked);
        teamLocked = 0;
        reserveLocked = 0;
        unlockedReserveAndTeamFunds = true;
    }

    function unlockAdvisorTokens() public whenLiquid {
        require(now >= previousTokenTransfer + 30 days);
        advisorsVesting.release(this);
        previousTokenTransfer = now;
    }


    /**
     * Methods overriding some OpenZeppelin functions to prevent calling them when token is not liquid.
     */

    function transfer(address _to, uint256 _value) public whenLiquid returns (bool) {
        return super.transfer(_to, _value);
    }

    function transferFrom(address _from, address _to, uint256 _value) public whenLiquid returns (bool) {
        return super.transferFrom(_from, _to, _value);
    }

    function approve(address _spender, uint256 _value) public whenLiquid returns (bool) {
        return super.approve(_spender, _value);
    }

    function increaseApproval(address _spender, uint256 _addedValue) public whenLiquid returns (bool) {
        return super.increaseApproval(_spender, _addedValue);
    }

    function decreaseApproval(address _spender, uint256 _subtractedValue) public whenLiquid returns (bool) {
        return super.decreaseApproval(_spender, _subtractedValue);
    }

}
