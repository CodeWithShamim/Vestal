/**
 * Minimal ABIs for the Vestal contracts — only what the frontend reads.
 * Full ABIs live in contracts/out after `forge build`; keep these in
 * sync with contracts/src if the read surface changes.
 */
import { parseAbi } from 'viem';

export const REGISTRY_ABI = parseAbi([
  'struct Launch { address token; address covenant; address guardian; address creator; uint64 createdAtBlock; }',
  'function allLaunches() view returns (Launch[])',
]);

export const COVENANT_ABI = parseAbi([
  'struct VestingTranche { string label; uint16 supplyBps; uint64 releaseAtBlock; address recipient; bool released; }',
  'function terms() view returns (uint64 lpLockUntilBlock, uint16 lpLockedBps, uint16 devWalletCapBps, uint32 sellWindowBlocks, uint32 monitorEveryBlocks)',
  'function vesting() view returns (VestingTranche[])',
  'function guardianSummary() view returns (address agent, uint64 deployedAt, uint64 lastHeartbeat, uint32 revivalCount, uint8 status)',
  'function lockLp(address lpToken, uint256 amount)',
  'event EnforcementAction(uint8 indexed action, uint64 atBlock, bytes32 attestation, string detail)',
]);

export const TOKEN_ABI = parseAbi([
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function balanceOf(address) view returns (uint256)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
]);

export const POOL_FACTORY_ABI = parseAbi([
  'function poolOf(address token) view returns (address)',
  'function createPool(address token) returns (address pool)',
]);

export const POOL_ABI = parseAbi([
  'function reserves() view returns (uint256 native_, uint256 token_)',
  'function totalSupply() view returns (uint256)',
  'function addLiquidity(uint256 tokenIn) payable returns (uint256 shares)',
  'function priceX18() view returns (uint256)',
  'function quoteBuy(uint256 nativeIn) view returns (uint256 tokensOut)',
  'function quoteSell(uint256 tokenIn) view returns (uint256 nativeOut)',
  'function buy(uint256 minTokensOut) payable returns (uint256 tokensOut)',
  'function sell(uint256 tokenIn, uint256 minNativeOut) returns (uint256 nativeOut)',
  'event Swap(address indexed trader, bool indexed isBuy, uint256 nativeAmount, uint256 tokenAmount, uint256 priceX18)',
]);

export const FACTORY_ABI = parseAbi([
  'struct TokenParams { string name; string symbol; uint256 totalSupply; }',
  'struct CovenantTerms { uint64 lpLockUntilBlock; uint16 lpLockedBps; uint16 devWalletCapBps; uint32 sellWindowBlocks; uint32 monitorEveryBlocks; }',
  'struct VestingTranche { string label; uint16 supplyBps; uint64 releaseAtBlock; address recipient; bool released; }',
  'function createLaunch(TokenParams params, CovenantTerms terms, VestingTranche[] tranches) returns (address token, address covenant, address guardian)',
  'event LaunchCreated(address indexed token, address indexed covenant, address indexed creator, address guardian, bytes32 termsHash)',
]);

/** ActionType enum order in ICovenant.sol → frontend event-type union. */
export const ACTION_TYPES = ['wake', 'release', 'check_ok', 'flag', 'freeze', 'checkpoint', 'revival'];

/** GuardianStatus enum order in ICovenant.sol → frontend status union. */
export const GUARDIAN_STATUSES = ['active', 'enforcing', 'reviving'];
