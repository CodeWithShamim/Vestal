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
  'event EnforcementAction(uint8 indexed action, uint64 atBlock, bytes32 attestation, string detail)',
]);

export const TOKEN_ABI = parseAbi([
  'function name() view returns (string)',
  'function symbol() view returns (string)',
]);

/** ActionType enum order in ICovenant.sol → frontend event-type union. */
export const ACTION_TYPES = ['wake', 'release', 'check_ok', 'flag', 'freeze', 'checkpoint', 'revival'];

/** GuardianStatus enum order in ICovenant.sol → frontend status union. */
export const GUARDIAN_STATUSES = ['active', 'enforcing', 'reviving'];
