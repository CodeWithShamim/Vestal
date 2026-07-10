/**
 * The one write in the app: VestalLaunchFactory.createLaunch. Maps the
 * Launch Wizard's state (days, percents) onto the contract's units
 * (blocks, bps), simulates first so covenant reverts surface as readable
 * errors before the wallet prompt, then decodes LaunchCreated from the
 * receipt for the real token/covenant/guardian addresses.
 */
import { parseUnits, decodeEventLog } from 'viem';
import { BLOCK_TIME_SECONDS, VESTAL_CONTRACTS } from '../config/ritual.js';
import { FACTORY_ABI } from './abi.js';
import { publicClient } from './launches.js';
import { walletClient } from './wallet.js';

const daysToBlocks = (days) => Math.round((days * 86_400) / BLOCK_TIME_SECONDS);

/** Rolling sell-cap window committed for every launch (~30 days). */
const SELL_WINDOW_DAYS = 30;

/**
 * @param {{
 *   name: string, symbol: string, supply: string,
 *   publicLpPct: number, teamPct: number,
 *   lpLockDays: number,
 *   vest: { cliffDays: number, tranches: number, intervalDays: number },
 *   devCapPct: number, monitorBlocks: number,
 * }} wizard
 * @returns {Promise<{ token: `0x${string}`, covenant: `0x${string}`, guardian: `0x${string}`, termsHash: `0x${string}`, txHash: `0x${string}` }>}
 */
export async function deployLaunch(wizard) {
  const wallet = walletClient();
  if (!wallet) throw new Error('Connect a wallet on Ritual Chain first.');
  const client = publicClient();
  const creator = wallet.account.address;
  const nowBlock = await client.getBlockNumber();

  // Split the team allocation into equal tranches in bps; the rounding
  // remainder lands on the last tranche so the total is exact.
  const teamBps = Math.round(wizard.teamPct * 100);
  const perTranche = Math.floor(teamBps / wizard.vest.tranches);
  const tranches = Array.from({ length: wizard.vest.tranches }, (_, i) => ({
    label: `Team tranche ${i + 1} of ${wizard.vest.tranches}`,
    supplyBps: i === wizard.vest.tranches - 1 ? teamBps - perTranche * (wizard.vest.tranches - 1) : perTranche,
    releaseAtBlock: nowBlock + BigInt(daysToBlocks(wizard.vest.cliffDays + wizard.vest.intervalDays * i)),
    recipient: creator,
    released: false,
  }));

  const args = [
    {
      name: wizard.name,
      symbol: wizard.symbol,
      totalSupply: parseUnits(wizard.supply, 18),
    },
    {
      lpLockUntilBlock: nowBlock + BigInt(daysToBlocks(wizard.lpLockDays)),
      lpLockedBps: Math.round(wizard.publicLpPct * 100),
      devWalletCapBps: Math.round(wizard.devCapPct * 100),
      sellWindowBlocks: daysToBlocks(SELL_WINDOW_DAYS),
      monitorEveryBlocks: wizard.monitorBlocks,
    },
    tranches,
  ];

  const { request } = await client.simulateContract({
    address: VESTAL_CONTRACTS.LAUNCH_FACTORY,
    abi: FACTORY_ABI,
    functionName: 'createLaunch',
    args,
    account: creator,
  });
  const txHash = await wallet.writeContract(request);
  const receipt = await client.waitForTransactionReceipt({ hash: txHash });
  if (receipt.status !== 'success') throw new Error('Transaction reverted on-chain.');

  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== VESTAL_CONTRACTS.LAUNCH_FACTORY.toLowerCase()) continue;
    try {
      const ev = decodeEventLog({ abi: FACTORY_ABI, data: log.data, topics: log.topics });
      if (ev.eventName === 'LaunchCreated') {
        return {
          token: ev.args.token,
          covenant: ev.args.covenant,
          guardian: ev.args.guardian,
          termsHash: ev.args.termsHash,
          txHash,
        };
      }
    } catch {
      // Not a factory event — keep scanning.
    }
  }
  throw new Error('LaunchCreated event not found in transaction receipt.');
}
