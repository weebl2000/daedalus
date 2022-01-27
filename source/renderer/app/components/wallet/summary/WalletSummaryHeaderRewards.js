// @flow
import BigNumber from 'bignumber.js';
import React from 'react';
import { observer } from 'mobx-react';
import {
  defineMessages,
  FormattedHTMLMessage,
  FormattedMessage,
} from 'react-intl';
import { PopOver } from 'react-polymorph/lib/components/PopOver';
import SVGInline from 'react-svg-inline';
import questionMarkIcon from '../../../assets/images/question-mark.inline.svg';
import { useDiscreetModeFeature } from '../../../features';
import type { ReplacerFn } from '../../../features/discreet-mode/types';
import { formattedWalletAmount } from '../../../utils/formatters';
import styles from './WalletSummaryHeaderRewards.scss';

const messages = defineMessages({
  rewards: {
    id: 'wallet.summary.header.rewardsSummary',
    defaultMessage: '!!!{total} rewards earned, {unspent} unspent rewards',
    description: 'Headline for the Decentralisation notification.',
  },
  unspendableTooltip: {
    id: 'wallet.summary.header.unspendableTooltip',
    defaultMessage:
      '!!!info message about unspendable rewards due to missing utxos',
    description:
      'Tooltip describing that rewards are unspendable on the Wallet summary header',
  },
});

export function getFormattedRewardAmount(amount: BigNumber): string {
  return amount.isGreaterThan(0) && amount.isLessThan(0.1)
    ? '< 0.1 ADA'
    : formattedWalletAmount(amount, true, false, 'ADA', 1);
}

export function discreetRewardsAmount(
  isRestoring: boolean = false
): ReplacerFn {
  return (isDiscreetMode, symbol, value) => {
    if (isRestoring) {
      return '-';
    }
    if (!isDiscreetMode) {
      return getFormattedRewardAmount(value);
    }
    return `${symbol} ADA`;
  };
}

export type WalletSummaryHeaderRewardsProps = {|
  total: BigNumber,
  unspent: BigNumber,
  walletAmount: BigNumber,
  isRestoring: boolean,
|};

function WalletSummaryHeaderRewards(props: WalletSummaryHeaderRewardsProps) {
  const discreetModeFeature = useDiscreetModeFeature();
  const { isRestoring, total, unspent, walletAmount } = props;
  return (
    <div className={styles.component}>
      <FormattedHTMLMessage
        {...messages.rewards}
        values={{
          total: discreetModeFeature.discreetValue({
            replacer: discreetRewardsAmount(isRestoring),
            value: total,
          }),
          unspent: discreetModeFeature.discreetValue({
            replacer: discreetRewardsAmount(isRestoring),
            value: unspent,
          }),
        }}
      />
      {walletAmount.isGreaterThan(0) && walletAmount.isEqualTo(unspent) && (
        <PopOver
          offset={[0, 10]}
          content={<FormattedMessage {...messages.unspendableTooltip} />}
        >
          <span className={styles.questionMark}>
            <SVGInline svg={questionMarkIcon} />
          </span>
        </PopOver>
      )}
    </div>
  );
}

export default observer(WalletSummaryHeaderRewards);