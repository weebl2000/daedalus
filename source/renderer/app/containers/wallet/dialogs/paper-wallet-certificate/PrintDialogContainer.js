// @flow
import React, { Component } from 'react';
import { observer, inject } from 'mobx-react';
import PrintDialog from '../../../../components/wallet/paper-wallet-certificate/PrintDialog';
import type { ActionsMap } from '../../../../actions/index';

type Props = {
  actions: any | ActionsMap,
};

@inject('actions') @observer
export default class PrintDialogContainer extends Component<Props> {

  static defaultProps = { actions: null };

  onContinue = () => {
    this.props.actions.ada.wallets.updateCertificateStep.trigger();
  };

  render() {
    return (
      <PrintDialog
        onContinue={this.onContinue}
      />
    );
  }
}
